"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function CalisanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [empData, setEmpData] = useState({
    firstName: "",
    lastName: "",
    identityNumber: "",
    phone: "",
  });

  const [expData, setExpData] = useState({
    employeeId: "",
    expenseDate: new Date().toISOString().split("T")[0],
    salaryAmount: "",
    sgkAmount: "",
    foodAmount: "",
    transportAmount: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, expRes] = await Promise.all([
        fetch("/api/v1/finans/calisan"),
        fetch("/api/v1/finans/calisan-gider")
      ]);
      
      const empJson = await empRes.json();
      const expJson = await expRes.json();
      
      if (empJson.success) {
        setEmployees(empJson.data);
        if (empJson.data.length > 0 && !expData.employeeId) {
          setExpData(prev => ({ ...prev, employeeId: empJson.data[0].id }));
        }
      }
      
      if (expJson.success) {
        setExpenses(expJson.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empData),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");

      setEmpData({ firstName: "", lastName: "", identityNumber: "", phone: "" });
      fetchData();
    } catch (err: any) {
      setError(err.message);
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
        expenseDate: expData.expenseDate + "T00:00:00.000Z"
      };

      const res = await fetch("/api/v1/finans/calisan-gider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Bir hata oluştu");

      setExpData({
        employeeId: employees.length > 0 ? employees[0].id : "",
        expenseDate: new Date().toISOString().split("T")[0],
        salaryAmount: "",
        sgkAmount: "",
        foodAmount: "",
        transportAmount: "",
        notes: "",
      });
      
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExpSubmitting(false);
    }
  };

  const calculateTotal = () => {
    return (
      parseFloat(expData.salaryAmount || "0") +
      parseFloat(expData.sgkAmount || "0") +
      parseFloat(expData.foodAmount || "0") +
      parseFloat(expData.transportAmount || "0")
    );
  };

  return (
    <div style={{ padding: "var(--spacing-8)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700, marginBottom: "var(--spacing-6)" }}>Personel Giderleri</h1>

      {error && (
        <div style={{ padding: "12px", background: "var(--color-danger-bg)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "24px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--spacing-8)", alignItems: "start" }}>
        
        {/* Sol Kolon: Formlar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-6)" }}>
          
          {/* Gider Ekle Formu */}
          <div className="card">
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Personele Gider Ekle</h2>
            <form onSubmit={handleExpSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
              
              <div className="form-group">
                <label className="form-label">Personel Seç</label>
                <select className="form-input" name="employeeId" value={expData.employeeId} onChange={handleExpChange} required>
                  <option value="" disabled>Seçiniz</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Gider Tarihi / Ay</label>
                <input type="date" className="form-input" name="expenseDate" value={expData.expenseDate} onChange={handleExpChange} required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
                <div className="form-group">
                  <label className="form-label">Maaş (₺)</label>
                  <input type="number" step="0.01" className="form-input" name="salaryAmount" value={expData.salaryAmount} onChange={handleExpChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">SGK (₺)</label>
                  <input type="number" step="0.01" className="form-input" name="sgkAmount" value={expData.sgkAmount} onChange={handleExpChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Yemek (₺)</label>
                  <input type="number" step="0.01" className="form-input" name="foodAmount" value={expData.foodAmount} onChange={handleExpChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Yol (₺)</label>
                  <input type="number" step="0.01" className="form-input" name="transportAmount" value={expData.transportAmount} onChange={handleExpChange} />
                </div>
              </div>

              <div style={{ padding: "12px", background: "var(--color-bg)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: "14px", fontWeight: 500 }}>Toplam Maliyet:</span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-primary)" }}>{calculateTotal().toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Notlar</label>
                <textarea className="form-input" name="notes" value={expData.notes} onChange={handleExpChange} rows={2} />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={expSubmitting || employees.length === 0}>
                {expSubmitting ? "Kaydediliyor..." : "Gider Kaydet"}
              </button>
            </form>
          </div>

          {/* Yeni Personel Ekle */}
          <div className="card" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, marginBottom: "var(--spacing-3)" }}>Yeni Personel Ekle</h3>
            <form onSubmit={handleEmpSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
              <input type="text" className="form-input" name="firstName" placeholder="Ad" value={empData.firstName} onChange={handleEmpChange} required />
              <input type="text" className="form-input" name="lastName" placeholder="Soyad" value={empData.lastName} onChange={handleEmpChange} required />
              <div style={{ gridColumn: "span 2" }}>
                <button type="submit" className="btn" style={{ width: "100%", background: "white", border: "1px solid var(--color-border)" }} disabled={empSubmitting}>
                  {empSubmitting ? "Ekleniyor..." : "+ Personeli Kaydet"}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Sağ Kolon: Tablo */}
        <div className="card">
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, marginBottom: "var(--spacing-4)" }}>Geçmiş Personel Giderleri</h2>
          
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>
          ) : expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>Henüz Gider Eklenmemiş.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Personel</th>
                    <th>Toplam</th>
                    <th>Detaylar</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{format(new Date(exp.expenseDate), "MMM yyyy", { locale: tr })}</td>
                      <td style={{ fontWeight: 500 }}>{exp.employee.firstName} {exp.employee.lastName}</td>
                      <td style={{ fontWeight: 700, color: "var(--color-primary)" }}>{Number(exp.totalAmount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</td>
                      <td style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                        Maaş: {exp.salaryAmount} ₺<br />
                        SGK: {exp.sgkAmount} ₺<br />
                        Yemek: {exp.foodAmount} ₺<br />
                        Yol: {exp.transportAmount} ₺
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
