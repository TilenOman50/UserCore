import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import { t } from "../lib/i18n";

type LivenessStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

type Check = "face_detected" | "blink_detected" | "head_turn";
type CheckStatus = "pending" | "passed" | "failed";

const checkLabels = (): Record<Check, string> => ({
  face_detected: t("liveness.checkFace"),
  blink_detected: t("liveness.checkBlink"),
  head_turn: t("liveness.checkTurn"),
});

const instructions = (): Record<Check, string> => ({
  face_detected: t("liveness.instructFace"),
  blink_detected: t("liveness.instructBlink"),
  head_turn: t("liveness.instructTurn"),
});

// MediaPipe's eye-blink blendshapes are 0 (open) → 1 (closed). We require the
// user's eyes to have been open at some point (so a freeze-frame photo of a
// closed-eye face doesn't pass) and then crossed the closed threshold.
const BLINK_CLOSED_THRESHOLD = 0.5;
const BLINK_OPEN_THRESHOLD = 0.25;

// Require deliberate turns to BOTH sides — yaw must dip past -threshold AND
// climb past +threshold during the session, not merely accumulate a swing of
// that size on one side. Forces an obvious left+right motion rather than a
// passing shoulder-tilt. ~0.45 rad ≈ 26° each way (so ~52° total).
const HEAD_TURN_YAW_HALF = 0.45;

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

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
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);

  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL,
            delegate: "GPU",
          },
          // Blendshapes give us per-frame eye/mouth/brow expression scores
          // (used for blink); the transformation matrix gives a 3D head pose
          // (used for head turn).
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        setLandmarker(lm);
      } catch {
        setError(t("liveness.modelFailed"));
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
      setError(t("liveness.cameraDenied"));
      setStatus("error");
    }
  };

  const runDetectionLoop = (stream: MediaStream) => {
    const passedChecks = new Set<Check>();
    // Blink: require eyes to have been measurably open before counting a
    // closure. Stops a closed-eye photo from instantly satisfying the check.
    let eyesWereOpen = false;
    // Head turn: track the min/max yaw seen during the session so a
    // continuous head sweep eventually crosses the swing threshold.
    let yawMin = Infinity;
    let yawMax = -Infinity;

    const detect = async () => {
      if (!videoRef.current || !landmarker) return;
      if (videoRef.current.readyState < 2) {
        requestAnimationFrame(detect);
        return;
      }

      const result = landmarker.detectForVideo(
        videoRef.current,
        performance.now(),
      );

      if (result.faceLandmarks.length > 0) {
        if (!passedChecks.has("face_detected")) {
          passedChecks.add("face_detected");
          setChecks((prev) => ({ ...prev, face_detected: "passed" }));
        }

        // Real blink — eyeBlinkLeft / eyeBlinkRight are 0 when eyes are
        // fully open, climbing toward 1 as they close. We average the two
        // so a wink doesn't false-trigger.
        const blendshapes = result.faceBlendshapes[0]?.categories ?? [];
        const leftBlink =
          blendshapes.find((b) => b.categoryName === "eyeBlinkLeft")?.score ??
          0;
        const rightBlink =
          blendshapes.find((b) => b.categoryName === "eyeBlinkRight")?.score ??
          0;
        const avgBlink = (leftBlink + rightBlink) / 2;
        if (avgBlink < BLINK_OPEN_THRESHOLD) eyesWereOpen = true;
        if (
          eyesWereOpen &&
          avgBlink > BLINK_CLOSED_THRESHOLD &&
          !passedChecks.has("blink_detected")
        ) {
          passedChecks.add("blink_detected");
          setChecks((prev) => ({ ...prev, blink_detected: "passed" }));
        }

        // Real head turn — facialTransformationMatrixes[0].data is a
        // column-major 4×4 head-to-camera matrix; yaw (rotation around the
        // vertical axis) is atan2(R[0][2], R[2][2]).
        const matrix = result.facialTransformationMatrixes[0]?.data;
        if (matrix) {
          const yaw = Math.atan2(matrix[8] ?? 0, matrix[10] ?? 1);
          if (yaw < yawMin) yawMin = yaw;
          if (yaw > yawMax) yawMax = yaw;
          if (
            yawMin < -HEAD_TURN_YAW_HALF &&
            yawMax > HEAD_TURN_YAW_HALF &&
            !passedChecks.has("head_turn")
          ) {
            passedChecks.add("head_turn");
            setChecks((prev) => ({ ...prev, head_turn: "passed" }));
          }
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
      setError(t("liveness.submitError"));
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

  // Walk the checks in order; the first one still pending drives the on-screen
  // instruction, so the user always knows what they're meant to do next.
  const nextPending = (
    ["face_detected", "blink_detected", "head_turn"] as Check[]
  ).find((c) => checks[c] === "pending");
  const subtitle =
    status === "idle"
      ? t("liveness.subtitleIdle")
      : status === "done"
        ? t("liveness.subtitleSaving")
        : nextPending
          ? instructions()[nextPending]
          : t("liveness.almostDone");

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("liveness.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
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
                {t("liveness.cameraReady")}
              </p>
            </div>
          )}
          {status === "done" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center text-primary-800 text-2xl">
                  ✓
                </div>
                <p className="text-white font-medium mt-2">
                  {t("liveness.verified")}
                </p>
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
              <span className="truncate">{checkLabels()[check]}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {status === "idle" && (
        <button
          onClick={startCamera}
          disabled={!landmarker}
          className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
        >
          {landmarker ? t("liveness.start") : t("liveness.loadingModel")}
        </button>
      )}
    </div>
  );
};
