import { useEffect, useState } from "react";

import { DocumentStep } from "./steps/DocumentStep";
import { FormStep } from "./steps/FormStep";
import { IdenfyHandoffStep } from "./steps/IdenfyHandoffStep";
import { LivenessStep } from "./steps/LivenessStep";
import { SuccessStep } from "./steps/SuccessStep";

type WidgetProps = {
  workflowsApiUrl: string;
  providersApiUrl: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  onComplete?: (status: "submitted") => void;
};

type Step = "form" | "document" | "liveness" | "idenfy" | "success";

type WorkflowStep = {
  id: string;
  type: string;
  provider: string | null;
};

type Workflow = {
  id: string;
  steps: WorkflowStep[];
};

type SubStep = {
  id: string;
  type: string;
  enabled: boolean;
};

const apiJson = async <T,>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
};

export const Widget = (props: WidgetProps) => {
  const {
    workflowsApiUrl,
    providersApiUrl,
    workspaceId,
    organizationId,
    customerId,
    onComplete,
  } = props;

  const [bootError, setBootError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [identityProvider, setIdentityProvider] = useState<string | null>(null);
  const [enabledSubSteps, setEnabledSubSteps] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>("form");

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const workflows = await apiJson<Workflow[]>(
          `${workflowsApiUrl}/workflows/workflows/workspace/${encodeURIComponent(workspaceId)}?organizationId=${encodeURIComponent(organizationId)}`,
        );
        const def = workflows[0];
        if (!def) {
          throw new Error("No workflow configured for this workspace");
        }
        const wf = await apiJson<Workflow>(
          `${workflowsApiUrl}/workflows/workflows/${encodeURIComponent(def.id)}`,
        );
        if (cancelled) return;
        setWorkflow(wf);

        const ivStep = wf.steps.find((s) => s.type === "identity-verification");
        setIdentityProvider(ivStep?.provider ?? null);

        if (ivStep) {
          const detail = await apiJson<{ subSteps: SubStep[] }>(
            `${workflowsApiUrl}/workflows/workflow-steps/${encodeURIComponent(ivStep.id)}/identity-verification`,
          );
          if (cancelled) return;
          setEnabledSubSteps(
            new Set(detail.subSteps.filter((s) => s.enabled).map((s) => s.type)),
          );
        }

        const session = await apiJson<{ id: string }>(
          `${workflowsApiUrl}/workflows/workflow-sessions`,
          {
            method: "POST",
            body: JSON.stringify({
              externalSessionId: crypto.randomUUID(),
              externalSessionSource: "widget",
              workflowId: wf.id,
              customerId,
            }),
          },
        );
        if (cancelled) return;
        setSessionId(session.id);

        if (ivStep?.provider === "idenfy") {
          setStep("idenfy");
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : "Failed to start");
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [workflowsApiUrl, workspaceId, organizationId, customerId]);

  const submitForReview = async () => {
    if (!sessionId) return;
    try {
      await apiJson(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/steps`,
        {
          method: "POST",
          body: JSON.stringify({
            step: "identity-verification",
            status: "REQUIRES_REVIEW",
          }),
        },
      );
      setStep("success");
      onComplete?.("submitted");
    } catch (err) {
      setBootError(err instanceof Error ? err.message : "Submit failed");
    }
  };

  const advanceFromForm = () => {
    if (enabledSubSteps.has("id-scan")) setStep("document");
    else if (enabledSubSteps.has("face-scan")) setStep("liveness");
    else void submitForReview();
  };
  const advanceFromDocument = () => {
    if (enabledSubSteps.has("face-scan")) setStep("liveness");
    else void submitForReview();
  };
  const advanceFromLiveness = () => {
    void submitForReview();
  };

  if (bootError) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg p-6">
        <p className="text-sm text-red-600">{bootError}</p>
      </div>
    );
  }

  if (!workflow || !sessionId) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg p-6">
        <p className="text-sm text-gray-500">Loading verification…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg">
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary-200 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-700">UC</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">
            UserCore Verification
          </span>
        </div>
      </div>

      <div className="px-8 py-6">
        {step === "form" && enabledSubSteps.has("contact-information") && (
          <FormStep
            workflowsApiUrl={workflowsApiUrl}
            sessionId={sessionId}
            onComplete={advanceFromForm}
          />
        )}
        {step === "form" && !enabledSubSteps.has("contact-information") && (
          <SkipStep onContinue={advanceFromForm} />
        )}
        {step === "document" && (
          <DocumentStep
            workflowsApiUrl={workflowsApiUrl}
            sessionId={sessionId}
            onComplete={advanceFromDocument}
          />
        )}
        {step === "liveness" && (
          <LivenessStep
            workflowsApiUrl={workflowsApiUrl}
            sessionId={sessionId}
            onComplete={advanceFromLiveness}
          />
        )}
        {step === "idenfy" && identityProvider === "idenfy" && (
          <IdenfyHandoffStep
            providersApiUrl={providersApiUrl}
            workflowSessionId={sessionId}
            customerId={customerId}
          />
        )}
        {step === "success" && <SuccessStep />}
      </div>
    </div>
  );
};

const SkipStep = ({ onContinue }: { onContinue: () => void }) => (
  <div className="space-y-4">
    <p className="text-sm text-gray-600">
      Contact information not required. Continue to the next step.
    </p>
    <button
      type="button"
      onClick={onContinue}
      className="w-full py-2.5 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm"
    >
      Continue
    </button>
  </div>
);
