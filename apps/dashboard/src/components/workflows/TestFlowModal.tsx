import { useEffect, useMemo } from "react";

import { WIDGET_IFRAME_URL, WIDGET_WORKFLOWS_API_URL } from "../../lib/api";

type Props = {
  sessionId: string;
  onClose: () => void;
};

// The widget iframe carries its own card chrome (header + close button +
// in-flow device picker), so the dashboard just dims the backdrop and drops
// the iframe in centered. Esc, backdrop click, and the widget's own X (via
// postMessage) close it. The widget self-derives the phone-handoff URL from
// its own origin, so we just hand it the sessionId — same minimal integration
// the demo sites (Alpska Banka, Workly) use, and the same shape we expect a
// real customer's frontend to use in production.
export const TestFlowModal = ({ sessionId, onClose }: Props) => {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "usercore.widget.close") {
        onClose();
      }
      // Intentionally do NOT auto-close on "usercore.widget.complete": the
      // success screen lets the customer add a notification email + see what's
      // next, so we keep it open until they close it themselves (the widget's
      // own X, Esc, or backdrop) — matching the phone (standalone) behaviour.
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const widgetSrc = useMemo(() => {
    const params = new URLSearchParams({
      session: sessionId,
      workflowsApi: WIDGET_WORKFLOWS_API_URL,
    });
    return `${WIDGET_IFRAME_URL}/?${params.toString()}`;
  }, [sessionId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] h-[760px] max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={widgetSrc}
          title="UserCore widget"
          className="w-full h-full border-0 bg-transparent"
          allow="camera; microphone"
        />
      </div>
    </div>
  );
};
