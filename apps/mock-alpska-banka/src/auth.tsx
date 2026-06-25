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
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Coffee,
  CreditCard,
  LogOut,
  Music,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Train,
  Wallet,
  X,
} from "lucide-react";

import { useT } from "./i18n";

// Demo-grade auth. Real-world: the host has its own users table + a real
// email-OTP service. Here we keep two things in localStorage:
//   - "alpska.customers": every customer who completed KYC on this site,
//     keyed by their verified email (captured from the widget's email
//     step). Acts as the "users table".
//   - "alpska.session":   the currently signed-in customer's email.
// On widget completion, App fetches /api/session-detail and calls
// registerCustomer() to add the row. Login = look up by email + OTP.
const CUSTOMERS_KEY = "alpska.customers";
const SESSION_KEY = "alpska.session";

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

// Random 6-digit OTP. We generate it client-side and DISPLAY it in the
// modal — a real product emails it; for a demo, showing it is the most
// honest thing (no fake email infra, but the auth flow is otherwise real).
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

type LoginPhase = "email" | "code" | "not-found";

export const LoginModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useT();
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
      // has actually verified this email. localStorage alone wouldn't survive
      // a different browser / cleared cache, so the server's the source of
      // truth — localStorage just caches the identity snapshot.
      const r = await fetch(
        `/api/check-email?email=${encodeURIComponent(email)}`,
      );
      if (r.status === 404) {
        setPhase("not-found");
        return;
      }
      if (!r.ok) {
        setError(t("login.invalidCode"));
        return;
      }
      const data = (await r.json()) as {
        customerId: string;
        firstName: string | null;
        lastName: string | null;
        status: string | null;
      };
      // Cache identity snapshot locally so the account page can render the
      // customer's name + status without a second round-trip after sign-in.
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
      setError(t("login.invalidCode"));
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
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
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
              <h2 className="text-2xl font-bold font-serif text-brand-900">
                {t("login.title")}
              </h2>
              <p className="mt-1.5 text-sm text-brand-600">
                {t("login.subtitle")}
              </p>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-brand-700">
                {t("login.email")}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
            <button
              type="submit"
              disabled={checking}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white font-medium px-4 py-2.5 transition-colors"
            >
              {t("login.send")} <ArrowRight size={14} />
            </button>
          </form>
        )}

        {phase === "code" && (
          <form className="p-7 sm:p-8 space-y-5" onSubmit={submitCode}>
            <div>
              <h2 className="text-2xl font-bold font-serif text-brand-900">
                {t("login.codeTitle")}
              </h2>
              <p className="mt-1.5 text-sm text-brand-600">
                {t("login.codeSubtitle")}{" "}
                <span className="font-medium text-brand-800">{email}</span>
              </p>
            </div>
            <div className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
              <span className="font-semibold">{t("login.demoHint")}</span>{" "}
              <span className="font-mono tracking-widest text-sm text-accent-800">
                {expectedCode}
              </span>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-brand-700">
                {t("login.codeLabel")}
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
                className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2.5 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-md bg-brand-900 hover:bg-brand-800 text-white font-medium px-4 py-2.5 transition-colors"
            >
              {t("login.verify")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setCode("");
                setError("");
              }}
              className="w-full text-xs text-brand-600 hover:text-brand-900"
            >
              ← {t("login.back")}
            </button>
          </form>
        )}

        {phase === "not-found" && (
          <div className="p-7 sm:p-8 space-y-4 text-center">
            <h2 className="text-xl font-bold font-serif text-brand-900">
              {t("login.title")}
            </h2>
            <p className="text-sm text-brand-700">{t("login.notFound")}</p>
            <button
              type="button"
              onClick={() => {
                setPhase("email");
                setEmail("");
              }}
              className="text-xs text-brand-600 hover:text-brand-900 underline"
            >
              {t("login.back")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Mock recent transactions for the dashboard. Pure UI — never persisted; the
// real account starts at €0 until the customer is approved (see notice
// banner). The point is to make the post-login experience feel like an
// actual bank account dashboard, not a generic "you're logged in" page.
type MockTransaction = {
  nameKey: string;
  catKey: string;
  whenKey: string;
  whenN?: number;
  amount: string;
  Icon: typeof ShoppingBag;
  credit?: boolean;
};

const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    nameKey: "account.tx.grocery",
    catKey: "account.tx.groceryCat",
    whenKey: "account.tx.today",
    amount: "-38,42",
    Icon: ShoppingBag,
  },
  {
    nameKey: "account.tx.salary",
    catKey: "account.tx.salaryCat",
    whenKey: "account.tx.yesterday",
    amount: "+1.860,00",
    Icon: ArrowDownLeft,
    credit: true,
  },
  {
    nameKey: "account.tx.spotify",
    catKey: "account.tx.spotifyCat",
    whenKey: "account.tx.daysAgo",
    whenN: 2,
    amount: "-9,99",
    Icon: Music,
  },
  {
    nameKey: "account.tx.coffee",
    catKey: "account.tx.coffeeCat",
    whenKey: "account.tx.daysAgo",
    whenN: 3,
    amount: "-3,40",
    Icon: Coffee,
  },
  {
    nameKey: "account.tx.transport",
    catKey: "account.tx.transportCat",
    whenKey: "account.tx.daysAgo",
    whenN: 4,
    amount: "-1,30",
    Icon: Train,
  },
];

const QUICK_ACTIONS = [
  { key: "payBill", Icon: Receipt },
  { key: "transfer", Icon: ArrowUpRight },
  { key: "orderCard", Icon: CreditCard },
  { key: "openSavings", Icon: PiggyBank },
] as const;

const ACCOUNT_CARDS = [
  {
    titleKey: "account.cards.debit",
    subKey: "account.cards.debitSub",
    Icon: CreditCard,
    gradient: "from-brand-700 to-brand-900",
    last4: "4218",
  },
  {
    titleKey: "account.cards.credit",
    subKey: "account.cards.creditSub",
    Icon: CreditCard,
    gradient: "from-brand-900 to-brand-950",
    last4: "9047",
  },
  {
    titleKey: "account.cards.savings",
    subKey: "account.cards.savingsSub",
    Icon: PiggyBank,
    gradient: "from-accent-600 to-accent-800",
    last4: null,
  },
] as const;

export const AccountPage = ({ onBackHome }: { onBackHome: () => void }) => {
  const { t } = useT();
  const { user, logout } = useAuth();
  if (!user) return null;
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initial = (user.firstName?.[0] ?? user.email[0] ?? "?").toUpperCase();
  const registeredAt = new Date(user.registeredAt).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  return (
    <main className="flex-1 bg-gradient-to-br from-brand-50/60 via-white to-brand-50/40">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <button
          type="button"
          onClick={onBackHome}
          className="text-sm text-brand-600 hover:text-brand-900"
        >
          ← {t("account.backHome")}
        </button>

        <div className="mt-4">
          <h1 className="text-3xl lg:text-4xl font-bold font-serif text-brand-900">
            {t("account.welcome")} {fullName}.
          </h1>
          <p className="mt-1 text-brand-700">{t("account.subtitle")}</p>
        </div>

        <div className="mt-7 grid lg:grid-cols-3 gap-5">
          {/* Hero balance card */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 text-white p-6 shadow-lg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-brand-200">
                    {t("account.balance.account")}
                  </div>
                  <div className="mt-1 text-sm text-brand-200">
                    {t("account.balance.label")}
                  </div>
                </div>
                <Wallet size={20} className="text-accent-300" />
              </div>
              <div className="mt-3 text-4xl font-bold font-serif">
                € 12.430,<span className="text-2xl text-brand-200">85</span>
              </div>
              <div className="mt-2 text-xs text-brand-300 font-mono">
                {t("account.balance.iban")} SI56 0510 0000 1234 567
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-brand-950 font-semibold px-4 py-2 text-sm transition-colors"
                >
                  <ArrowUpRight size={14} /> {t("account.balance.send")}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 text-sm transition-colors"
                >
                  <Receipt size={14} /> {t("account.balance.pay")}
                </button>
              </div>
            </div>
          </div>

          {/* Profile sidebar */}
          <aside className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand-900 text-white text-base font-bold flex items-center justify-center">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-brand-900 truncate">
                  {fullName}
                </div>
                <div className="text-xs text-brand-500 truncate">
                  {user.email}
                </div>
              </div>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-brand-500">{t("account.memberSince")}</dt>
                <dd className="font-medium text-brand-800">{registeredAt}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={logout}
              className="mt-auto pt-5 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-200 hover:border-brand-300 text-brand-800 font-medium px-4 py-2 text-sm transition-colors"
            >
              <LogOut size={14} /> {t("account.signOut")}
            </button>
          </aside>
        </div>

        {/* Cards row */}
        <section className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
            {t("account.cards.title")}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {ACCOUNT_CARDS.map((c) => (
              <div
                key={c.titleKey}
                className={`relative h-32 rounded-2xl bg-gradient-to-br ${c.gradient} p-4 text-white shadow-md overflow-hidden`}
              >
                <c.Icon
                  size={20}
                  className="absolute top-3 right-3 text-white/70"
                />
                <div className="text-[11px] uppercase tracking-widest text-white/70">
                  {t(c.titleKey)}
                </div>
                <div className="mt-1 text-sm font-semibold">{t(c.subKey)}</div>
                {c.last4 && (
                  <div className="absolute bottom-3 left-4 right-4 text-xs font-mono text-white/80">
                    •••• •••• •••• {c.last4}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Transactions + quick actions */}
        <div className="mt-6 grid lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 rounded-2xl border border-brand-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100">
              <div className="text-sm font-semibold text-brand-900">
                {t("account.tx.title")}
              </div>
              <button
                type="button"
                className="text-xs text-brand-600 hover:text-brand-900 inline-flex items-center gap-0.5"
              >
                {t("account.tx.viewAll")} <ChevronRight size={12} />
              </button>
            </div>
            <ul className="divide-y divide-brand-50">
              {MOCK_TRANSACTIONS.map((tx, i) => (
                <li key={i} className="px-5 py-3 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.credit
                        ? "bg-accent-50 text-accent-700"
                        : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    <tx.Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-brand-900 truncate">
                      {t(tx.nameKey)}
                    </div>
                    <div className="text-xs text-brand-500 truncate">
                      {t(tx.catKey)} ·{" "}
                      {tx.whenN
                        ? t(tx.whenKey).replace("{n}", String(tx.whenN))
                        : t(tx.whenKey)}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      tx.credit ? "text-accent-700" : "text-brand-900"
                    }`}
                  >
                    € {tx.amount}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-brand-900">
              {t("account.qa.title")}
            </div>
            <ul className="mt-3 space-y-1">
              {QUICK_ACTIONS.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    className="w-full inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-brand-800 hover:bg-brand-50 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <a.Icon size={15} />
                    </span>
                    <span className="flex-1 text-left">
                      {t(`account.qa.${a.key}`)}
                    </span>
                    <ChevronRight size={14} className="text-brand-400" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
};
