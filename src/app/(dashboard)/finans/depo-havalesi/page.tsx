"use client";

import { useState, useEffect } from "react";
import { useLangContext } from "@/app/providers/LangProvider";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface SupplierTransfer {
  id: string;
  supplierName: string;
  amount: number;
  currency: string;
  transferDate: string;
  notes?: string;
}

const EMPTY = {
  supplierName: "",
  amount: "",
  transferDate: new Date().toISOString().split("T")[0],
  notes: "",
};

export default function DepoHavalesiPage() {
  const { lang } = useLangContext();
  const [transfers, setTransfers] = useState<SupplierTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { void fetchTransfers(); }, []);

  const fetchTransfers = async () => {
    try {
      const res = await fetch("/api/v1/finans/depo-havalesi", { headers: { "Accept-Language": lang } });
      const json = await res.json() as { success: boolean; data?: SupplierTransfer[] };
      if (json.success && json.data) setTransfers(json.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/finans/depo-havalesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" , "Accept-Language": lang },
        body: JSON.stringify({
          supplierName: form.supplierName,
          amount: parseFloat(form.amount),
          transferDate: form.transferDate + "T00:00:00.000Z",
          notes: form.notes,
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Bir hata oluştu");
      setForm(EMPTY);
      await fetchTransfers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/finans/depo-havalesi/${deleteId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setDeleteId(null);
      await fetchTransfers();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const totalAmount = transfers.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>Depo Havalesi / EFT</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "4px" }}>
          Depoya yapılan havale ve EFT ödemelerini kaydedin
        </p>
      </div>

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
        {[
          { label: "Toplam Havale", value: transfers.length + " İşlem" },
          { label: "Bu Dönem Toplam", value: totalAmount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }) },
          { label: "Son Havale", value: transfers[0] ? transfers[0].supplierName : "—" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "var(--spacing-4)" }}>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px" }}>{c.label}</div>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "var(--spacing-6)", alignItems: "start" }}>

        {/* Form */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-5)" }}>Yeni Havale Ekle</h2>

          {error && (
            <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
            <div className="form-group">
              <label className="form-label required">Depo Adı</label>
              <input
                type="text" className="form-input" name="supplierName"
                value={form.supplierName} onChange={handleChange}
                placeholder="Bağfaş, Hedef Ecza vb." required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Havale Tutarı (₺)</label>
              <input
                type="number" step="0.01" min="0.01" className="form-input" name="amount"
                value={form.amount} onChange={handleChange}
                placeholder="0,00" required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Havale Tarihi</label>
              <input
                type="date" className="form-input" name="transferDate"
                value={form.transferDate} onChange={handleChange} required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-input" name="notes" rows={2}
                value={form.notes} onChange={handleChange}
                placeholder="Fatura no, açıklama vb. (isteğe bağlı)"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : "Havale Kaydet"}
            </button>
          </form>
        </div>

        {/* Tablo */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-base)", fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
            Havale Geçmişi
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : transfers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)", fontSize: "14px" }}>
              Henüz havale kaydı yok.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Depo</th>
                    <th>Tutar</th>
                    <th>Açıklama</th>
                    <th style={{ textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map(t => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {format(new Date(t.transferDate), "dd MMM yyyy", { locale: tr })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.supplierName}</td>
                      <td style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                        {Number(t.amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "13px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.notes || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => setDeleteId(t.id)}
                          style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--color-border)" }}>
                    <td colSpan={2} style={{ fontWeight: 700, paddingTop: "12px" }}>Toplam</td>
                    <td style={{ fontWeight: 700, paddingTop: "12px", color: "var(--color-danger)" }}>
                      {totalAmount.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sil Modal */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>Havaleyi Sil</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              Bu havale kaydını silmek istediğinizden emin misiniz?
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>İptal</button>
              <button
                className="btn"
                style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
