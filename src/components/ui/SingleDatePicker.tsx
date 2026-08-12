"use client";

/**
 * `DateRangePicker` ile aynı görsel dil ve `.drp-*` sınıflarını paylaşan,
 * TEK bir tarih seçmek için kullanılan takvim bileşeni — tarayıcının native
 * `<input type="date">` alanının cross-browser olarak restyle EDİLEMEMESİ
 * yüzünden onun yerine kullanılır (bkz. AGENTS/görev notu).
 */

import { useState, useRef, useEffect, useId, type CSSProperties } from "react";
import {
  buildMonthGrid,
  isSameDate,
  TR_DAY_HEADERS,
  EN_DAY_HEADERS,
  TR_MONTH_NAMES,
  EN_MONTH_NAMES,
} from "@/lib/ui/dateRangePickerLogic";

export interface SingleDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  lang?: "tr" | "en";
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

const fmtDisplay = (dateStr: string, lang: "tr" | "en"): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = lang === "en" ? EN_MONTH_NAMES : TR_MONTH_NAMES;
  return `${d} ${months[(m || 1) - 1]} ${y}`;
};

export default function SingleDatePicker({ value, onChange, lang = "tr", disabled, placeholder, required }: SingleDatePickerProps) {
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  // Popover, `.card` gibi `overflow: hidden` içeren atalar tarafından
  // KESİLMESİN diye `position: fixed` ile tetikleyici butona göre hesaplanan
  // viewport koordinatlarında konumlandırılır (bkz. DateRangePicker).
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPopoverPos({ top: rect.bottom + 6, left: rect.left });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const initialMonth = value ? new Date(value).getMonth() : new Date().getMonth();
  const initialYear = value ? new Date(value).getFullYear() : new Date().getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Dışarıdan gelen değer değiştiğinde (ör. bir preset butonuna basıldığında)
  // görünüm senkronize edilir.
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewYear(d.getFullYear());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMonth(d.getMonth());
    }
  }, [value]);

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
    onChange(dateStr);
    setOpen(false);
  };

  const displayText = value ? fmtDisplay(value, lang) : (placeholder ?? (en ? "Select date" : "Tarih seçin"));

  return (
    <div ref={containerRef} className="drp-root">
      <button
        ref={triggerRef}
        type="button"
        className="drp-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-required={required}
        onClick={() => setOpen(v => !v)}
      >
        <span className="drp-trigger-icon" aria-hidden="true">📅</span>
        <span className="drp-trigger-text">{displayText}</span>
        <span className="drp-trigger-chevron" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={en ? "Select date" : "Tarih seç"}
          className="drp-popover"
          style={popoverPos ? ({ "--drp-top": `${popoverPos.top}px`, "--drp-left": `${popoverPos.left}px` } as CSSProperties) : undefined}
        >
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
              const selected = isSameDate(cell.dateStr, value || null);
              const classes = [
                "drp-day",
                !cell.inMonth ? "drp-day-outside" : "",
                cell.isToday ? "drp-day-today" : "",
                selected ? "drp-day-in-range drp-day-edge" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  className={classes}
                  onClick={() => handleDayClick(cell.dateStr)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="drp-footer">
            <span className="drp-footer-text">
              {value ? fmtDisplay(value, lang) : (en ? "Select a date" : "Bir tarih seçin")}
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
