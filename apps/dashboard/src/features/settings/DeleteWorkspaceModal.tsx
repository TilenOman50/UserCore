import { useState } from "react";

import { useDeleteWorkspace } from "../../lib/hooks/useWorkspaceMutations";

export const DeleteWorkspaceModal = (props: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}) => {
  const { open, onClose, workspaceId, workspaceName } = props;
  const [confirmation, setConfirmation] = useState("");
  const deleteWorkspace = useDeleteWorkspace();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation !== workspaceName) return;
    try {
      await deleteWorkspace.mutateAsync(workspaceId);
      onClose();
    } catch {
      // Error displayed below
    }
  };

  const handleClose = () => {
    deleteWorkspace.reset();
    setConfirmation("");
    onClose();
  };

  const matches = confirmation === workspaceName;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-red-700 mb-1">
          Delete workspace
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This permanently deletes the <strong>{workspaceName}</strong>{" "}
          workspace, all its members, and all associated data. This cannot be
          undone.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-mono">{workspaceName}</span> to confirm
            </label>
            <input
              type="text"
              autoFocus
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 text-sm"
            />
          </div>

          {deleteWorkspace.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {deleteWorkspace.error.message}
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
              disabled={!matches || deleteWorkspace.isPending}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
            >
              {deleteWorkspace.isPending
                ? "Deleting…"
                : "Delete workspace forever"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
