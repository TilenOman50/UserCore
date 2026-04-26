import { useRef, useState } from "react";

type DocumentStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
];

export const DocumentStep = (props: DocumentStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const [documentType, setDocumentType] = useState("passport");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a document file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);

      await fetch(
        `${workflowsApiUrl}/workflows/kyc-sessions/${sessionId}/documents`,
        { method: "POST", body: formData },
      );

      onComplete();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a clear photo of your identity document
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Document Type
        </label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-300 transition-colors"
      >
        {preview ? (
          <img
            src={preview}
            alt="Document preview"
            className="max-h-40 mx-auto rounded-lg object-cover"
          />
        ) : (
          <div className="text-gray-400">
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm">Click to upload your document</p>
            <p className="text-xs mt-1">JPG, PNG up to 10MB</p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !file}
        className="w-full py-2.5 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 text-primary-800 font-medium rounded-lg transition-colors text-sm"
      >
        {loading ? "Uploading..." : "Continue"}
      </button>
    </form>
  );
};
