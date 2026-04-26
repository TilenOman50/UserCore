import { useState } from "react";

import type { Role } from "../../lib/hooks/useMembers";
import { useInviteMember } from "../../lib/hooks/useMembers";
import { useWorkspace } from "../../lib/workspaceContext";

const ALL_ROLE_OPTIONS: Array<{
  value: Role;
  label: string;
  description: string;
}> = [
  {
    value: "member",
    label: "Member",
    description: "Can review KYC submissions",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Can review KYCs and manage other members",
  },
  {
    value: "owner",
    label: "Owner",
    description: "Full access including workspace settings",
  },
];

export const InviteMemberModal = (props: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
}) => {
  const { open, onClose, organizationId } = props;
  const { role: callerRole, workspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const inviteMember = useInviteMember(organizationId);

  const ROLE_OPTIONS =
    callerRole === "owner"
      ? ALL_ROLE_OPTIONS
      : ALL_ROLE_OPTIONS.filter((r) => r.value !== "owner");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Members get access to the current workspace by default — admins/owners
      // implicitly see all workspaces in the org so the array is harmless.
      const workspaceIds = role === "member" && workspace ? [workspace.id] : [];
      await inviteMember.mutateAsync({ email, role, workspaceIds });
      setEmail("");
      setRole("member");
      onClose();
    } catch {
      // Error displayed below
    }
  };

  const handleClose = () => {
    inviteMember.reset();
    setEmail("");
    setRole("member");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Invite a member
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          They'll receive an email with a sign-in link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    role === opt.value
                      ? "border-primary-300 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={role === opt.value}
                    onChange={() => setRole(opt.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {inviteMember.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {inviteMember.error.message}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMember.isPending}
              className="px-4 py-2 text-sm font-medium bg-primary-200 hover:bg-primary-300 text-primary-800 rounded-lg disabled:opacity-50"
            >
              {inviteMember.isPending ? "Inviting…" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
