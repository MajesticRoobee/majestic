// Admin — real product entry. Each variation is a product in its own right:
// its own SKU, price, photo and opening stock per store, under one parent that
// the storefront presents as a single listing with a picker (or as separate
// cards, when "list each variation as its own card" is on).
import React, { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea } from "../ds/components.jsx";
import { resizeToWidths } from "../lib/images.js";

const GENDERS = ["Unisex", "Female", "Male"];
// Opening stock is one field per store the house has open — no fixed three.
const blankVariant = () => ({ size: "", price: "", sku: "", imageUrl: "", stock: {} });

// Upload a chosen file and hand back its served URL.
export function ImagePicker({ ctx, value, onChange, label = "Product photo" }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlMode, setUrlMode] = useState(false);

  // Upload the original, then the narrower copies the storefront serves to
  // phones. The original goes first because the derivatives are stored against
  // its id — and it is the only one that has to succeed: if the browser can't
  // re-encode (an exotic format, a very old browser), the photo is still
  // uploaded and every width simply resolves back to it.
  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const post = (body, headers) => fetch("/api/admin/media", {
        method: "POST",
        headers: { authorization: `Bearer ${ctx.token}`, ...headers },
        body,
      });

      const res = await post(file, { "content-type": file.type });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Upload failed (${res.status})`);
      onChange(d.url);

      try {
        const sizes = await resizeToWidths(file);
        await Promise.all(sizes.map((s) =>
          post(s.blob, { "content-type": s.mime, "x-parent": d.id, "x-width": String(s.width) })
        ));
      } catch {
        // Derivatives are an optimisation, not the upload.
        setErr("Photo saved, but the phone-sized copies couldn't be made — it will still display.");
      }
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

// Each row here is a variation, and a variation is a product in its own right:
// its own price, its own SKU, its own photo, its own stock in every store.
function VariantRows({ ctx, variants, setVariants, stores, showStock = true, optionName = "Size" }) {
  const set = (i, patch) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setStock = (i, loc, val) => set(i, { stock: { ...variants[i].stock, [loc]: val.replace(/\D/g, "") } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)" }}>Variations — {optionName.toLowerCase()}, price, photo &amp; opening stock</div>
      {variants.map((v, i) => (
        <div key={i} style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <Input label={optionName} value={v.size} onChange={(e) => set(i, { size: e.target.value })} placeholder="30ml" style={{ flex: 1 }} />
            <Input label="Price (₦)" value={v.price} onChange={(e) => set(i, { price: e.target.value.replace(/\D/g, "") })} placeholder="35000" style={{ flex: 1 }} />
            {variants.length > 1 && (
              <button onClick={() => setVariants(variants.filter((_, j) => j !== i))} title="Remove this variation"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)", paddingBottom: 12 }}>Remove</button>
            )}
          </div>
          <Input label="SKU (optional)" value={v.sku ?? ""} onChange={(e) => set(i, { sku: e.target.value })}
            placeholder="Leave blank and we'll generate one" hint="The code your ERP and stock counts refer to." />
          {ctx && (
            <ImagePicker ctx={ctx} value={v.imageUrl} onChange={(url) => set(i, { imageUrl: url })}
              label={`Photo for this ${optionName.toLowerCase()}`} />
          )}
          {showStock && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
              {stores.map((l) => (
                <Input key={l.id} label={l.city} value={v.stock[l.id] ?? ""} onChange={(e) => setStock(i, l.id, e.target.value)} placeholder="0" />
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={() => setVariants(variants.concat(blankVariant()))}
        style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>
        + Add another variation
      </button>
    </div>
  );
}

export function NewProduct({ ctx }) {
  const [f, setF] = useState({ name: "", cat: "extrait", brand: "", gender: "Unisex", notes: "", desc: "", imageUrl: "", live: true, optionName: "Size", splitListing: false, pinNew: false, pinBest: false });
  const [variants, setVariants] = useState([blankVariant()]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api.post("/api/admin/products", { ...f, optionNames: [f.optionName], variants }, ctx.token);
      setDone({ name: r.name, live: r.live });
      setF({ name: "", cat: f.cat, brand: f.brand, gender: f.gender, notes: "", desc: "", imageUrl: "", live: true, optionName: f.optionName, splitListing: f.splitListing, pinNew: false, pinBest: false });
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
        {ctx.catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </Select>
      <Select label="Worn by" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
        {GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}
      </Select>
      <Input label="Brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Majestic Roobee"
        hint="The label on the bottle. Shoppers browse by it on the Brands page — leave blank for the house's own blends." />
      <Input label="What the variations are called" value={f.optionName} onChange={(e) => setF({ ...f, optionName: e.target.value })}
        placeholder="Size" hint="Shown above the picker on the product page — usually Size, sometimes Scent or Shade." />
      <VariantRows ctx={ctx} variants={variants} setVariants={setVariants} stores={ctx.openStores} optionName={f.optionName || "Size"} />
      <Textarea label="Scent notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Oud, saffron, smoked amber" />
      <Textarea label="Product description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={3} placeholder="A short, evocative description shoppers read on the product page." />
      <Switch label="List each variation as its own card" checked={f.splitListing} onChange={(e) => setF({ ...f, splitListing: e.target.checked })} />
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -8 }}>
        Off (normal): one card in the shop with a picker on it. On: every variation gets its own card — for gift sets and distinct scents, where a picker would hide the choice.
      </div>
      <Switch label="Pin to New arrivals" checked={f.pinNew} onChange={(e) => setF({ ...f, pinNew: e.target.checked })} />
      <Switch label="Pin to Best sellers" checked={f.pinBest} onChange={(e) => setF({ ...f, pinBest: e.target.checked })} />
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -8 }}>
        Both shelves fill themselves — newest first, and best-selling by real orders. A pin puts this piece on one anyway, which is how a launch with no sales yet gets seen.
      </div>
      <Switch label="Live on the storefront now" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
      <Button variant="primary" block disabled={busy} onClick={submit}>{busy ? "Saving…" : "Add to catalogue"}</Button>
      {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
    </div>
  );
}

export function EditProductPanel({ ctx, product, onClose }) {
  const [f, setF] = useState({
    name: product.name, cat: product.cat, brand: product.brand || "", gender: product.gender,
    notes: product.notes, desc: product.desc, imageUrl: product.imageUrl || "",
    splitListing: !!product.splitListing,
    pinNew: !!product.pinNew, pinBest: !!product.pinBest,
    optionName: (product.optionNames && product.optionNames[0]) || "Size",
  });
  // Every editable field of every variation, keyed by its id.
  const [vf, setVf] = useState(() => Object.fromEntries(product.variants.map((v) => [
    v.id, { price: String(v.ngn), size: v.size, sku: v.sku || "", imageUrl: v.imageUrl || "" },
  ])));
  const [addV, setAddV] = useState(null); // blankVariant() when adding
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const setV = (id, patch) => setVf((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const { optionName, ...rest } = f;
      await api.patch(`/api/admin/products/${encodeURIComponent(product.id)}`, { ...rest, optionNames: [optionName] }, ctx.token);
      for (const v of product.variants) {
        const e = vf[v.id];
        if (!e) continue;
        const patch = {};
        const np = parseInt(e.price, 10);
        if (np && np !== v.ngn) patch.price = np;
        if (e.size.trim() && e.size.trim() !== v.size) patch.size = e.size.trim();
        if (e.sku.trim() !== (v.sku || "")) patch.sku = e.sku.trim();
        if (e.imageUrl !== (v.imageUrl || "")) patch.imageUrl = e.imageUrl;
        if (Object.keys(patch).length) await api.patch(`/api/admin/variants/${v.id}`, patch, ctx.token);
      }
      ctx.flash("Product updated");
      ctx.loadProducts();
      onClose();
    } catch (e) { ctx.authFail(e); setMsg(e.message); } finally { setBusy(false); }
  };
  const addSize = async () => {
    try {
      await api.post(`/api/admin/products/${encodeURIComponent(product.id)}/variants`,
        { size: addV.size, price: addV.price, sku: addV.sku, imageUrl: addV.imageUrl, stock: addV.stock }, ctx.token);
      setAddV(null); ctx.flash("Variation added"); ctx.loadProducts();
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
          {ctx.catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        {/* The imported catalogue lands as Unisex — this is where it gets set properly. */}
        <Select label="Worn by" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
          {GENDERS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
      </div>

      <Input label="Brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Majestic Roobee"
        hint="Shoppers browse by this on the Brands page. Blank means the house's own." />

      <Input label="What the variations are called" value={f.optionName} onChange={(e) => setF({ ...f, optionName: e.target.value })}
        placeholder="Size" hint="Shown above the picker on the product page." />

      <div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 4 }}>Variations</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>
          Each one is its own SKU with its own price and photo. Renaming a variation is safe — carts and past orders track it by identity, not by its label.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {product.variants.map((v) => {
            const e = vf[v.id] || { price: "", size: "", sku: "", imageUrl: "" };
            return (
              <div key={v.id} style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <Input label={f.optionName || "Size"} value={e.size} onChange={(ev) => setV(v.id, { size: ev.target.value })} style={{ flex: 1 }} />
                  <Input label="Price (₦)" value={e.price} onChange={(ev) => setV(v.id, { price: ev.target.value.replace(/\D/g, "") })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", width: 74, paddingBottom: 12 }}>
                    {Object.values(v.stock).reduce((n, q) => n + (q || 0), 0)} in stock
                  </span>
                  {product.variants.length > 1 && (
                    <button onClick={() => delSize(v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#c0587a", fontFamily: "var(--font-sans)", paddingBottom: 12 }}>Remove</button>
                  )}
                </div>
                <Input label="SKU" value={e.sku} onChange={(ev) => setV(v.id, { sku: ev.target.value })} placeholder="Leave blank to regenerate" />
                <ImagePicker ctx={ctx} value={e.imageUrl} onChange={(url) => setV(v.id, { imageUrl: url })}
                  label={`Photo for this ${(f.optionName || "size").toLowerCase()}`} />
              </div>
            );
          })}
        </div>
        {addV ? (
          <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Input label={`New ${(f.optionName || "size").toLowerCase()}`} value={addV.size} onChange={(e) => setAddV({ ...addV, size: e.target.value })} placeholder="50ml" style={{ flex: 1 }} />
              <Input label="Price (₦)" value={addV.price} onChange={(e) => setAddV({ ...addV, price: e.target.value.replace(/\D/g, "") })} placeholder="50000" style={{ flex: 1 }} />
            </div>
            <Input label="SKU (optional)" value={addV.sku} onChange={(e) => setAddV({ ...addV, sku: e.target.value })} placeholder="Leave blank and we'll generate one" />
            <ImagePicker ctx={ctx} value={addV.imageUrl} onChange={(url) => setAddV({ ...addV, imageUrl: url })} label="Photo for this variation" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
              {ctx.openStores.map((l) => (
                <Input key={l.id} label={l.city} value={addV.stock[l.id] ?? ""} onChange={(e) => setAddV({ ...addV, stock: { ...addV.stock, [l.id]: e.target.value.replace(/\D/g, "") } })} placeholder="0" />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" size="sm" onClick={addSize}>Save variation</Button>
              <button onClick={() => setAddV(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddV(blankVariant())} style={{ marginTop: 10, background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>+ Add a variation</button>
        )}
      </div>

      <div>
        <Switch label="List each variation as its own card" checked={f.splitListing} onChange={(e) => setF({ ...f, splitListing: e.target.checked })} />
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          Off: one card in the shop with a picker. On: {product.variants.length} separate cards.
        </div>
      </div>

      <div>
        <Switch label="Pin to New arrivals" checked={f.pinNew} onChange={(e) => setF({ ...f, pinNew: e.target.checked })} />
        <div style={{ height: 8 }} />
        <Switch label="Pin to Best sellers" checked={f.pinBest} onChange={(e) => setF({ ...f, pinBest: e.target.checked })} />
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          Both shelves fill themselves from the catalogue's age and the order book. A pin overrides that for this piece.
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
  );
}
