import { useState } from "react";

type TermsStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

export const TermsStep = (props: TermsStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "terms_acceptance.accepted",
                value: "true",
                attributeType: "BOOLEAN",
              },
              {
                attribute: "terms_acceptance.accepted_at",
                value: new Date().toISOString(),
                attributeType: "DATE",
              },
            ],
          }),
        },
      );
      if (!res.ok) throw new Error("Submit failed");
      onComplete();
    } catch {
      setError("Could not record your acceptance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Terms &amp; conditions
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Please review and accept before continuing.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 leading-relaxed space-y-3">
        <p className="font-semibold text-gray-800">
          UserCore identity verification — consent
        </p>
        <p>
          By proceeding, you authorise UserCore and the operator of this
          workflow to collect, process and store the personal information you
          provide for the purpose of verifying your identity. This may include
          identity documents, a selfie video, contact details and proof of
          residence.
        </p>
        <p>
          Your data is retained for as long as required to meet applicable
          regulatory obligations and is processed in accordance with the
          operator's privacy policy. You may withdraw consent at any time by
          contacting the operator, in which case the verification cannot be
          completed.
        </p>
        <p>
          You confirm that the information and documents you submit belong to
          you and are accurate. Submitting forged or stolen documents is a
          criminal offence in most jurisdictions.
        </p>
      </div>

      <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded text-primary-600 focus:ring-primary-300"
        />
        <span className="text-sm text-gray-700">
          I have read and agree to the terms above.
        </span>
      </label>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={!agreed || loading}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Saving…" : "Agree and continue"}
      </button>
    </form>
  );
};
