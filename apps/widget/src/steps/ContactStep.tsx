import { useState } from "react";

import { PhoneInput } from "../components/PhoneInput";
import { t } from "../lib/i18n";

type ContactStepProps = {
  workflowsApiUrl: string;
  sessionId: string;
  onComplete: () => void;
  // Admin-configured field set. When missing we render every field; when
  // present we render only the fields toggled true.
  config?: {
    fields?: {
      phone: boolean;
      email: boolean;
    };
  };
};

type ContactFields = {
  phone: string;
  email: string;
};

export const ContactStep = (props: ContactStepProps) => {
  const { workflowsApiUrl, sessionId, onComplete, config } = props;
  const enabledFields = config?.fields ?? { phone: true, email: true };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFields>({ phone: "", email: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Phone needs a country code AND a number. PhoneInput emits "" until both
    // are set, and the number sub-field's native `required` only covers the
    // digits — so an empty composed value here means the country code wasn't
    // picked. Block instead of silently dropping the phone on submit.
    if (enabledFields.phone && form.phone.trim() === "") {
      setError(t("contact.phoneCountryRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const attributes = (
        Object.entries(form) as Array<[keyof ContactFields, string]>
      )
        .filter(([key, value]) => enabledFields[key] && value !== "")
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
      setError(t("contact.error"));
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{
    name: keyof ContactFields;
    label: string;
    type: string;
    placeholder: string;
  }> = [
    {
      name: "phone",
      label: t("contact.phone"),
      type: "tel",
      placeholder: t("contact.phonePlaceholder"),
    },
    {
      name: "email",
      label: t("contact.email"),
      type: "email",
      placeholder: t("contact.emailPlaceholder"),
    },
  ];

  const visible = fields.filter((f) => enabledFields[f.name]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("contact.title")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t("contact.subtitle")}</p>
      </div>

      <div className="flex-1 space-y-4 content-start">
        {visible.map((f) => (
          <div key={f.name}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {f.label}
            </label>
            {f.name === "phone" ? (
              <PhoneInput
                value={form.phone}
                onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))}
                required
              />
            ) : (
              <input
                type={f.type}
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                required
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder:text-gray-300"
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 disabled:opacity-50 disabled:cursor-not-allowed text-primary-800 font-semibold rounded-xl transition-colors text-sm"
      >
        {loading ? t("contact.saving") : t("contact.continue")}
      </button>
    </form>
  );
};
