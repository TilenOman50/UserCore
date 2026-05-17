import { useRef, useState } from "react";

import { CountryPicker } from "../components/CountryPicker";
import { SelectField } from "../components/SelectField";
import { COUNTRIES } from "../lib/countries";

type DocumentStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
  // True when the widget is loaded on a phone via the handoff QR — only then
  // does the camera button make sense. Desktop sticks with the file picker.
  showCameraCapture?: boolean;
  // Admin-configured country + document-type rules.
  //   countryMode "all"          → any country (default)
  //   countryMode "allowed_only" → only countries listed in `countries`
  //   countryMode "blocked"      → any country EXCEPT those in `countries`
  // documentTypes missing/empty → all three types allowed.
  config?: {
    countryMode?: "all" | "allowed_only" | "blocked";
    countries?: string[] | null;
    documentTypes?: string[];
  };
};

type Side = "front" | "back";

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

const DOCUMENT_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "ID_CARD", label: "National ID" },
  { value: "DRIVER_LICENSE", label: "Driver's licence" },
];

const ALL_DOC_TYPE_VALUES = ["PASSPORT", "ID_CARD", "DRIVER_LICENSE"];

const requiresBack = (type: string) =>
  type === "ID_CARD" || type === "DRIVER_LICENSE";

export const DocumentStep = (props: DocumentStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete, showCameraCapture, config } =
    props;

  // Resolve the country list the widget should offer.
  // - "all" (or missing mode + no list): full ISO set.
  // - "allowed_only": only the listed codes.
  // - "blocked": every code EXCEPT the listed ones.
  // Backwards-compat: a non-empty `countries` with no mode is treated as
  // legacy allowed_only to match the original (pre-mode) schema.
  const inferredMode =
    config?.countryMode ??
    (config?.countries && config.countries.length > 0 ? "allowed_only" : "all");
  const listed = new Set(config?.countries ?? []);
  const allowedCountries =
    inferredMode === "all"
      ? COUNTRIES
      : inferredMode === "blocked"
        ? COUNTRIES.filter((c) => !listed.has(c.code))
        : COUNTRIES.filter((c) => listed.has(c.code));
  const docTypeValues =
    config?.documentTypes && config.documentTypes.length > 0
      ? config.documentTypes
      : ALL_DOC_TYPE_VALUES;
  const allowedDocTypes = DOCUMENT_TYPES.filter((t) =>
    docTypeValues.includes(t.value),
  );

  // No pre-selected country — the customer has to actively pick. The
  // CountryPicker shows "Select country" until then.
  const [country, setCountry] = useState("");
  const [documentType, setDocumentType] = useState(
    allowedDocTypes[0]?.value ?? "PASSPORT",
  );
  const [files, setFiles] = useState<Record<Side, File | null>>({
    front: null,
    back: null,
  });
  const [previews, setPreviews] = useState<Record<Side, string | null>>({
    front: null,
    back: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  const setSideFile = (side: Side, selected: File) => {
    setFiles((prev) => ({ ...prev, [side]: selected }));
    setPreviews((prev) => ({
      ...prev,
      [side]: URL.createObjectURL(selected),
    }));
  };

  const onFileChange =
    (side: Side) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) setSideFile(side, selected);
    };

  const needsBack = requiresBack(documentType);
  const ready =
    country !== "" &&
    files.front !== null &&
    (!needsBack || files.back !== null);

  const uploadOne = async (
    file: File,
    kind: "document_front" | "document_back",
  ) => {
    const formData = new FormData();
    const filename =
      file.name && file.name.length > 0
        ? file.name
        : `${kind}-${Date.now()}.jpg`;
    formData.append("file", file, filename);
    const res = await fetch(
      `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/files/${kind}`,
      { method: "POST", body: formData },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}) ${body}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(
        needsBack && !files.back
          ? "Please add a photo of the back of the document."
          : "Please add a photo of the document.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await uploadOne(files.front!, "document_front");
      if (needsBack && files.back) {
        await uploadOne(files.back, "document_back");
      }

      const attrRes = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "identity_verification.document_type",
                value: documentType,
                attributeType: "STRING",
              },
              {
                attribute: "identity_verification.document_country",
                value: country,
                attributeType: "STRING",
              },
              // Marker that signals the document step is fully done — used by
              // the widget's overview to mark id-scan complete even when only
              // document_front exists from a partial earlier run.
              {
                attribute: "identity_verification.document_complete",
                value: "true",
                attributeType: "BOOLEAN",
              },
            ],
          }),
        },
      );
      if (!attrRes.ok) {
        throw new Error(`Attribute write failed (${attrRes.status})`);
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
          Identity document
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload a clear photo of your government-issued ID.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Country of issue
        </label>
        <CountryPicker
          value={country}
          onChange={setCountry}
          countries={allowedCountries}
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Document type
        </label>
        <SelectField
          value={documentType}
          onChange={(value) => {
            setDocumentType(value);
            // Reset back if user switches to passport.
            if (!requiresBack(value)) {
              setFiles((prev) => ({ ...prev, back: null }));
              setPreviews((prev) => ({ ...prev, back: null }));
            }
          }}
          options={allowedDocTypes.map((t) => ({
            value: t.value,
            label: t.label,
          }))}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
        <UploadZone
          label={needsBack ? "Front" : "Photo page"}
          preview={previews.front}
          file={files.front}
          onClick={() => frontFileRef.current?.click()}
          onCameraClick={
            showCameraCapture
              ? () => frontCameraRef.current?.click()
              : undefined
          }
        />
        {needsBack && (
          <UploadZone
            label="Back"
            preview={previews.back}
            file={files.back}
            onClick={() => backFileRef.current?.click()}
            onCameraClick={
              showCameraCapture
                ? () => backCameraRef.current?.click()
                : undefined
            }
          />
        )}
      </div>

      <input
        ref={frontFileRef}
        type="file"
        accept="image/*"
        onChange={onFileChange("front")}
        className="hidden"
      />
      <input
        ref={backFileRef}
        type="file"
        accept="image/*"
        onChange={onFileChange("back")}
        className="hidden"
      />
      {showCameraCapture && (
        <>
          <input
            ref={frontCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange("front")}
            className="hidden"
          />
          <input
            ref={backCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange("back")}
            className="hidden"
          />
        </>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading || !ready}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Uploading…" : "Continue"}
      </button>
    </form>
  );
};

const UploadZone = ({
  label,
  preview,
  file,
  onClick,
  onCameraClick,
}: {
  label: string;
  preview: string | null;
  file: File | null;
  onClick: () => void;
  onCameraClick?: () => void;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      {file && (
        <span className="text-xs text-gray-400 truncate max-w-[200px]">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </span>
      )}
    </div>
    <div
      onClick={onClick}
      className="min-h-[120px] border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl p-3 text-center cursor-pointer transition-colors flex items-center justify-center"
    >
      {preview ? (
        <img
          src={preview}
          alt={`${label} preview`}
          className="max-h-28 max-w-full rounded-lg object-contain"
        />
      ) : (
        <div className="text-gray-400">
          <div className="mx-auto mb-2 w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
            <svg
              width="20"
              height="20"
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
          <p className="text-xs font-medium text-gray-600">Click to upload</p>
          <p className="text-[10px] mt-0.5 text-gray-400">JPG or PNG</p>
        </div>
      )}
    </div>
    {onCameraClick && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCameraClick();
        }}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
      >
        <CameraIcon />
        Take photo
      </button>
    )}
  </div>
);
