import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  ChevronDown,
  Copy,
  FileText,
  FlaskConical,
  Hand,
  Home,
  IdCard,
  Mail,
  Phone,
  Play,
  Plus,
  Radio,
  ScanFace,
  Search,
  Settings2,
  Shield,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type {
  ContactInfoConfig,
  IdScanConfig,
  ProofOfResidenceConfig,
  TermsAcceptanceConfig,
} from "@usercore/shared-types";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { LinkScenarioModal } from "../components/scenarios/LinkScenarioModal";
import { SaveIndicator } from "../components/ui/SaveIndicator";
import { BrandingSection } from "../components/workflows/BrandingSection";
import { ProviderChooserModal } from "../components/workflows/ProviderChooserModal";
import {
  ContactInfoConfigEditor,
  IdScanConfigEditor,
  ProofOfResidenceConfigEditor,
  TermsAcceptanceConfigEditor,
} from "../components/workflows/SubStepConfigEditors";
import { TestFlowModal } from "../components/workflows/TestFlowModal";
import { WorkflowProviderCard } from "../components/workflows/WorkflowProviderCard";
import { COUNTRIES as COUNTRY_LIST } from "../lib/countries";
import { useCanManageConfig, usePlan } from "../lib/hooks/usePlan";
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
import { PROVIDER_META } from "../lib/providerMeta";
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
    "Terms acceptance, email verification, document scan, liveness face scan, proof of residence and contact details.",
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
  const [testFlow, setTestFlow] = useState<{
    sessionId: string;
  } | null>(null);

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
              {workflow.isDefault && (
                <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                  default
                </span>
              )}
              {workflow.valid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
                  <Check size={12} /> Valid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  <AlertTriangle size={12} /> Needs config
                </span>
              )}
              {workflow.verificationMode === "sandbox" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  <FlaskConical size={12} /> Sandbox
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  <Radio size={12} /> Live
                </span>
              )}
              {canEdit && <SaveIndicator status={saveStatus} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-xs text-gray-400 font-mono">{workflow.id}</div>
            <div className="flex items-center gap-2">
              {(() => {
                const isLive = workflow.verificationMode === "production";
                const disabled = !canEdit || update.isPending;
                const title = !canEdit
                  ? "Only owners and admins can change workflow mode."
                  : isLive
                    ? "Turn off to go back to Sandbox — provider calls are mocked."
                    : "Turn on to go Live — real provider APIs will be called.";
                return (
                  <div className="flex items-center gap-2" title={title}>
                    <span className="text-sm text-gray-500">Live mode</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isLive}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        update.mutate({
                          workflowId: workflow.id,
                          patch: {
                            verificationMode: isLive ? "sandbox" : "production",
                          },
                        });
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isLive ? "bg-primary-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isLive ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={async () => {
                  if (!workflow.valid || startTestSession.isPending) return;
                  const session = await startTestSession.mutateAsync(
                    workflow.id,
                  );
                  setTestFlow({ sessionId: session.id });
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

      {testFlow && (
        <TestFlowModal
          sessionId={testFlow.sessionId}
          onClose={() => setTestFlow(null)}
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

      <BrandingSection
        workflowId={workflow.id}
        branding={workflow.branding ?? {}}
        canEdit={canEdit}
      />

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
      <div
        // Outer row is a plain div so the inner Trash button receives clicks
        // even on steps with no expandable detail (e.g. duplicate-detection,
        // which used to disable the whole outer <button> and swallow the
        // remove click).
        className={`w-full flex items-start gap-4 p-5 text-left ${
          hasDetail ? "cursor-pointer hover:bg-gray-50" : ""
        }`}
        onClick={() => hasDetail && setExpanded((v) => !v)}
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
                <Check size={11} /> Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> Needs config
              </span>
            )}
            {step.provider && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full font-medium">
                {PROVIDER_META[step.provider]?.name ?? step.provider}
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
      </div>

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
  const [chooserOpen, setChooserOpen] = useState(false);

  const provider = providers[0]?.value ?? null;

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-6">
      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Provider
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <WorkflowProviderCard
            variant="no-provider"
            label="No provider"
            description="Customers go through UserCore's in-house flow (terms, email OTP, doc scan, liveness). Officers review submissions in the dashboard."
            selected={step.provider === null}
            icon={Hand}
            readOnly={!canEdit}
            onClick={() =>
              canEdit &&
              setProvider.mutate({
                workflowStepId: step.id,
                provider: null,
              })
            }
          />
          {provider && (
            <WorkflowProviderCard
              variant="provider"
              provider={provider}
              selected={step.provider === provider}
              locked={!providersAllowed}
              readOnly={!canEdit}
              mode={step.providerCredentialMode}
              onClick={() => {
                if (!canEdit || !providersAllowed) return;
                setChooserOpen(true);
              }}
            />
          )}
        </div>

        {provider && (
          <ProviderChooserModal
            open={chooserOpen}
            onClose={() => setChooserOpen(false)}
            provider={provider}
            stepLabel={STEP_LABELS["identity-verification"]}
            isConnected={step.provider === provider}
            currentMode={step.providerCredentialMode}
            canEdit={canEdit}
            onConfirm={(mode) =>
              setProvider.mutate({
                workflowStepId: step.id,
                provider,
                providerCredentialMode: mode,
              })
            }
          />
        )}
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
                  subStepId={sub.id}
                  type={type}
                  enabled={sub.enabled}
                  providerConfig={sub.providerConfig}
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
  const [chooserOpen, setChooserOpen] = useState(false);

  // One provider option per non-identity step type today, so this is always
  // the same shortName as PROVIDER_OPTIONS[type][0]. Kept flexible in case
  // a step type grows to multiple options.
  const provider = providers[0]?.value ?? null;

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-5">
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Provider
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WorkflowProviderCard
          variant="no-provider"
          label="No provider"
          description="Step skipped — UserCore won't run an automated check for this step."
          selected={step.provider === null}
          icon={Ban}
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
        {provider && (
          <WorkflowProviderCard
            variant="provider"
            provider={provider}
            selected={step.provider === provider}
            locked={!providersAllowed}
            readOnly={!canEdit}
            mode={step.providerCredentialMode}
            onClick={() => {
              if (!canEdit || !providersAllowed) return;
              setChooserOpen(true);
            }}
          />
        )}
      </div>

      {provider && (
        <ProviderChooserModal
          open={chooserOpen}
          onClose={() => setChooserOpen(false)}
          provider={provider}
          stepLabel={STEP_LABELS[type]}
          isConnected={step.provider === provider}
          currentMode={step.providerCredentialMode}
          canEdit={canEdit}
          onConfirm={(mode) =>
            setProvider.mutate({
              workflowStepId: step.id,
              type,
              provider,
              providerCredentialMode: mode,
            })
          }
        />
      )}
    </div>
  );
};

// Which sub-step types expose configurable settings. Email + face-scan are
// intentionally excluded — they have nothing meaningful to tune from here.
const CONFIGURABLE_SUB_STEPS = new Set<IdentityVerificationSubStepType>([
  "id-scan",
  "contact-information",
  "proof-of-residence",
  "terms-acceptance",
]);

const SubStepCard = ({
  subStepId,
  type,
  enabled,
  providerConfig,
  canEdit,
  onToggle,
}: {
  subStepId: string;
  type: IdentityVerificationSubStepType;
  enabled: boolean;
  providerConfig: unknown;
  canEdit: boolean;
  onToggle: (enabled: boolean) => void;
}) => {
  const Icon = SUB_STEP_ICONS[type];
  const required = type === "terms-acceptance";
  const configurable = CONFIGURABLE_SUB_STEPS.has(type);
  const [expanded, setExpanded] = useState(false);

  // Only let the user expand when the substep is on (or always, for terms,
  // which is permanently on). A disabled substep has no meaningful settings.
  const canExpand = configurable && (enabled || required);

  return (
    <div
      className={`rounded-xl border bg-white transition-colors ${
        enabled ? "border-gray-200" : "border-dashed border-gray-200 opacity-75"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {SUB_STEP_LABELS[type]}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {SUB_STEP_DESCRIPTIONS[type]}
          </div>
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700 self-center p-1 rounded-md hover:bg-gray-50"
            aria-label={expanded ? "Hide settings" : "Show settings"}
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
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

      {canExpand && expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/50">
          <SubStepConfigBody
            subStepId={subStepId}
            type={type}
            providerConfig={providerConfig}
            canEdit={canEdit}
          />
        </div>
      )}
    </div>
  );
};

const SubStepConfigBody = ({
  subStepId,
  type,
  providerConfig,
  canEdit,
}: {
  subStepId: string;
  type: IdentityVerificationSubStepType;
  providerConfig: unknown;
  canEdit: boolean;
}) => {
  // The substep stores providerConfig as `unknown` JSON. Each editor narrows
  // to its own shape; missing/invalid fields fall back to defaults.
  const config = (providerConfig ?? {}) as Record<string, unknown>;

  if (type === "id-scan") {
    return (
      <IdScanConfigEditor
        subStepId={subStepId}
        config={config as IdScanConfig}
        canEdit={canEdit}
        countries={COUNTRY_LIST}
      />
    );
  }
  if (type === "contact-information") {
    return (
      <ContactInfoConfigEditor
        subStepId={subStepId}
        config={config as ContactInfoConfig}
        canEdit={canEdit}
      />
    );
  }
  if (type === "proof-of-residence") {
    return (
      <ProofOfResidenceConfigEditor
        subStepId={subStepId}
        config={config as ProofOfResidenceConfig}
        canEdit={canEdit}
      />
    );
  }
  if (type === "terms-acceptance") {
    return (
      <TermsAcceptanceConfigEditor
        subStepId={subStepId}
        config={config as TermsAcceptanceConfig}
        canEdit={canEdit}
      />
    );
  }
  return null;
};
