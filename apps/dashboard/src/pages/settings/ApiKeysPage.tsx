import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { formatDate } from "../../lib/dates";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKey,
} from "../../lib/hooks/useApiKeys";
import { useWorkspace } from "../../lib/workspaceContext";

const fmtDate = formatDate;

export const ApiKeysPage = () => {
  const { workspace, organization, user, role } = useWorkspace();
  const canManage = role === "owner" || role === "admin";
  const workspaceId = workspace?.id ?? null;

  const keysQuery = useApiKeys(workspaceId);
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const keys = keysQuery.data ?? [];

  const handleGenerate = async () => {
    if (!workspaceId || !name.trim()) return;
    const created = await createKey.mutateAsync({
      workspaceId,
      organizationId: organization.id,
      name: name.trim(),
      createdBy: user.id,
    });
    setGenerateOpen(false);
    setName("");
    setSecret(created.secret);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !workspaceId) return;
    await revokeKey.mutateAsync({ id: revokeTarget.id, workspaceId });
    setRevokeTarget(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Secret keys that authenticate your backend when it creates
            verification sessions via the API.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setName("");
              setGenerateOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm"
          >
            <Plus size={16} /> Generate key
          </button>
        )}
      </div>

      {!canManage ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Only owners and admins can manage API keys.
        </div>
      ) : keysQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="mb-3 flex justify-center text-primary-600">
            <KeyRound size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            No API keys yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Generate a key to let your backend create verification sessions
            programmatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Last used</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {k.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {k.keyPrefix}
                    {"•".repeat(8)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {k.lastUsedAt ? fmtDate(k.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {fmtDate(k.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(k)}
                      title="Revoke key"
                      className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Name the key, then generate */}
      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate API key"
        subtitle="Give the key a name so you can recognize it later."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerateOpen(false)}
              className="py-2 px-4 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!name.trim() || createKey.isPending}
              className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm disabled:opacity-50"
            >
              {createKey.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Generate
            </button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Key name
        </label>
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production backend"
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        {createKey.error && (
          <p className="mt-2 text-sm text-red-600">{createKey.error.message}</p>
        )}
      </Modal>

      {/* Show the raw secret exactly once */}
      <Modal
        open={!!secret}
        onClose={() => setSecret(null)}
        title="Copy your API key"
        subtitle="This is the only time the full key is shown. Store it somewhere safe."
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <code className="flex-1 break-all font-mono text-sm text-gray-800">
            {secret}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy"
            className="inline-flex shrink-0 items-center gap-1.5 py-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-600" /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Send it as <span className="font-mono">Authorization: Bearer …</span>{" "}
          when creating a verification session from your backend.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API key"
        danger
        message={
          <>
            Revoke <span className="font-medium">{revokeTarget?.name}</span>?
            Any integration using it will stop working immediately. This cannot
            be undone.
          </>
        }
        confirmLabel="Revoke"
        busy={revokeKey.isPending}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
};
