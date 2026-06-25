import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Eye,
  FileText,
  Github,
  Globe,
  Home,
  IdCard,
  Inbox,
  Linkedin,
  ListChecks,
  Mail,
  Palette,
  Phone,
  Play,
  Radio,
  RotateCcw,
  ScanFace,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sprout,
  TrendingUp,
  Twitter,
  Users,
  X,
} from "lucide-react";

// Sign-in still points at the dashboard (auth). Get-started / Book-a-demo
// CTAs open the demo modal — UserCore plans are sales-led, there's no
// in-app upgrade, so the right starting action is "talk to us."
const DASHBOARD_URL = "http://localhost:3000";

// ── App ────────────────────────────────────────────────────────────────────
const DemoModalCtx = createContext<{ open: () => void }>({ open: () => {} });
const useDemoModal = () => useContext(DemoModalCtx);

export const App = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const ctx = useMemo(() => ({ open: () => setModalOpen(true) }), []);
  return (
    <DemoModalCtx.Provider value={ctx}>
      <div className="min-h-screen bg-white text-gray-900">
        <Nav />
        <Hero />
        <TrustedBy />
        <Metrics />
        <Features />
        <ThreeViews />
        <HowItWorks />
        <UseCases />
        <Plans />
        <FinalCta />
        <Footer />
      </div>
      {modalOpen && <BookDemoModal onClose={() => setModalOpen(false)} />}
    </DemoModalCtx.Provider>
  );
};

// ── Brand mark (exact-match with dashboard sidebar + login) ────────────────
const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 bg-primary-200 rounded-xl flex items-center justify-center">
      <span className="font-bold text-primary-700">UC</span>
    </div>
    <span className="font-bold text-gray-900 text-lg tracking-tight">
      UserCore
    </span>
  </div>
);

// ── Nav ────────────────────────────────────────────────────────────────────
const Nav = () => {
  const { open } = useDemoModal();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        scrolled
          ? "bg-white/85 backdrop-blur border-b border-gray-200"
          : "bg-white"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-700">
          <a href="#product" className="hover:text-gray-900 transition-colors">
            Product
          </a>
          <a href="#how" className="hover:text-gray-900 transition-colors">
            How it works
          </a>
          <a
            href="#customers"
            className="hover:text-gray-900 transition-colors"
          >
            Customers
          </a>
          <a href="#plans" className="hover:text-gray-900 transition-colors">
            Plans
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={DASHBOARD_URL}
            className="hidden sm:inline-block text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2"
          >
            Sign in
          </a>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-200 hover:bg-primary-300 text-primary-800 text-sm font-medium px-4 py-2 transition-colors"
          >
            Book a demo <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

// ── Hero ───────────────────────────────────────────────────────────────────
const Hero = () => {
  const { open } = useDemoModal();
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[70vh]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(192, 225, 210, 0.45) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 lg:pt-24 lg:pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div>
          <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-gray-900">
            Customer verification,{" "}
            <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
              drop-in.
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
            Embed a fully-styled KYC flow into any product. Configure each step,
            review submissions in one dashboard, and ship in an afternoon — no
            compliance team rebuild required.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium px-5 py-3 transition-colors"
            >
              Book a demo <ArrowRight size={16} />
            </button>
            <a
              href="#views"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-800 font-medium px-5 py-3 transition-colors"
            >
              <Eye size={16} /> See it in action
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-primary-600" /> Sandbox + live
              from day one
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-primary-600" /> No long-term
              contract
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} className="text-primary-600" /> Branded out of
              the box
            </span>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
};

// Single hero mock — the KYC Review detail page, rendered as faithfully as
// we can make it. Anchored inside the dashboard's gray-50 wash so the
// transition between landing and product feels visually identical: same
// chrome, same status pills, same checks panel, same buttons.
const HeroVisual = () => (
  <div className="relative">
    <div
      className="absolute -inset-4 -z-10 rounded-3xl"
      style={{
        background:
          "radial-gradient(70% 60% at 50% 40%, rgba(192,225,210,0.3), rgba(255,255,255,0))",
      }}
    />
    <div className="rounded-2xl shadow-deep overflow-hidden border border-gray-200">
      <BrowserChrome url="app.usercore/kyc-review/SH4n12b">
        <KycReviewMock />
      </BrowserChrome>
    </div>
  </div>
);

// ── Trusted by ─────────────────────────────────────────────────────────────
const TRUSTED = [
  "Alpska Banka",
  "Workly",
  "Northwind Finance",
  "Atlas Studio",
  "Halcyon",
  "Brightway",
] as const;

const TrustedBy = () => (
  <section className="border-y border-gray-200 bg-gray-50">
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="text-center text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Trusted by teams shipping verification at
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {TRUSTED.map((name) => (
          <span
            key={name}
            className="text-gray-400 hover:text-gray-700 transition-colors font-semibold text-lg tracking-tight"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  </section>
);

// ── Metrics ────────────────────────────────────────────────────────────────
const METRICS = [
  { value: 1_240_000, label: "Verifications processed", suffix: "+" },
  { value: 190, label: "Countries supported", suffix: "+" },
  { value: 99.97, label: "Uptime", suffix: "%", decimals: 2 },
  { value: 3.4, label: "Avg. completion (min)", suffix: "", decimals: 1 },
] as const;

const Metrics = () => (
  <section className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {METRICS.map((m) => (
          <MetricCard
            key={m.label}
            value={m.value}
            decimals={"decimals" in m ? (m.decimals as number) : 0}
            suffix={m.suffix}
            label={m.label}
          />
        ))}
      </div>
    </div>
  </section>
);

const MetricCard = ({
  value,
  decimals,
  suffix,
  label,
}: {
  value: number;
  decimals: number;
  suffix: string;
  label: string;
}) => {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const start = performance.now();
        const dur = 1400;
        const step = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          setShown(value * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        obs.disconnect();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value]);
  const formatted =
    decimals > 0
      ? shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(shown).toLocaleString("en-US");
  return (
    <div ref={ref}>
      <div className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight tabular-nums">
        {formatted}
        <span className="text-primary-600">{suffix}</span>
      </div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
};

// ── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    Icon: ScanFace,
    title: "Drop-in widget",
    body: "One iframe. Customize the steps, brand it to your product, and the customer never knows the verification is third-party.",
  },
  {
    Icon: ShieldCheck,
    title: "Compliance, built in",
    body: "AML sanctions + PEP, fraud scoring, duplicate detection. Switch them on per workflow — no provider contracts to chase.",
  },
  {
    Icon: Inbox,
    title: "Review queue your team will use",
    body: "Manual approval when automation isn't enough. Approve, reject, or request resubmission with a full audit trail.",
  },
  {
    Icon: Sliders,
    title: "Workflows that match your risk",
    body: "Toggle steps. Restrict countries. Wire in scenarios. Banks and marketplaces deserve different flows, same infrastructure.",
  },
] as const;

const Features = () => (
  <section id="product" className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeading
        eyebrow="What you ship"
        title="Everything your team needs to verify a customer."
        subtitle="From the moment they click sign-up to the moment your reviewer makes a call — one platform, one dashboard, one API key."
      />

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-200 text-primary-700 flex items-center justify-center">
              <f.Icon size={20} strokeWidth={2.2} />
            </div>
            <h3 className="mt-5 font-bold text-gray-900 text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Three views (centerpiece) ──────────────────────────────────────────────
type View = "customer" | "reviewer" | "admin";

const VIEWS: { id: View; Icon: typeof Eye; title: string; blurb: string }[] = [
  {
    id: "admin",
    Icon: Sliders,
    title: "Admin",
    blurb:
      "What the compliance officer configures — steps, providers, scenarios, all per workflow.",
  },
  {
    id: "customer",
    Icon: Users,
    title: "Customer",
    blurb:
      "What the person being verified sees — a clean, branded flow that runs in your product.",
  },
  {
    id: "reviewer",
    Icon: Eye,
    title: "Reviewer",
    blurb:
      "What your compliance team sees — every check, every signal, one decision away from done.",
  },
];

const ThreeViews = () => {
  const [view, setView] = useState<View>("customer");
  const active = VIEWS.find((v) => v.id === view)!;
  return (
    <section id="views" className="bg-gray-50 border-y border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow="One product, three angles"
          title="See the same workflow from every chair."
          subtitle="Customers, reviewers, and admins each get a view of the same verification — and UserCore is the glue that makes them line up."
        />

        <div className="mt-12 flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setView(v.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                view === v.id
                  ? "bg-primary-200 text-primary-800"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <v.Icon size={14} />
              {v.title}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-600 max-w-2xl">{active.blurb}</p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-deep overflow-hidden">
          <BrowserChrome
            url={
              view === "customer"
                ? "your-app.com/sign-up"
                : view === "reviewer"
                  ? "app.usercore/kyc-review/SH4n12b"
                  : "app.usercore/settings/workflows/wkf_3kx2"
            }
          >
            {view === "customer" && <WidgetMock />}
            {view === "reviewer" && <KycReviewMock full />}
            {view === "admin" && <WorkflowEditorMock />}
          </BrowserChrome>
        </div>
      </div>
    </section>
  );
};

// ── How it works ───────────────────────────────────────────────────────────
const HowItWorks = () => (
  <section id="how" className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeading
        eyebrow="Integration"
        title="Three steps. One afternoon."
        subtitle="The whole integration is an API key, one fetch on your backend, and one iframe on your frontend. No SDK to install, no UI to design, no compliance vendor to interview."
      />

      <div className="mt-14 grid lg:grid-cols-3 gap-6">
        <StepCard
          n="01"
          title="Configure your workflow"
          body="In the dashboard, pick which steps your customers complete. Brand it, restrict the countries, set a default."
        >
          <WorkflowMiniMock />
        </StepCard>
        <StepCard
          n="02"
          title="Start a session"
          body="On your backend, POST a customerId with your workspace API key. The widget never sees the key — only the sessionId it returns."
        >
          <CodeMock
            title="backend.ts"
            lines={[
              {
                tokens: [
                  ["k", "const"],
                  ["t", " { id: sessionId } = "],
                  ["k", "await"],
                  ["f", " fetch"],
                  ["t", "("],
                ],
              },
              {
                tokens: [
                  ["t", "  "],
                  ["s", `"…/workflows/workflow-sessions"`],
                  ["t", ", {"],
                ],
              },
              {
                tokens: [
                  ["t", "    "],
                  ["a", "method"],
                  ["t", ": "],
                  ["s", `"POST"`],
                  ["t", ","],
                ],
              },
              {
                tokens: [
                  ["t", "    "],
                  ["a", "headers"],
                  ["t", ": { "],
                  ["a", "Authorization"],
                  ["t", ": "],
                  ["s", "`Bearer ${KEY}`"],
                  ["t", " },"],
                ],
              },
              {
                tokens: [
                  ["t", "    "],
                  ["a", "body"],
                  ["t", ": "],
                  ["f", "JSON.stringify"],
                  ["t", "({"],
                ],
              },
              {
                tokens: [
                  ["t", "      "],
                  ["a", "customerId"],
                  ["t", ", "],
                  ["a", "externalSessionId"],
                  ["t", ","],
                ],
              },
              {
                tokens: [
                  ["t", "      "],
                  ["a", "externalSessionSource"],
                  ["t", ": "],
                  ["s", `"widget"`],
                  ["t", ","],
                ],
              },
              { tokens: [["t", "    }),"]] },
              { tokens: [["t", "  }).then(r => r.json());"]] },
            ]}
          />
        </StepCard>
        <StepCard
          n="03"
          title="Mount the widget"
          body="Drop a single iframe into your page. It carries its own brand, its own steps, its own QR for phone handoff."
        >
          <CodeMock
            title="signup.tsx"
            lines={[
              {
                tokens: [
                  ["t", "<"],
                  ["k", "iframe"],
                ],
              },
              {
                tokens: [
                  ["t", "  "],
                  ["a", "src"],
                  ["t", "={"],
                  ["s", "`https://widget.usercore.app/?session=${sessionId}`"],
                  ["t", "}"],
                ],
              },
              {
                tokens: [
                  ["t", "  "],
                  ["a", "allow"],
                  ["t", "="],
                  ["s", `"camera; microphone"`],
                ],
              },
              { tokens: [["t", "/>"]] },
            ]}
          />
        </StepCard>
      </div>
    </div>
  </section>
);

// ── Use cases ──────────────────────────────────────────────────────────────
const USE_CASES = [
  {
    Icon: Building2,
    title: "Banks & fintech",
    body: "Full KYC + AML, PEP/sanctions screening, address verification. Pass an audit on day one.",
    bullets: [
      "AML + PEP screening",
      "Address verification",
      "Audit-ready trail",
    ],
  },
  {
    Icon: Users,
    title: "Marketplaces & gig platforms",
    body: "Verify sellers and freelancers before payouts. Cut fraud, meet 1099 / tax-form obligations.",
    bullets: ["Identity + biometric", "Payout-ready", "Fraud scoring"],
  },
  {
    Icon: Coins,
    title: "Crypto exchanges",
    body: "Sanctions-grade KYC with high-volume scaling. Country allowlists, risk scoring, manual review.",
    bullets: ["Country allowlist", "Tiered risk levels", "High throughput"],
  },
  {
    Icon: Globe,
    title: "SaaS & B2B",
    body: "Verify business owners and signing authorities. Connect identity to your existing user model.",
    bullets: ["Business owner check", "Webhook events", "Single API key"],
  },
] as const;

const UseCases = () => (
  <section id="customers" className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeading
        eyebrow="Use cases"
        title="Built for every product that needs to know who's on the other end."
        subtitle="From regulated banking to gig-economy payouts, the same widget bends to fit. Choose the steps that match your risk and ship."
      />

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {USE_CASES.map((u) => (
          <div
            key={u.title}
            className="rounded-2xl bg-white border border-gray-200 p-6 shadow-soft hover:shadow-lift hover:border-primary-300 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
              <u.Icon size={20} strokeWidth={2.2} />
            </div>
            <h3 className="mt-5 font-bold text-gray-900 text-lg">{u.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {u.body}
            </p>
            <ul className="mt-4 space-y-1.5">
              {u.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-1.5 text-xs text-gray-700"
                >
                  <Check size={12} className="text-primary-600 shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Plans (sales-led; mirrors the dashboard's PlanTab values) ──────────────
type PlanRow = { label: string; values: [string, string, string] };

// Same order as the dashboard's PlanTab table. Limits are pulled straight
// from `getPlanFeatures` so any future change to the real plans only needs
// to flow into one place. UNLIMITED → "Unlimited", 0 → "—".
const PLAN_ROWS: PlanRow[] = [
  {
    label: "Identity verification provider",
    values: ["Manual review only", "iDenfy", "iDenfy + custom"],
  },
  {
    label: "AML screening",
    values: ["—", "ComplyAdvantage", "ComplyAdvantage"],
  },
  {
    label: "Fraud detection",
    values: ["—", "IPQualityScore", "IPQualityScore"],
  },
  { label: "Workflows per workspace", values: ["1", "Unlimited", "Unlimited"] },
  {
    label: "Workspaces per organization",
    values: ["1", "5", "Unlimited"],
  },
  { label: "Members per organization", values: ["2", "10", "Unlimited"] },
  { label: "Verifications per month", values: ["100", "1,000", "Unlimited"] },
  { label: "Scenarios", values: ["—", "Unlimited", "Unlimited"] },
  {
    label: "Widget branding",
    values: ["UserCore-branded", "Custom", "White-label"],
  },
];

type PlanHeader = {
  key: string;
  label: string;
  blurb: string;
  Icon: typeof Sprout;
  badge: string;
  featured?: boolean;
};

const PLAN_HEADERS: PlanHeader[] = [
  {
    key: "STARTER",
    label: "Starter",
    blurb: "Get your first verification flow shipped.",
    Icon: Sprout,
    badge: "bg-gray-100 text-gray-600",
  },
  {
    key: "GROWTH",
    label: "Growth",
    blurb: "For products with a real compliance posture.",
    Icon: TrendingUp,
    badge: "bg-blue-100 text-blue-700",
    featured: true,
  },
  {
    key: "ENTERPRISE",
    label: "Enterprise",
    blurb: "Regulated platforms running serious volume.",
    Icon: Sparkles,
    badge: "bg-violet-100 text-violet-700",
  },
];

const Plans = () => {
  const { open } = useDemoModal();
  return (
    <section id="plans" className="bg-gray-50 border-y border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow="Plans"
          title="Plans that match how you grow."
          subtitle="Plans are sales-led — pick the right tier on a 20-minute call. Every plan ships with the same widget; the higher tiers unlock more providers, more volume, and more team controls."
        />

        {/* Card 1: plan headers + descriptions */}
        <div className="mt-14 grid lg:grid-cols-3 gap-5">
          {PLAN_HEADERS.map((p) => (
            <div
              key={p.key}
              className={`rounded-2xl border bg-white p-6 shadow-soft flex flex-col ${
                p.featured
                  ? "border-primary-300 ring-2 ring-primary-200/60"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${p.badge}`}
                >
                  <p.Icon size={11} /> {p.label}
                </span>
                {p.featured && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-100 rounded-full px-2 py-0.5">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-gray-600">{p.blurb}</p>
              <button
                type="button"
                onClick={open}
                className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg font-medium px-4 py-2.5 text-sm transition-colors ${
                  p.featured
                    ? "bg-primary-200 hover:bg-primary-300 text-primary-800"
                    : "border border-gray-200 hover:border-gray-300 text-gray-800"
                }`}
              >
                <Calendar size={14} /> Book a demo
              </button>
            </div>
          ))}
        </div>

        {/* Card 2: the comparison table — exact same shape the dashboard's
            PlanTab renders inside settings. */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200" />
            {PLAN_HEADERS.map((p) => (
              <div
                key={p.key}
                className={`px-5 py-4 border-b border-gray-200 ${
                  p.featured ? "bg-primary-50" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${p.badge}`}
                  >
                    <p.Icon size={11} /> {p.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {PLAN_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div className="px-5 py-3 text-sm text-gray-600 bg-gray-50/50">
                {row.label}
              </div>
              {row.values.map((v, vi) => (
                <div
                  key={vi}
                  className={`px-5 py-3 text-sm ${
                    vi === 1 ? "bg-primary-50/40" : ""
                  } ${v === "—" ? "text-gray-400" : "text-gray-900"}`}
                >
                  {v}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-600">
            Not sure which tier? Our team will help you pick the right one in a
            20-minute call.
          </p>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-200 hover:bg-primary-300 px-4 py-2 text-sm font-medium text-primary-800"
          >
            <Calendar size={16} /> Book a demo
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Final CTA ──────────────────────────────────────────────────────────────
const FinalCta = () => {
  const { open } = useDemoModal();
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-2xl bg-primary-50 border border-primary-100 px-8 py-16 sm:px-16 sm:py-20">
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-200 px-3 py-1.5 text-xs font-medium text-primary-800">
              <Shield size={12} /> Production-ready
            </span>
            <h2 className="mt-5 text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">
              Start verifying customers today.
            </h2>
            <p className="mt-4 text-gray-600 text-lg leading-relaxed">
              Book a 20-minute call. We'll match a plan to your volume, scope
              the integration, and you can ship before next standup.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={open}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium px-5 py-3 transition-colors"
              >
                <Calendar size={16} /> Book a demo
              </button>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white text-gray-800 font-medium px-5 py-3 transition-colors"
              >
                <FileText size={16} /> Read the docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Footer ─────────────────────────────────────────────────────────────────
const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      "Widget",
      "Workflows",
      "Review queue",
      "Customers",
      "Scenarios",
      "Webhooks",
    ],
  },
  {
    title: "Resources",
    links: ["Docs", "API reference", "Changelog", "Status", "Security"],
  },
  {
    title: "Company",
    links: ["About", "Customers", "Plans", "Careers", "Contact"],
  },
  { title: "Legal", links: ["Privacy", "Terms", "DPA", "Cookies"] },
] as const;

const Footer = () => (
  <footer className="bg-gray-50 border-t border-gray-200 text-gray-600">
    <div className="mx-auto max-w-7xl px-6 py-14 grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary-200 rounded-xl flex items-center justify-center">
            <span className="font-bold text-primary-700">UC</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">UserCore</span>
        </div>
        <p className="mt-4 text-sm text-gray-500 max-w-xs leading-relaxed">
          The identity layer for everything you ship. Compliance, biometrics,
          and review — through one drop-in widget.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <a
            href="#"
            aria-label="GitHub"
            className="w-9 h-9 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-colors"
          >
            <Github size={16} />
          </a>
          <a
            href="#"
            aria-label="LinkedIn"
            className="w-9 h-9 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-colors"
          >
            <Linkedin size={16} />
          </a>
          <a
            href="#"
            aria-label="Twitter"
            className="w-9 h-9 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-colors"
          >
            <Twitter size={16} />
          </a>
        </div>
      </div>
      {FOOTER_COLS.map((col) => (
        <div key={col.title}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {col.title}
          </div>
          <ul className="mt-4 space-y-2.5">
            {col.links.map((l) => (
              <li key={l}>
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
        <span>© {new Date().getFullYear()} UserCore. All rights reserved.</span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks size={12} /> SOC 2 in progress · GDPR compliant
        </span>
      </div>
    </div>
  </footer>
);

// ── Book a Demo modal ──────────────────────────────────────────────────────
// B2B-style calendar booking, mimicking Calendly/Cal.com without actually
// scheduling anything. Five upcoming weekdays + four time slots; once the
// customer submits we flip to a success state so the demo still looks
// "finished" for the audience.
const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"] as const;
const USE_CASE_OPTS = [
  "Onboarding new customers (KYC)",
  "Onboarding sellers / freelancers",
  "Crypto / exchange compliance",
  "Business / corporate verification",
  "Something else",
] as const;

const nextWeekdays = (count: number): Date[] => {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (out.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const TIME_SLOTS = ["10:00", "11:00", "14:00", "15:00", "16:00"] as const;

type DemoForm = {
  name: string;
  email: string;
  company: string;
  size: (typeof TEAM_SIZES)[number];
  useCase: (typeof USE_CASE_OPTS)[number];
  notes: string;
};

const BookDemoModal = ({ onClose }: { onClose: () => void }) => {
  const days = useMemo(() => nextWeekdays(5), []);
  const [selectedDate, setSelectedDate] = useState<Date>(days[0]!);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState<DemoForm>({
    name: "",
    email: "",
    company: "",
    size: "11–50",
    useCase: "Onboarding new customers (KYC)",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const fmtDay = (d: Date) =>
    d.toLocaleDateString("en-GB", { weekday: "short" });
  const fmtNum = (d: Date) => d.getDate();
  const fmtMonth = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short" });
  const fmtLong = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const canSubmit =
    selectedTime !== null &&
    form.name.trim() !== "" &&
    form.email.trim() !== "" &&
    form.company.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-auto rounded-2xl bg-white shadow-deep"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-200 rounded-xl flex items-center justify-center">
              <Calendar size={18} className="text-primary-700" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Book a demo</div>
              <div className="text-xs text-gray-500">
                20 minutes · with a UserCore engineer
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-200 text-primary-700">
              <Check size={28} />
            </div>
            <h3 className="mt-5 text-2xl font-bold text-gray-900">
              You're on the calendar.
            </h3>
            <p className="mt-3 text-sm text-gray-600 max-w-md mx-auto">
              We'll see you on{" "}
              <span className="font-semibold text-gray-900">
                {fmtLong(selectedDate)}
              </span>{" "}
              at{" "}
              <span className="font-semibold text-gray-900">
                {selectedTime} CET
              </span>
              . A calendar invite is on its way to{" "}
              <span className="font-mono text-xs text-gray-700">
                {form.email}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium px-5 py-2.5"
            >
              Back to site
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
            {/* Date picker */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Pick a day
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {days.map((d) => {
                  const isActive =
                    d.toDateString() === selectedDate.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedTime(null);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-center transition-colors ${
                        isActive
                          ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          isActive ? "text-primary-700" : "text-gray-500"
                        }`}
                      >
                        {fmtDay(d)}
                      </div>
                      <div
                        className={`mt-0.5 text-xl font-bold ${
                          isActive ? "text-primary-800" : "text-gray-900"
                        }`}
                      >
                        {fmtNum(d)}
                      </div>
                      <div
                        className={`text-[10px] ${
                          isActive ? "text-primary-700" : "text-gray-500"
                        }`}
                      >
                        {fmtMonth(d)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time picker */}
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Pick a time (CET)
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {TIME_SLOTS.map((t) => {
                  const isActive = selectedTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-primary-400 bg-primary-50 text-primary-800 ring-2 ring-primary-200"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form fields */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Full name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Anja Novak"
              />
              <Field
                label="Work email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="anja@alpska-banka.si"
              />
              <Field
                label="Company"
                value={form.company}
                onChange={(v) => setForm({ ...form, company: v })}
                placeholder="Alpska Banka"
              />
              <Select
                label="Team size"
                value={form.size}
                onChange={(v) =>
                  setForm({ ...form, size: v as (typeof TEAM_SIZES)[number] })
                }
                options={TEAM_SIZES}
              />
            </div>
            <Select
              label="What you're verifying"
              value={form.useCase}
              onChange={(v) =>
                setForm({
                  ...form,
                  useCase: v as (typeof USE_CASE_OPTS)[number],
                })
              }
              options={USE_CASE_OPTS}
            />
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                Anything we should know? (optional)
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                placeholder="Expected monthly volume, target launch date, regulatory constraints, …"
              />
            </label>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                {selectedTime ? (
                  <>
                    <Calendar
                      size={12}
                      className="inline -mt-0.5 mr-1 text-primary-600"
                    />
                    {fmtLong(selectedDate)} · {selectedTime} CET
                  </>
                ) : (
                  "Pick a time slot to continue"
                )}
              </div>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-200 hover:bg-primary-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-primary-800 font-medium px-5 py-2.5 text-sm"
              >
                Schedule demo <ArrowRight size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <label className="block">
    <span className="text-xs font-medium text-gray-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required
      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
    />
  </label>
);

// Styled dropdown — the native <select> popup is platform-styled (and ugly
// on macOS Safari + Linux Chrome). This is the dashboard's Dropdown.tsx
// pattern in miniature: button trigger + portal-less popover + Check icon
// next to the selected option. Click-outside + Esc close it.
const Select = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <label className="block" ref={ref}>
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-left transition-colors ${
            open
              ? "border-primary-400 ring-2 ring-primary-200"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <span className="truncate text-gray-900">{value}</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
            <ul className="max-h-60 overflow-auto py-1">
              {options.map((opt) => {
                const selected = opt === value;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        selected
                          ? "bg-primary-50 text-primary-800"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {selected && (
                        <Check
                          size={14}
                          className="text-primary-600 shrink-0"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </label>
  );
};

// ── Shared bits ────────────────────────────────────────────────────────────
const SectionHeading = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) => (
  <div className="max-w-3xl">
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary-700">
      <span className="inline-block w-6 h-px bg-primary-500" />
      {eyebrow}
    </span>
    <h2 className="mt-4 text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
      {title}
    </h2>
    <p className="mt-4 text-gray-600 text-lg leading-relaxed">{subtitle}</p>
  </div>
);

const StepCard = ({
  n,
  title,
  body,
  children,
}: {
  n: string;
  title: string;
  body: string;
  children: ReactNode;
}) => (
  <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-soft flex flex-col">
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs font-bold text-primary-600">{n}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
    <h3 className="mt-3 font-bold text-gray-900 text-lg">{title}</h3>
    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{body}</p>
    <div className="mt-5 flex-1">{children}</div>
  </div>
);

const BrowserChrome = ({
  url = "app.usercore",
  children,
}: {
  url?: string;
  children: ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
      <div className="ml-3 px-3 py-1 rounded-md bg-white border border-gray-200 text-[11px] text-gray-500 font-mono">
        {url}
      </div>
    </div>
    <div>{children}</div>
  </div>
);

// ── Dashboard mocks ────────────────────────────────────────────────────────
// Every mock below mirrors the dashboard's actual class vocabulary so the
// transition between marketing and product reads as one continuous surface.

// KycReviewMock — pixel-faithful to KycReviewDetailPage. Same header card
// (name + real `fi fi-si` flag + sandbox pill with FlaskConical + yellow
// pending-review pill), same Section wrapper for Checks, same ChecksPanel
// grid using the real node-type icons (IdCard / Shield / Search / Copy /
// Settings2 / ScanFace) and "Passed / Needs review" status text.
type CheckState = "SUCCEEDED" | "REQUIRES_REVIEW";
type CheckRow = {
  key: string;
  label: string;
  Icon: typeof IdCard;
  state: CheckState;
};

const CHECK_ROWS: CheckRow[] = [
  {
    key: "id-scan",
    label: "Identity verification",
    Icon: IdCard,
    state: "SUCCEEDED",
  },
  {
    key: "aml-screening",
    label: "AML screening",
    Icon: Shield,
    state: "SUCCEEDED",
  },
  {
    key: "fraud-detection",
    label: "Fraud detection",
    Icon: Search,
    state: "REQUIRES_REVIEW",
  },
  {
    key: "duplicate-detection",
    label: "Duplicate detection",
    Icon: Copy,
    state: "SUCCEEDED",
  },
  {
    key: "rules-engine",
    label: "Rules engine",
    Icon: Settings2,
    state: "SUCCEEDED",
  },
  {
    key: "face-scan",
    label: "Face match & liveness",
    Icon: ScanFace,
    state: "SUCCEEDED",
  },
];

const CHECK_STATUS = {
  SUCCEEDED: {
    circle: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-700",
    Icon: CheckCircle2,
    label: "Passed",
  },
  REQUIRES_REVIEW: {
    circle: "bg-yellow-50 text-yellow-600",
    text: "text-yellow-700",
    Icon: AlertTriangle,
    label: "Needs review",
  },
} as const;

const KycReviewMock = ({ full = false }: { full?: boolean }) => {
  const passed = CHECK_ROWS.filter((c) => c.state === "SUCCEEDED").length;
  return (
    <div className="bg-gray-50 p-5 space-y-4">
      {/* Header card — exact match for KycReviewDetailPage line 1433-1534.
          NO avatar (the real page doesn't show one), just name + flag +
          sandbox/pending pills, with the decision buttons row on the right. */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-base font-semibold text-gray-900">
                Anja Novak
              </div>
              <span
                title="Slovenia"
                aria-label="Slovenia"
                className="fi fi-si inline-block h-4 w-6 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
              />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <Radio size={12} /> Live
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                <AlertTriangle size={12} /> Needs review
              </span>
            </div>
            <div className="font-mono text-xs text-gray-400 mt-0.5">
              cust_8x2k7q
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Submitted 12 minutes ago
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Workflow:{" "}
              <span className="text-primary-700 font-mono">wkf_3kx2</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm"
              >
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium rounded-lg text-sm"
              >
                <RotateCcw size={14} /> Request resubmission
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg text-sm"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity timeline (full only) — shows a 3-event audit trail to make
          the reviewer view feel populated. Compact version skips it. */}
      {full && (
        <SectionCard
          title="Activity"
          icon={<Clock size={15} />}
          action={<span className="text-xs text-gray-400">3 events</span>}
        >
          <ol className="relative -mt-1">
            {[
              {
                when: "Just now",
                what: "AML screening completed",
                detail: "0 matches against EU / OFAC / UN lists",
                tone: "good" as const,
                Icon: Shield,
              },
              {
                when: "2 minutes ago",
                what: "Fraud signal returned",
                detail: "IPQS score 64 / 100 — flagged for review",
                tone: "warn" as const,
                Icon: AlertTriangle,
              },
              {
                when: "12 minutes ago",
                what: "Customer submitted",
                detail: "All 6 widget steps completed",
                tone: "info" as const,
                Icon: Check,
              },
            ].map((e, i, arr) => {
              const tones = {
                good: "bg-primary-100 text-primary-700",
                warn: "bg-orange-100 text-orange-600",
                info: "bg-blue-100 text-blue-600",
              };
              const isLast = i === arr.length - 1;
              return (
                <li
                  key={i}
                  className={`relative flex gap-3 ${isLast ? "" : "pb-5"}`}
                >
                  {!isLast && (
                    <span className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-200" />
                  )}
                  <span
                    className={`h-7 w-7 shrink-0 flex items-center justify-center rounded-full ${tones[e.tone]}`}
                  >
                    <e.Icon size={13} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-sm font-medium text-gray-900">
                      {e.what}
                    </div>
                    <div className="text-xs text-gray-400">{e.when}</div>
                    <div className="mt-1 text-xs text-gray-600">{e.detail}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>
      )}

      {/* Checks — Section wrapper + ChecksPanel grid, exact same layout the
          dashboard renders inside KycReviewDetailPage at line 1663-1682. */}
      <SectionCard
        title="Checks"
        icon={<ListChecks size={15} />}
        action={
          <span
            className={`text-xs ${
              passed === CHECK_ROWS.length
                ? "text-emerald-600"
                : "text-gray-400"
            }`}
          >
            {passed}/{CHECK_ROWS.length} passed
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CHECK_ROWS.map((c) => {
            const s = CHECK_STATUS[c.state];
            return (
              <div
                key={c.key}
                className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.circle}`}
                >
                  <c.Icon size={15} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {c.label}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 text-xs ${s.text}`}
                  >
                    <s.Icon size={13} /> {s.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
};

// Section card — mirrors KycReviewDetailPage's `<Section>` component.
// Title row: chevron + icon-in-primary-100 + title + optional action chip.
const SectionCard = ({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="bg-white border border-gray-200 rounded-xl p-5">
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <ChevronDown size={16} className="shrink-0 text-gray-400" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          {icon}
        </span>
        <span className="text-sm font-semibold text-gray-900 truncate">
          {title}
        </span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

// WorkflowEditorMock — 1:1 replica of WorkflowDetailPage's real layout: a
// title card with name + description + status pills + Live-toggle + Test
// the flow + Delete; then an "Active steps" section heading with 5 stacked
// StepCards (identity-verification, duplicate-detection, aml-screening,
// fraud-detection, rules-engine), connector lines between them, the first
// expanded to reveal sub-steps + provider selector — exactly the page a
// compliance officer actually sees.
const STEPS: {
  Icon: typeof IdCard;
  label: string;
  desc: string;
  provider?: string;
  valid: boolean;
  expanded?: boolean;
}[] = [
  {
    Icon: IdCard,
    label: "Identity verification",
    desc: "Terms acceptance, email verification, document scan, liveness face scan, proof of residence and contact details.",
    provider: "iDenfy",
    valid: true,
    expanded: true,
  },
  {
    Icon: Shield,
    label: "AML screening",
    desc: "Sanctions, PEP and adverse-media screening. Requires a provider.",
    provider: "ComplyAdvantage",
    valid: true,
  },
  {
    Icon: Search,
    label: "Fraud detection",
    desc: "IP intelligence and device fingerprinting. Requires a provider.",
    provider: "IPQualityScore",
    valid: true,
  },
  {
    Icon: Settings2,
    label: "Rules engine",
    desc: "Apply scenarios to flag, reject or notify based on captured attributes.",
    valid: false,
  },
];

const WorkflowEditorMock = () => (
  <div className="bg-gray-50 p-6">
    {/* Title card — same layout the dashboard renders; trimmed Delete to
        save horizontal room, dropped the breadcrumb + branding accordion
        to keep the admin tab's height in line with Customer + Reviewer. */}
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-gray-900">
            Onboarding workflow
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Standard identity check for new accounts.
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
            <span className="font-mono text-gray-400">wkf_3kx2a8b</span>
            <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
              default
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">
              <Check size={12} /> Valid
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              <Radio size={12} /> Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Live</span>
            <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-red-500">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-4" />
            </span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-800"
          >
            <Play size={14} /> Test the flow
          </button>
        </div>
      </div>
    </div>

    {/* Widget branding — collapsed-state row, exact match to
        BrandingSection.tsx header (Palette icon + label + Growth plan badge
        + chevron). Plan-gated, so the Growth pill stays visible at all
        times — that's how the real dashboard renders it. */}
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-5">
      <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50">
        <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
          <Palette size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              Widget appearance
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
              <TrendingUp size={11} /> Growth
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Brand name, logo, primary + secondary colour.
          </div>
        </div>
        <ChevronDown size={18} className="text-gray-400 shrink-0" />
      </div>
    </div>

    {/* Active steps section */}
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Active steps
        </h3>
        <span className="text-xs text-gray-400">4 of 4 enabled</span>
      </div>
      <div className="space-y-3">
        {STEPS.map((s, i) => (
          <div key={s.label} className="relative">
            <WorkflowStepCard
              Icon={s.Icon}
              label={s.label}
              desc={s.desc}
              provider={s.provider}
              valid={s.valid}
              expanded={s.expanded}
            />
            {i < STEPS.length - 1 && (
              <div className="absolute left-9 -bottom-3 w-0.5 h-3 bg-gray-200" />
            )}
          </div>
        ))}
      </div>
    </section>
  </div>
);

// Mirrors the real StepCard. `expanded=true` reveals the
// IdentityVerificationDetail-equivalent sub-step list + provider chooser.
const WorkflowStepCard = ({
  Icon,
  label,
  desc,
  provider,
  valid,
  expanded = false,
}: {
  Icon: typeof IdCard;
  label: string;
  desc: string;
  provider?: string;
  valid: boolean;
  expanded?: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
    <div className="w-full flex items-start gap-4 p-5">
      <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {valid ? (
            <span className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full font-medium">
              <Check size={11} /> Valid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle size={11} /> Needs config
            </span>
          )}
          {provider && (
            <span className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full font-medium">
              {provider}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1">{desc}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
          aria-label="Remove step"
        >
          <X size={16} />
        </button>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>
    </div>

    {expanded && <IdentityVerificationDetailMock />}
  </div>
);

// Identity-verification step's expanded body — sub-step toggles + provider
// section. Matches WorkflowDetailPage's IdentityVerificationDetail, but
// trimmed (4 substeps instead of 6, one-line provider rows instead of cards)
// so the admin tab stays the same height as Customer + Reviewer.
const SUB_STEPS = [
  {
    Icon: FileText,
    name: "Terms & conditions",
    on: true,
    locked: true,
    recommended: false,
  },
  {
    Icon: Mail,
    name: "Email verification",
    on: true,
    locked: false,
    recommended: true,
  },
  {
    Icon: IdCard,
    name: "ID document scan",
    on: true,
    locked: false,
    recommended: false,
  },
  {
    Icon: ScanFace,
    name: "Face match & liveness",
    on: true,
    locked: false,
    recommended: false,
  },
  {
    Icon: Home,
    name: "Proof of residence",
    on: false,
    locked: false,
    recommended: false,
  },
];

const IdentityVerificationDetailMock = () => (
  <div className="border-t border-gray-100 bg-gray-50/50 p-4">
    {/* Sub-steps — single-line rows (no description) so 5 fit without the
        card growing taller than the Customer + Reviewer tabs. */}
    <div>
      <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Sub-steps
      </div>
      <div className="space-y-1.5">
        {SUB_STEPS.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg border bg-white flex items-center gap-3 px-3 py-2 ${
              s.on
                ? "border-gray-200"
                : "border-dashed border-gray-200 opacity-75"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
              <s.Icon size={14} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                {s.name}
              </span>
              {s.recommended && (
                <span className="inline-flex items-center rounded-full bg-primary-50 text-primary-700 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5">
                  Recommended
                </span>
              )}
            </div>
            {s.locked ? (
              <span className="text-[11px] text-gray-400 shrink-0">
                Always on
              </span>
            ) : (
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full ${
                  s.on ? "bg-primary-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white ${
                    s.on ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Widget mock — exact match to the real widget's Shell + OverviewScreen in
// its UNBRANDED default state. "UserCore Verification" brand name + UC tile
// (the same mark the dashboard's login uses) so the customer sees what they
// get on day one before custom branding. Step list mirrors `OverviewScreen`:
// numbered/check circle (`w-7 h-7 rounded-full`) + step-type icon box
// (`w-9 h-9 rounded-lg`) + label + optional "Up next" + done strike-through.
const WIDGET_STEPS: {
  name: string;
  Icon: typeof FileText;
  state: "done" | "current" | "idle";
}[] = [
  { name: "Terms & conditions", Icon: FileText, state: "done" },
  { name: "Email verification", Icon: Mail, state: "current" },
  { name: "Identity document", Icon: IdCard, state: "idle" },
  { name: "Face scan", Icon: ScanFace, state: "idle" },
  { name: "Contact information", Icon: Phone, state: "idle" },
];

const WidgetMock = () => (
  <div className="bg-gray-50 p-10 flex justify-center">
    <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden flex flex-col">
      {/* Shell header — UC tile + "UserCore Verification" + language picker
          + close — exact match to Widget.tsx lines 866-925. */}
      <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary-200 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary-700">UC</span>
          </div>
          <span className="text-sm font-semibold text-gray-700 truncate">
            UserCore Verification
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">Step 2 of 5</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50 px-1.5 py-1"
          >
            <Globe size={12} /> EN
          </button>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-50"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body — OverviewScreen render. */}
      <div className="px-8 py-6 flex-1">
        <h3 className="text-xl font-semibold text-gray-900">
          Verification steps
        </h3>
        <p className="text-sm text-gray-500 mt-1">1 of 5 complete</p>
        <ol className="mt-4 space-y-2">
          {WIDGET_STEPS.map((s, i) => {
            const isDone = s.state === "done";
            const isCurrent = s.state === "current";
            return (
              <li
                key={s.name}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${
                  isCurrent
                    ? "border-primary-300 bg-primary-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isDone
                      ? "bg-primary-500 text-white"
                      : isCurrent
                        ? "bg-primary-200 text-primary-800"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isDone ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-primary-100 text-primary-700"
                      : isCurrent
                        ? "bg-primary-200 text-primary-800"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                  }`}
                >
                  <s.Icon size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${
                      isDone
                        ? "text-gray-500 line-through decoration-gray-300"
                        : "text-gray-900"
                    }`}
                  >
                    {s.name}
                  </div>
                  {isCurrent && (
                    <div className="text-xs text-primary-700 mt-0.5">
                      Up next
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="mt-4 w-full py-3 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-semibold rounded-xl text-sm"
        >
          Continue
        </button>
      </div>

      {/* Powered-by footer — shows on the default unbranded Shell unless the
          workspace is on Enterprise + has toggled it off. */}
      <div className="px-8 py-2 border-t border-gray-100 text-center">
        <span className="text-[10px] text-gray-400">Powered by UserCore</span>
      </div>
    </div>
  </div>
);

// Mini workflow mock used inside the "How it works" step card. Smaller
// version of the admin tab's mock — same sub-step labels + icons + toggle
// pattern as the dashboard's real SubStepCard, just compact enough to fit
// in a step card. Labels + icons match SUB_STEP_LABELS / SUB_STEP_ICONS.
const MINI_ITEMS: {
  Icon: typeof FileText;
  label: string;
  on: boolean;
  locked?: boolean;
}[] = [
  { Icon: FileText, label: "Terms & conditions", on: true, locked: true },
  { Icon: Mail, label: "Email verification", on: true },
  { Icon: IdCard, label: "ID document scan", on: true },
  { Icon: ScanFace, label: "Face match & liveness", on: true },
  { Icon: Home, label: "Proof of residence", on: false },
  { Icon: Phone, label: "Contact information", on: true },
];

const WorkflowMiniMock = () => (
  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
    <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
          <IdCard size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-900 truncate">
            Identity verification
          </div>
          <div className="text-[10px] text-gray-500 truncate">
            6 sub-steps · iDenfy
          </div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700 shrink-0">
        <Check size={10} /> Valid
      </span>
    </div>
    <ul className="divide-y divide-gray-100">
      {MINI_ITEMS.map((s) => (
        <li
          key={s.label}
          className={`px-3 py-1.5 flex items-center gap-2 ${
            s.on ? "" : "opacity-60"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
              s.on
                ? "bg-gray-50 border border-gray-200 text-gray-700"
                : "bg-gray-50 border border-dashed border-gray-200 text-gray-400"
            }`}
          >
            <s.Icon size={12} />
          </div>
          <span
            className={`flex-1 truncate text-[11px] ${
              s.on ? "text-gray-800 font-medium" : "text-gray-400 line-through"
            }`}
          >
            {s.label}
          </span>
          {s.locked ? (
            <span className="text-[10px] text-gray-400 shrink-0">
              Always on
            </span>
          ) : (
            <span
              className={`relative inline-flex h-4 w-7 rounded-full transition-colors shrink-0 ${
                s.on ? "bg-primary-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                  s.on ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </span>
          )}
        </li>
      ))}
    </ul>
  </div>
);

type Token = [type: "k" | "t" | "s" | "f" | "a", text: string];
const TOKEN_CLASS: Record<Token[0], string> = {
  k: "text-pink-400",
  t: "text-gray-200",
  s: "text-emerald-300",
  f: "text-amber-300",
  a: "text-sky-300",
};

const CodeMock = ({
  title,
  lines,
}: {
  title: string;
  lines: { tokens: Token[] }[];
}) => (
  <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
    <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-gray-700" />
      <span className="w-2 h-2 rounded-full bg-gray-700" />
      <span className="w-2 h-2 rounded-full bg-gray-700" />
      <span className="ml-2 text-[10px] text-gray-500 font-mono">{title}</span>
    </div>
    <pre className="px-4 py-3 text-[11.5px] leading-relaxed font-mono overflow-x-auto">
      <code>
        {lines.map((line, i) => (
          <div key={i}>
            {line.tokens.map(([type, text], j) => (
              <span key={j} className={TOKEN_CLASS[type]}>
                {text}
              </span>
            ))}
          </div>
        ))}
      </code>
    </pre>
  </div>
);
