import { PlanTab } from "../../features/settings/PlanTab";

export const PlanSettingsPage = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">Plan</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your current plan and its limits.
      </p>
    </div>
    <PlanTab />
  </div>
);
