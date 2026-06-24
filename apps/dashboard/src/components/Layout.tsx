import { useState } from "react";
import { ArrowRight, FolderPlus } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

import type { Plan } from "@usercore/shared-types";

import { CommandPalette } from "../features/command-palette/CommandPalette";
import { NewWorkspaceModal } from "../features/workspace/NewWorkspaceModal";
import { WorkspaceSwitcher } from "../features/workspace/WorkspaceSwitcher";
import { signOut } from "../lib/authClient";
import { useWorkspace } from "../lib/workspaceContext";
import { PlanBadge } from "./PlanBadge";

export const navItems = [
  { path: "/", label: "Overview" },
  { path: "/customers", label: "Customers" },
  { path: "/kyc-review", label: "KYC Review" },
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
    // Single scroll container (the whole app scrolls here) with a sticky
    // sidebar — so native scrolling (incl. momentum) works over the nav too.
    <div className="h-screen overflow-y-auto bg-gray-50">
      <div className="flex min-h-full">
        <aside className="self-start sticky top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <WorkspaceSwitcher />
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`);
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
            <PlanCard plan={organization.plan} />
            <Link
              to="/settings/profile"
              title="Your profile"
              className="flex items-center gap-3 mb-3 -mx-1.5 px-1.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary-200 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary-700">
                  {initialsOf(user.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user.email}
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex flex-1 flex-col">
          <div className="flex-1">
            {hasWorkspaces ? (
              <Outlet />
            ) : (
              <NoWorkspacesView
                orgName={organization.name}
                canCreate={canCreate}
              />
            )}
          </div>
          <Footer />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
};

const PlanCard = ({ plan }: { plan: Plan }) => {
  const canUpgrade = plan !== "ENTERPRISE";
  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Your plan
      </div>
      <div className="flex items-center justify-between gap-2">
        <PlanBadge plan={plan} size="md" />
        {canUpgrade ? (
          <Link
            to="/settings/plan"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            Upgrade
            <ArrowRight size={12} />
          </Link>
        ) : (
          <span className="text-xs text-gray-400">Highest tier</span>
        )}
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="border-t border-gray-200 px-8 py-5">
    <div className="flex flex-col items-center justify-between gap-1 text-xs text-gray-400 sm:flex-row">
      <p>© {new Date().getFullYear()} UserCore. All rights reserved.</p>
      <p>Secure identity verification &amp; KYC.</p>
    </div>
  </footer>
);

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
