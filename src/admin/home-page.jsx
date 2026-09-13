// Admin — the home page.
//
// Every band, shelf, heading and tile on the storefront's home page is a row
// here. Two asks landed on this screen: "let us choose which products show
// under Best sellers and Ready at your store", and "make the home fragrance
// banner look like the feminine care one, and let us change those pictures".
// Both were the same sentence — the home page was written into a file — so
// both are answered by the same list.
import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea } from "../ds/components.jsx";
import { ImagePicker } from "./product-form.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };

// What each kind is, in the house's own words, so the list reads as the page
// rather than as a table of records.
const KIND_LABEL = {
  tile: "Banner tile", band: "Banner", shelf: "Product row",
  perks: "The three promises", categories: "Shop by category", story: "The founder's story",
  rewards: "How rewards work", reviews: "Reviews rail", blog: "From the blog",
  newsletter: "Join the list", instagram: "Instagram",
};
const KIND_NOTE = {
  tile: "Under the hero. A picture, two lines and somewhere to go.",
  band: "A wide band: the copy on one side, and either the bottles or a button.",
  shelf: "A heading and a row of product cards.",
};
// Which kinds actually show products, and can therefore be curated.
const PRODUCT_KINDS = new Set(["band", "shelf"]);

const SOURCE_LABEL = {
  segment: "A computed shelf (best sellers, new, deals, gift sets)",
  category: "A category — everything filed under it",
  collection: "A collection you curated",
  "in-city": "Whatever is in stock in the shopper's city",
  manual: "Products I choose, by hand",
  none: "No products — just the copy and a button",
};
const SEGMENTS = ["best-sellers", "new-arrivals", "deals", "gift-sets"];

export function HomePageAdmin({ ctx }) {
  const [blocks, setBlocks] = useState(null);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");

  const load = () => api.get("/api/admin/home-blocks", ctx.token).then((r) => setBlocks(r.blocks)).catch(ctx.authFail);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!blocks) return <main style={{ padding: "26px 28px" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Reading the home page…</span></main>;

  const tiles = blocks.filter((b) => b.kind === "tile");
  const flow = blocks.filter((b) => b.kind !== "tile");

  const open = (b) => {
    setErr("");
    setEditing(b.id);
    setF({ ...b, lines: (b.lines || []).join("\n"), count: String(b.count) });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      await api.patch(`/api/admin/home-blocks/${encodeURIComponent(editing)}`, { ...f, count: parseInt(f.count, 10) || 0 }, ctx.token);
      await load();
      ctx.flash("Home page updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const patch = async (b, body) => {
    try {
      await api.patch(`/api/admin/home-blocks/${encodeURIComponent(b.id)}`, body, ctx.token);
      await load();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  // Reordering sends the whole sequence, so the page cannot end up half-sorted
  // if one request lands and the next one does not.
  const move = async (list, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    const ids = (list[0].kind === "tile" ? next.concat(flow) : tiles.concat(next)).map((b) => b.id);
    setBlocks(list[0].kind === "tile" ? next.concat(flow) : tiles.concat(next));
    try {
      await api.put("/api/admin/home-blocks/order", { ids }, ctx.token);
      await load();
    } catch (e) { ctx.authFail(e); load(); }
  };

  const add = async (kind) => {
    setAdding(kind);
    try {
      const r = await api.post("/api/admin/home-blocks", { kind, title: kind === "tile" ? "New tile" : "New section" }, ctx.token);
      await load();
      const made = (await api.get("/api/admin/home-blocks", ctx.token)).blocks.find((b) => b.id === r.id);
      if (made) open(made);
      ctx.flash("Added — hidden until you publish it");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); } finally { setAdding(""); }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete "${b.title || KIND_LABEL[b.kind]}" from the home page?`)) return;
    try {
      await api.del(`/api/admin/home-blocks/${encodeURIComponent(b.id)}`, ctx.token);
      await load();
      ctx.flash("Removed");
      if (editing === b.id) close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const pick = (id) => setF((s) => ({
    ...s,
    productIds: s.productIds.includes(id) ? s.productIds.filter((x) => x !== id) : s.productIds.concat(id),
  }));

  const row = (b, i, list) => {
    const n = b.productIds.length;
    return (
      <div key={b.id} style={{ ...card, padding: 16, opacity: b.live ? 1 : 0.6, border: editing === b.id ? "1px solid var(--mr-purple-700)" : card.border }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {KIND_LABEL[b.kind] || b.kind}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16.5, color: "var(--text-strong)", marginTop: 4 }}>
              {b.title || b.eyebrow || <span style={{ color: "var(--text-muted)" }}>Untitled</span>}
            </div>
            {PRODUCT_KINDS.has(b.kind) && (
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>
                {b.source === "manual"
                  ? `${n} product${n === 1 ? "" : "s"} chosen by hand`
                  : b.source === "none" ? "Copy and a button"
                  : `${SOURCE_LABEL[b.source] || b.source}${b.refId ? ` — ${b.refId}` : ""}`}
                {b.source !== "none" && ` · shows ${b.count}`}
              </div>
            )}
          </div>
          <Switch checked={b.live} onChange={() => patch(b, { live: !b.live })} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={() => open(b)} style={linkBtn}>Edit →</button>
          <button onClick={() => move(list, i, -1)} disabled={i === 0} style={{ ...linkBtn, opacity: i === 0 ? 0.35 : 1 }}>↑</button>
          <button onClick={() => move(list, i, 1)} disabled={i === list.length - 1} style={{ ...linkBtn, opacity: i === list.length - 1 ? 0.35 : 1 }}>↓</button>
          {["tile", "band", "shelf"].includes(b.kind) && (
            <button onClick={() => remove(b)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
          )}
        </div>
      </div>
    );
  };

  const matches = ctx.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const collections = ctx.collections || [];
  const cats = ctx.catOptions || [];

  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>The home page</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>
            Everything below is a section of the storefront&apos;s home page, in the order it runs. Reorder it, rewrite any heading,
            change a photograph, switch a section off, or add a banner of your own. A <strong>product row</strong> and a
            <strong> banner</strong> can take the products you pick by hand instead of the ones the shop works out for itself —
            though a piece that has sold out or been taken off the floor is always dropped, and a short row is topped up, so
            a hand-picked shelf can never promise something nobody can buy.
          </div>
        </div>

        <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 4 }}>
          Tiles under the hero
        </div>
        {tiles.map((b, i) => row(b, i, tiles))}
        <button onClick={() => add("tile")} disabled={adding === "tile"} style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>
          {adding === "tile" ? "Adding…" : "+ Add a tile"}
        </button>

        <div style={{ fontSize: 11, fontFamily: "var(--font-condensed)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14 }}>
          Down the page
        </div>
        {flow.map((b, i) => row(b, i, flow))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => add("band")} disabled={adding === "band"} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>
            {adding === "band" ? "Adding…" : "+ Add a banner"}
          </button>
          <button onClick={() => add("shelf")} disabled={adding === "shelf"} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>
            {adding === "shelf" ? "Adding…" : "+ Add a product row"}
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: 22, position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14, maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
        {!f ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Pick a section on the left to edit its words, its picture and what it shows.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{KIND_LABEL[f.kind] || f.kind}</div>
              <button onClick={close} style={{ ...linkBtn, color: "var(--text-muted)" }}>Close</button>
            </div>
            {KIND_NOTE[f.kind] && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>{KIND_NOTE[f.kind]}</div>}

            <Input label="Small line above" value={f.eyebrow} onChange={(e) => setF({ ...f, eyebrow: e.target.value })}
              hint="Type {city} and it becomes wherever the shopper is shopping." />
            <Input label="Heading" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            {["shelf", "categories", "rewards", "instagram", "newsletter"].includes(f.kind) && (
              <Textarea label="Line under the heading" value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} rows={2} />
            )}
            {f.kind === "band" && (
              <Textarea label="The copy" value={f.lines} onChange={(e) => setF({ ...f, lines: e.target.value })} rows={3}
                hint="One line each. They stack under the heading." />
            )}

            {f.kind === "tile" && (
              <ImagePicker ctx={ctx} label="Picture" value={f.imageUrl || ""} onChange={(url) => setF({ ...f, imageUrl: url })}
                hint="Landscape crops best. Leave it empty and the monogram shows instead." />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Button / link text" value={f.ctaLabel} onChange={(e) => setF({ ...f, ctaLabel: e.target.value })} placeholder="Shop best sellers" />
              <Input label="Where it goes" value={f.ctaTarget} onChange={(e) => setF({ ...f, ctaTarget: e.target.value })} placeholder="/best-sellers"
                hint="A page of the shop: /shop, /deals, /shop?category=home." />
            </div>

            {f.kind === "band" && (
              <Select label="How it looks" value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value })}>
                <option value="product-band">With the products beside the copy</option>
                <option value="cta-band">Just the copy and a button</option>
              </Select>
            )}

            {PRODUCT_KINDS.has(f.kind) && f.layout !== "cta-band" && (
              <>
                <Select label="What it shows" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value, refId: "" })}>
                  {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                {f.source === "segment" && (
                  <Select label="Which shelf" value={f.refId} onChange={(e) => setF({ ...f, refId: e.target.value })}>
                    <option value="">Choose…</option>
                    {SEGMENTS.map((sg) => <option key={sg} value={sg}>{sg.replace("-", " ")}</option>)}
                  </Select>
                )}
                {f.source === "category" && (
                  <Select label="Which category" value={f.refId} onChange={(e) => setF({ ...f, refId: e.target.value })}>
                    <option value="">Choose…</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                )}
                {f.source === "collection" && (
                  <Select label="Which collection" value={f.refId} onChange={(e) => setF({ ...f, refId: e.target.value })}>
                    <option value="">Choose…</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </Select>
                )}
                {f.source !== "none" && (
                  <Input label="How many to show" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, "") })} placeholder="4" />
                )}
                {f.source === "manual" && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 4 }}>The products, in your order</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.6 }}>
                      Anything sold out or taken off the shop floor drops out on its own, and a row left short is filled from the
                      catalogue — so this is your preference, not a promise the shop has to keep.
                    </div>
                    {f.productIds.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {f.productIds.map((id, i) => {
                          const p = ctx.products.find((x) => x.id === id);
                          return (
                            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: "var(--radius-pill)", background: "var(--mr-lavender-200)", color: "var(--mr-purple-800)" }}>
                              {i + 1}. {p ? p.name : id}
                              <button onClick={() => pick(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mr-purple-800)", fontSize: 13, padding: 0 }}>×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)" }} />
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", marginTop: 8 }}>
                      {matches.slice(0, 60).map((p) => (
                        <button key={p.id} onClick={() => pick(p.id)}
                          style={{ display: "block", width: "100%", textAlign: "left", background: f.productIds.includes(p.id) ? "var(--surface-sunken)" : "none", border: "none", borderBottom: "1px solid var(--border-hairline)", padding: "9px 12px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--text-body)" }}>
                          {f.productIds.includes(p.id) ? "✓ " : ""}{p.name}
                        </button>
                      ))}
                      {!matches.length && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>Nothing matches that.</div>}
                    </div>
                  </div>
                )}
              </>
            )}

            {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border-hairline)", paddingTop: 14 }}>
              <Button variant="primary" size="sm" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
              <Switch label="Live on the home page" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
