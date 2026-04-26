import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { apiFetch, AUTH_API_URL } from "../../lib/api";
import type { WorkspaceListItem } from "../../lib/workspaceContext";

export const MemberAccessModal = (props: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  member: {
    userId: string;
    userName: string;
    userEmail: string;
    workspaceAccess: string[];
  } | null;
  workspaces: WorkspaceListItem[];
}) => {
  const { open, onClose, organizationId, member, workspaces } = props;
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && member) {
      setSelected(new Set(member.workspaceAccess));
      setError(null);
    }
  }, [open, member]);

  if (!open || !member) return null;

  const toggle = (workspaceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const initial = new Set(member.workspaceAccess);
      const toGrant = [...selected].filter((id) => !initial.has(id));
      const toRevoke = [...initial].filter((id) => !selected.has(id));

      for (const wsId of toGrant) {
        await apiFetch<{ id: string }>(
          `${AUTH_API_URL}/auth/workspaces/${encodeURIComponent(wsId)}/access`,
          {
            method: "POST",
            body: JSON.stringify({ userId: member.userId }),
          },
        );
      }
      for (const wsId of toRevoke) {
        await apiFetch<void>(
          `${AUTH_API_URL}/auth/workspaces/${encodeURIComponent(wsId)}/access/${encodeURIComponent(member.userId)}`,
          { method: "DELETE" },
        );
      }

      queryClient.invalidateQueries({ queryKey: ["members", organizationId] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Workspace access
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Pick which workspaces <strong>{member.userName}</strong> (
          {member.userEmail}) can see.
        </p>

        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {workspaces.map((w) => (
            <label
              key={w.id}
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer border-gray-200 hover:border-gray-300"
            >
              <input
                type="checkbox"
                checked={selected.has(w.id)}
                onChange={() => toggle(w.id)}
                className="w-4 h-4"
              />
              <div className="text-sm font-medium text-gray-900">{w.name}</div>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary-200 hover:bg-primary-300 text-primary-800 rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
