import { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  Code2,
  DollarSign,
  LogOut,
  Megaphone,
  Palette,
  PenLine,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Video,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import {
  USERCORE_WIDGET_URL,
  USERCORE_WORKFLOWS_API_PUBLIC_URL,
} from "@usercore/shared-types";

import { AccountPage, AuthProvider, LoginModal, useAuth } from "./auth";

export const App = () => (
  <AuthProvider>
    <Shell />
  </AuthProvider>
);

type View = "home" | "account";

const Shell = () => {
  const [kycOpen, setKycOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const { user } = useAuth();

  useEffect(() => {
    if (!user && view === "account") setView("home");
  }, [user, view]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onSignUp={() => setKycOpen(true)}
        onLogin={() => setLoginOpen(true)}
        onGoAccount={() => setView("account")}
        onGoHome={() => setView("home")}
        view={view}
      />
      {view === "home" ? (
        <main className="flex-1">
          <Hero onSignUp={() => setKycOpen(true)} />
          <SocialProof />
          <Categories />
          <FeaturedJobs />
          <HowItWorks />
          <BottomCTA onSignUp={() => setKycOpen(true)} />
        </main>
      ) : (
        <AccountPage onBackHome={() => setView("home")} />
      )}
      <Footer />
      {kycOpen && (
        <KycModal
          onClose={() => setKycOpen(false)}
          onCompleted={() => setView("account")}
        />
      )}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
};

// ── Chrome ────────────────────────────────────────────────────────────────
const Logo = () => (
  // The source PNG is square with lots of vertical white padding around the
  // W + wordmark. We scale the image up inside a horizontal clipping window
  // so the wordmark is the dominant content — not the padding.
  <div className="relative h-11 w-44 overflow-hidden">
    <img
      src="/logo.png"
      alt="Workly"
      className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 object-contain"
    />
  </div>
);

const Header = ({
  onSignUp,
  onLogin,
  onGoAccount,
  onGoHome,
  view,
}: {
  onSignUp: () => void;
  onLogin: () => void;
  onGoAccount: () => void;
  onGoHome: () => void;
  view: View;
}) => {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-brand-100">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={onGoHome}
          className="text-left"
          aria-label="Home"
        >
          <Logo />
        </button>
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-brand-800">
          <a href="#" className="hover:text-brand-500">
            Find work
          </a>
          <a href="#" className="hover:text-brand-500">
            Hire talent
          </a>
          <a href="#" className="hover:text-brand-500">
            How it works
          </a>
          <a href="#" className="hover:text-brand-500">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu onGoAccount={onGoAccount} view={view} />
          ) : (
            <>
              <button
                type="button"
                onClick={onLogin}
                className="hidden sm:inline-block text-sm font-medium text-brand-800 hover:text-brand-500 px-3 py-2"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={onSignUp}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-950 hover:bg-brand-900 text-white text-sm font-semibold px-5 py-2 transition-colors"
              >
                Get started <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const UserMenu = ({
  onGoAccount,
  view,
}: {
  onGoAccount: () => void;
  view: View;
}) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initial = (user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-brand-100 hover:border-brand-300 pl-1 pr-3 py-1 text-sm font-semibold text-brand-950 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white text-xs font-extrabold flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden sm:inline max-w-[10rem] truncate">
          {fullName}
        </span>
        <ChevronDown size={14} className="text-brand-500" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-brand-100 bg-white shadow-lg z-20 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => {
                onGoAccount();
                setOpen(false);
              }}
              disabled={view === "account"}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-brand-50 disabled:bg-brand-50 disabled:text-brand-400 text-left"
            >
              <User size={14} /> My account
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-brand-50 text-left border-t border-brand-50"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Hero ─────────────────────────────────────────────────────────────────
const Hero = ({ onSignUp }: { onSignUp: () => void }) => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <div className="absolute top-20 -left-32 w-96 h-96 bg-brand-200 rounded-full blur-3xl opacity-50" />
      <div className="absolute top-40 right-0 w-96 h-96 bg-accent-200 rounded-full blur-3xl opacity-40" />
    </div>
    <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28 text-center">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-white border border-brand-100 px-3 py-1.5 rounded-full shadow-sm">
        <Sparkles size={12} className="text-accent-500" /> 180,000+ freelancers
        and clients across Europe
      </span>
      <h1 className="mt-6 text-4xl lg:text-6xl font-extrabold text-brand-950 leading-[1.05] tracking-tight max-w-4xl mx-auto">
        Find freelance work that
        <br />
        <span className="bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 bg-clip-text text-transparent">
          fits your life.
        </span>
      </h1>
      <p className="mt-6 text-lg text-brand-800/80 max-w-2xl mx-auto">
        Get matched with clients you&apos;ll actually love working with. Set
        your rate, set your hours, and get paid on time — every time.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onSignUp}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold px-7 py-3.5 shadow-lg shadow-brand-600/30 transition-colors"
        >
          Sign up as a freelancer <ArrowRight size={16} />
        </button>
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-brand-50 text-brand-900 font-semibold px-7 py-3.5 border border-brand-100 shadow-sm"
        >
          I&apos;m hiring
        </a>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-brand-700">
        <span className="inline-flex items-center gap-1.5">
          <Check size={14} className="text-brand-500" /> No platform fee for
          your first month
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check size={14} className="text-brand-500" /> Payouts in 24 hours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check size={14} className="text-brand-500" /> Verified profiles only
        </span>
      </div>
    </div>
  </section>
);

// ── Social proof strip ───────────────────────────────────────────────────
const SocialProof = () => (
  <section className="border-y border-brand-100 bg-white">
    <div className="mx-auto max-w-7xl px-6 py-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-brand-400">
        Trusted by teams at
      </div>
      {["Atlas Studio", "Lumen Labs", "Northwind", "Halcyon", "Brightway"].map(
        (n) => (
          <div
            key={n}
            className="text-lg font-bold text-brand-900/40 tracking-tight"
          >
            {n}
          </div>
        ),
      )}
    </div>
  </section>
);

// ── Categories ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: Code2, name: "Development", count: "12,400+ gigs" },
  { icon: Palette, name: "Design", count: "8,900+ gigs" },
  { icon: PenLine, name: "Writing", count: "6,200+ gigs" },
  { icon: Megaphone, name: "Marketing", count: "5,100+ gigs" },
  { icon: Video, name: "Video & Motion", count: "3,700+ gigs" },
  { icon: TrendingUp, name: "Finance", count: "2,400+ gigs" },
];

const Categories = () => (
  <section className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-brand-950 tracking-tight">
            Browse by category
          </h2>
          <p className="mt-1 text-brand-700">
            Whatever your craft is, there&apos;s work for it here.
          </p>
        </div>
        <a
          href="#"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
        >
          All categories <ArrowRight size={14} />
        </a>
      </div>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map((c) => (
          <a
            key={c.name}
            href="#"
            className="group rounded-2xl border border-brand-100 hover:border-brand-300 bg-white hover:shadow-md transition-all p-4"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-50 group-hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-colors">
              <c.icon size={18} />
            </div>
            <div className="mt-3 font-semibold text-brand-950">{c.name}</div>
            <div className="text-xs text-brand-500">{c.count}</div>
          </a>
        ))}
      </div>
    </div>
  </section>
);

// ── Featured jobs ────────────────────────────────────────────────────────
const JOBS: Array<{
  title: string;
  budget: string;
  tags: string[];
  client: string;
  rating: number;
  hot?: boolean;
}> = [
  {
    title: "Senior React engineer for fintech onboarding",
    budget: "€60–€85 / hr",
    tags: ["React", "TypeScript", "KYC"],
    client: "Northwind Bank",
    rating: 4.9,
    hot: true,
  },
  {
    title: "Brand identity & guidelines for SaaS launch",
    budget: "€3,500 fixed",
    tags: ["Branding", "Figma", "Logo"],
    client: "Lumen Labs",
    rating: 5.0,
  },
  {
    title: "Long-form blog writer — B2B / DevTools",
    budget: "€0.30 / word",
    tags: ["Writing", "SEO", "DevTools"],
    client: "Brightway",
    rating: 4.8,
  },
  {
    title: "TikTok video editor (30 short-form / month)",
    budget: "€1,800 / month",
    tags: ["Video", "Social", "After Effects"],
    client: "Halcyon",
    rating: 4.7,
    hot: true,
  },
];

const FeaturedJobs = () => (
  <section className="bg-brand-50/40">
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-brand-950 tracking-tight">
            Hot gigs right now
          </h2>
          <p className="mt-1 text-brand-700">
            Hand-picked from new clients hiring this week.
          </p>
        </div>
        <a
          href="#"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
        >
          Browse all jobs <ArrowRight size={14} />
        </a>
      </div>
      <div className="mt-8 grid md:grid-cols-2 gap-5">
        {JOBS.map((j) => (
          <article
            key={j.title}
            className="rounded-2xl bg-white border border-brand-100 hover:border-brand-300 hover:shadow-lg transition-all p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-lg text-brand-950 leading-snug">
                {j.title}
              </h3>
              {j.hot && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-accent-100 text-accent-500 px-2 py-1 rounded-full">
                  <Zap size={10} /> Hot
                </span>
              )}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-brand-700 font-semibold">
              <DollarSign size={14} className="text-brand-500" /> {j.budget}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {j.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-1 rounded-md"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-brand-100 flex items-center justify-between text-sm">
              <span className="text-brand-700">
                <Briefcase size={12} className="inline mr-1.5 text-brand-400" />
                {j.client}
              </span>
              <span className="inline-flex items-center gap-1 text-brand-900 font-semibold">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {j.rating}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

// ── How it works ─────────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Sparkles,
    title: "Create your profile",
    desc: "Tell us what you do best. Add a short pitch and a few work samples — it takes about 10 minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Verify your identity",
    desc: "A quick photo of your ID and a selfie. Required once, before your first payout. Under 2 minutes.",
  },
  {
    icon: Wallet,
    title: "Get hired & paid",
    desc: "Apply to gigs, get matched with clients, get paid the day after work is approved. No chasing invoices.",
  },
];

const HowItWorks = () => (
  <section className="bg-white">
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-brand-950 tracking-tight">
          Three steps and you&apos;re live
        </h2>
        <p className="mt-2 text-brand-700">
          We&apos;ve made it as light as we possibly can, while keeping everyone
          safe.
        </p>
      </div>
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="rounded-2xl bg-gradient-to-br from-brand-50 to-white border border-brand-100 p-7"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold">
                {i + 1}
              </div>
              <s.icon size={20} className="text-brand-500" />
            </div>
            <h3 className="mt-5 font-bold text-lg text-brand-950">{s.title}</h3>
            <p className="mt-2 text-sm text-brand-700 leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Bottom CTA ───────────────────────────────────────────────────────────
const BottomCTA = ({ onSignUp }: { onSignUp: () => void }) => (
  <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white">
    <div className="mx-auto max-w-4xl px-6 py-20 text-center">
      <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
        Your next gig is waiting.
      </h2>
      <p className="mt-3 text-brand-200">
        Join Workly today — free for freelancers, no credit card needed.
      </p>
      <button
        type="button"
        onClick={onSignUp}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent-400 hover:bg-accent-500 text-brand-950 font-bold px-8 py-3.5 shadow-lg transition-colors"
      >
        Sign up free <ArrowRight size={16} />
      </button>
    </div>
  </section>
);

// ── Footer ───────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="bg-white border-t border-brand-100 text-sm">
    <div className="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-4 gap-8">
      <div>
        <Logo />
        <p className="mt-3 text-brand-600 text-xs leading-relaxed">
          Workly s.r.o. — a freelance marketplace connecting independent talent
          with clients across Europe. Demo site.
        </p>
      </div>
      <FooterCol
        title="For freelancers"
        links={[
          "Find work",
          "How payouts work",
          "Verification",
          "Community",
          "Trust & safety",
        ]}
      />
      <FooterCol
        title="For clients"
        links={[
          "Hire talent",
          "Enterprise",
          "Pricing",
          "Project management",
          "Compliance",
        ]}
      />
      <FooterCol
        title="Company"
        links={["About", "Careers", "Press", "Privacy", "Terms"]}
      />
    </div>
    <div className="border-t border-brand-100">
      <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-500">
        <span>© {new Date().getFullYear()} Workly s.r.o.</span>
        <span>Identity verification powered by UserCore.</span>
      </div>
    </div>
  </footer>
);

const FooterCol = ({ title, links }: { title: string; links: string[] }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-brand-950">
      {title}
    </div>
    <ul className="mt-3 space-y-2">
      {links.map((l) => (
        <li key={l}>
          <a href="#" className="text-brand-700 hover:text-brand-500">
            {l}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

// ── KYC modal ────────────────────────────────────────────────────────────
type KycPhase = "loading" | "widget" | "error";

// Real-world widget embeds (Stripe Checkout, Sumsub, Persona, iDenfy) all
// iframe a hosted widget by URL. We do the same: drop an iframe at the
// widget's URL with `?session=…` and the widget handles the rest, including
// its own "Continue on phone" QR.
//
// The URLs come from shared-types — a single place in the repo that owns
// the public UserCore URLs (the dashboard reads from there too). A real
// customer integrating UserCore would treat these as constants from our
// docs: their only env var is the workspace API key.
const WIDGET_URL = USERCORE_WIDGET_URL;
const WORKFLOWS_API = USERCORE_WORKFLOWS_API_PUBLIC_URL;
const PROVIDERS_API = "http://localhost:3008";

const KycModal = ({
  onClose,
  onCompleted,
}: {
  onClose: () => void;
  onCompleted: () => void;
}) => {
  const { registerCustomer, login } = useAuth();
  const [phase, setPhase] = useState<KycPhase>("loading");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const start = async () => {
    setError("");
    setPhase("loading");
    try {
      const r = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await r.json();
      if (!r.ok || !data.sessionId) {
        throw new Error(data.error ?? "Couldn't start session");
      }
      const params = new URLSearchParams({
        session: data.sessionId,
        workflowsApi: WORKFLOWS_API,
        providersApi: PROVIDERS_API,
      });
      setSessionId(data.sessionId);
      setIframeSrc(`${WIDGET_URL}/?${params.toString()}`);
      setPhase("widget");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  // The widget owns its own success screen — we DON'T tear down the iframe
  // on `complete`, but we DO pull the customer's verified email + name from
  // the session so we can register them locally for later OTP login. We
  // close only when the user dismisses it themselves.
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== WIDGET_URL) return;
      const data = e.data as { type?: string } | null;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "usercore.widget.complete" && sessionId) {
        try {
          const r = await fetch(
            `/api/session-detail?id=${encodeURIComponent(sessionId)}`,
          );
          const detail = await r.json();
          if (r.ok && detail.email && detail.customerId) {
            registerCustomer({
              customerId: detail.customerId,
              email: detail.email,
              firstName: detail.firstName ?? null,
              lastName: detail.lastName ?? null,
              status: detail.status ?? null,
            });
            // Auto-sign-in so the customer lands on their account page when
            // they close the widget — no need to retype email + OTP right
            // after they just verified.
            login(detail.email);
          }
        } catch {
          // Non-fatal: registration just fails silently.
        }
      }
      if (data.type === "usercore.widget.close") {
        onClose();
        onCompleted();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose, onCompleted, sessionId, registerCustomer, login]);

  useEffect(() => {
    start();
  }, []);

  // For the widget phase we render the iframe DIRECTLY inside the overlay
  // — no wrapper card, no host header. The widget's own Shell is the only
  // visible chrome, exactly like the dashboard's "Test the flow" launcher.
  // For loading/done/error we still use a small host modal because those
  // are host-owned states.
  if (phase === "widget" && iframeSrc) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <iframe
          src={iframeSrc}
          title="UserCore verification"
          allow="camera; microphone; clipboard-read; clipboard-write"
          className="block w-full max-w-lg h-[760px] max-h-[90vh] border-0 bg-transparent"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-100 bg-white px-6 py-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            className="text-brand-400 hover:text-brand-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {phase === "loading" && (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-brand-700">
              Starting verification…
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="p-8 text-center">
            <div className="text-red-600 font-semibold">
              Couldn&apos;t start verification
            </div>
            <p className="mt-2 text-sm text-brand-700">{error}</p>
            <button
              type="button"
              onClick={start}
              className="mt-6 rounded-full border border-brand-200 px-5 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
