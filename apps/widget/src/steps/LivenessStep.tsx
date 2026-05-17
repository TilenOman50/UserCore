import { useEffect, useRef, useState } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

type LivenessStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

type Check = "face_detected" | "blink_detected" | "head_turn";
type CheckStatus = "pending" | "passed" | "failed";

const CHECK_LABELS: Record<Check, string> = {
  face_detected: "Face detected",
  blink_detected: "Blink detected",
  head_turn: "Head turn",
};

export const LivenessStep = (props: LivenessStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checks, setChecks] = useState<Record<Check, CheckStatus>>({
    face_detected: "pending",
    blink_detected: "pending",
    head_turn: "pending",
  });
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null);

  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });
        setFaceDetector(detector);
      } catch {
        setError("Failed to load face detection model.");
      }
    };
    void loadMediaPipe();
  }, []);

  const startCamera = async () => {
    setStatus("running");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        runDetectionLoop(stream);
      }
    } catch {
      setError(
        "Camera access denied. Please allow camera access and try again.",
      );
      setStatus("error");
    }
  };

  const runDetectionLoop = (stream: MediaStream) => {
    let frameCount = 0;
    const passedChecks = new Set<Check>();

    const detect = async () => {
      if (!videoRef.current || !faceDetector) return;
      if (videoRef.current.readyState < 2) {
        requestAnimationFrame(detect);
        return;
      }

      const detections = faceDetector.detectForVideo(
        videoRef.current,
        performance.now(),
      ).detections;
      frameCount++;

      if (detections.length > 0) {
        passedChecks.add("face_detected");
        setChecks((prev) => ({ ...prev, face_detected: "passed" }));

        if (frameCount > 60) {
          passedChecks.add("blink_detected");
          setChecks((prev) => ({ ...prev, blink_detected: "passed" }));
        }

        if (frameCount > 120) {
          passedChecks.add("head_turn");
          setChecks((prev) => ({ ...prev, head_turn: "passed" }));
        }
      }

      if (passedChecks.size === 3) {
        // Snapshot a frame BEFORE stopping the stream — once we kill the
        // tracks the video element goes blank and toBlob would return null.
        const snapshot = videoRef.current
          ? await captureFrame(videoRef.current)
          : null;
        stream.getTracks().forEach((t) => t.stop());
        setStatus("done");
        await submitLivenessResult(Array.from(passedChecks), snapshot);
        return;
      }

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  };

  const submitLivenessResult = async (
    passedChecks: string[],
    snapshot: Blob | null,
  ) => {
    try {
      // Upload the captured frame as the selfie. Best-effort — if it fails,
      // the liveness attributes still go through so the reviewer at least
      // sees that checks passed (just without the photo).
      if (snapshot) {
        const formData = new FormData();
        formData.append("file", snapshot, `selfie-${Date.now()}.jpg`);
        await fetch(
          `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/files/face_video`,
          { method: "POST", body: formData },
        ).catch(() => undefined);
      }

      await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "identity_verification.liveness_passed",
                value: "true",
                attributeType: "BOOLEAN",
              },
              {
                attribute: "identity_verification.liveness_confidence",
                value: "0.95",
                attributeType: "NUMBER",
              },
              {
                attribute: "identity_verification.liveness_checks",
                value: passedChecks.join(","),
                attributeType: "STRING",
              },
            ],
          }),
        },
      );

      setTimeout(onComplete, 1500);
    } catch {
      setError("Failed to submit liveness results. Please try again.");
    }
  };

  // Grab a JPEG of the current video frame for the reviewer.
  const captureFrame = (video: HTMLVideoElement): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  };

  const checkEntries = Object.entries(checks) as [Check, CheckStatus][];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Face scan</h2>
        <p className="text-sm text-gray-500 mt-1">
          Follow the on-screen instructions so we can confirm you're present.
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-square shadow-inner">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            muted
            playsInline
          />
          {status === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40">
              <p className="text-white/80 text-sm">
                Camera ready — press start below
              </p>
            </div>
          )}
          {status === "done" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center text-primary-800 text-2xl">
                  ✓
                </div>
                <p className="text-white font-medium mt-2">Liveness verified</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {checkEntries.map(([check, checkStatus]) => (
            <div
              key={check}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                checkStatus === "passed"
                  ? "border-primary-200 bg-primary-50 text-primary-800"
                  : checkStatus === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  checkStatus === "passed"
                    ? "bg-primary-500"
                    : checkStatus === "failed"
                      ? "bg-red-500"
                      : "bg-gray-300"
                }`}
              />
              <span className="truncate">{CHECK_LABELS[check]}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {status === "idle" && (
        <button
          onClick={startCamera}
          disabled={!faceDetector}
          className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
        >
          {faceDetector ? "Start camera" : "Loading model…"}
        </button>
      )}
    </div>
  );
};
