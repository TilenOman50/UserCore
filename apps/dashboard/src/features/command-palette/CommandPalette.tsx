import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";

import { navItems } from "../../components/Layout";
import { settingsNavItems } from "../../components/SettingsLayout";
import { signOut } from "../../lib/authClient";
import { useSwitchWorkspace } from "../../lib/hooks/useWorkspaceMutations";
import { useWorkspace } from "../../lib/workspaceContext";
import { InviteMemberModal } from "../settings/InviteMemberModal";
import { NewWorkspaceModal } from "../workspace/NewWorkspaceModal";

export const CommandPalette = () => {
  const navigate = useNavigate();
  const { workspace, organization, workspaces, role } = useWorkspace();
  const switchWorkspace = useSwitchWorkspace();

  const canManageMembers = role === "owner" || role === "admin";
  const canCreateWorkspace = role === "owner" || role === "admin";

  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSwitch = async (workspaceId: string) => {
    setOpen(false);
    if (workspaceId === workspace?.id) return;
    await switchWorkspace.mutateAsync(workspaceId);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[15vh] p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden"
          >
            <Command label="Command palette" className="flex flex-col">
              <Command.Input
                autoFocus
                placeholder="Type a command or search..."
                className="w-full px-4 py-3 text-sm border-b border-gray-200 focus:outline-none"
              />
              <Command.List className="max-h-[400px] overflow-auto p-2">
                <Command.Empty className="px-3 py-6 text-sm text-gray-500 text-center">
                  No results found.
                </Command.Empty>

                <Command.Group
                  heading="Navigate"
                  className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-2"
                >
                  {navItems
                    .filter((item) => item.path !== "/settings")
                    .map((item) => (
                      <Command.Item
                        key={item.path}
                        onSelect={() => go(item.path)}
                        className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                      >
                        {item.label}
                      </Command.Item>
                    ))}
                </Command.Group>

                <Command.Group
                  heading="Settings"
                  className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-2 mt-2"
                >
                  {settingsNavItems
                    .filter((item) => !item.managersOnly || canManageMembers)
                    .map((item) => (
                      <Command.Item
                        key={item.to}
                        value={`settings ${item.label}`}
                        onSelect={() => go(item.to)}
                        className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                      >
                        {item.label}
                      </Command.Item>
                    ))}
                </Command.Group>

                <Command.Group
                  heading="Actions"
                  className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-2 mt-2"
                >
                  {canManageMembers && (
                    <Command.Item
                      onSelect={() => {
                        setOpen(false);
                        setInviteOpen(true);
                      }}
                      className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                    >
                      Invite member
                    </Command.Item>
                  )}
                  {canCreateWorkspace && (
                    <Command.Item
                      onSelect={() => {
                        setOpen(false);
                        setNewWorkspaceOpen(true);
                      }}
                      className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                    >
                      Create new workspace
                    </Command.Item>
                  )}
                  <Command.Item
                    onSelect={handleSignOut}
                    className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                  >
                    Sign out
                  </Command.Item>
                </Command.Group>

                {workspaces.length > 1 && (
                  <Command.Group
                    heading="Switch workspace"
                    className="text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-2 mt-2"
                  >
                    {workspaces
                      .filter((w) => !w.isActive)
                      .map((w) => (
                        <Command.Item
                          key={w.id}
                          value={`switch ${w.name}`}
                          onSelect={() => handleSwitch(w.id)}
                          className="px-3 py-2 rounded-lg text-sm cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary-800"
                        >
                          {w.name}
                        </Command.Item>
                      ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={organization.id}
      />
      <NewWorkspaceModal
        open={newWorkspaceOpen}
        onClose={() => setNewWorkspaceOpen(false)}
      />
    </>
  );
};
