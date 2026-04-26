import { useState } from "react";

import { useCreateWorkspace } from "../../lib/hooks/useWorkspaceMutations";

export const NewWorkspaceModal = (props: {
  open: boolean;
  onClose: () => void;
}) => {
  const { open, onClose } = props;
  const [name, setName] = useState("");
  const createWorkspace = useCreateWorkspace();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWorkspace.mutateAsync(name);
      setName("");
      onClose();
    } catch {
      // Error displayed below
    }
  };

  const handleClose = () => {
    createWorkspace.reset();
    setName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Create a new workspace
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          You'll be the owner. Once created, you can invite members and
          configure settings.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workspace name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Compliance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
            />
          </div>

          {createWorkspace.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {createWorkspace.error.message}
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
              disabled={createWorkspace.isPending || !name.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary-200 hover:bg-primary-300 text-primary-800 rounded-lg disabled:opacity-50"
            >
              {createWorkspace.isPending ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
