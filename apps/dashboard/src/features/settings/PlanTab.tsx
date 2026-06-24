import { Check, Mail } from "lucide-react";

import {
  getPlanFeatures,
  isUnlimited,
  PLANS,
  type Plan,
  type PlanFeatures,
} from "@usercore/shared-types";

import { PlanBadge } from "../../components/PlanBadge";
import { useWorkspace } from "../../lib/workspaceContext";

type FeatureRow = {
  label: string;
  render: (f: PlanFeatures, plan: Plan) => string;
};

// Visual order for the comparison table.
const ROWS: FeatureRow[] = [
  {
    label: "Identity verification provider",
    // Enterprise gets the "+ custom" tail since enterprise customers can
    // negotiate bespoke provider integrations; Growth is iDenfy-only.
    render: (f, plan) =>
      f.providers["identity-verification"]
        ? plan === "ENTERPRISE"
          ? "iDenfy + custom"
          : "iDenfy"
        : "Manual review only",
  },
  {
    label: "AML screening",
    render: (f) => (f.providers["aml-screening"] ? "ComplyAdvantage" : "—"),
  },
  {
    label: "Fraud detection",
    render: (f) => (f.providers["fraud-detection"] ? "IPQualityScore" : "—"),
  },
  {
    label: "Workflows per workspace",
    render: (f) =>
      isUnlimited(f.maxWorkflowsPerWorkspace)
        ? "Unlimited"
        : String(f.maxWorkflowsPerWorkspace),
  },
  {
    label: "Workspaces per organization",
    render: (f) =>
      isUnlimited(f.maxWorkspacesPerOrganization)
        ? "Unlimited"
        : String(f.maxWorkspacesPerOrganization),
  },
  {
    label: "Members per organization",
    render: (f) =>
      isUnlimited(f.maxMembersPerOrganization)
        ? "Unlimited"
        : String(f.maxMembersPerOrganization),
  },
  {
    label: "Verifications per month",
    render: (f) =>
      isUnlimited(f.maxVerificationsPerMonth)
        ? "Unlimited"
        : f.maxVerificationsPerMonth.toLocaleString(),
  },
  {
    label: "Scenarios",
    render: (f) =>
      isUnlimited(f.maxScenarios)
        ? "Unlimited"
        : f.maxScenarios === 0
          ? "—"
          : String(f.maxScenarios),
  },
  {
    label: "Widget branding",
    render: (f) =>
      f.whiteLabel
        ? "White-label"
        : f.customBranding
          ? "Custom"
          : "UserCore-branded",
  },
];

export const PlanTab = () => {
  const { organization } = useWorkspace();
  const currentPlan = organization.plan;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Current plan
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge plan={currentPlan} size="md" />
          <span className="text-sm text-gray-500">for {organization.name}</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Plans are managed by the UserCore team. To upgrade or downgrade,
          contact your account manager — sales-led only.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-4">
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-200" />
          {PLANS.map((plan) => (
            <div
              key={plan}
              className={`px-5 py-4 border-b border-gray-200 ${
                plan === currentPlan ? "bg-primary-50" : "bg-gray-50 opacity-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <PlanBadge plan={plan} size="md" />
                {plan === currentPlan && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary-200 text-primary-800">
                    <Check size={10} />
                    Current
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-4 ${i > 0 ? "border-t border-gray-100" : ""}`}
          >
            <div className="px-5 py-3 text-sm text-gray-600 bg-gray-50/50">
              {row.label}
            </div>
            {PLANS.map((plan) => (
              <PlanCell
                key={plan}
                value={row.render(getPlanFeatures(plan as Plan), plan as Plan)}
                highlighted={plan === currentPlan}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-600">
          Need a different plan? Plans are sales-led — our team will help you
          pick the right tier for {organization.name}.
        </p>
        <a
          href="mailto:sales@usercore.com?subject=Plan%20enquiry"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-200 px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-300"
        >
          <Mail size={16} />
          Contact sales
        </a>
      </div>
    </div>
  );
};

const PlanCell = ({
  value,
  highlighted,
}: {
  value: string;
  highlighted: boolean;
}) => (
  <div
    className={`px-5 py-3 text-sm ${
      highlighted ? "bg-primary-50/50 text-gray-900" : "text-gray-400"
    } ${value === "—" ? "text-gray-300" : ""}`}
  >
    {value}
  </div>
);
