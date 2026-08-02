// Admin — Go live: clear the demo/seed data so the store holds only real records.
// Deliberately explicit: nothing is deleted unless ticked and confirmed.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button } from "../ds/components.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };

// Only ever removes rows the original sample data created — anything the shop
// has added since is left alone, so these are safe to run even after go-live.
const DEMO_SCOPES = [
  { id: "products", label: "Sample products", desc: "The demo catalogue, with its sizes and stock. Products you added stay." },
  { id: "orders", label: "Sample orders", desc: "Demo orders, their items and tracking timelines." },
  { id: "inquiries", label: "Sample inbox threads", desc: "The demo customer-service conversations." },
  { id: "checkouts", label: "Sample abandoned checkouts", desc: "The demo abandoned-cart list on the dashboard." },
  { id: "marketing", label: "Sample promos & campaigns", desc: "The demo promo codes and campaigns." },
];

// These have no demo version — the sample data never created any. Whatever is
// in them is real, so clearing them is a deletion of genuine records.
const REAL_SCOPES = [
  { id: "customers", label: "Customer accounts", desc: "Real accounts, saved addresses and wishlists." },
  { id: "leads", label: "Email list", desc: "Real newsletter and marketing sign-ups." },
  { id: "activity", label: "Activity & automation runs", desc: "Event log, queued automation messages, back-in-stock waitlists." },
];

export function GoLivePage({ ctx }) {
  const [counts, setCounts] = useState(null);
  const [picked, setPicked] = useState({});
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.get("/api/admin/data-counts", ctx.token).then(setCounts).catch(ctx.authFail);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = Object.keys(picked).filter((k) => picked[k]);
  const purge = async () => {
    setBusy(true); setMsg("");
    try {
      await api.post("/api/admin/purge", { scopes: chosen, confirm }, ctx.token);
      setMsg(`Cleared: ${chosen.join(", ")}.`);
      setPicked({}); setConfirm("");
      load();
      ctx.loadProducts(); ctx.loadOverview(); ctx.loadInquiries(); ctx.loadPromos(); ctx.loadCampaigns();
      ctx.flash("Demo data cleared");
    } catch (e) { ctx.authFail(e); setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <main style={{ padding: "26px 28px 48px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 780 }}>
      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Going live — clear the demo data</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>
          The store was seeded with sample records so the dashboard had something to show. Clear whichever
          you&apos;re replacing with real data — the samples are tagged, so removing them never touches a product,
          order or code you added yourself. This cannot be undone, though the database keeps 30 days of
          point-in-time history and there&apos;s a nightly backup, so recovery is possible if something goes wrong.
        </div>
      </div>

      <div style={{ ...card, padding: 22, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>The sample data</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.6 }}>
          Removes only the demo records the store shipped with. Anything you&apos;ve added yourself is kept.
        </div>
        {DEMO_SCOPES.map((s) => {
          const n = counts && counts.demo[s.id];
          const kept = counts && counts.real[s.id];
          return (
            <label key={s.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--border-hairline)", cursor: n === 0 ? "default" : "pointer", opacity: n === 0 ? 0.5 : 1 }}>
              <input type="checkbox" disabled={n === 0} checked={!!picked[s.id]} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })}
                style={{ accentColor: "var(--mr-purple-800)", marginTop: 3, width: 15, height: 15 }} />
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{s.label}</span>
                {counts && <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — {n === 0 ? "already cleared" : `${n} sample${n === 1 ? "" : "s"} to remove`}</span>}
                {!!kept && <span style={{ fontSize: 12, color: "#3f6b45" }}> · {kept} of yours stays</span>}
                <br />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</span>
              </span>
            </label>
          );
        })}

        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#c0587a", marginTop: 22 }}>Real records — no samples here</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.6 }}>
          The sample data never created any of these, so everything in them is genuine. Only tick one if you
          truly want those records gone.
        </div>
        {REAL_SCOPES.map((s) => {
          const n = counts && counts.real[s.id];
          return (
            <label key={s.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--border-hairline)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!picked[s.id]} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })}
                style={{ accentColor: "#c0587a", marginTop: 3, width: 15, height: 15 }} />
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#c0587a" }}>{s.label}</span>
                {counts && <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — {n} real record{n === 1 ? "" : "s"}</span>}
                <br />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</span>
              </span>
            </label>
          );
        })}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)" }}>Type DELETE to confirm</span>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE"
              style={{ fontFamily: "var(--font-sans)", fontSize: 14, padding: "10px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", width: 160, color: "var(--text-strong)", background: "var(--surface-card)" }} />
          </span>
          <Button variant="primary" disabled={busy || !chosen.length || confirm !== "DELETE"} onClick={purge}>
            {busy ? "Clearing…" : chosen.length ? `Clear ${chosen.length} selected` : "Select what to clear"}
          </Button>
        </div>
        {msg && <div style={{ fontSize: 12.5, marginTop: 10, color: msg.startsWith("Cleared") ? "#3f6b45" : "#c0587a" }}>{msg}</div>}
      </div>

      <div style={{ ...card, padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 8 }}>Launch checklist</div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-body)", lineHeight: 1.9 }}>
          <li>Clear the demo records above.</li>
          <li>Add your real products under <strong>Products</strong> — photo, sizes, prices and opening stock.</li>
          <li>Check <strong>Settings</strong>: announcement bar, hero copy, store addresses, contact details.</li>
          <li>Create your real promo codes under <strong>Sales &amp; Promos</strong>.</li>
          <li>Add your live Paystack key so card payments settle (ask your developer).</li>
          <li>Visit the storefront and place one test order end to end.</li>
        </ol>
      </div>
    </main>
  );
}
