import { useState } from "react";

type KycSession = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  status: string;
  submittedAt: string | null;
};

export const KycReviewPage = () => {
  // TODO: fetch from workflows-api
  const sessions: KycSession[] = [];
  const [selected, setSelected] = useState<KycSession | null>(null);
  const [reason, setReason] = useState("");

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!selected) return;
    // TODO: POST to workflows-api /workflows/kyc-sessions/:id/review
    console.log("Review", { sessionId: selected.id, decision, reason });
    setSelected(null);
    setReason("");
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">KYC Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manually review pending KYC submissions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Review
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No sessions pending review.
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelected(session)}
                  className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors ${selected?.id === session.id ? "bg-primary-50" : ""}`}
                >
                  <p className="font-medium text-gray-900">
                    {session.firstName} {session.lastName}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {session.country} · Submitted {session.submittedAt}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Review panel */}
        {selected ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selected.firstName} {selected.lastName}
            </h2>

            <div className="space-y-3 mb-6 text-sm text-gray-600">
              <div>
                <span className="font-medium">Country:</span> {selected.country}
              </div>
              <div>
                <span className="font-medium">Status:</span> {selected.status}
              </div>
              <div>
                <span className="font-medium">Session ID:</span>{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  {selected.id}
                </code>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Add a note for the user..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReview("approved")}
                className="flex-1 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg transition-colors text-sm"
              >
                Approve
              </button>
              <button
                onClick={() => handleReview("rejected")}
                className="flex-1 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors text-sm"
              >
                Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
            <p className="text-sm text-gray-400">Select a session to review</p>
          </div>
        )}
      </div>
    </div>
  );
};
