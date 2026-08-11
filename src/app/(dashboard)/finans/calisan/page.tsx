"use client";
import { useLangContext } from "@/app/providers/LangProvider";
import { t, tx } from "@/lib/i18n/translations";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr as trLocale, enUS } from "date-fns/locale";

type Employee = { id: string; firstName: string; lastName: string };
type EmployeeExpense = {
  id: string;
  expenseDate: string;
  salaryAmount: number;
  sgkAmount: number;
  foodAmount: number;
  transportAmount: number;
  totalAmount: number;
  notes?: string;
  employee: Employee;
};

export default function CalisanPage() {
  const { lang } = useLangContext();
  const locale = lang === "en" ? enUS : trLocale;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<EmployeeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);
  const [deletingExp, setDeletingExp] = useState(false);
  const [editExp, setEditExp] = useState<EmployeeExpense | null>(null);
  const [editExpForm, setEditExpForm] = useState({ salaryAmount: "", sgkAmount: "", foodAmount: "", transportAmount: "", expenseDate: "", notes: "" });
  const [editExpSubmitting, setEditExpSubmitting] = useState(false);
  const [histStart, setHistStart] = useState("");
  const [histEnd, setHistEnd] = useState("");

  const [empData, setEmpData] = useState({ firstName: "", lastName: "", identityNumber: "", phone: "" });
  const [expData, setExpData] = useState({
    employeeId: "",
    expenseDate: new Date().toISOString().split("T")[0],
    salaryAmount: "",
    sgkAmount: "",
    foodAmount: "",
    transportAmount: "",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, expRes] = await Promise.all([
        fetch("/api/v1/finans/calisan", { headers: { "Accept-Language": lang } }),
        fetch("/api/v1/finans/calisan-gider", { headers: { "Accept-Language": lang } }),
      ]);
      const empJson = await empRes.json();
      const expJson = await expRes.json();
      if (empJson.success) {
        setEmployees(empJson.data);
        if (empJson.data.length > 0 && !expData.employeeId) {
          setExpData(prev => ({ ...prev, employeeId: empJson.data[0].id }));
        }
      }
      if (expJson.success) setExpenses(expJson.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Mount üzerinde tek seferlik async veri çekimi — setState çağrısı fetch tamamlandıktan
  // sonra (await sonrası) gerçekleşir, senkron değildir; bu yüzden kural burada
  // yanlış pozitif üretir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, []);

  const handleEmpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmpData(prev => ({ ...prev, [name]: value }));
  };

  const handleExpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExpData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/finans/calisan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(empData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setEmpData({ firstName: "", lastName: "", identityNumber: "", phone: "" });
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setEmpSubmitting(false);
    }
  };

  const handleExpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpSubmitting(true);
    setError("");
    try {
      const payload = {
        ...expData,
        salaryAmount: parseFloat(expData.salaryAmount || "0"),
        sgkAmount: parseFloat(expData.sgkAmount || "0"),
        foodAmount: parseFloat(expData.foodAmount || "0"),
        transportAmount: parseFloat(expData.transportAmount || "0"),
        expenseDate: expData.expenseDate + "T00:00:00.000Z",
      };
      const res = await fetch("/api/v1/finans/calisan-gider", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
      setExpData({
        employeeId: employees.length > 0 ? employees[0].id : "",
        expenseDate: new Date().toISOString().split("T")[0],
        salaryAmount: "", sgkAmount: "", foodAmount: "", transportAmount: "", notes: "",
      });
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (lang === "en" ? "An error occurred" : "Bir hata oluştu"));
    } finally {
      setExpSubmitting(false);
    }
  };

  const openEditExp = (exp: EmployeeExpense) => {
    setEditExp(exp);
    setEditExpForm({
      salaryAmount: String(exp.salaryAmount),
      sgkAmount: String(exp.sgkAmount),
      foodAmount: String(exp.foodAmount),
      transportAmount: String(exp.transportAmount),
      expenseDate: new Date(exp.expenseDate).toISOString().split("T")[0],
      notes: exp.notes ?? "",
    });
  };

  const handleEditExpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExp) return;
    setEditExpSubmitting(true);
    try {
      await fetch(`/api/v1/finans/calisan-gider/${editExp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": lang },
        body: JSON.stringify({
          salaryAmount: parseFloat(editExpForm.salaryAmount || "0"),
          sgkAmount: parseFloat(editExpForm.sgkAmount || "0"),
          foodAmount: parseFloat(editExpForm.foodAmount || "0"),
          transportAmount: parseFloat(editExpForm.transportAmount || "0"),
          expenseDate: editExpForm.expenseDate + "T00:00:00.000Z",
          notes: editExpForm.notes,
        }),
      });
      setEditExp(null);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setEditExpSubmitting(false); }
  };

  const handleDeleteExp = async () => {
    if (!deleteExpId) return;
    setDeletingExp(true);
    try {
      await fetch(`/api/v1/finans/calisan-gider/${deleteExpId}`, { method: "DELETE", headers: { "Accept-Language": lang } });
      setDeleteExpId(null);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setDeletingExp(false); }
  };

  const calculateTotal = () =>
    parseFloat(expData.salaryAmount || "0") +
    parseFloat(expData.sgkAmount || "0") +
    parseFloat(expData.foodAmount || "0") +
    parseFloat(expData.transportAmount || "0");

  const nowM = new Date();
  const thisMonthExpenses = expenses.filter(r => {
    const d = new Date(r.expenseDate);
    return d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear();
  });
  const historyExpenses = expenses.filter(r => {
    const d = r.expenseDate.substring(0, 10);
    if (histStart && d < histStart) return false;
    if (histEnd && d > histEnd) return false;
    return true;
  });

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>
        {tx(t.calisan.title, lang)}
      </h1>

      {error && (
        <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--spacing-8)", alignItems: "start" }}>

        {/* Left: Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>

          {/* Expense form */}
          <div className="card">
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Add Staff Expense" : "Personele Gider Ekle"}
            </h2>
            <form onSubmit={handleExpSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Select Staff" : "Personel Seç"}</label>
                <select className="form-input" name="employeeId" value={expData.employeeId} onChange={handleExpChange} required>
                  <option value="" disabled>{lang === "en" ? "Select..." : "Seçiniz"}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Expense Date / Month" : "Gider Tarihi / Ay"}</label>
                <input type="date" className="form-input" name="expenseDate" value={expData.expenseDate} onChange={handleExpChange} required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
                {[
                  { name: "salaryAmount", label: lang === "en" ? "Salary (₺)" : "Maaş (₺)" },
                  { name: "sgkAmount", label: "SGK (₺)" },
                  { name: "foodAmount", label: lang === "en" ? "Meal (₺)" : "Yemek (₺)" },
                  { name: "transportAmount", label: lang === "en" ? "Transport (₺)" : "Yol (₺)" },
                ].map(field => (
                  <div key={field.name} className="form-group">
                    <label className="form-label">{field.label}</label>
                    <input type="number" step="0.01" className="form-input" name={field.name}
                      value={(expData as Record<string, string>)[field.name]} onChange={handleExpChange} />
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>{lang === "en" ? "Total Cost:" : "Toplam Maliyet:"}</span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-primary)" }}>
                  {calculateTotal().toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" name="notes" value={expData.notes} onChange={handleExpChange} rows={2} />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={expSubmitting || employees.length === 0}>
                {expSubmitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Save Expense" : "Gider Kaydet")}
              </button>
            </form>
          </div>

          {/* Add employee form */}
          <div className="card" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, marginBottom: "var(--spacing-3)" }}>
              {lang === "en" ? "Add New Staff" : "Yeni Personel Ekle"}
            </h3>
            <form onSubmit={handleEmpSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
              <input type="text" className="form-input" name="firstName" placeholder={lang === "en" ? "First Name" : "Ad"} value={empData.firstName} onChange={handleEmpChange} required />
              <input type="text" className="form-input" name="lastName" placeholder={lang === "en" ? "Last Name" : "Soyad"} value={empData.lastName} onChange={handleEmpChange} required />
              <div style={{ gridColumn: "span 2" }}>
                <button type="submit" className="btn" style={{ width: "100%", background: "white", border: "1px solid var(--color-border)" }} disabled={empSubmitting}>
                  {empSubmitting ? (lang === "en" ? "Adding..." : "Ekleniyor...") : (lang === "en" ? "+ Save Staff" : "+ Personeli Kaydet")}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Table */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>
            {lang === "en" ? "This Month" : "Bu Ay"}
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : thisMonthExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
              {lang === "en" ? "No expenses this month." : "Bu ay henüz gider eklenmemiş."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>{lang === "en" ? "Date" : "Tarih"}</th>
                    <th>{lang === "en" ? "Staff" : "Personel"}</th>
                    <th>{lang === "en" ? "Total" : "Toplam"}</th>
                    <th>{lang === "en" ? "Details" : "Detaylar"}</th>
                    <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                  </tr>
                </thead>
                <tbody>
                  {thisMonthExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{format(new Date(exp.expenseDate), "MMM yyyy", { locale })}</td>
                      <td style={{ fontWeight: 500 }}>{exp.employee.firstName} {exp.employee.lastName}</td>
                      <td style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                        {Number(exp.totalAmount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                        {lang === "en" ? "Salary" : "Maaş"}: {exp.salaryAmount} ₺<br />
                        SGK: {exp.sgkAmount} ₺<br />
                        {lang === "en" ? "Meal" : "Yemek"}: {exp.foodAmount} ₺<br />
                        {lang === "en" ? "Transport" : "Yol"}: {exp.transportAmount} ₺
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button onClick={() => openEditExp(exp)}
                            style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                            {lang === "en" ? "Edit" : "Düzenle"}
                          </button>
                          <button onClick={() => setDeleteExpId(exp.id)}
                            style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                            {lang === "en" ? "Delete" : "Sil"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Geçmiş Kayıtlar */}
      <div className="card" style={{ marginTop: "var(--spacing-5)" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--spacing-3)", marginBottom: "var(--spacing-4)" }}>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginRight: "auto" }}>
            {lang === "en" ? "All Records" : "Geçmiş Kayıtlar"}
          </h2>
          <div style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={histStart} onChange={e => setHistStart(e.target.value)}
              className="form-input" style={{ width: "150px", fontSize: "13px" }} />
            <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>—</span>
            <input type="date" value={histEnd} onChange={e => setHistEnd(e.target.value)}
              className="form-input" style={{ width: "150px", fontSize: "13px" }} />
            {(histStart || histEnd) && (
              <button onClick={() => { setHistStart(""); setHistEnd(""); }} className="btn"
                style={{ fontSize: "12px", padding: "4px 10px", border: "1px solid var(--color-border)" }}>
                {lang === "en" ? "Clear" : "Temizle"}
              </button>
            )}
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {historyExpenses.length} {lang === "en" ? "records" : "kayıt"}
            </span>
          </div>
        </div>
        {historyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-muted)" }}>
            {lang === "en" ? "No records found." : "Kayıt bulunamadı."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: "14px" }}>
              <thead>
                <tr>
                  <th>{lang === "en" ? "Date" : "Tarih"}</th>
                  <th>{lang === "en" ? "Staff" : "Personel"}</th>
                  <th>{lang === "en" ? "Total" : "Toplam"}</th>
                  <th>{lang === "en" ? "Details" : "Detaylar"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "en" ? "Actions" : "İşlem"}</th>
                </tr>
              </thead>
              <tbody>
                {historyExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{format(new Date(exp.expenseDate), "MMM yyyy", { locale })}</td>
                    <td style={{ fontWeight: 500 }}>{exp.employee.firstName} {exp.employee.lastName}</td>
                    <td style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                      {Number(exp.totalAmount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                      {lang === "en" ? "Salary" : "Maaş"}: {exp.salaryAmount} ₺<br />
                      SGK: {exp.sgkAmount} ₺<br />
                      {lang === "en" ? "Meal" : "Yemek"}: {exp.foodAmount} ₺<br />
                      {lang === "en" ? "Transport" : "Yol"}: {exp.transportAmount} ₺
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEditExp(exp)}
                          style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                          {lang === "en" ? "Edit" : "Düzenle"}
                        </button>
                        <button onClick={() => setDeleteExpId(exp.id)}
                          style={{ padding: "4px 10px", fontSize: "12px", background: "var(--color-danger)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                          {lang === "en" ? "Delete" : "Sil"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Expense Modal */}
      {editExp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "440px", padding: "var(--spacing-6)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--spacing-4)" }}>
              {lang === "en" ? "Edit Staff Expense" : "Personel Giderini Düzenle"}
            </h3>
            <form onSubmit={(e) => void handleEditExpSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)" }}>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Expense Date" : "Gider Tarihi"}</label>
                <input type="date" className="form-input" value={editExpForm.expenseDate} onChange={e => setEditExpForm(p => ({ ...p, expenseDate: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
                {[
                  { key: "salaryAmount", label: lang === "en" ? "Salary (₺)" : "Maaş (₺)" },
                  { key: "sgkAmount", label: "SGK (₺)" },
                  { key: "foodAmount", label: lang === "en" ? "Meal (₺)" : "Yemek (₺)" },
                  { key: "transportAmount", label: lang === "en" ? "Transport (₺)" : "Yol (₺)" },
                ].map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input type="number" step="0.01" className="form-input"
                      value={(editExpForm as Record<string, string>)[f.key]}
                      onChange={e => setEditExpForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">{lang === "en" ? "Notes" : "Notlar"}</label>
                <textarea className="form-input" rows={2} value={editExpForm.notes} onChange={e => setEditExpForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-3)", marginTop: "4px" }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditExp(null)}>
                  {lang === "en" ? "Cancel" : "İptal"}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editExpSubmitting}>
                  {editExpSubmitting ? (lang === "en" ? "Saving..." : "Kaydediliyor...") : (lang === "en" ? "Save" : "Kaydet")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {deleteExpId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-4)" }}>
          <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "var(--spacing-6)", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: "8px" }}>
              {lang === "en" ? "Delete Expense" : "Gideri Sil"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--spacing-5)", fontSize: "14px" }}>
              {lang === "en" ? "Are you sure you want to delete this expense record?" : "Bu gider kaydını silmek istediğinizden emin misiniz?"}
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-3)" }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setDeleteExpId(null)}>
                {lang === "en" ? "Cancel" : "İptal"}
              </button>
              <button className="btn" style={{ flex: 1, background: "var(--color-danger)", color: "white" }}
                onClick={() => void handleDeleteExp()} disabled={deletingExp}>
                {deletingExp ? (lang === "en" ? "Deleting..." : "Siliniyor...") : (lang === "en" ? "Yes, Delete" : "Evet, Sil")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
