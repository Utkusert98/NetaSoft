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
}

type UploadStep = "idle" | "parsing" | "review" | "importing" | "done";

export default function FileUploadWithReview({
  onConfirm,
  acceptedTypes = ".xlsx,.xls,.csv,.pdf",
  moduleName,
  maxFileSizeMB = 10,
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

  const parseFile = useCallback(async (selectedFile: File) => {
    setStep("parsing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("module", moduleName);

      const response = await fetch("/api/v1/dosya/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json() as {
        success: boolean;
        data?: ParseResult;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Dosya parse edilemedi");
      }

      setParseResult(data.data!);
      setEditedRows(data.data!.rows);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya işlenirken hata oluştu");
      setStep("idle");
    }
  }, [moduleName]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (selectedFile.size > maxBytes) {
        setError(`Dosya boyutu ${maxFileSizeMB} MB'dan büyük olamaz`);
        return;
      }
      setFile(selectedFile);
      void parseFile(selectedFile);
    },
    [maxBytes, maxFileSizeMB, parseFile]
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

  const handleCellEdit = (
    rowIndex: number,
    field: string,
    value: string
  ) => {
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
      setError(err instanceof Error ? err.message : "İçe aktarma başarısız oldu");
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

  // TAMAMLANDI
  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <h3 style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, marginBottom: "8px", color: "var(--color-success)" }}>
          İçe Aktarma Tamamlandı
        </h3>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "24px" }}>
          {editedRows.length} satır başarıyla veritabanına kaydedildi.
        </p>
        <button id="btn-new-upload" className="btn btn-primary" onClick={handleReset}>
          Yeni Dosya Yükle
        </button>
      </div>
    );
  }

  // PARSE EDİLİYOR
  if (step === "parsing") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div className="spinner" style={{ width: 48, height: 48, margin: "0 auto 16px", borderWidth: 4 }} />
        <p style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>
          Dosya İşleniyor: {file?.name}
        </p>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "8px" }}>
          Bu işlem birkaç saniye sürebilir...
        </p>
      </div>
    );
  }

  // IMPORT EDİLİYOR
  if (step === "importing") {
    return (
      <div style={{ textAlign: "center", padding: "var(--spacing-12)" }}>
        <div className="spinner" style={{ width: 48, height: 48, margin: "0 auto 16px", borderWidth: 4 }} />
        <p style={{ fontWeight: 600, marginBottom: "16px" }}>Veriler Kaydediliyor...</p>
        <div style={{
          width: "300px",
          height: "8px",
          background: "var(--color-border)",
          borderRadius: "var(--radius-full)",
          margin: "0 auto",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${importProgress}%`,
            height: "100%",
            background: "var(--color-primary-light)",
            borderRadius: "var(--radius-full)",
            transition: "width 0.2s ease",
          }} />
        </div>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "8px" }}>
          %{importProgress}
        </p>
      </div>
    );
  }

  // İNCELEME EKRANI
  if (step === "review" && parseResult) {
    return (
      <div className="import-review" id="import-review-panel">
        {/* Başlık */}
        <div className="import-review-header">
          <h2 className="import-review-title">
            📋 Verileri Bu Şekilde Okudum, Doğru Mu?
          </h2>
          <p className="import-review-subtitle">
            Lütfen aşağıdaki verileri kontrol edin. Hatalı hücreleri düzenleyebilirsiniz.
            Onayladıktan sonra veriler veritabanına kaydedilecektir.
          </p>

          <div className="import-stats">
            <div className="import-stat">
              <div className="import-stat-value">{parseResult.totalRows}</div>
              <div className="import-stat-label">Toplam Satır</div>
            </div>
            <div className="import-stat">
              <div className="import-stat-value" style={{ color: "var(--color-primary-light)" }}>
                {parseResult.validRows}
              </div>
              <div className="import-stat-label">Geçerli Satır</div>
            </div>
            {parseResult.errorRows > 0 && (
              <div className="import-stat">
                <div className="import-stat-value" style={{ color: "#ff6b6b" }}>
                  {parseResult.errorRows}
                </div>
                <div className="import-stat-label">Hatalı Satır</div>
              </div>
            )}
            <div className="import-stat">
              <div className="import-stat-value">{file ? formatFileSize(file.size) : "-"}</div>
              <div className="import-stat-label">Dosya Boyutu</div>
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="import-table-container">
          <table className="table" aria-label="İçe Aktarma Önizleme Tablosu">
            <thead>
              <tr>
                <th scope="col" style={{ width: 50 }}>#</th>
                {parseResult.headers.map((h) => (
                  <th key={h} scope="col">{h}</th>
                ))}
                <th scope="col" style={{ width: 80 }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {editedRows.map((row) => (
                <tr
                  key={row.rowIndex}
                  id={`import-row-${row.rowIndex}`}
                  className={row.isValid ? "" : "import-row-error"}
                >
                  <td style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                    {row.rowIndex + 1}
                  </td>
                  {parseResult.headers.map((header) => (
                    <td key={header}>
                      <input
                        type="text"
                        id={`cell-${row.rowIndex}-${header}`}
                        aria-label={`Satır ${row.rowIndex + 1}, ${header}`}
                        value={String(row.rawData[header] ?? "")}
                        onChange={(e) =>
                          handleCellEdit(row.rowIndex, header, e.target.value)
                        }
                        style={{
                          width: "100%",
                          minWidth: "80px",
                          border: "1px solid transparent",
                          background: "transparent",
                          padding: "4px 6px",
                          borderRadius: "4px",
                          fontSize: "var(--font-size-sm)",
                          fontFamily: "var(--font-family)",
                          color: "inherit",
                          outline: "none",
                          transition: "border-color 0.15s ease",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "var(--color-primary)";
                          e.target.style.background = "var(--color-surface)";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.background = "transparent";
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    <span className={`badge ${row.isValid ? "badge-success" : "badge-danger"}`}>
                      {row.isValid ? "Geçerli" : "Hatalı"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Eylemler */}
        <div className="import-actions">
          {error && (
            <span style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", marginRight: "auto" }}>
              ⚠️ {error}
            </span>
          )}
          <button
            id="btn-import-cancel"
            className="btn btn-secondary"
            onClick={handleReset}
          >
            İptal
          </button>
          <button
            id="btn-import-confirm"
            className="btn btn-primary"
            onClick={() => void handleConfirm()}
            disabled={parseResult.validRows === 0}
          >
            ✓ Onayla Ve Kaydet ({parseResult.validRows} Satır)
          </button>
        </div>
      </div>
    );
  }

  // BAŞLANGIÇ — Dosya Yükleme
  return (
    <div>
      {error && (
        <div
          role="alert"
          style={{
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--spacing-4)",
            marginBottom: "var(--spacing-4)",
            color: "var(--color-danger)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div
        id="file-upload-zone"
        className={`file-upload-zone ${dragging ? "dragging" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Dosya yüklemek için tıklayın veya sürükleyin"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="file-upload-icon">📁</div>
        <h3 className="file-upload-title">Dosyanızı Buraya Sürükleyin</h3>
        <p className="file-upload-hint">
          veya dosya seçmek için tıklayın
        </p>
        <p style={{ marginTop: "var(--spacing-3)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          Desteklenen formatlar: Excel (.xlsx, .xls), CSV, PDF · Maks. {maxFileSizeMB} MB
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
