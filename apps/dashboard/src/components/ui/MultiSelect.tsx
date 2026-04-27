import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SelectOption, SelectOptionGroup } from "./Select";

type MultiSelectProps = {
  values: string[];
  onChange: (next: string[]) => void;
  options?: SelectOption[];
  groups?: SelectOptionGroup[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  // How many pill labels to render in the trigger before falling back to
  // "N selected".
  maxPillsInTrigger?: number;
  leading?: ReactNode;
};

const flatten = (
  options: SelectOption[] | undefined,
  groups: SelectOptionGroup[] | undefined,
): SelectOption[] => {
  if (groups) return groups.flatMap((g) => g.options);
  return options ?? [];
};

export const MultiSelect = ({
  values,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  size = "sm",
  disabled = false,
  className = "",
  searchable,
  maxPillsInTrigger = 3,
  leading,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const flat = flatten(options, groups);
  const valueSet = useMemo(() => new Set(values), [values]);
  const showSearch = searchable ?? flat.length > 12;
  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of flat) m.set(o.value, o.label);
    return m;
  }, [flat]);

  const filteredFlat = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.trim().toLowerCase();
    return flat.filter((o) => o.label.toLowerCase().includes(q));
  }, [flat, search]);

  const filteredGroups = useMemo(() => {
    if (!groups) return undefined;
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => o.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, search]);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (showSearch) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, showSearch]);

  const toggle = (v: string) => {
    if (valueSet.has(v)) {
      onChange(values.filter((x) => x !== v));
    } else {
      onChange([...values, v]);
    }
  };

  const removePill = (v: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((x) => x !== v));
  };

  const heightCls = size === "sm" ? "min-h-8" : "min-h-10";

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={`w-full ${heightCls} pl-2 pr-8 py-1 bg-white border ${
          open
            ? "border-primary-400 ring-2 ring-primary-200"
            : "border-gray-200 hover:border-gray-300"
        } rounded-lg shadow-sm focus:outline-none disabled:opacity-50 disabled:bg-gray-50 text-left transition-colors flex items-center gap-1 flex-wrap`}
      >
        {leading && <span className="text-gray-500 shrink-0">{leading}</span>}
        {values.length === 0 ? (
          <span className="text-gray-400 text-sm pl-1">{placeholder}</span>
        ) : values.length > maxPillsInTrigger ? (
          <span className="text-gray-700 text-sm pl-1">
            {values.length} selected
          </span>
        ) : (
          values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 text-xs font-medium px-2 py-0.5 rounded-full"
            >
              {labelByValue.get(v) ?? v}
              <span
                role="button"
                aria-label={`Remove ${labelByValue.get(v) ?? v}`}
                onClick={(e) => removePill(v, e)}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-primary-700 hover:text-primary-900"
              >
                <X size={11} />
              </span>
            </span>
          ))
        )}
        <ChevronDown
          size={14}
          className={`absolute right-2.5 top-2 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          {showSearch && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setOpen(false);
                      triggerRef.current?.focus();
                    }
                  }}
                  placeholder="Search…"
                  className="w-full h-8 pl-8 pr-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-gray-50 focus:bg-white"
                />
              </div>
            </div>
          )}

          {values.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {values.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                Clear
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            {filteredFlat.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">
                No matches
              </div>
            ) : filteredGroups ? (
              filteredGroups.map((group) => (
                <MultiSelectGroup
                  key={group.label}
                  group={group}
                  valueSet={valueSet}
                  onToggle={toggle}
                />
              ))
            ) : (
              filteredFlat.map((opt) => (
                <MultiSelectItem
                  key={opt.value}
                  option={opt}
                  selected={valueSet.has(opt.value)}
                  onToggle={() => toggle(opt.value)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectGroup = ({
  group,
  valueSet,
  onToggle,
}: {
  group: SelectOptionGroup;
  valueSet: Set<string>;
  onToggle: (v: string) => void;
}) => (
  <div>
    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {group.label}
    </div>
    {group.options.map((opt) => (
      <MultiSelectItem
        key={opt.value}
        option={opt}
        selected={valueSet.has(opt.value)}
        onToggle={() => onToggle(opt.value)}
      />
    ))}
  </div>
);

const MultiSelectItem = ({
  option,
  selected,
  onToggle,
}: {
  option: SelectOption;
  selected: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    onClick={onToggle}
    disabled={option.disabled}
    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors hover:bg-primary-50 ${
      selected ? "text-primary-800 font-medium" : "text-gray-700"
    } disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    <span
      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
        selected
          ? "border-primary-500 bg-primary-500 text-white"
          : "border-gray-300 bg-white"
      }`}
    >
      {selected && <Check size={11} strokeWidth={3} />}
    </span>
    <span className="flex-1 truncate">{option.label}</span>
  </button>
);
