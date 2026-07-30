// Admin — Go live: clear the demo/seed data so the store holds only real records.
// Deliberately explicit: nothing is deleted unless ticked and confirmed.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button } from "../ds/components.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };

const SCOPES = [
  { id: "orders", label: "Orders", desc: "Demo orders, their items and tracking timelines." },
  { id: "customers", label: "Customers", desc: "Customer accounts, saved addresses and wishlists." },
  { id: "inquiries", label: "Customer service", desc: "Inbox threads and live-chat messages." },
  { id: "checkouts", label: "Abandoned checkouts", desc: "The abandoned-cart list on the dashboard." },
  { id: "marketing", label: "Promos, campaigns & leads", desc: "Seeded promo codes, campaigns and the email list." },
  { id: "activity", label: "Activity & automation runs", desc: "Event log, queued automation messages, waitlists." },
  { id: "products", label: "Products (the whole catalogue)", desc: "Every product, size and stock level. Use only if you're replacing the catalogue entirely.", danger: true },
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
          you're replacing with real data. This cannot be undone — though the database keeps 30 days of
          point-in-time history, and there's a nightly backup, so recovery is possible if something goes wrong.
        </div>
      </div>

      <div style={{ ...card, padding: 22, display: "flex", flexDirection: "column", gap: 4 }}>
        {SCOPES.map((s) => (
          <label key={s.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border-hairline)", cursor: "pointer" }}>
            <input type="checkbox" checked={!!picked[s.id]} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })}
              style={{ accentColor: s.danger ? "#c0587a" : "var(--mr-purple-800)", marginTop: 3, width: 15, height: 15 }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: s.danger ? "#c0587a" : "var(--text-strong)" }}>{s.label}</span>
              {counts && <span style={{ fontSize: 12, color: "var(--text-muted)" }}> — {counts[s.id]} record{counts[s.id] === 1 ? "" : "s"}</span>}
              <br />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</span>
            </span>
          </label>
        ))}
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
