import { NavLink, Outlet } from "react-router-dom";

import { useWorkspace } from "../lib/workspaceContext";

type SettingsNavItem = { to: string; label: string; managersOnly?: boolean };

// Grouped vertical sub-nav for the Settings area. Top-level nav stays lean
// (operate) while everything configurable lives here (configure).
const SETTINGS_GROUPS: Array<{ heading: string; items: SettingsNavItem[] }> = [
  {
    heading: "Configuration",
    items: [
      { to: "/settings/workflows", label: "Workflows" },
      { to: "/settings/scenarios", label: "Scenarios" },
      { to: "/settings/providers", label: "Providers" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { to: "/settings/general", label: "General" },
      { to: "/settings/api-keys", label: "API keys", managersOnly: true },
    ],
  },
  {
    heading: "Organization",
    items: [
      { to: "/settings/members", label: "Members", managersOnly: true },
      { to: "/settings/plan", label: "Plan" },
    ],
  },
  {
    heading: "Account",
    items: [{ to: "/settings/profile", label: "Profile" }],
  },
  {
    heading: "Help",
    items: [{ to: "/settings/docs", label: "Documentation" }],
  },
];

// Flat list (the command palette flattens groups and respects role gating).
export const settingsNavItems: SettingsNavItem[] = SETTINGS_GROUPS.flatMap(
  (group) => group.items,
);

export const SettingsLayout = () => {
  const { role } = useWorkspace();
  const canManageMembers = role === "owner" || role === "admin";

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 overflow-auto border-r border-gray-200 bg-white p-4">
        <div className="px-3 pb-3 text-sm font-bold text-gray-900">
          Settings
        </div>
        <div className="space-y-5">
          {SETTINGS_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.heading}
              </div>
              <div className="space-y-0.5">
                {group.items
                  .filter((item) => !item.managersOnly || canManageMembers)
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary-200 text-primary-800"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
