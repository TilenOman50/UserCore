import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Check,
  Code2,
  Eye,
  FileText,
  LogOut,
  MessageSquare,
  Palette,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

// Demo-grade auth. Real-world: the host has its own users table + a real
// email-OTP service. Here we keep two things in localStorage:
//   - "workly.customers": every customer who completed KYC on this site,
//     keyed by their verified email (captured from the widget's email step).
//   - "workly.session":   the currently signed-in customer's email.
// On widget completion, App fetches /api/session-detail and calls
// registerCustomer() to add the row. Login = look up by email + OTP.
const CUSTOMERS_KEY = "workly.customers";
const SESSION_KEY = "workly.session";

export type Customer = {
  customerId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string | null;
  registeredAt: string;
};

const readCustomers = (): Record<string, Customer> => {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Customer>) : {};
  } catch {
    return {};
  }
};

const writeCustomers = (data: Record<string, Customer>) => {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(data));
};

type AuthCtx = {
  user: Customer | null;
  registerCustomer: (c: Omit<Customer, "registeredAt">) => void;
  findByEmail: (email: string) => Customer | null;
  login: (email: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Customer | null>(null);

  useEffect(() => {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return;
    const customer = readCustomers()[email.toLowerCase()];
    if (customer) setUser(customer);
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  const registerCustomer = useCallback((c: Omit<Customer, "registeredAt">) => {
    if (!c.email) return;
    const customers = readCustomers();
    const key = c.email.toLowerCase();
    customers[key] = {
      ...c,
      email: c.email,
      registeredAt: customers[key]?.registeredAt ?? new Date().toISOString(),
    };
    writeCustomers(customers);
  }, []);

  const findByEmail = useCallback(
    (email: string) => readCustomers()[email.trim().toLowerCase()] ?? null,
    [],
  );

  const login = useCallback((email: string) => {
    const key = email.trim().toLowerCase();
    const customer = readCustomers()[key];
    if (!customer) return;
    localStorage.setItem(SESSION_KEY, key);
    setUser(customer);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, registerCustomer, findByEmail, login, logout }),
    [user, registerCustomer, findByEmail, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
};

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

type LoginPhase = "email" | "code" | "not-found";

export const LoginModal = ({ onClose }: { onClose: () => void }) => {
  const { registerCustomer, login } = useAuth();
  const [phase, setPhase] = useState<LoginPhase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [expectedCode, setExpectedCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setChecking(true);
    try {
      // Real-world check: ask UserCore whether a customer in this workspace
      // has actually verified this email. localStorage alone wouldn't
      // survive a different browser / cleared cache, so the server's the
      // source of truth — localStorage just caches the identity snapshot.
      const r = await fetch(
        `/api/check-email?email=${encodeURIComponent(email)}`,
      );
      if (r.status === 404) {
        setPhase("not-found");
        return;
      }
      if (!r.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      const data = (await r.json()) as {
        customerId: string;
        firstName: string | null;
        lastName: string | null;
        status: string | null;
      };
      registerCustomer({
        customerId: data.customerId,
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        status: data.status,
      });
      setExpectedCode(generateOtp());
      setPhase("code");
    } finally {
      setChecking(false);
    }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.trim() !== expectedCode) {
      setError("Incorrect code. Please try again.");
      return;
    }
    login(email);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-400 hover:text-brand-700"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {phase === "email" && (
          <form className="p-7 sm:p-8 space-y-5" onSubmit={submitEmail}>
            <div>
              <h2 className="text-2xl font-extrabold text-brand-950">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-brand-700">
                Enter the email linked to your Workly account — we&apos;ll send
                you a 6-digit code.
              </p>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-brand-800">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="mt-1 w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </label>
            <button
              type="submit"
              disabled={checking}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold px-4 py-3 transition-colors"
            >
              Send code <ArrowRight size={14} />
            </button>
          </form>
        )}

        {phase === "code" && (
          <form className="p-7 sm:p-8 space-y-5" onSubmit={submitCode}>
            <div>
              <h2 className="text-2xl font-extrabold text-brand-950">
                Enter the code
              </h2>
              <p className="mt-1.5 text-sm text-brand-700">
                We&apos;ve sent a code to{" "}
                <span className="font-semibold text-brand-900">{email}</span>
              </p>
            </div>
            <div className="rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
              <span className="font-semibold">Demo OTP:</span>{" "}
              <span className="font-mono tracking-widest text-sm text-accent-700">
                {expectedCode}
              </span>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-brand-800">
                6-digit code
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="mt-1 w-full rounded-xl border border-brand-100 px-3 py-2.5 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-3 transition-colors"
            >
              Verify and sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setCode("");
                setError("");
              }}
              className="w-full text-xs text-brand-700 hover:text-brand-950"
            >
              ← Use a different email
            </button>
          </form>
        )}

        {phase === "not-found" && (
          <div className="p-7 sm:p-8 space-y-4 text-center">
            <h2 className="text-xl font-extrabold text-brand-950">Sign in</h2>
            <p className="text-sm text-brand-700">
              We can&apos;t find a Workly account with that email. Sign up
              first.
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setEmail("");
              }}
              className="text-xs text-brand-700 hover:text-brand-950 underline"
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Mock freelance feed data. Pure UI — same shape a real Workly feed would
// have. Different domain from Alpska on purpose so the demo shows UserCore
// integrated into two distinctly different products, not one template
// dressed twice.
const STAT_CARDS = [
  {
    label: "Active applications",
    value: "3",
    Icon: Briefcase,
    tone: "brand",
  },
  {
    label: "Earnings this month",
    value: "€ 1,240",
    Icon: Wallet,
    tone: "accent",
  },
  { label: "Profile views", value: "47", Icon: Eye, tone: "brand" },
  { label: "Avg client rating", value: "4.9", Icon: Star, tone: "amber" },
] as const;

const RECOMMENDED_JOBS = [
  {
    title: "Senior React engineer for fintech dashboard",
    client: "Northwind Finance · Frankfurt",
    budget: "€ 6,000 — 9,000",
    duration: "8 weeks · Remote",
    tags: ["React", "TypeScript", "Charts"],
    Icon: Code2,
    hot: true,
  },
  {
    title: "Brand designer — visual identity refresh",
    client: "Halcyon Studio · Lisbon",
    budget: "€ 2,500 fixed",
    duration: "3 weeks · Remote",
    tags: ["Figma", "Branding", "Typography"],
    Icon: Palette,
    hot: false,
  },
  {
    title: "Technical writer for a developer-tools docs site",
    client: "Brightway · Remote",
    budget: "€ 55 / hr",
    duration: "Ongoing · Part-time",
    tags: ["Docs", "Developer-tools", "MDX"],
    Icon: FileText,
    hot: false,
  },
] as const;

const RECENT_MESSAGES = [
  {
    sender: "Maja R. — Atlas Studio",
    preview: "Sounds great — can we hop on a call Thursday afternoon?",
    when: "12m",
    unread: true,
  },
  {
    sender: "Lumen Labs (Hiring)",
    preview: "Thanks for the proposal! We'd love to see a quick portfolio…",
    when: "2h",
    unread: true,
  },
  {
    sender: "Northwind Finance",
    preview: "Contract signed. Welcome aboard 🎉",
    when: "Yesterday",
    unread: false,
  },
] as const;

export const AccountPage = ({ onBackHome }: { onBackHome: () => void }) => {
  const { user, logout } = useAuth();
  if (!user) return null;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initial = (user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  const checklist: {
    label: string;
    done: boolean;
    Icon: typeof Check;
  }[] = [
    { label: "Account created", done: true, Icon: Check },
    { label: "Profile photo added", done: true, Icon: Check },
    { label: "Add a portfolio sample", done: false, Icon: FileText },
    { label: "Connect a payout method", done: false, Icon: Wallet },
    { label: "Set your hourly rate", done: false, Icon: TrendingUp },
  ];
  const completed = checklist.filter((c) => c.done).length;
  const completionPct = Math.round((completed / checklist.length) * 100);

  return (
    <main className="flex-1 bg-gradient-to-br from-brand-50/40 via-white to-accent-50/30">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <button
          type="button"
          onClick={onBackHome}
          className="text-sm text-brand-700 hover:text-brand-950"
        >
          ← Back to home
        </button>

        {/* Welcome hero */}
        <div className="mt-4 rounded-3xl bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 p-7 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur text-white text-2xl font-extrabold flex items-center justify-center shrink-0 ring-2 ring-white/20">
              {initial}
            </div>
            <div className="flex-1 min-w-[12rem]">
              <h1 className="text-2xl lg:text-3xl font-extrabold">
                Welcome back, {fullName.split(" ")[0]}.
              </h1>
              <p className="mt-1 text-sm text-white/85">
                Here&apos;s what&apos;s happening with your work today.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-semibold">
                <Sparkles size={11} /> Your profile is live and discoverable
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white font-semibold px-4 py-2 text-sm transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {/* Stat row */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    s.tone === "accent"
                      ? "bg-accent-50 text-accent-600"
                      : s.tone === "amber"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-brand-50 text-brand-600"
                  }`}
                >
                  <s.Icon size={16} />
                </span>
                {s.tone !== "amber" && (
                  <TrendingUp size={12} className="text-accent-500" />
                )}
              </div>
              <div className="mt-3 text-xl font-extrabold text-brand-950">
                {s.value}
              </div>
              <div className="text-xs text-brand-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-5">
          {/* Recommended jobs */}
          <section className="lg:col-span-2 rounded-3xl border border-brand-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
              <div>
                <div className="text-base font-extrabold text-brand-950">
                  Recommended for you
                </div>
                <div className="text-xs text-brand-500 mt-0.5">
                  Matched against your skills + verified profile
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Browse all →
              </button>
            </div>
            <ul className="divide-y divide-brand-50">
              {RECOMMENDED_JOBS.map((job) => (
                <li
                  key={job.title}
                  className="px-6 py-4 flex items-start gap-4 hover:bg-brand-50/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 text-brand-700 flex items-center justify-center shrink-0">
                    <job.Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-950">
                        {job.title}
                      </span>
                      {job.hot && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                          Hot
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-brand-600">
                      {job.client}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 text-[10px] font-semibold px-2 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-brand-950">
                      {job.budget}
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-500">
                      {job.duration}
                    </div>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-semibold px-3 py-1 text-xs transition-colors"
                    >
                      Apply <ArrowUpRight size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Profile completion + messages */}
          <aside className="space-y-5">
            <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-brand-950">
                  Profile completion
                </div>
                <div className="text-sm font-bold text-brand-600">
                  {completionPct}%
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-brand-50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <ul className="mt-4 space-y-2">
                {checklist.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2.5 text-xs"
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        item.done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-brand-50 text-brand-500"
                      }`}
                    >
                      <item.Icon size={12} />
                    </span>
                    <span
                      className={`flex-1 ${
                        item.done
                          ? "text-brand-500 line-through"
                          : "font-medium text-brand-800"
                      }`}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-brand-100 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-brand-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-brand-600" />
                  <span className="text-sm font-extrabold text-brand-950">
                    Messages
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-accent-100 text-accent-700 rounded-full px-2 py-0.5">
                  2 new
                </span>
              </div>
              <ul className="divide-y divide-brand-50">
                {RECENT_MESSAGES.map((m, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-brand-950 truncate">
                        {m.sender}
                      </div>
                      <div className="text-[10px] text-brand-500">{m.when}</div>
                    </div>
                    <div className="mt-1 text-xs text-brand-600 truncate flex items-center gap-1.5">
                      {m.unread && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
                      )}
                      <span className={m.unread ? "text-brand-800" : ""}>
                        {m.preview}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};
