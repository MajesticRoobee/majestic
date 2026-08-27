// Storefront customer account — sign in / create account (optional, guest-first)
// and, once signed in, a dashboard: orders, addresses, wishlist, profile.
import React, { useState } from "react";
import { Eyebrow, GildedRule, Badge, Button, Input } from "../ds/components.jsx";
import { ProductCard } from "./pages.jsx";

const PAD = "clamp(16px, 4vw, 40px)";
const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", padding: 24 };

// Choosing a new password, reached from the link in the reset email. The token
// is in the URL, so this screen replaces the sign-in form entirely rather than
// sitting inside it — someone arriving here is not deciding whether to log in.
function ResetForm({ ctx, token }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (password.length < 8) { setErr("Choose a password of at least 8 characters."); return; }
    setBusy(true); setErr("");
    try { await ctx.custResetPassword(token, password); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: `clamp(40px, 6vw, 72px) ${PAD}` }}>
      <Eyebrow>Almost there</Eyebrow>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 36px)", color: "var(--text-strong)", margin: "12px 0 8px" }}>Choose a new password</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 22px" }}>Once you save it you'll be signed straight in.</p>
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} hint="At least 8 characters." />
        {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
        <Button variant="gold" block disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save and sign in"}</Button>
        <button onClick={() => ctx.nav("account")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)" }}>Back to sign in</button>
      </div>
    </main>
  );
}

function AuthForm({ ctx }) {
  const [mode, setMode] = useState("register"); // register | login | forgot
  const [f, setF] = useState({ email: "", password: "", name: "", phone: "", marketingOptIn: true });
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr(""); setSent("");
    try {
      if (mode === "register") await ctx.custRegister({ email: f.email, password: f.password, name: f.name, phone: f.phone, city: ctx.city, marketingOptIn: f.marketingOptIn });
      else if (mode === "forgot") setSent(await ctx.custForgotPassword(f.email));
      else await ctx.custLogin(f.email, f.password);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: `clamp(32px, 5vw, 56px) ${PAD}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 28, alignItems: "start" }}>
      <div>
        <Eyebrow>Your trail, remembered</Eyebrow>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", color: "var(--text-strong)", margin: "12px 0 16px" }}>{mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text-body)", margin: "0 0 18px" }}>Shopping is always faster with a profile — but never required. You can keep checking out as a guest anytime.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            ["Track every order in one place", "No more digging for order numbers."],
            ["Save your details & addresses", "Checkout in seconds next time."],
            ["Build a wishlist", "Keep the scents you're deciding between."],
            ["Perks & early access", "First to know about drops and offers."],
          ].map(([t, s]) => (
            <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: "var(--mr-gold-500)", fontSize: 12, marginTop: 3 }}>◆</span>
              <div><div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-strong)" }}>{t}</div><div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {["register", "login"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, padding: "9px 14px", borderRadius: "var(--radius-pill)", border: `1px solid ${mode === m ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: mode === m ? "var(--mr-purple-900)" : "var(--surface-card)", color: mode === m ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>
              {m === "register" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && <Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Adaeze Okafor" />}
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@email.com" />
          {mode === "register" && <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0803 000 0000" />}
          {mode !== "forgot" && (
            <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} hint={mode === "register" ? "At least 8 characters." : undefined} />
          )}
          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setErr(""); setSent(""); }} style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 }}>
              Forgotten your password?
            </button>
          )}
          {mode === "forgot" && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>We'll email you a link to choose a new one. It works for an hour.</div>
          )}
          {sent && <div style={{ fontSize: 12.5, color: "#3f6b45" }}>{sent}</div>}
          {mode === "register" && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "var(--text-body)", cursor: "pointer" }}>
              <input type="checkbox" checked={f.marketingOptIn} onChange={(e) => setF({ ...f, marketingOptIn: e.target.checked })} style={{ accentColor: "var(--mr-purple-800)", marginTop: 2 }} />
              Send me offers and early access (you can unsubscribe anytime).
            </label>
          )}
          {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
          <Button variant="gold" block disabled={busy} onClick={submit}>{busy ? "One moment…" : mode === "register" ? "Create account" : mode === "forgot" ? "Email me a link" : "Sign in"}</Button>
          {mode === "forgot" && (
            <button onClick={() => { setMode("login"); setErr(""); setSent(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)" }}>Back to sign in</button>
          )}
          <button onClick={() => ctx.nav("shop")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-700)" }}>Keep shopping as a guest —</button>
        </div>
      </div>
    </main>
  );
}

function Dashboard({ ctx }) {
  const { cust, custData } = ctx;
  const [profile, setProfile] = useState({ name: cust.name || "", phone: cust.phone || "", marketingOptIn: !!cust.marketingOptIn });
  const [savedMsg, setSavedMsg] = useState("");
  const [addr, setAddr] = useState({ label: "Home", address: "", city: ctx.city });
  // Filtered after `card`, not before: a saved product whose last variation was
  // withdrawn yields no card, and must drop out rather than render an empty one.
  const wishlistCards = custData.wishlist.map((id) => ctx.products.find((p) => p.id === id)).filter(Boolean).map(ctx.card).filter(Boolean);
  const saveProfile = async () => { await ctx.updateProfile(profile); setSavedMsg("Saved."); setTimeout(() => setSavedMsg(""), 2000); };
  const statusTone = (s) => ({ "In transit": "neutral", "Ready for pickup": "gold", Delivered: "success", Collected: "success" }[s] || "neutral");
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: `clamp(28px, 4vw, 48px) ${PAD}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Eyebrow>Your house</Eyebrow>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 40px)", color: "var(--text-strong)", margin: "10px 0 0" }}>Hello, {(cust.name || "friend").split(" ")[0]}</h1>
        </div>
        <button onClick={ctx.custLogout} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "8px 16px", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mr-purple-800)", cursor: "pointer" }}>Sign out</button>
      </div>
      <GildedRule style={{ margin: "20px 0 28px" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 20, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Your orders</div>
          {custData.orders.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>No orders yet — your trail starts with your first.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {custData.orders.map((o) => (
                <div key={o.no} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--border-hairline)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--mr-purple-900)" }}>{o.no}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{o.placed} · {o.totalLabel}{!o.paid ? " · awaiting payment" : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                    <button onClick={() => { ctx.setTrack((t) => ({ ...t, no: o.no, contact: cust.email, err: "" })); ctx.nav("track"); setTimeout(ctx.doTrack, 60); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--mr-purple-700)", fontFamily: "var(--font-sans)" }}>Track</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Your details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{cust.email}</div>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: "var(--text-body)", cursor: "pointer" }}>
                <input type="checkbox" checked={profile.marketingOptIn} onChange={(e) => setProfile({ ...profile, marketingOptIn: e.target.checked })} style={{ accentColor: "var(--mr-purple-800)" }} />
                Offers & early access
              </label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Button variant="secondary" size="sm" onClick={saveProfile}>Save</Button>
                {savedMsg && <span style={{ fontSize: 12.5, color: "#3f6b45" }}>{savedMsg}</span>}
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Saved addresses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {custData.addresses.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No saved addresses yet.</div>}
              {custData.addresses.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, alignItems: "flex-start" }}>
                  <div><strong style={{ color: "var(--text-strong)" }}>{a.label}</strong>{a.is_default ? " · default" : ""}<br /><span style={{ color: "var(--text-muted)" }}>{a.address}{a.city ? ", " + a.city : ""}</span></div>
                  <button onClick={() => ctx.removeAddress(a.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", textDecoration: "underline" }}>Remove</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input label="Add an address" value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} placeholder="House, street, area" />
              <Button variant="secondary" size="sm" onClick={async () => { if (addr.address.trim()) { await ctx.addAddress(addr); setAddr({ label: "Home", address: "", city: ctx.city }); } }}>Save address</Button>
            </div>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 14 }}>Your wishlist</div>
        {wishlistCards.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Nothing saved yet — tap the ♡ on any fragrance to keep it here.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: 20 }}>
            {wishlistCards.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>
    </main>
  );
}

export function AccountPage({ ctx }) {
  // A reset link lands on /account?reset=<token>. It outranks everything: a
  // customer who followed it may well already have a stale session open.
  if (ctx.resetToken) return <ResetForm ctx={ctx} token={ctx.resetToken} />;
  return ctx.cust ? <Dashboard ctx={ctx} /> : <AuthForm ctx={ctx} />;
}
