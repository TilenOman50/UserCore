import { useEffect, useMemo, useRef, useState } from "react";

import { COUNTRIES } from "../lib/countries";
import { DIAL_CODES } from "../lib/dialCodes";
import { t } from "../lib/i18n";

type Props = {
  // The full E.164-style number we hand back to callers, e.g. "+386 51 123 456".
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

const Flag = ({ code }: { code: string }) => (
  <span
    aria-hidden
    className={`fi fi-${code.toLowerCase()} inline-block w-5 h-[15px] rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)] shrink-0`}
  />
);

// Best-effort split of a pre-saved E.164-ish string into ISO country code
// and the rest of the digits. Longest matching dial code wins so e.g. "+1"
// doesn't shadow "+1268". Empty string means "nothing picked yet".
const splitPhone = (raw: string): { country: string; number: string } => {
  if (!raw) return { country: "", number: "" };
  const match = Object.entries(DIAL_CODES)
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, code]) => raw.startsWith(code));
  if (!match) return { country: "", number: raw };
  return { country: match[0], number: raw.slice(match[1].length).trim() };
};

// Phone input with an inline country-code picker on the left and a number
// field on the right. The picker drops down a searchable list of every ISO
// country with flag + name + dial code.
export const PhoneInput = ({ value, onChange, required }: Props) => {
  const initial = splitPhone(value);
  const [country, setCountry] = useState(initial.country);
  const [number, setNumber] = useState(initial.number);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dialCode = country ? (DIAL_CODES[country] ?? "") : "";

  // Compose and push up on any change. Both a country and a number must be
  // set before we emit a usable value — otherwise the saved attribute
  // wouldn't be a valid international number.
  useEffect(() => {
    if (!country || number.trim().length === 0) {
      onChange("");
      return;
    }
    onChange(`${dialCode} ${number.trim()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, number]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = COUNTRIES.map((c) => ({
      ...c,
      dial: DIAL_CODES[c.code] ?? "",
    })).filter((c) => c.dial);
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().startsWith(q) ||
        c.dial.includes(q),
    );
  }, [search]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-stretch border rounded-lg bg-white transition-colors ${
          open
            ? "border-primary-400 ring-2 ring-primary-200"
            : "border-gray-200 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border-r border-gray-200 hover:bg-gray-50 rounded-l-lg"
        >
          {country ? (
            <>
              <Flag code={country} />
              <span className="font-mono text-gray-700">{dialCode}</span>
            </>
          ) : (
            <span className="text-gray-400">{t("common.code")}</span>
          )}
          <svg
            width="12"
            height="12"
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
        <input
          type="tel"
          inputMode="tel"
          required={required}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="555 123 4567"
          className="flex-1 px-3 py-2.5 text-sm border-0 focus:outline-none placeholder:text-gray-300 rounded-r-lg"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.phoneSearch")}
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
                    setCountry(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
                    c.code === country
                      ? "bg-primary-50 text-primary-900"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Flag code={c.code} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {c.dial}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
