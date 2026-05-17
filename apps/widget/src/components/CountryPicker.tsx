import { useEffect, useMemo, useRef, useState } from "react";

import { COUNTRIES } from "../lib/countries";
import { t } from "../lib/i18n";

type Props = {
  value: string;
  onChange: (code: string) => void;
  // Optional allowlist — when provided, only these countries appear. Used by
  // the ID-scan step to honour the admin's per-substep country restriction.
  countries?: { code: string; name: string }[];
};

// The flag-icons package ships ~250 SVGs and exposes them as background
// images via the `fi fi-<lowercase-code>` class. Rendering as a styled span
// gives us identical flags across macOS, Linux, and Windows — emoji-based
// flags break on Windows because its system fonts don't include them.
const Flag = ({ code }: { code: string }) => (
  <span
    aria-hidden
    className={`fi fi-${code.toLowerCase()} inline-block w-5 h-[15px] rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)] shrink-0`}
  />
);

// Searchable country picker with flag + name. Custom because <select> can't
// render emoji consistently inside <option> across browsers and gives us no
// search affordance beyond first-letter type-ahead.
export const CountryPicker = ({
  value,
  onChange,
  countries = COUNTRIES,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = countries.find((c) => c.code === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
    );
  }, [countries, search]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white flex items-center gap-2 transition-colors ${
          open
            ? "border-primary-400 ring-2 ring-primary-200"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {selected ? (
          <>
            <Flag code={selected.code} />
            <span className="flex-1 text-left truncate text-gray-900">
              {selected.name}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {selected.code}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-gray-400">
            {t("common.selectCountry")}
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full px-2 py-1.5 text-sm border-0 focus:outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto no-scrollbar flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {t("common.noMatches")}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
                    c.code === value
                      ? "bg-primary-50 text-primary-900"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Flag code={c.code} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 font-mono">
                    {c.code}
                  </span>
                  {c.code === value && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary-700"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
