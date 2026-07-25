// Admin — Dashboard, Inventory, Product catalogue.
import React, { useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea } from "../ds/components.jsx";
import { CAT_LABELS, fmtN, statusBadge } from "./App.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const th = { padding: "10px 14px", fontWeight: 600, color: "var(--text-muted)", borderTop: "1px solid var(--border-hairline)", fontSize: 11, letterSpacing: "0.06em" };
const initialsOf = (name) => (name || "").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("");

function StBadge({ tone, children }) {
  const b = statusBadge(tone);
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg }}>{children}</span>;
}

const ORDER_STATUSES = ["Processing", "Packed", "In transit", "Ready for pickup", "Delivered", "Collected", "Cancelled"];
const orderTone = (st) => ({ "In transit": "mute", "Ready for pickup": "warn", Delivered: "good", Collected: "good", Cancelled: "bad" }[st] || "mute");

export function Dashboard({ ctx }) {
  const o = ctx.overview;
  if (!o) return <main style={{ padding: "26px 28px" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Setting the table…</span></main>;
  const deltaTxt = (cur, prev, unit = "") => {
    if (!prev) return "— vs prior period";
    const pct = Math.round(((cur - prev) / prev) * 100);
    return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs prior period${unit}`;
  };
  const deltaColor = (cur, prev) => (!prev || cur >= prev ? "#3f6b45" : "#c0587a");
  const kpis = [
    { label: "Revenue — 14 days", value: fmtN(o.kpis.revenue14), delta: deltaTxt(o.kpis.revenue14, o.kpis.revenuePrev), deltaColor: deltaColor(o.kpis.revenue14, o.kpis.revenuePrev) },
    { label: "Orders — 14 days", value: o.kpis.orders14, delta: deltaTxt(o.kpis.orders14, o.kpis.ordersPrev), deltaColor: deltaColor(o.kpis.orders14, o.kpis.ordersPrev) },
    { label: "Avg order value", value: fmtN(o.kpis.avgOrder), delta: "Across paid orders", deltaColor: "#3f6b45" },
    { label: "Low / out of stock", value: o.kpis.lowCount + o.kpis.outCount, delta: `${o.kpis.outCount} fully out — restock today`, deltaColor: o.kpis.outCount > 0 ? "#c0587a" : "#3f6b45" },
  ];
  const max = Math.max(...o.series.map((s) => s.value), 1);
  const locColors = ["var(--mr-purple-700)", "var(--mr-orchid-500)", "var(--accent-gold)"];
  const setStatus = async (no, status) => {
    try {
      await api.patch(`/api/admin/orders/${encodeURIComponent(no)}`, { status }, ctx.token);
      ctx.flash("Order " + no + " → " + status);
      ctx.loadOverview();
    } catch (e) { ctx.authFail(e); }
  };
  const abandonedRows = o.abandoned
    .filter((a) => ctx.scope === "all" || a.city.toLowerCase() === ctx.scope)
    .map((a) => ({ name: a.name, phone: a.phone, email: a.email, city: a.city, valueLabel: fmtN(a.value), when: a.time, stage: "Left at: " + a.stage, ok: false }))
    .concat(o.orders.map((or) => ({ name: or.customer, phone: or.phone, email: or.email, city: or.city, valueLabel: fmtN(or.total), when: or.placed, stage: "Order " + or.no, ok: true })));
  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text-strong)", marginTop: 8 }}>{k.value}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: k.deltaColor }}>{k.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, alignItems: "stretch" }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Revenue — last 14 days</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ctx.scopeLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 170 }}>
            {o.series.map((b, i) => (
              <div key={b.date} className="mr-bar" title={`${b.label} — ${fmtN(b.value)}`} style={{ flex: 1, height: Math.max(2, Math.round((b.value / max) * 100)) + "%", background: i === o.series.length - 1 ? "var(--accent-gold)" : "var(--mr-purple-700)", borderRadius: "4px 4px 0 0" }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            <span>{o.series[0].label}</span><span>{o.series[o.series.length - 1].label}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Revenue by location</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {o.revenueByLocation.map((l, i) => (
                <div key={l.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{l.city}</span>
                    <span style={{ color: "var(--text-muted)" }}>{l.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--mr-lavender-200)" }}>
                    <div style={{ height: 6, borderRadius: 3, width: l.pct + "%", background: locColors[i % 3] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, padding: 22, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 12 }}>Top products — 30 days</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {o.topProducts.map((t, i) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-body)" }}>{i + 1}. {t.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>{t.units} units</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Recent orders</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Routed automatically to the store holding full stock</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 860, display: "grid", gridTemplateColumns: "110px 1.4fr 1fr 1.2fr 100px 150px", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>ORDER</div>
            <div style={th}>CUSTOMER</div>
            <div style={th}>FULFILLED FROM</div>
            <div style={th}>METHOD · PAYMENT</div>
            <div style={th}>TOTAL</div>
            <div style={{ ...th, paddingRight: 22 }}>STATUS</div>
            {o.orders.map((or) => {
              const fromCity = { abuja: "Abuja", lagos: "Lagos", ibadan: "Ibadan" }[or.fulfilledFrom] || or.fulfilledFrom;
              const cross = or.city.toLowerCase() !== fromCity.toLowerCase();
              const b = statusBadge(orderTone(or.status));
              const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)" };
              return (
                <React.Fragment key={or.no}>
                  <div style={{ ...cell, paddingLeft: 22, fontWeight: 600, color: "var(--mr-purple-800)" }}>{or.no}</div>
                  <div style={cell}>
                    <div style={{ color: "var(--text-strong)" }}>{or.customer}<span style={{ color: "var(--text-muted)" }}> · {or.city}</span></div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{or.phone} · {or.email}</div>
                  </div>
                  <div style={{ ...cell, color: cross ? "var(--mr-orchid-600)" : "var(--text-body)" }}>{fromCity}{cross ? " ⟶ routed" : ""}</div>
                  <div style={{ ...cell, color: "var(--text-muted)" }}>
                    {or.method} · {or.pay}
                    {or.payStatus !== "paid" && <span style={{ color: "var(--mr-gold-600)" }}> (unpaid)</span>}
                  </div>
                  <div style={{ ...cell, fontWeight: 500, color: "var(--text-strong)" }}>{fmtN(or.total)}</div>
                  <div style={{ ...cell, padding: "11px 22px 11px 14px" }}>
                    <select value={or.status} onChange={(e) => setStatus(or.no, e.target.value)} title="Update status" style={{ appearance: "none", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer", background: b.bg, color: b.fg, outline: "none" }}>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Checkouts — did they go ahead?</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Completed orders vs carts abandoned at checkout — with shopper contact</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 760, display: "grid", gridTemplateColumns: "1.7fr 0.8fr 0.9fr 1.2fr 120px", fontSize: 12.5 }}>
            <div style={{ ...th, paddingLeft: 22 }}>SHOPPER</div>
            <div style={th}>CITY</div>
            <div style={th}>VALUE</div>
            <div style={th}>STAGE · WHEN</div>
            <div style={{ ...th, paddingRight: 22 }}>OUTCOME</div>
            {abandonedRows.map((c, i) => {
              const cell = { padding: "13px 14px", borderTop: "1px solid var(--border-hairline)", display: "flex", alignItems: "center" };
              return (
                <React.Fragment key={i}>
                  <div style={{ ...cell, paddingLeft: 22, display: "block" }}>
                    <div style={{ color: "var(--text-strong)", fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.phone} · {c.email}</div>
                  </div>
                  <div style={{ ...cell, color: "var(--text-body)" }}>{c.city}</div>
                  <div style={{ ...cell, fontWeight: 500, color: "var(--text-strong)" }}>{c.valueLabel}</div>
                  <div style={{ ...cell, color: "var(--text-muted)" }}>{c.stage} · {c.when}</div>
                  <div style={{ ...cell, padding: "11px 22px 11px 14px" }}><StBadge tone={c.ok ? "good" : "bad"}>{c.ok ? "Completed" : "Abandoned"}</StBadge></div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

export function Inventory({ ctx }) {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const TH = ctx.TH;
  const scope = ctx.scope;
  const bump = async (productId, size, location, delta) => {
    // Optimistic update, server clamps at zero.
    ctx.setProducts((cur) => cur.map((p) => p.id !== productId ? p : {
      ...p,
      variants: p.variants.map((v) => v.size !== size ? v : { ...v, stock: { ...v.stock, [location]: Math.max(0, (v.stock[location] || 0) + delta) } }),
    }));
    try {
      await api.patch("/api/admin/stock", { productId, size, location, delta }, ctx.token);
    } catch (e) {
      ctx.authFail(e);
      ctx.loadProducts();
    }
  };
  const rows = [];
  let lowCount = 0, outCount = 0, unitTotal = 0;
  for (const p of ctx.products) for (const v of p.variants) {
    const ab = v.stock.abuja || 0, la = v.stock.lagos || 0, ib = v.stock.ibadan || 0;
    const scoped = scope === "all" ? ab + la + ib : { abuja: ab, lagos: la, ibadan: ib }[scope];
    unitTotal += scoped;
    if (scoped === 0) outCount++;
    else if (scoped <= TH) lowCount++;
    const st = scoped === 0 ? "bad" : scoped <= TH ? "warn" : "good";
    if (lowOnly && st === "good") continue;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) continue;
    rows.push({ p, v, ab, la, ib, st });
  }
  const cellStyle = (n) => n === 0
    ? { bg: "#f7e3ea", bd: "#eac3d1", fg: "#c0587a" }
    : n <= TH ? { bg: "var(--mr-gold-200)", bd: "var(--mr-gold-400)", fg: "var(--mr-gold-600)" }
    : { bg: "var(--surface-card)", bd: "var(--border-hairline)", fg: "var(--text-strong)" };
  const stepper = (n, dec, inc) => {
    const c = cellStyle(n);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${c.bd}`, borderRadius: "var(--radius-pill)", background: c.bg }}>
        <button onClick={dec} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 8px", fontSize: 13, color: "var(--mr-purple-800)" }}>−</button>
        <span style={{ minWidth: 22, textAlign: "center", fontWeight: 600, color: c.fg }}>{n}</span>
        <button onClick={inc} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 8px", fontSize: 13, color: "var(--mr-purple-800)" }}>+</button>
      </span>
    );
  };
  const kpis = [
    { label: "Units on hand — " + ctx.scopeLabel, value: unitTotal.toLocaleString(), color: "var(--text-strong)" },
    { label: "Low stock variants", value: lowCount, color: lowCount ? "var(--mr-gold-600)" : "var(--text-strong)" },
    { label: "Out of stock variants", value: outCount, color: outCount ? "#c0587a" : "var(--text-strong)" },
  ];
  const cell = { padding: "12px 14px", borderTop: "1px solid var(--border-hairline)", display: "flex", alignItems: "center" };
  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" style={{ fontFamily: "var(--font-sans)", fontSize: 13, padding: "10px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-pill)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)", width: 240 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--text-body)" }}>
          <input type="checkbox" checked={lowOnly} onChange={() => setLowOnly(!lowOnly)} style={{ accentColor: "var(--mr-purple-800)", width: 15, height: 15, cursor: "pointer" }} />
          Low &amp; out of stock only
        </label>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Low-stock threshold: {TH} units — triggers back-in-stock waitlists</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontFamily: "var(--font-condensed)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 6, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...card, overflowX: "auto" }}>
        <div style={{ minWidth: 900, display: "grid", gridTemplateColumns: "1.8fr 80px 130px 130px 130px 110px 120px", fontSize: 12.5 }}>
          <div style={{ ...th, borderTop: "none", paddingLeft: 22, paddingTop: 12, paddingBottom: 12 }}>PRODUCT</div>
          {["SIZE", "ABUJA", "LAGOS", "IBADAN", "STATUS", ""].map((h, i) => (
            <div key={i} style={{ ...th, borderTop: "none", paddingTop: 12, paddingBottom: 12, ...(i === 5 ? { paddingRight: 22 } : {}) }}>{h}</div>
          ))}
          {rows.map(({ p, v, ab, la, ib, st }) => {
            const badge = statusBadge(st);
            return (
              <React.Fragment key={p.id + v.size}>
                <div style={{ ...cell, paddingLeft: 22, gap: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: "var(--mr-lavender-200)", color: "var(--mr-purple-800)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 13, flexShrink: 0 }}>{initialsOf(p.name)}</span>
                  <span>
                    <span style={{ fontWeight: 500, color: "var(--text-strong)" }}>{p.name}</span><br />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{CAT_LABELS[p.cat] || p.cat}</span>
                  </span>
                </div>
                <div style={{ ...cell, color: "var(--text-body)" }}>{v.size}</div>
                <div style={cell}>{stepper(ab, () => bump(p.id, v.size, "abuja", -1), () => bump(p.id, v.size, "abuja", 1))}</div>
                <div style={cell}>{stepper(la, () => bump(p.id, v.size, "lagos", -1), () => bump(p.id, v.size, "lagos", 1))}</div>
                <div style={cell}>{stepper(ib, () => bump(p.id, v.size, "ibadan", -1), () => bump(p.id, v.size, "ibadan", 1))}</div>
                <div style={cell}><span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: badge.bg, color: badge.fg }}>{st === "bad" ? "Out of stock" : st === "warn" ? "Low stock" : "Healthy"}</span></div>
                <div style={{ ...cell, paddingRight: 22 }}>
                  <button onClick={() => bump(p.id, v.size, scope === "all" ? "abuja" : scope, 20)} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "5px 12px", fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 500, color: "var(--mr-purple-800)", cursor: "pointer" }}>Restock +20</button>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function EditProduct({ ctx, product, onClose }) {
  const [f, setF] = useState({ name: product.name, cat: product.cat, family: product.family, gender: product.gender, notes: product.notes, desc: product.desc });
  const [prices, setPrices] = useState(Object.fromEntries(product.variants.map((v) => [v.id, String(v.ngn)])));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await api.patch(`/api/admin/products/${encodeURIComponent(product.id)}`, f, ctx.token);
      for (const v of product.variants) {
        const np = parseInt(prices[v.id], 10);
        if (np && np !== v.ngn) await api.patch(`/api/admin/variants/${v.id}`, { price: np }, ctx.token);
      }
      ctx.flash("Product updated");
      ctx.loadProducts();
      onClose();
    } catch (e) { ctx.authFail(e); setMsg(e.message); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm(`Delete "${product.name}"? It will be removed from the storefront. Past orders keep their record.`)) return;
    try { await api.del(`/api/admin/products/${encodeURIComponent(product.id)}`, ctx.token); ctx.flash("Product deleted"); ctx.loadProducts(); onClose(); }
    catch (e) { ctx.authFail(e); setMsg(e.message); }
  };
  return (
    <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Edit product</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>Close</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 18px" }}>Changes go live on the storefront immediately.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select label="Category" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Scent family" value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })} />
          <Input label="Gender" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })} />
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>Prices (₦) by size</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {product.variants.map((v) => (
              <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 60, fontSize: 13, color: "var(--text-body)" }}>{v.size}</span>
                <input value={prices[v.id]} onChange={(e) => setPrices({ ...prices, [v.id]: e.target.value.replace(/\D/g, "") })} style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
              </div>
            ))}
          </div>
        </div>
        <Textarea label="Scent notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
        <Textarea label="Product description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={3} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
          <button onClick={del} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c0587a", fontFamily: "var(--font-sans)", marginLeft: "auto" }}>Delete product</button>
        </div>
        {msg && <div style={{ fontSize: 12, color: "#c0587a" }}>{msg}</div>}
      </div>
    </div>
  );
}

export function Catalogue({ ctx }) {
  const [np, setNp] = useState({ name: "", cat: "extrait", size: "", price: "", notes: "", desc: "" });
  const [npErr, setNpErr] = useState("");
  const [npDone, setNpDone] = useState("");
  const [editId, setEditId] = useState(null);
  const editing = ctx.products.find((p) => p.id === editId);
  const toggleLive = async (p) => {
    ctx.setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, live: !x.live } : x)));
    try {
      await api.patch(`/api/admin/products/${encodeURIComponent(p.id)}`, { live: !p.live }, ctx.token);
    } catch (e) { ctx.authFail(e); ctx.loadProducts(); }
  };
  const addProduct = async () => {
    try {
      const r = await api.post("/api/admin/products", np, ctx.token);
      setNp({ name: "", cat: "extrait", size: "", price: "", notes: "", desc: "" });
      setNpErr("");
      setNpDone(r.name);
      ctx.loadProducts();
    } catch (e) {
      ctx.authFail(e);
      setNpErr(e.message);
      setNpDone("");
    }
  };
  const variants = ctx.products.reduce((n, p) => n + p.variants.length, 0);
  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ctx.products.length} products · {variants} variants across 3 stores</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
          {ctx.products.map((p) => {
            const total = p.variants.reduce((n, v) => n + (v.stock.abuja || 0) + (v.stock.lagos || 0) + (v.stock.ibadan || 0), 0);
            const multi = p.variants.length > 1;
            return (
              <div key={p.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 8, opacity: p.live ? 1 : 0.62 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{CAT_LABELS[p.cat] || p.cat} · {p.family}</div>
                  </div>
                  <Switch checked={p.live} onChange={() => toggleLive(p)} />
                </div>
                <div style={{ fontSize: 13, color: "var(--text-body)" }}>{(multi ? "From " : "") + fmtN(p.variants[0].ngn)} · {p.variants.map((v) => v.size).join(" / ")}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", color: "var(--mr-purple-800)" }}>{total} in stock</span>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: "var(--radius-pill)", background: p.live ? "#e4efe4" : "var(--mr-gold-200)", color: p.live ? "#3f6b45" : "var(--mr-gold-600)" }}>{p.live ? "Live on storefront" : "Draft — hidden"}</span>
                  <button onClick={() => setEditId(p.id)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--mr-purple-700)", fontFamily: "var(--font-sans)", padding: 0 }}>Edit →</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {editing ? (
        <EditProduct ctx={ctx} product={editing} onClose={() => setEditId(null)} />
      ) : (
      <div style={{ ...card, padding: 24, position: "sticky", top: 84 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Add a product</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>New pieces enter the catalogue as drafts — set stock per store before going live.</div>
        {npDone && (
          <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: 16, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--mr-purple-900)" }}>Added — quietly.</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{npDone} is now a draft in the catalogue.</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Product name" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. Velvet Reign" />
          <Select label="Category" value={np.cat} onChange={(e) => setNp({ ...np, cat: e.target.value })}>
            {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Size" value={np.size} onChange={(e) => setNp({ ...np, size: e.target.value })} placeholder="30ml" />
            <Input label="Price (₦)" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} placeholder="35000" />
          </div>
          <Textarea label="Scent notes" value={np.notes} onChange={(e) => setNp({ ...np, notes: e.target.value })} rows={2} placeholder="Oud, saffron, smoked amber" />
          <Textarea label="Product description" value={np.desc} onChange={(e) => setNp({ ...np, desc: e.target.value })} rows={2} placeholder="A short, evocative description shoppers read on the product page." hint="Shown to shoppers on the product page." />
          <Button variant="primary" block onClick={addProduct}>Add to catalogue</Button>
          {npErr && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{npErr}</div>}
        </div>
      </div>
      )}
    </main>
  );
}
