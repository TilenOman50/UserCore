import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  RotateCcw,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { isUnlimited, type KycStatus, type Plan } from "@usercore/shared-types";

import { AreaChart, DonutChart } from "../components/charts/CustomerCharts";
import { WorldMapChart } from "../components/charts/WorldMapChart";
import { apiFetch, WORKFLOWS_API_URL } from "../lib/api";
import { countryName } from "../lib/countries";
import { formatDateTime } from "../lib/dates";
import { useCustomerStats } from "../lib/hooks/useCustomers";
import {
  useReviewQueue,
  useWorkspaceVerificationStats,
  type ReviewQueueStatus,
} from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

const STATUS_LABELS: Record<KycStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  flagged: "Flagged",
};
const STATUS_COLOR: Record<KycStatus, string> = {
  not_started: "#9ca3af",
  pending: "#eab308",
  approved: "#3d9270",
  rejected: "#ef4444",
  flagged: "#f97316",
};

const REVIEW_BADGE: Record<
  ReviewQueueStatus,
  { cls: string; label: string; icon: ReactNode }
> = {
  needs_review: {
    cls: "bg-yellow-100 text-yellow-700",
    label: "Needs review",
    icon: <AlertTriangle size={11} />,
  },
  resubmission: {
    cls: "bg-orange-100 text-orange-700",
    label: "Resubmission",
    icon: <RotateCcw size={11} />,
  },
  in_progress: {
    cls: "bg-gray-100 text-gray-500",
    label: "In progress",
    icon: <Clock size={11} />,
  },
  approved: {
    cls: "bg-primary-100 text-primary-700",
    label: "Approved",
    icon: <Check size={11} />,
  },
  rejected: {
    cls: "bg-red-100 text-red-700",
    label: "Rejected",
    icon: <X size={11} />,
  },
};

type VerificationStats = { used: number; max: number; plan: Plan };

export const OverviewPage = () => {
  const { workspace, organization, user } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const firstName = user.name?.split(/\s+/)[0] ?? "there";
  const navigate = useNavigate();

  const statsQuery = useCustomerStats(workspaceId);
  const wsVerifQuery = useWorkspaceVerificationStats(workspaceId);
  const needsReviewQuery = useReviewQueue({
    workspaceId: workspaceId ?? "",
    page: 1,
    limit: 1,
    status: "needs_review",
  });
  const recentQuery = useReviewQueue({
    workspaceId: workspaceId ?? "",
    page: 1,
    limit: 6,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const usage = useQuery({
    queryKey: ["verification-usage", organization.id],
    queryFn: () =>
      apiFetch<VerificationStats>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/organization/${encodeURIComponent(organization.id)}/usage`,
      ),
  });

  const stats = statsQuery.data;
  const byStatus = useMemo(
    () =>
      Object.fromEntries(
        (stats?.byStatus ?? []).map((s) => [s.status, s.count]),
      ) as Partial<Record<KycStatus, number>>,
    [stats],
  );

  const statusSlices = useMemo(
    () =>
      (stats?.byStatus ?? [])
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: STATUS_LABELS[s.status],
          value: s.count,
          color: STATUS_COLOR[s.status],
        })),
    [stats],
  );

  const worldData = useMemo(
    () =>
      (stats?.byCountry ?? [])
        .filter((c) => c.country)
        .map((c) => ({ name: countryName(c.country!), value: c.count })),
    [stats],
  );

  const overTime = useMemo(
    () => (stats?.overTime ?? []).map((d) => ({ day: d.day, value: d.count })),
    [stats],
  );

  const needsReview = needsReviewQuery.data?.total ?? 0;
  const recent = recentQuery.data?.items ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {firstName} — here&apos;s what&apos;s happening across
          your workspace today.
        </p>
      </div>

      {/* Headline cards */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => navigate("/kyc-review")}
          className="group rounded-xl border border-amber-200 bg-amber-50 p-5 text-left transition-colors hover:bg-amber-100"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-700">Needs review</p>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-900">
            {needsReview}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            Go to review
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </p>
        </button>
        <StatCard label="Total customers" value={stats?.total ?? 0} />
        <StatCard label="Approved" value={byStatus.approved ?? 0} />
        <StatCard label="Rejected" value={byStatus.rejected ?? 0} />
        <StatCard label="Flagged" value={byStatus.flagged ?? 0} />
      </div>

      {/* Verifications */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Verifications this month"
          value={wsVerifQuery.data?.thisMonth ?? 0}
          sub="this workspace"
        />
        <StatCard
          label="Total verifications"
          value={wsVerifQuery.data?.total ?? 0}
          sub="this workspace"
        />
        <VerificationsUsageCard
          stats={usage.data}
          isLoading={usage.isLoading}
        />
      </div>

      {/* World map + recent submissions */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Customers by country" className="lg:col-span-2">
          <WorldMapChart data={worldData} height={340} />
        </ChartCard>
        <ChartCard title="Recent submissions">
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No submissions yet.
            </p>
          ) : (
            <div className="-mx-2">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/kyc-review/${r.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {r.customerName ?? r.customerId}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_BADGE[r.reviewStatus].cls}`}
                  >
                    {REVIEW_BADGE[r.reviewStatus].icon}
                    {REVIEW_BADGE[r.reviewStatus].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="By status">
          <DonutChart data={statusSlices} height={200} />
        </ChartCard>
        <ChartCard title="New customers over time">
          <AreaChart data={overTime} height={200} />
        </ChartCard>
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
  </div>
);

const ChartCard = ({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white p-4 ${className ?? ""}`}
  >
    <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
    {children}
  </div>
);

const VerificationsUsageCard = ({
  stats,
  isLoading,
}: {
  stats: VerificationStats | undefined;
  isLoading: boolean;
}) => {
  if (isLoading || !stats) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">
        Loading organization usage…
      </div>
    );
  }

  const unlimited = isUnlimited(stats.max);
  const ratio = unlimited
    ? 0
    : Math.min(1, stats.used / Math.max(1, stats.max));
  const pct = Math.round(ratio * 100);
  const barColor =
    ratio >= 1
      ? "bg-red-500"
      : ratio >= 0.8
        ? "bg-yellow-500"
        : "bg-primary-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Organization usage
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {stats.used.toLocaleString()}
            <span className="text-base font-normal text-gray-400">
              {" "}
              / {unlimited ? "∞" : stats.max.toLocaleString()}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-400">verifications this month</p>
        </div>
        {!unlimited && (
          <div
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
              ratio >= 1
                ? "bg-red-100 text-red-700"
                : ratio >= 0.8
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-primary-100 text-primary-700"
            }`}
          >
            {pct}%
          </div>
        )}
      </div>
      {!unlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {ratio >= 1 && !unlimited && (
        <p className="mt-3 text-xs text-red-600">
          Plan limit reached. New customer verifications will be rejected until
          the next calendar month or until you upgrade.
        </p>
      )}
    </div>
  );
};
