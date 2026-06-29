import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { apiError, apiResponse } from "@/lib/utils";

const rowSchema = z.object({
  productGroup: z.string().default("Genel"),
  productName: z.string().min(1),
  saleDate: z.string().datetime(),
  price: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  netRevenue: z.number().min(0).default(0),
  saleType: z.enum(["PRESCRIPTION", "RETAIL"]).default("RETAIL"),
  quantity: z.number().int().min(1).default(1),
});

const confirmSchema = z.object({
  rows: z.array(rowSchema),
  importBatchId: z.string().optional(),
});

async function getPharmacyId(userId: string): Promise<string | null> {
  const role = await prisma.userPharmacyRole.findFirst({
    where: { userId },
    select: { pharmacyId: true },
  });
  return role?.pharmacyId ?? null;
}

// POST /api/v1/satis  — onaylanan satışları kaydet
export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return NextResponse.json({ error: "Eczane bulunamadı" }, { status: 404 });

    const body = await req.json();
    const { rows, importBatchId } = confirmSchema.parse(body);

    const batchId = importBatchId ?? `batch_${Date.now()}`;

    const mapped = rows.map(r => ({
      pharmacyId,
      productGroup: r.productGroup,
      productName: r.productName,
      saleDate: new Date(r.saleDate),
      price: r.price,
      discountAmount: r.discountAmount,
      netRevenue: r.netRevenue > 0 ? r.netRevenue : r.price * r.quantity - r.discountAmount,
      saleType: r.saleType,
      quantity: r.quantity,
      importBatchId: batchId,
    }));

    // PostgreSQL max 65535 parametre — 9 alan × 7000 = 63000 < limit
    const CHUNK = 7000;
    for (let i = 0; i < mapped.length; i += CHUNK) {
      await prisma.saleRecord.createMany({ data: mapped.slice(i, i + CHUNK) });
    }

    return NextResponse.json({ success: true, count: rows.length, batchId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// GET /api/v1/satis?start=&end=&type=&group=
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError("Yetkisiz", "UNAUTHORIZED", 401);
    const pharmacyId = await getPharmacyId(session.user.id);
    if (!pharmacyId) return apiError("Eczane bulunamadı", "NO_PHARMACY", 404);

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const typeParam = searchParams.get("type") as "PRESCRIPTION" | "RETAIL" | null;
    const groupParam = searchParams.get("group");

    const start = startParam
      ? new Date(startParam.slice(0, 10) + "T00:00:00.000Z")
      : new Date(Date.UTC(new Date().getFullYear(), 0, 1));
    const end = endParam
      ? new Date(endParam.slice(0, 10) + "T23:59:59.999Z")
      : new Date();

    const records = await prisma.saleRecord.findMany({
      where: {
        pharmacyId,
        deletedAt: null,
        saleDate: { gte: start, lte: end },
        ...(typeParam && { saleType: typeParam }),
        ...(groupParam && { productGroup: groupParam }),
      },
      orderBy: { saleDate: "desc" },
    });

    // netRevenue alanı varsa kullan, yoksa hesapla (eski kayıtlar için fallback)
    type SaleRow = typeof records[number];
    const getNet = (r: SaleRow) => {
      const nr = Number((r as SaleRow & { netRevenue?: unknown }).netRevenue ?? 0);
      if (nr > 0) return nr;
      return Number(r.price) * r.quantity - Number(r.discountAmount);
    };

    const totalRevenue = records.reduce((s, r) => s + getNet(r), 0);
    const prescriptionCount = records.filter(r => r.saleType === "PRESCRIPTION").length;
    const retailCount = records.filter(r => r.saleType === "RETAIL").length;
    const prescriptionRevenue = records.filter(r => r.saleType === "PRESCRIPTION").reduce((s, r) => s + getNet(r), 0);
    const retailRevenue = records.filter(r => r.saleType === "RETAIL").reduce((s, r) => s + getNet(r), 0);

    const byGroup: Record<string, number> = {};
    records.forEach(r => {
      const g = r.productGroup ?? "Genel";
      byGroup[g] = (byGroup[g] ?? 0) + getNet(r);
    });

    return apiResponse({
      records: records.map(r => ({
        id: r.id,
        productGroup: r.productGroup,
        productName: r.productName,
        saleDate: r.saleDate.toISOString(),
        price: Number(r.price),
        discountAmount: Number(r.discountAmount),
        netRevenue: getNet(r),
        saleType: r.saleType,
        quantity: r.quantity,
      })),
      summary: {
        totalRecords: records.length,
        totalRevenue,
        prescriptionCount,
        retailCount,
        prescriptionRevenue,
        retailRevenue,
        byGroup,
      },
    });
  } catch {
    return apiError("Sunucu hatası", "SERVER_ERROR", 500);
  }
}
