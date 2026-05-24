import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "../../lib/authClient";
import { useWorkspace } from "../../lib/workspaceContext";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";

export const ProfilePage = () => {
  const { user, organization } = useWorkspace();
  const qc = useQueryClient();

  const [name, setName] = useState(user.name);
  const [savedFlash, setSavedFlash] = useState(false);

  const updateName = useMutation({
    mutationFn: async (newName: string) => {
      const res = await authClient.updateUser({ name: newName });
      if (res.error) {
        throw new Error(res.error.message ?? "Could not update your profile");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
  });

  const trimmed = name.trim();
  const dirty = trimmed !== "" && trimmed !== user.name;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your personal account details.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-200 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-primary-700">
              {initialsOf(user.name)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 truncate">
              {user.name}
            </div>
            <div className="text-sm text-gray-500 truncate">{user.email}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">
            Your email is used to sign in and can&apos;t be changed here.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization
          </label>
          <input
            type="text"
            value={organization.name}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm"
          />
        </div>

        {updateName.error && (
          <div className="text-sm text-red-600">{updateName.error.message}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => updateName.mutate(trimmed)}
            disabled={!dirty || updateName.isPending}
            className="py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            {updateName.isPending ? "Saving…" : "Save changes"}
          </button>
          {savedFlash && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </div>
    </div>
  );
};
