import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  UPGRADE_HINT,
  useCanManageConfig,
  usePlan,
} from "../lib/hooks/usePlan";
import {
  useCreateScenario,
  useScenarioLinks,
  useScenariosList,
  type Scenario,
  type ScenarioLinkMap,
} from "../lib/hooks/useScenarios";
import { useWorkspace } from "../lib/workspaceContext";

const PAGE_SIZE = 10;

export const ScenariosPage = () => {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";

  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useScenariosList(workspaceId);
  const linksQuery = useScenarioLinks(workspaceId);
  const linkMap: ScenarioLinkMap = linksQuery.data ?? {};

  const all = useMemo(() => query.data ?? [], [query.data]);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { scenarioLimitReached, features } = usePlan();
  const canEdit = useCanManageConfig();
  const atLimit = scenarioLimitReached(total);
  const scenariosDisabled = features.maxScenarios === 0;

  const items = useMemo(
    () => all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [all, page],
  );

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scenarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define rules that match against captured customer attributes and
            trigger automated actions.
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            onClick={() => canEdit && !atLimit && setCreateOpen(true)}
            disabled={!canEdit || atLimit}
            title={
              !canEdit
                ? "Only owners and admins can create scenarios."
                : atLimit
                  ? UPGRADE_HINT
                  : undefined
            }
            className="shrink-0 inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-200 text-primary-800 font-medium rounded-xl text-sm shadow-sm"
          >
            <Plus size={16} />
            New scenario
          </button>
        )}
      </header>

      {query.isLoading ? (
        <div className="text-sm text-gray-500">Loading scenarios…</div>
      ) : total === 0 ? (
        <EmptyState
          onCreate={() => setCreateOpen(true)}
          locked={scenariosDisabled}
          canEdit={canEdit}
        />
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
                    Linked workflows
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {items.map((s) => (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    linkCount={(linkMap[s.id] ?? []).length}
                    onClick={() => navigate(`/scenarios/${s.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <div>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {createOpen && (
        <CreateScenarioModal
          workspaceId={workspaceId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            navigate(`/scenarios/${id}`);
          }}
        />
      )}
    </div>
  );
};

const ScenarioRow = ({
  scenario,
  linkCount,
  onClick,
}: {
  scenario: Scenario;
  linkCount: number;
  onClick: () => void;
}) => {
  const linked = linkCount > 0;
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900">{scenario.name}</div>
        {scenario.description && (
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {scenario.description}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            linked
              ? "bg-primary-100 text-primary-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {linked
            ? `Linked to ${linkCount} workflow${linkCount === 1 ? "" : "s"}`
            : "Unlinked"}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 text-right">
        {new Date(scenario.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
};

const EmptyState = ({
  onCreate,
  locked,
  canEdit,
}: {
  onCreate: () => void;
  locked: boolean;
  canEdit: boolean;
}) => {
  const disabled = locked || !canEdit;
  const heading = locked
    ? "Scenarios aren't available on your plan"
    : !canEdit
      ? "No scenarios in this workspace yet"
      : "No scenarios yet";
  const body = locked
    ? "Upgrade to Growth or Enterprise to enable the rules engine. Contact sales to upgrade."
    : !canEdit
      ? "An owner or admin needs to create scenarios before they can run."
      : "Scenarios let you flag, notify or auto-reject customers based on captured attributes.";
  const tooltip = locked
    ? UPGRADE_HINT
    : !canEdit
      ? "Only owners and admins can create scenarios."
      : undefined;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="flex justify-center mb-4 text-primary-600">
        <Workflow size={48} strokeWidth={1.5} />
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">{heading}</h2>
      <p className="text-sm text-gray-500 mb-6">{body}</p>
      <button
        type="button"
        onClick={() => !disabled && onCreate()}
        disabled={disabled}
        title={tooltip}
        className="inline-flex items-center gap-1.5 py-2 px-4 bg-white border border-gray-300 hover:border-primary-400 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white text-gray-700 font-medium rounded-xl text-sm"
      >
        <Plus size={16} />
        Create your first scenario
      </button>
    </div>
  );
};

const CreateScenarioModal = ({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateScenario();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const scenario = await create.mutateAsync({
      workspaceId,
      name: trimmed,
      description: description.trim() || undefined,
    });
    onCreated(scenario.id);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900">New scenario</h2>
          <p className="text-sm text-gray-500 mt-1">
            Give your scenario a name. You'll add rules and actions on the next
            screen.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. High-risk country flag"
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this scenario do?"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
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
            disabled={create.isPending || !name.trim()}
            className="py-2 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 text-primary-800 font-medium rounded-xl text-sm"
          >
            {create.isPending ? "Creating…" : "Create scenario"}
          </button>
        </div>
      </form>
    </div>
  );
};
