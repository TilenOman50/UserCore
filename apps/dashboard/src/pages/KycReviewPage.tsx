import { useEffect, useMemo, useState } from "react";

import {
  useFinalizeSession,
  useSessionFileUrl,
  useWorkflowSession,
  useWorkflowSessions,
  type ReviewDecision,
} from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

export const KycReviewPage = () => {
  const { workspace, user } = useWorkspace();
  const workspaceId = workspace?.id ?? "";

  const sessionsQuery = useWorkflowSessions(workspaceId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">KYC Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manually review verification submissions.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-4 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
          {sessionsQuery.isLoading && (
            <div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
          )}
          {sessionsQuery.data?.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500">
              No verification submissions yet.
            </div>
          )}
          {sessionsQuery.data?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                selectedId === s.id ? "bg-primary-50" : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-900 truncate">
                {s.customerId}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(s.createdAt).toLocaleString()} ·{" "}
                {s.externalSessionSource}
              </div>
            </button>
          ))}
        </aside>

        <section className="col-span-8">
          {selectedId ? (
            <SessionDetail
              sessionId={selectedId}
              reviewerId={user.id}
              onFinalized={() => setSelectedId(null)}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
              Select a session to review.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const SessionDetail = ({
  sessionId,
  reviewerId,
  onFinalized,
}: {
  sessionId: string;
  reviewerId: string;
  onFinalized: () => void;
}) => {
  const detail = useWorkflowSession(sessionId);
  const documentFront = useSessionFileUrl(sessionId, "document_front");
  const documentBack = useSessionFileUrl(sessionId, "document_back");
  const faceVideo = useSessionFileUrl(sessionId, "face_video");
  const proofOfResidence = useSessionFileUrl(sessionId, "proof_of_residence");
  const finalize = useFinalizeSession();
  const [reason, setReason] = useState("");

  // Reset reason when switching session.
  useEffect(() => {
    setReason("");
  }, [sessionId]);

  const handleFinalize = async (decision: ReviewDecision) => {
    await finalize.mutateAsync({
      sessionId,
      decision,
      reviewedBy: reviewerId,
      reason: reason || undefined,
    });
    onFinalized();
  };

  const groupedAttributes = useMemo(() => {
    const groups = new Map<string, Array<{ key: string; value: string }>>();
    for (const attr of detail.data?.attributes ?? []) {
      const [namespace, ...rest] = attr.attribute.split(".");
      const ns = namespace ?? "other";
      const key = rest.join(".");
      const list = groups.get(ns) ?? [];
      list.push({ key, value: attr.value });
      groups.set(ns, list);
    }
    return groups;
  }, [detail.data]);

  if (detail.isLoading || !detail.data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
        Loading session…
      </div>
    );
  }

  const session = detail.data.session;
  const ivStep = detail.data.steps.find(
    (s) => s.step === "identity-verification",
  );
  const overallStatus = ivStep?.status ?? "PENDING";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">
              {session.customerId}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Submitted {new Date(session.createdAt).toLocaleString()}
            </div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded ${
              overallStatus === "REQUIRES_REVIEW"
                ? "bg-yellow-100 text-yellow-700"
                : overallStatus === "SUCCEEDED"
                  ? "bg-primary-100 text-primary-700"
                  : overallStatus === "FAILED"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            {overallStatus.toLowerCase().replace("_", " ")}
          </span>
        </div>
      </div>

      {documentFront.data?.url && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Identity document
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Front</div>
              <img
                src={documentFront.data.url}
                alt="Document front"
                className="max-h-60 w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
              />
            </div>
            {documentBack.data?.url && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Back</div>
                <img
                  src={documentBack.data.url}
                  alt="Document back"
                  className="max-h-60 w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {faceVideo.data?.url && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Selfie</h3>
          <img
            src={faceVideo.data.url}
            alt="Selfie"
            className="max-h-72 rounded-lg border border-gray-200"
          />
        </div>
      )}

      {proofOfResidence.data?.url && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Proof of residence
          </h3>
          {/* The key only tells us the type via mime when we fetched it. If it
              renders as an image, great; otherwise fall back to a link. */}
          <img
            src={proofOfResidence.data.url}
            alt="Proof of residence"
            className="max-h-72 rounded-lg border border-gray-200"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              target.insertAdjacentHTML(
                "afterend",
                `<a href="${proofOfResidence.data!.url}" target="_blank" rel="noreferrer" class="text-sm text-primary-700 hover:underline">Open uploaded file</a>`,
              );
            }}
          />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Captured attributes
        </h3>
        {groupedAttributes.size === 0 ? (
          <p className="text-sm text-gray-500">
            No attributes captured yet — the customer is still in the flow.
          </p>
        ) : (
          [...groupedAttributes.entries()].map(([ns, items]) => (
            <div key={ns}>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {ns.replace(/_/g, " ")}
              </div>
              <dl className="grid grid-cols-2 gap-y-1 gap-x-4 text-sm">
                {items.map((it) => (
                  <div key={it.key} className="contents">
                    <dt className="text-gray-500">{it.key}</dt>
                    <dd className="text-gray-900 truncate">{it.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Decision</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason or notes (optional)"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 mb-3"
        />
        <div className="flex gap-3">
          <button
            type="button"
            disabled={finalize.isPending}
            onClick={() => handleFinalize("approved")}
            className="flex-1 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg disabled:opacity-50 text-sm"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={finalize.isPending}
            onClick={() => handleFinalize("flagged")}
            className="flex-1 py-2 px-4 bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium rounded-lg disabled:opacity-50 text-sm"
          >
            Flag
          </button>
          <button
            type="button"
            disabled={finalize.isPending}
            onClick={() => handleFinalize("rejected")}
            className="flex-1 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg disabled:opacity-50 text-sm"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
