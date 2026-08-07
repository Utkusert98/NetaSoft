"use client";

import { useState, useRef, useCallback } from "react";
import { formatFileSize } from "@/lib/utils";

interface ParsedRow {
  rowIndex: number;
  rawData: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

interface FileUploadWithReviewProps {
  onConfirm: (rows: ParsedRow[], headers: string[]) => Promise<void>;
  acceptedTypes?: string;
  moduleName: string;
  maxFileSizeMB?: number;
  lang?: string;
}

type UploadStep = "idle" | "parsing" | "review" | "importing" | "done";

export default function FileUploadWithReview({
  onConfirm,
  acceptedTypes = ".xlsx,.xls,.csv,.pdf",
  moduleName,
  maxFileSizeMB = 10,
  lang = "tr",
}: FileUploadWithReviewProps) {
  const [step, setStep] = useState<UploadStep>("idle");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [editedRows, setEditedRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState<string>("");
  const [importProgress, setImportProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxFileSizeMB * 1024 * 1024;

  const en = lang === "en";

  const parseFile = useCallback(async (selectedFile: File) => {
    setStep("parsing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("module", moduleName);

      const response = await fetch("/api/v1/dosya/parse", {
        method: "POST",
        headers: { "Accept-Language": lang },
        body: formData,
      });

      const data = await response.json() as {
        success: boolean;
        data?: ParseResult;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? (en ? "File could not be parsed" : "Dosya parse edilemedi"));
      }

      setParseResult(data.data!);
      setEditedRows(data.data!.rows);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Error processing file" : "Dosya işlenirken hata oluştu"));
      setStep("idle");
    }
  }, [moduleName, lang, en]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (selectedFile.size > maxBytes) {
        setError(en
          ? `File size cannot exceed ${maxFileSizeMB} MB`
          : `Dosya boyutu ${maxFileSizeMB} MB'dan büyük olamaz`);
        return;
      }
      setFile(selectedFile);
      void parseFile(selectedFile);
    },
    [maxBytes, maxFileSizeMB, parseFile, en]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileSelect(dropped);
    },
    [handleFileSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  };

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    setEditedRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex
          ? { ...row, rawData: { ...row.rawData, [field]: value } }
          : row
      )
    );
  };

  const handleConfirm = async () => {
    setStep("importing");
    setImportProgress(0);

    const progressInterval = setInterval(() => {
      setImportProgress((p) => Math.min(p + 10, 90));
    }, 200);

    try {
      await onConfirm(editedRows, parseResult?.headers ?? []);
      clearInterval(progressInterval);
      setImportProgress(100);
      setStep("done");
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : (en ? "Import failed" : "İçe aktarma başarısız oldu"));
      setStep("review");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setFile(null);
    setParseResult(null);
    setEditedRows([]);
    setError("");
    setImportProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "8px", color: "var(--color-success)" }}>
          {en ? "Import Complete" : "İçe Aktarma Tamamlandı"}
        </h3>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
          {en
            ? `${editedRows.length} rows successfully saved to database.`
            : `${editedRows.length} satır başarıyla veritabanına kaydedildi.`}
        </p>
        <button id="btn-new-upload" className="btn btn-primary" onClick={handleReset}>
          {en ? "Upload New File" : "Yeni Dosya Yükle"}
        </button>
      </div>
    );
  }

  if (step === "parsing") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div className="spinner" style={{ width: 48, height: 48, margin: "0 auto 16px", borderWidth: 4 }} />
        <p style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>
          {en ? "Processing File:" : "Dosya İşleniyor:"} {file?.name}
        </p>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "8px" }}>
          {en ? "This may take a few seconds..." : "Bu işlem birkaç saniye sürebilir..."}
        </p>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div className="spinner" style={{ width: 48, height: 48, margin: "0 auto 16px", borderWidth: 4 }} />
        <p style={{ fontWeight: 600, marginBottom: "16px" }}>
          {en ? "Saving Data..." : "Veriler Kaydediliyor..."}
        </p>
        <div style={{
          width: "300px", height: "8px",
          background: "var(--color-border)", borderRadius: "var(--radius-full)",
          margin: "0 auto", overflow: "hidden",
        }}>
          <div style={{
            width: `${importProgress}%`, height: "100%",
            background: "var(--color-primary-light)", borderRadius: "var(--radius-full)",
            transition: "width 0.2s ease",
          }} />
        </div>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "8px" }}>
          %{importProgress}
        </p>
      </div>
    );
  }

  if (step === "review" && parseResult) {
    return (
      <div className="import-review" id="import-review-panel">
        <div className="import-review-header">
          <h2 className="import-review-title">
            📋 {en ? "Here's What I Read — Is This Correct?" : "Verileri Bu Şekilde Okudum, Doğru Mu?"}
          </h2>
          <p className="import-review-subtitle">
            {en
              ? "Please review the data below. You can edit incorrect cells. After confirming, data will be saved to the database."
              : "Lütfen aşağıdaki verileri kontrol edin. Hatalı hücreleri düzenleyebilirsiniz. Onayladıktan sonra veriler veritabanına kaydedilecektir."}
          </p>

          <div className="import-stats">
            <div className="import-stat">
              <div className="import-stat-value">{parseResult.totalRows}</div>
              <div className="import-stat-label">{en ? "Total Rows" : "Toplam Satır"}</div>
            </div>
            <div className="import-stat">
              <div className="import-stat-value" style={{ color: "var(--color-primary-light)" }}>
                {parseResult.validRows}
              </div>
              <div className="import-stat-label">{en ? "Valid Rows" : "Geçerli Satır"}</div>
            </div>
            {parseResult.errorRows > 0 && (
              <div className="import-stat">
                <div className="import-stat-value" style={{ color: "#ff6b6b" }}>
                  {parseResult.errorRows}
                </div>
                <div className="import-stat-label">{en ? "Error Rows" : "Hatalı Satır"}</div>
              </div>
            )}
            <div className="import-stat">
              <div className="import-stat-value">{file ? formatFileSize(file.size) : "-"}</div>
              <div className="import-stat-label">{en ? "File Size" : "Dosya Boyutu"}</div>
            </div>
          </div>
        </div>

        <div className="import-table-container">
          <table className="table" aria-label={en ? "Import Preview Table" : "İçe Aktarma Önizleme Tablosu"}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 50 }}>#</th>
                {parseResult.headers.map((h) => (
                  <th key={h} scope="col">{h}</th>
                ))}
                <th scope="col" style={{ width: 80 }}>{en ? "Status" : "Durum"}</th>
              </tr>
            </thead>
            <tbody>
              {editedRows.map((row) => (
                <tr key={row.rowIndex} id={`import-row-${row.rowIndex}`} className={row.isValid ? "" : "import-row-error"}>
                  <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{row.rowIndex + 1}</td>
                  {parseResult.headers.map((header) => (
                    <td key={header}>
                      <input
                        type="text"
                        id={`cell-${row.rowIndex}-${header}`}
                        aria-label={en ? `Row ${row.rowIndex + 1}, ${header}` : `Satır ${row.rowIndex + 1}, ${header}`}
                        value={String(row.rawData[header] ?? "")}
                        onChange={(e) => handleCellEdit(row.rowIndex, header, e.target.value)}
                        style={{
                          width: "100%", minWidth: "80px", border: "1px solid transparent",
                          background: "transparent", padding: "4px 6px", borderRadius: "4px",
                          fontSize: "var(--font-size-sm)", fontFamily: "var(--font-family)",
                          color: "inherit", outline: "none", transition: "border-color 0.15s ease",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--color-primary)"; e.target.style.background = "var(--color-surface)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
                      />
                    </td>
                  ))}
                  <td>
                    <span className={`badge ${row.isValid ? "badge-success" : "badge-danger"}`}>
                      {row.isValid ? (en ? "Valid" : "Geçerli") : (en ? "Error" : "Hatalı")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="import-actions">
          {error && (
            <span style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", marginRight: "auto" }}>
              ⚠️ {error}
            </span>
          )}
          <button id="btn-import-cancel" className="btn btn-secondary" onClick={handleReset}>
            {en ? "Cancel" : "İptal"}
          </button>
          <button
            id="btn-import-confirm"
            className="btn btn-primary"
            onClick={() => void handleConfirm()}
            disabled={parseResult.validRows === 0}
          >
            ✓ {en
              ? `Confirm & Save (${parseResult.validRows} Rows)`
              : `Onayla Ve Kaydet (${parseResult.validRows} Satır)`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div role="alert" style={{
          background: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)",
          borderRadius: "var(--radius-md)", padding: "var(--spacing-4)",
          marginBottom: "var(--spacing-4)", color: "var(--color-danger)",
          fontSize: "var(--font-size-sm)",
        }}>
          ⚠️ {error}
        </div>
      )}

      <div
        id="file-upload-zone"
        className={`file-upload-zone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={en ? "Click or drag to upload a file" : "Dosya yüklemek için tıklayın veya sürükleyin"}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="file-upload-icon">📁</div>
        <h3 className="file-upload-title">
          {en ? "Drag Your File Here" : "Dosyanızı Buraya Sürükleyin"}
        </h3>
        <p className="file-upload-hint">
          {en ? "or click to select a file" : "veya dosya seçmek için tıklayın"}
        </p>
        <p style={{ marginTop: "var(--spacing-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          {en
            ? `Supported formats: Excel (.xlsx, .xls), CSV, PDF · Max. ${maxFileSizeMB} MB`
            : `Desteklenen formatlar: Excel (.xlsx, .xls), CSV, PDF · Maks. ${maxFileSizeMB} MB`}
        </p>

        <input
          ref={inputRef}
          type="file"
          id="file-input"
          accept={acceptedTypes}
          onChange={handleInputChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
