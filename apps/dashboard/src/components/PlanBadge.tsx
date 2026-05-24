import { Sparkles, Sprout, TrendingUp, type LucideIcon } from "lucide-react";

import type { Plan } from "@usercore/shared-types";

// Single, recognizable plan badge used everywhere a tier appears (sidebar, plan
// page, feature-gating hints). Starter = gray, Growth = blue, Enterprise =
// violet — each with its own icon for instant recognition.
const STYLES: Record<Plan, string> = {
  STARTER: "bg-gray-100 text-gray-600",
  GROWTH: "bg-blue-100 text-blue-700",
  ENTERPRISE: "bg-violet-100 text-violet-700",
};
const LABELS: Record<Plan, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};
const ICONS: Record<Plan, LucideIcon> = {
  STARTER: Sprout,
  GROWTH: TrendingUp,
  ENTERPRISE: Sparkles,
};

export const PlanBadge = ({
  plan,
  size = "sm",
}: {
  plan: Plan;
  size?: "sm" | "md";
}) => {
  const Icon = ICONS[plan];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide ${
        STYLES[plan]
      } ${size === "md" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[10px]"}`}
      title={`${LABELS[plan]} plan`}
    >
      <Icon size={size === "md" ? 12 : 10} />
      {LABELS[plan]}
    </span>
  );
};
