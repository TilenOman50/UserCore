import { useEffect, useMemo } from "react";

import { getMobileUrls, WIDGET_URL, WORKFLOWS_API_URL } from "../../lib/api";

type Props = {
  sessionId: string;
  onClose: () => void;
};

// The widget iframe carries its own card chrome (header + close button +
// in-flow device picker), so the dashboard just dims the backdrop and drops
// the iframe in centered. Esc, backdrop click, and the widget's own X (via
// postMessage) close it. After the user accepts Terms inside the widget, the
// widget itself offers to hand off to a phone via QR — we pass the public
// mobile URL through so it knows what to encode.
export const TestFlowModal = ({ sessionId, onClose }: Props) => {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "usercore.widget.close") {
        onClose();
        return;
      }
      if (e.data.type === "usercore.widget.complete") {
        setTimeout(onClose, 1200);
      }
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
    const mobile = getMobileUrls();
    // `handoff=true` tells the widget it's the phone-side after a QR scan,
    // so it writes a marker attribute the desktop widget polls for.
    const phoneUrl = `${mobile.widgetUrl}/?session=${encodeURIComponent(sessionId)}&workflowsApi=${encodeURIComponent(mobile.workflowsApiUrl)}&handoff=true`;
    const desktopParams = new URLSearchParams({
      session: sessionId,
      workflowsApi: WORKFLOWS_API_URL,
    });
    if (!mobile.isLocalhost) {
      desktopParams.set("mobileUrl", phoneUrl);
    }
    return `${WIDGET_URL}/?${desktopParams.toString()}`;
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
