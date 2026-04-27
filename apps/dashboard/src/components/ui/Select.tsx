import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectOptionGroup[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
  leading?: ReactNode;
  // Forces a search input. Otherwise auto-enabled when options.length > 12.
  searchable?: boolean;
};

const flatten = (
  options: SelectOption[] | undefined,
  groups: SelectOptionGroup[] | undefined,
): SelectOption[] => {
  if (groups) return groups.flatMap((g) => g.options);
  return options ?? [];
};

export const Select = ({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  size = "sm",
  disabled = false,
  className = "",
  invalid = false,
  leading,
  searchable,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const flat = flatten(options, groups);
  const selected = flat.find((o) => o.value === value);
  const showSearch = searchable ?? flat.length > 12;

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

  // On open: highlight current value, reset search, focus search if shown.
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const idx = flat.findIndex((o) => o.value === value);
    if (idx >= 0) setHighlight(idx);
    if (showSearch) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, value, flat, showSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (
      !open &&
      (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")
    ) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(filteredFlat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filteredFlat[highlight];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  const heightCls = size === "sm" ? "h-8 text-sm" : "h-10 text-sm";
  const borderCls = invalid
    ? "border-red-300"
    : open
      ? "border-primary-400 ring-2 ring-primary-200"
      : "border-gray-200 hover:border-gray-300";

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={`w-full ${heightCls} pl-3 pr-8 bg-white border ${borderCls} rounded-lg shadow-sm focus:outline-none disabled:opacity-50 disabled:bg-gray-50 text-left transition-colors flex items-center gap-2`}
      >
        {leading && <span className="text-gray-500 shrink-0">{leading}</span>}
        <span
          className={`flex-1 truncate ${selected ? "text-gray-900" : "text-gray-400"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          id={listboxId}
          role="listbox"
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlight(0);
                  }}
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
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredFlat.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">
                No matches
              </div>
            ) : filteredGroups ? (
              filteredGroups.map((group) => (
                <SelectGroup
                  key={group.label}
                  group={group}
                  flat={filteredFlat}
                  value={value}
                  highlight={highlight}
                  setHighlight={setHighlight}
                  onPick={(v) => {
                    onChange(v);
                    setOpen(false);
                  }}
                />
              ))
            ) : (
              filteredFlat.map((opt, idx) => (
                <SelectItem
                  key={opt.value}
                  option={opt}
                  active={value === opt.value}
                  highlighted={highlight === idx}
                  onHover={() => setHighlight(idx)}
                  onPick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SelectGroup = ({
  group,
  flat,
  value,
  highlight,
  setHighlight,
  onPick,
}: {
  group: SelectOptionGroup;
  flat: SelectOption[];
  value: string;
  highlight: number;
  setHighlight: (i: number) => void;
  onPick: (v: string) => void;
}) => (
  <div>
    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {group.label}
    </div>
    {group.options.map((opt) => {
      const idx = flat.indexOf(opt);
      return (
        <SelectItem
          key={opt.value}
          option={opt}
          active={value === opt.value}
          highlighted={highlight === idx}
          onHover={() => setHighlight(idx)}
          onPick={() => onPick(opt.value)}
        />
      );
    })}
  </div>
);

const SelectItem = ({
  option,
  active,
  highlighted,
  onHover,
  onPick,
}: {
  option: SelectOption;
  active: boolean;
  highlighted: boolean;
  onHover: () => void;
  onPick: () => void;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={active}
    onMouseEnter={onHover}
    onClick={onPick}
    disabled={option.disabled}
    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
      highlighted ? "bg-primary-50" : "bg-white"
    } ${active ? "text-primary-800 font-medium" : "text-gray-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    <span className="flex-1 truncate">{option.label}</span>
    {active && <Check size={14} className="text-primary-600 shrink-0" />}
  </button>
);
