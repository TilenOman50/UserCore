import { useState, type ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";

import { getCurrentLocale, t } from "../lib/i18n";
import type { SubStepType } from "../Widget";

// Tack the current locale onto the handoff URL so the phone-side widget
// picks up the same language. localStorage doesn't cross devices, and the
// QR is generated at handoff time — whatever language the customer chose
// here is what they should see on the phone.
const withLocale = (url: string): string => {
  try {
    const u = new URL(url);
    u.searchParams.set("lang", getCurrentLocale());
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}lang=${getCurrentLocale()}`;
  }
};

type StepRow = {
  type: SubStepType;
  completed: boolean;
  current: boolean;
};

type Props = {
  steps: StepRow[];
  allDone: boolean;
  mobileUrl: string | null;
  onContinue: () => void;
};

// Labels are pulled from the i18n bundle at render time (locale stays
// constant in a session). Icons are stable JSX.
const STEP_ICONS: Record<SubStepType, ReactElement> = {
  "terms-acceptance": <FileIcon />,
  "email-verification": <EmailIcon />,
  "id-scan": <IdIcon />,
  "face-scan": <FaceIcon />,
  "proof-of-residence": <HouseIcon />,
  "contact-information": <PhoneIcon />,
};

const STEP_LABEL_KEYS: Record<SubStepType, string> = {
  "terms-acceptance": "step.terms",
  "email-verification": "step.email",
  "id-scan": "step.idScan",
  "face-scan": "step.faceScan",
  "proof-of-residence": "step.por",
  "contact-information": "step.contact",
};

export const OverviewScreen = ({
  steps,
  allDone,
  mobileUrl,
  onContinue,
}: Props) => {
  const [showQR, setShowQR] = useState(false);

  if (showQR && mobileUrl) {
    return (
      <QRView
        mobileUrl={withLocale(mobileUrl)}
        onBack={() => setShowQR(false)}
      />
    );
  }

  const completedCount = steps.filter((s) => s.completed).length;
  const total = steps.length;

  const title = allDone
    ? t("overview.titleAllSet")
    : completedCount === 0
      ? t("overview.titleSteps")
      : t("overview.titleKeepGoing");
  const subtitle = allDone
    ? t("overview.subtitleAllDone")
    : t("overview.subtitleProgress", {
        count: String(completedCount),
        total: String(total),
      });
  const primaryLabel = allDone ? t("overview.submit") : t("overview.continue");

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <ol className="flex-1 space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.type}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${
              s.current
                ? "border-primary-300 bg-primary-50"
                : s.completed
                  ? "border-gray-200 bg-white"
                  : "border-gray-200 bg-white"
            }`}
          >
            <StatusBadge
              index={i + 1}
              completed={s.completed}
              current={s.current}
            />
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                s.completed
                  ? "bg-primary-100 text-primary-700"
                  : s.current
                    ? "bg-primary-200 text-primary-800"
                    : "bg-gray-50 text-gray-500 border border-gray-200"
              }`}
            >
              {STEP_ICONS[s.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium truncate ${
                  s.completed
                    ? "text-gray-500 line-through decoration-gray-300"
                    : "text-gray-900"
                }`}
              >
                {t(STEP_LABEL_KEYS[s.type])}
              </div>
              {s.current && !s.completed && (
                <div className="text-xs text-primary-700 mt-0.5">
                  {t("overview.upNext")}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-semibold rounded-xl text-sm"
        >
          {primaryLabel}
        </button>
        {mobileUrl && !allDone && (
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl text-sm inline-flex items-center justify-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
            </svg>
            {t("overview.continueOnPhone")}
          </button>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({
  index,
  completed,
  current,
}: {
  index: number;
  completed: boolean;
  current: boolean;
}) => {
  if (completed) {
    return (
      <div className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center shrink-0">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${
        current
          ? "bg-primary-200 text-primary-800"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {index}
    </div>
  );
};

const QRView = ({
  mobileUrl,
  onBack,
}: {
  mobileUrl: string;
  onBack: () => void;
}) => (
  <div className="flex flex-col h-full">
    <button
      type="button"
      onClick={onBack}
      className="self-start mb-2 text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {t("qr.back")}
    </button>
    <h2 className="text-xl font-semibold text-gray-900">{t("qr.title")}</h2>
    <p className="text-sm text-gray-500 mt-1">{t("qr.subtitle")}</p>
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <QRCodeSVG value={mobileUrl} size={220} level="M" />
      </div>
    </div>
    <div className="mb-3">
      <label className="text-xs font-medium text-gray-600">
        {t("qr.directUrl")}
      </label>
      <div className="mt-1 flex items-stretch gap-2">
        <input
          readOnly
          value={mobileUrl}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(mobileUrl)}
          className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          {t("qr.copy")}
        </button>
      </div>
    </div>
    <button
      type="button"
      onClick={onBack}
      className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium rounded-xl text-sm"
    >
      {t("qr.backToSteps")}
    </button>
  </div>
);

function FileIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.5" />
      <path d="M14 10h5M14 14h5" />
    </svg>
  );
}

function FaceIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
