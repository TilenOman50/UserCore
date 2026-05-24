import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Modal } from "../components/Modal";
import { COUNTRIES } from "../lib/countries";
import { usePreferences } from "../lib/hooks/usePreferences";
import {
  useArchiveSession,
  useReviewQueue,
  type ReviewQueueFilter,
  type ReviewQueueRow,
  type ReviewQueueStatus,
} from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

const PAGE_SIZE = 20;

type StatusFilter = ReviewQueueFilter;
type ModeFilter = "all" | "sandbox" | "production";

// The review page is a work inbox — only OPEN submissions live here. Approved /
// rejected / archived records belong on the Customers page, not this queue.
const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
  icon: ReactNode;
  activeCls: string;
}> = [
  {
    value: "needs_review",
    label: "Needs review",
    icon: <AlertTriangle size={13} />,
    activeCls: "bg-yellow-100 text-yellow-700",
  },
  {
    value: "resubmission",
    label: "Resubmission",
    icon: <RotateCcw size={13} />,
    activeCls: "bg-orange-100 text-orange-700",
  },
  {
    value: "in_progress",
    label: "In progress",
    icon: <Clock size={13} />,
    activeCls: "bg-gray-100 text-gray-500",
  },
];

const STATUS_BADGE: Record<
  ReviewQueueStatus,
  { cls: string; icon: ReactNode; label: string }
> = {
  needs_review: {
    cls: "bg-yellow-100 text-yellow-700",
    icon: <AlertTriangle size={12} />,
    label: "Needs review",
  },
  resubmission: {
    cls: "bg-orange-100 text-orange-700",
    icon: <RotateCcw size={12} />,
    label: "Resubmission",
  },
  in_progress: {
    cls: "bg-gray-100 text-gray-500",
    icon: <Clock size={12} />,
    label: "In progress",
  },
  approved: {
    cls: "bg-primary-100 text-primary-700",
    icon: <Check size={12} />,
    label: "Approved",
  },
  rejected: {
    cls: "bg-red-100 text-red-700",
    icon: <X size={12} />,
    label: "Rejected",
  },
};

export const KycReviewPage = () => {
  const { workspace, user } = useWorkspace();
  const workspaceId = workspace?.id ?? "";
  const navigate = useNavigate();
  const archiveSession = useArchiveSession();
  const { preferences, setPreference, loaded: prefsLoaded } = usePreferences();

  // Restore persisted filters — cross-device via dashboard-api, instant via the
  // localStorage cache. Each value is validated against the current options so a
  // stale saved value (e.g. a removed chip) falls back to the default. Page is
  // intentionally NOT persisted — always start at page 1.
  const savedFilters = (preferences.reviewQueue ?? {}) as {
    status?: string;
    mode?: string;
    search?: string;
  };
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>(() =>
    STATUS_FILTERS.some((f) => f.value === savedFilters.status)
      ? (savedFilters.status as StatusFilter)
      : "needs_review",
  );
  const [mode, setMode] = useState<ModeFilter>(() =>
    savedFilters.mode === "sandbox" || savedFilters.mode === "production"
      ? savedFilters.mode
      : "all",
  );
  const [searchInput, setSearchInput] = useState(savedFilters.search ?? "");
  const [search, setSearch] = useState(savedFilters.search ?? "");

  // Persist the current filter triple; the hook debounces the server write and
  // updates the localStorage cache immediately. `touched` blocks a late server
  // hydration from clobbering a change the member just made.
  const touchedRef = useRef(false);
  const persistFilters = (next: {
    status: StatusFilter;
    mode: ModeFilter;
    search: string;
  }) => {
    touchedRef.current = true;
    setPreference("reviewQueue", next);
  };

  // Hydrate from the SERVER once it loads — covers a cleared localStorage cache
  // or a different device, where the synchronous init above had nothing to read.
  // Runs once, and never overrides a filter the member already changed.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefsLoaded || hydratedRef.current || touchedRef.current) return;
    hydratedRef.current = true;
    const rq = preferences.reviewQueue;
    if (!rq) return;
    if (rq.status && STATUS_FILTERS.some((f) => f.value === rq.status)) {
      setStatus(rq.status as StatusFilter);
    }
    if (
      rq.mode === "all" ||
      rq.mode === "sandbox" ||
      rq.mode === "production"
    ) {
      setMode(rq.mode);
    }
    if (typeof rq.search === "string") {
      setSearch(rq.search);
      setSearchInput(rq.search);
    }
  }, [prefsLoaded, preferences]);

  // Multi-select for bulk archive. Cleared whenever the visible set changes so
  // you can never archive a row you can't currently see.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  const query = useReviewQueue({
    workspaceId,
    page,
    limit: PAGE_SIZE,
    status,
    mode: mode === "all" ? undefined : mode,
    search: search || undefined,
  });

  const data = query.data;
  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    setSelected(new Set());
  }, [page, status, mode, search]);

  const resetToFirstPage = () => setPage(1);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchInput.trim();
    setSearch(term);
    resetToFirstPage();
    persistFilters({ status, mode, search: term });
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    resetToFirstPage();
    persistFilters({ status, mode, search: "" });
  };

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const handleBulkArchive = async () => {
    if (archiveReason.trim() === "" || selected.size === 0) return;
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        archiveSession.mutateAsync({
          sessionId: id,
          reviewedBy: user.id,
          reason: archiveReason.trim(),
        }),
      ),
    );
    setSelected(new Set());
    setArchiveReason("");
    setArchiveOpen(false);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review verification submissions, enter ID data, run checks, and
            decide.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value);
                resetToFirstPage();
                persistFilters({ status: f.value, mode, search });
              }}
              className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 ${
                status === f.value
                  ? f.activeCls
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode segmented control */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            {(
              [
                {
                  value: "all",
                  label: "All",
                  icon: null,
                  activeCls: "bg-gray-100 text-gray-900",
                },
                {
                  value: "sandbox",
                  label: "Sandbox",
                  icon: <FlaskConical size={13} />,
                  activeCls: "bg-yellow-100 text-yellow-700",
                },
                {
                  value: "production",
                  label: "Live",
                  icon: <Radio size={13} />,
                  activeCls: "bg-red-100 text-red-700",
                },
              ] as const
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setMode(m.value);
                  resetToFirstPage();
                  persistFilters({ status, mode: m.value, search });
                }}
                className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 ${
                  mode === m.value
                    ? m.activeCls
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={submitSearch} className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search customer…"
              className="w-56 pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-gray-300 accent-primary-500 cursor-pointer align-middle"
                />
              </th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!query.isLoading && query.isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="text-sm text-red-600">
                    Couldn’t load submissions.
                  </div>
                  <button
                    type="button"
                    onClick={() => query.refetch()}
                    className="mt-2 text-sm text-primary-700 hover:underline"
                  >
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No submissions match these filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <ReviewRow
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggleRow(row.id)}
                onClick={() => navigate(`/kyc-review/${row.id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
        <div>
          {data ? `${data.total} submission${data.total === 1 ? "" : "s"}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-gray-600">
            Page {data?.page ?? page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Floating bulk-action bar — appears once rows are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-2 shadow-lg">
          <span className="text-sm text-gray-600">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <div className="h-5 border-l border-gray-200" />
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium"
          >
            <Archive size={14} /> Archive
          </button>
        </div>
      )}

      {/* Archive — confirmation modal (reason required for audit) */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={`Archive ${selected.size} submission${selected.size === 1 ? "" : "s"}`}
        subtitle="Hidden from the queue but kept for audit — never hard-deleted."
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setArchiveOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={archiveSession.isPending || archiveReason.trim() === ""}
              onClick={handleBulkArchive}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {archiveSession.isPending ? "Archiving…" : "Confirm archive"}
            </button>
          </div>
        }
      >
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          value={archiveReason}
          onChange={(e) => setArchiveReason(e.target.value)}
          placeholder="Why are these being archived? (e.g. test data, duplicate entry)"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </Modal>
    </div>
  );
};

// Just the flag from an ISO alpha-2 code (country name on hover); raw value if
// unknown, em dash if absent. Reuses the flag-icons CSS the dashboard loads.
const CountryCell = ({ code }: { code: string | null }) => {
  if (!code) return <span className="text-gray-300">—</span>;
  const cc = code.trim().toUpperCase();
  const country = COUNTRIES.find((c) => c.code === cc);
  if (!country) return <span className="text-xs text-gray-500">{code}</span>;
  return (
    <span
      title={country.name}
      aria-label={country.name}
      className={`fi fi-${cc.toLowerCase()} inline-block h-4 w-6 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
    />
  );
};

const ReviewRow = ({
  row,
  selected,
  onToggle,
  onClick,
}: {
  row: ReviewQueueRow;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}) => {
  const badge = STATUS_BADGE[row.reviewStatus];
  return (
    <tr
      onClick={onClick}
      className={`h-[60px] cursor-pointer transition-colors ${
        selected ? "bg-primary-50" : "hover:bg-gray-50"
      }`}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${row.customerId}`}
          className="h-4 w-4 rounded border-gray-300 accent-primary-500 cursor-pointer align-middle"
        />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">
          {row.customerName ?? row.customerId}
        </div>
        {row.customerName && (
          <div className="font-mono text-xs text-gray-400">
            {row.customerId}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <CountryCell code={row.customerCountry} />
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            row.verificationMode === "sandbox"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {row.verificationMode === "sandbox" ? (
            <>
              <FlaskConical size={12} /> Sandbox
            </>
          ) : (
            <>
              <Radio size={12} /> Live
            </>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500">
        {new Date(row.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${badge.cls}`}
        >
          {badge.icon} {badge.label}
        </span>
      </td>
    </tr>
  );
};
