// Admin — Sales & promos, Notifications, Customer service, Settings.
import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea, EmptyRow } from "../ds/components.jsx";
import { fmtN, statusBadge } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const th = { padding: "10px 14px", borderTop: "1px solid var(--border-hairline)", fontWeight: 600, color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.06em" };
const storeLink = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };

function StBadge({ tone, children }) {
  const b = statusBadge(tone);
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{children}</span>;
}

export function Sales({ ctx }) {
  const [pr, setPr] = useState({ code: "", type: "pct", value: "", scope: "Storewide", start: "", end: "" });
  const [prErr, setPrErr] = useState("");
  const createPromo = async () => {
    try {
      await api.post("/api/admin/promos", { code: pr.code, kind: pr.type, value: pr.value, scope: pr.scope, starts: pr.start, ends: pr.end }, ctx.token);
      setPr({ code: "", type: "pct", value: "", scope: "Storewide", start: "", end: "" });
      setPrErr("");
      ctx.flash("Sale launched");
      ctx.loadPromos();
    } catch (e) {
      ctx.authFail(e);
      setPrErr(e.message);
    }
  };
  const endPromo = async (code) => {
    try {
      await api.post(`/api/admin/promos/${encodeURIComponent(code)}/end`, {}, ctx.token);
      ctx.loadPromos();
    } catch (e) { ctx.authFail(e); }
  };
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Create a sale</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>Codes apply at checkout and sync to the storefront instantly.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Code" value={pr.code} onChange={(e) => setPr({ ...pr, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="AUGUSTROYALE" hint="Uppercase, no spaces" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Type" value={pr.type} onChange={(e) => setPr({ ...pr, type: e.target.value })}>
              <option value="pct">% off</option>
              <option value="amt">₦ off</option>
              <option value="ship">Free delivery</option>
            </Select>
            <Input label="Value" value={pr.value} onChange={(e) => setPr({ ...pr, value: e.target.value })} placeholder="15" />
          </div>
          <Select label="Applies to" value={pr.scope} onChange={(e) => setPr({ ...pr, scope: e.target.value })}>
            <option value="Storewide">Storewide</option>
            <option value="Fragrances">All fragrances</option>
            <option value="Gift packages">Gift packages</option>
            <option value="Feminine care">Feminine care</option>
          </Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Starts" type="date" value={pr.start} onChange={(e) => setPr({ ...pr, start: e.target.value })} hint="Leave empty to start now" />
            <Input label="Ends" type="date" value={pr.end} onChange={(e) => setPr({ ...pr, end: e.target.value })} hint="Last day it works" />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -4 }}>
            The end date is enforced at checkout — the code stops working the day after it, without anyone having to remember.
          </div>
          <Button variant="gold" block onClick={createPromo}>Launch sale</Button>
          {prErr && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{prErr}</div>}
        </div>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Sales &amp; promo codes</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 700, display: "grid", gridTemplateColumns: "140px 1.6fr 1fr 1fr 90px 90px", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>CODE</div>
            <div style={th}>OFFER</div>
            <div style={th}>WINDOW</div>
            <div style={th}>REDEMPTIONS</div>
            <div style={th}>STATUS</div>
            <div style={{ ...th, paddingRight: 22 }}></div>
            {!ctx.promos.length && <EmptyRow span={6}>No promo codes yet — create one with the form above and it works at checkout straight away.</EmptyRow>}
            {ctx.promos.map((p) => {
              // What the server will actually do, not just the manual switch:
              // a code inside its window but past its end date is not "Active".
              const ended = p.status === "Ended";
              const state = ended ? "Ended" : p.expired ? "Expired" : p.scheduled ? "Scheduled" : "Active";
              const tone = state === "Active" ? "good" : state === "Scheduled" ? "warn" : "mute";
              const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)" };
              return (
                <React.Fragment key={p.code}>
                  <div style={{ ...cell, paddingLeft: 22, fontWeight: 600, color: "var(--mr-purple-800)", letterSpacing: "0.04em" }}>{p.code}</div>
                  <div style={{ ...cell, color: "var(--text-strong)" }}>{p.desc}<span style={{ color: "var(--text-muted)" }}> · {p.scope}</span></div>
                  <div style={{ ...cell, color: "var(--text-muted)" }}>
                    {p.startsAt || p.starts} — {p.endsAt || p.ends}
                    {p.unenforceable && (
                      <span title="This date is free text from before dates were enforced, so nothing stops this code. Re-enter it to set a real end date."
                        style={{ display: "block", fontSize: 11, color: "var(--mr-gold-600)", marginTop: 3 }}>
                        Not enforced — re-enter to set a real date
                      </span>
                    )}
                  </div>
                  <div style={{ ...cell, color: "var(--text-body)" }}>{p.redemptions}</div>
                  <div style={{ ...cell, padding: "11px 14px" }}><StBadge tone={tone}>{state}</StBadge></div>
                  <div style={{ ...cell, padding: "11px 22px 11px 14px" }}>
                    {!ended && (
                      <button onClick={() => endPromo(p.code)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mr-orchid-600)", fontWeight: 500, padding: 0 }}>End now</button>
                    )}
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

const N_TYPES = [
  { id: "popup", label: "Pop-up", kind: "Popup" },
  { id: "banner", label: "Site banner", kind: "Banner" },
  { id: "email", label: "Email blast", kind: "Email" },
  { id: "push", label: "Push", kind: "Push" },
];

export function Notifications({ ctx }) {
  const [nType, setNType] = useState("popup");
  const [f, setF] = useState({ title: "", msg: "", cta: "", aud: "All visitors" });
  const prevTitle = f.title || "The August edit has arrived";
  const prevMsg = f.msg || "Three new extraits, one quiet discount — for the trail you're building.";
  const prevCta = f.cta || "Shop the edit";
  const publish = async () => {
    const def = N_TYPES.find((t) => t.id === nType);
    try {
      await api.post("/api/admin/campaigns", { kind: def.kind, title: f.title, message: f.msg, cta: f.cta, audience: f.aud }, ctx.token);
      setF({ title: "", msg: "", cta: "", aud: f.aud });
      ctx.flash(def.kind === "Email" ? "Blast sent" : def.kind === "Push" ? "Push scheduled" : "Published to storefront");
      ctx.loadCampaigns();
      if (def.kind === "Banner") ctx.loadSettings();
    } catch (e) { ctx.authFail(e); }
  };
  const campTone = (status) => (status === "Live" ? "good" : status === "Scheduled" ? "warn" : "mute");
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Compose</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>Pop-ups and banners go live on the storefront; blasts go through your connected email &amp; push tools.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {N_TYPES.map((t) => {
            const on = nType === t.id;
            return (
              <button key={t.id} onClick={() => setNType(t.id)} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, padding: "7px 14px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Headline" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="The August edit has arrived" />
          <Textarea label="Message" value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} rows={2} placeholder="Three new extraits, one quiet discount…" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Button label" value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} placeholder="Shop the edit" />
            <Select label="Audience" value={f.aud} onChange={(e) => setF({ ...f, aud: e.target.value })}>
              {["All visitors", "First-time visitors", "Subscribers", "Abuja shoppers", "Lagos shoppers", "Ibadan shoppers"].map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
          <Button variant="primary" block onClick={publish}>
            {nType === "email" ? "Send blast" : nType === "push" ? "Schedule push" : "Publish to storefront"}
          </Button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Live preview — {N_TYPES.find((t) => t.id === nType).label}</div>
          {nType === "banner" && (
            <div style={{ background: "var(--mr-purple-950)", color: "var(--text-on-dark-muted)", fontSize: 12, letterSpacing: "0.06em", textAlign: "center", padding: "10px 16px", borderRadius: "var(--radius-sm)" }}>{prevTitle} — {prevMsg}</div>
          )}
          {nType === "popup" && (
            <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-md)", padding: 28, display: "flex", justifyContent: "center" }}>
              <div style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", maxWidth: 340, width: "100%", padding: "28px 26px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Majestic Roobee</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-strong)", margin: "10px 0 6px" }}>{prevTitle}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-body)", marginBottom: 16 }}>{prevMsg}</div>
                <span style={{ display: "inline-block", background: "var(--accent-gold)", color: "var(--mr-purple-950)", fontSize: 12.5, fontWeight: 500, padding: "10px 22px", borderRadius: "var(--radius-pill)" }}>{prevCta}</span>
              </div>
            </div>
          )}
          {nType === "email" && (
            <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <div style={{ background: "var(--surface-sunken)", padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>To: {f.aud} · From: Majestic Roobee &lt;hello@majesticroobee.com&gt;</div>
              <div style={{ padding: "22px 24px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-strong)", marginBottom: 8 }}>{prevTitle}</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-body)", marginBottom: 14 }}>{prevMsg}</div>
                <span style={{ display: "inline-block", background: "var(--mr-purple-900)", color: "var(--mr-cream)", fontSize: 12.5, padding: "10px 22px", borderRadius: "var(--radius-pill)" }}>{prevCta}</span>
              </div>
            </div>
          )}
          {nType === "push" && (
            <div style={{ background: "var(--mr-lavender-200)", borderRadius: "var(--radius-md)", padding: 24, display: "flex", justifyContent: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.96)", borderRadius: 14, boxShadow: "var(--shadow-md)", maxWidth: 330, width: "100%", padding: "13px 15px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: "var(--mr-purple-900)", color: "var(--mr-gold-400)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 15, flexShrink: 0 }}>M</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--mr-ink)" }}>{prevTitle}</span><br />
                  <span style={{ fontSize: 12, color: "var(--mr-slate)" }}>{prevMsg}</span>
                </span>
                <span style={{ fontSize: 10.5, color: "var(--mr-mute)" }}>now</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Campaigns</div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "1.6fr 90px 1.2fr 110px 130px", fontSize: 12.5 }}>
              <div style={{ ...th, paddingLeft: 22 }}>NAME</div>
              <div style={th}>TYPE</div>
              <div style={th}>AUDIENCE</div>
              <div style={th}>STATUS</div>
              <div style={{ ...th, paddingRight: 22 }}>PERFORMANCE</div>
              {!ctx.campaigns.length && <EmptyRow span={5}>No campaigns yet — anything you send from the composer above is listed here.</EmptyRow>}
              {ctx.campaigns.map((c) => {
                const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)" };
                return (
                  <React.Fragment key={c.id}>
                    <div style={{ ...cell, paddingLeft: 22, fontWeight: 500, color: "var(--text-strong)" }}>{c.name}</div>
                    <div style={{ ...cell, color: "var(--text-muted)" }}>{c.type}</div>
                    <div style={{ ...cell, color: "var(--text-body)" }}>{c.audience}</div>
                    <div style={{ ...cell, padding: "11px 14px" }}><StBadge tone={campTone(c.status)}>{c.status}</StBadge></div>
                    <div style={{ ...cell, padding: "13px 22px 13px 14px", color: "var(--text-muted)" }}>{c.stat}</div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const CANNED = [
  { label: "Stock update", text: "Thank you for your patience — that piece returns to your store this week. We'll notify you the moment it lands." },
  { label: "Delivery ETA", text: "Your order is on schedule — our rider will call ahead on the day of delivery." },
  { label: "Warm thanks", text: "This made our day — thank you for letting us be part of your trail. 💜" },
];

export function Inquiries({ ctx }) {
  const [selId, setSelId] = useState(null);
  const [reply, setReply] = useState("");
  const inqs = ctx.inquiries;
  const sel = inqs.find((q) => q.id === selId) || inqs[0];
  const threadRef = useRef(null);
  // Extracted so the deps are statically checkable (scroll to the newest reply).
  const selKey = sel ? sel.id : null;
  const threadLen = sel ? sel.thread.length : 0;
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [selKey, threadLen]);
  useEffect(() => {
    const t = setInterval(ctx.loadInquiries, 20000); // pick up new storefront chats
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Archiving is the master account's call, so the control only exists there.
  const archiveToggle = (
    <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--border-hairline)" }}>
      {[["live", false, ctx.inqCounts.live], ["archived", true, ctx.inqCounts.archived]].map(([label, val, n]) => {
        const on = ctx.showArchived === val;
        return (
          <button key={label} onClick={() => { ctx.setShowArchived(val); ctx.loadInquiries(val); setSelId(null); }}
            style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 500, padding: "5px 12px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)", textTransform: "capitalize" }}>
            {label} · {n}
          </button>
        );
      })}
    </div>
  );

  if (!sel) {
    return (
      <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        <div style={card}>
          {ctx.isSuper && archiveToggle}
          <div style={{ padding: "20px", fontSize: 13, color: "var(--text-muted)" }}>
            {ctx.showArchived ? "Nothing archived yet." : "No conversations yet — the inbox is quietly empty."}
          </div>
        </div>
        <div />
      </main>
    );
  }
  const chBadge = (ch) => ch === "WhatsApp" ? { bg: "#e4efe4", fg: "#3f6b45" } : ch === "Email" ? { bg: "var(--surface-sunken)", fg: "var(--mr-purple-800)" } : { bg: "var(--mr-gold-200)", fg: "var(--mr-gold-600)" };
  const send = async () => {
    if (!reply.trim()) return;
    const text = reply.trim();
    setReply("");
    ctx.setInquiries((cur) => cur.map((q) => (q.id === sel.id ? { ...q, thread: q.thread.concat({ from: "us", text }) } : q)));
    try {
      await api.post(`/api/admin/inquiries/${sel.id}/reply`, { text }, ctx.token);
      ctx.loadInquiries();
    } catch (e) { ctx.authFail(e); }
  };
  const toggleResolve = async () => {
    const status = sel.status === "Resolved" ? "Open" : "Resolved";
    try {
      await api.post(`/api/admin/inquiries/${sel.id}/status`, { status }, ctx.token);
      ctx.loadInquiries();
    } catch (e) { ctx.authFail(e); }
  };
  const archive = async (on) => {
    try {
      await api.post(`/api/admin/inquiries/${sel.id}/archive`, { archived: on }, ctx.token);
      setSelId(null);
      ctx.loadInquiries();
      ctx.flash(on ? "Conversation archived" : "Conversation restored");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };
  const openCount = inqs.filter((q) => q.status !== "Resolved").length;
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start", height: "calc(100vh - 62px)", boxSizing: "border-box" }}>
      <div style={{ ...card, overflowY: "auto", maxHeight: "100%" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{ctx.showArchived ? "Archive" : "Inbox"}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ctx.showArchived ? `${inqs.length} archived` : `${openCount} open`}</span>
        </div>
        {ctx.isSuper && archiveToggle}
        {inqs.map((q) => {
          const on = sel.id === q.id;
          const ch = chBadge(q.channel);
          const st = statusBadge(q.status === "Resolved" ? "good" : q.status === "Pending" ? "warn" : "mute");
          return (
            <button key={q.id} onClick={() => { setSelId(q.id); setReply(""); }} style={{ display: "block", width: "100%", textAlign: "left", fontFamily: "var(--font-sans)", border: "none", cursor: "pointer", padding: "14px 20px", background: on ? "var(--mr-lavender-200)" : "var(--surface-card)", borderBottom: "1px solid var(--border-hairline)", borderLeft: `3px solid ${on ? "var(--accent-gold)" : "transparent"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{q.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{q.time}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-body)", marginBottom: 6 }}>{q.subject}</div>
              <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: ch.bg, color: ch.fg }}>{q.channel}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: "var(--radius-pill)", marginLeft: 6, background: st.bg, color: st.fg }}>{q.status}</span>
            </button>
          );
        })}
      </div>
      <div style={{ ...card, display: "flex", flexDirection: "column", maxHeight: "100%", overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{sel.subject}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sel.name} · {sel.channel} · {sel.city}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleResolve}>{sel.status === "Resolved" ? "Reopen" : "Mark resolved"}</Button>
          {ctx.isSuper && (
            <Button variant="ghost" size="sm" onClick={() => archive(!sel.archived)}>{sel.archived ? "Restore" : "Archive"}</Button>
          )}
        </div>
        <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          {sel.thread.map((m, i) => (
            <div key={i} style={{ maxWidth: "78%", padding: "11px 15px", borderRadius: 14, fontSize: 13, lineHeight: 1.55, alignSelf: m.from === "us" ? "flex-end" : "flex-start", background: m.from === "us" ? "var(--mr-purple-900)" : "var(--mr-lavender-200)", color: m.from === "us" ? "var(--mr-cream)" : "var(--mr-purple-900)" }}>{m.text}</div>
          ))}
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border-hairline)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {CANNED.map((c) => (
              <button key={c.label} onClick={() => setReply(c.text)} style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 11.5, padding: "5px 12px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-hairline)", background: "var(--surface-sunken)", color: "var(--mr-purple-800)" }}>{c.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply as the house…" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, padding: "11px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)" }} />
            <Button variant="primary" onClick={send}>Send</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SettingsPage({ ctx }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (ctx.settingsData && !form) setForm({ ...ctx.settingsData.settings });
  }, [ctx.settingsData]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!form) return <main style={{ padding: "26px 28px" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Fetching the house rules…</span></main>;
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false); };
  const save = async () => {
    try {
      await api.put("/api/admin/settings", { settings: form }, ctx.token);
      setSaved(true);
      ctx.flash("Settings saved");
      ctx.loadSettings();
    } catch (e) { ctx.authFail(e); }
  };
  const section = { ...card, padding: 24, display: "flex", flexDirection: "column", gap: 16 };
  const sectionHead = (title, sub) => (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 960 }}>
      {saved && (
        <div style={{ background: "#e4efe4", border: "1px solid #c7ddc7", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: 13, color: "#3f6b45" }}>
          Saved — quietly. These now drive the storefront; reload the storefront to see the changes.
        </div>
      )}
      <div style={section}>
        {sectionHead("Storefront text", "The top announcement bar and the homepage hero copy.")}
        <Input label="Announcement bar" value={form.announcement || ""} onChange={set("announcement")} />
        <Textarea label="Hero headline" value={form.heroHeadline || ""} onChange={set("heroHeadline")} rows={2} hint="A line break shows as two lines on the storefront." />
        <Textarea label="Hero subtext" value={form.heroSub || ""} onChange={set("heroSub")} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Homepage layout" value={form.heroDirection || "editorial split"} onChange={set("heroDirection")}>
            <option value="editorial split">Editorial split (image + copy)</option>
            <option value="royal statement">Royal statement (full-bleed)</option>
            <option value="product-led">Product-led (top picks)</option>
          </Select>
          <Select label="Default city" value={form.defaultCity || (ctx.openStores[0] || {}).id || ""} onChange={set("defaultCity")}>
            {ctx.openStores.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
          </Select>
        </div>
        <Switch label="Show the first-order pop-up to new visitors" checked={form.promoPopup ?? true} onChange={(e) => { setForm({ ...form, promoPopup: e.target.checked }); setSaved(false); }} />
      </div>
      <div style={section}>
        {sectionHead("Shelves & social proof", "What the header's shelves read from, and whether shoppers see live purchases.")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="A product is “new” for (days)" value={form.newArrivalDays ?? ""} onChange={set("newArrivalDays")} placeholder="45"
            hint="After this it drops off New arrivals — unless you pin it on the product." />
          <Input label="Best sellers counted over (days)" value={form.bestSellerDays ?? ""} onChange={set("bestSellerDays")} placeholder="90"
            hint="Only paid, uncancelled orders count." />
        </div>
        <Switch label="Show live purchases to shoppers" checked={form.purchasePopups ?? true} onChange={(e) => { setForm({ ...form, purchasePopups: e.target.checked }); setSaved(false); }} />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -6, lineHeight: 1.6 }}>
          A small note in the corner — “Dorothy from Abuja purchased Osk 30ml”. Built from real paid orders; only a first name and city ever leave the server.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Look back over (days)" value={form.purchasePopupDays ?? ""} onChange={set("purchasePopupDays")} placeholder="30" />
          <Input label="Seconds between notes" value={form.purchasePopupIntervalMs ? Math.round(form.purchasePopupIntervalMs / 1000) : ""}
            onChange={(e) => { setForm({ ...form, purchasePopupIntervalMs: (parseInt(e.target.value, 10) || 0) * 1000 }); setSaved(false); }} placeholder="14" />
        </div>
      </div>
      <div style={section}>
        {sectionHead("Blog & reviews", "The headings above the blog and the testimonials wall.")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Blog heading" value={form.blogHeadline || ""} onChange={set("blogHeadline")} placeholder="The blog" />
          <Input label="Reviews heading" value={form.reviewsHeadline || ""} onChange={set("reviewsHeadline")} placeholder="Reviews & testimonials" />
        </div>
        <Textarea label="Blog intro" value={form.blogIntro || ""} onChange={set("blogIntro")} rows={2} />
        <Textarea label="Reviews intro" value={form.reviewsIntro || ""} onChange={set("reviewsIntro")} rows={2} />
      </div>
      <StoresSection ctx={ctx} />
      <div style={{ ...section, gap: 14 }}>
        {sectionHead("Contact details", "Shown on the Contact page and in the concierge.")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="WhatsApp / phone" value={form.contactPhone || ""} onChange={set("contactPhone")} />
          <Input label="Email" value={form.contactEmail || ""} onChange={set("contactEmail")} />
        </div>
        <Input label="Support hours" value={form.contactHours || ""} onChange={set("contactHours")} />
        <Input
          label="Bank transfer details"
          value={form.bankDetails || ""}
          onChange={set("bankDetails")}
          placeholder="Majestic Roobee — 0123456789, Providus Bank"
          hint="Shown to shoppers who choose bank transfer. Leave empty and we'll ask them to contact you instead."
        />
      </div>
      <div style={{ ...section, gap: 14 }}>
        {sectionHead("Footer", "Tagline and the Instagram link in the storefront footer.")}
        <Textarea label="Footer tagline" value={form.footerTagline || ""} onChange={set("footerTagline")} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Instagram URL" value={form.igUrl || ""} onChange={set("igUrl")} />
          <Input label="Instagram handle" value={form.igHandle || ""} onChange={set("igHandle")} />
        </div>
      </div>
      <div style={section}>
        {sectionHead("SEO", "How the store appears in search results and when shared. Product pages generate their own tags automatically.")}
        <Input label="Site name" value={form.siteName || ""} onChange={set("siteName")} placeholder="Majestic Roobee" />
        <Textarea label="Default meta description" value={form.metaDescription || ""} onChange={set("metaDescription")} rows={2} hint="Used on the homepage and as a fallback (aim for 150–160 characters)." />
        <Input label="Social share image URL" value={form.ogImage || ""} onChange={set("ogImage")} placeholder="https://…/share.jpg" hint="Shown when a link is shared on WhatsApp, Instagram, X, etc." />
      </div>

      <div style={section}>
        {sectionHead("Marketing & analytics", "Paste your measurement IDs — tags load only after a shopper accepts cookies on the storefront. Leave blank to disable.")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Google Analytics 4 ID" value={form.ga4Id || ""} onChange={set("ga4Id")} placeholder="G-XXXXXXX" />
          <Input label="Microsoft Clarity ID" value={form.clarityId || ""} onChange={set("clarityId")} placeholder="abcdefghij" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Google Ads ID" value={form.googleAdsId || ""} onChange={set("googleAdsId")} placeholder="AW-XXXXXXXXX" />
          <Input label="Google Ads purchase label" value={form.googleAdsPurchaseLabel || ""} onChange={set("googleAdsPurchaseLabel")} placeholder="conversion label" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Meta (Facebook) Pixel ID" value={form.metaPixelId || ""} onChange={set("metaPixelId")} placeholder="1234567890" />
          <Input label="TikTok Pixel ID" value={form.tiktokPixelId || ""} onChange={set("tiktokPixelId")} placeholder="CXXXXXXXXXXXX" />
        </div>
        <Input label="Google Search Console verification" value={form.gscVerification || ""} onChange={set("gscVerification")} placeholder="google-site-verification token" hint="From the 'HTML tag' method — paste only the content token. Or verify via your linked Google Analytics / DNS instead." />
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Button variant="gold" onClick={save}>Save changes</Button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saved to the store database — the storefront reads the same settings.</span>
      </div>
    </main>
  );
}

// Stores are data: opening one gives it stock rows for every size in the
// catalogue, and closing one keeps its order history readable. Only a super
// admin can do either — a store is inventory, staff and routing at once.
function StoresSection({ ctx }) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const blank = { city: "", store: "", address: "", eta: "1–2 days", phone: "", hours: "", mapsUrl: "", shipNGN: "2500", shipUSD: "4" };

  const startEdit = (l) => { setErr(""); setAdding(false); setEditId(l.id); setDraft({ ...l, shipNGN: String(l.shipNGN), shipUSD: String(l.shipUSD) }); };
  const startAdd = () => { setErr(""); setEditId(null); setAdding(true); setDraft({ ...blank }); };
  const cancel = () => { setEditId(null); setAdding(false); setDraft(null); setErr(""); };
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (adding) await api.post("/api/admin/locations", draft, ctx.token);
      else await api.patch(`/api/admin/locations/${encodeURIComponent(editId)}`, draft, ctx.token);
      ctx.loadLocations(); ctx.loadSettings(); ctx.loadProducts();
      ctx.flash(adding ? "Store opened" : "Store updated");
      cancel();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const setActive = async (l, active) => {
    try {
      await api.patch(`/api/admin/locations/${encodeURIComponent(l.id)}`, { active }, ctx.token);
      ctx.loadLocations();
      ctx.flash(active ? `${l.city} reopened` : `${l.city} closed`);
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const remove = async (l) => {
    const warning = l.orders
      ? `${l.city} has fulfilled ${l.orders} order${l.orders === 1 ? "" : "s"}, so it will be closed rather than deleted — the history stays. Continue?`
      : `Remove ${l.city} — ${l.store}? Its stock rows go with it. Products and orders are untouched.`;
    if (!window.confirm(warning)) return;
    try {
      const r = await api.del(`/api/admin/locations/${encodeURIComponent(l.id)}`, ctx.token);
      ctx.loadLocations(); ctx.loadSettings(); ctx.loadProducts();
      ctx.flash(r.closed ? `${l.city} closed` : `${l.city} removed`);
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const section = { ...card, padding: 24, display: "flex", flexDirection: "column", gap: 14 };
  const form = (
    <div style={{ border: "1px solid var(--mr-purple-600)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{adding ? "Open a store" : `Edit ${draft ? draft.city : ""}`}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="City" value={draft ? draft.city : ""} onChange={set("city")} placeholder="Port Harcourt" />
        <Input label="Store name" value={draft ? draft.store : ""} onChange={set("store")} placeholder="GRA Store" />
      </div>
      <Input label="Address" value={draft ? draft.address : ""} onChange={set("address")} placeholder="Street, area, city" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Phone" value={draft ? draft.phone : ""} onChange={set("phone")} placeholder="+234 …" />
        <Input label="Delivery ETA" value={draft ? draft.eta : ""} onChange={set("eta")} placeholder="1–2 days" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Delivery fee (₦)" value={draft ? draft.shipNGN : ""} onChange={set("shipNGN")} placeholder="2500" hint="Charged when this store ships to its own city." />
        <Input label="Delivery fee ($)" value={draft ? draft.shipUSD : ""} onChange={set("shipUSD")} placeholder="4" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Opening hours" value={draft ? draft.hours || "" : ""} onChange={set("hours")} placeholder="Mon–Sat, 9am–7pm" hint="Shown on the Locations page." />
        <Input label="Map link" value={draft ? draft.mapsUrl || "" : ""} onChange={set("mapsUrl")} placeholder="https://maps.app.goo.gl/…" hint="Becomes the “Get directions” link." />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : adding ? "Open this store" : "Save changes"}</Button>
        <button onClick={cancel} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-muted)" }}>Cancel</button>
      </div>
      {adding && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Every size in the catalogue gets a stock row here at zero — set the real counts in Inventory.</div>}
      {err && <div style={{ fontSize: 12, color: "#c0587a" }}>{err}</div>}
    </div>
  );

  return (
    <div style={section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Stores</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Every store here holds stock, ships orders and can have staff scoped to it. Shoppers pick one of the open stores as their city.
          </div>
        </div>
        {ctx.isSuper && !adding && <Button variant="secondary" size="sm" onClick={startAdd}>Add a store</Button>}
      </div>

      {adding && form}

      {ctx.locations.map((l) => (
        <div key={l.id} style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", flexDirection: "column", gap: 10, opacity: l.active ? 1 : 0.6 }}>
          {editId === l.id ? form : (
            <>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>
                    {l.city}{!l.active && " · closed"}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginTop: 3 }}>{l.store}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{l.address}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {l.phone} · {l.eta} · {fmtN(l.shipNGN)} delivery
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--text-muted)" }}>
                  <div>{(l.units || 0).toLocaleString()} units</div>
                  <div>{l.orders || 0} orders</div>
                  <div>{l.staff || 0} staff</div>
                </div>
              </div>
              {ctx.isSuper && (
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => startEdit(l)} style={storeLink}>Edit →</button>
                  <button onClick={() => setActive(l, !l.active)} style={storeLink}>{l.active ? "Close temporarily" : "Reopen"}</button>
                  <button onClick={() => remove(l)} style={{ ...storeLink, color: "#c0587a", marginLeft: "auto" }}>Remove</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {!ctx.isSuper && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Only a super admin can open, edit or close a store.</div>}
    </div>
  );
}
