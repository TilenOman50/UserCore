import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { CommandPalette } from "../features/command-palette/CommandPalette";
import { NewWorkspaceModal } from "../features/workspace/NewWorkspaceModal";
import { WorkspaceSwitcher } from "../features/workspace/WorkspaceSwitcher";
import { signOut } from "../lib/authClient";
import { useWorkspace } from "../lib/workspaceContext";

const navItems = [
  { path: "/", label: "Overview" },
  { path: "/customers", label: "Customers" },
  { path: "/workflows", label: "Workflows" },
  { path: "/kyc-review", label: "KYC Review" },
  { path: "/scenarios", label: "Scenarios" },
  { path: "/settings", label: "Settings" },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";

export const Layout = () => {
  const location = useLocation();
  const { user, workspaces, organization, role } = useWorkspace();
  const hasWorkspaces = workspaces.length > 0;
  const canCreate = role === "owner" || role === "admin";

  const handleSignOut = async () => {
    await signOut();
    // Hard reload so useSession cache clears
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-200 text-primary-800"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary-200 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary-700">
                {initialsOf(user.name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </div>
              <div className="text-xs text-gray-500 truncate">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {hasWorkspaces ? (
          <Outlet />
        ) : (
          <NoWorkspacesView
            orgName={organization.name}
            canCreate={canCreate}
          />
        )}
      </main>

      <CommandPalette />
    </div>
  );
};

const NoWorkspacesView = ({
  orgName,
  canCreate,
}: {
  orgName: string;
  canCreate: boolean;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md w-full">
        <div className="flex justify-center mb-4 text-primary-600">
          <FolderPlus size={48} strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {canCreate ? "Create your first workspace" : "No workspaces yet"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {canCreate
            ? `${orgName} doesn't have any workspaces yet. Create one to start building workflows, reviewing customers, and configuring scenarios.`
            : `${orgName} doesn't have any workspaces yet, and your role doesn't allow you to create one. Ask an owner or admin to set one up.`}
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-xl text-sm shadow-sm"
          >
            <FolderPlus size={16} />
            New workspace
          </button>
        )}
        <NewWorkspaceModal open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
};
