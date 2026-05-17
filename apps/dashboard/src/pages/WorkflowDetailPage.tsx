import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Home,
  IdCard,
  Mail,
  Phone,
  Play,
  Plus,
  ScanFace,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { LinkScenarioModal } from "../components/scenarios/LinkScenarioModal";
import { SaveIndicator } from "../components/ui/SaveIndicator";
import { TestFlowModal } from "../components/workflows/TestFlowModal";
import {
  UPGRADE_HINT,
  useCanManageConfig,
  usePlan,
} from "../lib/hooks/usePlan";
import { useScenariosList } from "../lib/hooks/useScenarios";
import {
  useAddWorkflowStep,
  useDeleteWorkflow,
  useIdentityVerificationDetail,
  useRemoveWorkflowStep,
  useRulesEngineDetail,
  useSetIdentityProvider,
  useSetStepProvider,
  useToggleSubStep,
  useUnlinkScenario,
  useUpdateWorkflow,
  useWorkflow,
  type IdentityVerificationSubStepType,
  type ProviderShortName,
  type WorkflowStep,
  type WorkflowStepType,
} from "../lib/hooks/useWorkflows";
import { useStartTestSession } from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

type IconComp = ComponentType<{ size?: number; className?: string }>;

const STEP_LABELS: Record<WorkflowStepType, string> = {
  "identity-verification": "Identity verification",
  "aml-screening": "AML screening",
  "fraud-detection": "Fraud detection",
  "duplicate-detection": "Duplicate detection",
  "rules-engine": "Rules engine",
};

const STEP_DESCRIPTIONS: Record<WorkflowStepType, string> = {
  "identity-verification":
    "Document scan, face match, contact information and proof of residence.",
  "aml-screening":
    "Sanctions, PEP and adverse-media screening. Requires a provider.",
  "fraud-detection":
    "IP intelligence and device fingerprinting. Requires a provider.",
  "duplicate-detection":
    "Match the customer against previously verified profiles in this workspace.",
  "rules-engine":
    "Apply scenarios to flag, reject or notify based on captured attributes.",
};

const STEP_ICONS: Record<WorkflowStepType, IconComp> = {
  "identity-verification": IdCard,
  "aml-screening": Shield,
  "fraud-detection": Search,
  "duplicate-detection": Copy,
  "rules-engine": Settings2,
};

const SUB_STEP_LABELS: Record<IdentityVerificationSubStepType, string> = {
  "id-scan": "ID document scan",
  "face-scan": "Face match & liveness",
  "email-verification": "Email verification",
  "contact-information": "Contact information",
  "proof-of-residence": "Proof of residence",
  "terms-acceptance": "Terms & conditions",
};

const SUB_STEP_DESCRIPTIONS: Record<IdentityVerificationSubStepType, string> = {
  "terms-acceptance":
    "Customer agrees to your terms before the verification begins.",
  "email-verification":
    "Send a one-time code to the customer's email and verify ownership.",
  "id-scan":
    "Capture the front and back of a government-issued identity document.",
  "face-scan":
    "Selfie capture with liveness detection, matched against the ID photo.",
  "proof-of-residence":
    "Upload of a recent utility bill or bank statement to confirm address.",
  "contact-information":
    "Collect phone, mailing address, and any extra fields you need.",
};

const SUB_STEP_ICONS: Record<IdentityVerificationSubStepType, IconComp> = {
  "id-scan": IdCard,
  "face-scan": ScanFace,
  "email-verification": Mail,
  "contact-information": Phone,
  "proof-of-residence": Home,
  "terms-acceptance": FileText,
};

// Display order for identity-verification sub-steps. Terms first (locked on),
// then the verification flow as the customer experiences it in the widget.
const SUB_STEP_ORDER: IdentityVerificationSubStepType[] = [
  "terms-acceptance",
  "email-verification",
  "id-scan",
  "face-scan",
  "proof-of-residence",
  "contact-information",
];

const PROVIDER_OPTIONS: Record<
  WorkflowStepType,
  Array<{ value: ProviderShortName; label: string; description: string }>
> = {
  "identity-verification": [
    {
      value: "idenfy",
      label: "iDenfy",
      description: "Document and face verification with automated decisioning.",
    },
  ],
  "aml-screening": [
    {
      value: "complyAdvantage",
      label: "ComplyAdvantage",
      description: "Sanctions, PEP and adverse media screening.",
    },
  ],
  "fraud-detection": [
    {
      value: "ipQualityScore",
      label: "IPQualityScore",
      description: "IP, proxy and fraud-score intelligence.",
    },
  ],
  "duplicate-detection": [],
  "rules-engine": [],
};

const STEP_ORDER: WorkflowStepType[] = [
  "identity-verification",
  "duplicate-detection",
  "aml-screening",
  "fraud-detection",
  "rules-engine",
];

export const WorkflowDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workflowQuery = useWorkflow(id ?? null);
  const addStep = useAddWorkflowStep();
  const removeStep = useRemoveWorkflowStep();
  const update = useUpdateWorkflow();
  const remove = useDeleteWorkflow();
  const canEdit = useCanManageConfig();

  const startTestSession = useStartTestSession();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowQuery.data) return;
    setName(workflowQuery.data.displayName);
    setDescription(workflowQuery.data.description ?? "");
  }, [workflowQuery.data]);

  // Auto-save name + description when they diverge from server. 500ms debounce
  // collapses keystrokes into a single PATCH.
  useEffect(() => {
    const server = workflowQuery.data;
    if (!server) return;
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const dirty =
      (trimmedName.length > 0 && trimmedName !== server.displayName) ||
      trimmedDescription !== (server.description ?? "");
    if (!dirty) return;
    const t = setTimeout(() => {
      update.mutate({
        workflowId: server.id,
        patch: {
          displayName: trimmedName.length > 0 ? trimmedName : undefined,
          description:
            trimmedDescription.length > 0 ? trimmedDescription : null,
        },
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, workflowQuery.data]);

  if (workflowQuery.isLoading || !workflowQuery.data) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-sm text-gray-500">
          {workflowQuery.isLoading
            ? "Loading workflow…"
            : "Workflow not found."}
        </div>
      </div>
    );
  }

  const workflow = workflowQuery.data;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const isDirty =
    (trimmedName.length > 0 && trimmedName !== workflow.displayName) ||
    trimmedDescription !== (workflow.description ?? "");
  const saveStatus = update.isPending
    ? "saving"
    : isDirty
      ? "pending"
      : "saved";

  const stepsByType = new Map<WorkflowStepType, WorkflowStep>(
    workflow.steps.map((s) => [s.type, s]),
  );
  const orderedActiveSteps = STEP_ORDER.filter((t) => stepsByType.has(t));
  const inactiveSteps = STEP_ORDER.filter((t) => !stepsByType.has(t));

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        to="/workflows"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        All workflows
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name"
              disabled={!canEdit}
              className="w-full text-2xl font-bold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:bg-primary-50/30 rounded-none px-1 -ml-1 transition-colors disabled:hover:border-transparent disabled:cursor-not-allowed"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              rows={1}
              disabled={!canEdit}
              className="mt-1 w-full text-sm text-gray-500 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none focus:bg-primary-50/30 px-1 -ml-1 resize-none transition-colors disabled:hover:border-transparent disabled:cursor-not-allowed"
            />
            <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  workflow.status === "ACTIVE"
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {workflow.status.toLowerCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                {workflow.verificationMode}
              </span>
              {workflow.isDefault && (
                <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                  default
                </span>
              )}
              {workflow.valid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                  <Check size={12} /> valid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  <AlertTriangle size={12} /> needs config
                </span>
              )}
              {canEdit && <SaveIndicator status={saveStatus} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-xs text-gray-400 font-mono">{workflow.id}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!workflow.valid || startTestSession.isPending) return;
                  const session = await startTestSession.mutateAsync(
                    workflow.id,
                  );
                  setTestSessionId(session.id);
                }}
                disabled={!workflow.valid || startTestSession.isPending}
                title={
                  !workflow.valid
                    ? "Workflow must be valid to start a test session."
                    : undefined
                }
                className="inline-flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={14} />
                {startTestSession.isPending ? "Starting…" : "Test the flow"}
              </button>
              <button
                type="button"
                onClick={() => canEdit && setDeleteOpen(true)}
                disabled={!canEdit}
                title={
                  !canEdit
                    ? "Only owners and admins can delete workflows."
                    : undefined
                }
                className="text-sm py-1.5 px-3 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {testSessionId && (
        <TestFlowModal
          sessionId={testSessionId}
          onClose={() => setTestSessionId(null)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete workflow"
        danger
        confirmLabel="Delete workflow"
        message={
          <>
            <p>
              You're about to delete <strong>{workflow.displayName}</strong>.
              This cannot be undone.
            </p>
            <p className="mt-2">
              All steps, branding, and any in-flight customer sessions on this
              workflow will be removed.
            </p>
          </>
        }
        busy={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(workflow.id);
          navigate("/workflows");
        }}
        onCancel={() => setDeleteOpen(false)}
      />

      {!workflow.valid && workflow.reasons.length > 0 && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-yellow-600 mt-0.5 shrink-0"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-yellow-900 mb-1">
                Workflow needs configuration
              </div>
              <ul className="space-y-1 text-sm text-yellow-800">
                {workflow.reasons.map((r, i) => (
                  <li key={i}>· {r.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Active steps
          </h3>
          <span className="text-xs text-gray-400">
            {orderedActiveSteps.length} of {STEP_ORDER.length} enabled
          </span>
        </div>

        {orderedActiveSteps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            {canEdit
              ? "No steps yet. Enable a step below to get started."
              : "No steps configured for this workflow."}
          </div>
        ) : (
          <div className="space-y-3">
            {orderedActiveSteps.map((type, i) => (
              <div key={type} className="relative">
                <StepCard
                  type={type}
                  step={stepsByType.get(type)!}
                  canEdit={canEdit}
                  onRemove={() =>
                    removeStep.mutate({
                      workflowStepId: stepsByType.get(type)!.id,
                      type,
                    })
                  }
                />
                {i < orderedActiveSteps.length - 1 && (
                  <div className="absolute left-9 -bottom-3 w-0.5 h-3 bg-gray-200" />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {inactiveSteps.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Add a step
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inactiveSteps.map((type) => {
              const Icon = STEP_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!canEdit}
                  title={
                    !canEdit
                      ? "Only owners and admins can add workflow steps."
                      : undefined
                  }
                  onClick={() =>
                    canEdit &&
                    addStep.mutate({
                      workflowId: workflow.id,
                      type,
                      provider: null,
                    })
                  }
                  className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-700">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {STEP_LABELS[type]}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {STEP_DESCRIPTIONS[type]}
                    </div>
                  </div>
                  <Plus size={18} className="text-primary-600 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const StepCard = ({
  type,
  step,
  canEdit,
  onRemove,
}: {
  type: WorkflowStepType;
  step: WorkflowStep;
  canEdit: boolean;
  onRemove: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = STEP_ICONS[type];
  const hasDetail =
    type === "identity-verification" ||
    type === "aml-screening" ||
    type === "fraud-detection" ||
    type === "rules-engine";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
        className={`w-full flex items-start gap-4 p-5 text-left ${hasDetail ? "hover:bg-gray-50" : ""}`}
      >
        <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {STEP_LABELS[type]}
            </span>
            {step.valid ? (
              <span className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full font-medium">
                <Check size={11} /> valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> needs config
              </span>
            )}
            {step.provider && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {step.provider}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {STEP_DESCRIPTIONS[type]}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canEdit) onRemove();
            }}
            disabled={!canEdit}
            title={
              !canEdit
                ? "Only owners and admins can remove workflow steps."
                : undefined
            }
            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
            aria-label="Remove step"
          >
            <Trash2 size={16} />
          </button>
          {hasDetail && (
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>

      {expanded && type === "identity-verification" && (
        <IdentityVerificationDetail step={step} canEdit={canEdit} />
      )}
      {expanded && (type === "aml-screening" || type === "fraud-detection") && (
        <ProviderSection step={step} type={type} canEdit={canEdit} />
      )}
      {expanded && type === "rules-engine" && (
        <RulesEngineDetail step={step} canEdit={canEdit} />
      )}
    </div>
  );
};

const RulesEngineDetail = ({
  step,
  canEdit,
}: {
  step: WorkflowStep;
  canEdit: boolean;
}) => {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";
  const detail = useRulesEngineDetail(step.id);
  const scenariosQuery = useScenariosList(workspaceId);
  const unlinkScenario = useUnlinkScenario();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Map scenarioId → linkId so the picker knows what's already linked.
  const linkedScenarioIds: Record<string, string> = {};
  for (const link of detail.data?.scenarios ?? []) {
    linkedScenarioIds[link.externalScenarioId] = link.id;
  }

  // Join the link rows with full scenario data so we can show name +
  // description in the editor.
  const linkedScenarios = (detail.data?.scenarios ?? []).map((link) => {
    const scenario = scenariosQuery.data?.find(
      (s) => s.id === link.externalScenarioId,
    );
    return { link, scenario };
  });

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-5">
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Linked scenarios
      </div>

      {detail.isLoading || scenariosQuery.isLoading ? (
        <div className="text-xs text-gray-500">Loading scenarios…</div>
      ) : linkedScenarios.length === 0 ? (
        <div className="text-sm text-gray-500 mb-3">
          No scenarios linked yet — click the button below to attach one.
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {linkedScenarios.map(({ link, scenario }, i) => (
            <div
              key={link.id}
              className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-3"
            >
              <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                {scenario ? (
                  <Link
                    to={`/scenarios/${scenario.id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-primary-700 truncate block"
                  >
                    {scenario.name}
                  </Link>
                ) : (
                  <div className="text-sm font-semibold text-gray-400 italic">
                    Scenario unavailable ({link.externalScenarioId})
                  </div>
                )}
                {scenario?.description && (
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {scenario.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  canEdit &&
                  unlinkScenario.mutate({
                    workflowStepId: step.id,
                    scenarioLinkId: link.id,
                  })
                }
                disabled={!canEdit}
                title={
                  !canEdit
                    ? "Only owners and admins can unlink scenarios."
                    : undefined
                }
                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                aria-label="Unlink scenario"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => canEdit && setPickerOpen(true)}
        disabled={!canEdit}
        title={
          !canEdit ? "Only owners and admins can link scenarios." : undefined
        }
        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-gray-300 bg-white hover:border-primary-400 hover:bg-primary-50 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
      >
        <Plus size={14} />
        Add scenario
      </button>

      {pickerOpen && (
        <LinkScenarioModal
          workflowStepId={step.id}
          workspaceId={workspaceId}
          linkedScenarioIds={linkedScenarioIds}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

const IdentityVerificationDetail = ({
  step,
  canEdit,
}: {
  step: WorkflowStep;
  canEdit: boolean;
}) => {
  const detail = useIdentityVerificationDetail(step.id);
  const setProvider = useSetIdentityProvider();
  const toggleSubStep = useToggleSubStep();
  const providers = PROVIDER_OPTIONS["identity-verification"];
  const { isProviderAllowed } = usePlan();
  const providersAllowed = isProviderAllowed("identity-verification");

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-6">
      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Provider
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ProviderCard
            label="No provider"
            description="Customers upload documents; an officer reviews them in the dashboard."
            selected={step.provider === null}
            icon={Users}
            readOnly={!canEdit}
            onClick={() =>
              canEdit &&
              setProvider.mutate({
                workflowStepId: step.id,
                provider: null,
              })
            }
          />
          {providers.map((p) => (
            <ProviderCard
              key={p.value}
              label={p.label}
              description={
                providersAllowed
                  ? p.description
                  : `${p.description} — Upgrade to Growth to enable.`
              }
              selected={step.provider === p.value}
              locked={!providersAllowed}
              readOnly={!canEdit}
              icon={Eye}
              onClick={() =>
                canEdit &&
                providersAllowed &&
                setProvider.mutate({
                  workflowStepId: step.id,
                  provider: p.value,
                })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Sub-steps
        </div>
        {detail.isLoading ? (
          <div className="text-xs text-gray-500">Loading sub-steps…</div>
        ) : (
          <div className="space-y-2">
            {SUB_STEP_ORDER.map((type) => {
              const sub = detail.data?.subSteps.find((s) => s.type === type);
              if (!sub) return null;
              return (
                <SubStepCard
                  key={sub.id}
                  type={type}
                  enabled={sub.enabled}
                  canEdit={canEdit}
                  onToggle={(enabled) =>
                    toggleSubStep.mutate({ subStepId: sub.id, enabled })
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ProviderSection = ({
  step,
  type,
  canEdit,
}: {
  step: WorkflowStep;
  type: "aml-screening" | "fraud-detection";
  canEdit: boolean;
}) => {
  const setProvider = useSetStepProvider();
  const providers = PROVIDER_OPTIONS[type];
  const { isProviderAllowed } = usePlan();
  const providersAllowed = isProviderAllowed(type);

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-5">
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Provider
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProviderCard
          label="No provider"
          description="Step skipped — needs a provider to run."
          selected={step.provider === null}
          icon={AlertTriangle}
          readOnly={!canEdit}
          onClick={() =>
            canEdit &&
            setProvider.mutate({
              workflowStepId: step.id,
              type,
              provider: null,
            })
          }
        />
        {providers.map((p) => (
          <ProviderCard
            key={p.value}
            label={p.label}
            description={
              providersAllowed
                ? p.description
                : `${p.description} — Upgrade to Growth to enable.`
            }
            selected={step.provider === p.value}
            locked={!providersAllowed}
            readOnly={!canEdit}
            icon={Eye}
            onClick={() =>
              canEdit &&
              providersAllowed &&
              setProvider.mutate({
                workflowStepId: step.id,
                type,
                provider: p.value,
              })
            }
          />
        ))}
      </div>
    </div>
  );
};

const ProviderCard = ({
  label,
  description,
  selected,
  icon: Icon,
  onClick,
  locked = false,
  readOnly = false,
}: {
  label: string;
  description: string;
  selected: boolean;
  icon: IconComp;
  onClick: () => void;
  // Plan-level: provider isn't included in the org's plan. Shows the
  // "Locked" pill and the upgrade hint.
  locked?: boolean;
  // Role-level: the user is a member, so can't change anything. Card stays
  // in its current state (selected stays selected) but isn't clickable.
  readOnly?: boolean;
}) => {
  const disabled = locked || readOnly;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        locked
          ? UPGRADE_HINT
          : readOnly
            ? "Only owners and admins can change providers."
            : undefined
      }
      className={`p-4 rounded-xl border text-left transition-colors ${
        locked
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : selected
            ? `border-primary-400 bg-white ring-2 ring-primary-200 ${readOnly ? "cursor-not-allowed" : ""}`
            : `border-gray-200 bg-white ${readOnly ? "opacity-70 cursor-not-allowed" : "hover:border-primary-300"}`
      }`}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            {label}
            {locked && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                Locked
              </span>
            )}
          </div>
        </div>
        {selected && !locked && (
          <Check size={16} className="text-primary-600 shrink-0" />
        )}
      </div>
      <div className="text-xs text-gray-500">{description}</div>
    </button>
  );
};

const SubStepCard = ({
  type,
  enabled,
  canEdit,
  onToggle,
}: {
  type: IdentityVerificationSubStepType;
  enabled: boolean;
  canEdit: boolean;
  onToggle: (enabled: boolean) => void;
}) => {
  const Icon = SUB_STEP_ICONS[type];
  const required = type === "terms-acceptance";

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border bg-white transition-colors ${
        enabled ? "border-gray-200" : "border-dashed border-gray-200 opacity-75"
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {SUB_STEP_LABELS[type]}
          </span>
          {required && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
              Required
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {SUB_STEP_DESCRIPTIONS[type]}
        </div>
      </div>
      {required ? (
        <span className="text-xs text-gray-400 self-center shrink-0">
          Always on
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit}
          onClick={() => onToggle(!enabled)}
          title={
            !canEdit
              ? "Only owners and admins can change sub-steps."
              : undefined
          }
          className={`relative inline-flex h-5 w-9 shrink-0 self-center items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? "bg-primary-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
};
