"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronRight, Download, Eye, EyeOff, LayoutDashboard,
  LoaderCircle, LogOut, Menu, Plus, Search, Settings, ShieldCheck,
  Target, Trash2, TrendingUp, UserRound, Wallet, X, CreditCard,
  PiggyBank, RefreshCw, Sparkles, ChevronLeft,
} from "lucide-react";
import { auth } from "@/lib/neon-auth";

type Transaction = {
  id: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
};

type AuthApi = {
  getSession?: () => Promise<any>;
  signIn?: { email?: (v: { email: string; password: string }) => Promise<any> };
  signUp?: {
    email?: (v: {
      email: string;
      password: string;
      name?: string;
    }) => Promise<any>;
  };
  signOut?: () => Promise<any>;
};

type Budget = { id: string; category: string; limit: number };
type Goal = { id: string; name: string; target: number; saved: number };

const authApi = auth as unknown as AuthApi;

const EXPENSES = [
  "Food & groceries", "Transport", "Shopping", "Entertainment",
  "Bills & utilities", "Health", "Education", "Travel", "Other expense",
];

const INCOMES = [
  "Salary", "Freelance", "Business", "Investment", "Other income",
];

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";

function normalize(r: Record<string, unknown>): Transaction {
  return {
    id: String(r.id ?? ""),
    name: String(r.title ?? r.name ?? "Untitled transaction"),
    amount: Math.abs(Number(r.amount ?? 0)),
    type: r.type === "income" ? "income" : "expense",
    category: String(r.category ?? "Other expense"),
    date: String(r.transaction_date ?? r.date ?? today()).slice(0, 10),
  };
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LedgerPage() {
  const [view, setView] = useState<
    "loading" | "landing" | "signin" | "signup" | "app"
  >("loading");

  const [section, setSection] = useState("Overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [tx, setTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category: EXPENSES[0],
    date: today(),
  });

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSES[0]);
  const [budgetLimit, setBudgetLimit] = useState("10000");

  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("");

  const [calendarDate, setCalendarDate] = useState(new Date());

  const request = useCallback(
    async (url: string, init?: RequestInit) => {
      const response = await fetch(url, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `Request failed (${response.status})`
        );
      }

      return data;
    },
    []
  );

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/api/transactions");
      const rows = Array.isArray(data.transactions)
        ? data.transactions
        : Array.isArray(data)
          ? data
          : [];

      setTx(
        rows
          .map(normalize)
          .filter((t: Transaction) => t.id)
          .sort((a: Transaction, b: Transaction) =>
            b.date.localeCompare(a.date)
          )
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Public landing page stays available when the visitor is signed out.
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        if (!authApi.getSession) {
          if (active) setView("landing");
          return;
        }

        const result = await authApi.getSession();
        const session =
          result?.data?.session ??
          result?.data?.user ??
          result?.session ??
          result?.user;

        if (!active) return;

        if (session) {
          setView("app");
          void loadTransactions();
        } else {
          setView("landing");
        }
      } catch {
        if (active) setView("landing");
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [loadTransactions]);

  const totals = useMemo(() => {
    const income = tx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = tx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense, balance: income - expense, count: tx.length };
  }, [tx]);

  const thisMonth = useMemo(() => {
    const rows = tx.filter((t) => t.date.startsWith(monthKey()));

    return {
      income: rows
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0),
      expense: rows
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
      count: rows.length,
    };
  }, [tx]);

  const filtered = useMemo(() => {
    return tx.filter((t) => {
      const matchesType = filter === "all" || t.type === filter;
      const matchesQuery = `${t.name} ${t.category} ${t.date}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());

      const matchesStart = !startDate || t.date >= startDate;
      const matchesEnd = !endDate || t.date <= endDate;

      return matchesType && matchesQuery && matchesStart && matchesEnd;
    });
  }, [tx, filter, query, startDate, endDate]);

  const categories = useMemo(() => {
    return EXPENSES.map((category) => ({
      category,
      total: tx
        .filter((t) => t.type === "expense" && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0),
    }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [tx]);

  const nav = [
    ["Overview", LayoutDashboard],
    ["Transactions", Activity],
    ["Calendar", CalendarDays],
    ["Analytics", BarChart3],
    ["Budgets", Target],
    ["Goals", TrendingUp],
    ["Accounts", CreditCard],
    ["Settings", Settings],
  ] as const;

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      let result: any;

      if (view === "signin") {
        if (!authApi.signIn?.email) {
          throw new Error(
            "The installed Neon Auth client does not expose signIn.email(). Check your Neon Auth SDK configuration."
          );
        }

        result = await authApi.signIn.email({
          email: email.trim(),
          password,
        });
      } else {
        if (!authApi.signUp?.email) {
          throw new Error(
            "The installed Neon Auth client does not expose signUp.email(). Check your Neon Auth SDK configuration."
          );
        }

        result = await authApi.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
        });
      }

      if (result?.error) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : result.error.message || "Authentication failed."
        );
      }

      if (view === "signup") {
        const hasSession = Boolean(
          result?.data?.session || result?.session || result?.data?.user
        );

        if (!hasSession) {
          setNotice(
            "Your account request was submitted. If email verification is enabled, verify your email before signing in."
          );
          setView("signin");
          return;
        }
      }

      setPassword("");

const sessionResult = await authApi.getSession?.();
const session =
  sessionResult?.data?.session ??
  sessionResult?.data?.user ??
  sessionResult?.session ??
  sessionResult?.user;

if (!session) {
  setView("signin");
  throw new Error(
    "Sign-in returned successfully, but no session was found. Check the Neon Auth URL and cookie configuration."
  );
}

setView("app");
setNotice("Signed in successfully.");
await loadTransactions();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError("");
    setNotice("");

    try {
      if (!authApi.signOut) {
        throw new Error(
          "The installed Neon Auth client does not expose signOut(). Check your SDK configuration."
        );
      }

      const result: any = await authApi.signOut();

      if (result?.error) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : result.error.message || "Could not sign out."
        );
      }

      setTx([]);
      setPassword("");
      setView("landing");
      setSection("Overview");
      setNotice("You have signed out.");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function openAdd() {
    setError("");
    setForm({
      name: "",
      amount: "",
      type: "expense",
      category: EXPENSES[0],
      date: today(),
    });
    setModal(true);
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (
      !form.name.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !form.date
    ) {
      setError("Enter a description, valid positive amount, and date.");
      return;
    }

    if (form.date > today()) {
      setError("Transaction date cannot be in the future.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await request("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          title: form.name.trim(),
          amount: Math.round(amount * 100) / 100,
          type: form.type,
          category: form.category,
          transaction_date: form.date,
        }),
      });

      if (data.transaction?.id) {
        setTx((old) =>
          [normalize(data.transaction), ...old.filter(
            (t) => t.id !== data.transaction.id
          )].sort((a, b) => b.date.localeCompare(a.date))
        );
      } else {
        await loadTransactions();
      }

      setModal(false);
      setNotice("Transaction saved.");
      setSection("Transactions");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) {
      return;
    }

    setDeleting(id);
    setError("");

    try {
      await request("/api/transactions", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      setTx((old) => old.filter((t) => t.id !== id));
      setNotice("Transaction deleted.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  function exportCsv() {
    const csv = [
      ["Date", "Description", "Type", "Category", "Amount"],
      ...filtered.map((t) => [
        t.date, t.name, t.type, t.category, String(t.amount),
      ]),
    ]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `ledger-transactions-${today()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function saveBudget(e: React.FormEvent) {
    e.preventDefault();

    const limit = Number(budgetLimit);

    if (!Number.isFinite(limit) || limit <= 0) {
      setError("Enter a valid budget greater than zero.");
      return;
    }

    setBudgets((old) => {
      const existing = old.find((b) => b.category === budgetCategory);

      if (existing) {
        return old.map((b) =>
          b.category === budgetCategory ? { ...b, limit } : b
        );
      }

      return [...old, { id: newId(), category: budgetCategory, limit }];
    });

    setNotice("Budget updated for this session.");
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();

    const target = Number(goalTarget);
    const saved = Number(goalSaved || 0);

    if (
      !goalName.trim() ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0
    ) {
      setError("Enter a goal name, a valid target, and a valid saved amount.");
      return;
    }

    setGoals((old) => [
      ...old,
      {
        id: newId(),
        name: goalName.trim(),
        target,
        saved: Math.min(saved, target),
      },
    ]);

    setGoalName("");
    setGoalTarget("");
    setGoalSaved("");
    setNotice("Goal added for this session.");
  }

  function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    setNotice("Display name saved for this session.");
  }

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  function calendarTransactions(day: number) {
    const date = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tx.filter((t) => t.date === date);
  }

  if (view === "loading") {
    return (
      <main className="ledger-shell centered">
        <LoaderCircle className="spin" />
        <span>Preparing Ledger…</span>
        <style jsx global>{css}</style>
      </main>
    );
  }

  if (view !== "app") {
    return (
      <main className="auth-shell">
        <header className="auth-nav">
          <button className="brand" onClick={() => setView("landing")}>
            <span className="brand-symbol">L</span>
            <span>ledger<span className="brand-dot">.</span></span>
          </button>
          <span className="secure-pill"><i /> Private by design</span>
        </header>

        {view === "landing" ? (
          <section className="landing">
            <div className="eyebrow"><Sparkles size={14} /> FINANCIAL CLARITY, SIMPLIFIED</div>
            <h1>Your money.<br /><em>Your view.</em></h1>
            <p className="landing-copy">
              A calmer way to understand what comes in, what goes out, and what
              you’re building toward.
            </p>

            <div className="landing-actions">
              <button className="primary-btn" onClick={() => {
                setError("");
                setNotice("");
                setView("signup");
              }}>
                Create your account <ChevronRight size={17} />
              </button>
              <button className="secondary-btn" onClick={() => {
                setError("");
                setNotice("");
                setView("signin");
              }}>
                Sign in
              </button>
            </div>

            <div className="landing-points">
              <span><ShieldCheck size={16} /> Private session</span>
              <span><Activity size={16} /> Transaction tracking</span>
              <span><BarChart3 size={16} /> Clear insights</span>
            </div>

            {notice && <Alert text={notice} success />}
            {error && <Alert text={error} />}

            <div className="preview-card glass">
              <div className="eyebrow">YOUR OVERVIEW</div>
              <div className="preview-balance">₹ 84,250.00</div>
              <p>Illustrative preview · not your actual account balance</p>
              <div className="preview-bars">
                {[35, 56, 43, 75, 53, 88, 62, 78, 47, 94, 68, 82].map((v, i) => (
                  <i key={i} style={{ height: `${v}%` }} />
                ))}
              </div>
            </div>
          </section>
        ) : (
          <form className="auth-card glass" onSubmit={authenticate}>
            <button type="button" className="back-link" onClick={() => {
              setError("");
              setView("landing");
            }}>
              ← Back to Ledger
            </button>

            <div className="eyebrow"><ShieldCheck size={14} /> YOUR FINANCES, PROTECTED</div>
            <h1>{view === "signin" ? "Welcome back." : "Create your account."}</h1>
            <p className="auth-desc">
              {view === "signin"
                ? "Sign in to open your finance dashboard."
                : "Start recording and understanding your money."}
            </p>

            {error && <Alert text={error} />}
            {notice && <Alert text={notice} success />}

            {view === "signup" && (
              <label className="form-field">
                <span>Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                  placeholder="Full name"
                />
              </label>
            )}

            <label className="form-field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete={view === "signin" ? "current-password" : "new-password"}
                  required
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button className="primary-btn auth-submit" disabled={busy}>
              {busy ? <><LoaderCircle className="spin" size={16} /> Please wait…</> :
                view === "signin" ? "Sign in securely" : "Create account"}
            </button>

            <p className="switch-auth">
              {view === "signin" ? "New to Ledger?" : "Already have an account?"}
              {" "}
              <button type="button" onClick={() => {
                setError("");
                setNotice("");
                setView(view === "signin" ? "signup" : "signin");
              }}>
                {view === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>

            <p className="privacy-note">
              <ShieldCheck size={13} /> Your password is handled by the auth provider.
            </p>
          </form>
        )}

        <style jsx global>{css}</style>
      </main>
    );
  }

  return (
    <main className="ledger-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-glow" />

      <aside className={`sidebar glass ${mobile ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => setSection("Overview")}>
          <span className="brand-symbol">L</span>
          <span>ledger<span className="brand-dot">.</span></span>
        </button>

        <div className="workspace-label">YOUR FINANCES</div>

        <nav className="nav-list">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${section === label ? "nav-active" : ""}`}
              onClick={() => {
                setSection(label);
                setMobile(false);
                setError("");
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {section === label && <i className="active-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom glass-soft">
          <ShieldCheck size={19} />
          <div>
            <strong>Your money. Your view.</strong>
            <p>Personal finance workspace</p>
          </div>
        </div>

        <div className="sidebar-footer"><i className="online-dot" /> Signed-in workspace</div>
      </aside>

      {mobile && (
        <button className="mobile-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />
      )}

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu-btn" onClick={() => setMobile(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
            <div className="breadcrumb">Ledger <span>/</span> {section}</div>
          </div>

          <div className="topbar-actions">
            <button className="icon-btn" title="Refresh transactions" onClick={() => void loadTransactions()}>
              <RefreshCw size={16} />
            </button>
            <button className="avatar" title="Account" onClick={() => setSection("Accounts")}>
              <UserRound size={17} />
            </button>
            <button className="icon-btn" title="Sign out" onClick={() => void signOut()}>
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><Sparkles size={14} /> FINANCIAL CLARITY, SIMPLIFIED</div>
              <h1>{section === "Overview" ? "Your money, in focus." : section}</h1>
              <p className="subtitle">
                {section === "Overview"
                  ? "A live view of your income, spending, and what stays with you."
                  : `A clearer view of your ${section.toLowerCase()}.`}
              </p>
            </div>
            <button className="primary-btn" onClick={openAdd}>
              <Plus size={18} /> Add transaction
            </button>
          </section>

          {(error || notice) && (
            <Alert
              text={error || notice}
              success={!error}
              onClose={() => { setError(""); setNotice(""); }}
            />
          )}

          {section === "Overview" && (
            <>
              <div className="metrics-grid">
                {[
                  ["Total balance", money(totals.balance), Wallet, "Income minus expenses"],
                  ["Total income", money(totals.income), ArrowDownLeft, "All recorded income"],
                  ["Total expenses", money(totals.expense), ArrowUpRight, "All recorded expenses"],
                  ["Transactions", String(totals.count), CalendarDays, `${thisMonth.count} this month`],
                ].map(([label, value, Icon, foot], i) => {
                  const I = Icon as typeof Wallet;
                  return (
                    <article className={`metric-card glass ${i === 0 ? "metric-featured" : ""}`} key={String(label)}>
                      <div className="metric-top">
                        <span className="metric-label">{label as string}</span>
                        <span className="metric-icon"><I size={19} /></span>
                      </div>
                      <div className="metric-value">{value as string}</div>
                      <div className="metric-foot">{foot as string}</div>
                    </article>
                  );
                })}
              </div>

              <div className="insight-grid">
                <article className="panel glass">
                  <div className="eyebrow">MONTHLY SNAPSHOT</div>
                  <h2>This month</h2>
                  <p className="muted">Based on your recorded transactions</p>
                  <div className="snapshot-row">
                    <div><span>Income</span><strong className="income-text">{money(thisMonth.income)}</strong></div>
                    <div><span>Expenses</span><strong className="expense-text">{money(thisMonth.expense)}</strong></div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-income" style={{
                      width: `${thisMonth.income + thisMonth.expense
                        ? thisMonth.income / (thisMonth.income + thisMonth.expense) * 100
                        : 0}%`,
                    }} />
                  </div>
                  <div className="snapshot-bottom">
                    <span>Net this month</span>
                    <strong>{money(thisMonth.income - thisMonth.expense)}</strong>
                  </div>
                </article>

                <article className="panel glass">
                  <div className="panel-heading">
                    <div><div className="eyebrow">LATEST ACTIVITY</div><h2>Recent transactions</h2></div>
                    <button className="text-button" onClick={() => setSection("Transactions")}>
                      View all <ChevronRight size={14} />
                    </button>
                  </div>
                  {loading ? <LoaderCircle className="spin" /> :
                    <Rows tx={tx.slice(0, 5)} onDelete={deleteTransaction} deleting={deleting} />}
                </article>
              </div>
            </>
          )}

          {section === "Transactions" && (
            <section className="panel glass">
              <div className="panel-heading">
                <div><div className="eyebrow">YOUR RECORDS</div><h2>All transactions</h2><p>{filtered.length} matching entries</p></div>
                <button className="secondary-btn compact-btn" onClick={exportCsv}>
                  <Download size={15} /> Export CSV
                </button>
              </div>

              <div className="table-tools">
                <label className="search-box">
                  <Search size={16} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search description, category, date…" />
                </label>
                <label className="filter-box">
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="all">All types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expenses</option>
                  </select>
                </label>
              </div>

              <div className="date-filters">
                <label>From <input type="date" value={startDate} max={endDate || today()} onChange={(e) => setStartDate(e.target.value)} /></label>
                <label>To <input type="date" value={endDate} min={startDate || undefined} max={today()} onChange={(e) => setEndDate(e.target.value)} /></label>
                <button className="secondary-btn" onClick={() => { setStartDate(""); setEndDate(""); setQuery(""); setFilter("all"); }}>Clear filters</button>
              </div>

              {loading ? <LoaderCircle className="spin" /> :
                <Rows tx={filtered} onDelete={deleteTransaction} deleting={deleting} showDate />}
            </section>
          )}

          {section === "Calendar" && (
            <section className="panel glass">
              <div className="panel-heading">
                <div><div className="eyebrow">DATE-WISE ACTIVITY</div><h2>{calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2></div>
                <div className="calendar-controls">
                  <button className="icon-btn" onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
                  <button className="icon-btn" onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div className="calendar-weekday" key={d}>{d}</div>)}
                {Array.from({ length: firstWeekday }, (_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const entries = calendarTransactions(day);
                  const income = entries.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
                  const expense = entries.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
                  const date = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  return (
                    <button key={day} className={`calendar-day ${date === today() ? "calendar-today" : ""}`} onClick={() => {
                      setStartDate(date);
                      setEndDate(date);
                      setSection("Transactions");
                    }}>
                      <strong>{day}</strong>
                      {entries.length > 0 && <span className="calendar-count">{entries.length} item{entries.length === 1 ? "" : "s"}</span>}
                      {income > 0 && <small className="income-text">+{money(income)}</small>}
                      {expense > 0 && <small className="expense-text">−{money(expense)}</small>}
                    </button>
                  );
                })}
              </div>
              <p className="muted">Select a date to view its transactions.</p>
            </section>
          )}

          {section === "Analytics" && (
            <>
              <div className="metrics-grid">
                {[
                  ["Income this month", money(thisMonth.income)],
                  ["Expenses this month", money(thisMonth.expense)],
                  ["Monthly net", money(thisMonth.income - thisMonth.expense)],
                  ["Average expense", money(
                    tx.filter((t) => t.type === "expense").length
                      ? totals.expense / tx.filter((t) => t.type === "expense").length
                      : 0
                  )],
                ].map(([label, value]) => (
                  <article className="metric-card glass" key={label}>
                    <span className="metric-label">{label}</span>
                    <div className="metric-value">{value}</div>
                  </article>
                ))}
              </div>

              <div className="insight-grid">
                <article className="panel glass">
                  <div className="eyebrow">SPENDING BREAKDOWN</div>
                  <h2>Expenses by category</h2>
                  {categories.length ? categories.map((c) => (
                    <div className="category-line" key={c.category}>
                      <div><span>{c.category}</span><strong>{money(c.total)}</strong></div>
                      <div className="progress-track">
                        <div className="progress-income" style={{ width: `${totals.expense ? c.total / totals.expense * 100 : 0}%` }} />
                      </div>
                    </div>
                  )) : <Empty text="Add expenses to see your breakdown." />}
                </article>

                <article className="panel glass">
                  <div className="eyebrow">INCOME VS EXPENSES</div>
                  <h2>Overall comparison</h2>
                  <div className="summary-bar">
                    <span>Income</span>
                    <div className="progress-track"><div className="progress-income" style={{ width: `${totals.income + totals.expense ? totals.income / (totals.income + totals.expense) * 100 : 0}%` }} /></div>
                    <strong>{money(totals.income)}</strong>
                  </div>
                  <div className="summary-bar">
                    <span>Expenses</span>
                    <div className="progress-track"><div className="bar-expense" style={{ width: `${totals.income + totals.expense ? totals.expense / (totals.income + totals.expense) * 100 : 0}%` }} /></div>
                    <strong>{money(totals.expense)}</strong>
                  </div>
                  <p className="muted">Insights are calculated from recorded transactions only.</p>
                </article>
              </div>
            </>
          )}

          {section === "Budgets" && (
            <section className="panel glass">
              <div className="eyebrow">SPENDING GUARDRAILS</div>
              <h2>Category budgets</h2>
              <p className="muted">Set limits and track expenses for the current month.</p>

              <form className="inline-form" onSubmit={saveBudget}>
                <label className="form-field"><span>Category</span>
                  <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
                    {EXPENSES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="form-field"><span>Monthly limit (₹)</span>
                  <input type="number" min="1" step="0.01" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} required />
                </label>
                <button className="primary-btn"><Check size={15} /> Save budget</button>
              </form>

              {budgets.length === 0 && <Empty text="Create your first budget to start tracking category limits." />}

              {budgets.map((b) => {
                const spent = tx.filter((t) => t.type === "expense" && t.category === b.category && t.date.startsWith(monthKey())).reduce((s, t) => s + t.amount, 0);
                const percent = Math.min(100, spent / b.limit * 100);

                return (
                  <div className="budget-line" key={b.id}>
                    <div><strong>{b.category}</strong><span>{money(spent)} of {money(b.limit)}</span></div>
                    <button className="delete-btn" onClick={() => setBudgets((old) => old.filter((item) => item.id !== b.id))} aria-label={`Delete ${b.category} budget`}><Trash2 size={15} /></button>
                    <div className="progress-track"><div className={spent > b.limit ? "bar-expense" : "progress-income"} style={{ width: `${percent}%` }} /></div>
                    <p className={spent > b.limit ? "expense-text" : "muted"}>{spent > b.limit ? "Over budget" : `${Math.round(percent)}% used`}</p>
                  </div>
                );
              })}
              <p className="muted">Budgets are currently stored for this page session; persistent budget storage requires a backend table.</p>
            </section>
          )}

          {section === "Goals" && (
            <section className="panel glass">
              <div className="eyebrow">BUILD TOWARD SOMETHING</div>
              <h2>Savings goals</h2>
              <p className="muted">Create goals and track your progress.</p>

              <form className="inline-form" onSubmit={saveGoal}>
                <label className="form-field"><span>Goal name</span><input value={goalName} onChange={(e) => setGoalName(e.target.value)} required maxLength={100} placeholder="Emergency fund" /></label>
                <label className="form-field"><span>Target (₹)</span><input type="number" min="1" step="0.01" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} required /></label>
                <label className="form-field"><span>Already saved (₹)</span><input type="number" min="0" step="0.01" value={goalSaved} onChange={(e) => setGoalSaved(e.target.value)} /></label>
                <button className="primary-btn"><Plus size={15} /> Add goal</button>
              </form>

              {goals.length === 0 && <Empty text="Your savings goals will appear here." />}

              {goals.map((g) => (
                <div className="goal-line" key={g.id}>
                  <div className="panel-heading"><strong>{g.name}</strong><button className="delete-btn" onClick={() => setGoals((old) => old.filter((goal) => goal.id !== g.id))} aria-label={`Delete ${g.name}`}><Trash2 size={15} /></button></div>
                  <div className="snapshot-bottom"><span>{money(g.saved)} saved</span><strong>{money(g.target)}</strong></div>
                  <div className="progress-track"><div className="progress-income" style={{ width: `${Math.min(100, g.saved / g.target * 100)}%` }} /></div>
                  <p className="muted">{Math.round(g.saved / g.target * 100)}% complete · {money(Math.max(0, g.target - g.saved))} remaining</p>
                </div>
              ))}
              <p className="muted">Goals are currently stored for this page session; persistent storage requires a backend table.</p>
            </section>
          )}

          {section === "Accounts" && (
            <section className="panel glass">
              <div className="eyebrow">ACCOUNT OVERVIEW</div>
              <h2>Your Ledger account</h2>
              <div className="account-summary">
                <div className="avatar"><UserRound size={20} /></div>
                <div><strong>{displayName || name || "Ledger user"}</strong><span>{email || "Signed-in account"}</span></div>
                <ShieldCheck size={20} className="income-text" />
              </div>
              <div className="account-stats">
                <div><span>Total income</span><strong>{money(totals.income)}</strong></div>
                <div><span>Total expenses</span><strong>{money(totals.expense)}</strong></div>
                <div><span>Net balance</span><strong>{money(totals.balance)}</strong></div>
              </div>
              <p className="muted">Transaction records are loaded from your authenticated Ledger API.</p>
              <button className="secondary-btn" onClick={() => setSection("Settings")}><Settings size={16} /> Account settings</button>
              <button className="secondary-btn signout-btn" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button>
            </section>
          )}

          {section === "Settings" && (
            <section className="panel glass">
              <div className="eyebrow">PREFERENCES & SECURITY</div>
              <h2>Account settings</h2>
              <form className="settings-form" onSubmit={savePreferences}>
                <label className="form-field"><span>Display name</span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} placeholder="Your name" />
                </label>
                <label className="form-field"><span>Email</span>
                  <input value={email} readOnly aria-readonly="true" />
                </label>
                <p className="muted">Your email is managed by Neon Auth. Display name changes here apply to this page session; persistent profile updates require a profile API.</p>
                <button className="primary-btn"><Check size={16} /> Save preferences</button>
              </form>
              <hr />
              <div className="security-row">
                <div><strong>Sign out</strong><p className="muted">End your Ledger session on this device.</p></div>
                <button className="secondary-btn" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span><ShieldCheck size={13} /> Records load from your Ledger account.</span>
            <span>Ledger · Personal finance</span>
          </footer>
        </div>
      </section>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) setModal(false);
        }}>
          <form className="transaction-modal glass" onSubmit={addTransaction}>
            <div className="modal-header">
              <div><div className="eyebrow">NEW ENTRY</div><h2>Add transaction</h2><p>Record money moving in or out.</p></div>
              <button type="button" className="icon-btn" onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="type-toggle">
              <button type="button" className={form.type === "expense" ? "expense-selected" : ""} onClick={() => setForm((f) => ({ ...f, type: "expense", category: EXPENSES[0] }))}><ArrowUpRight size={16} /> Expense</button>
              <button type="button" className={form.type === "income" ? "income-selected" : ""} onClick={() => setForm((f) => ({ ...f, type: "income", category: INCOMES[0] }))}><ArrowDownLeft size={16} /> Income</button>
            </div>

            <label className="form-field"><span>Amount (₹)</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" required /></label>
            <label className="form-field"><span>Description</span><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={120} placeholder="e.g. Groceries, salary" required /></label>

            <div className="form-two-col">
              <label className="form-field"><span>Category</span>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {(form.type === "income" ? INCOMES : EXPENSES).map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="form-field"><span>Date</span><input type="date" value={form.date} max={today()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required /></label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary-btn" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Save transaction</button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{css}</style>
    </main>
  );
}

function Alert({ text, success = false, onClose }: { text: string; success?: boolean; onClose?: () => void }) {
  return (
    <div className={`alert ${success ? "alert-success" : "alert-error"}`} role="status">
      <span>{text}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss"><X size={15} /></button>}
    </div>
  );
}

function Rows({ tx, onDelete, deleting, showDate = false }: {
  tx: Transaction[];
  onDelete: (id: string) => void;
  deleting: string | null;
  showDate?: boolean;
}) {
  if (!tx.length) return <Empty text="No transactions yet. Add an entry to see it here." />;

  return (
    <div className="transaction-list">
      {tx.map((t) => (
        <article className="transaction-row" key={t.id}>
          <div className={`transaction-icon ${t.type === "income" ? "income-icon" : "expense-icon"}`}>
            {t.type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </div>
          <div className="transaction-info">
            <strong>{t.name}</strong>
            <span>{t.category} · {showDate ? new Date(`${t.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : t.date}</span>
          </div>
          <div className="transaction-right">
            <strong className={`transaction-amount ${t.type === "income" ? "income-text" : "expense-text"}`}>
              {t.type === "income" ? "+" : "−"}{money(t.amount)}
            </strong>
            <button className="delete-btn" disabled={deleting === t.id} title="Delete transaction" onClick={() => onDelete(t.id)}>
              {deleting === t.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state"><Wallet size={24} /><strong>Nothing here yet</strong><p>{text}</p></div>;
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

:root{color-scheme:dark;--bg:#080a10;--line:#ffffff18;--text:#f3f5ff;--muted:#8c93aa;--green:#a7f77b;--pink:#ff8db5}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg)}
body{color:var(--text);font-family:'DM Sans',sans-serif}
button,input,select{font:inherit}
button{cursor:pointer}
button:disabled{opacity:.55;cursor:not-allowed}
.ledger-shell,.auth-shell{position:relative;isolation:isolate;display:flex;min-height:100vh;overflow:hidden;background:radial-gradient(ellipse at 70% -15%,#5c43be2e,transparent 43%),radial-gradient(ellipse at 5% 90%,#249aa21f,transparent 40%),#080a10}
.auth-shell{display:block;padding:28px clamp(18px,5vw,70px)}
.centered{align-items:center;justify-content:center;gap:12px}
.ambient{position:fixed;z-index:-1;width:390px;height:390px;border-radius:50%;filter:blur(90px);opacity:.17;pointer-events:none}
.ambient-one{top:-160px;left:25%;background:#7956ef}.ambient-two{top:30%;right:-240px;background:#20b9c7}
.grid-glow{position:fixed;inset:0;z-index:-1;opacity:.15;pointer-events:none;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:48px 48px}
@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}
.glass{background:linear-gradient(145deg,#ffffff12,#ffffff06);border:1px solid #ffffff1b;box-shadow:0 20px 60px #0003,inset 0 1px #ffffff0b;backdrop-filter:blur(24px)}
.glass-soft{background:#ffffff09;border:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:11px;padding:0 12px;color:var(--text);font:800 23px 'Manrope';letter-spacing:-1.2px;background:none;border:0}
.brand-symbol{display:grid;place-items:center;width:35px;height:35px;border-radius:12px;color:#10180f;background:linear-gradient(135deg,#c4ff9d,#62dfb5);font-size:20px}
.brand-dot{color:var(--green)}
.eyebrow{display:flex;align-items:center;gap:7px;color:#9ab9a4;font-size:10px;letter-spacing:1.5px;font-weight:700}
.primary-btn,.secondary-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:43px;padding:0 17px;border-radius:12px;font-size:12px;font-weight:700}
.primary-btn{border:1px solid #ceffb480;color:#11170f;background:linear-gradient(135deg,#c4ff9d,#7ce8bd)}
.secondary-btn{color:#d9deeb;border:1px solid var(--line);background:#ffffff0b}
.secure-pill{display:flex;align-items:center;gap:8px;padding:8px 11px;color:#a6b0c3;border:1px solid var(--line);border-radius:30px;font-size:10px}
.secure-pill i,.online-dot{width:6px;height:6px;background:var(--green);border-radius:50%}
.auth-nav{display:flex;align-items:center;justify-content:space-between;max-width:1300px;margin:auto}
.landing{max-width:850px;margin:clamp(65px,11vh,120px) auto 60px}
.landing h1{font:800 clamp(52px,8vw,92px)/1.03 'Manrope';letter-spacing:-5px;margin:22px 0}
.landing h1 em{font-style:normal;color:var(--green)}
.landing-copy{max-width:570px;color:var(--muted);font-size:16px;line-height:1.8}
.landing-actions{display:flex;gap:12px;margin-top:27px}
.landing-points{display:flex;flex-wrap:wrap;gap:22px;margin-top:35px;color:#9da6ba;font-size:11px}
.landing-points span{display:flex;align-items:center;gap:7px}
.preview-card{position:absolute;right:8%;top:36%;width:300px;padding:22px;border-radius:20px;transform:rotate(2deg)}
.preview-balance{font:800 29px 'Manrope';margin-top:25px}
.preview-card p,.auth-desc{color:var(--muted);font-size:11px}
.preview-bars{height:100px;display:flex;align-items:flex-end;gap:7px;margin-top:25px}
.preview-bars i{flex:1;border-radius:5px 5px 2px 2px;background:linear-gradient(#b9ff8c,#53cda8)}
.auth-card{width:min(100%,440px);margin:clamp(45px,8vh,90px) auto;padding:30px;border-radius:23px}
.back-link{background:none;border:0;color:#9da6ba;font-size:11px;margin-bottom:28px}
.auth-card h1{font:800 29px 'Manrope';margin:15px 0 8px}
.auth-desc{line-height:1.7;margin-bottom:25px}
.form-field{display:grid;gap:8px;min-width:0;margin-bottom:16px}
.form-field>span{color:#aeb6c9;font-size:11px;font-weight:600}
.form-field input,.form-field select{width:100%;min-width:0;height:43px;padding:0 12px;color:#edf0fa;border:1px solid #ffffff1a;border-radius:10px;background:#10131e;font-size:12px}
.password-wrap{display:flex;align-items:center;border:1px solid #ffffff1a;border-radius:10px;background:#0004}
.password-wrap input{border:0;background:transparent}
.password-wrap button{background:none;border:0;color:#9da6ba;padding:10px}
.auth-submit{width:100%;margin-top:7px}
.switch-auth{text-align:center;color:var(--muted);font-size:11px;margin-top:22px}
.switch-auth button{border:0;background:none;color:var(--green);font-weight:700}
.privacy-note{display:flex;justify-content:center;align-items:center;gap:6px;color:#747d91;font-size:10px;margin:17px 0 0}
.sidebar{width:248px;flex:0 0 248px;min-height:100vh;padding:29px 17px 20px;border:0;border-right:1px solid var(--line);border-radius:0 24px 24px 0;display:flex;flex-direction:column;z-index:20}
.workspace-label{margin:49px 12px 15px;color:#69728c;font-size:10px;letter-spacing:1.8px;font-weight:700}
.nav-list{display:grid;gap:6px}
.nav-item{display:flex;align-items:center;gap:13px;width:100%;padding:12px 13px;color:#9ca3b9;border:1px solid transparent;border-radius:12px;background:transparent;text-align:left;font-size:13px}
.nav-active{color:#d8ffbf;background:#a7f77b15;border-color:#a7f77b22}
.active-indicator{margin-left:auto;width:5px;height:5px;border-radius:50%;background:var(--green)}
.sidebar-bottom{margin-top:auto;display:flex;gap:10px;align-items:center;padding:14px 12px;border-radius:14px;color:var(--green)}
.sidebar-bottom strong{font-size:11px;color:var(--text)}
.sidebar-bottom p{margin:5px 0 0;font-size:10px;color:var(--muted)}
.sidebar-footer{display:flex;align-items:center;gap:8px;color:#747d91;font-size:10px;padding:19px 8px 0}
.main-area{min-width:0;flex:1}
.topbar{height:77px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,52px);border-bottom:1px solid #ffffff0f}
.topbar-left{display:flex;align-items:center;gap:11px}
.breadcrumb{color:#929ab0;font-size:12px}.breadcrumb span{color:#535b70;padding:0 9px}
.topbar-actions{display:flex;align-items:center;gap:9px}
.avatar,.icon-btn{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;border:1px solid var(--line);color:#c2c9d9;background:#ffffff08}
.avatar{color:var(--green)}
.content{width:100%;max-width:1500px;margin:0 auto;padding:42px clamp(20px,4vw,52px) 25px}
.welcome-row{display:flex;justify-content:space-between;align-items:flex-end;gap:22px;margin-bottom:29px}
.welcome-row h1{margin:14px 0 8px;font:700 clamp(27px,3vw,39px)/1.2 'Manrope';letter-spacing:-1.5px}
.subtitle{color:var(--muted);margin:0;font-size:13px;line-height:1.6}
.metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}
.metric-card{min-width:0;overflow:hidden;padding:20px;border-radius:18px}
.metric-featured{background:linear-gradient(135deg,#a7f77b1c,#ffffff09)}
.metric-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.metric-label{color:#a0a7ba;font-size:11px}
.metric-icon{display:grid;place-items:center;width:37px;height:37px;border:1px solid var(--line);border-radius:12px;color:var(--green)}
.metric-value{margin-top:22px;font:700 clamp(19px,2vw,26px)/1.25 'Manrope';overflow-wrap:anywhere}
.metric-foot{margin-top:13px;color:#9ba4b7;font-size:10px}
.insight-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px;margin-top:18px}
.panel{min-width:0;border-radius:19px;padding:23px}
.panel h2{margin:9px 0 5px;font:700 18px 'Manrope'}
.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}
.snapshot-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}
.snapshot-row>div{display:grid;gap:11px}
.snapshot-row span{color:var(--muted);font-size:11px}
.snapshot-row strong{font:700 17px 'Manrope';overflow-wrap:anywhere}
.income-text{color:var(--green)!important}.expense-text{color:var(--pink)!important}
.progress-track{height:5px;border-radius:20px;overflow:hidden;background:#ffffff14;margin-top:10px}
.progress-income{height:100%;border-radius:inherit;background:linear-gradient(90deg,#9be875,#65d9b8)}
.bar-expense{height:100%;display:block;background:var(--pink)}
.snapshot-bottom{display:flex;justify-content:space-between;margin-top:17px;color:var(--muted);font-size:11px}
.transaction-list{display:grid;margin-top:20px}
.transaction-row{display:flex;align-items:center;gap:12px;min-width:0;padding:13px 0;border-bottom:1px solid #ffffff0f}
.transaction-icon{flex:0 0 38px;width:38px;height:38px;display:grid;place-items:center;border-radius:12px}
.income-icon{color:var(--green);background:#a7f77b17}.expense-icon{color:var(--pink);background:#ff8db517}
.transaction-info{flex:1;min-width:0}
.transaction-info strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.transaction-info span{display:block;margin-top:5px;color:var(--muted);font-size:10px}
.transaction-right{display:flex;align-items:center;gap:9px}
.transaction-amount{font-size:12px;font-weight:700;white-space:nowrap}
.delete-btn{display:grid;place-items:center;width:30px;height:30px;border:1px solid transparent;border-radius:9px;background:transparent;color:#7e879c}
.empty-state{display:grid;justify-items:center;text-align:center;padding:34px 12px;color:var(--muted);gap:8px}
.empty-state strong{color:#e4e8f5;font-size:13px}.empty-state p{margin:0;font-size:11px;line-height:1.6}
.table-tools{display:flex;gap:10px;margin:24px 0 8px}
.search-box,.filter-box{display:flex;align-items:center;gap:9px;min-height:41px;padding:0 12px;border:1px solid var(--line);border-radius:11px;background:#0002}
.search-box{flex:1}.search-box input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--text);font-size:12px}
.filter-box select{border:0;outline:0;color:#d5daea;background:#10131e;font-size:11px}
.date-filters{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0}
.date-filters label{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px}
.date-filters input{min-height:38px;border:1px solid var(--line);border-radius:9px;padding:0 8px;background:#10131e;color:var(--text);font-size:11px}
.alert{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin:0 0 16px;border-radius:12px;font-size:12px;overflow-wrap:anywhere}
.alert-error{color:#ffc4d3;border:1px solid #ff8db533;background:#ff4b7a14}
.alert-success{color:#c9ffb4;border:1px solid #a7f77b30;background:#a7f77b12}
.alert button{background:transparent;border:0;color:inherit}
.page-footer{display:flex;justify-content:space-between;gap:12px;padding:23px 2px 0;color:#687187;font-size:10px}
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;overflow-y:auto;padding:22px;background:#020409bf;backdrop-filter:blur(12px)}
.transaction-modal{width:min(100%,490px);max-height:calc(100vh - 44px);overflow-y:auto;padding:26px;border-radius:23px;background:linear-gradient(145deg,#1d2233f7,#0d101bfa)}
.modal-header{display:flex;justify-content:space-between;gap:15px;margin-bottom:23px}
.modal-header h2{margin:9px 0 5px;font:700 23px 'Manrope'}.modal-header p{margin:0;color:var(--muted);font-size:11px}
.type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:5px;border:1px solid var(--line);border-radius:13px;background:#0003;margin-bottom:21px}
.type-toggle button{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border:1px solid transparent;border-radius:9px;color:#9099af;background:transparent;font-size:12px}
.expense-selected{color:#ffc0d3!important;background:#ff8db51a!important}.income-selected{color:#caffb7!important;background:#a7f77b1a!important}
.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:8px}
.inline-form{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:25px 0}
.inline-form .form-field{flex:1;min-width:150px;margin:0}
.budget-line,.goal-line{padding:17px 0;border-bottom:1px solid #ffffff0f}
.budget-line>div:first-child{display:flex;justify-content:space-between;gap:10px}
.budget-line>div:first-child strong,.goal-line strong{font-size:12px}
.budget-line>div:first-child span{font-size:11px;color:var(--muted)}
.budget-line .delete-btn{float:right}
.category-line{margin:18px 0}
.category-line>div:first-child{display:flex;justify-content:space-between;font-size:11px}
.summary-bar{display:grid;grid-template-columns:80px 1fr auto;align-items:center;gap:12px;margin:20px 0;font-size:11px}
.account-summary{display:flex;align-items:center;gap:14px;margin:25px 0;padding:18px;border:1px solid var(--line);border-radius:14px}
.account-summary>div:nth-child(2){flex:1;min-width:0}
.account-summary strong,.account-summary span{display:block;overflow-wrap:anywhere}
.account-summary strong{font-size:12px}.account-summary span{font-size:10px;color:var(--muted);margin-top:5px}
.account-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
.account-stats div{padding:16px;border:1px solid var(--line);border-radius:12px}
.account-stats span,.account-stats strong{display:block}
.account-stats span{font-size:10px;color:var(--muted)}
.account-stats strong{font-size:14px;margin-top:9px;overflow-wrap:anywhere}
.settings-form{max-width:480px;margin-top:25px}.settings-form .form-field{max-width:400px}
hr{border:0;border-top:1px solid var(--line);margin:25px 0}
.security-row{display:flex;align-items:center;justify-content:space-between;gap:15px}
.security-row strong{font-size:12px}.muted{color:var(--muted);font-size:10px;line-height:1.7}
.mobile-menu-btn,.mobile-scrim{display:none}
.calendar-controls{display:flex;gap:8px}
.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin-top:25px}
.calendar-weekday{text-align:center;color:var(--muted);font-size:10px;padding:10px 0}
.calendar-day{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:90px;padding:8px;border:1px solid var(--line);border-radius:10px;background:#ffffff05;color:var(--text);text-align:left;overflow:hidden}
.calendar-day:hover{background:#a7f77b10;border-color:#a7f77b55}
.calendar-day>strong{font-size:12px}.calendar-day small{font-size:9px;overflow-wrap:anywhere}
.calendar-today{border-color:var(--green)}
.calendar-count{font-size:9px;color:var(--muted)}
.signout-btn{margin-left:10px}
@media(max-width:1100px){.sidebar{width:220px;flex-basis:220px}.metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.preview-card{position:relative;top:auto;right:auto;width:min(100%,400px);margin:55px 0 0;transform:none}.landing{margin-top:70px}}
@media(max-width:760px){.auth-shell{padding:20px}.preview-card{display:none}.landing{margin-top:90px}.landing h1{font-size:clamp(49px,12vw,70px);letter-spacing:-3px}.landing-copy{font-size:14px}.landing-points{gap:13px}.sidebar{position:fixed;top:0;bottom:0;left:0;width:265px;min-height:100dvh;transform:translateX(-105%);transition:transform .25s;background:#0d101bf7}.sidebar-open{transform:translateX(0)}.mobile-scrim{display:block;position:fixed;inset:0;z-index:19;border:0;background:#0009}.topbar{height:65px;padding:0 18px}.mobile-menu-btn{display:grid}.content{padding:28px 17px 22px}.welcome-row{align-items:flex-start;flex-direction:column;gap:18px}.welcome-row h1{font-size:29px}.welcome-row>.primary-btn{width:100%}.metrics-grid{gap:10px}.metric-card{padding:15px}.metric-value{margin-top:17px;font-size:clamp(17px,4.4vw,23px)}.insight-grid{grid-template-columns:1fr}.panel{padding:18px}.page-footer{flex-direction:column}.transaction-modal{padding:20px}.inline-form{align-items:stretch;flex-direction:column}.inline-form .form-field{width:100%}.account-stats{grid-template-columns:1fr}.form-two-col{grid-template-columns:1fr;gap:0}.calendar-day{min-height:65px;padding:5px}.calendar-day small{display:none}}
@media(max-width:420px){.secure-pill{font-size:0}.metrics-grid{grid-template-columns:1fr 1fr}.transaction-right{gap:2px}.transaction-amount{font-size:11px}.table-tools{flex-direction:column}.calendar-grid{gap:3px}.calendar-day{min-height:50px}.calendar-count{display:none}.signout-btn{margin:10px 0 0}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;