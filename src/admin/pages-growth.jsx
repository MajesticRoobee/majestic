// Admin — Sales & promos, Rewards, Notifications, Customer service, Settings.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea, EmptyRow } from "../ds/components.jsx";
import { fmtN, statusBadge } from "./App.jsx";
import { ImagePicker } from "./product-form.jsx";
import { ABOUT_DEFAULTS } from "../lib/about.js";
import { CONSULT_DEFAULTS, isCalendlyUrl } from "../lib/consultation.js";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const th = { padding: "10px 14px", borderTop: "1px solid var(--border-hairline)", fontWeight: 600, color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.06em" };
const storeLink = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };
const linkish = { ...storeLink, textDecoration: "underline" };

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
      ctx.flash("Code created");
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
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 18 }}>New promo code</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Code" value={pr.code} onChange={(e) => setPr({ ...pr, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="AUGUSTROYALE" />
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
            <Input label="Starts" type="date" value={pr.start} onChange={(e) => setPr({ ...pr, start: e.target.value })} hint="Optional" />
            <Input label="Ends" type="date" value={pr.end} onChange={(e) => setPr({ ...pr, end: e.target.value })} hint="Last day" />
          </div>
          <Button variant="gold" block onClick={createPromo}>Create code</Button>
          {prErr && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{prErr}</div>}
        </div>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Promo codes</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 700, display: "grid", gridTemplateColumns: "140px 1.6fr 1fr 1fr 90px 90px", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>CODE</div>
            <div style={th}>OFFER</div>
            <div style={th}>WINDOW</div>
            <div style={th}>REDEMPTIONS</div>
            <div style={th}>STATUS</div>
            <div style={{ ...th, paddingRight: 22 }}></div>
            {!ctx.promos.length && <EmptyRow span={6}>No promo codes yet.</EmptyRow>}
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
                      <span style={{ display: "block", fontSize: 11, color: "var(--mr-gold-600)", marginTop: 3 }}>
                        Invalid end date — re-enter it
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

// ---- Rewards -------------------------------------------------------------
//
// A sale is a code everybody uses; a reward is a code one person uses once.
// This screen owns the second kind: the rule that decides what a purchase
// earns, a form for minting codes by hand, and the ledger of what has been
// issued and spent.

const REWARD_SCOPES = [
  { id: "Storewide", label: "Storewide" },
  { id: "Fragrances", label: "All fragrances" },
  { id: "Gift packages", label: "Gift packages" },
  { id: "Feminine care", label: "Feminine care" },
];

const BLANK_MINT = {
  kind: "pct", value: "10", freeVariantId: "", scope: "Storewide", minSpend: "",
  ownerContact: "", ownerName: "", expiryDays: "90", count: "1", code: "", note: "",
};

export function Rewards({ ctx }) {
  const [data, setData] = useState(null);
  const [variants, setVariants] = useState([]);
  const [rule, setRule] = useState(null);
  const [mint, setMint] = useState(BLANK_MINT);
  const [filter, setFilter] = useState({ status: "", source: "", owner: "" });
  const [err, setErr] = useState("");
  const [issued, setIssued] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
      const r = await api.get(`/api/admin/rewards${qs ? "?" + qs : ""}`, ctx.token);
      setData(r);
      // The rule form is only seeded once: re-seeding it on every refresh would
      // throw away an edit in progress the moment the table reloaded.
      setRule((cur) => cur || r.rule);
    } catch (e) { ctx.authFail(e); }
  }, [ctx, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/api/admin/rewards/variants", ctx.token).then((r) => setVariants(r.variants)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRule = async () => {
    setBusy(true);
    try {
      await api.put("/api/admin/settings", {
        settings: {
          rewardsOn: !!rule.on,
          rewardEarnKind: rule.kind,
          rewardEarnValue: parseInt(rule.value, 10) || 0,
          rewardEarnMinSpend: parseInt(rule.minSpend, 10) || 0,
          rewardEarnScope: rule.scope,
          rewardEarnExpiryDays: parseInt(rule.expiryDays, 10) || 0,
          rewardCodePrefix: (rule.prefix || "MR").toUpperCase(),
        },
      }, ctx.token);
      ctx.flash("Rewards rule saved");
      ctx.loadSettings();
    } catch (e) { ctx.authFail(e); setErr(e.message); }
    setBusy(false);
  };

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.post("/api/admin/rewards", {
        kind: mint.kind,
        value: parseInt(mint.value, 10) || 0,
        freeVariantId: mint.kind === "item" ? mint.freeVariantId || null : null,
        scope: mint.scope,
        minSpend: parseInt(mint.minSpend, 10) || 0,
        ownerContact: mint.ownerContact,
        ownerName: mint.ownerName,
        expiryDays: parseInt(mint.expiryDays, 10) || 0,
        count: parseInt(mint.count, 10) || 1,
        code: mint.code || null,
        note: mint.note,
      }, ctx.token);
      // The codes stay on screen after the form resets: a minted code that is
      // only in the database is a code nobody can give to anybody.
      setIssued(r.issued || []);
      if (r.warning) setErr(r.warning);
      setMint({ ...BLANK_MINT, kind: mint.kind, scope: mint.scope });
      ctx.flash(`${(r.issued || []).length} reward code${(r.issued || []).length === 1 ? "" : "s"} issued`);
      load();
    } catch (e) { ctx.authFail(e); setErr(e.message); }
    setBusy(false);
  };

  const act = async (code, what) => {
    try {
      await api.post(`/api/admin/rewards/${encodeURIComponent(code)}/${what}`, {}, ctx.token);
      load();
    } catch (e) { ctx.authFail(e); setErr(e.message); }
  };

  if (!data || !rule) return <main style={{ padding: "26px 28px" }}><div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading rewards…</div></main>;

  const t = data.totals;
  const stat = (label, n, note) => (
    <div key={label} style={{ ...card, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--text-strong)", marginTop: 4 }}>{n}</div>
      {note && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{note}</div>}
    </div>
  );
  const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)" };

  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {stat("Issued", t.issued)}
        {stat("Ready to use", t.active)}
        {stat("Redeemed", t.redeemed)}
        {stat("Expired unused", t.expired)}
        {stat("Discount given", fmtN(t.discountGiven))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* What a purchase earns */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 18 }}>Earn on paid orders</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Switch label="Rewards on" checked={!!rule.on}
              onChange={(e) => setRule({ ...rule, on: e.target.checked })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Reward" value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value })}>
                <option value="pct">% off next order</option>
                <option value="amt">₦ off next order</option>
                <option value="ship">Free delivery</option>
              </Select>
              <Input label="Value" value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })}
                disabled={rule.kind === "ship"} placeholder="10" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Qualifying spend (₦)" value={rule.minSpend} onChange={(e) => setRule({ ...rule, minSpend: e.target.value })}
                placeholder="0" hint="0 = any order" />
              <Input label="Expires after (days)" value={rule.expiryDays} onChange={(e) => setRule({ ...rule, expiryDays: e.target.value })}
                placeholder="90" hint="0 = never" />
            </div>
            <Select label="Spendable on" value={rule.scope} onChange={(e) => setRule({ ...rule, scope: e.target.value })}>
              {REWARD_SCOPES.map((sc) => <option key={sc.id} value={sc.id}>{sc.label}</option>)}
            </Select>
            <Input label="Code prefix" value={rule.prefix} onChange={(e) => setRule({ ...rule, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
              placeholder="MR" />
            <Button variant="primary" block disabled={busy} onClick={saveRule}>Save rule</Button>
          </div>
        </div>

        {/* Minting by hand */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 18 }}>Issue reward codes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Reward" value={mint.kind} onChange={(e) => setMint({ ...mint, kind: e.target.value })}>
                <option value="pct">% off</option>
                <option value="amt">₦ off</option>
                <option value="ship">Free delivery</option>
                <option value="item">A product free</option>
              </Select>
              {mint.kind === "pct" || mint.kind === "amt"
                ? <Input label="Value" value={mint.value} onChange={(e) => setMint({ ...mint, value: e.target.value })} placeholder="10" />
                : <div />}
            </div>
            {mint.kind === "item" && (
              <Select label="Which product" value={mint.freeVariantId} onChange={(e) => setMint({ ...mint, freeVariantId: e.target.value })}>
                <option value="">Cheapest qualifying item in the cart</option>
                {variants.map((v) => <option key={v.id} value={v.id}>{v.label} — {fmtN(v.ngn)}</option>)}
              </Select>
            )}
            <Select label="Spendable on" value={mint.scope} onChange={(e) => setMint({ ...mint, scope: e.target.value })}>
              {REWARD_SCOPES.map((sc) => <option key={sc.id} value={sc.id}>{sc.label}</option>)}
            </Select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Minimum spend (₦)" value={mint.minSpend} onChange={(e) => setMint({ ...mint, minSpend: e.target.value })} placeholder="0" />
              <Input label="Expires after (days)" value={mint.expiryDays} onChange={(e) => setMint({ ...mint, expiryDays: e.target.value })} placeholder="90" />
            </div>
            <Input label="Customer email or phone (optional)" value={mint.ownerContact} onChange={(e) => setMint({ ...mint, ownerContact: e.target.value })}
              placeholder="ada@email.com" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Their name (optional)" value={mint.ownerName} onChange={(e) => setMint({ ...mint, ownerName: e.target.value })} placeholder="Ada Nwosu" />
              <Input label="How many" value={mint.count} onChange={(e) => setMint({ ...mint, count: e.target.value })} placeholder="1" hint="Max 200" />
            </div>
            <Input label="Name the code (optional)" value={mint.code} onChange={(e) => setMint({ ...mint, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
              placeholder="SORRYADA" />
            <Input label="Note (optional)" value={mint.note} onChange={(e) => setMint({ ...mint, note: e.target.value })} placeholder="Late delivery, order MR-10412" />
            <Button variant="gold" block disabled={busy} onClick={create}>Issue</Button>
            {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
            {issued.length > 0 && (
              <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 8 }}>NEW CODES</div>
                <div style={{ fontFamily: "var(--font-condensed)", fontSize: 13.5, color: "var(--mr-purple-900)", lineHeight: 1.9, wordBreak: "break-all" }}>
                  {issued.map((i) => i.code).join("  ·  ")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", flex: 1 }}>Reward codes</div>
          <Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="active">Ready to use</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
            <option value="void">Void</option>
          </Select>
          <Select value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
            <option value="">All sources</option>
            <option value="purchase">Earned</option>
            <option value="manual">Issued</option>
          </Select>
          <Input value={filter.owner} onChange={(e) => setFilter({ ...filter, owner: e.target.value })} placeholder="Find a customer" />
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900, display: "grid", gridTemplateColumns: "150px 1.3fr 1.4fr 1fr 110px 110px 90px", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>CODE</div>
            <div style={th}>WORTH</div>
            <div style={th}>WHO</div>
            <div style={th}>SOURCE</div>
            <div style={th}>EXPIRES</div>
            <div style={th}>STATUS</div>
            <div style={{ ...th, paddingRight: 22 }}></div>
            {!data.rewards.length && (
              <EmptyRow span={7}>
                No reward codes.
              </EmptyRow>
            )}
            {data.rewards.map((r) => {
              const state = r.status === "Redeemed" ? "Redeemed" : r.status === "Void" ? "Void" : r.expired ? "Expired" : "Ready";
              const tone = state === "Ready" ? "good" : state === "Redeemed" ? "mute" : state === "Expired" ? "warn" : "mute";
              return (
                <React.Fragment key={r.code}>
                  <div style={{ ...cell, paddingLeft: 22, fontWeight: 600, color: "var(--mr-purple-800)", letterSpacing: "0.04em", wordBreak: "break-all" }}>{r.code}</div>
                  <div style={{ ...cell, color: "var(--text-strong)" }}>
                    {r.desc}
                    <span style={{ color: "var(--text-muted)" }}> · {r.scope}</span>
                    {r.minSpend > 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Over {fmtN(r.minSpend)}</div>}
                  </div>
                  <div style={{ ...cell, color: "var(--text-body)" }}>
                    {r.owner ? <>{r.ownerName || r.owner}{r.ownerName && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.owner}</div>}</>
                      : <span style={{ color: "var(--text-muted)" }}>Anyone</span>}
                  </div>
                  <div style={{ ...cell, color: "var(--text-muted)", fontSize: 12 }}>
                    {r.source === "purchase" ? `Earned on ${r.earnedOn}` : `Issued by ${r.issuedBy || "the team"}`}
                    {r.redeemedOn && <div>Spent on {r.redeemedOn}</div>}
                    {r.note && !r.redeemedOn && <div>{r.note}</div>}
                  </div>
                  <div style={{ ...cell, color: "var(--text-muted)" }}>{r.expiresAt || "Never"}</div>
                  <div style={{ ...cell, padding: "11px 14px" }}><StBadge tone={tone}>{state}</StBadge></div>
                  <div style={{ ...cell, padding: "11px 22px 11px 14px" }}>
                    {r.status === "Active" && (
                      <button onClick={() => act(r.code, "void")} style={storeLink}>Void</button>
                    )}
                    {r.status === "Void" && (
                      <button onClick={() => act(r.code, "restore")} style={storeLink}>Restore</button>
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
      ctx.flash(def.kind === "Email" ? "Sent" : def.kind === "Push" ? "Scheduled" : "Published");
      ctx.loadCampaigns();
      if (def.kind === "Banner") ctx.loadSettings();
    } catch (e) { ctx.authFail(e); }
  };
  const campTone = (status) => (status === "Live" ? "good" : status === "Scheduled" ? "warn" : "mute");
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, alignItems: "start" }}>
      <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 18 }}>New campaign</div>
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
            {nType === "email" ? "Send" : nType === "push" ? "Schedule" : "Publish"}
          </Button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Preview</div>
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
              <div style={{ background: "var(--surface-sunken)", padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>To: {f.aud} · From: Majestic Roobee &lt;hello@majesticroobee.shop&gt;</div>
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
              {!ctx.campaigns.length && <EmptyRow span={5}>No campaigns yet.</EmptyRow>}
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
            {ctx.showArchived ? "Nothing archived." : "No messages."}
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
            <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a reply…" style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 13, padding: "11px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)" }} />
            <Button variant="primary" onClick={send}>Send</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

// Which settings belong to which panel. The endpoint patches whatever keys it
// is handed, so a panel can save its own without touching anything else — and
// nobody has to scroll to the foot of the page to keep one edit.
const SECTION_KEYS = {
  brand: ["logoUrl", "logoLightUrl", "founderImage"],
  // The portrait is in both panels on purpose: it belongs to the brand mark and
  // it is the photograph at the head of the About page, and the form is one
  // object either way, so saving from either panel keeps it.
  about: ["aboutEyebrow", "aboutHeadline", "aboutIntro", "storyTitle", "storyBody",
    "founderName", "founderRole", "founderImage", "aboutStoresOn",
    "aboutCtaTitle", "aboutCtaSub", "aboutCtaLabel", "aboutSeoTitle", "aboutSeoDesc"],
  storefront: ["announcement", "heroHeadline", "heroSub", "heroEyebrow", "heroImage", "heroDirection", "defaultCity", "promoPopup"],
  shelves: ["newArrivalDays", "bestSellerDays", "purchasePopups", "purchasePopupHours", "purchasePopupIntervalMs"],
  inventory: ["lowStockThreshold", "lowStockMode", "lowStockCoverDays", "lowStockVelocityDays", "lowStockAlerts", "lowStockOnStorefront"],
  insights: ["insightsOn", "insightsRetainDays", "abandonAfterMins"],
  convert: ["nudgeOn", "nudgeTitle", "nudgeBody", "nudgeCta", "nudgeCode", "nudgeEveryDays",
    "promoPopupWhen", "recentlyViewedOn", "alsoViewedOn"],
  editorial: ["blogHeadline", "reviewsHeadline", "blogIntro", "reviewsIntro"],
  consult: ["consultOn", "consultCalendlyUrl", "consultEyebrow", "consultHeadline", "consultIntro",
    "consultBody", "consultCtaLabel", "consultImage", "consultSeoTitle", "consultSeoDesc"],
  contact: ["contactPhone", "contactEmail", "contactHours", "bankDetails"],
  footer: ["footerTagline", "igUrl", "igHandle", "tiktokUrl", "facebookUrl"],
  seo: ["siteName", "siteUrl", "metaDescription", "ogImage"],
  analytics: ["ga4Id", "clarityId", "googleAdsId", "googleAdsPurchaseLabel", "metaPixelId", "tiktokPixelId", "gscVerification"],
};

export function SettingsPage({ ctx }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    if (ctx.settingsData && !form) setForm({ ...ctx.settingsData.settings });
  }, [ctx.settingsData]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!form) return <main style={{ padding: "26px 28px" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</span></main>;
  const touch = (patch) => { setForm({ ...form, ...patch }); setSaved(""); };
  const set = (k) => (e) => touch({ [k]: e.target.value });

  // `id` names the panel being saved, or "all" for the button at the foot.
  const save = async (id, keys) => {
    setBusy(id);
    try {
      const patch = {};
      for (const k of keys) if (form[k] !== undefined) patch[k] = form[k];
      await api.put("/api/admin/settings", { settings: patch }, ctx.token);
      setSaved(id);
      ctx.flash("Settings saved");
      ctx.loadSettings();
    } catch (e) { ctx.authFail(e); } finally { setBusy(""); }
  };

  const section = { ...card, padding: 24, display: "flex", flexDirection: "column", gap: 16 };
  const sectionHead = (title) => (
    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
  );
  // Every panel carries its own save, so one edit never means scrolling past
  // six others to keep it.
  const sectionSave = (id) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--border-hairline)", paddingTop: 14 }}>
      <Button variant="primary" size="sm" disabled={busy === id} onClick={() => save(id, SECTION_KEYS[id])}>
        {busy === id ? "Saving…" : "Save"}
      </Button>
      {saved === id && <span style={{ fontSize: 12.5, color: "#3f6b45" }}>Saved</span>}
    </div>
  );
  // An empty box means "keep the shipped copy", which is right — but it also
  // leaves someone who only wants to change one sentence retyping six hundred
  // words. This drops them into the box to edit, and clears back to empty.
  const fillFrom = (key, shipped) => (
    <div style={{ display: "flex", gap: 14, marginTop: -8 }}>
      <button type="button" style={linkish}
        onClick={() => {
          // Clearing throws away whatever is in the box, so it asks first; the
          // other direction only fills an empty one and needs no ceremony.
          if (form[key] && !window.confirm("Clear this text?")) return;
          touch({ [key]: form[key] ? "" : shipped });
        }}>
        {form[key] ? "Reset to default" : "Edit default text"}
      </button>
    </div>
  );
  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 960 }}>
      <div style={section}>
        {sectionHead("Brand mark")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ImagePicker ctx={ctx} label="Logo" value={form.logoUrl || ""} onChange={(url) => touch({ logoUrl: url })}
            hint="Transparent PNG or SVG" />
          <ImagePicker ctx={ctx} label="Logo — light version" value={form.logoLightUrl || ""} onChange={(url) => touch({ logoLightUrl: url })}
            hint="For the dark footer" />
        </div>
        <ImagePicker ctx={ctx} label="Founder's portrait" value={form.founderImage || ""} onChange={(url) => touch({ founderImage: url })}
 />
        {sectionSave("brand")}
      </div>
      <div style={section}>
        {sectionHead("Storefront text")}
        <Input label="Announcement bar" value={form.announcement || ""} onChange={set("announcement")} />
        <Input label="Line above the hero headline" value={form.heroEyebrow || ""} onChange={set("heroEyebrow")}
          placeholder="Optional" />
        <Textarea label="Hero headline" value={form.heroHeadline || ""} onChange={set("heroHeadline")} rows={2} />
        <Textarea label="Hero subtext" value={form.heroSub || ""} onChange={set("heroSub")} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Homepage layout" value={form.heroDirection || "storefront grid"} onChange={set("heroDirection")}>
            <option value="storefront grid">Storefront grid (banner, tiles + daily deal)</option>
            <option value="editorial split">Editorial split (image + copy)</option>
            <option value="royal statement">Royal statement (full-bleed)</option>
            <option value="product-led">Product-led (top picks)</option>
          </Select>
          <Select label="Default city" value={form.defaultCity || (ctx.openStores[0] || {}).id || ""} onChange={set("defaultCity")}>
            {ctx.openStores.map((l) => <option key={l.id} value={l.id}>{l.city}</option>)}
          </Select>
        </div>
        <ImagePicker ctx={ctx} label="Hero image (optional)" value={form.heroImage || ""} onChange={(url) => touch({ heroImage: url })}
          hint="Wide image" />
        <Switch label="First-order pop-up" checked={form.promoPopup ?? true} onChange={(e) => touch({ promoPopup: e.target.checked })} />
        {sectionSave("storefront")}
      </div>
      <div style={section}>
        {sectionHead("About page")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 12 }}>
          <Input label="Line above the heading" value={form.aboutEyebrow || ""} onChange={set("aboutEyebrow")} placeholder={ABOUT_DEFAULTS.eyebrow} />
          <Input label="Heading" value={form.aboutHeadline || ""} onChange={set("aboutHeadline")} placeholder={ABOUT_DEFAULTS.headline} />
        </div>
        <Textarea label="Who we are" value={form.aboutIntro || ""} onChange={set("aboutIntro")} rows={7}
          placeholder="Default text"
          hint="Blank line between paragraphs. ## for a heading." />
        {fillFrom("aboutIntro", ABOUT_DEFAULTS.intro)}
        <ImagePicker ctx={ctx} label="Founder's portrait" value={form.founderImage || ""} onChange={(url) => touch({ founderImage: url })}
 />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Whose story it is" value={form.founderName || ""} onChange={set("founderName")} placeholder={ABOUT_DEFAULTS.founderName} />
          <Input label="Their title" value={form.founderRole || ""} onChange={set("founderRole")} placeholder={ABOUT_DEFAULTS.founderRole} />
        </div>
        <Input label="Story heading" value={form.storyTitle || ""} onChange={set("storyTitle")} placeholder={ABOUT_DEFAULTS.storyTitle} />
        <Textarea label="The story in full" value={form.storyBody || ""} onChange={set("storyBody")} rows={14}
          placeholder="Default text"
          hint="Blank line between paragraphs." />
        {fillFrom("storyBody", ABOUT_DEFAULTS.story)}
        <Switch label="Show the stores on this page" checked={form.aboutStoresOn ?? true} onChange={(e) => touch({ aboutStoresOn: e.target.checked })} />
        <Input label="Closing band — heading" value={form.aboutCtaTitle || ""} onChange={set("aboutCtaTitle")} placeholder={ABOUT_DEFAULTS.ctaTitle} />
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
          <Input label="Closing band — line under it" value={form.aboutCtaSub || ""} onChange={set("aboutCtaSub")} placeholder={ABOUT_DEFAULTS.ctaSub} />
          <Input label="Closing band — button" value={form.aboutCtaLabel || ""} onChange={set("aboutCtaLabel")} placeholder={ABOUT_DEFAULTS.ctaLabel} />
        </div>
        <Input label="Search result — title" value={form.aboutSeoTitle || ""} onChange={set("aboutSeoTitle")} placeholder={ABOUT_DEFAULTS.seoTitle} />
        <Textarea label="Search result — description" value={form.aboutSeoDesc || ""} onChange={set("aboutSeoDesc")} rows={3} placeholder={ABOUT_DEFAULTS.seoDesc}
          hint="About 155 characters" />
        {sectionSave("about")}
      </div>
      <div style={section}>
        {sectionHead("Shelves & purchase notes")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="A product is “new” for (days)" value={form.newArrivalDays ?? ""} onChange={set("newArrivalDays")} placeholder="45"
 />
          <Input label="Best sellers counted over (days)" value={form.bestSellerDays ?? ""} onChange={set("bestSellerDays")} placeholder="90" />
        </div>
        <Switch label="Show recent purchase notes" checked={form.purchasePopups ?? true} onChange={(e) => touch({ purchasePopups: e.target.checked })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Purchases from the last (hours)" value={form.purchasePopupHours ?? ""} onChange={set("purchasePopupHours")} placeholder="48" />
          <Input label="Seconds between notes" value={form.purchasePopupIntervalMs ? Math.round(form.purchasePopupIntervalMs / 1000) : ""}
            onChange={(e) => touch({ purchasePopupIntervalMs: (parseInt(e.target.value, 10) || 0) * 1000 })} placeholder="14" />
        </div>
        {sectionSave("shelves")}
      </div>
      <InventorySection ctx={ctx} form={form} touch={touch} set={set} section={section} sectionHead={sectionHead} sectionSave={sectionSave} />
      <div style={section}>
        {sectionHead("Insights")}
        <Switch label="Track visits" checked={form.insightsOn ?? true} onChange={(e) => touch({ insightsOn: e.target.checked })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Keep visit detail (days)" value={form.insightsRetainDays ?? ""} onChange={set("insightsRetainDays")} placeholder="90" />
          <Input label="Cart abandoned after (minutes)" value={form.abandonAfterMins ?? ""} onChange={set("abandonAfterMins")} placeholder="45" />
        </div>
        {sectionSave("insights")}
      </div>
      <div style={section}>
        {sectionHead("Recommendations & pop-ups")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Switch label="Recently viewed" checked={form.recentlyViewedOn ?? true} onChange={(e) => touch({ recentlyViewedOn: e.target.checked })} />
          <Switch label="Related products" checked={form.alsoViewedOn ?? true} onChange={(e) => touch({ alsoViewedOn: e.target.checked })} />
        </div>
        <Select label="First-order pop-up shows to" value={form.promoPopupWhen || "everyone"} onChange={set("promoPopupWhen")}>
          <option value="everyone">Everyone</option>
          <option value="returning">Returning visitors only</option>
        </Select>
        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 14 }}>
          <Switch label="Exit reminder for full carts" checked={form.nudgeOn ?? false} onChange={(e) => touch({ nudgeOn: e.target.checked })} />
        </div>
        {(form.nudgeOn ?? false) && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Heading" value={form.nudgeTitle || ""} onChange={set("nudgeTitle")} placeholder="Still deciding?" />
              <Input label="Button" value={form.nudgeCta || ""} onChange={set("nudgeCta")} placeholder="Back to my cart" />
            </div>
            <Textarea label="What it says" value={form.nudgeBody || ""} onChange={set("nudgeBody")} rows={2} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Offer a code (optional)" value={form.nudgeCode || ""} onChange={set("nudgeCode")} placeholder="COMEBACK10"
                hint="Create it in Promo codes" />
              <Input label="Not again for (days)" value={form.nudgeEveryDays ?? ""} onChange={set("nudgeEveryDays")} placeholder="7" />
            </div>
          </>
        )}
        {sectionSave("convert")}
      </div>
      <div style={section}>
        {sectionHead("Blog & reviews")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Blog heading" value={form.blogHeadline || ""} onChange={set("blogHeadline")} placeholder="Blog" />
          <Input label="Reviews heading" value={form.reviewsHeadline || ""} onChange={set("reviewsHeadline")} placeholder="Reviews & testimonials" />
        </div>
        <Textarea label="Blog intro" value={form.blogIntro || ""} onChange={set("blogIntro")} rows={2} />
        <Textarea label="Reviews intro" value={form.reviewsIntro || ""} onChange={set("reviewsIntro")} rows={2} />
        {sectionSave("editorial")}
      </div>
      <div style={{ ...section, gap: 14 }}>
        {sectionHead("Consultations")}
        <Switch label="Taking bookings"
          checked={form.consultOn !== "0"} onChange={(e) => touch({ consultOn: e.target.checked ? "1" : "0" })} />
        <Input label="Calendly link" value={form.consultCalendlyUrl || ""} onChange={set("consultCalendlyUrl")}
          placeholder="https://calendly.com/majestic-roobee/consultation"
 />
        {form.consultCalendlyUrl && !isCalendlyUrl(form.consultCalendlyUrl) && (
          <div style={{ fontSize: 12, color: "#c0587a", marginTop: -8 }}>Must be a calendly.com link.</div>
        )}
        {form.consultOn !== "0" && !form.consultCalendlyUrl && (
          <div style={{ fontSize: 12, color: "var(--mr-gold-600)", marginTop: -8 }}>No Calendly link yet.</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Line above the heading" value={form.consultEyebrow || ""} onChange={set("consultEyebrow")} placeholder={CONSULT_DEFAULTS.eyebrow} />
          <Input label="Button label" value={form.consultCtaLabel || ""} onChange={set("consultCtaLabel")} placeholder={CONSULT_DEFAULTS.ctaLabel} />
        </div>
        <Input label="Heading" value={form.consultHeadline || ""} onChange={set("consultHeadline")} placeholder={CONSULT_DEFAULTS.headline} />
        <Textarea label="The line under it" value={form.consultIntro || ""} onChange={set("consultIntro")} rows={2} placeholder={CONSULT_DEFAULTS.intro} />
        <ImagePicker ctx={ctx} label="Photograph (optional)" value={form.consultImage || ""} onChange={(url) => touch({ consultImage: url })}
          hint="Wide image" />
        <Textarea label="What a consultation is" value={form.consultBody || ""} onChange={set("consultBody")} rows={10}
          placeholder={CONSULT_DEFAULTS.body}
          hint="Blank line between paragraphs. ## for a heading." />
        {fillFrom("consultBody", CONSULT_DEFAULTS.body)}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Search result title" value={form.consultSeoTitle || ""} onChange={set("consultSeoTitle")} placeholder={CONSULT_DEFAULTS.seoTitle} />
          <Input label="Search result description" value={form.consultSeoDesc || ""} onChange={set("consultSeoDesc")} placeholder={CONSULT_DEFAULTS.seoDesc} />
        </div>
        {sectionSave("consult")}
      </div>
      <StoresSection ctx={ctx} />
      <div style={{ ...section, gap: 14 }}>
        {sectionHead("Contact details")}
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
          hint="Shown at checkout for bank transfer"
        />
        {sectionSave("contact")}
      </div>
      <div style={{ ...section, gap: 14 }}>
        {sectionHead("Footer")}
        <Textarea label="Footer tagline" value={form.footerTagline || ""} onChange={set("footerTagline")} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Instagram URL" value={form.igUrl || ""} onChange={set("igUrl")} />
          <Input label="Instagram handle" value={form.igHandle || ""} onChange={set("igHandle")} />
          <Input label="TikTok URL" value={form.tiktokUrl || ""} onChange={set("tiktokUrl")} placeholder="https://tiktok.com/@majesticroobee" />
          <Input label="Facebook URL" value={form.facebookUrl || ""} onChange={set("facebookUrl")} placeholder="https://facebook.com/majesticroobee" />
        </div>
        {sectionSave("footer")}
      </div>
      <div style={section}>
        {sectionHead("SEO & sharing")}
        <Input label="Site name" value={form.siteName || ""} onChange={set("siteName")} placeholder="Majestic Roobee" />
        <Input label="Website address" value={form.siteUrl || ""} onChange={set("siteUrl")} placeholder="https://majesticroobee.shop" />
        <Textarea label="Default meta description" value={form.metaDescription || ""} onChange={set("metaDescription")} rows={2} hint="About 155 characters" />
        <ImagePicker ctx={ctx} label="Link preview image" value={form.ogImage || ""} onChange={(url) => touch({ ogImage: url })}
          hint="1200 × 630" />
        {sectionSave("seo")}
      </div>

      <div style={section}>
        {sectionHead("Analytics")}
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
        <Input label="Google Search Console verification" value={form.gscVerification || ""} onChange={set("gscVerification")} placeholder="Verification code" />
        {sectionSave("analytics")}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="gold" disabled={busy === "all"} onClick={() => save("all", Object.values(SECTION_KEYS).flat())}>
          {busy === "all" ? "Saving…" : "Save all"}
        </Button>
        {saved === "all" && <span style={{ fontSize: 12, color: "#3f6b45" }}>Saved</span>}
      </div>
    </main>
  );
}

// Where the low-stock line sits.
//
// The setting has existed since the first seed and has been saveable all along;
// no screen ever rendered it, so in practice it was five, forever, for a ₦2,000
// sample and a ₦180,000 extrait alike. Two ways to draw it now: a flat number,
// or days of cover read off what each store has actually been selling. A piece
// that needs its own line gets one on the product itself.
function InventorySection({ ctx, form, touch, set, section, sectionHead, sectionSave }) {
  const [sweeping, setSweeping] = useState("");
  const cover = form.lowStockMode === "cover";
  const counts = ctx.stockHealth ? ctx.stockHealth.counts : null;
  const sweep = async () => {
    setSweeping("…");
    try {
      const r = await api.post("/api/admin/stock/sweep", {}, ctx.token);
      const parts = [];
      if (r.out) parts.push(`${r.out} sold out`);
      if (r.low) parts.push(`${r.low} running low`);
      if (r.recovered) parts.push(`${r.recovered} restocked`);
      setSweeping(parts.length ? parts.join(", ") + (r.alerted ? " — alert sent" : "") : "No changes");
      ctx.loadStockHealth();
    } catch (e) { ctx.authFail(e); setSweeping(""); }
  };
  return (
    <div style={section}>
      {sectionHead("Low stock")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Low stock rule" value={form.lowStockMode || "flat"} onChange={set("lowStockMode")}>
          <option value="flat">Fixed number of units</option>
          <option value="cover">Days of stock left</option>
        </Select>
        <Input label={cover ? "Minimum (units)" : "Low at (units)"}
          value={form.lowStockThreshold ?? ""} onChange={set("lowStockThreshold")} placeholder="5" hint="Per store" />
      </div>
      {cover && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Low under (days of stock)" value={form.lowStockCoverDays ?? ""} onChange={set("lowStockCoverDays")} placeholder="14" />
          <Input label="Sales period (days)" value={form.lowStockVelocityDays ?? ""} onChange={set("lowStockVelocityDays")} placeholder="30" />
        </div>
      )}
      <Switch label="Low stock alerts" checked={form.lowStockAlerts ?? true} onChange={(e) => touch({ lowStockAlerts: e.target.checked })} />
      <Switch label="Show “Only X left” on products" checked={form.lowStockOnStorefront ?? true} onChange={(e) => touch({ lowStockOnStorefront: e.target.checked })} />
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Button variant="ghost" size="sm" disabled={sweeping === "…"} onClick={sweep}>{sweeping === "…" ? "Checking…" : "Check now"}</Button>
        {counts && <span>{counts.low} low, {counts.out} out</span>}
        {sweeping && sweeping !== "…" && <span style={{ color: "#3f6b45" }}>{sweeping}</span>}
      </div>
      {sectionSave("inventory")}
    </div>
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
      ? `${l.city} has orders, so it will be closed instead. Continue?`
      : `Remove ${l.city} — ${l.store}?`;
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
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{adding ? "New store" : `Edit ${draft ? draft.city : ""}`}</div>
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
        <Input label="Delivery fee (₦)" value={draft ? draft.shipNGN : ""} onChange={set("shipNGN")} placeholder="2500" hint="Same-city delivery" />
        <Input label="Delivery fee ($)" value={draft ? draft.shipUSD : ""} onChange={set("shipUSD")} placeholder="4" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Input label="Opening hours" value={draft ? draft.hours || "" : ""} onChange={set("hours")} placeholder="Mon–Sat, 9am–7pm" />
        <Input label="Map link" value={draft ? draft.mapsUrl || "" : ""} onChange={set("mapsUrl")} placeholder="https://maps.app.goo.gl/…" />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button variant="primary" size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : adding ? "Add store" : "Save"}</Button>
        <button onClick={cancel} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-muted)" }}>Cancel</button>
      </div>
      {err && <div style={{ fontSize: 12, color: "#c0587a" }}>{err}</div>}
    </div>
  );

  return (
    <div style={section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Stores</div>
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
                  <button onClick={() => startEdit(l)} style={storeLink}>Edit</button>
                  <button onClick={() => setActive(l, !l.active)} style={storeLink}>{l.active ? "Close" : "Reopen"}</button>
                  <button onClick={() => remove(l)} style={{ ...storeLink, color: "#c0587a", marginLeft: "auto" }}>Remove</button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
