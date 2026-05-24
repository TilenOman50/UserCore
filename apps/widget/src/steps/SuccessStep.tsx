import { useState } from "react";

import { t } from "../lib/i18n";

type ReviewStatus = "in_review" | "approved" | "rejected";

type Props = {
  workflowsApiUrl: string;
  sessionId: string;
  // True when we already have a verified or notification email on file. When
  // false (and still in review) we offer an optional capture so the customer
  // is reachable for a resubmission request or decision.
  hasContactEmail: boolean;
  // Terminal outcome to render. "in_review" right after submit and while a
  // reviewer decides; "approved"/"rejected" when a customer reopens a decided
  // session.
  status: ReviewStatus;
};

// Visual treatment per outcome — icon glyph + ring colour + i18n keys.
const VISUALS: Record<
  ReviewStatus,
  { ring: string; icon: string; titleKey: string; subtitleKey: string }
> = {
  in_review: {
    ring: "bg-primary-100 text-primary-700",
    icon: "M20 6 9 17l-5-5",
    titleKey: "success.title",
    subtitleKey: "success.subtitle",
  },
  approved: {
    ring: "bg-primary-100 text-primary-700",
    icon: "M20 6 9 17l-5-5",
    titleKey: "success.approvedTitle",
    subtitleKey: "success.approvedSubtitle",
  },
  rejected: {
    ring: "bg-red-100 text-red-600",
    icon: "M18 6 6 18M6 6l12 12",
    titleKey: "success.rejectedTitle",
    subtitleKey: "success.rejectedSubtitle",
  },
};

export const SuccessStep = ({
  workflowsApiUrl,
  sessionId,
  hasContactEmail,
  status,
}: Props) => {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = email.trim();
    if (!value) return;
    setSaving(true);
    try {
      // Plain notification email — no OTP. Just somewhere to reach the
      // customer about the review outcome / a resubmission request.
      await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "_session.notification_email",
                value,
                attributeType: "STRING",
              },
            ],
          }),
        },
      );
      setSaved(true);
    } catch {
      // best-effort — the customer can always reopen the link to check status
    } finally {
      setSaving(false);
    }
  };

  const v = VISUALS[status];
  // Email capture + "what's next" only make sense while a decision is pending.
  const pending = status === "in_review";

  return (
    <div className="flex flex-col h-full items-center text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center ${v.ring}`}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={v.icon} />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mt-5">
          {t(v.titleKey)}
        </h2>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          {t(v.subtitleKey)}
        </p>
      </div>

      {pending && !hasContactEmail && !saved && (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left mb-3">
          <label className="text-xs font-medium text-gray-700">
            {t("success.notifyPrompt")}
          </label>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("success.emailPlaceholder")}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
            />
            <button
              type="button"
              onClick={save}
              disabled={saving || email.trim() === ""}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-primary-200 hover:bg-primary-300 text-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("success.notifySaving") : t("success.notifyButton")}
            </button>
          </div>
        </div>
      )}

      {pending && saved && (
        <div className="w-full bg-primary-50 border border-primary-100 rounded-xl p-4 text-left mb-3">
          <p className="text-xs text-primary-800">{t("success.notifySaved")}</p>
        </div>
      )}

      {pending && (
        <div className="w-full bg-primary-50 border border-primary-100 rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-primary-800 mb-2 uppercase tracking-wide">
            {t("success.nextHeading")}
          </p>
          <ul className="text-xs text-primary-700/90 space-y-1">
            <li>· {t("success.next1")}</li>
            <li>· {t("success.next2")}</li>
            <li>· {t("success.next3")}</li>
          </ul>
        </div>
      )}
    </div>
  );
};
