import { useEffect, useMemo, useState } from "react";

import { LanguagePicker } from "./components/LanguagePicker";
import { t, useLocale } from "./lib/i18n";
import { isSubStepComplete } from "./lib/policy";
import { ContactStep } from "./steps/ContactStep";
import { DocumentStep } from "./steps/DocumentStep";
import { EmailStep } from "./steps/EmailStep";
import { HandedOffScreen } from "./steps/HandedOffScreen";
import { LivenessStep } from "./steps/LivenessStep";
import { OverviewScreen } from "./steps/OverviewScreen";
import { ProofOfResidenceStep } from "./steps/ProofOfResidenceStep";
import { SuccessStep } from "./steps/SuccessStep";
import { TermsStep } from "./steps/TermsStep";

const requestClose = () => {
  window.parent?.postMessage({ type: "usercore.widget.close" }, "*");
};

// Tiny colour helpers. When the admin sets only one brand colour we derive
// the other (lighten or darken) so no UserCore green leaks into the widget.
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) =>
  `#${toHex(r)}${toHex(g)}${toHex(b)}`;
const lightenHex = (hex: string, amount: number) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
};
const darkenHex = (hex: string, amount: number) => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
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

type WorkflowBranding = {
  brandName?: string | null;
  logoS3Key?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  hidePoweredBy?: boolean;
};

type WorkflowDetail = {
  id: string;
  steps: WorkflowStep[];
  branding?: WorkflowBranding;
};

type SubStep = {
  id: string;
  type: SubStepType;
  enabled: boolean;
  providerConfig: unknown;
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
  // providersApiUrl is intentionally accepted but unused right now — it was
  // consumed by the iDenfy handoff path, which is bypassed in this build
  // (see the identityProvider === "idenfy" branch below). Kept in the
  // public WidgetProps surface so SDK callers don't need to change when we
  // re-enable iDenfy later.
  const {
    workflowsApiUrl,
    providersApiUrl: _providersApiUrl,
    sessionId,
    mobileUrl,
    isHandoff,
    onComplete,
  } = props;

  // Subscribe at the very top so a locale switch re-renders the whole tree,
  // not just the Shell. (Children rendered by Shell are passed as the same
  // React element reference; React bails out of re-rendering them unless an
  // ancestor that actually creates them re-renders.)
  const locale = useLocale();

  const [bootError, setBootError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  // Signed URL for the workflow's branding logo, resolved separately because
  // the workflow JSON only carries the MinIO key (logoS3Key).
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [identityProvider, setIdentityProvider] = useState<string | null>(null);
  const [enabledSubSteps, setEnabledSubSteps] = useState<Set<SubStepType>>(
    new Set(),
  );
  // Per-substep providerConfig, keyed by type — populated alongside
  // enabledSubSteps when we fetch the identity-verification detail. Each
  // step component reads its config from here and applies it.
  const [subStepConfigs, setSubStepConfigs] = useState<
    Partial<Record<SubStepType, unknown>>
  >({});
  const [completedSubSteps, setCompletedSubSteps] = useState<Set<SubStepType>>(
    new Set(),
  );
  const [phase, setPhase] = useState<Phase>("overview");
  const [stepType, setStepType] = useState<SubStepType | null>(null);
  // Whether we already have a way to reach this customer (verified email or
  // an end-screen notification email). Drives the optional email prompt on
  // the terminal "review in progress" screen.
  const [hasContactEmail, setHasContactEmail] = useState(false);
  // Terminal review outcome surfaced when a customer reopens an
  // already-submitted/decided session. null = not yet submitted (normal flow).
  const [reviewStatus, setReviewStatus] = useState<
    "in_review" | "approved" | "rejected" | null
  >(null);
  // True when an approved customer was bounced back for re-verification (a
  // workflow requirement was added). Completion keeps them approved rather than
  // sending them back to review.
  const [isReverification, setIsReverification] = useState(false);
  const [resubmissionMessage, setResubmissionMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const sessionDetail = await apiJson<{
          session: Session;
          steps: { step: string; status: string }[];
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

        // Use the API-proxied logo endpoint rather than a presigned MinIO
        // URL — the phone-side widget (QR handoff) can't reach the dev
        // MinIO directly, but it can always reach the workflows API.
        // We fetch the bytes (rather than passing the URL straight to
        // <img>) because the global fetch is monkey-patched in main.tsx to
        // attach `ngrok-skip-browser-warning`. A raw <img src> bypasses
        // that patch and gets back ngrok's HTML warning instead of an
        // image. Blob URL stops being valid after unmount, so revoke it.
        if (wf.branding?.logoS3Key) {
          fetch(
            `${workflowsApiUrl}/workflows/workflows/${encodeURIComponent(wf.id)}/branding/logo`,
          )
            .then(async (r) => {
              if (!r.ok || cancelled) return;
              const blob = await r.blob();
              if (cancelled) return;
              setBrandLogoUrl(URL.createObjectURL(blob));
            })
            .catch(() => undefined);
        }

        const ivStep = wf.steps.find((s) => s.type === "identity-verification");
        setIdentityProvider(ivStep?.provider ?? null);

        // Collected per-substep configs — hoisted so the completion check
        // below can read them after the if-block populates them.
        const configs: Partial<Record<SubStepType, unknown>> = {};

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
          for (const sub of detail.subSteps) {
            if (sub.providerConfig != null)
              configs[sub.type] = sub.providerConfig;
          }
          setSubStepConfigs(configs);
        }

        // Policy-aware completion check — see lib/policy.ts. A substep is
        // "done" only when both the data is present AND it still satisfies
        // the current workflow config (e.g. TOC text unchanged since
        // acceptance, customer's submitted country still in the allowlist).
        const completed = new Set<SubStepType>();
        for (const sub of SUB_STEP_ORDER) {
          const checker = isSubStepComplete[sub];
          if (
            checker &&
            checker({
              attributes: sessionDetail.attributes,
              config: configs[sub],
            })
          ) {
            completed.add(sub);
          }
        }
        // Resubmission: if a reviewer bounced specific steps back, force them
        // incomplete so the overview routes the customer to redo them — their
        // prior data is still on file (audit) but they must re-do these.
        const resubmitRequested =
          sessionDetail.attributes.find(
            (a) => a.attribute === "_session.resubmission_requested",
          )?.value === "true";
        if (resubmitRequested) {
          const csv =
            sessionDetail.attributes.find(
              (a) => a.attribute === "_session.resubmission_steps",
            )?.value ?? "";
          for (const raw of csv.split(",")) {
            completed.delete(raw.trim() as SubStepType);
          }
          // The reviewer's reasons + note, composed server-side — shown to the
          // customer so they know WHY they're redoing steps.
          setResubmissionMessage(
            sessionDetail.attributes.find(
              (a) => a.attribute === "_session.resubmission_message",
            )?.value ?? null,
          );
        }
        // Re-verification (separate from resubmission): an approved customer
        // must (re)complete added/stale steps and STAYS approved on completion.
        const reverificationRequested =
          sessionDetail.attributes.find(
            (a) => a.attribute === "_session.reverification_requested",
          )?.value === "true";
        if (reverificationRequested) {
          const csv =
            sessionDetail.attributes.find(
              (a) => a.attribute === "_session.reverification_steps",
            )?.value ?? "";
          for (const raw of csv.split(",")) {
            completed.delete(raw.trim() as SubStepType);
          }
        }
        setIsReverification(reverificationRequested);
        setCompletedSubSteps(completed);
        setHasContactEmail(
          sessionDetail.attributes.some(
            (a) =>
              (a.attribute === "email_verification.email" ||
                a.attribute === "_session.notification_email") &&
              a.value.trim() !== "",
          ),
        );

        // Reopen handling: if the session is already submitted/decided (and
        // not bounced back for resubmission), jump straight to the terminal
        // status screen instead of replaying the flow. The
        // identity-verification step status carries the outcome — set to
        // REQUIRES_REVIEW on submit, SUCCEEDED/FAILED by the reviewer.
        if (!resubmitRequested && !reverificationRequested) {
          const ivStatus = sessionDetail.steps.find(
            (s) => s.step === "identity-verification",
          )?.status;
          if (ivStatus === "SUCCEEDED") {
            setReviewStatus("approved");
            setPhase("done");
          } else if (ivStatus === "FAILED") {
            setReviewStatus("rejected");
            setPhase("done");
          } else if (ivStatus === "REQUIRES_REVIEW") {
            setReviewStatus("in_review");
            setPhase("done");
          }
        }
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

  // Free the blob URL created for the brand logo when it changes or the
  // widget unmounts, so we don't leak memory across re-mounts.
  useEffect(() => {
    if (!brandLogoUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(brandLogoUrl);
  }, [brandLogoUrl]);

  // Persist the language the customer is using so resume/resubmission emails and
  // their in-widget reasons arrive in the same language. Best-effort, fire on
  // boot and on any in-widget language switch.
  useEffect(() => {
    if (!booted || !session?.id) return;
    void fetch(
      `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(
        session.id,
      )}/attributes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: [
            {
              attribute: "_session.locale",
              value: locale,
              attributeType: "STRING",
            },
          ],
        }),
      },
    ).catch(() => undefined);
  }, [booted, session?.id, locale, workflowsApiUrl]);

  // While the customer waits on the end screen, poll for the reviewer's outcome
  // so they see approved/rejected live — or get routed back if a resubmission is
  // requested — without refreshing. Stops once a terminal status is shown.
  useEffect(() => {
    if (phase !== "done" || reviewStatus !== "in_review") return;
    let cancelled = false;
    const tick = async () => {
      // Presence heartbeat — lets the backend tell the widget is still open and
      // skip the decision/resubmission email; the live update already covers it.
      void fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "_session.last_seen_at",
                value: new Date().toISOString(),
                attributeType: "DATE",
              },
            ],
          }),
        },
      ).catch(() => undefined);
      try {
        const detail = await apiJson<{
          steps: { step: string; status: string }[];
          attributes: Attribute[];
        }>(
          `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}`,
        );
        if (cancelled) return;
        const resub =
          detail.attributes.find(
            (a) => a.attribute === "_session.resubmission_requested",
          )?.value === "true";
        if (resub) {
          // Re-boot so the resubmission path takes over (routes to the steps).
          window.location.reload();
          return;
        }
        const ivStatus = detail.steps.find(
          (s) => s.step === "identity-verification",
        )?.status;
        if (ivStatus === "SUCCEEDED") setReviewStatus("approved");
        else if (ivStatus === "FAILED") setReviewStatus("rejected");
      } catch {
        // best-effort — the next tick retries
      }
    };
    void tick(); // stamp presence immediately on reaching the end screen
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, reviewStatus, workflowsApiUrl, sessionId]);

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

        // Same policy-aware completion logic as boot — see lib/policy.ts.
        // Uses the configs we already fetched once at boot; if those change
        // server-side mid-session, the customer would see the stale "done"
        // state until the page reloads, which is fine for the diploma scope.
        const completed = new Set<SubStepType>();
        for (const sub of SUB_STEP_ORDER) {
          const checker = isSubStepComplete[sub];
          if (
            checker &&
            checker({
              attributes: detail.attributes,
              config: subStepConfigs[sub],
            })
          ) {
            completed.add(sub);
          }
        }
        // Steps the reviewer bounced back (resubmission / re-verification). Their
        // prior data is still on file, so the checkers above mark them "done" —
        // we must force them incomplete here too, exactly like boot does.
        // Otherwise this poll silently re-completes a step the reviewer just sent
        // back ("uncompleted for a few seconds then completed by itself").
        const bounced = new Set<SubStepType>();
        const collectBounced = (flag: string, stepsKey: string) => {
          if (
            detail.attributes.find((a) => a.attribute === flag)?.value !==
            "true"
          )
            return;
          const csv =
            detail.attributes.find((a) => a.attribute === stepsKey)?.value ??
            "";
          for (const raw of csv.split(",")) {
            const step = raw.trim() as SubStepType;
            if (step) bounced.add(step);
          }
        };
        collectBounced(
          "_session.resubmission_requested",
          "_session.resubmission_steps",
        );
        collectBounced(
          "_session.reverification_requested",
          "_session.reverification_steps",
        );
        for (const step of bounced) completed.delete(step);
        setCompletedSubSteps((prev) => {
          // Carry over any bounced step the customer already re-did locally this
          // session — the server checker can't distinguish fresh data from the
          // prior submission, so we trust the in-session completion and never
          // wipe it back out from under them on the next tick.
          for (const step of bounced) {
            if (prev.has(step)) completed.add(step);
          }
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
  }, [mobileUrl, workflowsApiUrl, sessionId, subStepConfigs]);

  const orderedSteps = useMemo(
    () => SUB_STEP_ORDER.filter((t) => enabledSubSteps.has(t)),
    [enabledSubSteps],
  );

  // Compose what Shell needs. Model:
  //   primary   = the dominant fill colour (CTAs + every primary-* bg, with
  //               CSS color-mix() producing lighter tints for the 50/100
  //               shades — so primary is consistently visible everywhere).
  //   secondary = the outline / accent colour — borders, focus rings.
  // When admin sets only one we derive the other so the palette stays
  // coherent and no UserCore green leaks through.
  const shellBranding = useMemo(() => {
    const primary = workflow?.branding?.primaryColor ?? null;
    const secondary = workflow?.branding?.secondaryColor ?? null;
    const resolvedPrimary =
      primary ?? (secondary ? lightenHex(secondary, 0.5) : null);
    const resolvedSecondary =
      secondary ?? (primary ? darkenHex(primary, 0.2) : null);
    return {
      brandName: workflow?.branding?.brandName,
      logoUrl: brandLogoUrl,
      primaryColor: resolvedPrimary,
      secondaryColor: resolvedSecondary,
      hidePoweredBy: workflow?.branding?.hidePoweredBy,
    };
  }, [
    workflow?.branding?.brandName,
    workflow?.branding?.primaryColor,
    workflow?.branding?.secondaryColor,
    workflow?.branding?.hidePoweredBy,
    brandLogoUrl,
  ]);

  const nextPendingType = useMemo(
    () => orderedSteps.find((t) => !completedSubSteps.has(t)) ?? null,
    [orderedSteps, completedSubSteps],
  );

  const finalize = async () => {
    try {
      if (isReverification) {
        // Re-verification of an approved customer: clear markers + re-run
        // checks server-side, but DON'T flip identity-verification — they stay
        // approved unless a re-check fails.
        await apiJson(
          `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/complete-reverification`,
          { method: "POST" },
        );
        window.parent?.postMessage(
          { type: "usercore.widget.complete", sessionId },
          "*",
        );
        setReviewStatus("approved");
        setPhase("done");
        onComplete?.("submitted");
        return;
      }
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
      setReviewStatus("in_review");
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
      <Shell branding={shellBranding}>
        <p className="text-sm text-red-600">{bootError}</p>
      </Shell>
    );
  }

  if (!booted || !session || !workflow) {
    return (
      <Shell branding={shellBranding}>
        <p className="text-sm text-gray-500">{t("shell.loading")}</p>
      </Shell>
    );
  }

  // Identity-verification provider is intentionally NOT branched on at
  // runtime in this build. The workflow editor still lets operators wire
  // iDenfy (so the demo can show the toggle + chooser modal), but actually
  // launching iDenfy's hosted page requires a paid contract we don't have,
  // so every session falls through to the in-house substep flow (terms,
  // email OTP, doc scan, liveness face scan, POR, contact). To re-enable
  // when credentials are live: re-import IdenfyHandoffStep from
  // "./steps/IdenfyHandoffStep" and render <Shell><IdenfyHandoffStep…/></Shell>
  // inside the branch below.
  if (identityProvider === "idenfy") {
    console.info(
      "iDenfy is configured on this workflow but bypassed in this build — using in-house flow.",
    );
  }

  if (phase === "done") {
    return (
      <Shell branding={shellBranding}>
        <SuccessStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          hasContactEmail={hasContactEmail}
          status={reviewStatus ?? "in_review"}
        />
      </Shell>
    );
  }

  if (orderedSteps.length === 0) {
    return (
      <Shell branding={shellBranding}>
        <p className="text-sm text-gray-500">{t("shell.noSubsteps")}</p>
      </Shell>
    );
  }

  if (phase === "handed-off") {
    return (
      <Shell branding={shellBranding}>
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
      <Shell branding={shellBranding}>
        {resubmissionMessage && (
          <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="text-sm font-medium text-orange-800">
              {t("resubmission.title")}
            </div>
            <div className="mt-1 text-xs text-orange-700">
              {resubmissionMessage}
            </div>
          </div>
        )}
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
      branding={shellBranding}
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
          config={
            subStepConfigs["terms-acceptance"] as
              | { termsText?: string | null }
              | undefined
          }
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
          config={
            subStepConfigs["id-scan"] as
              | {
                  countryMode?: "all" | "allowed_only" | "blocked";
                  countries?: string[] | null;
                  documentTypes?: string[];
                }
              | undefined
          }
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
          config={
            subStepConfigs["proof-of-residence"] as
              | { documentTypes?: string[] }
              | undefined
          }
        />
      )}
      {stepType === "contact-information" && (
        <ContactStep
          workflowsApiUrl={workflowsApiUrl}
          sessionId={sessionId}
          onComplete={onStepComplete}
          config={
            subStepConfigs["contact-information"] as
              | { fields?: { phone: boolean; email: boolean } }
              | undefined
          }
        />
      )}
    </Shell>
  );
};

type ShellBranding = {
  brandName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  hidePoweredBy?: boolean;
};

const Shell = ({
  children,
  progress,
  branding,
}: {
  children: React.ReactNode;
  progress?: { step: number; total: number };
  branding?: ShellBranding;
}) => {
  // Subscribe to locale changes so every t() call in the tree re-renders when
  // the customer flips the language picker.
  useLocale();
  const brandName = branding?.brandName?.trim() || t("shell.defaultBrand");
  const logoUrl = branding?.logoUrl ?? null;
  // Inline override only when a custom colour is set — Tailwind defaults
  // (primary-200 / primary-100) stay everywhere else.
  const primary = branding?.primaryColor ?? null;
  const secondary = branding?.secondaryColor ?? null;
  const styleVars: React.CSSProperties = {};
  if (primary)
    (styleVars as Record<string, string>)["--brand-primary"] = primary;
  if (secondary)
    (styleVars as Record<string, string>)["--brand-secondary"] = secondary;
  return (
    <div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg min-h-[640px] flex flex-col overflow-hidden"
      style={primary || secondary ? styleVars : undefined}
    >
      <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              className="w-6 h-6 rounded-md object-contain bg-white"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-md bg-primary-200 flex items-center justify-center"
              style={primary ? { backgroundColor: primary } : undefined}
            >
              <span className="text-xs font-bold text-primary-700">UC</span>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-700 truncate">
            {brandName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {progress && (
            <span className="text-xs text-gray-400">
              {t("shell.stepOfTotal", {
                step: String(progress.step),
                total: String(progress.total),
              })}
            </span>
          )}
          <LanguagePicker />
          <button
            type="button"
            onClick={requestClose}
            aria-label={t("shell.close")}
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
      {!branding?.hidePoweredBy && (
        <div className="px-8 py-2 border-t border-gray-100 text-center">
          <span className="text-[10px] text-gray-400">
            {t("shell.poweredBy")}{" "}
            <span className="font-semibold">UserCore</span>
          </span>
        </div>
      )}
    </div>
  );
};
