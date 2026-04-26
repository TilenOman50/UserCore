import { useSearchParams } from "react-router-dom";

import { MembersTab } from "../features/settings/MembersTab";
import { WorkspaceTab } from "../features/settings/WorkspaceTab";
import { useWorkspace } from "../lib/workspaceContext";

type Tab = "workspace" | "members";

export const SettingsPage = () => {
  const { role } = useWorkspace();
  const canManageMembers = role === "owner" || role === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: Tab =
    requestedTab === "members" && canManageMembers ? "members" : "workspace";

  const setTab = (next: Tab) => {
    if (next === "workspace") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const tabs = [
    { id: "workspace" as const, label: "Workspace" },
    ...(canManageMembers ? [{ id: "members" as const, label: "Members" }] : []),
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          {canManageMembers
            ? "Manage your workspace configuration and members"
            : "View your workspace configuration"}
        </p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === item.id
                  ? "border-primary-300 text-primary-800"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "members" && canManageMembers ? (
        <MembersTab />
      ) : (
        <WorkspaceTab />
      )}
    </div>
  );
};
