import type { ProviderShortName, WorkflowStepType } from "./hooks/useWorkflows";

// Single source of truth for the brand info each provider renders with —
// imported by the Providers page AND the workflow-editor chooser modal so
// both surfaces stay visually consistent (same icon, same naming).
export type ProviderMeta = {
  provider: ProviderShortName;
  // Vendor display name — used on the BYO card and the chooser's BYO mode.
  name: string;
  // UserCore-branded variant used on the managed card.
  managedName: string;
  category: string;
  description: string;
  needsSecret: boolean;
  // Path under /public — swapped from placeholder tiles to real vendor SVGs
  // when official brand assets are dropped into public/icons/providers/.
  iconUrl: string;
};

export const USERCORE_ICON_URL = "/icons/providers/usercore.svg";

export const PROVIDER_META: Record<ProviderShortName, ProviderMeta> = {
  idenfy: {
    provider: "idenfy",
    name: "iDenfy",
    managedName: "UserCore Identity",
    category: "Identity verification",
    description:
      "Hosted ID-scan, liveness and face-match. Used as an alternative to UserCore's in-house identity flow.",
    needsSecret: true,
    iconUrl: "/icons/providers/idenfy.jpg",
  },
  complyAdvantage: {
    provider: "complyAdvantage",
    name: "ComplyAdvantage",
    managedName: "UserCore AML",
    category: "AML screening",
    description:
      "Sanctions, PEP and adverse-media screening. Reviewer decisions feed back into workflow sessions.",
    needsSecret: false,
    iconUrl: "/icons/providers/complyadvantage.png",
  },
  ipQualityScore: {
    provider: "ipQualityScore",
    name: "IPQualityScore",
    managedName: "UserCore Fraud",
    category: "Fraud detection",
    description:
      "IP intelligence and device fingerprinting. Returns a 0–100 fraud score consumed by the rules engine.",
    needsSecret: false,
    iconUrl: "/icons/providers/ipqualityscore.jpg",
  },
};

// Convenience lookup: which provider (if any) does each workflow step type
// route to. Mirrors PROVIDER_OPTIONS in WorkflowDetailPage but flattened to
// a single shortName since each step has at most one option today.
export const STEP_PROVIDER: Partial<
  Record<WorkflowStepType, ProviderShortName>
> = {
  "identity-verification": "idenfy",
  "aml-screening": "complyAdvantage",
  "fraud-detection": "ipQualityScore",
};
