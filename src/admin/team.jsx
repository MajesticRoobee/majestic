// Admin — staff accounts (super only) and personal account/2FA.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select } from "../ds/components.jsx";
import { statusBadge } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const th = { padding: "10px 14px", borderTop: "1px solid var(--border-hairline)", fontWeight: 600, color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.06em" };

function IssuedPassphrase({ label, value, onDone }) {
  return (
    <div style={{ background: "var(--mr-gold-200)", border: "1px solid var(--mr-gold-400)", borderRadius: "var(--radius-md)", padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: "var(--mr-gold-600)", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <code style={{ fontFamily: "monospace", fontSize: 16, background: "var(--surface-card)", padding: "8px 12px", borderRadius: "var(--radius-sm)", color: "var(--mr-purple-900)", letterSpacing: "0.04em" }}>{value}</code>
        <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(value)} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "var(--mr-purple-800)", fontFamily: "var(--font-sans)" }}>Copy</button>
        <button onClick={onDone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Done</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--mr-gold-600)", marginTop: 8 }}>Shown once — copy it now and give it to the employee. They'll be asked to set their own on first login.</div>
    </div>
  );
}

export function TeamPage({ ctx }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", name: "", role: "manager", scope: "abuja" });
  const [issued, setIssued] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.get("/api/admin/users", ctx.token).then((r) => setUsers(r.users)).catch(ctx.authFail);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => {
    try {
      const r = await api.post("/api/admin/users", form, ctx.token);
      setIssued({ label: `Passphrase for @${r.username}`, value: r.passphrase });
      setForm({ username: "", name: "", role: "manager", scope: "abuja" });
      setErr("");
      load();
    } catch (e) { ctx.authFail(e); setErr(e.message); }
  };
  const reset = async (u) => {
    try { const r = await api.post(`/api/admin/users/${u.id}/reset`, {}, ctx.token); setIssued({ label: `New passphrase for @${u.username}`, value: r.passphrase }); load(); }
    catch (e) { ctx.authFail(e); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/api/admin/users/${u.id}`, { active: !u.active }, ctx.token); load(); }
    catch (e) { ctx.authFail(e); }
  };
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Add an employee</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>Creates an account and issues a one-time passphrase. Only a super admin can add staff.</div>
        {issued && <IssuedPassphrase {...issued} onDone={() => setIssued(null)} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="amaka" hint="Lowercase, no spaces — their login handle." />
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amaka Okoro" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="manager">Store manager</option>
              <option value="super">Super admin</option>
            </Select>
            <Select label="Store" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} disabled={form.role === "super"}>
              <option value="abuja">Abuja</option>
              <option value="lagos">Lagos</option>
              <option value="ibadan">Ibadan</option>
            </Select>
          </div>
          <Button variant="primary" block onClick={create}>Create account</Button>
          {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
        </div>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Staff accounts</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr 90px 1.2fr", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>USER</div>
            <div style={th}>ROLE</div>
            <div style={th}>2FA</div>
            <div style={th}>STATUS</div>
            <div style={{ ...th, paddingRight: 22 }}>ACTIONS</div>
            {users.map((u) => {
              const b = statusBadge(u.active ? "good" : "mute");
              const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)" };
              return (
                <React.Fragment key={u.id}>
                  <div style={{ ...cell, paddingLeft: 22 }}>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{u.username}</div>
                  </div>
                  <div style={{ ...cell, color: "var(--text-body)" }}>{u.role === "super" ? "Super admin" : `${u.scope} manager`}{u.must_change ? " · passphrase pending" : ""}</div>
                  <div style={{ ...cell }}><span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", ...statusBadge(u.totp_enabled ? "good" : "mute") }}>{u.totp_enabled ? "On" : "Off"}</span></div>
                  <div style={{ ...cell }}><span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{u.active ? "Active" : "Disabled"}</span></div>
                  <div style={{ ...cell, paddingRight: 22, display: "flex", gap: 12 }}>
                    <button onClick={() => reset(u)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--mr-purple-700)", fontFamily: "var(--font-sans)", padding: 0 }}>Reset passphrase</button>
                    <button onClick={() => toggle(u)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: u.active ? "var(--mr-orchid-600)" : "#3f6b45", fontFamily: "var(--font-sans)", padding: 0 }}>{u.active ? "Disable" : "Enable"}</button>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

export function AccountPage({ ctx }) {
  const me = ctx.me || {};
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [totp, setTotp] = useState(null); // { secret, uri }
  const [code, setCode] = useState("");
  const [totpMsg, setTotpMsg] = useState("");
  const section = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", padding: 24, display: "flex", flexDirection: "column", gap: 14 };
  const isMaster = me.master || me.id === 0;

  const changePw = async () => {
    setPwMsg("");
    if (pw.next !== pw.confirm) return setPwMsg("The two new passphrases don't match.");
    try {
      await api.post("/api/admin/account/password", { current: pw.current, next: pw.next }, ctx.token);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg("Passphrase updated.");
      ctx.loadMe();
    } catch (e) { ctx.authFail(e); setPwMsg(e.message); }
  };
  const initTotp = async () => {
    try { const r = await api.post("/api/admin/account/totp/init", {}, ctx.token); setTotp(r); setTotpMsg(""); }
    catch (e) { ctx.authFail(e); setTotpMsg(e.message); }
  };
  const enableTotp = async () => {
    try { await api.post("/api/admin/account/totp/enable", { code }, ctx.token); setTotp(null); setCode(""); setTotpMsg("Two-factor authentication is on."); ctx.loadMe(); }
    catch (e) { ctx.authFail(e); setTotpMsg(e.message); }
  };
  const disableTotp = async () => {
    try { await api.post("/api/admin/account/totp/disable", { code }, ctx.token); setCode(""); setTotpMsg("Two-factor authentication is off."); ctx.loadMe(); }
    catch (e) { ctx.authFail(e); setTotpMsg(e.message); }
  };

  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div style={section}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Signed in as {me.name || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{isMaster ? "Master passphrase session" : `@${me.username} · ${me.role === "super" ? "Super admin" : `${me.scope} manager`}`}</div>
        </div>
      </div>

      {!isMaster && (
        <div style={section}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Change passphrase</div>
          <Input label="Current passphrase" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="New passphrase" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="At least 8 characters." />
            <Input label="Confirm new" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <div><Button variant="primary" onClick={changePw}>Update passphrase</Button></div>
          {pwMsg && <div style={{ fontSize: 12.5, color: pwMsg.includes("updated") ? "#3f6b45" : "#c0587a" }}>{pwMsg}</div>}
        </div>
      )}

      {!isMaster && (
        <div style={section}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Two-factor authentication (2FA)</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {me.totpEnabled ? "2FA is on — you'll be asked for a code from your authenticator app at login." : "Add a second step at login using an authenticator app (Google Authenticator, Authy, 1Password…)."}
          </div>
          {!me.totpEnabled && !totp && <div><Button variant="secondary" onClick={initTotp}>Set up 2FA</Button></div>}
          {!me.totpEnabled && totp && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>1. Add this key to your authenticator app (manual entry):</div>
              <code style={{ fontFamily: "monospace", fontSize: 15, background: "var(--surface-sunken)", padding: "10px 12px", borderRadius: "var(--radius-sm)", color: "var(--mr-purple-900)", wordBreak: "break-all" }}>{totp.secret}</code>
              <div style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>or use setup URL: {totp.uri}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>2. Enter the 6-digit code it shows:</div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <Input label="Code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" style={{ width: 140 }} />
                <Button variant="primary" onClick={enableTotp}>Turn on 2FA</Button>
              </div>
            </div>
          )}
          {me.totpEnabled && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Input label="Current 2FA code to disable" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" style={{ width: 200 }} />
              <Button variant="secondary" onClick={disableTotp}>Turn off 2FA</Button>
            </div>
          )}
          {totpMsg && <div style={{ fontSize: 12.5, color: totpMsg.includes("on") || totpMsg.includes("off") ? "#3f6b45" : "#c0587a" }}>{totpMsg}</div>}
        </div>
      )}

      {isMaster && (
        <div style={section}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>You're signed in with the master passphrase. Create a named super-admin account under <strong>Team</strong> and use that day-to-day so you can enable 2FA and keep an audit trail.</div>
        </div>
      )}
    </main>
  );
}
