import { useEffect, useState } from "react";

import { useRenameWorkspace } from "../../lib/hooks/useWorkspaceMutations";
import { useWorkspace } from "../../lib/workspaceContext";
import { DeleteWorkspaceModal } from "./DeleteWorkspaceModal";

export const WorkspaceTab = () => {
  const { workspace, role, workspaces } = useWorkspace();
  const workspaceId = workspace?.id ?? "";

  const renameWorkspace = useRenameWorkspace();

  const [name, setName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (workspace) setName(workspace.name);
  }, [workspace]);

  if (!workspace) {
    return <div className="text-sm text-gray-500">No active workspace.</div>;
  }

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) return;
    await renameWorkspace.mutateAsync({ workspaceId, name: trimmed });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const isOwner = role === "owner";
  const canEdit = role === "owner" || role === "admin";
  const isLastWorkspace = workspaces.length <= 1;

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Workspace
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {renameWorkspace.error && (
            <div className="mt-4 text-sm text-red-600">
              {renameWorkspace.error.message}
            </div>
          )}

          {canEdit ? (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  renameWorkspace.isPending ||
                  !name.trim() ||
                  name.trim() === workspace.name
                }
                className="py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {renameWorkspace.isPending ? "Saving…" : "Save changes"}
              </button>
              {savedFlash && (
                <span className="text-sm text-green-600">Saved</span>
              )}
            </div>
          ) : (
            <p className="mt-6 text-xs text-gray-500">
              Only owners and admins can edit workspace settings.
            </p>
          )}
        </div>

        {isOwner && (
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-1">
              Danger zone
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {isLastWorkspace
                ? "This is the only workspace in this organization. Create another one before deleting this."
                : "Deleting a workspace removes the workspace and all its associated data. This cannot be undone."}
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isLastWorkspace}
              title={
                isLastWorkspace ? "Create another workspace first" : undefined
              }
              className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete workspace
            </button>
          </div>
        )}
      </div>

      <DeleteWorkspaceModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        workspaceId={workspaceId}
        workspaceName={workspace.name}
      />
    </>
  );
};
