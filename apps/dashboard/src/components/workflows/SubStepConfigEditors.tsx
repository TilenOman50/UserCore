import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import type {
  ContactInfoConfig,
  IdDocumentType,
  IdScanConfig,
  IdScanCountryMode,
  PorDocumentType,
  ProofOfResidenceConfig,
  TermsAcceptanceConfig,
} from "@usercore/shared-types";

import { useUpdateSubStepConfig } from "../../lib/hooks/useWorkflows";

// ---------------------------------------------------------------------------
// Shared shell — keeps every editor visually consistent
// ---------------------------------------------------------------------------

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="text-xs font-semibold text-gray-700 mb-1">{title}</div>
    {description && <p className="text-xs text-gray-500 mb-2">{description}</p>}
    {children}
  </div>
);

// Debounce config writes so a fast-clicker doesn't fire one PATCH per click.
const useDebouncedPatch = (subStepId: string) => {
  const mutation = useUpdateSubStepConfig();
  const patch = (providerConfig: unknown) => {
    mutation.mutate({ subStepId, providerConfig });
  };
  return { patch, isPending: mutation.isPending };
};

// Clickable pill — same visual language as the ID-scan document-type
// selector. Whole button toggles on click.
const PillButton = ({
  label,
  on,
  canEdit,
  onToggle,
}: {
  label: string;
  on: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    disabled={!canEdit}
    onClick={() => canEdit && onToggle()}
    className={`text-xs font-medium py-2 px-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center truncate ${
      on
        ? "bg-primary-100 border-primary-300 text-primary-800"
        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
    }`}
  >
    {label}
  </button>
);

// SVG-backed flag — flag-icons CSS classes give us identical rendering on
// macOS, Linux and Windows. Same primitive used by the widget.
const Flag = ({ code }: { code: string }) => (
  <span
    aria-hidden
    className={`fi fi-${code.toLowerCase()} inline-block w-4 h-3 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)] shrink-0`}
  />
);

// Chip-style country multi-select. Selected entries render as removable
// pills above the search; the dropdown only shows candidates that aren't
// already picked. Tint follows the active mode (primary for allow, red for
// block) so admins see at a glance what they're choosing.
const CountryChipPicker = ({
  countries,
  selectedCodes,
  onAdd,
  onRemove,
  canEdit,
  mode,
  search,
  setSearch,
  filtered,
}: {
  countries: { code: string; name: string }[];
  selectedCodes: Set<string>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  canEdit: boolean;
  mode: "allowed_only" | "blocked";
  search: string;
  setSearch: (v: string) => void;
  filtered: { code: string; name: string }[];
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Build the chip list in the same order the user picked things — easier to
  // scan than alphabetical when only a few are selected.
  const selectedList = countries.filter((c) => selectedCodes.has(c.code));
  // Drop already-selected entries from the dropdown so the user never sees a
  // duplicate-able row.
  const candidates = filtered.filter((c) => !selectedCodes.has(c.code));

  const chipBase =
    mode === "blocked"
      ? "bg-red-50 text-red-800 border border-red-200"
      : "bg-primary-50 text-primary-800 border border-primary-200";

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg bg-white min-h-[44px] focus-within:ring-2 focus-within:ring-primary-200 focus-within:border-primary-400 ${
          open ? "ring-2 ring-primary-200 border-primary-400" : ""
        }`}
        onClick={() => setOpen(true)}
      >
        {selectedList.map((c) => (
          <span
            key={c.code}
            className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${chipBase}`}
          >
            <Flag code={c.code} />
            <span className="truncate max-w-[140px]">{c.name}</span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={(e) => {
                e.stopPropagation();
                if (canEdit) onRemove(c.code);
              }}
              className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Remove ${c.name}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={
            selectedList.length === 0
              ? mode === "blocked"
                ? "Add country to block…"
                : "Add country to allow…"
              : ""
          }
          disabled={!canEdit}
          className="flex-1 min-w-[120px] px-1 py-1 text-xs border-0 focus:outline-none bg-transparent placeholder:text-gray-400 disabled:cursor-not-allowed"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              {search.trim() ? `No matches.` : "All countries already picked."}
            </div>
          ) : (
            candidates.map((c) => (
              <button
                key={c.code}
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  onAdd(c.code);
                  setSearch("");
                }}
                className="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-gray-50 text-gray-700 transition-colors disabled:cursor-not-allowed"
              >
                <Flag code={c.code} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {c.code}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ID scan — country allowlist + document type allowlist
// ---------------------------------------------------------------------------

const ID_DOC_LABELS: Record<IdDocumentType, string> = {
  PASSPORT: "Passport",
  ID_CARD: "National ID",
  DRIVER_LICENSE: "Driver's licence",
};

// Treats legacy `countries: [...]` (no countryMode) as allowed_only so old
// configs keep behaving the same after the schema bump.
const inferCountryMode = (config: IdScanConfig | null): IdScanCountryMode => {
  if (config?.countryMode) return config.countryMode;
  if (config?.countries && config.countries.length > 0) return "allowed_only";
  return "all";
};

const COUNTRY_MODE_LABELS: Record<IdScanCountryMode, string> = {
  all: "Allow all",
  allowed_only: "Allow only…",
  blocked: "Block…",
};

export const IdScanConfigEditor = ({
  subStepId,
  config,
  canEdit,
  countries,
}: {
  subStepId: string;
  config: IdScanConfig | null;
  canEdit: boolean;
  countries: { code: string; name: string }[];
}) => {
  const { patch } = useDebouncedPatch(subStepId);
  const mode = inferCountryMode(config);
  const selectedCountries = new Set(config?.countries ?? []);
  const documentTypes =
    config?.documentTypes ??
    (["PASSPORT", "ID_CARD", "DRIVER_LICENSE"] as IdDocumentType[]);
  const allowedDocs = new Set(documentTypes);

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
    );
  }, [countries, search]);

  const writeConfig = (next: Partial<IdScanConfig>) => {
    patch({
      countryMode: mode,
      countries: Array.from(selectedCountries),
      documentTypes: Array.from(allowedDocs),
      ...next,
    });
  };

  const toggleDoc = (type: IdDocumentType) => {
    const next = new Set(allowedDocs);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    writeConfig({ documentTypes: Array.from(next) });
  };

  const toggleCountry = (code: string) => {
    const next = new Set(selectedCountries);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    writeConfig({ countries: Array.from(next) });
  };

  const setMode = (nextMode: IdScanCountryMode) => {
    // When switching to "all", drop the list. When switching modes between
    // allowed_only / blocked, keep the selection so admins don't lose work.
    writeConfig({
      countryMode: nextMode,
      countries: nextMode === "all" ? null : Array.from(selectedCountries),
    });
  };

  const subtitle =
    mode === "all"
      ? "Customers from any country can verify."
      : mode === "allowed_only"
        ? `Only customers from these countries can verify (${selectedCountries.size} selected).`
        : `Customers from any country EXCEPT these (${selectedCountries.size} blocked).`;

  return (
    <div className="space-y-4">
      <Section
        title="Accepted document types"
        description="Customers can only upload these document types."
      >
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ID_DOC_LABELS) as IdDocumentType[]).map((type) => (
            <PillButton
              key={type}
              label={ID_DOC_LABELS[type]}
              on={allowedDocs.has(type)}
              canEdit={canEdit}
              onToggle={() => toggleDoc(type)}
            />
          ))}
        </div>
        {allowedDocs.size === 0 && (
          <p className="text-xs text-red-600 mt-2">
            At least one document type must be accepted.
          </p>
        )}
      </Section>

      <Section title="Country rule" description={subtitle}>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(Object.keys(COUNTRY_MODE_LABELS) as IdScanCountryMode[]).map(
            (m) => (
              <PillButton
                key={m}
                label={COUNTRY_MODE_LABELS[m]}
                on={mode === m}
                canEdit={canEdit}
                onToggle={() => setMode(m)}
              />
            ),
          )}
        </div>

        {mode !== "all" && (
          <CountryChipPicker
            countries={countries}
            selectedCodes={selectedCountries}
            onAdd={toggleCountry}
            onRemove={toggleCountry}
            canEdit={canEdit}
            mode={mode}
            search={search}
            setSearch={setSearch}
            filtered={filtered}
          />
        )}
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Contact info — toggle which fields the form collects
// ---------------------------------------------------------------------------

const CONTACT_FIELD_LABELS: Record<
  keyof NonNullable<ContactInfoConfig["fields"]>,
  string
> = {
  phone: "Phone",
  email: "Email",
};

const DEFAULT_CONTACT_FIELDS = {
  phone: true,
  email: true,
};

export const ContactInfoConfigEditor = ({
  subStepId,
  config,
  canEdit,
}: {
  subStepId: string;
  config: ContactInfoConfig | null;
  canEdit: boolean;
}) => {
  const { patch } = useDebouncedPatch(subStepId);
  const fields = config?.fields ?? DEFAULT_CONTACT_FIELDS;
  const toggle = (key: keyof typeof fields) => {
    patch({ fields: { ...fields, [key]: !fields[key] } });
  };

  return (
    <Section
      title="Required fields"
      description="Customers will be asked to fill in the fields you keep on."
    >
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(CONTACT_FIELD_LABELS) as Array<keyof typeof fields>).map(
          (key) => (
            <PillButton
              key={key}
              label={CONTACT_FIELD_LABELS[key]}
              on={fields[key]}
              canEdit={canEdit}
              onToggle={() => toggle(key)}
            />
          ),
        )}
      </div>
    </Section>
  );
};

// ---------------------------------------------------------------------------
// Proof of residence — accepted document types
// ---------------------------------------------------------------------------

const POR_DOC_LABELS: Record<PorDocumentType, string> = {
  GAS_BILL: "Gas bill",
  INTERNET_BILL: "Internet bill",
  ELECTRICITY_BILL: "Electricity bill",
  RENT_AGREEMENT: "Rent agreement",
  BANK_STATEMENT: "Bank statement",
};

export const ProofOfResidenceConfigEditor = ({
  subStepId,
  config,
  canEdit,
}: {
  subStepId: string;
  config: ProofOfResidenceConfig | null;
  canEdit: boolean;
}) => {
  const { patch } = useDebouncedPatch(subStepId);
  const types =
    config?.documentTypes ??
    ([
      "GAS_BILL",
      "INTERNET_BILL",
      "ELECTRICITY_BILL",
      "RENT_AGREEMENT",
      "BANK_STATEMENT",
    ] as PorDocumentType[]);
  const allowed = new Set(types);

  const toggle = (type: PorDocumentType) => {
    const next = new Set(allowed);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    patch({ documentTypes: Array.from(next) });
  };

  return (
    <Section
      title="Accepted document types"
      description="The widget will only list these as acceptable."
    >
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(POR_DOC_LABELS) as PorDocumentType[]).map((type) => (
          <PillButton
            key={type}
            label={POR_DOC_LABELS[type]}
            on={allowed.has(type)}
            canEdit={canEdit}
            onToggle={() => toggle(type)}
          />
        ))}
      </div>
      {allowed.size === 0 && (
        <p className="text-xs text-red-600 mt-2">
          At least one document type must be accepted.
        </p>
      )}
    </Section>
  );
};

// ---------------------------------------------------------------------------
// Terms acceptance — custom TOS text
// ---------------------------------------------------------------------------

export const TermsAcceptanceConfigEditor = ({
  subStepId,
  config,
  canEdit,
}: {
  subStepId: string;
  config: TermsAcceptanceConfig | null;
  canEdit: boolean;
}) => {
  const { patch } = useDebouncedPatch(subStepId);
  const [draft, setDraft] = useState(config?.termsText ?? "");

  // Sync external changes (e.g. server-fetched config after page reload).
  useEffect(() => {
    setDraft(config?.termsText ?? "");
  }, [config?.termsText]);

  // Debounce writes — typing shouldn't fire one PATCH per keystroke.
  useEffect(() => {
    const current = config?.termsText ?? "";
    if (draft === current) return;
    const t = setTimeout(() => {
      patch({ termsText: draft.trim().length === 0 ? null : draft });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <Section
      title="Custom terms text"
      description="Leave blank to use the widget's default consent text."
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={!canEdit}
        rows={6}
        placeholder="By proceeding, you agree to…"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
      />
    </Section>
  );
};
