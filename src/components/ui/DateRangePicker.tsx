"use client";

/**
 * Modern, özel (custom) tarih aralığı seçici — tarayıcının native `<input
 * type="date">` takvim popup'ının cross-browser olarak restyle EDİLEMEMESİ
 * yüzünden (bkz. AGENTS/görev notu) sıfırdan inşa edildi. Uygulamanın var
 * olan `--color-*` / `--radius-*` / `--spacing-*` tasarım token'larını
 * kullanır, harici bir kütüphane eklemez.
 *
 * Davranış: tıklama alanı seçili aralığı gösteren bir "buton" gibi çalışır;
 * tıklandığında bir popover içinde ay grid'i açılır. Bir gün seçmek `onChange`
 * ile pending değerleri günceller — filtreyi UYGULAMAZ (bu, çağıran sayfanın
 * "Filtrele" butonuna basılana kadar bekleyen davranışıyla tutarlıdır).
 */

import { useState, useRef, useEffect, useId } from "react";
import {
  buildMonthGrid,
  nextRangeSelection,
  isInRange,
  isInHoverPreview,
  TR_DAY_HEADERS,
  EN_DAY_HEADERS,
  TR_MONTH_NAMES,
  EN_MONTH_NAMES,
  type RangeSelection,
} from "@/lib/ui/dateRangePickerLogic";

export interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  lang?: "tr" | "en";
  disabled?: boolean;
}

const fmtDisplay = (dateStr: string, lang: "tr" | "en"): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = lang === "en" ? EN_MONTH_NAMES : TR_MONTH_NAMES;
  return `${d} ${months[(m || 1) - 1]} ${y}`;
};

export default function DateRangePicker({ startDate, endDate, onChange, lang = "tr", disabled }: DateRangePickerProps) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<RangeSelection>({ start: startDate, end: endDate });
  const [hoverDateStr, setHoverDateStr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const initialMonth = startDate ? new Date(startDate).getMonth() : new Date().getMonth();
  const initialYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Dışarıdan gelen değerler değiştiğinde (ör. bir preset butonuna basıldığında)
  // içteki seçim/görünüm senkronize edilir.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection({ start: startDate || null, end: endDate || null });
    if (startDate) {
      const d = new Date(startDate);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const dayHeaders = en ? EN_DAY_HEADERS : TR_DAY_HEADERS;
  const monthNames = en ? EN_MONTH_NAMES : TR_MONTH_NAMES;
  const grid = buildMonthGrid(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else { setViewMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else { setViewMonth(m => m + 1); }
  };

  const handleDayClick = (dateStr: string) => {
    const next = nextRangeSelection(selection, dateStr);
    setSelection(next);
    if (next.start && next.end) {
      onChange(next.start, next.end);
    }
  };

  const displayText = startDate && endDate
    ? `${fmtDisplay(startDate, lang)} – ${fmtDisplay(endDate, lang)}`
    : (en ? "Select date range" : "Tarih aralığı seçin");

  return (
    <div ref={containerRef} className="drp-root">
      <button
        type="button"
        className="drp-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="drp-trigger-icon" aria-hidden="true">📅</span>
        <span className="drp-trigger-text">{displayText}</span>
        <span className="drp-trigger-chevron" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div id={popoverId} role="dialog" aria-label={en ? "Select date range" : "Tarih aralığı seç"} className="drp-popover">
          <div className="drp-header">
            <button type="button" className="drp-nav-btn" onClick={goPrevMonth} aria-label={en ? "Previous month" : "Önceki ay"}>‹</button>
            <span className="drp-header-label">{monthNames[viewMonth]} {viewYear}</span>
            <button type="button" className="drp-nav-btn" onClick={goNextMonth} aria-label={en ? "Next month" : "Sonraki ay"}>›</button>
          </div>

          <div className="drp-weekdays">
            {dayHeaders.map(h => <span key={h} className="drp-weekday">{h}</span>)}
          </div>

          <div className="drp-grid">
            {grid.map(cell => {
              const inRange = isInRange(cell.dateStr, selection.start, selection.end);
              const inHoverPreview = isInHoverPreview(cell.dateStr, selection.start, selection.end, hoverDateStr);
              const isEdge = cell.dateStr === selection.start || cell.dateStr === selection.end;
              const classes = [
                "drp-day",
                !cell.inMonth ? "drp-day-outside" : "",
                cell.isToday ? "drp-day-today" : "",
                inRange || inHoverPreview ? "drp-day-in-range" : "",
                isEdge ? "drp-day-edge" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  className={classes}
                  onClick={() => handleDayClick(cell.dateStr)}
                  onMouseEnter={() => setHoverDateStr(cell.dateStr)}
                  onMouseLeave={() => setHoverDateStr(null)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="drp-footer">
            <span className="drp-footer-text">
              {selection.start
                ? `${fmtDisplay(selection.start, lang)}${selection.end ? ` – ${fmtDisplay(selection.end, lang)}` : ` – ${en ? "select end date" : "bitiş tarihi seçin"}`}`
                : (en ? "Select a start date" : "Başlangıç tarihi seçin")}
            </span>
            <button type="button" className="drp-close-btn" onClick={() => setOpen(false)}>
              {en ? "Done" : "Tamam"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
