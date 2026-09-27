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

// Email, through Resend: is it connected, what does it send as, and does a
// real email actually arrive.
function EmailPanel({ mail, ctx, reload }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  if (!mail) return null;
  const b = statusBadge(mail.connected ? "good" : "mute");
  const code = { fontFamily: "monospace", fontSize: 11.5, background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 4 };
  const test = async () => {
    setBusy(true); setRes(null);
    try { setRes(await api.post("/api/admin/email/test", { to }, ctx.token)); }
    catch (e) { ctx.authFail(e); setRes({ sent: false, detail: e.message }); }
    finally { setBusy(false); reload(); }
  };
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Email (Resend)</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 11px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{mail.connected ? "Connected" : "Not connected"}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 12px", lineHeight: 1.7 }}>
        {mail.connected
          ? <>Sending as <strong>{mail.from}</strong>{mail.replyTo ? <> · replies go to <strong>{mail.replyTo}</strong></> : null}. Order updates, back-in-stock alerts, abandoned-cart reminders, password resets and the low-stock digest all go out through it, in the shop&rsquo;s letterhead.</>
          : <>Add these as GitHub repository secrets (Settings → Secrets and variables → Actions) and redeploy:
            <br />· <code style={code}>RESEND_API_KEY</code> — resend.com → API Keys → create one with <em>Sending access</em>
            <br />· <code style={code}>RESEND_FROM</code> — e.g. <code style={code}>Majestic Roobee &lt;hello@majesticroobee.shop&gt;</code>, on a domain verified in Resend → Domains
            <br />· <code style={code}>RESEND_REPLY_TO</code> — optional, where customers&rsquo; replies should land
            {mail.keyLooksWrong && <><br /><span style={{ color: "#c0587a" }}>A key is set but it doesn&rsquo;t start with re_ — check it was pasted without &ldquo;Bearer&rdquo; or quotes.</span></>}
            {mail.queued > 0 && <><br />{mail.queued} message{mail.queued === 1 ? " is" : "s are"} waiting in the log below from before email was connected.</>}</>}
        {mail.connected && mail.fromIsDefault && (
          <><br /><span style={{ color: "var(--mr-gold-600)" }}>RESEND_FROM isn&rsquo;t set, so it sends as {mail.from}. That only works if {mail.domain} is verified in Resend.</span></>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <Input label="Send a test email to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@majesticroobee.shop" />
        </div>
        <Button variant="secondary" size="sm" disabled={busy || !mail.connected || !to.includes("@")} onClick={test}>{busy ? "Sending…" : "Send test"}</Button>
      </div>
      {res && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, borderRadius: "var(--radius-md)", padding: "10px 12px", background: res.sent ? "#e4efe4" : "#f7e3ea", color: res.sent ? "#3f6b45" : "#c0587a" }}>
          {res.sent ? `Sent — check ${to}. (Resend id ${res.id || "—"})` : res.detail || res.error}
        </div>
      )}
      {mail.recent.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
          {mail.recent.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: r.status === "sent" ? "var(--text-muted)" : "#c0587a" }}>
              <span style={{ minWidth: 0 }}>{r.subject} → {r.recipient || "—"}{r.status !== "sent" ? ` · ${r.detail}` : ""}</span>
              <span style={{ flexShrink: 0 }}>{String(r.processed_at || "").slice(5, 16)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ERPRev → the shop, pushed. The quickest way to connect: it needs no request
// signing, only the webhook secret ERPRev shows when the webhook is created.
function ErpWebhookBox({ erp, ctx }) {
  const w = erp.webhook;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(w.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy this address", w.url); }
  };
  const last = w.recent[0];
  const code = { fontFamily: "monospace", fontSize: 11.5, background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 4 };
  return (
    <div style={{ margin: "12px 0 4px", padding: 16, borderRadius: "var(--radius-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hairline)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>Instant updates from ERPRev (webhook)</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: last && last.ok ? "#3f6b45" : w.hasSecret ? "var(--mr-gold-600)" : "var(--text-muted)" }}>
          {last && last.ok ? `Receiving — last ${String(last.at).slice(0, 16)} UTC` : w.hasSecret ? "Ready — nothing received yet" : "Needs its secret"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 6 }}>
        Every stock move and price change in ERPRev lands on the shop within seconds, into the shop its location is mapped to
        below ({(erp.stores.find((l) => l.id === (erp.config.defaultShop || "abuja")) || { city: "Abuja" }).city} by default). In ERPRev, add a webhook for product and stock events pointing at:
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <code style={{ ...code, fontSize: 12, padding: "6px 10px", background: "var(--surface-card)", border: "1px solid var(--border-hairline)", wordBreak: "break-all" }}>{w.url}</code>
        <Button variant="secondary" size="sm" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 8 }}>
        {w.hasSecret
          ? <>The webhook secret is set. If ERPRev&rsquo;s webhook screen can&rsquo;t sign deliveries, put the same secret on the end of the address instead: <code style={code}>?token=…</code></>
          : <>Copy the <strong>signing secret</strong> ERPRev shows for the webhook, and add it as the GitHub secret <code style={code}>ERP_WEBHOOK_SECRET</code> (or <code style={code}>wrangler secret put ERP_WEBHOOK_SECRET</code>). Until it is set, every delivery is refused — an open address that sets stock would let anyone empty the shop.</>}
      </div>
      {w.recent.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 170, overflowY: "auto" }}>
          {w.recent.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", fontSize: 11.5, color: r.ok ? "var(--text-muted)" : "#c0587a" }}>
              <span style={{ minWidth: 0 }}>{r.event ? <strong style={{ fontWeight: 600 }}>{r.event}: </strong> : null}{r.note}</span>
              <span style={{ flexShrink: 0 }}>{String(r.at).slice(5, 16)}{r.auth ? ` · ${r.auth}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The ERP link — inventory and catalogue.
//
// A checklist rather than a form, because the order matters and the failures
// that follow getting it wrong are silent: stock from one city on another
// city's shelf, or a shop emptied by an expired key.
//
// Which ERP is a setting here, not a deploy. The first version of this
// connector was built against ERPNext because a planning note had guessed
// that "ERPrev" meant ERPNext; it means ERPRevolution. Correcting that now
// costs one dropdown.
function ErpPanel({ erp, ctx, reload }) {
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(null);
  const [showFields, setShowFields] = useState(false);
  useEffect(() => { if (erp && !form) setForm({ ...erp.config }); }, [erp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!erp || !form) return null;

  const cfg = erp.config;
  const vendor = erp.vendors.find((v) => v.id === form.vendor) || erp.vendors[0];
  const mapped = erp.warehouses.filter((w) => w.locationId).length;
  const paths = { ...(vendor ? vendor.defaults.paths : {}), ...(form.paths || {}) };
  const fields = form.fields || {};

  const step = (n, label, done, children) => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, background: done ? "#e4efe4" : "var(--surface-sunken)", color: done ? "#3f6b45" : "var(--text-muted)" }}>{done ? "✓" : n}</span>
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
  const SAVED = ["erpVendor", "erpOn", "erpBaseUrl", "erpAuthStyle", "erpPageStyle", "erpPaths", "erpFields",
    "erpEnvelopeKey", "erpPriceList", "erpPublish", "erpDefaultCat", "erpGroupUnits", "erpDefaultShop", "erpImportNew", "erpEmptyGuardPct", "erpSyncEveryMins"];
  const saveConfig = async () => {
    setBusy("config");
    try {
      const patch = {
        erpVendor: form.vendor, erpOn: form.on ? "1" : "0", erpBaseUrl: form.baseUrl,
        erpAuthStyle: form.authStyle, erpPageStyle: form.pageStyle,
        erpPaths: JSON.stringify(form.paths || {}), erpFields: JSON.stringify(form.fields || {}),
        erpEnvelopeKey: form.envelopeKey || "", erpPriceList: form.priceList || "",
        erpPublish: form.publish ? "1" : "0", erpDefaultCat: form.defaultCat,
        erpGroupUnits: form.groupUnits ? "1" : "0",
        erpDefaultShop: form.defaultShop ?? "abuja",
        erpImportNew: form.importNew ? "1" : "0",
        erpEmptyGuardPct: form.emptyGuardPct, erpSyncEveryMins: form.syncEveryMins,
      };
      await api.put("/api/admin/settings", { settings: Object.fromEntries(SAVED.map((k) => [k, patch[k]])) }, ctx.token);
      ctx.flash("Saved");
      reload();
    } catch (e) { ctx.authFail(e); window.alert(e.message); } finally { setBusy(""); }
  };
  // Switching ERP takes that adapter's defaults with it, rather than leaving
  // the last one's endpoint paths pointing at a site that has never heard of
  // them.
  const pickVendor = (id) => {
    const v = erp.vendors.find((x) => x.id === id);
    setForm((f) => ({ ...f, vendor: id, ...(v ? { authStyle: v.defaults.authStyle, pageStyle: v.defaults.pageStyle, paths: { ...v.defaults.paths } } : {}) }));
  };
  const setPath = (k, v) => setForm((f) => ({ ...f, paths: { ...paths, [k]: v } }));
  const setField = (k, v) => setForm((f) => ({ ...f, fields: { ...fields, [k]: v } }));
  const setMap = async (w, locationId) => {
    try { await api.patch(`/api/admin/erp/warehouses/${encodeURIComponent(w.warehouse)}`, { locationId }, ctx.token); reload(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };
  const setCat = async (g, cat) => {
    try { await api.patch(`/api/admin/erp/item-groups/${encodeURIComponent(g.itemGroup)}`, { cat }, ctx.token); reload(); }
    catch (e) { ctx.authFail(e); window.alert(e.message); }
  };
  const out = (id) => (result && result.id === id ? result.data : null);
  const bad = (d) => !!(d && (d.error || d.ok === false));
  const noteBox = (d, body) => d && (
    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, borderRadius: "var(--radius-md)", padding: "10px 12px", background: bad(d) ? "#f7e3ea" : "#e4efe4", color: bad(d) ? "#c0587a" : "#3f6b45", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</div>
  );
  // What the ERP's own published specification says — worth more than
  // anything written in this repo about a vendor's API.
  const specNote = (d) => noteBox(d, d && (d.error || [
    `${d.title || "The API"} ${d.version} — ${d.pathCount} endpoints published.`,
    "",
    "How it says requests are authenticated:",
    ...(d.security.length
      ? d.security.map((x) => `\u00b7 ${x.name}: ${x.type}${x.header ? ` — header ${x.header}` : ""}${x.scheme ? ` (${x.scheme})` : ""}${x.description ? `\n   ${x.description}` : ""}`)
      : ["\u00b7 it names none — requests are signed as ERPRev's Signing requests page specifies"]),
    "",
    "Endpoints it publishes for what we need:",
    ...Object.entries(d.found || {}).map(([k, v]) => `\u00b7 ${k}: ${v.length ? v.join(", ") : "— none found"}`),
  ].join("\n")));
  const testNote = (d) => noteBox(d, d && (d.error || [
    `Reached it in ${d.ms}ms.`,
    d.ping ? `\u00b7 ping: ${d.ping.status}${d.ping.version ? ` (${d.ping.version})` : ""}${typeof d.ping.clockSkewSeconds === "number" ? `, clocks ${d.ping.clockSkewSeconds}s apart` : ""}` : "",
    d.ping && d.ping.clockWarning ? `  \u26a0 ${d.ping.clockWarning}` : "",
    ...Object.entries(d.reached || {}).map(([k, v]) => `· ${k}: ${v}`),
    d.mapped ? `\nFirst product read as: code "${d.mapped.code || "—"}", name "${d.mapped.name || "—"}"${d.mapped.missing.length ? ` — couldn't find ${d.mapped.missing.join(" or ")}, so run the probe and name them below` : ""}.${d.mapped.sawPrice ? " Price is on the product row." : ""}${d.mapped.sawStock ? " Stock is on the product row." : ""}` : "",
  ].filter(Boolean).join("\n")));
  const probeNote = (d) => noteBox(d, d && (d.error || (d.count === 0
    ? `${d.note}\n\n${d.body}`
    : [
      `${d.path} — ${d.count} row(s). The first one has these keys:`,
      d.keys.join(", "),
      "",
      "What the reader matched:",
      ...Object.entries(d.resolved || {}).map(([k, v]) => `· ${k}: ${v || "— nothing matched"}`),
      "",
      d.sample,
    ].join("\n"))));
  // What a pull did — or, dry, would do — told as the house needs to check it:
  // which ERP item became which shop size, and what was left alone and why.
  const money = (n) => (n > 0 ? `₦${Math.round(n).toLocaleString("en-NG")}` : "price unchanged");
  const stockText = (st) => (st ? Object.entries(st).map(([k, v]) => `${k} ${v}`).join(", ") : "stock unchanged");
  const pullNote = (d) => noteBox(d, d && (d.error || [
    `${d.dryRun ? "Dry run — nothing was written.\n" : ""}${d.rows} ERP item(s) read. ${d.matched} matched to sizes the shop already sells${d.byHow ? ` (${Object.entries(d.byHow).map(([k, v]) => `${v} by ${k}`).join(", ")})` : ""}.`,
    ...(d.matches || []).map((m) => `· ${m.erp} → ${m.shop} · ${money(m.price)} · ${stockText(m.stock)}`),
    d.matched > (d.matches || []).length ? `  …and ${d.matched - d.matches.length} more.` : "",
    d.unmappedLocations && d.unmappedLocations.length ? `\nStock in ERP locations that aren't mapped to a shop, so not counted — map them in step 5:\n${d.unmappedLocations.map((u) => `· ${u.location}: ${u.units} unit(s)`).join("\n")}` : "",
    d.ambiguous && d.ambiguous.length ? `\nNot linked — ambiguous (link these by hand or make the names unique):\n${d.ambiguous.map((a) => `· ${a.name}: ${a.why}`).join("\n")}` : "",
    d.notInShop ? `\n${d.notInShop} ERP item(s) the shop doesn't sell${d.importNew ? ` — ${d.productsCreated || 0} brought in as drafts this run` : " — left alone (switch on “bring in new ERP items” to import them as drafts)"}: ${d.notInShopSample.join(", ")}${d.notInShop > d.notInShopSample.length ? "…" : ""}` : "",
    d.shopOnly ? `\n${d.shopOnly} shop size(s) with no ERP item — their stock stays as the shop has it: ${d.shopOnlySample.join(", ")}${d.shopOnly > d.shopOnlySample.length ? "…" : ""}` : "",
    d.warnings && d.warnings.length ? `\nWorth a look:\n${d.warnings.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : "",
    d.readErrors && d.readErrors.length ? `\nSkipped:\n${d.readErrors.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : "",
  ].filter(Boolean).join("\n")));
  const discoverNote = (d) => noteBox(d, d && (d.error || `Found ${d.warehouses} location(s) and ${d.itemGroups} categor${d.itemGroups === 1 ? "y" : "ies"}.`));

  // The webhook counts as connected in its own right: it needs no request
  // signing, so it is often live before the scheduled pull is.
  const receiving = !!(erp.webhook && erp.webhook.recent.some((r) => r.ok));
  const b = statusBadge(cfg.on && cfg.configured ? "good" : receiving ? "good" : cfg.configured ? "warn" : "mute");
  const label = cfg.on && cfg.configured ? "Syncing" : receiving ? "Receiving from ERPRev" : cfg.configured ? "Configured, not running" : "Not connected";
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 12.5, padding: "6px 10px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-strong)", cursor: "pointer", maxWidth: "100%" };
  const PATHS = [
    ["products", "Products / items", "The list of everything sellable. Required."],
    ["prices", "Prices", "Leave empty if the price is on the product row — which it usually is."],
    ["stock", "Stock / inventory", "Per location. Leave empty if the quantity is on the product row."],
    ["warehouses", "Locations / warehouses", "Optional — otherwise the names seen on stock rows are used."],
    ["groups", "Categories", "Optional."],
  ];

  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Inventory &amp; catalogue link</div>
        <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 11px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 6px", lineHeight: 1.6 }}>
        The ERP owns price and stock; the shop owns names, descriptions, photographs, categories and shelf order. A pull never
        overwrites the second set — it only fills them in for an item the shop has never seen.
        {cfg.lastSync ? ` Last pull: ${cfg.lastSync} UTC.` : " Never pulled."}
        {erp.linkedVariants ? ` ${erp.linkedVariants} SKU(s) are linked.` : ""}
      </div>

      {erp.webhook && <ErpWebhookBox erp={erp} ctx={ctx} />}

      {step(1, "Which ERP", true, (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={form.vendor} onChange={(e) => pickVendor(e.target.value)} style={{ ...selStyle, width: "100%", padding: "9px 12px", fontSize: 13 }}>
            {erp.vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          {vendor && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {vendor.note}
              {vendor.docs && (
                <> <a href={vendor.docs} target="_blank" rel="noopener noreferrer" style={{ color: "var(--mr-purple-700)" }}>Their developer guide &rarr;</a></>
              )}
            </div>
          )}
        </div>
      ))}

      {step(2, "The credentials", cfg.hasKey, (
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          {cfg.hasKey
            ? "Set. They are Worker secrets, so nothing on this screen can read them back."
            : <>Not set. Generate an API key and secret for a read-only integration user in the ERP, then from the project:
              <br /><code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_KEY</code>
              {" · "}<code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_SECRET</code>
              <br />If the ERP issues only one token, put it in either box. They never go in the database and never reach a
              browser — the same rule as the Paystack key.</>}
        </div>
      ))}

      {step(3, "Where it is, and how it wants to be asked", !!cfg.baseUrl, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input label="Base URL" value={form.baseUrl || ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://yourcompany.erprev.com" hint="The API root — no trailing slash, no endpoint on the end." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>Authentication</div>
              <select value={form.authStyle} onChange={(e) => setForm({ ...form, authStyle: e.target.value })} style={{ ...selStyle, width: "100%", padding: "10px 12px" }}>
                {erp.authStyles.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Whatever the ERP&rsquo;s API documentation asks for.</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>Paging</div>
              <select value={form.pageStyle} onChange={(e) => setForm({ ...form, pageStyle: e.target.value })} style={{ ...selStyle, width: "100%", padding: "10px 12px" }}>
                {erp.pageStyles.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Wrong here means only the first 200 rows arrive.</div>
            </div>
          </div>
          {PATHS.map(([key, label, hint]) => (
            <Input key={key} label={label} value={paths[key] || ""} onChange={(e) => setPath(key, e.target.value)}
              placeholder={key === "products" ? "/api/products" : "—"} hint={hint} />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Price list (optional)" value={form.priceList || ""} onChange={(e) => setForm({ ...form, priceList: e.target.value })}
              placeholder="Retail" hint="Only for an ERP that keeps several. Quoting the cost list on a storefront is how money is lost." />
            <Input label="Category for unmapped items" value={form.defaultCat || ""} onChange={(e) => setForm({ ...form, defaultCat: e.target.value })}
              placeholder="perfumes" hint="Where a new product lands when its category isn't mapped below." />
          </div>
          {form.authStyle === "hmac" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
              <strong style={{ color: "var(--text-strong)" }}>Signed exactly as ERPRev&rsquo;s Signing requests page specifies</strong> &mdash;
              X-Api-Key, X-Api-Timestamp, X-Api-Nonce and X-Api-Signature (<code>v1=</code> + HMAC-SHA256 over method, path with
              sorted query, timestamp, nonce and the body&rsquo;s SHA-256). Nothing to configure. If the test says
              {" "}<code>auth.signature_invalid</code>, the secret is the thing to re-check; the error shows the exact string that was signed.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "test"} onClick={() => run("test", "/api/admin/erp/test", {})}>{busy === "test" ? "Calling…" : "Test the connection"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "spec"} onClick={() => run("spec", "/api/admin/erp/spec", {})}>{busy === "spec" ? "Reading…" : "Read the API’s own spec"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "probe"} onClick={() => run("probe", "/api/admin/erp/probe", { resource: "products" })}>{busy === "probe" ? "Reading…" : "Show me a row"}</Button>
          </div>
          {testNote(out("test"))}
          {specNote(out("spec"))}
          {probeNote(out("probe"))}
        </div>
      ))}

      {step(4, "What the ERP calls each thing (only if it guessed wrong)", false, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            The reader already tries every common spelling — <code>sku</code>, <code>item_code</code>, <code>product_code</code>, and so
            on for each field. Use <strong>Show me a row</strong> above: it prints the ERP&rsquo;s own keys and says which one it matched
            for each thing it needs. Fill in only the ones that came back empty.
          </div>
          <button onClick={() => setShowFields(!showFields)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0, alignSelf: "flex-start", textDecoration: "underline" }}>
            {showFields ? "Hide the field names" : "Name a field by hand"}
          </button>
          {showFields && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {erp.fieldNames.map((f) => (
                <Input key={f} label={f} value={fields[f] || ""} onChange={(e) => setField(f, e.target.value)} placeholder="auto" />
              ))}
              <Input label="envelope key" value={form.envelopeKey || ""} onChange={(e) => setForm({ ...form, envelopeKey: e.target.value })}
                placeholder="auto" />
            </div>
          )}
          {showFields && <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>}
        </div>
      ))}

      {step(5, "Which location is which shop", mapped > 0, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            This is the mapping that matters most. With more than one ERP location, a location with no shop against it is
            <strong> ignored</strong>, not defaulted — counting unmapped stock into the nearest shop is exactly the mistake
            that puts Lagos&rsquo;s bottles on Abuja&rsquo;s shelf.
          </div>
          <Button variant="secondary" size="sm" disabled={busy === "discover"} onClick={() => run("discover", "/api/admin/erp/discover", {})}>
            {busy === "discover" ? "Reading…" : erp.warehouses.length ? "Refresh the lists from the ERP" : "Fetch locations & categories"}
          </Button>
          {discoverNote(out("discover"))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
            <span>Stock with no location on it, or from an ERP with only one location, goes to</span>
            <select value={form.defaultShop ?? "abuja"} onChange={(e) => setForm({ ...form, defaultShop: e.target.value })} style={selStyle}>
              <option value="">Nowhere — map it by hand</option>
              {erp.stores.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
            </select>
            <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>Save</Button>
          </div>
          {erp.warehouses.length > 1 && (
            <div>
              <Button variant="secondary" size="sm" disabled={busy === "mapall"}
                onClick={() => window.confirm(`Send every ERP location's stock to ${(erp.stores.find((l) => l.id === (form.defaultShop || "abuja")) || { city: "Abuja" }).city}? Only do this if all of it really is that shop's stock.`)
                  && run("mapall", "/api/admin/erp/warehouses/map-all", { locationId: form.defaultShop || "abuja" })}>
                {busy === "mapall" ? "Mapping…" : `Map every location to ${(erp.stores.find((l) => l.id === (form.defaultShop || "abuja")) || { city: "Abuja" }).city}`}
              </Button>
              {noteBox(out("mapall"), out("mapall") && (out("mapall").error || `Mapped ${out("mapall").mapped} location(s).`))}
            </div>
          )}
          {erp.warehouses.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {erp.warehouses.map((w) => (
                <div key={w.warehouse} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: w.disabled ? "var(--text-muted)" : "var(--text-body)", textDecoration: w.disabled ? "line-through" : "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {w.label || w.warehouse}{w.label && w.label !== w.warehouse ? ` (#${w.warehouse})` : ""}{w.isGroup ? " · group" : ""}
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

      {erp.itemGroups.length > 0 && step(6, "Which category is which (optional)", erp.itemGroups.some((g) => g.cat), (
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

      {step(7, "See what a pull would do", false, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            A dry run does every read and every check and writes nothing. Run it before the real one, every time the mapping
            changes.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "dry"} onClick={() => run("dry", "/api/admin/erp/pull", { dryRun: true })}>
              {busy === "dry" ? "Reading…" : "Dry run"}
            </Button>
            <Button variant="primary" size="sm" disabled={busy === "live"}
              onClick={() => window.confirm("Pull from the ERP for real? Prices and stock on linked SKUs are overwritten with the ERP's.") && run("live", "/api/admin/erp/pull", { dryRun: false })}>
              {busy === "live" ? "Syncing…" : "Pull for real"}
            </Button>
          </div>
          {pullNote(out("dry"))}
          {pullNote(out("live"))}
        </div>
      ))}

      {step(8, "Let it run on its own", cfg.on, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Switch label="Pull from the ERP on a schedule" checked={!!form.on} onChange={(e) => setForm({ ...form, on: e.target.checked })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Every (minutes)" value={form.syncEveryMins ?? ""} onChange={(e) => setForm({ ...form, syncEveryMins: e.target.value.replace(/\D/g, "") })}
              placeholder="60" hint="15 at the fastest — that is how often the cron runs." />
            <Input label="Empty-feed guard (%)" value={form.emptyGuardPct ?? ""} onChange={(e) => setForm({ ...form, emptyGuardPct: e.target.value.replace(/\D/g, "") })}
              placeholder="25" hint="Refuse a pull that would cut catalogue stock by more than this. An expired key returns nothing, and nothing must not empty the shop." />
          </div>
          <Switch label="Group sizes of one product into a single listing"
            checked={!!form.groupUnits} onChange={(e) => setForm({ ...form, groupUnits: e.target.checked })} />
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4, lineHeight: 1.6 }}>
            ERPRev keeps one row per sellable thing, so three sizes of a fragrance arrive as three products &mdash; three cards in
            the shop. On, a product whose name <em>ends with its own unit</em> has that unit taken off, and rows that then match
            become one listing with a size picker: &ldquo;Velvet Reign 30ml&rdquo; and &ldquo;Velvet Reign 50ml&rdquo; become
            Velvet Reign, 30ml and 50ml. It never merges on a near-match, and never on a name only one product has.
            <strong> Dry-run it first</strong> and read what it would group.
          </div>
          <Switch label="Bring in ERP items the shop doesn't sell yet" checked={!!form.importNew} onChange={(e) => setForm({ ...form, importNew: e.target.checked })} />
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4, lineHeight: 1.6 }}>
            Off (recommended to start): the pull keeps the shop&rsquo;s own products&rsquo; price and stock in step with the ERP and leaves
            everything else in the ERP &mdash; packaging, raw materials, retired lines &mdash; out of the shop. The dry run lists what it is leaving out.
          </div>
          <Switch label="Items new to the shop go live immediately" checked={!!form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4 }}>
            Off (recommended): they arrive as drafts with the ERP&rsquo;s own description, and somebody writes the shop copy and adds
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
  const [mail, setMail] = useState(null);
  const origin = window.location.origin;

  const load = () => {
    api.get("/api/admin/payments", ctx.token).then(setPay).catch(() => {});
    api.get("/api/admin/media/status", ctx.token).then(setMedia).catch(() => {});
    // Super-only, so a manager's admin simply doesn't draw the panel.
    api.get("/api/admin/erp", ctx.token).then(setErp).catch(() => {});
    api.get("/api/admin/email", ctx.token).then(setMail).catch(() => {});
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
      <EmailPanel mail={mail} ctx={ctx} reload={load} />
      <MediaPanel media={media} ctx={ctx} reload={load} />
      <ErpPanel erp={erp} ctx={ctx} reload={load} />

      {/* Automations */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Automations</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Lifecycle messages fire from store events and send through Resend (see Email above). Without a key they queue here, readable, rather than being lost.</div>
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
