import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getLang, m, translateZod } from "@/lib/i18n/api-messages";
import { getActivePharmacyId } from "@/lib/pharmacy";

const rowSchema = z.object({
  registerDate: z.string().datetime(),
  posAmount: z.number().min(0).default(0),
  cashAmount: z.number().min(0).default(0),
  wireAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  rows: z.array(rowSchema).min(1).max(50000),
  // Bu yüklemeye ait tüm satırları tek bir grupta işaretlemek için — kullanıcı
  // yanlış eşleştirilmiş/istenmeyen bir dosyayı tek tek gün gün silmek yerine
  // "İçe Aktarma Geçmişi"nden tek bir işlemle TÜM yüklemeyi geri alabilsin
  // diye (Satış Raporu'ndaki aynı desen). İstemci üretir (crypto.randomUUID),
  // sunucu yalnızca olduğu gibi saklar.
  importBatchId: z.string().optional(),
  fileName: z.string().optional(),
});

// Binlerce satırlık dosyalarda (ör. günlük yerine işlem/fiş bazlı bir dosya
// yanlışlıkla yüklendiğinde) TÜM tarihleri tek bir Prisma `in` sorgusuna ve
// tek bir `createMany`'a vermek, üretimde (Vercel) fonksiyon zaman aşımına
// takılıp genel bir "Sunucu hatası" ile sonuçlanıyordu. Satırlar bu yüzden
// küçük gruplar (chunk) halinde işlenir — hem sorgu/insert boyutu makul
// kalır hem de zaman aşımı riski ortadan kalkar.
const CHUNK_SIZE = 500;
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Vercel'de varsayılan fonksiyon süresi sınırını (plana göre 10-15s) büyük
// toplu kayıtlar için yükseltir — plan bunu desteklemiyorsa etkisizdir,
// zarar vermez.
export const maxDuration = 60;

type CreateRow = {
  pharmacyId: string; registerDate: Date; posAmount: number; cashAmount: number;
  wireAmount: number; notes: string | null; importBatchId: string | null; fileName: string | null;
};

// `import_batch_id`/`file_name` sütunları İçe Aktarma Geçmişi özelliğiyle
// birlikte eklendi (bkz. prisma/migrations/20260814150000_...). Eğer bir
// dağıtımda (deploy sırası/zamanlaması nedeniyle) yeni uygulama kodu canlıya
// alınmış ama veritabanı migration'ı henüz uygulanmamışsa, bu iki alanı
// yazmaya çalışmak "sütun mevcut değil" tarzı bir veritabanı hatasıyla
// TÜM toplu kaydetmeyi engelliyordu — halbuki asıl kritik olan kasa
// tutarlarının kaydedilmesi, içe aktarma geçmişi izlemesi ikincil bir
// özelliktir. Bu yüzden önce tam veriyle denenir; hata mesajı gerçekten bu
// iki alanla ilgiliyse (sütun/alan mevcut değil), importBatchId/fileName
// OLMADAN sessizce tekrar denenir — kullanıcının kaydı kaybolmaz, yalnızca
// o yükleme İçe Aktarma Geçmişi'nde görünmez.
async function createManyResilient(rows: CreateRow[]): Promise<void> {
  try {
    await prisma.dailyRegister.createMany({ data: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeMissingBatchColumns =
      /import_batch_id|importBatchId|file_name|fileName/i.test(msg) &&
      /does not exist|unknown argument|unknown field|column/i.test(msg);
    if (!looksLikeMissingBatchColumns) throw err;
    console.error("Kasa Bulk: importBatchId/fileName sütunları olmadan yeniden deneniyor (muhtemelen migration henüz uygulanmadı):", msg);
    await prisma.dailyRegister.createMany({
      data: rows.map(({ importBatchId: _importBatchId, fileName: _fileName, ...rest }) => rest),
    });
  }
}

// POST /api/v1/finans/kasa/bulk — Onaylanan Kasa (Z-raporu) satırlarını toplu
// kaydeder. `daily_registers`'ta (pharmacyId, registerDate) benzersiz olduğu
// için — mevcut bir güne ait kayıt varsa o satır SESSİZCE ATLANIR (üzerine
// YAZILMAZ, kullanıcının elle girdiği bir kaydı kazara ezmemek için); hangi
// tarihlerin atlandığı yanıtta `skippedDates` olarak döner ki kullanıcı
// bilsin. Satış Raporu'ndaki "İçe Aktarma Geçmişi" ile aynı denetim
// (audit log) kuralı uygulanır.
export async function POST(req: Request): Promise<Response> {
  const lang = getLang(req);
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(m("unauthorized", lang), "UNAUTHORIZED", 401);
    const pharmacyId = await getActivePharmacyId(session.user.id);
    if (!pharmacyId) return apiError(m("noPharmacy", lang), "NO_PHARMACY", 404);

    const body = await req.json();
    const validated = bulkSchema.parse(body);

    let createdCount = 0;
    const skippedDates: string[] = [];

    // `daily_registers`'ta (pharmacyId, registerDate) BENZERSİZ olduğu için,
    // yüklenen dosyanın KENDİ İÇİNDE aynı tarihten birden fazla satır varsa
    // (ör. günlük yerine işlem/fiş bazlı bir dosya yanlışlıkla yüklendiğinde,
    // her fiş kendi satırı olarak gelir) `createMany` benzersizlik kısıtını
    // ihlal edip TÜM grubu (chunk) reddediyor ve bu genel bir "Sunucu
    // hatası"na düşüyordu. Aynı tarih dosya içinde birden fazla kez
    // geçiyorsa İLK satır alınır, sonrakiler (mevcut DB kaydı gibi)
    // sessizce üzerine yazılmadan atlanır ve skippedDates'e eklenir —
    // veri asla uydurulmaz/toplanmaz, sadece hangi tarihlerin atlandığı
    // şeffafça bildirilir.
    const seenInFile = new Set<string>();

    for (const rowsChunk of chunk(validated.rows, CHUNK_SIZE)) {
      const dates = rowsChunk.map(r => new Date(r.registerDate.slice(0, 10) + "T00:00:00.000Z"));
      const existing = await prisma.dailyRegister.findMany({
        where: { pharmacyId, deletedAt: null, registerDate: { in: dates } },
        select: { registerDate: true },
      });
      const existingKeys = new Set(existing.map(e => e.registerDate.toISOString().slice(0, 10)));

      const toCreate: Array<{
        pharmacyId: string; registerDate: Date; posAmount: number; cashAmount: number;
        wireAmount: number; notes: string | null; importBatchId: string | null; fileName: string | null;
      }> = [];

      for (const r of rowsChunk) {
        const dateKey = r.registerDate.slice(0, 10);
        if (existingKeys.has(dateKey) || seenInFile.has(dateKey)) {
          skippedDates.push(dateKey);
          continue;
        }
        seenInFile.add(dateKey);
        toCreate.push({
          pharmacyId,
          registerDate: new Date(dateKey + "T00:00:00.000Z"),
          posAmount: r.posAmount,
          cashAmount: r.cashAmount,
          wireAmount: r.wireAmount,
          notes: r.notes ?? null,
          importBatchId: validated.importBatchId ?? null,
          fileName: validated.fileName ?? null,
        });
      }

      if (toCreate.length > 0) {
        await createManyResilient(toCreate);
        createdCount += toCreate.length;
      }
    }

    await logAudit({
      userId: session.user.id,
      pharmacyId,
      action: "CREATE",
      entityType: "DailyRegisterBatch",
      entityId: `batch_${Date.now()}`,
      newData: { createdCount, skippedCount: skippedDates.length },
    });

    return apiResponse({ created: createdCount, skippedDates }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(translateZod(error.issues[0]?.message ?? "Geçersiz veri", lang), "VALIDATION_ERROR", 422);
    }
    console.error("Kasa Bulk POST Error:", error instanceof Error ? error.message : error);
    return apiError(m("serverError", lang), "SERVER_ERROR", 500);
  }
}
