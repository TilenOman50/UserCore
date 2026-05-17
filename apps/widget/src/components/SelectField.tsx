import { useEffect, useRef, useState } from "react";

import { t } from "../lib/i18n";

type Option = { value: string; label: string };

// Custom dropdown that matches the rest of the widget chrome — same border,
// focus ring, primary-tinted hover/selected states, chevron animation as
// CountryPicker. Native <select>'s dropdown panel is OS-rendered and can't
// be styled, so we render our own list.
export const SelectField = ({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}) => {
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

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white flex items-center justify-between gap-2 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed ${
          open
            ? "border-primary-400 ring-2 ring-primary-200"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <span
          className={`flex-1 text-left truncate ${
            selected ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {selected?.label ?? t("common.select")}
        </span>
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 transition-transform shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto no-scrollbar py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
                opt.value === value
                  ? "bg-primary-50 text-primary-900"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && (
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
