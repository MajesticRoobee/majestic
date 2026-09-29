// Admin — the daily deal: the countdown card at the top right of the home page.
//
// A deal (Deals tab) is a shelf that runs for days. A daily deal is one piece,
// one price and one clock, and the house queues them ahead — today's, tomorrow's
// — so this screen is a schedule rather than a single form. Whichever window
// contains right now is what shoppers see.
//
// The price set here is the price charged: worker/shop.js lays it over the
// catalogue before the storefront reads a row, so the card, the grid, the cart
// and the Paystack charge cannot disagree.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch } from "../ds/components.jsx";
import { fmtN } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };
const pageStyle = { padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" };

// Windows are wall-clock WAT ('2026-09-04T18:00'), which is also exactly what
// <input type="datetime-local"> reads and writes. Arithmetic treats that string
// as UTC — safe, because West Africa Time has no daylight saving, so adding a
// day is always adding 24 hours.
const WAT_MS = 60 * 60 * 1000;
const watParse = (s) => Date.parse(String(s || "").slice(0, 16) + ":00Z");
const watFmt = (ms) => new Date(ms).toISOString().slice(0, 16);
const midnightAfter = (wat) => watParse(String(wat).slice(0, 10) + "T00:00") + 86400000;
// A real epoch moment read back as WAT wall-clock, the form every label uses.
const watOf = (ms) => watFmt(ms + WAT_MS);

const STATE_TONE = {
  Running: { bg: "#e4efe4", fg: "#3f6b45" },
  Upcoming: { bg: "var(--mr-lavender-200)", fg: "var(--mr-purple-800)" },
  Finished: { bg: "var(--surface-sunken)", fg: "var(--text-muted)" },
  Paused: { bg: "var(--mr-gold-200)", fg: "var(--mr-gold-600)" },
  Unscheduled: { bg: "#f7e3ea", fg: "#c0587a" },
};

function StateChip({ state }) {
  const tone = STATE_TONE[state] || STATE_TONE.Finished;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: tone.bg, color: tone.fg }}>{state}</span>
  );
}

// "4 Sep, 18:00" — the window read back in the house's own clock.
function whenLabel(wat) {
  const ms = watParse(wat);
  if (Number.isNaN(ms)) return "—";
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// One product at a time — a daily deal that named two pieces would have no
// price to count down to.
function ProductPicker({ ctx, value, onPick }) {
  const [q, setQ] = useState("");
  const chosen = ctx.products.find((p) => p.id === value) || null;
  const matches = ctx.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>The piece</div>
      {chosen && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "var(--mr-lavender-200)", borderRadius: "var(--radius-pill)", padding: "6px 12px" }}>
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--mr-purple-900)" }}>{chosen.name}</span>
          {!chosen.live && <span style={{ fontSize: 11, color: "#c0587a" }}>draft</span>}
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
        style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)", marginBottom: 8 }} />
      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)" }}>
        {matches.slice(0, 60).map((p) => (
          <button key={p.id} onClick={() => onPick(p)} type="button"
            style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border-hairline)", border: "none", borderLeft: "none", borderRight: "none", borderTop: "none", cursor: "pointer", textAlign: "left", background: p.id === value ? "var(--surface-sunken)" : "transparent", fontFamily: "var(--font-sans)" }}>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-strong)" }}>{p.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ctx.catLabel(p.cat)}</span>
          </button>
        ))}
        {!matches.length && <div style={{ padding: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No matches.</div>}
      </div>
    </div>
  );
}

export function DailyDealsPage({ ctx }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);   // deal id, "new", or null
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState(null);
  const [cfgBusy, setCfgBusy] = useState(false);

  const load = useCallback(() => {
    if (!ctx.token) return;
    api.get("/api/admin/daily-deals", ctx.token)
      .then((r) => { setData(r); setCfg((c) => c || r.settings); })
      .catch(ctx.authFail);
  }, [ctx.token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // The house's clock, not the browser's — a manager working from London still
  // schedules in the hours their shop keeps.
  const now = (data && data.now) || watFmt(Date.now());
  const product = useMemo(
    () => (f && ctx.products.find((p) => p.id === f.productId)) || null,
    [f, ctx.products]
  );
  const variants = useMemo(() => (product ? (product.variants || []).filter((v) => v.active !== false) : []), [product]);
  const variant = variants.find((v) => String(v.id) === String(f && f.variantId)) || variants[0] || null;

  const blank = {
    productId: "", variantId: "", headline: "Daily Deal", priceNgn: "", compareAtNgn: "",
    startsAt: now, endsAt: watFmt(midnightAfter(now)), status: "Scheduled",
  };
  const open = (d) => {
    setErr("");
    setEditing(d ? d.id : "new");
    setF(d ? {
      productId: d.productId, variantId: d.variantId == null ? "" : String(d.variantId), headline: d.headline,
      priceNgn: d.priceNgn == null ? "" : String(d.priceNgn),
      compareAtNgn: d.compareAtNgn == null ? "" : String(d.compareAtNgn),
      startsAt: d.startsAt, endsAt: d.endsAt, status: d.status,
    } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    const body = {
      productId: f.productId,
      variantId: f.variantId === "" ? null : f.variantId,
      headline: f.headline,
      priceNgn: f.priceNgn === "" ? null : f.priceNgn,
      compareAtNgn: f.compareAtNgn === "" ? null : f.compareAtNgn,
      startsAt: f.startsAt, endsAt: f.endsAt, status: f.status,
    };
    try {
      if (editing === "new") await api.post("/api/admin/daily-deals", body, ctx.token);
      else await api.patch(`/api/admin/daily-deals/${editing}`, body, ctx.token);
      load();
      ctx.flash(editing === "new" ? "Daily deal scheduled" : "Daily deal updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const pauseToggle = async (d) => {
    try {
      await api.patch(`/api/admin/daily-deals/${d.id}`, { status: d.status === "Paused" ? "Scheduled" : "Paused" }, ctx.token);
      load();
      ctx.flash(d.status === "Paused" ? "Back on the schedule" : "Paused");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete the deal on "${d.productName}"?`)) return;
    try {
      await api.del(`/api/admin/daily-deals/${d.id}`, ctx.token);
      load();
      ctx.flash("Daily deal removed");
      if (editing === d.id) close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const saveCfg = async () => {
    setCfgBusy(true);
    try {
      await api.put("/api/admin/settings", { settings: cfg }, ctx.token);
      ctx.loadSettings();
      load();
      ctx.flash("Saved — the storefront reads it on its next load.");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); } finally { setCfgBusy(false); }
  };

  // Windows the house actually asks for, so nobody types four date fields to
  // put something on the front page for the afternoon.
  const preset = (label, from, to) => (
    <button key={label} type="button" onClick={() => setF((s) => ({ ...s, startsAt: from, endsAt: to }))}
      style={{ background: "var(--surface-sunken)", border: "none", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--mr-purple-800)", cursor: "pointer" }}>{label}</button>
  );
  const midnight = watFmt(midnightAfter(now));

  const deals = (data && data.dailyDeals) || [];
  const showing = data ? data.showing : null;

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontFamily: "var(--font-condensed)", fontSize: 10.5, letterSpacing: "var(--ls-eyebrow)", textTransform: "uppercase", color: "var(--accent-gold-ink)" }}>Live now</div>
          {!data ? (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>Loading…</div>
          ) : !showing ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
              None{cfg && !cfg.dailyDealOn ? " — the deal card is off." : "."}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{showing.productName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {showing.size} · until {whenLabel(watOf(showing.endsAtMs))}
                  {!showing.scheduled && " · picked automatically"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--mr-purple-900)" }}>{fmtN(showing.priceNgn)}</div>
                {showing.compareAtNgn && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "line-through" }}>{fmtN(showing.compareAtNgn)}</div>
                )}
              </div>
              {showing.off > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: "var(--radius-xs)", background: "var(--mr-purple-900)", color: "var(--mr-cream)" }}>{showing.off}% OFF</span>
              )}
            </div>
          )}
        </div>

        {data && !deals.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>Nothing scheduled</div>
          </div>
        )}

        {deals.map((d) => (
          <div key={d.id} style={{ ...card, padding: 18, opacity: d.state === "Finished" ? 0.62 : 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StateChip state={d.state} />
              {!d.productLive && <span style={{ fontSize: 11.5, color: "#c0587a" }}>The product is a draft — shoppers won&apos;t see this.</span>}
              {d.variantMissing && <span style={{ fontSize: 11.5, color: "#c0587a" }}>No active variation left on this product.</span>}
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{d.productName}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  {d.variantLabel && `${d.variantLabel} · `}{whenLabel(d.startsAt)} → {whenLabel(d.endsAt)} WAT
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--mr-purple-900)" }}>{fmtN(d.shownPriceNgn)}</div>
                {d.shownCompareAtNgn && (
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    <span style={{ textDecoration: "line-through" }}>{fmtN(d.shownCompareAtNgn)}</span> · {d.off}% off
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(d)} style={linkBtn}>Edit →</button>
              <button onClick={() => pauseToggle(d)} style={linkBtn}>{d.status === "Paused" ? "Put back on" : "Pause"}</button>
              <button onClick={() => remove(d)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 84 }}>
        <div style={{ ...card, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{editing && editing !== "new" ? "Edit daily deal" : "Schedule a daily deal"}</div>
            {editing && <button onClick={close} style={{ ...linkBtn, color: "var(--text-muted)" }}>Close</button>}
          </div>
          {!editing ? (
            <>
              <Button variant="primary" block onClick={() => open(null)}>Schedule one</Button>
            </>
          ) : (
            <>
              <ProductPicker ctx={ctx} value={f.productId} onPick={(p) => setF((s) => ({ ...s, productId: p.id, variantId: "" }))} />
              {variants.length > 1 && (
                <Select label="Variation" value={String(f.variantId || (variant ? variant.id : ""))} onChange={(e) => setF({ ...f, variantId: e.target.value })}>
                  {variants.map((v) => <option key={v.id} value={String(v.id)}>{v.size} — {fmtN(v.ngn)}</option>)}
                </Select>
              )}
              <Input label="Headline" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="Daily Deal" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Deal price (₦)" value={f.priceNgn} onChange={(e) => setF({ ...f, priceNgn: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder={variant ? String(variant.ngn) : "—"} hint="Optional" />
                <Input label="Was (₦)" value={f.compareAtNgn} onChange={(e) => setF({ ...f, compareAtNgn: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder={variant && variant.compareAtNgn ? String(variant.compareAtNgn) : "—"} hint="Optional" />
              </div>
              {variant && f.priceNgn !== "" && Number(f.priceNgn) >= (Number(f.compareAtNgn) || variant.compareAtNgn || variant.ngn) && (
                <div style={{ fontSize: 12, color: "var(--mr-gold-600)", lineHeight: 1.55 }}>
                  That isn&apos;t below the price it&apos;s compared against, so the card will show no saving.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Starts (WAT)" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
                <Input label="Ends (WAT)" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -4 }}>
                {preset("Now → midnight", now, midnight)}
                {preset("All tomorrow", midnight, watFmt(midnightAfter(midnight)))}
                {preset("Next 24 hours", now, watFmt(watParse(now) + 86400000))}
              </div>
              <Switch label="Paused" checked={f.status === "Paused"} onChange={(e) => setF({ ...f, status: e.target.checked ? "Paused" : "Scheduled" })} />
              <Button variant="primary" block disabled={busy || !f.productId} onClick={save}>
                {busy ? "Saving…" : editing === "new" ? "Schedule it" : "Save changes"}
              </Button>
              {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
            </>
          )}
        </div>

        {cfg && (
          <div style={{ ...card, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Deal card</div>
            <Switch label="Show on home page" checked={cfg.dailyDealOn} onChange={(e) => setCfg({ ...cfg, dailyDealOn: e.target.checked })} />
            <Switch label="Auto-pick a deal when none is scheduled" checked={cfg.dailyDealAuto} onChange={(e) => setCfg({ ...cfg, dailyDealAuto: e.target.checked })} />
            <Input label="Default headline" value={cfg.dailyDealHeadline} onChange={(e) => setCfg({ ...cfg, dailyDealHeadline: e.target.value })} placeholder="Daily Deal" />
            <Button variant="primary" size="sm" disabled={cfgBusy} onClick={saveCfg}>{cfgBusy ? "Saving…" : "Save"}</Button>
          </div>
        )}
      </div>
    </main>
  );
}
