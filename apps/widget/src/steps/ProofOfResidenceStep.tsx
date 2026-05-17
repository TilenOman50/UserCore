import { useRef, useState } from "react";

import { CountryPicker } from "../components/CountryPicker";
import { SelectField } from "../components/SelectField";
import { t } from "../lib/i18n";

type ProofOfResidenceStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
  // True when the widget is loaded on a phone via the handoff QR — only then
  // does the camera button make sense.
  showCameraCapture?: boolean;
  // Admin-configured allowlist of accepted POR documents. When missing we
  // show all three. Address fields below are always required and aren't
  // configurable per substep.
  config?: { documentTypes?: string[] };
};

const porDocLabels = (): Record<string, string> => ({
  GAS_BILL: t("por.gasBill"),
  INTERNET_BILL: t("por.internetBill"),
  ELECTRICITY_BILL: t("por.electricityBill"),
  RENT_AGREEMENT: t("por.rentAgreement"),
  BANK_STATEMENT: t("por.bankStatement"),
});

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

type Address = {
  street: string;
  city: string;
  postalCode: string;
  country: string;
};

export const ProofOfResidenceStep = (props: ProofOfResidenceStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete, showCameraCapture, config } =
    props;
  const allowedTypes =
    config?.documentTypes && config.documentTypes.length > 0
      ? config.documentTypes
      : [
          "GAS_BILL",
          "INTERNET_BILL",
          "ELECTRICITY_BILL",
          "RENT_AGREEMENT",
          "BANK_STATEMENT",
        ];

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Customer-picked doc type. Persisted as an attribute so the policy
  // checker can compare against the admin's current allowlist on resume —
  // if the admin removes the chosen type later, the step re-prompts.
  const [documentType, setDocumentType] = useState<string>(
    allowedTypes[0] ?? "",
  );
  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postalCode: "",
    country: "",
  });
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

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const ready =
    file !== null &&
    documentType !== "" &&
    address.street.trim() !== "" &&
    address.city.trim() !== "" &&
    address.postalCode.trim() !== "" &&
    address.country.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(t("por.errorMissing"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      const filename =
        file!.name && file!.name.length > 0
          ? file!.name
          : `proof-${Date.now()}.jpg`;
      formData.append("file", file!, filename);
      const upload = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/files/proof_of_residence`,
        { method: "POST", body: formData },
      );
      if (!upload.ok) {
        const body = await upload.text().catch(() => "");
        throw new Error(`Upload failed (${upload.status}) ${body}`);
      }

      const attrRes = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: [
              {
                attribute: "proof_of_residence.document_type",
                value: documentType,
                attributeType: "STRING",
              },
              {
                attribute: "address.street",
                value: address.street,
                attributeType: "STRING",
              },
              {
                attribute: "address.city",
                value: address.city,
                attributeType: "STRING",
              },
              {
                attribute: "address.postal_code",
                value: address.postalCode,
                attributeType: "STRING",
              },
              {
                attribute: "address.country",
                value: address.country,
                attributeType: "STRING",
              },
              // Marker that signals both upload + address form are done. The
              // widget's overview keys off this to mark POR complete (rather
              // than the bare s3_key) so a half-done submission can't pass.
              {
                attribute: "proof_of_residence.complete",
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
          : t("por.errorUpload"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("por.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t("por.subtitle")}</p>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {t("por.type")}
        </label>
        <SelectField
          value={documentType}
          onChange={setDocumentType}
          options={allowedTypes.map((type) => ({
            value: type,
            label: porDocLabels()[type] ?? type,
          }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
        <div
          onClick={() => fileRef.current?.click()}
          className="min-h-[140px] border-2 border-dashed border-gray-200 hover:border-primary-300 rounded-xl p-3 text-center cursor-pointer transition-colors flex items-center justify-center"
        >
          {preview ? (
            <img
              src={preview}
              alt="Document preview"
              className="max-h-32 max-w-full rounded-lg object-contain"
            />
          ) : file ? (
            <div className="text-gray-600 text-sm">
              <p className="font-medium truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          ) : (
            <div className="text-gray-400">
              <p className="text-xs font-medium text-gray-600">
                {t("por.clickToUpload")}
              </p>
              <p className="text-[10px] mt-0.5 text-gray-400">
                {t("por.uploadHint")}
              </p>
            </div>
          )}
        </div>

        {showCameraCapture && (
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <CameraIcon />
            {t("por.takePhoto")}
          </button>
        )}

        <div className="border-t border-gray-100 pt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t("por.street")}
            </label>
            <input
              type="text"
              name="street"
              value={address.street}
              onChange={onAddressChange}
              required
              placeholder={t("por.streetPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t("por.city")}
              </label>
              <input
                type="text"
                name="city"
                value={address.city}
                onChange={onAddressChange}
                required
                placeholder={t("por.cityPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t("por.postalCode")}
              </label>
              <input
                type="text"
                name="postalCode"
                value={address.postalCode}
                onChange={onAddressChange}
                required
                placeholder={t("por.postalCodePlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {t("por.country")}
            </label>
            <CountryPicker
              value={address.country}
              onChange={(code) =>
                setAddress((prev) => ({ ...prev, country: code }))
              }
            />
          </div>
        </div>
      </div>

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
        disabled={loading || !ready}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? t("por.uploading") : t("por.continue")}
      </button>
    </form>
  );
};
