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
  const origin = window.location.origin;

  const load = () => {
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
