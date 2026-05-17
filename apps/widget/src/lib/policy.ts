import { t } from "./i18n";

// Per-substep "is this still valid under the current workflow config?"
// checks. The widget boot pass and desktop polling both run these to decide
// which substeps to mark complete on resume, so a policy change (TOC text
// edit, tightened country allowlist, newly-required contact field) re-prompts
// the customer for just the affected step.

export type Attribute = { attribute: string; value: string };

type IdScanConfig = {
  countryMode?: "all" | "allowed_only" | "blocked";
  countries?: string[] | null;
  documentTypes?: string[];
};

type ContactInfoConfig = {
  fields?: { phone: boolean; email: boolean };
};

type ProofOfResidenceConfig = {
  documentTypes?: string[];
};

const ALL_POR_DOC_TYPES = [
  "GAS_BILL",
  "INTERNET_BILL",
  "ELECTRICITY_BILL",
  "RENT_AGREEMENT",
  "BANK_STATEMENT",
];

type TermsConfig = {
  termsText?: string | null;
};

// Default consent text used when the admin hasn't supplied a custom one.
// Sourced from the i18n bundle so the customer sees it in their language
// AND we hash the locale-specific text — switching language between visits
// re-prompts, which is the correct legal behaviour.
export const getActiveTermsText = (config?: TermsConfig | null): string => {
  const custom = config?.termsText?.trim();
  return custom && custom.length > 0 ? custom : t("terms.defaultText");
};

// djb2 — deterministic across runs, no async, no extra dependency. Plenty for
// detecting "did the admin edit the text?" — collisions don't matter here.
export const hashText = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const attrValue = (attributes: Attribute[], name: string): string | undefined =>
  attributes.find((a) => a.attribute === name)?.value;

const isIdScanCountryAllowed = (
  code: string | undefined,
  config?: IdScanConfig | null,
): boolean => {
  if (!code) return false;
  const mode =
    config?.countryMode ??
    (config?.countries && config.countries.length > 0 ? "allowed_only" : "all");
  if (mode === "all") return true;
  const list = new Set(config?.countries ?? []);
  return mode === "blocked" ? !list.has(code) : list.has(code);
};

const ALL_ID_DOC_TYPES = ["PASSPORT", "ID_CARD", "DRIVER_LICENSE"];

const isIdScanDocTypeAllowed = (
  type: string | undefined,
  config?: IdScanConfig | null,
): boolean => {
  if (!type) return false;
  const allowed =
    config?.documentTypes && config.documentTypes.length > 0
      ? new Set(config.documentTypes)
      : new Set(ALL_ID_DOC_TYPES);
  return allowed.has(type);
};

type CompletionInput = {
  attributes: Attribute[];
  config: unknown;
};

// Each entry decides whether the substep is satisfied under the *current*
// config. If config is missing we fall back to "no restriction" — same shape
// the widget step components themselves use.
export const isSubStepComplete: Record<
  string,
  (input: CompletionInput) => boolean
> = {
  "terms-acceptance": ({ attributes, config }) => {
    if (attrValue(attributes, "terms_acceptance.accepted") !== "true")
      return false;
    const storedHash = attrValue(attributes, "terms_acceptance.policy_hash");
    const currentHash = hashText(
      getActiveTermsText(config as TermsConfig | undefined),
    );
    // No hash means it was accepted before we started tracking it — treat as
    // stale so the customer re-accepts under the now-recorded policy.
    return !!storedHash && storedHash === currentHash;
  },

  "email-verification": ({ attributes }) =>
    !!attrValue(attributes, "email_verification.email"),

  "id-scan": ({ attributes, config }) => {
    if (
      attrValue(attributes, "identity_verification.document_complete") !==
      "true"
    )
      return false;
    const c = config as IdScanConfig | undefined;
    const country = attrValue(
      attributes,
      "identity_verification.document_country",
    );
    const docType = attrValue(
      attributes,
      "identity_verification.document_type",
    );
    return (
      isIdScanCountryAllowed(country, c) && isIdScanDocTypeAllowed(docType, c)
    );
  },

  "face-scan": ({ attributes }) =>
    attrValue(attributes, "identity_verification.liveness_passed") === "true",

  "proof-of-residence": ({ attributes, config }) => {
    if (attrValue(attributes, "proof_of_residence.complete") !== "true")
      return false;
    const c = config as ProofOfResidenceConfig | undefined;
    const docType = attrValue(attributes, "proof_of_residence.document_type");
    if (!docType) return false;
    const allowed =
      c?.documentTypes && c.documentTypes.length > 0
        ? new Set(c.documentTypes)
        : new Set(ALL_POR_DOC_TYPES);
    return allowed.has(docType);
  },

  "contact-information": ({ attributes, config }) => {
    const c = config as ContactInfoConfig | undefined;
    const fields = c?.fields ?? { phone: true, email: true };
    const required = (Object.keys(fields) as Array<keyof typeof fields>).filter(
      (k) => fields[k],
    );
    if (required.length === 0) return true;
    return required.every((field) => {
      const v = attrValue(attributes, `contact_information.${field}`);
      return v !== undefined && v !== "";
    });
  },
};
