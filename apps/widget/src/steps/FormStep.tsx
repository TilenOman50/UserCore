import { useState } from "react";

type FormStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
};

type FormData = {
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
};

export const FormStep = (props: FormStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const attributes = (
        Object.entries(form) as Array<[keyof FormData, string]>
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

  const fields: Array<{ name: keyof FormData; label: string; type?: string }> =
    [
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "address", label: "Address" },
      { name: "city", label: "City" },
      { name: "country", label: "Country" },
    ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Contact information
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          We'll use this to reach you about your verification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div
            key={field.name}
            className={field.name === "address" ? "col-span-2" : ""}
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 text-primary-800 font-medium rounded-lg transition-colors text-sm"
      >
        {loading ? "Saving..." : "Continue"}
      </button>
    </form>
  );
};
