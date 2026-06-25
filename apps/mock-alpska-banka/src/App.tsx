import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  Home,
  LogOut,
  PiggyBank,
  Shield,
  User,
  Wallet,
  X,
} from "lucide-react";

import {
  USERCORE_WIDGET_URL,
  USERCORE_WORKFLOWS_API_PUBLIC_URL,
} from "@usercore/shared-types";

import { AccountPage, AuthProvider, LoginModal, useAuth } from "./auth";
import { LanguageProvider, useT, type Language } from "./i18n";

export const App = () => (
  <LanguageProvider>
    <AuthProvider>
      <Shell />
    </AuthProvider>
  </LanguageProvider>
);

type View = "home" | "account";

const Shell = () => {
  const [kycOpen, setKycOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const { user } = useAuth();

  // When the customer signs out, drop back to the marketing home — otherwise
  // they'd land on a broken "Account" page with nothing to show.
  useEffect(() => {
    if (!user && view === "account") setView("home");
  }, [user, view]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <Header
        onOpenAccount={() => setKycOpen(true)}
        onLogin={() => setLoginOpen(true)}
        onGoAccount={() => setView("account")}
        onGoHome={() => setView("home")}
        view={view}
      />
      {view === "home" ? (
        <main className="flex-1">
          <Hero onOpenAccount={() => setKycOpen(true)} />
          <Products />
          <Trust />
          <BottomCTA onOpenAccount={() => setKycOpen(true)} />
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

// ── Chrome ─────────────────────────────────────────────────────────────────
const TopBar = () => {
  const { t, lang, setLang } = useT();
  return (
    <div className="bg-brand-900 text-brand-100 text-xs">
      <div className="mx-auto max-w-7xl px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Shield size={12} /> {t("topbar.regulated")}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <Globe size={12} /> {t("topbar.eu")}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <LangLink current={lang} value="sl" onClick={setLang}>
            Slovenščina
          </LangLink>
          <span className="opacity-40">|</span>
          <LangLink current={lang} value="en" onClick={setLang}>
            English
          </LangLink>
        </div>
      </div>
    </div>
  );
};

const LangLink = ({
  current,
  value,
  onClick,
  children,
}: {
  current: Language;
  value: Language;
  onClick: (l: Language) => void;
  children: React.ReactNode;
}) => {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={
        active
          ? "text-white font-semibold"
          : "text-brand-200 hover:text-white transition-colors"
      }
    >
      {children}
    </button>
  );
};

const Logo = () => {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3">
      {/* The PNG has a chunky dark vignette around the actual mark, so we
          zoom the image 2× and let overflow-hidden crop the padding away —
          the mountain glyph + wordmark end up filling the badge. */}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <img
          src="/logo.png"
          alt="Alpska Banka"
          className="h-full w-full object-cover scale-[1.5]"
        />
      </div>
      <div className="hidden sm:block text-[11px] uppercase tracking-widest text-brand-500 leading-tight max-w-[10rem]">
        {t("logo.tagline")}
      </div>
    </div>
  );
};

const Header = ({
  onOpenAccount,
  onLogin,
  onGoAccount,
  onGoHome,
  view,
}: {
  onOpenAccount: () => void;
  onLogin: () => void;
  onGoAccount: () => void;
  onGoHome: () => void;
  view: View;
}) => {
  const { t } = useT();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-brand-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between gap-6">
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
            {t("nav.personal")}
          </a>
          <a href="#" className="hover:text-brand-500">
            {t("nav.business")}
          </a>
          <a href="#" className="hover:text-brand-500">
            {t("nav.loans")}
          </a>
          <a href="#" className="hover:text-brand-500">
            {t("nav.cards")}
          </a>
          <a href="#" className="hover:text-brand-500">
            {t("nav.help")}
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
                {t("nav.signin")}
              </button>
              <button
                type="button"
                onClick={onOpenAccount}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {t("nav.openAccount")} <ArrowRight size={14} />
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
  const { t } = useT();
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
        className="inline-flex items-center gap-2 rounded-full border border-brand-100 hover:border-brand-300 pl-1 pr-3 py-1 text-sm font-medium text-brand-900 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center">
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
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-brand-100 bg-white shadow-lg z-20 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => {
                onGoAccount();
                setOpen(false);
              }}
              disabled={view === "account"}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-brand-50 disabled:bg-brand-50 disabled:text-brand-400 text-left"
            >
              <User size={14} /> {t("nav.myAccount")}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-brand-50 text-left border-t border-brand-50"
            >
              <LogOut size={14} /> {t("nav.signOut")}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Hero ────────────────────────────────────────────────────────────────────
const Hero = ({ onOpenAccount }: { onOpenAccount: () => void }) => {
  const { t } = useT();
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-white to-brand-50" />
      <div className="absolute -top-20 -right-32 w-[40rem] h-[40rem] bg-brand-100/60 rounded-full blur-3xl -z-10" />
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600 bg-brand-100 px-2.5 py-1 rounded-full">
            <Check size={12} /> {t("hero.badge")}
          </span>
          <h1 className="mt-5 text-4xl lg:text-5xl font-bold text-brand-900 font-serif leading-tight">
            {t("hero.title.lead")}{" "}
            <span className="text-accent-500">{t("hero.title.minutes")}</span>.
            <br />
            {t("hero.title.tail")}
          </h1>
          <p className="mt-5 text-lg text-brand-700 max-w-xl">
            {t("hero.subhead")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenAccount}
              className="inline-flex items-center gap-2 rounded-md bg-brand-900 hover:bg-brand-800 text-white font-medium px-6 py-3 shadow-lg shadow-brand-900/20 transition-colors"
            >
              {t("hero.cta.open")} <ArrowRight size={16} />
            </button>
            <a
              href="#products"
              className="inline-flex items-center gap-2 rounded-md border border-brand-200 hover:border-brand-300 text-brand-800 font-medium px-6 py-3"
            >
              {t("hero.cta.explore")}
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-brand-600">
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-brand-500" />{" "}
              {t("hero.bullet.customers")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-brand-500" />{" "}
              {t("hero.bullet.transfers")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-brand-500" />{" "}
              {t("hero.bullet.banking")}
            </span>
          </div>
        </div>
        <HeroIllustration onOpenAccount={onOpenAccount} />
      </div>
    </section>
  );
};

const HeroIllustration = ({ onOpenAccount }: { onOpenAccount: () => void }) => {
  const { t } = useT();
  return (
    <div className="relative">
      <div className="relative mx-auto max-w-md aspect-[5/6] rounded-3xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 shadow-2xl">
        <div className="text-brand-200 text-xs uppercase tracking-widest">
          {t("card.balance")}
        </div>
        <div className="mt-2 text-white text-4xl font-bold font-serif">
          € 12.430,
          <span className="text-2xl text-brand-200">85</span>
        </div>
        <div className="mt-1 text-brand-200 text-sm">
          IBAN SI56 0510 0000 1234 567
        </div>
        <div className="mt-8 space-y-3">
          <Transaction
            name={t("card.tx.grocery")}
            amount="-€ 38,42"
            when={t("card.when.today")}
          />
          <Transaction
            name={t("card.tx.salary")}
            amount="+€ 1.860,00"
            when={t("card.when.yesterday")}
            credit
          />
          <Transaction
            name={t("card.tx.spotify")}
            amount="-€ 9,99"
            when={t("card.when.3d")}
          />
        </div>
        <button
          type="button"
          onClick={onOpenAccount}
          className="mt-8 w-full rounded-md bg-accent-400 hover:bg-accent-500 text-brand-900 font-semibold py-2.5 text-sm transition-colors"
        >
          {t("card.cta")}
        </button>
      </div>
    </div>
  );
};

const Transaction = ({
  name,
  amount,
  when,
  credit,
}: {
  name: string;
  amount: string;
  when: string;
  credit?: boolean;
}) => (
  <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 border border-white/10">
    <div className="min-w-0">
      <div className="text-sm font-medium text-white truncate">{name}</div>
      <div className="text-xs text-brand-300">{when}</div>
    </div>
    <div
      className={`text-sm font-semibold ${credit ? "text-accent-300" : "text-white"}`}
    >
      {amount}
    </div>
  </div>
);

// ── Products ───────────────────────────────────────────────────────────────
const PRODUCTS = [
  { icon: Wallet, key: "current" },
  { icon: PiggyBank, key: "savings" },
  { icon: Home, key: "mortgage" },
  { icon: CreditCard, key: "card" },
] as const;

const Products = () => {
  const { t } = useT();
  return (
    <section id="products" className="bg-white border-y border-brand-100">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">
            {t("products.eyebrow")}
          </span>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold font-serif text-brand-900">
            {t("products.heading")}
          </h2>
          <p className="mt-3 text-brand-700">{t("products.subhead")}</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRODUCTS.map((p) => (
            <article
              key={p.key}
              className="group rounded-2xl bg-brand-50/60 border border-brand-100 hover:border-brand-300 p-6 transition-colors flex flex-col"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-900 text-accent-300 flex items-center justify-center">
                <p.icon size={20} />
              </div>
              <h3 className="mt-5 font-serif font-bold text-xl text-brand-900">
                {t(`product.${p.key}.name`)}
              </h3>
              <p className="mt-2 text-sm text-brand-700 leading-relaxed flex-1">
                {t(`product.${p.key}.desc`)}
              </p>
              <a
                href="#"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 group-hover:text-brand-500"
              >
                {t(`product.${p.key}.cta`)} <ArrowRight size={14} />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Trust strip ────────────────────────────────────────────────────────────
const Trust = () => {
  const { t } = useT();
  return (
    <section className="bg-brand-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-14 grid sm:grid-cols-3 gap-8 text-center">
        <Stat big={t("trust.stat1.big")} small={t("trust.stat1.small")} />
        <Stat big={t("trust.stat2.big")} small={t("trust.stat2.small")} />
        <Stat big={t("trust.stat3.big")} small={t("trust.stat3.small")} />
      </div>
    </section>
  );
};

const Stat = ({ big, small }: { big: string; small: string }) => (
  <div>
    <div className="text-4xl font-bold font-serif text-accent-300">{big}</div>
    <div className="mt-2 text-sm text-brand-200 max-w-sm mx-auto">{small}</div>
  </div>
);

// ── Bottom CTA ─────────────────────────────────────────────────────────────
const BottomCTA = ({ onOpenAccount }: { onOpenAccount: () => void }) => {
  const { t } = useT();
  return (
    <section className="bg-gradient-to-br from-brand-50 to-white">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold font-serif text-brand-900">
          {t("bottomCta.heading")}
        </h2>
        <p className="mt-3 text-brand-700">{t("bottomCta.subhead")}</p>
        <button
          type="button"
          onClick={onOpenAccount}
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-900 hover:bg-brand-800 text-white font-medium px-8 py-3 shadow-lg shadow-brand-900/20 transition-colors"
        >
          {t("bottomCta.cta")} <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
};

// ── Footer ─────────────────────────────────────────────────────────────────
const Footer = () => {
  const { t } = useT();
  return (
    <footer className="bg-brand-950 text-brand-300 text-sm">
      <div className="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <Logo />
          <p className="mt-3 text-brand-400 text-xs leading-relaxed">
            {t("footer.tagline")}
          </p>
        </div>
        <FooterCol
          title={t("footer.col.personal")}
          links={[
            t("footer.personal.1"),
            t("footer.personal.2"),
            t("footer.personal.3"),
            t("footer.personal.4"),
            t("footer.personal.5"),
          ]}
        />
        <FooterCol
          title={t("footer.col.company")}
          links={[
            t("footer.company.1"),
            t("footer.company.2"),
            t("footer.company.3"),
            t("footer.company.4"),
            t("footer.company.5"),
          ]}
        />
        <FooterCol
          title={t("footer.col.help")}
          links={[
            t("footer.help.1"),
            t("footer.help.2"),
            t("footer.help.3"),
            t("footer.help.4"),
            t("footer.help.5"),
          ]}
        />
      </div>
      <div className="border-t border-brand-900">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-500">
          <span>
            © {new Date().getFullYear()} {t("footer.copyright")}
          </span>
          <span>{t("footer.poweredBy")}</span>
        </div>
      </div>
    </footer>
  );
};

const FooterCol = ({ title, links }: { title: string; links: string[] }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-brand-200">
      {title}
    </div>
    <ul className="mt-3 space-y-2">
      {links.map((l) => (
        <li key={l}>
          <a href="#" className="hover:text-white">
            {l}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

// ── KYC modal ──────────────────────────────────────────────────────────────
type KycPhase = "loading" | "widget" | "error";

// Real-world widget embeds (Stripe Checkout, Sumsub, Persona, iDenfy) all
// iframe a hosted widget by URL. We do the same: drop an iframe at the
// widget's URL with `?session=…` and the widget handles the rest, including
// its own "Continue on phone" QR. The widget posts
// `usercore.widget.{complete,close}` to window.parent — we listen below.
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
  const { t, lang } = useT();
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

  // Open the modal → kick off session creation immediately, no intermediate
  // form. The host site doesn't need to collect identity data — that's the
  // widget's job.
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
        lang,
      });
      setSessionId(data.sessionId);
      setIframeSrc(`${WIDGET_URL}/?${params.toString()}`);
      setPhase("widget");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  // The widget owns its own success screen ("submitted / waiting for review")
  // — we DON'T tear down the iframe on `complete`, but we DO pull the
  // customer's verified email + name from the session so we can register
  // them locally (so they can come back later and log in via email + OTP).
  // We close only when the user dismisses it themselves.
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
          // Non-fatal: registration just fails silently. The customer can
          // still log in later via the standard email + OTP flow.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // For the widget phase we render the iframe DIRECTLY inside the overlay
  // — no wrapper card, no host header. The widget's own Shell (rounded, with
  // its own header) is the only visible chrome, exactly like the dashboard's
  // "Test the flow" launcher. For loading/done/error we still use a small
  // host modal because those are host-owned states.
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
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl"
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
            <div className="inline-block w-8 h-8 border-2 border-brand-300 border-t-brand-900 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-brand-700">{t("kyc.starting")}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="p-8 text-center">
            <div className="text-red-600 font-medium">
              {t("kyc.error.title")}
            </div>
            <p className="mt-2 text-sm text-brand-700">{error}</p>
            <button
              type="button"
              onClick={start}
              className="mt-6 rounded-md border border-brand-200 px-5 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              {t("kyc.error.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
