import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Dropdown } from "../../components/Dropdown";
import type { DropdownOption } from "../../components/Dropdown";
import { Pagination } from "../../components/Pagination";
import { usePlan, UPGRADE_HINT } from "../../lib/hooks/usePlan";
import {
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "../../lib/hooks/useMembers";
import type { Member, Role } from "../../lib/hooks/useMembers";
import { useWorkspace } from "../../lib/workspaceContext";
import { InviteMemberModal } from "./InviteMemberModal";
import { MemberAccessModal } from "./MemberAccessModal";

const PAGE_SIZE = 10;

const ALL_ROLES: Role[] = ["owner", "admin", "member"];
const NON_OWNER_ROLES: Role[] = ["admin", "member"];

const STATUS_OPTIONS: ReadonlyArray<DropdownOption> = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
];

const ROLE_OPTIONS: ReadonlyArray<DropdownOption> = [
  { value: "", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

export const MembersTab = () => {
  const { user, organization, role: callerRole, workspaces } = useWorkspace();
  const orgId = organization.id;
  const isOwner = callerRole === "owner";

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const roleFilter = searchParams.get("role") ?? "";
  const workspaceFilter = searchParams.get("workspace") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const hasAnyFilter = !!(
    search ||
    statusFilter ||
    roleFilter ||
    workspaceFilter
  );

  // Local state for the search input (so we can debounce URL updates)
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (searchInput === search) return;
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (searchInput) next.set("q", searchInput);
      else next.delete("q");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, search, searchParams, setSearchParams]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    // Reset to page 1 whenever a filter changes
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ["q", "status", "role", "workspace", "page"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const { data, isPending, error } = useMembers(orgId, {
    search: search || undefined,
    status:
      statusFilter === "active" || statusFilter === "pending"
        ? statusFilter
        : undefined,
    role:
      roleFilter === "owner" ||
      roleFilter === "admin" ||
      roleFilter === "member"
        ? roleFilter
        : undefined,
    workspaceId: workspaceFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const { memberLimitReached: membersAtLimit } = usePlan();

  const [inviteOpen, setInviteOpen] = useState(false);
  const memberLimitReached = data
    ? membersAtLimit(data.total)
    : false;
  const [accessTarget, setAccessTarget] = useState<Member | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  if (isPending) {
    return <div className="text-sm text-gray-500">Loading members…</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Failed to load members: {error.message}
      </div>
    );
  }

  const workspaceOptions: DropdownOption[] = [
    { value: "", label: "All workspaces" },
    ...workspaces.map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />

        <Dropdown
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => updateParam("status", v)}
          className="w-44"
        />
        <Dropdown
          value={roleFilter}
          options={ROLE_OPTIONS}
          onChange={(v) => updateParam("role", v)}
          className="w-40"
        />
        <Dropdown
          value={workspaceFilter}
          options={workspaceOptions}
          onChange={(v) => updateParam("workspace", v)}
          className="w-48"
        />

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={() => !memberLimitReached && setInviteOpen(true)}
          disabled={memberLimitReached}
          title={memberLimitReached ? UPGRADE_HINT : undefined}
          className="ml-auto py-2 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-200 text-primary-800 font-medium rounded-lg transition-colors text-sm"
        >
          Invite member
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Workspaces</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {hasAnyFilter
                    ? "No members match these filters."
                    : "No members yet."}
                </td>
              </tr>
            ) : (
              data.items.map((m) => {
                const isSelf = m.userId === user.id;
                const targetIsOwner = m.role === "owner";
                const canEditRow = !isSelf && (isOwner || !targetIsOwner);
                const baseOptions = isOwner ? ALL_ROLES : NON_OWNER_ROLES;
                const roleOptions = baseOptions.includes(m.role as Role)
                  ? baseOptions
                  : ([m.role as Role, ...baseOptions] as Role[]);
                const isOrgManager = m.role === "owner" || m.role === "admin";

                return (
                  <tr key={m.memberId}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.userName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.userEmail}</td>
                    <td className="px-4 py-3">
                      {m.emailVerified ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Dropdown
                        value={m.role}
                        size="sm"
                        className="w-28"
                        disabled={!canEditRow || updateRole.isPending}
                        options={roleOptions.map((r) => ({
                          value: r,
                          label: r.charAt(0).toUpperCase() + r.slice(1),
                        }))}
                        onChange={(v) =>
                          updateRole.mutate({
                            memberId: m.memberId,
                            role: v as Role,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      {isOrgManager ? (
                        <span className="text-xs text-gray-500 italic">
                          All workspaces
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAccessTarget(m)}
                          className="text-xs text-primary-700 hover:text-primary-900 underline"
                        >
                          {m.workspaceAccess.length} of {workspaces.length}{" "}
                          workspace{workspaces.length === 1 ? "" : "s"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEditRow && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(m)}
                          disabled={removeMember.isPending}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        onPageChange={(p) => updateParam("page", String(p))}
      />

      {(updateRole.error || removeMember.error) && (
        <div className="text-sm text-red-600">
          {updateRole.error?.message ?? removeMember.error?.message}
        </div>
      )}

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={orgId}
      />

      <MemberAccessModal
        open={!!accessTarget}
        onClose={() => setAccessTarget(null)}
        organizationId={orgId}
        member={accessTarget}
        workspaces={workspaces}
      />

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member"
        danger
        confirmLabel="Delete account"
        message={
          <>
            <p>
              This permanently deletes{" "}
              <strong>{removeTarget?.userEmail}</strong>'s account, removing
              them from this organization and revoking access to every
              workspace.
            </p>
            <p className="mt-2 text-xs text-gray-500">This cannot be undone.</p>
          </>
        }
        busy={removeMember.isPending}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return;
          await removeMember.mutateAsync(removeTarget.memberId);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
};
