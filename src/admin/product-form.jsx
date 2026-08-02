// Admin — real product entry: imagery, any number of sizes with their own
// prices and opening stock per store, and an immediate live/draft choice.
import React, { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea } from "../ds/components.jsx";
import { CAT_LABELS } from "./App.jsx";

const LOCS = [["abuja", "Abuja"], ["lagos", "Lagos"], ["ibadan", "Ibadan"]];
const GENDERS = ["Unisex", "Female", "Male"];
const blankVariant = () => ({ size: "", price: "", stock: { abuja: "", lagos: "", ibadan: "" } });

// Upload a chosen file and hand back its served URL.
export function ImagePicker({ ctx, value, onChange, label = "Product photo" }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlMode, setUrlMode] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "content-type": file.type, authorization: `Bearer ${ctx.token}` },
        body: file,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Upload failed (${res.status})`);
      onChange(d.url);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)" }}>{label}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 84, height: 84, borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface-sunken)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {value
            ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", padding: 6 }}>No photo</span>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {urlMode ? (
            <Input label="" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://…/photo.jpg" />
          ) : (
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pick(e.target.files && e.target.files[0])}
              style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-body)" }} />
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setUrlMode(!urlMode)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mr-purple-700)", padding: 0 }}>
              {urlMode ? "Upload a file instead" : "Paste a URL instead"}
            </button>
            {value && <button onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-muted)", padding: 0 }}>Remove</button>}
            {busy && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Uploading…</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>JPEG/PNG/WebP up to 1.5MB. Square images look best.</div>
          {err && <div style={{ fontSize: 12, color: "#c0587a" }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

function VariantRows({ variants, setVariants, showStock = true }) {
  const set = (i, patch) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setStock = (i, loc, val) => set(i, { stock: { ...variants[i].stock, [loc]: val.replace(/\D/g, "") } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)" }}>Sizes, prices &amp; opening stock</div>
      {variants.map((v, i) => (
        <div key={i} style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <Input label="Size" value={v.size} onChange={(e) => set(i, { size: e.target.value })} placeholder="30ml" style={{ flex: 1 }} />
            <Input label="Price (₦)" value={v.price} onChange={(e) => set(i, { price: e.target.value.replace(/\D/g, "") })} placeholder="35000" style={{ flex: 1 }} />
            {variants.length > 1 && (
              <button onClick={() => setVariants(variants.filter((_, j) => j !== i))} title="Remove this size"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)", paddingBottom: 12 }}>Remove</button>
            )}
          </div>
          {showStock && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {LOCS.map(([id, label]) => (
                <Input key={id} label={label} value={v.stock[id] ?? ""} onChange={(e) => setStock(i, id, e.target.value)} placeholder="0" />
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={() => setVariants(variants.concat(blankVariant()))}
        style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>
        + Add another size
      </button>
    </div>
  );
}

export function NewProduct({ ctx }) {
  const [f, setF] = useState({ name: "", cat: "extrait", gender: "Unisex", notes: "", desc: "", imageUrl: "", live: true });
  const [variants, setVariants] = useState([blankVariant()]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api.post("/api/admin/products", { ...f, variants }, ctx.token);
      setDone({ name: r.name, live: r.live });
      setF({ name: "", cat: f.cat, gender: f.gender, notes: "", desc: "", imageUrl: "", live: true });
      setVariants([blankVariant()]);
      ctx.loadProducts();
      ctx.flash(r.live ? `${r.name} is live` : `${r.name} saved as draft`);
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Add a product</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Set it live and it appears on the storefront immediately.</div>
      </div>
      {done && (
        <div style={{ background: done.live ? "#e4efe4" : "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 13, color: done.live ? "#3f6b45" : "var(--mr-purple-900)" }}>
          <strong>{done.name}</strong> {done.live ? "is live on the storefront." : "is saved as a draft — flip it live when ready."}
        </div>
      )}
      <Input label="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Velvet Reign" />
      <ImagePicker ctx={ctx} value={f.imageUrl} onChange={(url) => setF({ ...f, imageUrl: url })} />
      <Select label="Category" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
        {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <Select label="Worn by" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
        {GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}
      </Select>
      <VariantRows variants={variants} setVariants={setVariants} />
      <Textarea label="Scent notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Oud, saffron, smoked amber" />
      <Textarea label="Product description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={3} placeholder="A short, evocative description shoppers read on the product page." />
      <Switch label="Live on the storefront now" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
      <Button variant="primary" block disabled={busy} onClick={submit}>{busy ? "Saving…" : "Add to catalogue"}</Button>
      {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
    </div>
  );
}

export function EditProductPanel({ ctx, product, onClose }) {
  const [f, setF] = useState({
    name: product.name, cat: product.cat, gender: product.gender,
    notes: product.notes, desc: product.desc, imageUrl: product.imageUrl || "",
  });
  const [prices, setPrices] = useState(Object.fromEntries(product.variants.map((v) => [v.id, String(v.ngn)])));
  const [addV, setAddV] = useState(null); // blankVariant() when adding
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
  const addSize = async () => {
    try {
      await api.post(`/api/admin/products/${encodeURIComponent(product.id)}/variants`, { size: addV.size, price: addV.price, stock: addV.stock }, ctx.token);
      setAddV(null); ctx.flash("Size added"); ctx.loadProducts();
    } catch (e) { ctx.authFail(e); setMsg(e.message); }
  };
  const delSize = async (v) => {
    if (!window.confirm(`Remove the ${v.size} size?`)) return;
    try { await api.del(`/api/admin/variants/${v.id}`, ctx.token); ctx.flash("Size removed"); ctx.loadProducts(); }
    catch (e) { ctx.authFail(e); setMsg(e.message); }
  };
  const del = async () => {
    if (!window.confirm(`Delete "${product.name}"? It disappears from the storefront. Past orders keep their record.`)) return;
    try { await api.del(`/api/admin/products/${encodeURIComponent(product.id)}`, ctx.token); ctx.flash("Product deleted"); ctx.loadProducts(); onClose(); }
    catch (e) { ctx.authFail(e); setMsg(e.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Edit product</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>Close</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>Changes go live on the storefront immediately.</div>
      <Input label="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <ImagePicker ctx={ctx} value={f.imageUrl} onChange={(url) => setF({ ...f, imageUrl: url })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Select label="Category" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        {/* The imported catalogue lands as Unisex — this is where it gets set properly. */}
        <Select label="Worn by" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          {GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 8 }}>Sizes &amp; prices</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {product.variants.map((v) => (
            <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ width: 58, fontSize: 13, color: "var(--text-body)" }}>{v.size}</span>
              <input value={prices[v.id]} onChange={(e) => setPrices({ ...prices, [v.id]: e.target.value.replace(/\D/g, "") })}
                style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 14, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", color: "var(--text-strong)", background: "var(--surface-card)" }} />
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", width: 74 }}>{(v.stock.abuja || 0) + (v.stock.lagos || 0) + (v.stock.ibadan || 0)} in stock</span>
              {product.variants.length > 1 && (
                <button onClick={() => delSize(v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)" }}>Remove</button>
              )}
            </div>
          ))}
        </div>
        {addV ? (
          <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Input label="New size" value={addV.size} onChange={(e) => setAddV({ ...addV, size: e.target.value })} placeholder="50ml" style={{ flex: 1 }} />
              <Input label="Price (₦)" value={addV.price} onChange={(e) => setAddV({ ...addV, price: e.target.value.replace(/\D/g, "") })} placeholder="50000" style={{ flex: 1 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {LOCS.map(([id, label]) => (
                <Input key={id} label={label} value={addV.stock[id]} onChange={(e) => setAddV({ ...addV, stock: { ...addV.stock, [id]: e.target.value.replace(/\D/g, "") } })} placeholder="0" />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" size="sm" onClick={addSize}>Save size</Button>
              <button onClick={() => setAddV(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddV(blankVariant())} style={{ marginTop: 10, background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>+ Add a size</button>
        )}
      </div>

      <Textarea label="Scent notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
      <Textarea label="Product description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={3} />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
        <button onClick={del} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#c0587a", fontFamily: "var(--font-sans)", marginLeft: "auto" }}>Delete product</button>
      </div>
      {msg && <div style={{ fontSize: 12, color: "#c0587a" }}>{msg}</div>}
    </div>
  );
}
