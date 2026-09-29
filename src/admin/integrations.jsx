// Admin — Automations (F2) and the integration layer (F3): outbound webhooks,
// API keys, and the connection details for the partner API + MCP endpoint.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch } from "../ds/components.jsx";
import { statusBadge } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const runTone = (s) => ({ sent: "good", queued: "warn", pending: "warn", skipped: "mute", failed: "bad" }[s] || "mute");

// Setup detail and logs, folded away. What is connected and working needs no
// explaining; this is where someone goes when something needs fixing.
function Fold({ title, children, open = false }) {
  return (
    <details open={open} style={{ marginTop: 14, borderTop: "1px solid var(--border-hairline)", paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "var(--mr-purple-700)", listStylePosition: "inside" }}>{title}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

const pillOf = (tone, text) => {
  const b = statusBadge(tone);
  return <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 11px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg, flexShrink: 0 }}>{text}</span>;
};

function Secret({ label, value, onDone }) {
  return (
    <div style={{ background: "var(--mr-gold-200)", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--mr-gold-600)", fontWeight: 600, marginBottom: 6 }}>{label} — copy it now, it won\u2019t be shown again</div>
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
          ? `${r.expired} released, ${r.rescued} already paid.`
          : "Nothing to release."
      );
      reload();
    } catch (e) { window.alert(e.message); } finally { setSweeping(false); }
  };
  const modes = {
    off: { label: "Not connected", tone: "bad", note: "Card payments are off." },
    test: { label: "Test mode", tone: "warn", note: "Cards are not charged." },
    live: { label: "Live", tone: "good", note: "" },
    unknown: { label: "Check key", tone: "warn", note: "The payment key doesn\u2019t look right." },
  };
  const m = modes[pay ? pay.gateway.mode : "off"];
  const rowTone = (s) => ({ success: "good", initialized: "mute", failed: "bad", mismatch: "bad", expired: "warn" }[s] || "mute");
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Payments</div>
        {pillOf(m.tone, m.label)}
      </div>
      {m.note && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.note}</div>}
      {pay && pay.unpaidOrders > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
          <span style={{ color: "var(--mr-gold-600)" }}>{pay.unpaidOrders} unpaid order{pay.unpaidOrders === 1 ? "" : "s"}</span>
          <Button variant="secondary" size="sm" disabled={sweeping} onClick={sweep}>
            {sweeping ? "Checking…" : "Release expired"}
          </Button>
        </div>
      )}

      <Fold title="Setup & activity">
      <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 12.5, color: "var(--mr-purple-800)", lineHeight: 1.8, marginBottom: 16 }}>
        <div>Paystack webhook URL:</div>
        <code style={{ fontSize: 12.5, wordBreak: "break-all" }}>{origin}/api/paystack/webhook</code>
      </div>
      {(!pay || !pay.payments.length) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No payment activity yet.</div>
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
      </Fold>
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
      setProgress(moved ? `Moved ${moved} image${moved === 1 ? "" : "s"}.` : "Nothing to move.");
      reload();
    } catch (e) { setProgress(e.message); } finally { setMoving(false); }
  };

  // Nothing to do — nothing to show.
  if (!media.bucketBound || !media.inD1) return null;

  return (
    <div style={{ ...card, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Product images</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{media.inD1} image{media.inD1 === 1 ? "" : "s"} to move ({mb(media.d1Bytes)})</div>
        </div>
        {pillOf("warn", "Action needed")}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" disabled={moving} onClick={migrate}>{moving ? "Moving…" : "Move images"}</Button>
        {progress && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{progress}</span>}
      </div>
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Email</div>
        {pillOf(mail.connected ? "good" : "mute", mail.connected ? "Connected" : "Not connected")}
      </div>
      {mail.connected && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Sending as {mail.from}</div>}
      {mail.connected && mail.fromIsDefault && (
        <div style={{ fontSize: 12, color: "var(--mr-gold-600)", marginTop: 4 }}>Check that {mail.domain} is verified in Resend.</div>
      )}
      {mail.keyLooksWrong && <div style={{ fontSize: 12, color: "#c0587a", marginTop: 4 }}>The email key doesn&rsquo;t look right.</div>}
      {!mail.connected && (
      <Fold title="Setup">
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
        <>Add these as GitHub repository secrets and redeploy:
            <br />· <code style={code}>RESEND_API_KEY</code> — resend.com → API Keys → create one with <em>Sending access</em>
            <br />· <code style={code}>RESEND_FROM</code> — e.g. <code style={code}>Majestic Roobee &lt;hello@majesticroobee.shop&gt;</code>, on a domain verified in Resend → Domains
            <br />· <code style={code}>RESEND_REPLY_TO</code> — optional</>
      </div>
      </Fold>
      )}
      {mail.connected && (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
        <div style={{ flex: "1 1 240px" }}>
          <Input label="Send a test email to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@majesticroobee.shop" />
        </div>
        <Button variant="secondary" size="sm" disabled={busy || !mail.connected || !to.includes("@")} onClick={test}>{busy ? "Sending…" : "Send test"}</Button>
      </div>
      )}
      {res && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, borderRadius: "var(--radius-md)", padding: "10px 12px", background: res.sent ? "#e4efe4" : "#f7e3ea", color: res.sent ? "#3f6b45" : "#c0587a" }}>
          {res.sent ? `Sent — check ${to}.` : res.detail || res.error}
        </div>
      )}
      {mail.recent.length > 0 && (
        <Fold title="Recent emails">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {mail.recent.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: r.status === "sent" ? "var(--text-muted)" : "#c0587a" }}>
              <span style={{ minWidth: 0 }}>{r.subject} → {r.recipient || "—"}{r.status !== "sent" ? ` · ${r.detail}` : ""}</span>
              <span style={{ flexShrink: 0 }}>{String(r.processed_at || "").slice(5, 16)}</span>
            </div>
          ))}
        </div>
        </Fold>
      )}
    </div>
  );
}

// Ads & tracking: which tags are set, whether the server can report sales to
// Meta, and what happened to the last few orders on the way there.
function TrackingPanel({ tr, ctx, reload }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  if (!tr) return null;
  const capiReady = !!(tr.metaPixelId && tr.capiToken);
  const tone = tr.metaPixelId && tr.capiToken ? "good" : tr.metaPixelId ? "warn" : "mute";
  const label = tr.metaPixelId && tr.capiToken ? "Pixel + server events" : tr.metaPixelId ? "Pixel only" : "Not connected";
  const codeStyle = { fontFamily: "monospace", fontSize: 11.5, background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 4 };
  const row = (name, on, value) => (
    <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "7px 0", borderTop: "1px solid var(--border-hairline)" }}>
      <span style={{ color: "var(--text-strong)" }}>{name}</span>
      <span style={{ color: on ? "#3f6b45" : "var(--text-muted)" }}>{on ? value || "On" : "Not set"}</span>
    </div>
  );
  const test = async () => {
    setBusy(true); setRes(null);
    try { await api.post("/api/admin/tracking/meta-test", { testCode: code }, ctx.token); setRes({ ok: true }); }
    catch (e) { ctx.authFail(e); setRes({ ok: false, msg: e.message }); }
    finally { setBusy(false); reload(); }
  };
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Ads &amp; tracking</div>
        {pillOf(tone, label)}
      </div>
      <div style={{ marginTop: 12 }}>
        {row("Meta Pixel", !!tr.metaPixelId, tr.metaPixelId)}
        {row("Meta Conversions API", tr.capiToken, "Token set")}
        {row("Google Analytics 4", !!tr.ga4Id, tr.ga4Id)}
        {row("Google Ads purchase", !!(tr.googleAdsId && tr.googleAdsPurchaseLabel), tr.googleAdsId)}
        {row("TikTok Pixel", !!tr.tiktokPixelId, tr.tiktokPixelId)}
        {row("Microsoft Clarity", !!tr.clarityId, tr.clarityId)}
        {row("Search Console", tr.gscVerification, "Verified tag set")}
      </div>
      <Fold title="Setup">
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          IDs go in Settings → Analytics. For Meta&rsquo;s server events, create a Conversions API token in Events Manager → your pixel → Settings, and add it as the GitHub secret <code style={codeStyle}>META_CAPI_TOKEN</code>, then redeploy.
          Every order records where the buyer came from either way; see Orders and Insights → Sales by source.
        </div>
      </Fold>
      {capiReady && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
          <div style={{ flex: "1 1 220px" }}>
            <Input label="Test event code (from Events Manager → Test events)" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TEST12345" />
          </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={test}>{busy ? "Sending…" : "Send test purchase"}</Button>
        </div>
      )}
      {res && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, borderRadius: "var(--radius-md)", padding: "10px 12px", background: res.ok ? "#e4efe4" : "#f7e3ea", color: res.ok ? "#3f6b45" : "#c0587a" }}>
          {res.ok ? "Meta accepted it. It shows under Test events within a minute." : res.msg}
        </div>
      )}
      {tr.recent.length > 0 && (
        <Fold title="Recent orders">
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {tr.recent.map((o) => (
              <div key={o.no} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
                <span>{o.no} · from {o.source}</span>
                <span style={{ color: o.meta === "Sent" ? "#3f6b45" : /^error/.test(o.meta) ? "#c0587a" : "var(--text-muted)" }}>Meta: {o.meta}</span>
              </div>
            ))}
          </div>
        </Fold>
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
  const [probeOf, setProbeOf] = useState("products");
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
    d.stockRead ? `\nStock: ${d.stockRead.readable} of ${d.stockRead.rows} stock row(s) read.` : "",
    d.unmappedLocations && d.unmappedLocations.length ? `\nStock in ERP locations that aren't mapped to a shop, so not counted — map them in step 5:\n${d.unmappedLocations.map((u) => `· ${u.location}: ${u.units} unit(s)`).join("\n")}` : "",
    d.ambiguous && d.ambiguous.length ? `\nNot linked — ambiguous (link these by hand or make the names unique):\n${d.ambiguous.map((a) => `· ${a.name}: ${a.why}`).join("\n")}` : "",
    d.notInShop ? `\n${d.notInShop} ERP item(s) the shop doesn't sell${d.importNew ? ` — ${d.productsCreated || 0} brought in as drafts this run` : " — left alone (switch on “bring in new ERP items” to import them as drafts)"}: ${d.notInShopSample.join(", ")}${d.notInShop > d.notInShopSample.length ? "…" : ""}` : "",
    d.shopOnly ? `\n${d.shopOnly} shop size(s) with no ERP item — their stock stays as the shop has it: ${d.shopOnlySample.join(", ")}${d.shopOnly > d.shopOnlySample.length ? "…" : ""}` : "",
    d.warnings && d.warnings.length ? `\nWorth a look:\n${d.warnings.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : "",
    d.readErrors && d.readErrors.length ? `\nSkipped:\n${d.readErrors.map((x) => `· ${x.item}: ${x.error}`).join("\n")}` : "",
  ].filter(Boolean).join("\n")));
  const discoverNote = (d) => noteBox(d, d && (d.error || `Found ${d.warehouses} location(s) and ${d.itemGroups} categor${d.itemGroups === 1 ? "y" : "ies"}.`));

  const tone = cfg.on && cfg.configured ? "good" : cfg.configured ? "warn" : "mute";
  const label = cfg.on && cfg.configured ? "Syncing" : cfg.configured ? "Paused" : "Not connected";
  const selStyle = { fontFamily: "var(--font-sans)", fontSize: 12.5, padding: "6px 10px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-strong)", cursor: "pointer", maxWidth: "100%" };
  const PATHS = [
    ["products", "Products", "Required"],
    ["prices", "Prices", "Optional"],
    ["stock", "Stock", "Optional"],
    ["warehouses", "Locations", "Optional"],
    ["groups", "Categories", "Optional"],
  ];

  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Inventory sync (ERP)</div>
        {pillOf(tone, label)}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
        {cfg.lastSync ? `Last sync ${cfg.lastSync} UTC` : "Not synced yet"}
        {erp.linkedVariants ? ` · ${erp.linkedVariants} products linked` : ""}
      </div>
      {cfg.configured && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" disabled={busy === "live"}
            onClick={() => window.confirm("Sync prices and stock from the ERP now?") && run("live", "/api/admin/erp/pull", { dryRun: false })}>
            {busy === "live" ? "Syncing…" : "Sync now"}
          </Button>
          {noteBox(out("live"), out("live") && (out("live").error || `Synced — ${out("live").matched} product${out("live").matched === 1 ? "" : "s"} updated.`))}
        </div>
      )}

      <Fold title="Setup">

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
            ? "Set."
            : <>Not set. Add them with:
              <br /><code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_KEY</code>
              {" · "}<code style={{ fontFamily: "monospace", fontSize: 11.5 }}>wrangler secret put ERP_API_SECRET</code>
</>}
        </div>
      ))}

      {step(3, "Where it is, and how it wants to be asked", !!cfg.baseUrl, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Input label="Base URL" value={form.baseUrl || ""} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://yourcompany.erprev.com" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>Authentication</div>
              <select value={form.authStyle} onChange={(e) => setForm({ ...form, authStyle: e.target.value })} style={{ ...selStyle, width: "100%", padding: "10px 12px" }}>
                {erp.authStyles.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>Paging</div>
              <select value={form.pageStyle} onChange={(e) => setForm({ ...form, pageStyle: e.target.value })} style={{ ...selStyle, width: "100%", padding: "10px 12px" }}>
                {erp.pageStyles.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              
            </div>
          </div>
          {PATHS.map(([key, label, hint]) => (
            <Input key={key} label={label} value={paths[key] || ""} onChange={(e) => setPath(key, e.target.value)}
              placeholder={key === "products" ? "/api/products" : "—"} hint={hint} />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Price list (optional)" value={form.priceList || ""} onChange={(e) => setForm({ ...form, priceList: e.target.value })}
              placeholder="Retail" />
            <Input label="Category for unmapped items" value={form.defaultCat || ""} onChange={(e) => setForm({ ...form, defaultCat: e.target.value })}
              placeholder="perfumes" />
          </div>
          {form.authStyle === "hmac" && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Signed requests — nothing to configure.</div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "test"} onClick={() => run("test", "/api/admin/erp/test", {})}>{busy === "test" ? "Testing…" : "Test connection"}</Button>
            <Button variant="secondary" size="sm" disabled={busy === "spec"} onClick={() => run("spec", "/api/admin/erp/spec", {})}>{busy === "spec" ? "Reading…" : "Read API spec"}</Button>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {/* Products, stock and locations are three different row shapes,
                  and a stock row that can't be read is the failure that looks
                  like success — so each can be looked at. */}
              <select value={probeOf} onChange={(e) => setProbeOf(e.target.value)} style={{ ...selStyle, padding: "7px 10px" }} aria-label="Which list to show a row from">
                <option value="products">Products</option>
                <option value="stock">Stock</option>
                <option value="warehouses">Locations</option>
                <option value="groups">Categories</option>
              </select>
              <Button variant="secondary" size="sm" disabled={busy === "probe"} onClick={() => run("probe", "/api/admin/erp/probe", { resource: probeOf })}>{busy === "probe" ? "Reading…" : "Show sample"}</Button>
            </span>
          </div>
          {testNote(out("test"))}
          {specNote(out("spec"))}
          {probeNote(out("probe"))}
        </div>
      ))}

      {step(4, "Field names (optional)", false, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => setShowFields(!showFields)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0, alignSelf: "flex-start", textDecoration: "underline" }}>
            {showFields ? "Hide" : "Edit field names"}
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

      {step(5, "Match locations to stores", mapped > 0, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button variant="secondary" size="sm" disabled={busy === "discover"} onClick={() => run("discover", "/api/admin/erp/discover", {})}>
            {busy === "discover" ? "Reading…" : erp.warehouses.length ? "Refresh" : "Fetch locations & categories"}
          </Button>
          {discoverNote(out("discover"))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
            <span>Default store</span>
            <select value={form.defaultShop ?? "abuja"} onChange={(e) => setForm({ ...form, defaultShop: e.target.value })} style={selStyle}>
              <option value="">None</option>
              {erp.stores.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
            </select>
            <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>Save</Button>
          </div>
          {erp.warehouses.length > 1 && (
            <div>
              <Button variant="secondary" size="sm" disabled={busy === "mapall"}
                onClick={() => window.confirm(`Map every location to ${(erp.stores.find((l) => l.id === (form.defaultShop || "abuja")) || { city: "Abuja" }).city}?`)
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

      {erp.itemGroups.length > 0 && step(6, "Match categories (optional)", erp.itemGroups.some((g) => g.cat), (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {erp.itemGroups.map((g) => (
            <div key={g.itemGroup} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "var(--text-body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{g.itemGroup}</span>
              <select value={g.cat || ""} onChange={(e) => setCat(g, e.target.value)} style={selStyle}>
                <option value="">Default</option>
                {ctx.catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}

      {step(7, "Preview a sync", false, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" disabled={busy === "dry"} onClick={() => run("dry", "/api/admin/erp/pull", { dryRun: true })}>
              {busy === "dry" ? "Reading…" : "Preview"}
            </Button>
          </div>
          {pullNote(out("dry"))}
        </div>
      ))}

      {step(8, "Automatic sync", cfg.on, (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Switch label="Sync automatically" checked={!!form.on} onChange={(e) => setForm({ ...form, on: e.target.checked })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Every (minutes)" value={form.syncEveryMins ?? ""} onChange={(e) => setForm({ ...form, syncEveryMins: e.target.value.replace(/\D/g, "") })}
              placeholder="60" hint="Minimum 15" />
            <Input label="Max stock drop per sync (%)" value={form.emptyGuardPct ?? ""} onChange={(e) => setForm({ ...form, emptyGuardPct: e.target.value.replace(/\D/g, "") })}
              placeholder="25" />
          </div>
          <Switch label="Group sizes into one product"
            checked={!!form.groupUnits} onChange={(e) => setForm({ ...form, groupUnits: e.target.checked })} />
          <Switch label="Import new ERP items" checked={!!form.importNew} onChange={(e) => setForm({ ...form, importNew: e.target.checked })} />
          <Switch label="Publish imported items straight away" checked={!!form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          <Button variant="secondary" size="sm" disabled={busy === "config"} onClick={saveConfig}>{busy === "config" ? "Saving…" : "Save"}</Button>
        </div>
      ))}

      </Fold>
      {erp.syncs.length > 0 && (
        <Fold title="Sync history">
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {erp.syncs.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", fontSize: 11.5, color: r.ok ? "var(--text-muted)" : "#c0587a" }}>
                <span style={{ minWidth: 0 }}>{r.note || r.direction}</span>
                <span style={{ flexShrink: 0 }}>{String(r.at).slice(0, 16)}</span>
              </div>
            ))}
          </div>
        </div>
        </Fold>
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
  const [tracking, setTracking] = useState(null);
  const origin = window.location.origin;

  const load = () => {
    api.get("/api/admin/payments", ctx.token).then(setPay).catch(() => {});
    api.get("/api/admin/media/status", ctx.token).then(setMedia).catch(() => {});
    // Super-only, so a manager's admin simply doesn't draw the panel.
    api.get("/api/admin/erp", ctx.token).then(setErp).catch(() => {});
    api.get("/api/admin/email", ctx.token).then(setMail).catch(() => {});
    api.get("/api/admin/tracking", ctx.token).then(setTracking).catch(() => {});
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
      <TrackingPanel tr={tracking} ctx={ctx} reload={load} />

      {/* Automations */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Automated emails</div>
        </div>
        {autos.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: "1px solid var(--border-hairline)", fontSize: 12.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{runCount(a.id)} sent</div>
            </div>
            <Switch checked={a.enabled} onChange={() => toggleAuto(a)} />
          </div>
        ))}
      </div>

      <details style={{ ...card, padding: "16px 22px" }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Activity log</summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 20, marginTop: 14 }}>
        {/* Recent outbox */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Emails</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {runs.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 13, color: "var(--text-muted)" }}>Nothing yet.</div>}
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
          <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Events</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {events.length === 0 && <div style={{ padding: "0 22px 18px", fontSize: 13, color: "var(--text-muted)" }}>Nothing yet.</div>}
            {events.map((e) => (
              <div key={e.id} style={{ padding: "10px 22px", borderTop: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                <span style={{ color: "var(--mr-purple-800)", fontFamily: "var(--font-condensed)", letterSpacing: "0.04em" }}>{e.type}</span>
                <span style={{ color: "var(--text-muted)" }}>{e.entity || ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </details>

      {secret && <Secret {...secret} onDone={() => setSecret(null)} />}

      <details style={{ ...card, padding: "16px 22px" }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Developer access</summary>
      {/* Webhooks */}
      <div style={{ paddingTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 12 }}>Webhooks</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <Input label="Endpoint URL" value={wh.url} onChange={(e) => setWh({ ...wh, url: e.target.value })} placeholder="https://hooks.example.com/mr" style={{ flex: 2, minWidth: 240 }} />
          <Input label="Events (csv or *)" value={wh.events} onChange={(e) => setWh({ ...wh, events: e.target.value })} placeholder="order_paid,order_placed" style={{ flex: 1, minWidth: 160 }} />
          <Button variant="secondary" onClick={addWebhook}>Add webhook</Button>
        </div>
        {webhooks.length === 0 && <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No webhooks yet.</div>}
        {webhooks.map((w) => (
          <div key={w.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border-hairline)", fontSize: 13, alignItems: "center" }}>
            <div><div style={{ color: "var(--text-strong)" }}>{w.url}</div><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{w.events} · {w.last_status || "no deliveries"}</div></div>
            <button onClick={async () => { await api.del(`/api/admin/webhooks/${w.id}`, ctx.token); load(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)" }}>Remove</button>
          </div>
        ))}
      </div>

      {/* API keys + connection info */}
      <div style={{ paddingTop: 20, marginTop: 16, borderTop: "1px solid var(--border-hairline)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 12 }}>API keys</div>
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
        {keys.length === 0 && <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No API keys.</div>}
        {keys.map((k) => (
          <div key={k.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border-hairline)", fontSize: 13, alignItems: "center" }}>
            <div><div style={{ color: "var(--text-strong)" }}>{k.name} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {k.scopes}</span></div><div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{k.prefix}… · {k.last_used ? "used " + k.last_used : "unused"}</div></div>
            <button onClick={async () => { await api.del(`/api/admin/api-keys/${k.id}`, ctx.token); load(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)" }}>Revoke</button>
          </div>
        ))}
      </div>
      </details>
    </main>
  );
}
