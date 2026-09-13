import React, { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Badge, Button, Input } from "../ds/components.jsx";
import { Dashboard, Inventory, Catalogue, CollectionsPage } from "./pages-ops.jsx";
import { CategoriesPage, DealsPage, BlogPage, TestimonialsPage, PagesPage } from "./pages-content.jsx";
import { DailyDealsPage } from "./daily-deals.jsx";
import { Sales, Rewards, Notifications, Inquiries, SettingsPage } from "./pages-growth.jsx";
import { TeamPage, AccountPage } from "./team.jsx";
import { IntegrationsPage } from "./integrations.jsx";
import { GoLivePage } from "./golive.jsx";
import { catTree, catPath } from "../lib/categories.js";

// The categories the shop was seeded with, kept only as a label of last resort:
// categories are editable content now (Admin → Categories), so every screen
// reads the live list and falls back to this when it hasn't loaded yet.
export const CAT_LABELS = {
  perfumes: "Perfumes",
  "perfume-oils": "Perfume Oils",
  designer: "Designer Oils",
  "custom-oil": "Custom Oils",
  mist: "Body Mists",
  home: "Home Fragrance",
  deo: "Deodorants",
  care: "Feminine Care",
  wellness: "Wellness Products",
  massage: "Massage Oils",
  health: "Health Drinks",
  "fragrance-set": "Fragrance Sets",
  "mist-set": "Body Mist Sets",
  "custom-oil-set": "Custom Oil Sets",
  "gift-set": "Gift Sets",
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
  { id: "collections", label: "Collections", title: "Collections & sets" },
  { id: "categories", label: "Categories", title: "Categories" },
  { id: "deals", label: "Deals", title: "Deals & hot offers" },
  { id: "daily-deals", label: "Daily Deals", title: "Daily deals & countdown" },
  { id: "blog", label: "Blog", title: "The blog" },
  { id: "pages", label: "Pages", title: "Information & legal pages" },
  { id: "reviews", label: "Reviews", title: "Reviews & testimonials" },
  { id: "sales", label: "Sales & Promos", title: "Sales & promos" },
  { id: "rewards", label: "Rewards", title: "Reward codes" },
  { id: "notif", label: "Notifications", title: "Notifications & pop-ups" },
  { id: "inq", label: "Customer Service", title: "Customer service" },
  { id: "integrations", label: "Integrations", title: "Integrations & automations", super: true },
  { id: "team", label: "Team", title: "Team & access", super: true },
  { id: "golive", label: "Go live", title: "Go live & data", super: true },
  { id: "settings", label: "Settings", title: "Store & content settings" },
  { id: "account", label: "My account", title: "My account" },
];

const shell = { minHeight: "100vh", background: "var(--royal-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--font-sans)" };
const panel = { background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", maxWidth: 400, width: "100%", padding: "40px 36px", textAlign: "center" };
const brand = (
  <>
    <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--mr-purple-900)" }}>Majestic Roobee</div>
    <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)", margin: "6px 0 26px" }}>Operations</div>
  </>
);

function Login({ onAuth }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const body = { password: pw };
      if (username.trim()) body.username = username.trim();
      if (needTotp) body.totp = totp;
      const r = await api.post("/api/admin/login", body);
      onAuth(r.token);
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("2fa")) setNeedTotp(true);
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={shell}>
      <div style={panel}>
        {brand}
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="your handle" hint="Leave blank to use the master passphrase." />
          <Input label="Passphrase" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
          {needTotp && (
            <Input label="2FA code" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="123456" />
          )}
          {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
          <Button variant="primary" block disabled={busy} onClick={submit}>{busy ? "Opening…" : "Enter the house"}</Button>
        </div>
      </div>
    </div>
  );
}

function ForceChange({ ctx }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr("");
    if (f.next !== f.confirm) return setErr("The two new passphrases don't match.");
    try {
      await api.post("/api/admin/account/password", { current: f.current, next: f.next }, ctx.token);
      ctx.loadMe();
    } catch (e) { ctx.authFail(e); setErr(e.message); }
  };
  return (
    <div style={shell}>
      <div style={panel}>
        {brand}
        <div style={{ fontSize: 13.5, color: "var(--text-body)", marginBottom: 16 }}>Welcome, {ctx.me.name}. Set your own passphrase to continue.</div>
        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Passphrase you were given" type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          <Input label="New passphrase" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} hint="At least 8 characters." />
          <Input label="Confirm new passphrase" type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
          <Button variant="primary" block onClick={submit}>Set passphrase &amp; continue</Button>
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
  const [inqCounts, setInqCounts] = useState({ live: 0, archived: 0 });
  const [showArchived, setShowArchived] = useState(false);
  const [locations, setLocations] = useState([]);
  const [collections, setCollections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [posts, setPosts] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pages, setPages] = useState([]);
  const [settingsData, setSettingsData] = useState(null);
  // Where the low-stock line sits for every shelf, as the server draws it — an
  // override on a variation, and in days-of-cover mode a line that differs per
  // store. The inventory screen must colour a cell by the same rule the alert
  // fires on, so it reads this rather than re-deriving it from one number.
  const [stockHealth, setStockHealth] = useState(null);
  const [toast, setToast] = useState("");
  const [me, setMe] = useState(null);

  const authFail = useCallback((e) => {
    if (e && e.status === 401) {
      localStorage.removeItem("mr-admin-token");
      setToken("");
      setMe(null);
    }
  }, []);

  const loadMe = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/me", token).then(setMe).catch(authFail);
  }, [token, authFail]);
  useEffect(() => { loadMe(); }, [loadMe]);
  // Managers are pinned to their own store.
  useEffect(() => { if (me && me.role !== "super" && me.scope) setScope(me.scope); }, [me]);

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
  // The inbox is either the live list or the archive; both counts come back
  // each time so the toggle can be labelled.
  const loadInquiries = useCallback((archived = showArchived) => {
    if (!token) return;
    api.get(`/api/admin/inquiries?archived=${archived ? 1 : 0}`, token)
      .then((r) => { setInquiries(r.inquiries); setInqCounts(r.counts); })
      .catch(authFail);
  }, [token, authFail, showArchived]);
  const loadLocations = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/locations", token).then((r) => setLocations(r.locations)).catch(authFail);
  }, [token, authFail]);
  const loadCollections = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/collections", token).then((r) => setCollections(r.collections)).catch(authFail);
  }, [token, authFail]);
  const loadCategories = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/categories", token).then((r) => setCategories(r.categories)).catch(authFail);
  }, [token, authFail]);
  const loadDeals = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/deals", token).then((r) => setDeals(r.deals)).catch(authFail);
  }, [token, authFail]);
  const loadPosts = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/blog", token).then((r) => setPosts(r.posts)).catch(authFail);
  }, [token, authFail]);
  const loadTestimonials = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/testimonials", token).then((r) => setTestimonials(r.testimonials)).catch(authFail);
  }, [token, authFail]);
  const loadSettings = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/settings", token).then(setSettingsData).catch(authFail);
  }, [token, authFail]);
  const loadPages = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/pages", token).then((r) => setPages(r.pages)).catch(authFail);
  }, [token, authFail]);
  const loadStockHealth = useCallback(() => {
    if (!token) return;
    api.get("/api/admin/stock/health", token).then(setStockHealth).catch(authFail);
  }, [token, authFail]);

  useEffect(() => {
    if (!token) return;
    loadOverview();
    loadProducts();
    loadPromos();
    loadCampaigns();
    loadInquiries();
    loadSettings();
    loadLocations();
    loadCollections();
    loadCategories();
    loadDeals();
    loadPosts();
    loadTestimonials();
    loadStockHealth();
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadOverview(scope); }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  if (!token) {
    return <Login onAuth={(t) => { localStorage.setItem("mr-admin-token", t); setToken(t); }} />;
  }

  const settings = settingsData ? settingsData.settings : {};
  // The line for one variation at one store. Falls back to the house's flat
  // number for the moment before the health call lands, and for a shelf the
  // server has not seen (a size added a second ago).
  const flatTH = parseInt(settings.lowStockThreshold, 10);
  const TH = Number.isFinite(flatTH) ? flatTH : 5;
  const lowLine = (variantId, locationId) => {
    const t = stockHealth && stockHealth.thresholds[`${variantId}:${locationId}`];
    return t === undefined || t === null ? TH : t;
  };
  const openInq = showArchived ? 0 : inquiries.filter((q) => q.status !== "Resolved").length;
  const isSuper = !me || me.role === "super";
  const openStores = locations.filter((l) => l.active);
  const scopeStore = locations.find((l) => l.id === scope);
  const scopeLabel = scope === "all" ? "All locations" : scopeStore ? scopeStore.city : scope;

  // Opening a page puts the reader at the top of it — otherwise a click from
  // the bottom of a long screen lands halfway down a short one.
  const goPage = (id) => { setPage(id); window.scrollTo({ top: 0 }); };

  const ctx = {
    token, page, setPage: goPage, scope, setScope, scopeLabel, TH, lowLine, stockHealth, loadStockHealth, me, loadMe, isSuper,
    overview, products, promos, campaigns, inquiries, settingsData,
    locations, openStores, collections, inqCounts, showArchived, setShowArchived, pages, loadPages,
    categories, deals, posts, testimonials,
    // Category labels come from the live table; CAT_LABELS is only the fallback
    // for the moment before it has loaded.
    catLabel: (id) => (categories.find((c) => c.id === id) || {}).label || CAT_LABELS[id] || id,
    // "Perfumes › Extrait Perfumes" wherever a category is named on its own, so
    // two sub-categories with similar names can be told apart.
    catPathLabel: (id) => {
      const trail = catPath(categories, id);
      return trail.length ? trail.map((c) => c.label).join(" › ") : CAT_LABELS[id] || id;
    },
    // The picker on the product form, in tree order and indented, so filing a
    // product reads the same way the storefront's menu does.
    catOptions: categories.length
      ? catTree(categories).flatMap((c) => [{ id: c.id, label: c.label }].concat(
        c.children.map((sc) => ({ id: sc.id, label: `\u00a0\u00a0\u00a0\u2014 ${sc.label}` }))))
      : Object.entries(CAT_LABELS).map(([id, label]) => ({ id, label })),
    loadOverview, loadProducts, loadPromos, loadCampaigns, loadInquiries, loadSettings, loadLocations, loadCollections,
    loadCategories, loadDeals, loadPosts, loadTestimonials,
    setProducts, setInquiries, authFail, flash,
  };

  // First-login: force the employee to set their own passphrase.
  if (me && me.mustChange) return <ForceChange ctx={ctx} />;

  const visiblePages = PAGES.filter((p) => !p.super || isSuper);
  const activePage = (visiblePages.find((p) => p.id === page) ? page : "dash");
  const title = (PAGES.find((p) => p.id === activePage) || {}).title || "";
  const initials = (me && me.name ? me.name : "MR").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-body)", background: "var(--mr-cream)", minHeight: "100vh", display: "flex" }}>
      {/* The rail is exactly one viewport tall and keeps its own overflow: with
          sixteen pages on it, the list is taller than a laptop screen, and
          anything spilling out of this box would both paint over the page and
          stretch the document — which is what used to push the whole sticky
          rail off the top of the screen. */}
      <aside style={{ width: 232, flexShrink: 0, background: "var(--royal-wash)", color: "var(--text-on-dark-muted)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <div style={{ padding: "24px 22px 18px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--mr-cream)" }}>Majestic Roobee</div>
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 10.5, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--mr-gold-400)", marginTop: 4 }}>Operations</div>
        </div>
        {/* minHeight 0 is what lets a flex child actually shrink and scroll. */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, padding: "6px 12px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.28) transparent" }}>
          {visiblePages.map((p) => {
            const on = activePage === p.id;
            return (
              <button key={p.id} onClick={() => goPage(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, padding: "11px 14px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", background: on ? "rgba(255,255,255,0.1)" : "transparent", color: on ? "var(--mr-cream)" : "var(--text-on-dark-muted)", transition: "background var(--dur-fast) var(--ease-standard)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "var(--accent-gold)" : "transparent" }} />
                {p.label}
                {p.id === "inq" && openInq > 0 && (
                  <span style={{ marginLeft: "auto", background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--radius-pill)" }}>{openInq}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div style={{ flexShrink: 0, padding: "18px 22px", borderTop: "1px solid var(--border-inverse)" }}>
          <div style={{ fontSize: 12.5, color: "var(--mr-cream)", fontWeight: 500 }}>{me ? (me.master ? "Master (super admin)" : me.name) : "…"}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{isSuper ? "Full access — every store" : `Scoped to ${scopeLabel} store`}</div>
          <a href="/" style={{ display: "inline-block", fontSize: 11.5, color: "var(--mr-gold-400)", marginTop: 12 }}>View storefront —</a>
          <button onClick={() => { localStorage.removeItem("mr-admin-token"); setToken(""); setMe(null); }} style={{ display: "block", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--text-on-dark-muted)", padding: 0, marginTop: 8 }}>Sign out</button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,246,241,0.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", gap: 16, padding: "0 28px", height: 62 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text-strong)", margin: 0, letterSpacing: "var(--ls-heading)" }}>{title}</h1>
          <div style={{ flex: 1 }} />
          {toast && <Badge tone="success">{toast}</Badge>}
          {isSuper ? (
            <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "8px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--mr-purple-800)", cursor: "pointer", outline: "none" }}>
              <option value="all">All locations</option>
              {openStores.map((l) => <option key={l.id} value={l.id}>{l.city} — {l.store}</option>)}
            </select>
          ) : (
            <Badge tone="neutral">{scopeLabel} only</Badge>
          )}
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--mr-lavender-300)", color: "var(--mr-purple-900)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 14 }}>{initials}</span>
        </header>

        {activePage === "dash" && <Dashboard ctx={ctx} />}
        {activePage === "inv" && <Inventory ctx={ctx} />}
        {activePage === "cat" && <Catalogue ctx={ctx} />}
        {activePage === "collections" && <CollectionsPage ctx={ctx} />}
        {activePage === "categories" && <CategoriesPage ctx={ctx} />}
        {activePage === "deals" && <DealsPage ctx={ctx} />}
        {activePage === "daily-deals" && <DailyDealsPage ctx={ctx} />}
        {activePage === "blog" && <BlogPage ctx={ctx} />}
        {activePage === "pages" && <PagesPage ctx={ctx} />}
        {activePage === "reviews" && <TestimonialsPage ctx={ctx} />}
        {activePage === "sales" && <Sales ctx={ctx} />}
        {activePage === "rewards" && <Rewards ctx={ctx} />}
        {activePage === "notif" && <Notifications ctx={ctx} />}
        {activePage === "inq" && <Inquiries ctx={ctx} />}
        {activePage === "integrations" && <IntegrationsPage ctx={ctx} />}
        {activePage === "team" && <TeamPage ctx={ctx} />}
        {activePage === "golive" && <GoLivePage ctx={ctx} />}
        {activePage === "settings" && <SettingsPage ctx={ctx} />}
        {activePage === "account" && <AccountPage ctx={ctx} />}
      </div>
    </div>
  );
}
