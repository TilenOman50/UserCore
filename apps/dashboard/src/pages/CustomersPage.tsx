import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
  type Table as TableInstance,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { type CustomerRiskLevel, type KycStatus } from "@usercore/shared-types";

import { AreaChart, DonutChart } from "../components/charts/CustomerCharts";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  RISK_LABELS,
  RiskSelectBadge,
  STATUS_LABELS,
  StatusSelectBadge,
} from "../components/CustomerClassification";
import { COUNTRIES, countryName } from "../lib/countries";
import { formatDateTime } from "../lib/dates";
import {
  useArchiveCustomer,
  useCustomers,
  useCustomerStats,
  type Customer,
  type CustomerFilters,
  type CustomerSortField,
  type StatsRange,
} from "../lib/hooks/useCustomers";
import { usePreferences } from "../lib/hooks/usePreferences";
import { useWorkspace } from "../lib/workspaceContext";

const PAGE_SIZE = 20;

const STATUS_CHART_COLOR: Record<KycStatus, string> = {
  not_started: "#9ca3af",
  pending: "#eab308",
  approved: "#3d9270",
  rejected: "#ef4444",
  flagged: "#f97316",
};
const RISK_CHART_COLOR: Record<CustomerRiskLevel, string> = {
  low: "#3d9270",
  medium: "#eab308",
  high: "#ef4444",
};

// Status switch (segmented) — "All" default, then the statuses a customer
// profile can reach (approved/rejected today, flagged via the automated path).
const STATUS_FILTERS: Array<{
  value: string;
  label: string;
  icon: React.ReactNode;
  activeCls: string;
}> = [
  {
    value: "",
    label: "All",
    icon: null,
    activeCls: "bg-gray-100 text-gray-800",
  },
  {
    value: "approved",
    label: "Approved",
    icon: <Check size={13} />,
    activeCls: "bg-primary-100 text-primary-700",
  },
  {
    value: "rejected",
    label: "Rejected",
    icon: <X size={13} />,
    activeCls: "bg-red-100 text-red-700",
  },
  {
    value: "flagged",
    label: "Flagged",
    icon: <Flag size={13} />,
    activeCls: "bg-orange-100 text-orange-700",
  },
];
// Time-frame for the KPI cards + charts (filters by registration date).
const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "24h", label: "24h" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// Column id → friendly label (used by sortable headers + the Columns menu).
const COLUMN_LABELS: Record<string, string> = {
  firstName: "Customer",
  country: "Country",
  riskLevel: "Risk",
  kycStatus: "Status",
  createdAt: "Registered",
};

const fmtDate = formatDateTime;

const CountryCell = ({ code }: { code: string | null }) => {
  if (!code) return <span className="text-gray-300">—</span>;
  const cc = code.trim().toUpperCase();
  const c = COUNTRIES.find((x) => x.code === cc);
  if (!c) return <span className="text-xs text-gray-500">{code}</span>;
  return (
    <span
      title={c.name}
      aria-label={c.name}
      className={`fi fi-${cc.toLowerCase()} inline-block h-4 w-6 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
    />
  );
};

// Top countries as a flag + bar list (echarts can't render the flag-icons CSS
// sprites, so this uses the same flags as the table).
const TopCountriesList = ({
  data,
}: {
  data: { code: string; value: number }[];
}) => {
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">
        No data
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-[180px] flex-col justify-center gap-4">
      {data.map((d) => {
        const cc = d.code.trim().toUpperCase();
        const known = COUNTRIES.find((x) => x.code === cc);
        const name = known?.name ?? countryName(cc);
        return (
          <div key={d.code} className="group relative flex items-center gap-2">
            {known ? (
              <span
                className={`fi fi-${cc.toLowerCase()} inline-block h-4 w-6 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
              />
            ) : (
              <span className="w-6 shrink-0 text-center text-xs text-gray-500">
                {cc}
              </span>
            )}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-colors group-hover:bg-primary-600"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-gray-600">
              {d.value}
            </span>
            {/* echarts-style tooltip on hover */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {name}: {d.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SortHeader = ({
  column,
  label,
}: {
  column: Column<Customer, unknown>;
  label: string;
}) => {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="inline-flex h-4 items-center gap-1 align-middle uppercase leading-none hover:text-gray-700"
    >
      {label}
      {sorted === "asc" && <ArrowUp size={12} />}
      {sorted === "desc" && <ArrowDown size={12} />}
    </button>
  );
};

const CHECKBOX_CLS =
  "h-4 w-4 cursor-pointer rounded border-gray-300 align-middle accent-primary-500 transition-opacity";

const columns: ColumnDef<Customer>[] = [
  {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => {
      const anySelected = table.getSelectedRowModel().rows.length > 0;
      return (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all"
          className={`${CHECKBOX_CLS} ${
            anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      );
    },
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
        aria-label="Select row"
        className={`${CHECKBOX_CLS} ${
          row.getIsSelected()
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        }`}
      />
    ),
  },
  {
    accessorKey: "firstName",
    enableHiding: false,
    header: ({ column }) => <SortHeader column={column} label="Customer" />,
    cell: ({ row }) => {
      const cust = row.original;
      const name = [cust.firstName, cust.lastName].filter(Boolean).join(" ");
      return (
        <div>
          <div className="font-medium text-gray-900">
            {name || cust.customerId}
          </div>
          {name && (
            <div className="font-mono text-xs text-gray-400">
              {cust.customerId}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "country",
    header: ({ column }) => <SortHeader column={column} label="Country" />,
    cell: ({ row }) => <CountryCell code={row.original.country} />,
  },
  {
    accessorKey: "riskLevel",
    header: ({ column }) => <SortHeader column={column} label="Risk" />,
    cell: ({ row }) => (
      <RiskSelectBadge
        customerId={row.original.customerId}
        riskLevel={row.original.riskLevel}
      />
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortHeader column={column} label="Registered" />,
    cell: ({ row }) => (
      <span className="text-gray-500">{fmtDate(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "kycStatus",
    header: ({ column }) => <SortHeader column={column} label="Status" />,
    cell: ({ row }) => (
      <StatusSelectBadge
        customerId={row.original.customerId}
        status={row.original.kycStatus}
      />
    ),
  },
];

const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
      {label}
    </div>
    <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
  </div>
);

const ChartCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <div className="mb-2 text-sm font-semibold text-gray-900">{title}</div>
    {children}
  </div>
);

const ColumnsMenu = ({ table }: { table: TableInstance<Customer> }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const hideable = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <SlidersHorizontal size={14} /> Columns
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Toggle columns
          </p>
          {hideable.map((col) => {
            const visible = col.getIsVisible();
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => col.toggleVisibility(!visible)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  visible
                    ? "font-medium text-gray-800"
                    : "text-gray-400 hover:text-gray-600"
                } hover:bg-gray-50`}
              >
                {COLUMN_LABELS[col.id] ?? col.id}
                {visible && <Check size={14} className="text-primary-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Optional filters the member adds on demand (the platform-style "+ Filter"),
// instead of a permanent row of dropdowns.
const ADD_FILTERS = [
  { key: "risk", label: "Risk level" },
  { key: "country", label: "Country" },
  { key: "date", label: "Registered date" },
  { key: "archived", label: "Archived" },
] as const;
type FilterKey = (typeof ADD_FILTERS)[number]["key"];

const PopoverHeader = ({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) => (
  <div className="mb-1 flex items-center gap-1 border-b border-gray-100 px-1 pb-1">
    <button
      type="button"
      onClick={onBack}
      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    >
      <ArrowLeft size={14} />
    </button>
    <span className="text-xs font-semibold text-gray-700">{title}</span>
  </div>
);

// "+ Filter" with a two-level popover: pick a field, then a value page inside
// the same window (the platform-style), which applies the filter on selection.
const FilterPopover = ({
  available,
  countryOptions,
  onApplyRisk,
  onApplyCountry,
  onApplyDate,
  onAddArchived,
}: {
  available: ReadonlyArray<{ key: FilterKey; label: string }>;
  countryOptions: { value: string; label: string }[];
  onApplyRisk: (value: string) => void;
  onApplyCountry: (value: string) => void;
  onApplyDate: (from: string, to: string) => void;
  onAddArchived: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "risk" | "country" | "date">(
    "list",
  );
  const [countrySearch, setCountrySearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setView("list");
    setCountrySearch("");
    setFrom("");
    setTo("");
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (available.length === 0) return null;

  const countries = countryOptions.filter(
    (c) =>
      c.value && c.label.toLowerCase().includes(countrySearch.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setView("list");
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <Plus size={14} /> Filter
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-60 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {view === "list" && (
            <div>
              {available.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    if (f.key === "archived") {
                      onAddArchived();
                      close();
                    } else {
                      setView(f.key);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {f.label}
                  {f.key !== "archived" && (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {view === "risk" && (
            <div>
              <PopoverHeader
                title="Risk level"
                onBack={() => setView("list")}
              />
              {(["low", "medium", "high"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    onApplyRisk(v);
                    close();
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  {RISK_LABELS[v]}
                </button>
              ))}
            </div>
          )}

          {view === "country" && (
            <div>
              <PopoverHeader title="Country" onBack={() => setView("list")} />
              <input
                type="search"
                autoFocus
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country…"
                className="mb-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <div className="max-h-52 overflow-auto">
                {countries.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-gray-400">
                    No matches
                  </div>
                ) : (
                  countries.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        onApplyCountry(c.value);
                        close();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {c.value.length === 2 && (
                        <span
                          className={`fi fi-${c.value.toLowerCase()} inline-block h-3 w-4 rounded-sm`}
                        />
                      )}
                      {c.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {view === "date" && (
            <div>
              <PopoverHeader
                title="Registered date"
                onBack={() => setView("list")}
              />
              <div className="space-y-2 p-1">
                <label className="block text-xs text-gray-500">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-500">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={!from && !to}
                  onClick={() => {
                    onApplyDate(from, to);
                    close();
                  }}
                  className="w-full rounded-md bg-primary-200 px-2 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-300 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// A removable active-filter pill showing the chosen value.
const FilterPill = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700">
    <span>{label}</span>
    <button
      type="button"
      onClick={onRemove}
      title="Remove filter"
      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    >
      <X size={13} />
    </button>
  </div>
);

type SavedCustomers = {
  columnVisibility?: VisibilityState;
  sortBy?: CustomerSortField;
  sortDir?: "asc" | "desc";
  // Faceted filter bar + stats time-frame, persisted per member.
  status?: string;
  statsRange?: StatsRange;
  riskLevel?: string;
  country?: string;
  fromDate?: string;
  toDate?: string;
  archived?: boolean;
  activeFilters?: FilterKey[];
  search?: string;
};

export const CustomersPage = () => {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const navigate = useNavigate();
  const { preferences, setPreference, loaded: prefsLoaded } = usePreferences();
  const saved = (preferences.customers ?? {}) as SavedCustomers;

  // Filters (persisted per member — see hydrate/persist effects below). Page is
  // intentionally NOT persisted — always start at page 1.
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(saved.search ?? "");
  const [search, setSearch] = useState(saved.search ?? "");
  const [status, setStatus] = useState(saved.status ?? "");
  const [riskLevel, setRiskLevel] = useState(saved.riskLevel ?? "");
  const [country, setCountry] = useState(saved.country ?? "");
  const [fromDate, setFromDate] = useState(saved.fromDate ?? "");
  const [toDate, setToDate] = useState(saved.toDate ?? "");
  const [archived, setArchived] = useState(saved.archived ?? false);
  // Which optional filters are currently shown (added via "+ Filter").
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>(
    saved.activeFilters ?? [],
  );

  const markActive = (key: FilterKey) =>
    setActiveFilters((prev) => (prev.includes(key) ? prev : [...prev, key]));
  const applyRisk = (v: string) => {
    setRiskLevel(v);
    markActive("risk");
    setPage(1);
  };
  const applyCountry = (v: string) => {
    setCountry(v);
    markActive("country");
    setPage(1);
  };
  const applyDate = (f: string, t: string) => {
    setFromDate(f);
    setToDate(t);
    markActive("date");
    setPage(1);
  };
  const addArchived = () => {
    setArchived(true);
    markActive("archived");
    setPage(1);
  };
  const removeFilter = (key: FilterKey) => {
    setActiveFilters((prev) => prev.filter((k) => k !== key));
    if (key === "risk") setRiskLevel("");
    if (key === "country") setCountry("");
    if (key === "date") {
      setFromDate("");
      setToDate("");
    }
    if (key === "archived") setArchived(false);
    setPage(1);
  };

  // Table view (persisted per member): column visibility + sort
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => saved.columnVisibility ?? {},
  );
  const [sorting, setSorting] = useState<SortingState>(() => [
    {
      id: saved.sortBy ?? "createdAt",
      desc: (saved.sortDir ?? "desc") === "desc",
    },
  ]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [statsRange, setStatsRange] = useState<StatsRange>(
    saved.statsRange ?? "all",
  );

  // Hydrate the persisted view once the server prefs resolve (covers a fresh
  // device / cleared cache); after that, the member's edits drive persistence.
  const touchedRef = useRef(false);
  const hydratedRef = useRef(false);
  // Flipped true once the server prefs have hydrated, so the persist effect
  // below starts writing only after we've loaded the member's saved config.
  const readyRef = useRef(false);
  useEffect(() => {
    if (!prefsLoaded || hydratedRef.current) return;
    hydratedRef.current = true;
    const s = (preferences.customers ?? {}) as SavedCustomers;
    if (s.columnVisibility) setColumnVisibility(s.columnVisibility);
    if (s.sortBy) {
      setSorting([{ id: s.sortBy, desc: (s.sortDir ?? "desc") === "desc" }]);
    }
    if (s.status !== undefined) setStatus(s.status);
    if (s.statsRange) setStatsRange(s.statsRange);
    if (s.riskLevel !== undefined) setRiskLevel(s.riskLevel);
    if (s.country !== undefined) setCountry(s.country);
    if (s.fromDate !== undefined) setFromDate(s.fromDate);
    if (s.toDate !== undefined) setToDate(s.toDate);
    if (s.archived !== undefined) setArchived(s.archived);
    if (s.activeFilters) setActiveFilters(s.activeFilters);
    if (s.search !== undefined) {
      setSearch(s.search);
      setSearchInput(s.search);
    }
    readyRef.current = true;
  }, [prefsLoaded, preferences]);

  const activeSort = sorting[0] ?? { id: "createdAt", desc: true };

  // Persist view + filter config (debounced inside the hook). Writes once the
  // member has interacted (touchedRef) or the server prefs have hydrated, so
  // the initial render doesn't clobber saved config with defaults.
  useEffect(() => {
    if (!touchedRef.current && !readyRef.current) return;
    setPreference("customers", {
      columnVisibility,
      sortBy: activeSort.id as CustomerSortField,
      sortDir: activeSort.desc ? "desc" : "asc",
      status,
      statsRange,
      riskLevel,
      country,
      fromDate,
      toDate,
      archived,
      activeFilters,
      search,
    });
  }, [
    columnVisibility,
    activeSort.id,
    activeSort.desc,
    status,
    statsRange,
    riskLevel,
    country,
    fromDate,
    toDate,
    archived,
    activeFilters,
    search,
    setPreference,
  ]);

  // Debounce the search box into the query filter.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  const filters: CustomerFilters = {
    page,
    limit: PAGE_SIZE,
    status: (status || undefined) as KycStatus | undefined,
    riskLevel: (riskLevel || undefined) as CustomerRiskLevel | undefined,
    country: country || undefined,
    search: search || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    archived: archived || undefined,
    sortBy: activeSort.id as CustomerSortField,
    sortDir: activeSort.desc ? "desc" : "asc",
  };

  const customersQuery = useCustomers(workspaceId, filters);
  const statsQuery = useCustomerStats(workspaceId, statsRange);
  const archiveCustomer = useArchiveCustomer();
  const stats = statsQuery.data;
  const rows = customersQuery.data?.items ?? [];
  const totalPages = customersQuery.data?.totalPages ?? 1;

  // React Compiler can't memoize TanStack Table's instance (it returns
  // functions); skipping compilation here is expected and harmless.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.customerId,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: (u) => {
      touchedRef.current = true;
      setSorting(u);
    },
    onColumnVisibilityChange: (u) => {
      touchedRef.current = true;
      setColumnVisibility(u);
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColCount = table.getVisibleLeafColumns().length;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  // Restore when viewing the archived list; otherwise archive.
  const bulkTargetArchived = !archived;

  // Clear selection whenever the visible set changes (filters / page).
  useEffect(() => {
    setRowSelection({});
  }, [page, search, status, riskLevel, country, fromDate, toDate, archived]);

  const handleBulkArchive = async () => {
    await Promise.all(
      selectedRows.map((r) =>
        archiveCustomer.mutateAsync({
          customerId: r.original.customerId,
          archived: bulkTargetArchived,
        }),
      ),
    );
    setRowSelection({});
    setBulkOpen(false);
  };

  const hasAnyFilter =
    !!search ||
    !!status ||
    !!riskLevel ||
    !!country ||
    !!fromDate ||
    !!toDate ||
    archived ||
    activeFilters.length > 0;

  // ── Chart data ─────────────────────────────────────────────────────────────
  const byStatusMap = useMemo(
    () =>
      Object.fromEntries(
        (stats?.byStatus ?? []).map((s) => [s.status, s.count]),
      ),
    [stats],
  );
  const statusSlices = useMemo(
    () =>
      (stats?.byStatus ?? []).map((s) => ({
        name: STATUS_LABELS[s.status],
        value: s.count,
        color: STATUS_CHART_COLOR[s.status],
      })),
    [stats],
  );
  const riskSlices = useMemo(
    () =>
      (stats?.byRisk ?? []).map((r) => ({
        name: r.riskLevel ? RISK_LABELS[r.riskLevel] : "Unassessed",
        value: r.count,
        color: r.riskLevel ? RISK_CHART_COLOR[r.riskLevel] : "#cbd5e1",
      })),
    [stats],
  );
  const topCountries = useMemo(
    () =>
      [...(stats?.byCountry ?? [])]
        .filter((c) => c.country)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((c) => ({ code: c.country as string, value: c.count })),
    [stats],
  );
  const overTime = useMemo(
    () => (stats?.overTime ?? []).map((o) => ({ day: o.day, value: o.count })),
    [stats],
  );
  const countryOptions = useMemo(
    () => [
      { value: "", label: "All countries" },
      ...(stats?.byCountry ?? [])
        .filter((c) => c.country)
        .map((c) => ({
          value: c.country as string,
          label: countryName(c.country as string),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [stats],
  );

  const approved = byStatusMap.approved ?? 0;
  const rejected = byStatusMap.rejected ?? 0;
  const decided = approved + rejected;
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            End-users who have completed KYC in this workspace.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white text-sm">
          {STATS_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setStatsRange(r.value)}
              className={`px-3 py-1.5 ${
                statsRange === r.value
                  ? "bg-primary-100 font-medium text-primary-700"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total customers" value={stats?.total ?? 0} />
        <StatCard label="Approved" value={approved} />
        <StatCard label="Rejected" value={rejected} />
        <StatCard label="Flagged" value={byStatusMap.flagged ?? 0} />
        <StatCard label="Approval rate" value={`${approvalRate}%`} />
      </div>

      {/* Charts — compact row; always shown (render empty until there's data) */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChartCard title="By status">
          <DonutChart data={statusSlices} height={180} />
        </ChartCard>
        <ChartCard title="By risk level">
          <DonutChart data={riskSlices} height={180} />
        </ChartCard>
        <ChartCard title="Top countries">
          <TopCountriesList data={topCountries} />
        </ChartCard>
        <ChartCard title="New customers over time">
          <AreaChart data={overTime} height={180} />
        </ChartCard>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm ${
                status === f.value
                  ? f.activeCls
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
        <FilterPopover
          available={ADD_FILTERS.filter((f) => !activeFilters.includes(f.key))}
          countryOptions={countryOptions}
          onApplyRisk={applyRisk}
          onApplyCountry={applyCountry}
          onApplyDate={applyDate}
          onAddArchived={addArchived}
        />
        {activeFilters.includes("risk") && riskLevel && (
          <FilterPill
            label={`Risk: ${RISK_LABELS[riskLevel as CustomerRiskLevel]}`}
            onRemove={() => removeFilter("risk")}
          />
        )}
        {activeFilters.includes("country") && country && (
          <FilterPill
            label={`Country: ${countryName(country)}`}
            onRemove={() => removeFilter("country")}
          />
        )}
        {activeFilters.includes("date") && (fromDate || toDate) && (
          <FilterPill
            label={`Registered: ${fromDate || "any"} → ${toDate || "any"}`}
            onRemove={() => removeFilter("date")}
          />
        )}
        {activeFilters.includes("archived") && (
          <FilterPill
            label="Archived"
            onRemove={() => removeFilter("archived")}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or customer id…"
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <ColumnsMenu table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="group border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 ${
                      header.column.id === "select" ? "w-10" : ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customersQuery.isLoading ? (
              <tr>
                <td
                  colSpan={visibleColCount}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            ) : customersQuery.isError ? (
              <tr>
                <td
                  colSpan={visibleColCount}
                  className="px-4 py-10 text-center text-red-600"
                >
                  Failed to load customers.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColCount}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {hasAnyFilter
                    ? "No customers match these filters."
                    : "No customers yet."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() =>
                    navigate(
                      `/customers/${encodeURIComponent(row.original.customerId)}`,
                    )
                  }
                  className={`group h-[60px] cursor-pointer transition-colors ${
                    row.getIsSelected() ? "bg-primary-50" : "hover:bg-gray-50"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pages (always shown) */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div>
          {customersQuery.data
            ? `${customersQuery.data.total} customer${
                customersQuery.data.total === 1 ? "" : "s"
              }`
            : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-gray-600">
            Page {customersQuery.data?.page ?? page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Floating bulk-action bar — appears once rows are selected */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-2 shadow-lg">
          <span className="text-sm text-gray-600">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => setRowSelection({})}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <div className="h-5 border-l border-gray-200" />
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Archive size={14} /> {bulkTargetArchived ? "Archive" : "Restore"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={bulkOpen}
        title={`${bulkTargetArchived ? "Archive" : "Restore"} ${selectedCount} customer${
          selectedCount === 1 ? "" : "s"
        }`}
        message={
          bulkTargetArchived
            ? "Archived customers are hidden from the default list but kept for audit. You can restore them anytime."
            : "Restore the selected customers to the active list?"
        }
        confirmLabel={bulkTargetArchived ? "Archive" : "Restore"}
        busy={archiveCustomer.isPending}
        onConfirm={handleBulkArchive}
        onCancel={() => setBulkOpen(false)}
      />
    </div>
  );
};
