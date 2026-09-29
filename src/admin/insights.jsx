// Admin — Insights.
//
// The first screen here that answers "why didn't they buy" rather than "what
// did they buy". Every number is the house's own, measured on the house's own
// site, and joinable to the house's own customers — which is what the pixels
// could never be.
import React, { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Select } from "../ds/components.jsx";
import { fmtN } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };
const eyebrow = { fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" };

const pct = (n, was) => {
  if (!was) return null;
  const d = Math.round(((n - was) / was) * 100);
  return { d, up: d >= 0 };
};
const ago = (sql) => {
  const t = Date.parse(String(sql).replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

function Kpi({ label, value, delta, note }) {
  const p = delta;
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 6, color: "var(--text-strong)" }}>{value}</div>
      {p && <div style={{ fontSize: 12, marginTop: 4, color: p.up ? "#3f6b45" : "#c0587a" }}>{p.up ? "▲" : "▼"} {Math.abs(p.d)}% on the period before</div>}
      {note && <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-muted)" }}>{note}</div>}
    </div>
  );
}

// The funnel, as bars that share one scale — so the step where people actually
// leave is the one your eye lands on.
function Funnel({ funnel }) {
  const top = funnel[0] ? funnel[0].n : 0;
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 16 }}>Visitors to orders</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {funnel.map((s, i) => {
          const prev = i ? funnel[i - 1].n : s.n;
          const lost = prev - s.n;
          const w = top ? Math.max(2, (s.n / top) * 100) : 2;
          return (
            <div key={s.step}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: "var(--text-body)" }}>{s.step}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {s.n.toLocaleString()} · {s.pct}%
                  {i > 0 && lost > 0 && <span style={{ color: "#c0587a" }}> · {lost.toLocaleString()} left here</span>}
                </span>
              </div>
              <div style={{ height: 12, borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", overflow: "hidden" }}>
                <div style={{ width: `${w}%`, height: "100%", background: i === funnel.length - 1 ? "var(--mr-gold-500)" : "var(--mr-purple-700)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Visitors a day, with the days something sold marked. No axis furniture: the
// question this answers is "is it going up", not "what was Tuesday".
function Sparkline({ series }) {
  const max = Math.max(1, ...series.map((s) => s.visitors));
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Visitors a day</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90, marginTop: 14 }}>
        {series.map((s) => (
          <div key={s.day} title={`${s.day}: ${s.visitors} visitors, ${s.orders} orders`}
            style={{ flex: 1, minWidth: 2, height: `${Math.max(2, (s.visitors / max) * 100)}%`, borderRadius: 2, background: s.orders ? "var(--mr-gold-500)" : "var(--mr-lavender-400)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
        <span>{series.length ? series[0].day : ""}</span>
        <span style={{ color: "var(--accent-gold-ink)" }}>gold = a day something sold</span>
        <span>{series.length ? series[series.length - 1].day : ""}</span>
      </div>
    </div>
  );
}

function Table({ title, head, rows, empty }) {
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
      {!rows.length ? (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 14 }}>{empty}</div>
      ) : (
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>{head.map((h, i) => <th key={h} style={{ ...eyebrow, textAlign: i ? "right" : "left", padding: "0 0 8px", fontWeight: 500 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} style={{ padding: "8px 0", borderTop: "1px solid var(--border-hairline)", textAlign: j ? "right" : "left", color: j ? "var(--text-body)" : "var(--text-strong)" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- People to follow up ----------------------------------------------------

// A Nigerian number as WhatsApp wants it: digits only, 0 swapped for 234.
const waNumber = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("0") ? `234${d.slice(1)}` : d;
};
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// One opening line per list, so a tap on WhatsApp starts the conversation.
const OPENERS = {
  checkouts: (r) => `Hi${first(r.name) ? ` ${first(r.name)}` : ""}, this is Majestic Roobee. We saw you didn't finish your order${r.value ? ` (${fmtN(r.value)})` : ""}. Can we help you complete it?`,
  waiting: (r) => `Hi, this is Majestic Roobee about ${r.note}, which you asked us to let you know about.`,
  signups: (r) => `Hi${first(r.name) ? ` ${first(r.name)}` : ""}, thank you for joining the Majestic Roobee list!`,
  buyers: (r) => `Hi${first(r.name) ? ` ${first(r.name)}` : ""}, thank you for shopping with Majestic Roobee! How are you enjoying your order?`,
};

const LISTS = [
  { id: "checkouts", label: "Left at checkout" },
  { id: "waiting", label: "Waiting for restock" },
  { id: "signups", label: "Newsletter sign-ups" },
  { id: "buyers", label: "Recent buyers" },
];

function csvOf(rows) {
  const cells = [["Name", "Phone", "Email", "City", "Value (NGN)", "Detail", "When"]]
    .concat(rows.map((r) => [r.name, r.phone, r.email, r.city, r.value || "", r.note, r.at]));
  return cells.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

function ContactActions({ r, opener }) {
  const wa = waNumber(r.phone);
  const pill = { fontSize: 11.5, fontWeight: 500, padding: "4px 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border-hairline)", color: "var(--mr-purple-800)", textDecoration: "none", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(opener)}`} target="_blank" rel="noopener noreferrer" style={pill}>WhatsApp</a>}
      {r.phone && <a href={`tel:${String(r.phone).replace(/[^\d+]/g, "")}`} style={pill}>Call</a>}
      {r.email && <a href={`mailto:${r.email}`} style={pill}>Email</a>}
    </div>
  );
}

function FollowUps({ ctx, days }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("checkouts");
  useEffect(() => {
    setData(null);
    api.get(`/api/admin/insights/contacts?days=${days}`, ctx.token).then((r) => {
      setData(r);
      // Open on the first list with anyone in it.
      setTab((t) => (r[t] && r[t].length ? t : (LISTS.find((l) => r[l.id] && r[l.id].length) || LISTS[0]).id));
    }).catch(ctx.authFail);
  }, [days, ctx.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = (data && data[tab]) || [];
  const download = () => {
    const blob = new Blob([csvOf(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `majestic-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const td = { padding: "8px", borderTop: "1px solid var(--border-hairline)", verticalAlign: "top" };
  return (
    <div style={{ ...card, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>People to follow up</div>
        {rows.length > 0 && <Button variant="ghost" size="sm" onClick={download}>Download CSV</Button>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {LISTS.map((l) => {
          const n = data && data[l.id] ? data[l.id].length : null;
          const on = tab === l.id;
          return (
            <button key={l.id} onClick={() => setTab(l.id)}
              style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "7px 14px", borderRadius: "var(--radius-pill)", border: `1px solid ${on ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: on ? "var(--mr-purple-900)" : "var(--surface-card)", color: on ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>
              {l.label}{n != null ? ` (${n})` : ""}
            </button>
          );
        })}
      </div>
      {!data ? <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading…</span>
        : !rows.length ? <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No one here in this period.</div>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>{["Who", "Phone", "Email", "Detail", "When", ""].map((h, i) => (
                  <th key={i} style={{ ...eyebrow, textAlign: i > 3 ? "right" : "left", padding: "0 8px 8px", fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, color: "var(--text-strong)" }}>
                      {r.name || <span style={{ color: "var(--text-muted)" }}>—</span>}
                      {r.city && <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>{r.city}</div>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.phone || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td style={{ ...td, wordBreak: "break-all" }}>{r.email || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td style={{ ...td, color: "var(--text-body)" }}>
                      {r.note}
                      {r.value > 0 && <div style={{ fontSize: 11.5, color: "var(--accent-gold-ink)" }}>{fmtN(r.value)}</div>}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{ago(r.at)}</td>
                    <td style={{ ...td, textAlign: "right" }}><ContactActions r={r} opener={OPENERS[tab](r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

export function InsightsPage({ ctx }) {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/api/admin/insights?days=${days}`, ctx.token).then(setD).catch(ctx.authFail);
  }, [days, ctx.token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const openSegment = async (id) => {
    setOpen(id); setRows(null);
    try { setRows(await api.get(`/api/admin/insights/segments/${id}?days=${days}`, ctx.token)); }
    catch (e) { ctx.authFail(e); setOpen(null); }
  };

  const rollNow = async () => {
    setBusy(true);
    try {
      const r = await api.post("/api/admin/insights/rollup", {}, ctx.token);
      ctx.flash(`Folded ${r.folded} day(s) · ${r.pairs} product pairings from ${r.sessions} visits`);
      load();
    }
    catch (e) { ctx.authFail(e); } finally { setBusy(false); }
  };

  if (!d) return <main style={{ padding: "26px 28px" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</span></main>;

  const k = d.kpis;
  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Select value={String(days)} onChange={(e) => setDays(parseInt(e.target.value, 10))} style={{ width: 180 }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
        <div style={{ flex: 1 }} />
        {!d.cfg.on && (
          <span style={{ fontSize: 12.5, color: "#c0587a" }}>
            Tracking is off (Settings → Insights)
          </span>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={rollNow}>{busy ? "Refreshing…" : "Refresh"}</Button>
      </div>

      {d.warming && (
        <div style={{ ...card, padding: 18, background: "var(--mr-gold-200)", border: "1px solid var(--mr-gold-400)" }}>
          <div style={{ fontSize: 13.5, color: "var(--mr-gold-600)", lineHeight: 1.6 }}>
            Charts fill in from tomorrow. Today&apos;s figures are below.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Kpi label="Visitors" value={k.visitors.toLocaleString()} delta={pct(k.visitors, k.prevVisitors)} />
        <Kpi label="Conversion" value={`${k.conversion}%`} note={`${k.orders.toLocaleString()} order${k.orders === 1 ? "" : "s"}`} delta={pct(k.orders, k.prevOrders)} />
        <Kpi label="Revenue" value={fmtN(k.revenue)} note={`${fmtN(k.aov)} an order`} />
        <Kpi label="Revenue per visitor" value={fmtN(k.perVisitor)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 18 }}>
        <Funnel funnel={d.funnel} />
        <Sparkline series={d.series} />
      </div>

      <FollowUps ctx={ctx} days={days} />

      {/* The segments. Each is a question the client asked, with the people it
          found and something to do about them. */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 16 }}>Shopper groups</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: 12 }}>
          {d.segments.map((s) => (
            <button key={s.id} onClick={() => openSegment(s.id)}
              style={{ textAlign: "left", cursor: "pointer", background: open === s.id ? "var(--surface-sunken)" : "var(--surface-card)", border: `1px solid ${open === s.id ? "var(--mr-purple-700)" : "var(--border-hairline)"}`, borderRadius: "var(--radius-lg)", padding: "16px 18px", fontFamily: "var(--font-sans)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: s.count ? "var(--text-strong)" : "var(--text-muted)" }}>{s.count.toLocaleString()}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginTop: 2 }}>{s.name}</div>
              {s.value > 0 && <div style={{ fontSize: 11.5, color: "var(--accent-gold-ink)", marginTop: 6 }}>{fmtN(s.value)} left in carts</div>}
            </button>
          ))}
        </div>
        {open && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border-hairline)", paddingTop: 16 }}>
            {!rows ? <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading…</span> : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{rows.segment.name}</div>
                    {rows.segment.action && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{rows.segment.action}</div>}
                  </div>
                  <button onClick={() => { setOpen(null); setRows(null); }} style={{ ...linkBtn, color: "var(--text-muted)" }}>Close</button>
                </div>
                {!rows.rows.length ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12 }}>No one in this group.</div>
                ) : (
                  <div style={{ marginTop: 12, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>{["Who", "Looking at", "Left in cart", "From", "Last seen", ""].map((h, i) => (
                          <th key={h} style={{ ...eyebrow, textAlign: i > 1 ? "right" : "left", padding: "0 8px 8px", fontWeight: 500 }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rows.rows.map((r) => (
                          <tr key={r.id}>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", color: "var(--text-strong)" }}>
                              {r.name || r.email || <span style={{ color: "var(--text-muted)" }}>Not signed in</span>}
                              {(r.phone || (r.name && r.email)) && <div style={{ fontSize: 11.5, color: "var(--text-body)" }}>{[r.phone, r.name ? r.email : ""].filter(Boolean).join(" · ")}</div>}
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.device}{r.city ? ` · ${r.city}` : ""}</div>
                            </td>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", color: "var(--text-body)" }}>
                              {r.looked.length ? r.looked.join(", ") : <span style={{ color: "var(--text-muted)" }}>—</span>}
                            </td>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", textAlign: "right", color: r.cartValue ? "var(--accent-gold-ink)" : "var(--text-muted)" }}>
                              {r.cartValue ? fmtN(r.cartValue) : "—"}
                            </td>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", textAlign: "right", color: "var(--text-muted)" }}>{r.source}</td>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", textAlign: "right", color: "var(--text-muted)" }}>{ago(r.lastSeen)}</td>
                            <td style={{ padding: "8px", borderTop: "1px solid var(--border-hairline)", textAlign: "right" }}>
                              {(r.phone || r.email) && <ContactActions r={r} opener={`Hi${first(r.name) ? ` ${first(r.name)}` : ""}, this is Majestic Roobee. Can we help you find anything?`} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 18 }}>
        <Table
          title="Viewed but rarely bought"
          head={["Product", "Views", "Added to cart", "Rate"]}
          rows={d.coldest.map((p) => [p.name, p.views, p.carts, `${p.rate}%`])}
          empty="Not enough data yet."
        />
        <Table
          title="Most viewed"
          head={["Product", "Views", "Added to cart", "Rate"]}
          rows={d.hottest.map((p) => [p.name, p.views, p.carts, `${p.rate}%`])}
          empty="No product views yet."
        />
        <Table
          title="Sales by source"
          head={["Source", "Orders", "Revenue"]}
          rows={(d.salesBySource || []).map((s) => [s.campaigns.length ? `${s.source} · ${s.campaigns.join(", ")}` : s.source, s.orders, fmtN(s.revenue)])}
          empty="No orders in this period."
        />
        <Table
          title="Traffic sources"
          head={["Source", "Visits"]}
          rows={d.sources.map((s) => [s.dim, s.v])}
          empty="No data yet."
        />
        <Table
          title="Searches with no results"
          head={["Search", "Times"]}
          rows={d.searchMisses.map((s) => [s.dim, s.v])}
          empty="None."
        />
        <Table
          title="Sold out, still wanted"
          head={["Product", "Waiting", "Views", "Missed sales"]}
          rows={d.soldOut.map((r) => [`${r.name} — ${r.size}`, r.waiting, r.views, r.missed ? fmtN(r.missed) : "—"])}
          empty="Nothing is sold out."
        />
        <Table
          title="On what"
          head={["Device", "Visits"]}
          rows={d.devices.map((s) => [s.dim, s.v])}
          empty="No data yet."
        />
      </div>
    </main>
  );
}
