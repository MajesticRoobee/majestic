// Admin — Automations (F2) and the integration layer (F3): outbound webhooks,
// API keys, and the connection details for the partner API + MCP endpoint.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch } from "../ds/components.jsx";
import { statusBadge } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const th = { padding: "10px 14px", borderTop: "1px solid var(--border-hairline)", fontWeight: 600, color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.06em" };
const runTone = (s) => ({ sent: "good", queued: "warn", pending: "warn", skipped: "mute", failed: "bad" }[s] || "mute");

function Secret({ label, value, onDone }) {
  return (
    <div style={{ background: "var(--mr-gold-200)", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--mr-gold-600)", fontWeight: 600, marginBottom: 6 }}>{label} — shown once, copy it now</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <code style={{ fontFamily: "monospace", fontSize: 13, background: "var(--surface-card)", padding: "8px 12px", borderRadius: "var(--radius-sm)", color: "var(--mr-purple-900)", wordBreak: "break-all" }}>{value}</code>
        <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(value)} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--mr-purple-800)", fontFamily: "var(--font-sans)" }}>Copy</button>
        <button onClick={onDone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Done</button>
      </div>
    </div>
  );
}

// Payments — is a gateway connected, is it pointed at test or at real money,
// and what has it actually said lately.
//
// The mode line matters more than it looks: from inside the app there is
// otherwise no way to tell a test key from a live one, and the difference is
// whether a checkout takes play money or somebody's salary.
function PaymentsPanel({ pay, origin, ctx, reload }) {
  const [sweeping, setSweeping] = useState(false);
  const sweep = async () => {
    setSweeping(true);
    try {
      const r = await api.post("/api/admin/payments/sweep", {}, ctx.token);
      window.alert(
        r.expired || r.rescued
          ? `${r.expired} order(s) released back to stock, ${r.rescued} found already paid.`
          : "Nothing to release — no unpaid order has run out its hold."
      );
      reload();
    } catch (e) { window.alert(e.message); } finally { setSweeping(false); }
  };
  const modes = {
    off: { label: "Not connected", tone: "bad", note: "Card payment is hidden at checkout until a secret key is set." },
    test: { label: "Test mode", tone: "warn", note: "Using a sk_test_ key — real cards are not charged. Use Paystack's test cards." },
    live: { label: "Live", tone: "good", note: "Using a sk_live_ key — real cards are charged." },
    unknown: { label: "Key not recognised", tone: "warn", note: "The key doesn't start with sk_test_ or sk_live_. Check it was copied whole." },
  };
  const m = modes[pay ? pay.gateway.mode : "off"];
  const b = statusBadge(m.tone);
  const rowTone = (s) => ({ success: "good", initialized: "mute", failed: "bad", mismatch: "bad", expired: "warn" }[s] || "mute");
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Payments — Paystack</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 11px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{m.label}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 16px" }}>{m.note}</div>

      <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 12.5, color: "var(--mr-purple-800)", lineHeight: 1.8, marginBottom: 16 }}>
        <div>Webhook URL — paste this into Paystack → Settings → API Keys &amp; Webhooks:</div>
        <code style={{ fontSize: 12.5, wordBreak: "break-all" }}>{origin}/api/paystack/webhook</code>
        {pay && pay.unpaidOrders > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--mr-gold-600)" }}>{pay.unpaidOrders} order{pay.unpaidOrders === 1 ? "" : "s"} awaiting payment.</span>
            <Button variant="secondary" size="sm" disabled={sweeping} onClick={sweep}>
              {sweeping ? "Checking…" : "Release lapsed holds"}
            </Button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 4 }}>RECENT ATTEMPTS</div>
      {(!pay || !pay.payments.length) && (
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
          Nothing yet — every initialization, confirmation and refusal lands here, including charges rejected for the wrong amount.
        </div>
      )}
      {pay && pay.payments.map((p) => {
        const t = statusBadge(rowTone(p.status));
        return (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border-hairline)", fontSize: 13, alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "var(--text-strong)" }}>{p.order_no} <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{p.customer || ""}</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", wordBreak: "break-all" }}>
                ₦{(p.amount / 100).toLocaleString("en-US")} · {p.source}{p.channel ? ` · ${p.channel}` : ""}{p.detail ? ` · ${p.detail}` : ""}
              </div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: t.bg, color: t.fg }}>{p.status}</span>
          </div>
        );
      })}
    </div>
  );
}

// Product imagery — where the bytes live. Photos used to sit inside the
// database itself, which made every backup and restore carry the whole photo
// library. This panel moves them into the R2 bucket, a batch at a time, and
// says how far it has got.
function MediaPanel({ media, ctx, reload }) {
  const [moving, setMoving] = useState(false);
  const [progress, setProgress] = useState("");
  if (!media) return null;
  const mb = (n) => (n / 1e6).toFixed(1) + "MB";

  const migrate = async () => {
    setMoving(true);
    try {
      // Batched on the server, so keep asking until nothing is left.
      let left = 1, moved = 0;
      while (left > 0) {
        const r = await api.post("/api/admin/media/migrate", { batch: 20 }, ctx.token);
        moved += r.moved;
        left = r.remaining;
        setProgress(`Moved ${moved}${left ? `, ${left} to go…` : ""}`);
        if (!r.moved) break; // nothing moved and some remain: stop rather than spin
      }
      setProgress(moved ? `Moved ${moved} image${moved === 1 ? "" : "s"} to R2.` : "Nothing to move.");
      reload();
    } catch (e) { setProgress(e.message); } finally { setMoving(false); }
  };

  const st = media.bucketBound
    ? (media.inD1 ? { label: "Partly migrated", tone: "warn" } : { label: "On R2", tone: "good" })
    : { label: "In the database", tone: "warn" };
  const b = statusBadge(st.tone);

  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Product imagery</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {media.total} image{media.total === 1 ? "" : "s"} · {media.derivatives} phone-sized cop{media.derivatives === 1 ? "y" : "ies"}
            {media.inD1 ? ` · ${media.inD1} still in the database (${mb(media.d1Bytes)})` : ""}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{st.label}</span>
      </div>
      {media.bucketBound && media.inD1 > 0 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" disabled={moving} onClick={migrate}>{moving ? "Moving…" : "Move them to R2"}</Button>
          {progress && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{progress}</span>}
        </div>
      )}
      {!media.bucketBound && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
          No R2 bucket is bound to the Worker, so uploads are stored in the database. Bind one in <code>wrangler.jsonc</code> and this panel will offer to move them.
        </div>
      )}
    </div>
  );
}

// ERPNext — the catalogue link.
//
// The connector is worker/erp.js; this is the six things a person has to do to
// turn it on, in the order they have to do them. Deliberately a checklist
// rather than a form: the order matters, and the failure that follows getting
// it wrong (stock from one city on another city's shelf, or a shop emptied by
// an expired key) is silent.
function ErpPanel({ erp, ctx, reload }) {
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(null);
  useEffect(() => { if (erp && !form) setForm({ ...erp.config }); }, [erp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!erp || !form) return null;

  const cfg = erp.config;
  const mapped = erp.warehouses.filter((w) => w.locationId).length;
  const step = (n, label, done, children) => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, background: done ? "#e4efe4" : "var(--surface-sunken)", color: done ? "#3f6b45" : "var(--text-muted)" }}>{done ? "\u2713" : n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>{label}</div>
        {children}
      </div>
    </div>
  );
  const run = async (id, path, body) => {
    setBusy(id); setResult(null);
    try { setResult({ id, data: await api.post(path, body, ctx.token) }); reload(); }
    catch (e) { ctx.authFail(e); setResult({ id, data: { error: e.message } }); }
    finally { setBusy(""); }
  };
  const saveConfig = async () => {
    setBusy("config");
    try {
      const keys = ["erpOn", "erpBaseUrl", "erpPriceList", "erpPublish", "erpDefaultCat", "erpEmptyGuardPct", "erpSyncEveryMins"];
      const patch = {
        erpOn: form.on ? "1" : "0", erpBaseUrl: form.baseUrl, erpPriceList: form.priceList,
        erpPublish: form.publish ? "1" : "0", erpDefaultCat: form.defaultCat,
        erpEmptyGuardPct: form.emptyGuardPct, erpSyncEveryMins: form.syncEveryMins,
      };
      await api.put("/api/admin/settings", { settings: Object.fromEntries(keys.map((k) => [k, patch[k]])) }, ctx.token);
      ctx.flash("ERPNext settings saved");
      reload();
    } catch (e) { ctx.authFail(e); window.alert(e.message); } finally { setBusy(""); }
  };
  const setMap = async (w, locationId) => {
    try { await api.patch(`/api/admin/erp/warehouses/${encodeURIComponent(w.warehouse)}`, { locationId }, ctx.token); reload(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };
  const setCat = async (g, cat) => {
    try { await api.patch(`/api/admin/erp/item-groups/${encodeURIComponent(g.itemGroup)}`, { cat }, ctx.token); reload(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };
  const out = (id) => (result && result.id === id ? result.data : null);
  const note = (d) => d && (
    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, borderRadius: "var(--radius-md)", padding: "10px 12px", background: d.error || d.ok === false ? "#f7e3ea" : "#e4efe4", color: d.error || d.ok === false ? "#c0587a" : "#3f6b45", whiteSpace: "pre-wrap" }}>
      {d.error || d.note || (d.user
        ? `Reached it as ${d.user} in ${d.ms}ms. ${Object.entries(d.doctypes || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}`
        : d.warehouses !== undefined && d.rows === undefined
          ? `Found ${d.warehouses} warehouse(s) and ${d.itemGroups} item group(s).`
          : `${d.dryRun ? "Dry run — nothing was written. " : ""}${d.rows} SKU(s) read · ${d.variantsCreated || 0} created · ${d.variantsUpdated || 0} updated · ${d.productsCreated || 0} new product(s), ${d.productsAdopted || 0} adopted${d.readErrors && d.readErrors.length ? `\n\nSkipped:\n${d.readErrors.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : ""}${d.warnings && d.warnings.length ? `\n\nWorth a look:\n${d.warnings.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : ""}`)}
    </div>
  );
  const b = statusBadge(cfg.on && cfg.configured ? "good" : cfg.configured ? "warn" : "mute");
  const label = cfg.on && cfg.configured ? "Syncing" : cfg.configured ? "Configured, not running" : "Not connected";
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 12.5, padding: "6px 10px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-strong)", cursor: "pointer" };

  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>ERPNext — catalogue &amp; stock</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 11px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 6px", lineHeight: 1.6 }}>
        ERPNext owns price and stock; the shop owns names, descriptions, photographs, categories and shelf order. A pull never
        overwrites the second set — it only fills them in for an item the shop has never seen.
        {cfg.lastSync ? ` Last pull: ${cfg.lastSync} UTC.` : " Never pulled."}
        {erp.linkedVariants ? ` ${erp.linkedVariants} SKU(s) are linked to ERPNext.` : ""}
      </div>

      {step(1, "The credentials", cfg.hasKey, (
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {cfg.hasKey
            ? "Set. They are Worker secrets, so nothing here can read them back."
            : <>Not set. In ERPNext: <strong>User → the integration user → API Access → Generate Keys</strong>. Then, from the project:
              <br /><code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_KEY</code>
              {" · "}<code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_SECRET</code>
              <br />They never go in the database and never reach a browser — the same rule as the Paystack key.</>}
        </div>
      ))}

      {step(2, "Where it lives, and which price is the web price", !!cfg.baseUrl, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input label="Base URL" value={form.baseUrl || ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://yourcompany.erpnext.com" hint="The site root — not a page inside it, no trailing slash." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Price list" value={form.priceList || ""} onChange={(e) => setForm({ ...form, priceList: e.target.value })}
              placeholder="Standard Selling" hint="Exactly as ERPNext names it. Quoting the cost list on a storefront is how money is lost." />
            <Input label="Category for unmapped items" value={form.defaultCat || ""} onChange={(e) => setForm({ ...form, defaultCat: e.target.value })}
              placeholder="perfumes" hint="Where a new product lands when its item group isn't mapped below." />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "test"} onClick={() => run("test", "/api/admin/erp/test", {})}>{busy === "test" ? "Calling…" : "Test the connection"}</Button>
          </div>
          {note(out("test"))}
        </div>
      ))}

      {step(3, "Which warehouse is which shop", mapped > 0, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            This is the mapping that matters most, and it cannot be guessed. A warehouse with no shop against it is
            <strong> ignored</strong>, not defaulted — counting unmapped stock into the nearest shop is exactly the mistake
            that puts Lagos&rsquo;s bottles on Abuja&rsquo;s shelf.
          </div>
          <Button variant="secondary" size="sm" disabled={busy === "discover"} onClick={() => run("discover", "/api/admin/erp/discover", {})}>
            {busy === "discover" ? "Reading…" : erp.warehouses.length ? "Refresh the lists from ERPNext" : "Fetch warehouses & item groups"}
          </Button>
          {note(out("discover"))}
          {erp.warehouses.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {erp.warehouses.map((w) => (
                <div key={w.warehouse} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: w.disabled ? "var(--text-muted)" : "var(--text-body)", textDecoration: w.disabled ? "line-through" : "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {w.warehouse}{w.isGroup ? " (group)" : ""}
                  </span>
                  <select value={w.locationId || ""} onChange={(e) => setMap(w, e.target.value)} style={selStyle}>
                    <option value="">Not counted</option>
                    {erp.stores.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {erp.itemGroups.length > 0 && step(4, "Which item group is which category (optional)", erp.itemGroups.some((g) => g.cat), (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {erp.itemGroups.map((g) => (
            <div key={g.itemGroup} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "var(--text-body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{g.itemGroup}</span>
              <select value={g.cat || ""} onChange={(e) => setCat(g, e.target.value)} style={selStyle}>
                <option value="">Use the default</option>
                {ctx.catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}

      {step(5, "See what a pull would do", false, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            A dry run does every read and every check and writes nothing. Run it before the real one, every time the mapping
            changes.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "dry"} onClick={() => run("dry", "/api/admin/erp/pull", { dryRun: true, full: true })}>
              {busy === "dry" ? "Reading…" : "Dry run — read everything"}
            </Button>
            <Button variant="primary" size="sm" disabled={busy === "live"}
              onClick={() => window.confirm("Pull from ERPNext for real? Prices and stock on linked SKUs are overwritten with ERPNext's.") && run("live", "/api/admin/erp/pull", { dryRun: false, full: true })}>
              {busy === "live" ? "Syncing…" : "Pull for real"}
            </Button>
          </div>
          {note(out("dry"))}
          {note(out("live"))}
        </div>
      ))}

      {step(6, "Let it run on its own", cfg.on, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Switch label="Pull from ERPNext on a schedule" checked={!!form.on} onChange={(e) => setForm({ ...form, on: e.target.checked })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Every (minutes)" value={form.syncEveryMins ?? ""} onChange={(e) => setForm({ ...form, syncEveryMins: e.target.value.replace(/\D/g, "") })}
              placeholder="60" hint="15 at the fastest — that is how often the cron runs." />
            <Input label="Empty-feed guard (%)" value={form.emptyGuardPct ?? ""} onChange={(e) => setForm({ ...form, emptyGuardPct: e.target.value.replace(/\D/g, "") })}
              placeholder="25" hint="Refuse a pull that would cut catalogue stock by more than this. An expired key returns nothing, and nothing must not empty the shop." />
          </div>
          <Switch label="Items new to the shop go live immediately" checked={!!form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4 }}>
            Off (recommended): they arrive as drafts with ERPNext&rsquo;s own description, and somebody writes the shop copy and adds
            the photography before a shopper sees them.
          </div>
          <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>
        </div>
      ))}

      {erp.syncs.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 8 }}>Recent pulls</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {erp.syncs.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", fontSize: 11.5, color: r.ok ? "var(--text-muted)" : "#c0587a" }}>
                <span style={{ minWidth: 0 }}>{r.note || r.direction}</span>
                <span style={{ flexShrink: 0 }}>{String(r.at).slice(0, 16)}{r.ms ? ` · ${r.ms}ms` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsPage({ ctx }) {
  const [autos, setAutos] = useState([]);
  const [runStats, setRunStats] = useState([]);
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [keys, setKeys] = useState([]);
  const [wh, setWh] = useState({ url: "", events: "*" });
  const [keyForm, setKeyForm] = useState({ name: "", scopes: "read" });
  const [secret, setSecret] = useState(null);
  const [pay, setPay] = useState(null);
  const [media, setMedia] = useState(null);
  const [erp, setErp] = useState(null);
  const origin = window.location.origin;

  const load = () => {
    api.get("/api/admin/payments", ctx.token).then(setPay).catch(() => {});
    api.get("/api/admin/media/status", ctx.token).then(setMedia).catch(() => {});
    // Super-only, so a manager's admin simply doesn't draw the panel.
    api.get("/api/admin/erp", ctx.token).then(setErp).catch(() => {});
    api.get("/api/admin/automations", ctx.token).then((r) => { setAutos(r.automations); setRunStats(r.runStats); }).catch(ctx.authFail);
    api.get("/api/admin/automation-runs", ctx.token).then((r) => setRuns(r.runs)).catch(ctx.authFail);
    api.get("/api/admin/events", ctx.token).then((r) => setEvents(r.events)).catch(() => {});
    api.get("/api/admin/webhooks", ctx.token).then((r) => setWebhooks(r.webhooks)).catch(() => {});
    api.get("/api/admin/api-keys", ctx.token).then((r) => setKeys(r.keys)).catch(() => {});
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAuto = async (a) => {
    setAutos((cur) => cur.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)));
    try { await api.patch(`/api/admin/automations/${a.id}`, { enabled: !a.enabled }, ctx.token); } catch (e) { ctx.authFail(e); load(); }
  };
  const runCount = (id) => runStats.filter((r) => r.automation_id === id).reduce((n, r) => n + r.n, 0);
  const addWebhook = async () => {
    try { const r = await api.post("/api/admin/webhooks", wh, ctx.token); setSecret({ label: "Webhook signing secret", value: r.secret }); setWh({ url: "", events: "*" }); load(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };
  const createKey = async () => {
    try { const r = await api.post("/api/admin/api-keys", keyForm, ctx.token); setSecret({ label: `API key "${keyForm.name}"`, value: r.key }); setKeyForm({ name: "", scopes: "read" }); load(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };

  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
      <PaymentsPanel pay={pay} origin={origin} ctx={ctx} reload={load} />
      <MediaPanel media={media} ctx={ctx} reload={load} />
      <ErpPanel erp={erp} ctx={ctx} reload={load} />

      {/* Automations */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Automations</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Lifecycle messages fire from store events. Emails send once Resend is connected — until then they queue safely.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 90px 90px", fontSize: 12.5 }}>
          <div style={{ ...th, paddingLeft: 22 }}>AUTOMATION</div>
          <div style={th}>TRIGGER</div>
          <div style={th}>RUNS</div>
          <div style={{ ...th, paddingRight: 22 }}>ON</div>
          {autos.map((a) => (
            <React.Fragment key={a.id}>
              <div style={{ padding: "13px 14px 13px 22px", borderTop: "1px solid var(--border-hairline)" }}>
                <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.action}{a.delay_minutes ? ` · +${a.delay_minutes}m` : ""}</div>
              </div>
              <div style={{ padding: "13px 14px", borderTop: "1px solid var(--border-hairline)", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{a.trigger}</div>
              <div style={{ padding: "13px 14px", borderTop: "1px solid var(--border-hairline)", color: "var(--text-body)", display: "flex", alignItems: "center" }}>{runCount(a.id)}</div>
              <div style={{ padding: "11px 22px 11px 14px", borderTop: "1px solid var(--border-hairline)", display: "flex", alignItems: "center" }}><Switch checked={a.enabled} onChange={() => toggleAuto(a)} /></div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 20 }}>
        {/* Recent outbox */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Recent automation runs</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {runs.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 13, color: "var(--text-muted)" }}>Nothing yet — runs appear as events fire.</div>}
            {runs.map((r) => {
              const b = statusBadge(runTone(r.status));
              return (
                <div key={r.id} style={{ padding: "12px 22px", borderTop: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div><div style={{ fontSize: 13, color: "var(--text-strong)" }}>{r.automation}</div><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.recipient || "—"}{r.detail ? ` · ${r.detail}` : ""}</div></div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Activity feed */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Activity — recent events</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {events.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 13, color: "var(--text-muted)" }}>Nothing yet — events log here as shoppers browse, order and check out.</div>}
            {events.map((e) => (
              <div key={e.id} style={{ padding: "10px 22px", borderTop: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                <span style={{ color: "var(--mr-purple-800)", fontFamily: "var(--font-condensed)", letterSpacing: "0.04em" }}>{e.type}</span>
                <span style={{ color: "var(--text-muted)" }}>{e.entity || ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {secret && <Secret {...secret} onDone={() => setSecret(null)} />}

      {/* Webhooks */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Outbound webhooks</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 16px" }}>POST every event (or a chosen subset) to an external URL — connect Zapier, Make, n8n, GIG, your CRM or email tool. Each delivery is HMAC-signed (<code>x-mr-signature</code>).</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <Input label="Endpoint URL" value={wh.url} onChange={(e) => setWh({ ...wh, url: e.target.value })} placeholder="https://hooks.example.com/mr" style={{ flex: 2, minWidth: 240 }} />
          <Input label="Events (csv or *)" value={wh.events} onChange={(e) => setWh({ ...wh, events: e.target.value })} placeholder="order_paid,order_placed" style={{ flex: 1, minWidth: 160 }} />
          <Button variant="secondary" onClick={addWebhook}>Add webhook</Button>
        </div>
        {webhooks.length === 0 && <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No webhooks yet.</div>}
        {webhooks.map((w) => (
          <div key={w.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border-hairline)", fontSize: 13, alignItems: "center" }}>
            <div><div style={{ color: "var(--text-strong)" }}>{w.url}</div><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{w.events} · {w.last_status || "no deliveries yet"}</div></div>
            <button onClick={async () => { await api.del(`/api/admin/webhooks/${w.id}`, ctx.token); load(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)" }}>Remove</button>
          </div>
        ))}
      </div>

      {/* API keys + connection info */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>API keys &amp; connections</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 16px" }}>Keys authenticate the partner API and the MCP endpoint — for POS, accounting, warehouse, mobile apps and AI agents.</div>
        <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 12.5, color: "var(--mr-purple-800)", marginBottom: 16, lineHeight: 1.7 }}>
          <div>REST API base: <code>{origin}/api/v1</code> — e.g. <code>GET /api/v1/products</code> with header <code>authorization: Bearer &lt;key&gt;</code></div>
          <div>MCP endpoint: <code>{origin}/api/mcp</code> — JSON-RPC (initialize / tools/list / tools/call), same Bearer key</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <Input label="Key name" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} placeholder="Zoho Books" style={{ flex: 2, minWidth: 200 }} />
          <Select label="Scope" value={keyForm.scopes} onChange={(e) => setKeyForm({ ...keyForm, scopes: e.target.value })} style={{ width: 140 }}>
            <option value="read">Read only</option>
            <option value="write">Read &amp; write</option>
          </Select>
          <Button variant="primary" onClick={createKey}>Create key</Button>
        </div>
        {keys.length === 0 && <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No API keys yet — create one when you connect a POS, accounting tool or AI agent.</div>}
        {keys.map((k) => (
          <div key={k.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border-hairline)", fontSize: 13, alignItems: "center" }}>
            <div><div style={{ color: "var(--text-strong)" }}>{k.name} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {k.scopes}</span></div><div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{k.prefix}… · {k.last_used ? "used " + k.last_used : "unused"}</div></div>
            <button onClick={async () => { await api.del(`/api/admin/api-keys/${k.id}`, ctx.token); load(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)" }}>Revoke</button>
          </div>
        ))}
      </div>
    </main>
  );
}
