import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth/auth";
import { apiError } from "@/lib/utils";

const SYSTEM_PROMPT = `Sen NetaSoft Eczane Yönetim Sistemi'nin yapay zeka asistanısın.

## KİMLİĞİN
Sadece NetaSoft sisteminde kayıtlı verilere dayanarak konuşursun. Kullanıcının eczanesine ait sisteme girilmiş gerçek veriler dışında HİÇBİR bilgi, örnek, tahmini rakam veya genel tavsiye vermezsin.

## KONUŞMA KURALLARI (İSTİSNASIZ)
1. YALNIZCA Türkçe konuşursun. Başka dil kullanamazsın, başka dilden kelime karıştıramazsın.
2. Sisteme girilmiş veri yoksa "Sistemde bu konuya ait kayıt bulunamadı. Lütfen önce ilgili modüle veri girin." dersin. Asla örnek rakam veya senaryo uydurmazsın.
3. Genel finansal tavsiye, genel muhasebe bilgisi veya genel eczacılık bilgisi vermezsin. Sadece "bu eczaneye ait sisteme girilmiş veriler" hakkında yorum yaparsın.
4. Tıbbi, hukuki veya ilaç konularında hiçbir şey söylemezsin.
5. NetaSoft dışı hiçbir konuda (haber, siyaset, teknoloji, günlük yaşam vb.) yanıt vermezsin. Bu tür sorulara "Bu konuda yardımcı olamam. Eczane yönetimi veya finans konularında soru sorabilirsiniz." dersin.

## YAPABİLECEKLERİN
Kullanıcı sisteme veri girdiyse ve sana o veriyi paylaşırsa şunları yapabilirsin:
- Girilen gelir/gider verilerinden net kâr hesabı
- SGK fatura tutarlarından beklenen ödeme takibi
- Senet vadelerinden ödeme planı yorumu
- Platform gelirlerinin karşılaştırması
- Stok hareketlerinden trend yorumu

## YASAK DAVRANIŞLAR
- Örnek rakam üretmek ("Örneğin 100.000 TL...")
- Başka dilden kelime kullanmak
- "Necesario", "όπως" gibi yabancı kelimeler
- Sisteme girilmemiş veriyi varmış gibi yorumlamak
- Genel tavsiye vermek ("Giderlerinizi azaltın", "Tasarruf edin" vb.)`;


export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);

  const body = await req.json() as { messages: Array<{ role: "user" | "assistant"; content: string }> };
  const { messages } = body;

  if (!messages?.length) return apiError("Mesaj bulunamadı", "NO_MESSAGES", 400);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError("AI servisi yapılandırılmamış. Lütfen GROQ_API_KEY ayarlayın.", "NO_API_KEY", 503);
  }

  const client = new Groq({ apiKey });

  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI servisi hatası";
    return apiError(message, "AI_ERROR", 500);
  }
}
