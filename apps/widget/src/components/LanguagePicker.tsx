import { useEffect, useRef, useState } from "react";

import {
  LOCALE_LABELS,
  setLocale,
  SUPPORTED_LOCALES,
  useLocale,
} from "../lib/i18n";

// Compact globe-icon button in the widget header that drops a list of every
// supported locale (rendered in its own native name so a Slovenian speaker
// recognises "Slovenščina" without already being on SL). Selecting one fires
// setLocale, which notifies useLocale subscribers and the whole shell
// re-renders in the new language.
export const LanguagePicker = () => {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={LOCALE_LABELS[locale]}
        className="flex items-center gap-1 text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-50"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span className="text-xs font-medium uppercase">{locale}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 min-w-[160px]">
          {SUPPORTED_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLocale(code);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between gap-2 transition-colors ${
                code === locale
                  ? "bg-primary-50 text-primary-900"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span>{LOCALE_LABELS[code]}</span>
              {code === locale && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary-700 shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
