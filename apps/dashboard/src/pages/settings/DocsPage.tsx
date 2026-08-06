import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Code2,
  Copy,
  KeyRound,
  Sparkles,
  Webhook,
  type LucideIcon,
} from "lucide-react";

// In-app documentation. Lives at /settings/docs and is rendered exactly
// like the rest of the Settings area (single scrolling page, p-8 wrapper,
// text-2xl page heading). Content is grouped under four tabs — Getting
// started, API reference, Webhooks, Recipes.

type Tab = "start" | "api" | "webhooks" | "recipes";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "start", label: "Getting started", Icon: Sparkles },
  { id: "api", label: "API reference", Icon: Code2 },
  { id: "webhooks", label: "Webhooks", Icon: Webhook },
  { id: "recipes", label: "Recipes", Icon: Bookmark },
];

export const DocsPage = () => {
  const [tab, setTab] = useState<Tab>("start");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything you need to embed UserCore into your product — from your
          first verified customer to the full webhook + customer-API surface.
        </p>
      </div>

      {/* Tab bar — same pattern the dashboard uses on CustomerDetailPage's
          tab strip: border-bottom + underline-on-active. */}
      <div className="flex border-b border-gray-200 mb-8 -mx-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary-500 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <t.Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "start" && <GettingStartedTab />}
      {tab === "api" && <ApiReferenceTab />}
      {tab === "webhooks" && <WebhooksTab />}
      {tab === "recipes" && <RecipesTab />}
    </div>
  );
};

// ── Reusable bits ──────────────────────────────────────────────────────────

const Section = ({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="space-y-4">
    <div>
      <h2 className="text-xl font-bold text-gray-900 scroll-mt-20">{title}</h2>
      {intro && <p className="mt-2 text-sm text-gray-600">{intro}</p>}
    </div>
    {children}
  </section>
);

const Subhead = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-base font-semibold text-gray-900">{children}</h3>
);

const Prose = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
);

const InlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="font-mono text-[12.5px] bg-gray-100 text-gray-800 rounded px-1.5 py-0.5">
    {children}
  </code>
);

const Callout = ({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: React.ReactNode;
}) => {
  const toneClass =
    tone === "warn"
      ? "border-yellow-200 bg-yellow-50 text-yellow-900"
      : "border-primary-200 bg-primary-50 text-primary-900";
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${toneClass}`}
    >
      {children}
    </div>
  );
};

const CodeBlock = ({
  title,
  language = "ts",
  children,
}: {
  title?: string;
  language?: string;
  children: string;
}) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-900">
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          {language}
        </span>
        {title && (
          <span className="text-xs font-mono text-gray-300">{title}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(children)}
        title="Copy"
        className="text-gray-400 hover:text-gray-200 p-1 rounded transition-colors"
      >
        <Copy size={12} />
      </button>
    </div>
    <pre className="px-4 py-3 text-[13px] leading-relaxed font-mono text-gray-200 overflow-x-auto">
      <code>{children}</code>
    </pre>
  </div>
);

const MethodBadge = ({ method }: { method: "GET" | "POST" }) => {
  const cls =
    method === "GET"
      ? "bg-blue-100 text-blue-700"
      : "bg-primary-200 text-primary-800";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {method}
    </span>
  );
};

const Endpoint = ({
  method,
  path,
  summary,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  summary: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
      <MethodBadge method={method} />
      <span className="font-mono text-sm text-gray-900">{path}</span>
    </div>
    <div className="p-5 space-y-4">
      <p className="text-sm text-gray-600">{summary}</p>
      {children}
    </div>
  </div>
);

const Field = ({
  name,
  type,
  required,
  desc,
}: {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}) => (
  <div className="py-2.5 grid grid-cols-[180px_1fr] gap-4 items-start">
    <div className="min-w-0">
      <div className="font-mono text-[12.5px] text-gray-900 font-medium truncate">
        {name}
      </div>
      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
        {type}
        {required && (
          <span className="ml-2 text-red-600 not-italic">required</span>
        )}
      </div>
    </div>
    <div className="text-sm text-gray-600 leading-relaxed">{desc}</div>
  </div>
);

const FieldGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
      {title}
    </div>
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
      {children}
    </div>
  </div>
);

// ── Getting started ────────────────────────────────────────────────────────

const GettingStartedTab = () => (
  <div className="space-y-12">
    <Section
      id="welcome"
      title="What UserCore is"
      intro="UserCore is a drop-in identity verification platform. You embed a single iframe in your product, the customer completes the steps you configured (terms, email, ID scan, face liveness, proof of residence, contact details), your reviewers approve or reject in our dashboard, and your app gets notified."
    >
      <Prose>
        Think of it as Stripe for KYC: you don't build a verification UI, you
        don't shop for AML providers, you don't write a review queue. You wire
        in one widget and one event handler, and the rest is configured in the
        dashboard by your compliance officer.
      </Prose>
      <Prose>
        This page is everything you need to ship that integration. The other
        tabs cover the public API surface, webhook events, and common
        integration patterns.
      </Prose>
    </Section>

    <Section
      id="quickstart"
      title="Quickstart"
      intro="The whole integration is an API key, one fetch on your backend, and one iframe on your frontend. Three steps, usually an afternoon."
    >
      <div className="space-y-5">
        <div>
          <Subhead>1. Get an API key</Subhead>
          <Prose>
            In the dashboard, head to{" "}
            <InlineCode>Settings → API keys</InlineCode> and create one. The
            secret is shown once at creation; store it in your backend env as{" "}
            <InlineCode>USERCORE_API_KEY</InlineCode>. The key is scoped to a
            single workspace.
          </Prose>
        </div>

        <div>
          <Subhead>2. Create a session from your backend</Subhead>
          <Prose>
            Before the customer sees the widget, your backend mints a
            verification session. The session is what the iframe loads.
          </Prose>
          <div className="mt-3">
            <CodeBlock title="backend.ts" language="ts">{`const r = await fetch(
  "https://api.usercore.app/workflows/workflow-sessions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${process.env.USERCORE_API_KEY}\`,
    },
    body: JSON.stringify({
      externalSessionId: \`signup_\${user.id}\`,
      externalSessionSource: "widget",
      customerId: user.id,
    }),
  },
);
const { id: sessionId } = await r.json();`}</CodeBlock>
          </div>
          <Callout tone="info">
            <strong>workflowId is optional.</strong> Omit it and the session
            uses your workspace's default workflow — the one with the{" "}
            <em>default</em> pill on the workflows page. Set a default once and
            your code stops caring which workflow handles the flow.
          </Callout>
        </div>

        <div>
          <Subhead>3. Mount the widget</Subhead>
          <Prose>
            Drop a single iframe into your sign-up page. The widget carries its
            own brand, its own step list, its own phone-handoff QR.
          </Prose>
          <div className="mt-3">
            <CodeBlock title="signup.tsx" language="tsx">{`<iframe
  src={\`https://widget.usercore.app/?session=\${sessionId}\`}
  allow="camera; microphone"
  className="w-full max-w-lg h-[760px] border-0"
/>`}</CodeBlock>
          </div>
          <Callout tone="warn">
            <strong>
              <InlineCode>allow=&quot;camera; microphone&quot;</InlineCode> is
              required.
            </strong>{" "}
            Without it the browser will not expose the user's camera to the
            iframe and the document-scan + face-liveness steps will fail
            silently.
          </Callout>
        </div>
      </div>
    </Section>

    <Section
      id="concepts"
      title="Concepts"
      intro="Five things to understand before you wire anything up."
    >
      <div className="space-y-4">
        <ConceptCard
          title="Workspace"
          body="A workspace owns a set of workflows, customers, members, and API keys. One organisation can have many workspaces (e.g. one per product line). API keys are workspace-scoped — a key from workspace A cannot see customers from workspace B."
        />
        <ConceptCard
          title="Workflow"
          body="A workflow is the recipe for what a customer goes through. It contains up to five top-level steps — identity verification, duplicate detection, AML screening, fraud detection, rules engine — that you toggle on or off. Inside identity verification, six sub-steps (terms, email, ID scan, face liveness, proof of residence, contact information) can be enabled individually."
        />
        <ConceptCard
          title="Session"
          body="One customer's run through one workflow. Created by your backend, mounted in the widget, finalised by a reviewer. A customer can have multiple sessions over time (e.g. re-verification after a workflow change)."
        />
        <ConceptCard
          title="Customer"
          body="A person being verified, identified by the customerId your app passes when creating a session. The same customerId across multiple sessions is treated as the same person — UserCore aggregates their history under one customer profile."
        />
        <ConceptCard
          title="Verification status"
          body="What state a customer's most recent session is in. PENDING (created, not started), IN_PROGRESS (customer is mid-flow), REQUIRES_REVIEW (submitted, waiting on a reviewer), SUCCEEDED (approved), FAILED (rejected). Your app should gate features off this value."
        />
      </div>
    </Section>

    <Section
      id="plans"
      title="Plans & limits"
      intro="UserCore plans are sales-led — your account is provisioned by the UserCore team. Each plan unlocks a different feature ceiling."
    >
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Feature</th>
              <th className="text-left font-medium px-4 py-2.5">Starter</th>
              <th className="text-left font-medium px-4 py-2.5 bg-primary-50/40">
                Growth
              </th>
              <th className="text-left font-medium px-4 py-2.5">Enterprise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ["Verifications / month", "100", "1,000", "Unlimited"],
              ["Workflows / workspace", "1", "Unlimited", "Unlimited"],
              ["Workspaces / org", "1", "5", "Unlimited"],
              ["Members / org", "2", "10", "Unlimited"],
              ["Scenarios", "—", "Unlimited", "Unlimited"],
              ["AML + fraud providers", "—", "Included", "Included"],
              ["Custom branding", "—", "Yes", "Yes"],
              ["White-label (hide UserCore)", "—", "—", "Yes"],
            ].map(([label, s, g, e]) => (
              <tr key={label}>
                <td className="px-4 py-2.5 text-gray-700">{label}</td>
                <td className="px-4 py-2.5 text-gray-900">{s}</td>
                <td className="px-4 py-2.5 text-gray-900 bg-primary-50/40">
                  {g}
                </td>
                <td className="px-4 py-2.5 text-gray-900">{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  </div>
);

const ConceptCard = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="text-sm font-bold text-gray-900">{title}</div>
    <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{body}</p>
  </div>
);

// ── API reference ──────────────────────────────────────────────────────────

const ApiReferenceTab = () => (
  <div className="space-y-12">
    <Section
      id="auth"
      title="Authentication"
      intro="Every public endpoint is gated by a workspace API key, sent as a Bearer token in the Authorization header. The key is workspace-scoped — it sees only customers and sessions in the workspace it was created in."
    >
      <CodeBlock language="http">{`Authorization: Bearer uc_live_abcd1234efgh5678`}</CodeBlock>
      <Callout tone="warn">
        Treat the key as a secret. <strong>Never ship it to the browser</strong>{" "}
        — it should live in your backend env and be used server-side only.
        Frontend code receives only the <InlineCode>sessionId</InlineCode> your
        backend returns from the create-session call.
      </Callout>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-primary-700" />
            <span className="text-sm font-semibold text-gray-900">
              Get a key
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Settings → API keys → New key. The secret is shown once at creation.
            UserCore stores only a SHA-256 hash.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Bookmark size={14} className="text-primary-700" />
            <span className="text-sm font-semibold text-gray-900">
              Base URL
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-600 font-mono">
            https://api.usercore.app
          </p>
        </div>
      </div>
    </Section>

    <Section
      id="sessions"
      title="Sessions"
      intro="Endpoints for creating and reading a customer's verification session."
    >
      <Endpoint
        method="POST"
        path="/workflows/workflow-sessions"
        summary="Create a new verification session for a customer. The returned sessionId is what you pass to the widget iframe."
      >
        <FieldGroup title="Body">
          <Field
            name="customerId"
            type="string"
            required
            desc="Your app's internal id for this person. Use the same value across re-verifications — UserCore aggregates a customer's history under it."
          />
          <Field
            name="externalSessionId"
            type="string"
            required
            desc="A unique id for this session, generated by your app. Useful for idempotent retries."
          />
          <Field
            name="externalSessionSource"
            type='"widget"'
            required
            desc='Always set to "widget" for SDK-driven flows.'
          />
          <Field
            name="workflowId"
            type="string?"
            desc="Optional. If omitted, the workspace's default workflow is used."
          />
        </FieldGroup>
        <FieldGroup title="Response 201">
          <Field
            name="id"
            type="string"
            desc="The sessionId — pass this to the widget iframe."
          />
          <Field
            name="customerId"
            type="string"
            desc="Echoes the customerId you supplied."
          />
          <Field
            name="workflowId"
            type="string"
            desc="The workflow this session was created against."
          />
          <Field
            name="verificationMode"
            type='"sandbox" | "production"'
            desc="Inherited from the workflow's mode."
          />
        </FieldGroup>
        <CodeBlock language="bash">{`curl -X POST https://api.usercore.app/workflows/workflow-sessions \\
  -H "Authorization: Bearer $USERCORE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": "user_abc123",
    "externalSessionId": "signup_2026_06_25",
    "externalSessionSource": "widget"
  }'`}</CodeBlock>
      </Endpoint>

      <Endpoint
        method="GET"
        path="/workflows/workflow-sessions/:id"
        summary="Read a session by its id. Returns the session, every sub-step status, every captured attribute, and the activity timeline."
      >
        <Callout tone="info">
          Most apps don't call this directly — they cache the customer snapshot
          from the <InlineCode>kyc.completed</InlineCode> webhook (see the
          Webhooks tab) and only hit this endpoint when they need the full audit
          trail for compliance.
        </Callout>
      </Endpoint>
    </Section>

    <Section
      id="customers"
      title="Customers"
      intro="Public read-side endpoints for displaying verified-customer data in your app — name, email, country, status."
    >
      <Endpoint
        method="GET"
        path="/workflows/customers/:customerId"
        summary="Fetch the snapshot of a customer by your internal id. Returns 404 if the customer hasn't started a session in your workspace."
      >
        <FieldGroup title="Response 200">
          <Field name="customerId" type="string" desc="Your internal id." />
          <Field
            name="email"
            type="string | null"
            desc="The verified email address captured during the email-verification sub-step."
          />
          <Field
            name="firstName"
            type="string | null"
            desc="First name as read from the customer's identity document."
          />
          <Field
            name="lastName"
            type="string | null"
            desc="Last name as read from the customer's identity document."
          />
          <Field
            name="country"
            type="string | null"
            desc="ISO 3166 alpha-3 country code (resident country preferred; falls back to issuing country of the document)."
          />
          <Field
            name="status"
            type='"SUCCEEDED" | "REQUIRES_REVIEW" | "FAILED" | "IN_PROGRESS" | "PENDING" | null'
            desc="The latest identity-verification step status. SUCCEEDED = approved by a reviewer; REQUIRES_REVIEW = customer submitted, awaiting a decision."
          />
          <Field
            name="lastVerifiedAt"
            type="string"
            desc="ISO 8601 timestamp of the customer's most recent session."
          />
        </FieldGroup>
      </Endpoint>

      <Endpoint
        method="GET"
        path="/workflows/customers/by-email"
        summary="Look up a customer by their verified email address. Returns the same snapshot as the by-id endpoint. Useful for OTP-login flows where the user types their email and you need to find their customerId."
      >
        <FieldGroup title="Query">
          <Field
            name="email"
            type="string"
            required
            desc="The verified email to search for. Case-insensitive."
          />
        </FieldGroup>
        <CodeBlock language="bash">{`curl https://api.usercore.app/workflows/customers/by-email?email=anja@example.com \\
  -H "Authorization: Bearer $USERCORE_API_KEY"`}</CodeBlock>
      </Endpoint>
    </Section>

    <Section
      id="errors"
      title="Error responses"
      intro="Every endpoint returns JSON errors in the same shape."
    >
      <CodeBlock language="json">{`{ "error": "Invalid or revoked API key" }`}</CodeBlock>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-4 py-2.5 font-mono">400</td>
              <td className="px-4 py-2.5 text-gray-700">
                Bad request — missing required field or invalid format.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono">401</td>
              <td className="px-4 py-2.5 text-gray-700">
                Missing or invalid API key.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono">403</td>
              <td className="px-4 py-2.5 text-gray-700">
                Plan quota exceeded, or the API key's workspace doesn't have
                access to the requested resource.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono">404</td>
              <td className="px-4 py-2.5 text-gray-700">
                Resource doesn't exist in this workspace.
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono">409</td>
              <td className="px-4 py-2.5 text-gray-700">
                Conflict — e.g. attempting to verify an email already linked to
                another customer in the workspace.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  </div>
);

// ── Webhooks ───────────────────────────────────────────────────────────────

const WebhooksTab = () => (
  <div className="space-y-12">
    <Section
      id="overview"
      title="How webhooks work"
      intro="UserCore notifies your backend whenever something happens to a customer — when their submission lands on the review queue, when a reviewer makes a decision, when a rules-engine scenario fires. You subscribe to events at one URL on your side and update your own user model in response."
    >
      <Prose>
        Your webhook URL is configured by the UserCore team during onboarding.
        Each delivery is a <InlineCode>POST</InlineCode> with a JSON body, an{" "}
        <InlineCode>X-Usercore-Event</InlineCode> header identifying the event
        type, and an <InlineCode>X-Usercore-Signature</InlineCode> header you
        can verify against your webhook secret to prove the request came from
        UserCore.
      </Prose>
      <Callout tone="info">
        <strong>Two patterns work.</strong> Most apps subscribe to{" "}
        <InlineCode>kyc.completed</InlineCode> and update a{" "}
        <InlineCode>kyc_status</InlineCode> column on their users table from the
        payload — no round-trip to UserCore per read. If you need richer data,
        hit <InlineCode>GET /workflows/customers/:customerId</InlineCode> on
        demand.
      </Callout>
    </Section>

    <Section
      id="kyc-completed"
      title="kyc.completed"
      intro="Fires when a reviewer makes a final decision (approve / reject / flag) on a customer's session. This is the event 90% of integrations subscribe to."
    >
      <CodeBlock title="kyc.completed" language="json">{`{
  "event": "kyc.completed",
  "workflowSessionId": "session_8x2k7q",
  "customerId": "user_abc123",
  "workspaceId": "ws_n6c4a",
  "status": "approved",
  "riskLevel": "low",
  "firstName": "Anja",
  "lastName": "Novak",
  "dateOfBirth": "1992-05-14",
  "nationality": "SVN",
  "country": "SVN",
  "reviewedAt": "2026-06-25T14:32:18.401Z",
  "reviewedBy": "reviewer_2k3a",
  "reason": null
}`}</CodeBlock>
      <FieldGroup title="Fields">
        <Field
          name="status"
          type='"approved" | "rejected" | "flagged"'
          desc="The decision the reviewer made. Approved = clear to use your product. Rejected = locked out. Flagged = manually under review (stays in the queue)."
        />
        <Field
          name="riskLevel"
          type='"low" | "medium" | "high"'
          desc="Derived from AML screening if enabled on the workflow. Use this to drive product behaviour (e.g. transaction caps for medium-risk)."
        />
        <Field
          name="reason"
          type="string | null"
          desc="If rejected or flagged, the reviewer's reason — a free-text note or a code from your workflow's reject-reason catalog."
        />
      </FieldGroup>
    </Section>

    <Section
      id="kyc-notification"
      title="kyc.notification"
      intro="Fires when a customer adds a notification email on the widget's success screen, asking to be emailed when their review completes. You'd typically forward this to your own email service if you want to handle the outreach."
    >
      <CodeBlock title="kyc.notification" language="json">{`{
  "event": "kyc.notification",
  "customerId": "user_abc123",
  "email": "anja@example.com",
  "status": "REQUIRES_REVIEW",
  "reason": null
}`}</CodeBlock>
    </Section>

    <Section
      id="scenario-triggered"
      title="scenario.triggered"
      intro="Fires when a rules-engine scenario matches a customer's attributes. Use this to mirror the rule's action in your own system — flag the user, freeze their account, send them an internal note."
    >
      <CodeBlock title="scenario.triggered" language="json">{`{
  "event": "scenario.triggered",
  "scenarioId": "scen_pep_match",
  "customerId": "user_abc123",
  "workspaceId": "ws_n6c4a",
  "actionType": "flag",
  "actionValue": "PEP match — review before onboarding."
}`}</CodeBlock>
    </Section>
  </div>
);

// ── Recipes ────────────────────────────────────────────────────────────────

const RecipesTab = () => (
  <div className="space-y-12">
    <Section
      id="signup-recipe"
      title="Verify a customer at signup"
      intro="The most common integration. Your sign-up form collects nothing identity-related — UserCore handles all of it through the widget."
    >
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
        <li>
          User submits your sign-up form (just email + password, or whatever
          your minimum is).
        </li>
        <li>Your backend creates a UserCore session keyed by your user id.</li>
        <li>
          Your frontend mounts the widget. The user completes the workflow
          (terms, email OTP, ID scan, face liveness, …).
        </li>
        <li>
          The widget posts <InlineCode>usercore.widget.complete</InlineCode> to
          the parent window when submitted. Show a "we'll email you when review
          is done" screen.
        </li>
        <li>
          Your <InlineCode>kyc.completed</InlineCode> webhook handler flips your
          user's <InlineCode>kyc_status</InlineCode> to{" "}
          <InlineCode>approved</InlineCode> / <InlineCode>rejected</InlineCode>.
        </li>
        <li>Email the user. They log back in. Done.</li>
      </ol>
      <CodeBlock title="signup.tsx" language="tsx">{`useEffect(() => {
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== "https://widget.usercore.app") return;
    if (e.data?.type === "usercore.widget.complete") {
      router.push("/signup/success");
    }
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}, []);`}</CodeBlock>
    </Section>

    <Section
      id="login-recipe"
      title="Use the verified email for OTP login"
      intro="If your product uses email + OTP login (no passwords), you can lean on UserCore as the source of truth for which emails are real."
    >
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
        <li>User types their email on your login page.</li>
        <li>
          Your backend calls{" "}
          <InlineCode>GET /workflows/customers/by-email</InlineCode>. If the
          response is 404, refuse to send an OTP (the email isn't tied to a
          verified customer).
        </li>
        <li>
          If 200, generate + send your own OTP. On verify, look up your user by
          the returned <InlineCode>customerId</InlineCode>.
        </li>
      </ol>
      <CodeBlock language="ts">{`// /api/login/start
const r = await fetch(
  \`https://api.usercore.app/workflows/customers/by-email?email=\${email}\`,
  { headers: { Authorization: \`Bearer \${KEY}\` } },
);
if (r.status === 404) return { error: "No account with that email." };
const { customerId } = await r.json();
// Generate + send your OTP, then on verify map customerId → your user.`}</CodeBlock>
    </Section>

    <Section
      id="gate-recipe"
      title="Gate features on verification status"
      intro="A common ask: hide a feature (transfer money, withdraw, post a listing) until the user is approved."
    >
      <Prose>
        Read the <InlineCode>kyc_status</InlineCode> column you've been keeping
        in sync from the <InlineCode>kyc.completed</InlineCode> webhook. Branch
        your UI on it.
      </Prose>
      <CodeBlock language="tsx">{`if (user.kyc_status === "approved") {
  return <TransferForm />;
}
if (user.kyc_status === "pending") {
  return <Notice>Your account is under review. We'll email you.</Notice>;
}
return <StartVerification />;`}</CodeBlock>
    </Section>

    <Section
      id="resubmission-recipe"
      title="Handle a resubmission request"
      intro="When a reviewer needs the customer to redo a step (e.g. the ID photo was blurry), the workflow session bounces back to the customer. Your app should email them with a fresh link to the widget."
    >
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
        <li>
          UserCore fires <InlineCode>kyc.completed</InlineCode> with{" "}
          <InlineCode>status: "flagged"</InlineCode> and a{" "}
          <InlineCode>reason</InlineCode>.
        </li>
        <li>
          Your handler creates a new session for the same customerId and stores
          the new <InlineCode>sessionId</InlineCode>.
        </li>
        <li>
          Email the customer a link that mounts the widget on that session.
        </li>
      </ol>
      <Callout tone="info">
        UserCore also sends the customer a branded resubmission email
        automatically if you've configured the workflow's email branding — so in
        most cases you don't need to do anything here, just let your product UX
        reflect the new status.
      </Callout>
    </Section>

    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-200 text-primary-700 flex items-center justify-center shrink-0">
          <BookOpen size={20} />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Stuck on something not in the docs?
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Reach out to your account manager or email{" "}
            <span className="font-mono">support@usercore.app</span> — most
            answers come back same-day.
          </div>
        </div>
      </div>
      <a
        href="mailto:support@usercore.app"
        className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm shrink-0"
      >
        Contact support <ArrowRight size={14} />
      </a>
    </div>
  </div>
);
