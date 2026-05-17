import { useState } from "react";

type ContactStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

type ContactFields = {
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export const ContactStep = (props: ContactStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFields>({
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const attributes = (
        Object.entries(form) as Array<[keyof ContactFields, string]>
      )
        .filter(([, value]) => value !== "")
        .map(([key, value]) => ({
          attribute: `contact_information.${key}`,
          value,
          attributeType: "STRING" as const,
        }));
      const res = await fetch(
        `${workflowsApiUrl}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/attributes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attributes }),
        },
      );
      if (!res.ok) throw new Error("Submit failed");
      onComplete();
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{
    name: keyof ContactFields;
    label: string;
    type?: string;
    span?: 1 | 2;
    placeholder?: string;
  }> = [
    {
      name: "phone",
      label: "Phone",
      type: "tel",
      span: 2,
      placeholder: "+1 555 123 4567",
    },
    {
      name: "address",
      label: "Street address",
      span: 2,
      placeholder: "123 Main Street",
    },
    { name: "city", label: "City", placeholder: "Ljubljana" },
    { name: "postalCode", label: "Postal code", placeholder: "1000" },
    { name: "country", label: "Country", span: 2, placeholder: "Slovenia" },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          Contact information
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We may use these details to reach you about your verification.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 content-start">
        {fields.map((field) => (
          <div
            key={field.name}
            className={field.span === 2 ? "col-span-2" : ""}
          >
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            <input
              type={field.type ?? "text"}
              name={field.name}
              value={form[field.name]}
              onChange={handleChange}
              required
              placeholder={field.placeholder}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
};
