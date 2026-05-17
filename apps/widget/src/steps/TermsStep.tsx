import { useState } from "react";

import { t } from "../lib/i18n";
import { getActiveTermsText, hashText } from "../lib/policy";

type TermsStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
  // Admin-configurable override of the consent text. When null/missing we
  // render the locale-specific default below.
  config?: { termsText?: string | null };
};

export const TermsStep = (props: TermsStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete, config } = props;
  // Use the same source of truth the completion checker uses, so the
  // policy hash we persist will match what boot recomputes later.
  const activeText = getActiveTermsText(config);
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
              // Hash of the exact text the user just agreed to. If the admin
              // edits the terms later, boot's completion check will see the
              // hash mismatch and re-prompt the customer.
              {
                attribute: "terms_acceptance.policy_hash",
                value: hashText(activeText),
                attributeType: "STRING",
              },
            ],
          }),
        },
      );
      if (!res.ok) throw new Error("Submit failed");
      onComplete();
    } catch {
      setError(t("terms.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("terms.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t("terms.subtitle")}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 leading-relaxed">
        <p className="whitespace-pre-wrap">{activeText}</p>
      </div>

      <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded text-primary-600 focus:ring-primary-300"
        />
        <span className="text-sm text-gray-700">{t("terms.checkbox")}</span>
      </label>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={!agreed || loading}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? t("terms.saving") : t("terms.continue")}
      </button>
    </form>
  );
};
