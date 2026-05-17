import { useEffect, useRef, useState } from "react";

import { getCurrentLocale, t } from "../lib/i18n";

type EmailStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

type Stage = "enter-email" | "enter-code";

export const EmailStep = (props: EmailStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const [stage, setStage] = useState<Stage>("enter-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/email-otp/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, locale: getCurrentLocale() }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("email.sendError"));
      }
      setStage("enter-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.sendError"));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (codeToCheck: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/email-otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: codeToCheck }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("email.verifyError"));
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("email.verifyError"));
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when the user finishes typing the 6th digit.
  const lastAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (
      stage === "enter-code" &&
      code.length === 6 &&
      !loading &&
      lastAttempted.current !== code
    ) {
      lastAttempted.current = code;
      void verifyCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stage, loading]);

  if (stage === "enter-code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verifyCode(code);
        }}
        className="flex flex-col h-full"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {t("email.codeTitle")}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("email.codeSubtitle", { email })}
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <label
            htmlFor="otp-input"
            className="block text-xs font-medium text-gray-700 mb-1.5"
          >
            {t("email.codeLabel")}
          </label>
          <input
            id="otp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full px-3.5 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStage("enter-email");
              setCode("");
              setError(null);
            }}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 self-start"
          >
            {t("email.differentEmail")}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
        >
          {loading ? t("email.verifying") : t("email.verify")}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sendCode();
      }}
      className="flex flex-col h-full"
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("email.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t("email.subtitle")}</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700">
            <svg
              width="32"
              height="32"
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
          </div>
        </div>

        <label
          htmlFor="email-input"
          className="block text-xs font-medium text-gray-700 mb-1.5"
        >
          {t("email.label")}
        </label>
        <input
          id="email-input"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("email.placeholder")}
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading || email.trim().length === 0}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? t("email.sending") : t("email.send")}
      </button>
    </form>
  );
};
