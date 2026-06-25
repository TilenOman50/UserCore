import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { USERCORE_LANDING_URL } from "@usercore/shared-types";

import { authClient, signIn } from "../lib/authClient";

type Step = "email" | "code";

export const LoginPage = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    setSubmitting(false);

    if (sendError) {
      setError(sendError.message ?? "Failed to send code");
      return;
    }

    setStep("code");
  };

  const verifyCode = async (otp: string) => {
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await signIn.emailOtp({ email, otp });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message ?? "Invalid or expired code");
      return;
    }

    // Hard reload so ProtectedRoute reads the fresh session cookie instead
    // of a stale useSession cache.
    window.location.href = "/";
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    void verifyCode(code);
  };

  const handleCodeChange = (next: string) => {
    const cleaned = next.replace(/\D/g, "").slice(0, 6);
    setCode(cleaned);
    if (cleaned.length === 6 && !submitting) {
      void verifyCode(cleaned);
    }
  };

  const handleBack = () => {
    setStep("email");
    setCode("");
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {/* Login-only escape hatch back to the marketing site — anyone who lands
          here from the dashboard URL directly (or wants to re-read the
          pricing/docs) shouldn't have to retype the address. */}
      <a
        href={USERCORE_LANDING_URL}
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-950 transition-colors"
      >
        <ArrowLeft size={14} /> Back to home page
      </a>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary-200 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary-700">UC</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">UserCore</h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === "email"
              ? "Sign in to your dashboard"
              : `We sent a code to ${email}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === "email" ? (
            <form className="space-y-6" onSubmit={handleSendCode}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                  placeholder="admin@usercore.com"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending code..." : "Send login code"}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyCode}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent text-center text-2xl tracking-[0.5em] font-semibold"
                  placeholder="000000"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Check your inbox for a 6-digit code. Expires in 10 minutes.
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Verifying..." : "Verify and sign in"}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full text-sm text-gray-600 hover:text-gray-900"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
