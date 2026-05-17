import { useRef, useState } from "react";

type ProofOfResidenceStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
  // True when the widget is loaded on a phone via the handoff QR — only then
  // does the camera button make sense.
  showCameraCapture?: boolean;
};

const CameraIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const ProofOfResidenceStep = (props: ProofOfResidenceStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete, showCameraCapture } = props;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(
      selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      // Force a filename — iOS camera capture sometimes returns a file with
      // no name and the server multipart parser then drops the part.
      const filename =
        file.name && file.name.length > 0
          ? file.name
          : `proof-${Date.now()}.jpg`;
      formData.append("file", file, filename);
      const upload = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/files/proof_of_residence`,
        { method: "POST", body: formData },
      );
      if (!upload.ok) {
        const body = await upload.text().catch(() => "");
        throw new Error(`Upload failed (${upload.status}) ${body}`);
      }
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Proof of residence
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          A document dated within the last 3 months that shows your name and
          home address.
        </p>
      </div>

      <ul className="mb-4 text-xs text-gray-500 space-y-1">
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
          Utility bill (gas, electricity, water)
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
          Bank or credit-card statement
        </li>
        <li className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
          Official government letter
        </li>
      </ul>

      <div
        onClick={() => fileRef.current?.click()}
        className="flex-1 min-h-[180px] border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center"
      >
        {preview ? (
          <img
            src={preview}
            alt="Document preview"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : file ? (
          <div className="text-gray-600 text-sm">
            <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="font-medium truncate max-w-xs">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        ) : (
          <div className="text-gray-400">
            <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9.5 12 4l9 5.5" />
                <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
                <path d="M9 22V12h6v10" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">Click to upload</p>
            <p className="text-xs mt-1 text-gray-400">
              JPG, PNG or PDF, up to 10MB
            </p>
          </div>
        )}
      </div>

      {showCameraCapture && (
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="mt-3 inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 self-stretch"
        >
          <CameraIcon />
          Take photo with camera
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {showCameraCapture && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading || !file}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Uploading…" : "Continue"}
      </button>
    </form>
  );
};
