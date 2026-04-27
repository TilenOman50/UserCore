import { useEffect, useState } from "react";

type IdenfyHandoffStepProps = {
  providersApiUrl: string;
  workflowSessionId: string;
  customerId: string;
};

type IdenfySession = {
  authToken: string;
  scanRef: string;
  scanUrl: string;
  expiryTime: number;
};

export const IdenfyHandoffStep = (props: IdenfyHandoffStepProps) => {
  const { providersApiUrl, workflowSessionId, customerId } = props;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [session, setSession] = useState<IdenfySession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const res = await fetch(`${providersApiUrl}/providers/idenfy/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowSessionId, customerId }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `iDenfy session failed (${res.status})`);
        }
        const json = (await res.json()) as IdenfySession;
        if (cancelled) return;
        setSession(json);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not start session");
        setStatus("error");
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [providersApiUrl, workflowSessionId, customerId]);

  if (status === "loading") {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-sm text-gray-600">
          Connecting to verification provider…
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4">
        <div className="text-sm font-semibold text-gray-900">
          Provider unavailable
        </div>
        <p className="text-sm text-gray-600">
          We couldn't reach iDenfy right now. Please try again later or contact
          support.
        </p>
        {error && <p className="text-xs text-gray-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Continue verification
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          You'll complete document and face verification in our provider's
          flow.
        </p>
      </div>
      <a
        href={session?.scanUrl ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        className="block w-full text-center py-2.5 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm"
      >
        Open verification
      </a>
      <p className="text-xs text-gray-400">
        Reference: {session?.scanRef ?? "—"}
      </p>
    </div>
  );
};
