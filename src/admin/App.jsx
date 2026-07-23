import React, { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Badge, Button, Input } from "../ds/components.jsx";
import { Dashboard, Inventory, Catalogue } from "./pages-ops.jsx";
import { Sales, Notifications, Inquiries, SettingsPage } from "./pages-growth.jsx";

export const CAT_LABELS = {
  extrait: "Extrait Perfumes",
  designer: "Designer Fragrances",
  sensual: "Sensual Fragrances",
  mist: "Body Mists",
  deo: "Deodorants",
  care: "Feminine Care",
  package: "Gift Packages",
};

export const fmtN = (n) => "₦" + Number(n || 0).toLocaleString("en-US");

export const statusBadge = (st) => ({
  good: { bg: "#e4efe4", fg: "#3f6b45" },
  warn: { bg: "var(--mr-gold-200)", fg: "var(--mr-gold-600)" },
  bad: { bg: "#f7e3ea", fg: "#c0587a" },
  mute: { bg: "var(--surface-sunken)", fg: "var(--mr-purple-800)" },
}[st]);

const PAGES = [
  { id: "dash", label: "Dashboard", title: "Dashboard" },
  { id: "inv", label: "Inventory", title: "Inventory" },
  { id: "cat", label: "Products", title: "Product catalogue" },
  { id: "sales", label: "Sales & Promos", title: "Sales & promos" },
  { id: "notif", label: "Notifications", title: "Notifications & pop-ups" },
  { id: "inq", label: "Customer Service", title: "Customer service" },
  { id: "settings", label: "Settings", title: "Store & content settings" },
];

function Login({ onToken }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.post("/api/admin/login", { password: pw });
      onToken(r.token);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ minHeight: "100vh", background: "var(--royal-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--font-sans)" }}>
      <div style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", maxWidth: 400, width: "100%", padding: "40px 36px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--mr-purple-900)" }}>Majestic Roobee</div>
        <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", margin: "6px 0 26px" }}>Operations</div>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Passphrase" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" error={err || undefined} />
          <Button variant="primary" block disabled={busy} onClick={submit}>{busy ? "Opening…" : "Enter the house"}</Button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("mr-admin-token") || "");
  const [page, setPage] = useState("dash");
  const [scope, setScope] = useState("all");
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [promos, setPromos] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [settingsData, setSettingsData] = useState(null);
  const [toast, setToast] = useState("");

  const authFail = useCallback((e) => {
    if (e && e.status === 401) {
      localStorage.removeItem("mr-admin-token");
      setToken("");
    }
  }, []);

  const loadOverview = useCallback((s = scope) => {
    if (!token) return;
    api.get(`/api/admin/overview?scope=${s}`, token).then(setOverview).catch(authFail);
  }, [token, scope, authFail]);
  const loadProducts = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/products", token).then((r) => setProducts(r.products)).catch(authFail);
  }, [token, authFail]);
  const loadPromos = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/promos", token).then((r) => setPromos(r.promos)).catch(authFail);
  }, [token, authFail]);
  const loadCampaigns = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/campaigns", token).then((r) => setCampaigns(r.campaigns)).catch(authFail);
  }, [token, authFail]);
  const loadInquiries = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/inquiries", token).then((r) => setInquiries(r.inquiries)).catch(authFail);
  }, [token, authFail]);
  const loadSettings = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/settings", token).then(setSettingsData).catch(authFail);
  }, [token, authFail]);

  useEffect(() => {
    if (!token) return;
    loadOverview();
    loadProducts();
    loadPromos();
    loadCampaigns();
    loadInquiries();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadOverview(scope); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  if (!token) {
    return <Login onToken={(t) => { localStorage.setItem("mr-admin-token", t); setToken(t); }} />;
  }

  const settings = settingsData ? settingsData.settings : {};
  const TH = settings.lowStockThreshold ?? 5;
  const openInq = inquiries.filter((q) => q.status !== "Resolved").length;
  const scopeLabel = scope === "all" ? "All locations" : { abuja: "Abuja", lagos: "Lagos", ibadan: "Ibadan" }[scope];

  const ctx = {
    token, page, setPage, scope, setScope, scopeLabel, TH,
    overview, products, promos, campaigns, inquiries, settingsData,
    loadOverview, loadProducts, loadPromos, loadCampaigns, loadInquiries, loadSettings,
    setProducts, setInquiries, authFail, flash,
  };

  const title = (PAGES.find((p) => p.id === page) || {}).title || "";

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-body)", background: "var(--mr-cream)", minHeight: "100vh", display: "flex" }}>
      <aside style={{ width: 232, flexShrink: 0, background: "var(--royal-wash)", color: "var(--text-on-dark-muted)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "24px 22px 18px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--mr-cream)" }}>Majestic Roobee</div>
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 10.5, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--mr-gold-400)", marginTop: 4 }}>Operations</div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px" }}>
          {PAGES.map((p) => {
            const on = page === p.id;
            return (
              <button key={p.id} onClick={() => setPage(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, padding: "11px 14px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", background: on ? "rgba(255,255,255,0.1)" : "transparent", color: on ? "var(--mr-cream)" : "var(--text-on-dark-muted)", transition: "background var(--dur-fast) var(--ease-standard)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "var(--accent-gold)" : "transparent" }} />
                {p.label}
                {p.id === "inq" && openInq > 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-pill)" }}>{openInq}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", padding: "18px 22px", borderTop: "1px solid var(--border-inverse)" }}>
          <div style={{ fontSize: 12.5, color: "var(--mr-cream)", fontWeight: 500 }}>Super admin</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>Full access — every store</div>
          <a href="/" style={{ display: "inline-block", fontSize: 11.5, color: "var(--mr-gold-400)", marginTop: 12 }}>View storefront —</a>
          <button onClick={() => { localStorage.removeItem("mr-admin-token"); setToken(""); }} style={{ display: "block", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--text-on-dark-muted)", padding: 0, marginTop: 8 }}>Sign out</button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,246,241,0.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", gap: 16, padding: "0 28px", height: 62 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text-strong)", margin: 0, letterSpacing: "var(--ls-heading)" }}>{title}</h1>
          <div style={{ flex: 1 }} />
          {toast && <Badge tone="success">{toast}</Badge>}
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", outline: "none" }}>
            <option value="all">All locations</option>
            <option value="abuja">Abuja — Life Camp</option>
            <option value="lagos">Lagos — Lekki</option>
            <option value="ibadan">Ibadan — Bodija</option>
          </select>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--mr-lavender-300)", color: "var(--mr-purple-900)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 14 }}>SA</span>
        </header>

        {page === "dash" && <Dashboard ctx={ctx} />}
        {page === "inv" && <Inventory ctx={ctx} />}
        {page === "cat" && <Catalogue ctx={ctx} />}
        {page === "sales" && <Sales ctx={ctx} />}
        {page === "notif" && <Notifications ctx={ctx} />}
        {page === "inq" && <Inquiries ctx={ctx} />}
        {page === "settings" && <SettingsPage ctx={ctx} />}
      </div>
    </div>
  );
}
