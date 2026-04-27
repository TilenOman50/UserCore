import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  useCreateScenario,
  useScenariosList,
} from "../../lib/hooks/useScenarios";
import {
  useLinkScenario,
  useUnlinkScenario,
} from "../../lib/hooks/useWorkflows";

type Props = {
  workflowStepId: string;
  workspaceId: string;
  // Map of scenarioId → linkId for currently-linked scenarios.
  linkedScenarioIds: Record<string, string>;
  onClose: () => void;
};

export const LinkScenarioModal = ({
  workflowStepId,
  workspaceId,
  linkedScenarioIds,
  onClose,
}: Props) => {
  const navigate = useNavigate();
  const scenariosQuery = useScenariosList(workspaceId);
  const linkScenario = useLinkScenario();
  const unlinkScenario = useUnlinkScenario();
  const createScenario = useCreateScenario();

  const [search, setSearch] = useState("");
  const [creatingName, setCreatingName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const all = scenariosQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [scenariosQuery.data, search]);

  const handleToggle = async (scenarioId: string) => {
    const linkId = linkedScenarioIds[scenarioId];
    if (linkId) {
      await unlinkScenario.mutateAsync({
        workflowStepId,
        scenarioLinkId: linkId,
      });
    } else {
      await linkScenario.mutateAsync({ workflowStepId, scenarioId });
    }
  };

  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = creatingName.trim();
    if (!trimmed) return;
    const scenario = await createScenario.mutateAsync({
      workspaceId,
      name: trimmed,
    });
    await linkScenario.mutateAsync({
      workflowStepId,
      scenarioId: scenario.id,
    });
    setCreatingName("");
    setShowCreate(false);
    onClose();
    navigate(`/scenarios/${scenario.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Link scenario
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect existing scenarios to this rules-engine step, or create a
              new one.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scenarios…"
              autoFocus
              className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          {showCreate ? (
            <form
              onSubmit={handleCreateAndLink}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                placeholder="Scenario name"
                autoFocus
                className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              />
              <button
                type="submit"
                disabled={
                  createScenario.isPending ||
                  linkScenario.isPending ||
                  !creatingName.trim()
                }
                className="h-9 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 text-primary-800 font-medium rounded-lg text-sm"
              >
                Create & link
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreatingName("");
                }}
                className="h-9 px-3 text-sm text-gray-500 hover:text-gray-900"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:text-primary-900"
            >
              <Plus size={14} />
              Create new scenario
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {scenariosQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading scenarios…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {search.trim()
                ? `No scenarios match "${search}".`
                : "No scenarios in this workspace yet — create one above."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((s) => {
                const linked = !!linkedScenarioIds[s.id];
                return (
                  <div key={s.id} className="flex items-start gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/scenarios/${s.id}`);
                        }}
                        className="text-sm font-medium text-gray-900 hover:text-primary-700 truncate text-left"
                      >
                        {s.name}
                      </button>
                      {s.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                    </div>
                    <Toggle on={linked} onClick={() => handleToggle(s.id)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 ${
      on ? "bg-primary-500" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        on ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
);
