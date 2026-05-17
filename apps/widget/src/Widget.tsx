import { useEffect, useMemo, useState } from "react";

import { ContactStep } from "./steps/ContactStep";
import { DocumentStep } from "./steps/DocumentStep";
import { EmailStep } from "./steps/EmailStep";
import { HandedOffScreen } from "./steps/HandedOffScreen";
import { IdenfyHandoffStep } from "./steps/IdenfyHandoffStep";
import { LivenessStep } from "./steps/LivenessStep";
import { OverviewScreen } from "./steps/OverviewScreen";
import { ProofOfResidenceStep } from "./steps/ProofOfResidenceStep";
import { SuccessStep } from "./steps/SuccessStep";
import { TermsStep } from "./steps/TermsStep";

const requestClose = () => {
  window.parent?.postMessage({ type: "usercore.widget.close" }, "*");
};

type WidgetProps = {
  workflowsApiUrl: string;
  providersApiUrl: string;
  sessionId: string;
  // Full URL a phone should open to continue the same session. When provided,
  // the widget's overview screen offers a "Continue on phone" QR handoff.
  mobileUrl?: string | null;
  // True when this widget instance was opened via the QR-encoded handoff URL.
  // It writes a marker attribute so the desktop widget can detect the
  // takeover and lock itself.
  isHandoff?: boolean;
  onComplete?: (status: "submitted") => void;
};

const HANDOFF_MARKER_ATTRIBUTE = "_session.handoff_device";

export type SubStepType =
  | "terms-acceptance"
  | "email-verification"
  | "id-scan"
  | "face-scan"
  | "proof-of-residence"
  | "contact-information";

const SUB_STEP_ORDER: SubStepType[] = [
  "terms-acceptance",
  "email-verification",
  "id-scan",
  "face-scan",
  "proof-of-residence",
  "contact-information",
];

// Attribute (or attribute prefix) that signals each substep has been
// completed. Used to derive progress for the overview screen and to skip
// past anything already done when the session resumes on a different device.
const COMPLETION_KEYS: Record<SubStepType, string> = {
  "terms-acceptance": "terms_acceptance.accepted",
  "email-verification": "email_verification.email",
  "id-scan": "identity_verification.document_front_s3_key",
  "face-scan": "identity_verification.liveness_passed",
  "proof-of-residence": "identity_verification.proof_of_residence_s3_key",
  "contact-information": "contact_information.",
};

type Session = {
  id: string;
  workflowId: string;
  customerId: string;
};

type Attribute = {
  attribute: string;
  value: string;
};

type WorkflowStep = {
  id: string;
  type: string;
  provider: string | null;
};

type WorkflowDetail = {
  id: string;
  steps: WorkflowStep[];
};

type SubStep = {
  id: string;
  type: SubStepType;
  enabled: boolean;
};

const apiJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
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

// We always come back to the overview between sub-steps so the user can see
// what they've finished, what's left, and optionally hand off to a phone.
type Phase = "overview" | "step" | "done" | "handed-off";

export const Widget = (props: WidgetProps) => {
  const {
    workflowsApiUrl,
    providersApiUrl,
    sessionId,
    mobileUrl,
    isHandoff,
    onComplete,
  } = props;

  const [bootError, setBootError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [identityProvider, setIdentityProvider] = useState<string | null>(null);
  const [enabledSubSteps, setEnabledSubSteps] = useState<Set<SubStepType>>(
    new Set(),
  );
  const [completedSubSteps, setCompletedSubSteps] = useState<Set<SubStepType>>(
    new Set(),
  );
  const [phase, setPhase] = useState<Phase>("overview");
  const [stepType, setStepType] = useState<SubStepType | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const sessionDetail = await apiJson<{
          session: Session;
          attributes: Attribute[];
        }>(
          `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}`,
        );
        if (cancelled) return;
        setSession(sessionDetail.session);

        const wf = await apiJson<WorkflowDetail>(
          `${workflowsApiUrl}/workflows/workflows/${encodeURIComponent(sessionDetail.session.workflowId)}`,
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
            new Set(
              detail.subSteps.filter((s) => s.enabled).map((s) => s.type),
            ),
          );
        }

        const completed = new Set<SubStepType>();
        for (const sub of SUB_STEP_ORDER) {
          const key = COMPLETION_KEYS[sub];
          const hasIt = sessionDetail.attributes.some((a) =>
            key.endsWith(".")
              ? a.attribute.startsWith(key)
              : a.attribute === key,
          );
          if (hasIt) completed.add(sub);
        }
        setCompletedSubSteps(completed);
        setBooted(true);
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
  }, [workflowsApiUrl, sessionId]);

  // Phone-side: once the widget loads via QR, mark the session so the
  // desktop widget knows control has moved. Best-effort, fail silent.
  useEffect(() => {
    if (!isHandoff) return;
    void fetch(
      `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: [
            {
              attribute: HANDOFF_MARKER_ATTRIBUTE,
              value: `mobile_${Date.now()}`,
              attributeType: "STRING",
            },
          ],
        }),
      },
    ).catch(() => undefined);
  }, [isHandoff, workflowsApiUrl, sessionId]);

  // Desktop-side: poll the session so we can (a) lock the UI once the phone
  // picks up the session and (b) reflect substep progress completed on the
  // phone. Only relevant when we have a mobileUrl — i.e., we're the iframe
  // hosted by the dashboard.
  useEffect(() => {
    if (!mobileUrl) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const detail = await apiJson<{ attributes: Attribute[] }>(
          `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}`,
        );
        if (cancelled) return;

        const hasHandoff = detail.attributes.some(
          (a) => a.attribute === HANDOFF_MARKER_ATTRIBUTE,
        );
        if (hasHandoff) setPhase("handed-off");

        const completed = new Set<SubStepType>();
        for (const sub of SUB_STEP_ORDER) {
          const key = COMPLETION_KEYS[sub];
          const hasIt = detail.attributes.some((a) =>
            key.endsWith(".")
              ? a.attribute.startsWith(key)
              : a.attribute === key,
          );
          if (hasIt) completed.add(sub);
        }
        setCompletedSubSteps((prev) => {
          if (
            prev.size === completed.size &&
            [...completed].every((c) => prev.has(c))
          ) {
            return prev;
          }
          return completed;
        });
      } catch {
        // swallow — next tick will retry
      }
    };
    const interval = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mobileUrl, workflowsApiUrl, sessionId]);

  const orderedSteps = useMemo(
    () => SUB_STEP_ORDER.filter((t) => enabledSubSteps.has(t)),
    [enabledSubSteps],
  );

  const nextPendingType = useMemo(
    () => orderedSteps.find((t) => !completedSubSteps.has(t)) ?? null,
    [orderedSteps, completedSubSteps],
  );

  const finalize = async () => {
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
      window.parent?.postMessage(
        { type: "usercore.widget.complete", sessionId },
        "*",
      );
      setPhase("done");
      onComplete?.("submitted");
    } catch (err) {
      setBootError(err instanceof Error ? err.message : "Submit failed");
    }
  };

  const onOverviewContinue = () => {
    if (!nextPendingType) {
      void finalize();
      return;
    }
    setStepType(nextPendingType);
    setPhase("step");
  };

  // Called by each sub-step component when it finishes successfully. We mark
  // the step done and bounce back to the overview so the user sees the
  // updated checkmark before deciding to continue.
  const onStepComplete = () => {
    if (stepType) {
      setCompletedSubSteps((prev) => new Set(prev).add(stepType));
    }
    setStepType(null);
    setPhase("overview");
  };

  if (bootError) {
    return (
      <Shell>
        <p className="text-sm text-red-600">{bootError}</p>
      </Shell>
    );
  }

  if (!booted || !session || !workflow) {
    return (
      <Shell>
        <p className="text-sm text-gray-500">Loading verification…</p>
      </Shell>
    );
  }

  if (identityProvider === "idenfy") {
    return (
      <Shell>
        <IdenfyHandoffStep
          providersApiUrl={providersApiUrl}
          workflowSessionId={session.id}
          customerId={session.customerId}
        />
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <SuccessStep />
      </Shell>
    );
  }

  if (orderedSteps.length === 0) {
    return (
      <Shell>
        <p className="text-sm text-gray-500">
          No sub-steps are enabled for this workflow yet — ask your admin to
          turn at least one on.
        </p>
      </Shell>
    );
  }

  if (phase === "handed-off") {
    return (
      <Shell>
        <HandedOffScreen
          steps={orderedSteps.map((t) => ({
            type: t,
            completed: completedSubSteps.has(t),
          }))}
        />
      </Shell>
    );
  }

  if (phase === "overview") {
    return (
      <Shell>
        <OverviewScreen
          steps={orderedSteps.map((t) => ({
            type: t,
            completed: completedSubSteps.has(t),
            current: t === nextPendingType,
          }))}
          allDone={nextPendingType === null}
          mobileUrl={mobileUrl ?? null}
          onContinue={onOverviewContinue}
        />
      </Shell>
    );
  }

  const stepIndex = stepType ? orderedSteps.indexOf(stepType) : -1;
  return (
    <Shell
      progress={
        stepIndex >= 0
          ? { step: stepIndex + 1, total: orderedSteps.length }
          : undefined
      }
    >
      {stepType === "terms-acceptance" && (
        <TermsStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
        />
      )}
      {stepType === "email-verification" && (
        <EmailStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
        />
      )}
      {stepType === "id-scan" && (
        <DocumentStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
          showCameraCapture={!!isHandoff}
        />
      )}
      {stepType === "face-scan" && (
        <LivenessStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
        />
      )}
      {stepType === "proof-of-residence" && (
        <ProofOfResidenceStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
          showCameraCapture={!!isHandoff}
        />
      )}
      {stepType === "contact-information" && (
        <ContactStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
        />
      )}
    </Shell>
  );
};

const Shell = ({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress?: { step: number; total: number };
}) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg min-h-[640px] flex flex-col overflow-hidden">
    <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary-200 flex items-center justify-center">
          <span className="text-xs font-bold text-primary-700">UC</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">
          UserCore Verification
        </span>
      </div>
      <div className="flex items-center gap-3">
        {progress && (
          <span className="text-xs text-gray-400">
            Step {progress.step} of {progress.total}
          </span>
        )}
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
    <div className="px-8 py-6 flex-1">{children}</div>
  </div>
);
