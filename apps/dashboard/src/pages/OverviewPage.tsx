import { useQuery } from "@tanstack/react-query";

import { isUnlimited, type Plan } from "@usercore/shared-types";

import { apiFetch, WORKFLOWS_API_URL } from "../lib/api";
import { useWorkspace } from "../lib/workspaceContext";

const statCards = [
  { label: "Total Users", value: "—", color: "bg-blue-50 text-blue-700" },
  { label: "Pending KYC", value: "—", color: "bg-yellow-50 text-yellow-700" },
  { label: "Approved", value: "—", color: "bg-primary-50 text-primary-700" },
  { label: "Rejected", value: "—", color: "bg-red-50 text-red-700" },
];

type VerificationStats = {
  used: number;
  max: number;
  plan: Plan;
};

export const OverviewPage = () => {
  const { organization } = useWorkspace();

  const usage = useQuery({
    queryKey: ["verification-usage", organization.id],
    queryFn: () =>
      apiFetch<VerificationStats>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/organization/${encodeURIComponent(organization.id)}/usage`,
      ),
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your UserCore dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <VerificationsUsageCard stats={usage.data} isLoading={usage.isLoading} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <p className="text-sm text-gray-500">No recent activity yet.</p>
      </div>
    </div>
  );
};

const VerificationsUsageCard = ({
  stats,
  isLoading,
}: {
  stats: VerificationStats | undefined;
  isLoading: boolean;
}) => {
  if (isLoading || !stats) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-400">
        Loading verification usage…
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
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Verifications this month
          </h2>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats.used.toLocaleString()}
            <span className="text-base font-normal text-gray-400">
              {" "}
              / {unlimited ? "∞" : stats.max.toLocaleString()}
            </span>
          </p>
        </div>
        {!unlimited && (
          <div
            className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
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
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
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
