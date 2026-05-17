import type { ReactElement } from "react";

import type { SubStepType } from "../Widget";

type Props = {
  steps: { type: SubStepType; completed: boolean }[];
};

const STEP_LABEL: Record<SubStepType, string> = {
  "terms-acceptance": "Terms & conditions",
  "email-verification": "Email verification",
  "id-scan": "Identity document",
  "face-scan": "Face scan",
  "proof-of-residence": "Proof of residence",
  "contact-information": "Contact information",
};

const STEP_ICON: Record<SubStepType, ReactElement> = {
  "terms-acceptance": <FileIcon />,
  "email-verification": <EmailIcon />,
  "id-scan": <IdIcon />,
  "face-scan": <FaceIcon />,
  "proof-of-residence": <HouseIcon />,
  "contact-information": <PhoneIcon />,
};

// Shown on the desktop widget after the same session has been opened on a
// phone. The phone takes over interactive control; here we just reflect the
// progress live so the dashboard user can see how it's going.
export const HandedOffScreen = ({ steps }: Props) => {
  const completed = steps.filter((s) => s.completed).length;
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4">
        <div className="w-9 h-9 rounded-lg bg-primary-200 text-primary-800 flex items-center justify-center shrink-0">
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
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary-900">
            Session continued on a phone
          </p>
          <p className="text-xs text-primary-800/80 mt-0.5">
            The customer is finishing the verification on their mobile device.
            Steps below update as they progress.
          </p>
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-2">
        {completed} of {steps.length} complete
      </div>

      <ol className="flex-1 space-y-2">
        {steps.map((s) => (
          <li
            key={s.type}
            className="flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-200 bg-white"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                s.completed
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {s.completed ? (
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
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-spin"
                >
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              )}
            </div>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                s.completed
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-50 text-gray-500 border border-gray-200"
              }`}
            >
              {STEP_ICON[s.type]}
            </div>
            <span
              className={`text-sm font-medium truncate ${
                s.completed
                  ? "text-gray-500 line-through decoration-gray-300"
                  : "text-gray-800"
              }`}
            >
              {STEP_LABEL[s.type]}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-gray-400 text-center">
        You can close this window — the result will land in the review queue
        when the customer finishes.
      </p>
    </div>
  );
};

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
