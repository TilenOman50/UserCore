import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Plus,
  Radio,
  Telescope,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  UPGRADE_HINT,
  useCanManageConfig,
  usePlan,
} from "../lib/hooks/usePlan";
import {
  useCreateWorkflow,
  useWorkflowsPaginated,
  type Workflow,
} from "../lib/hooks/useWorkflows";
import { useWorkspace } from "../lib/workspaceContext";

const PAGE_SIZE = 10;

export const WorkflowsPage = () => {
  const navigate = useNavigate();
  const { workspace, organization } = useWorkspace();
  const workspaceId = workspace?.id ?? "";
  const organizationId = organization?.id ?? "";

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useWorkflowsPaginated({
    workspaceId,
    organizationId,
    page,
    limit: PAGE_SIZE,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  const { workflowLimitReached } = usePlan();
  const canEdit = useCanManageConfig();
  const atLimit = workflowLimitReached(total);

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure verification flows for this workspace.
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            onClick={() => canEdit && !atLimit && setCreateOpen(true)}
            disabled={!canEdit || atLimit}
            title={
              !canEdit
                ? "Only owners and admins can create workflows."
                : atLimit
                  ? UPGRADE_HINT
                  : undefined
            }
            className="shrink-0 inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-200 text-primary-800 font-medium rounded-xl text-sm shadow-sm"
          >
            <Plus size={16} />
            New workflow
          </button>
        )}
      </header>

      {query.isLoading ? (
        <div className="text-sm text-gray-500">Loading workflows…</div>
      ) : total === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} canEdit={canEdit} />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Validity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {items.map((w) => (
                  <WorkflowRow
                    key={w.id}
                    workflow={w}
                    onClick={() => navigate(`/workflows/${w.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      {createOpen && (
        <CreateWorkflowModal
          workspaceId={workspaceId}
          organizationId={organizationId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            navigate(`/workflows/${id}`);
          }}
        />
      )}
    </div>
  );
};

const WorkflowRow = ({
  workflow,
  onClick,
}: {
  workflow: Workflow;
  onClick: () => void;
}) => (
  <tr
    onClick={onClick}
    className="cursor-pointer hover:bg-gray-50 transition-colors"
  >
    <td className="px-6 py-4">
      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
        {workflow.displayName}
        {workflow.isDefault && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 font-medium">
            default
          </span>
        )}
      </div>
      <div className="text-xs text-gray-400 font-mono mt-0.5">
        {workflow.id}
      </div>
    </td>
    <td className="px-6 py-4">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          workflow.verificationMode === "sandbox"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {workflow.verificationMode === "sandbox" ? (
          <>
            <FlaskConical size={12} /> Sandbox
          </>
        ) : (
          <>
            <Radio size={12} /> Live
          </>
        )}
      </span>
    </td>
    <td className="px-6 py-4">
      {workflow.valid ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
          <Check size={12} /> Valid
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <AlertTriangle size={12} /> Needs config
        </span>
      )}
    </td>
    <td className="px-6 py-4 text-sm text-gray-500 text-right">
      {new Date(workflow.createdAt).toLocaleDateString()}
    </td>
  </tr>
);

const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (next: number) => void;
}) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
      <div>
        Showing {start}–{end} of {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <span className="px-2 font-medium text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const EmptyState = ({
  onCreate,
  canEdit,
}: {
  onCreate: () => void;
  canEdit: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
    <div className="flex justify-center mb-4 text-primary-600">
      <Telescope size={48} strokeWidth={1.5} />
    </div>
    <h2 className="text-base font-semibold text-gray-900 mb-1">
      {canEdit
        ? "You haven't created any workflows yet"
        : "No workflows in this workspace yet"}
    </h2>
    <p className="text-sm text-gray-500 mb-6">
      {canEdit
        ? "Workflows define the verification flow your customers see when they open the widget."
        : "An owner or admin needs to create the first workflow before customers can be verified."}
    </p>
    <button
      type="button"
      onClick={() => canEdit && onCreate()}
      disabled={!canEdit}
      title={
        !canEdit ? "Only owners and admins can create workflows." : undefined
      }
      className="inline-flex items-center gap-1.5 py-2 px-4 bg-white border border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-700 font-medium rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
    >
      <Plus size={16} />
      Create your first workflow
    </button>
  </div>
);

const CreateWorkflowModal = ({
  workspaceId,
  organizationId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  organizationId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) => {
  const [displayName, setDisplayName] = useState("");
  const create = useCreateWorkflow();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    const workflow = await create.mutateAsync({
      workspaceId,
      organizationId,
      displayName: trimmed,
    });
    onCreated(workflow.id);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900">New workflow</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create a verification workflow for this workspace. You'll add steps
            after it's created.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Standard KYC"
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        {create.error && (
          <p className="text-sm text-red-600">{create.error.message}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending || !displayName.trim()}
            className="py-2 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 text-primary-800 font-medium rounded-xl text-sm"
          >
            {create.isPending ? "Creating…" : "Create workflow"}
          </button>
        </div>
      </form>
    </div>
  );
};
