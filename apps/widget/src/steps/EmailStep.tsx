import { useState } from "react";

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
          body: JSON.stringify({ email }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not send code");
      }
      setStage("enter-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/email-otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Verification failed");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (stage === "enter-code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verifyCode();
        }}
        className="flex flex-col h-full"
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Enter the code
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit code to <strong>{email}</strong>. It expires in 10
            minutes.
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <label
            htmlFor="otp-input"
            className="block text-xs font-medium text-gray-700 mb-1.5"
          >
            Verification code
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
            Use a different email
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
        >
          {loading ? "Verifying…" : "Verify and continue"}
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
          Email verification
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We'll send a 6-digit code to confirm your address.
        </p>
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
          Email address
        </label>
        <input
          id="email-input"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading || email.trim().length === 0}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Sending…" : "Send code"}
      </button>
    </form>
  );
};
