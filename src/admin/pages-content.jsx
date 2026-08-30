// Admin — the content the storefront's new header leads to: categories and
// their sub-shelves, deals, the journal, and the reviews wall.
import React, { useState } from "react";
import { api } from "../lib/api.js";
import { Button, Input, Select, Switch, Textarea } from "../ds/components.jsx";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };
const two = { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" };
const pageStyle = { padding: "26px 28px 48px", ...two };

function Intro({ title, children }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Panel({ title, onClose, children }) {
  return (
    <div style={{ ...card, padding: 24, position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
        {onClose && <button onClick={onClose} style={{ ...linkBtn, color: "var(--text-muted)" }}>Close</button>}
      </div>
      {children}
    </div>
  );
}

// Products are picked the same way everywhere here: search, tick, and the chips
// above show what is already in.
function ProductPicker({ ctx, ids, toggle }) {
  const [q, setQ] = useState("");
  const matches = ctx.products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const chosen = ids.map((id) => ctx.products.find((p) => p.id === id)).filter(Boolean);
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 6 }}>
        Products {chosen.length > 0 && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>— {chosen.length} chosen</span>}
      </div>
      {chosen.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {chosen.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} title="Remove"
              style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "var(--mr-lavender-200)", border: "none", borderRadius: "var(--radius-pill)", padding: "5px 10px", fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--mr-purple-900)", cursor: "pointer" }}>
              {p.name} <span style={{ opacity: 0.7 }}>✕</span>
            </button>
          ))}
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalogue…"
        style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: 13, padding: "9px 12px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", outline: "none", background: "var(--surface-card)", color: "var(--text-strong)", marginBottom: 8 }} />
      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)" }}>
        {matches.slice(0, 60).map((p) => {
          const on = ids.includes(p.id);
          return (
            <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border-hairline)", cursor: "pointer", background: on ? "var(--surface-sunken)" : "transparent" }}>
              <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ accentColor: "var(--mr-purple-800)", width: 14, height: 14 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-strong)" }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ctx.catLabel(p.cat)}</span>
            </label>
          );
        })}
        {!matches.length && <div style={{ padding: 12, fontSize: 12.5, color: "var(--text-muted)" }}>Nothing matches that search.</div>}
      </div>
    </div>
  );
}

// ---- Categories -----------------------------------------------------------

const SUBCATS = [
  { id: "new-arrivals", label: "New arrivals" },
  { id: "best-sellers", label: "Best sellers" },
  { id: "gift-sets", label: "Gift sets" },
];
const GROUPS = [
  { id: "", label: "Ungrouped" },
  { id: "fragrance", label: "Fragrances" },
  { id: "gift", label: "Gift & sets" },
  { id: "care", label: "Feminine care" },
];

export function CategoriesPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = { label: "", desc: "", grp: "", live: true, subcats: SUBCATS.map((s) => s.id) };
  const open = (c) => {
    setErr("");
    setEditing(c ? c.id : "new");
    setF(c ? { label: c.label, desc: c.desc, grp: c.grp, live: c.live, subcats: (c.subcats || []).slice() } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (editing === "new") await api.post("/api/admin/categories", f, ctx.token);
      else await api.patch(`/api/admin/categories/${encodeURIComponent(editing)}`, f, ctx.token);
      ctx.loadCategories(); ctx.loadProducts();
      ctx.flash(editing === "new" ? "Category added" : "Category updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.label}"? Only an empty category can go — its products would lose their shelf otherwise.`)) return;
    try {
      await api.del(`/api/admin/categories/${encodeURIComponent(c.id)}`, ctx.token);
      ctx.loadCategories();
      ctx.flash("Category deleted");
      close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const patch = async (c, body, note) => {
    try {
      await api.patch(`/api/admin/categories/${encodeURIComponent(c.id)}`, body, ctx.token);
      ctx.loadCategories();
      if (note) ctx.flash(note);
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const move = async (c, dir) => {
    const ordered = ctx.categories.slice().sort((a, b) => a.sort - b.sort);
    const i = ordered.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    await patch(c, { sort: ordered[j].sort });
    await patch(ordered[j], { sort: c.sort });
  };

  const toggleSub = (id) => setF((s) => ({ ...s, subcats: s.subcats.includes(id) ? s.subcats.filter((x) => x !== id) : s.subcats.concat(id) }));

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Categories & sub-shelves">
          A category is where a product lives — one each. Shoppers reach them from <strong>All categories</strong> in the storefront
          header, and every category can offer up to three sub-shelves: <strong>New arrivals</strong>, <strong>Best sellers</strong> and
          <strong> Gift sets</strong>. Those three fill themselves — by listing date, by real paid orders, and by which categories are
          grouped as gift &amp; sets — so there is nothing to keep up to date.
        </Intro>
        {ctx.categories.slice().sort((a, b) => a.sort - b.sort).map((c, i, all) => (
          <div key={c.id} style={{ ...card, padding: 18, opacity: c.live ? 1 : 0.62 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)" }}>{c.label}</div>
                {c.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{c.desc}</div>}
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                  {c.products} {c.products === 1 ? "product" : "products"} · /shop?category={c.id}
                  {c.grp ? ` · ${(GROUPS.find((g) => g.id === c.grp) || {}).label}` : ""}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {(c.subcats || []).map((sc) => (
                    <span key={sc} style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", color: "var(--mr-purple-800)" }}>
                      {(SUBCATS.find((s) => s.id === sc) || {}).label || sc}
                    </span>
                  ))}
                  {!(c.subcats || []).length && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>No sub-shelves</span>}
                </div>
              </div>
              <Switch checked={c.live} onChange={() => patch(c, { live: !c.live }, c.live ? `${c.label} hidden` : `${c.label} is live`)} />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(c)} style={linkBtn}>Edit →</button>
              <button onClick={() => move(c, -1)} disabled={i === 0} style={{ ...linkBtn, opacity: i === 0 ? 0.4 : 1 }}>↑ Move up</button>
              <button onClick={() => move(c, 1)} disabled={i === all.length - 1} style={{ ...linkBtn, opacity: i === all.length - 1 ? 0.4 : 1 }}>↓ Move down</button>
              <button onClick={() => remove(c)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit category" : "New category"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>Add a shelf, rename one, reorder the menu, or decide which sub-shelves a category offers.</div>
            <Button variant="primary" block onClick={() => open(null)}>Add a category</Button>
          </>
        ) : (
          <>
            <Input label="Name" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Attar Oils"
              hint={editing === "new" ? "The URL is made from this and never changes afterwards." : ""} />
            <Textarea label="Description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={2} placeholder="One line shoppers read under the heading." />
            <Select label="Group" value={f.grp} onChange={(e) => setF({ ...f, grp: e.target.value })}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: -8 }}>
              Anything grouped as <strong>Gift &amp; sets</strong> is what the storefront's Gift sets shelf is made of.
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-strong)", marginBottom: 8 }}>Sub-shelves shoppers can filter by</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SUBCATS.map((s) => (
                  <Switch key={s.id} label={s.label} checked={f.subcats.includes(s.id)} onChange={() => toggleSub(s.id)} />
                ))}
              </div>
            </div>
            <Switch label="Live in the storefront menu" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
            <Button variant="primary" block disabled={busy || !f.label.trim()} onClick={save}>
              {busy ? "Saving…" : editing === "new" ? "Add category" : "Save changes"}
            </Button>
            {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
          </>
        )}
      </Panel>
    </main>
  );
}

// ---- Deals ----------------------------------------------------------------

export function DealsPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = { title: "", desc: "", badge: "Hot deal", startsAt: "", endsAt: "", status: "Active", productIds: [] };
  const open = (d) => {
    setErr("");
    setEditing(d ? d.id : "new");
    setF(d ? { title: d.title, desc: d.desc, badge: d.badge, startsAt: d.startsAt, endsAt: d.endsAt, status: d.status, productIds: d.productIds.slice() } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (editing === "new") await api.post("/api/admin/deals", f, ctx.token);
      else await api.patch(`/api/admin/deals/${encodeURIComponent(editing)}`, f, ctx.token);
      ctx.loadDeals();
      ctx.flash(editing === "new" ? "Deal created" : "Deal updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.title}"? The products stay in the catalogue at their usual prices.`)) return;
    try {
      await api.del(`/api/admin/deals/${encodeURIComponent(d.id)}`, ctx.token);
      ctx.loadDeals();
      ctx.flash("Deal deleted");
      close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const endNow = async (d) => {
    try {
      await api.patch(`/api/admin/deals/${encodeURIComponent(d.id)}`, { status: d.status === "Active" ? "Ended" : "Active" }, ctx.token);
      ctx.loadDeals();
      ctx.flash(d.status === "Active" ? "Deal ended" : "Deal running again");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const toggle = (id) => setF((s) => ({ ...s, productIds: s.productIds.includes(id) ? s.productIds.filter((x) => x !== id) : s.productIds.concat(id) }));

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Deals & hot offers">
          What fills the <strong>Deals</strong> tab on the storefront. A deal names its products, carries a badge, and runs between two
          dates — when the end date passes it leaves the storefront on its own, with nothing to switch off. Any product whose
          compare-at price is above its selling price also shows up there, deal or no deal.
        </Intro>
        {!ctx.deals.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>No deals yet</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Build one beside this — a title, the pieces, and the dates it runs between.</div>
          </div>
        )}
        {ctx.deals.map((d) => (
          <div key={d.id} style={{ ...card, padding: 18, opacity: d.live ? 1 : 0.62 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "var(--accent-gold)", color: "var(--mr-purple-950)" }}>{d.badge}</span>
                  <span style={{ fontSize: 11.5, color: d.live ? "#3f6b45" : "var(--text-muted)" }}>{d.live ? "Running now" : d.status === "Ended" ? "Ended" : "Outside its dates"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginTop: 8 }}>{d.title}</div>
                {d.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{d.desc}</div>}
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                  {d.productIds.length} {d.productIds.length === 1 ? "piece" : "pieces"} · {d.startsAt || "starts now"} → {d.endsAt || "until ended"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(d)} style={linkBtn}>Edit →</button>
              <button onClick={() => endNow(d)} style={linkBtn}>{d.status === "Active" ? "End now" : "Start again"}</button>
              <button onClick={() => remove(d)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit deal" : "New deal"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>Put a set of pieces on the Deals tab for a period.</div>
            <Button variant="primary" block onClick={() => open(null)}>Start a deal</Button>
          </>
        ) : (
          <>
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Detty December" />
            <Textarea label="Description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={2} placeholder="One line shoppers read under the title." />
            <Input label="Badge" value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="Hot deal" hint="The little tag on the deal card." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Starts" type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} hint="Blank = right away." />
              <Input label="Ends" type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} hint="Inclusive. Blank = until you end it." />
            </div>
            <ProductPicker ctx={ctx} ids={f.productIds} toggle={toggle} />
            <Button variant="primary" block disabled={busy || !f.title.trim()} onClick={save}>
              {busy ? "Saving…" : editing === "new" ? "Create deal" : "Save changes"}
            </Button>
            {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
          </>
        )}
      </Panel>
    </main>
  );
}

// ---- The journal ----------------------------------------------------------

export function BlogPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = { title: "", slug: "", excerpt: "", body: "", coverUrl: "", author: "Majestic Roobee", tags: "", status: "draft" };
  const open = (p) => {
    setErr("");
    setEditing(p ? p.id : "new");
    setF(p ? { title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body, coverUrl: p.coverUrl, author: p.author, tags: p.tags, status: p.status } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async (status) => {
    setBusy(true); setErr("");
    const body = status ? { ...f, status } : f;
    try {
      if (editing === "new") await api.post("/api/admin/blog", body, ctx.token);
      else await api.patch(`/api/admin/blog/${editing}`, body, ctx.token);
      ctx.loadPosts();
      ctx.flash(body.status === "published" ? "Published" : "Saved as a draft");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? Anyone holding a link to it will get a not-found page.`)) return;
    try {
      await api.del(`/api/admin/blog/${p.id}`, ctx.token);
      ctx.loadPosts();
      ctx.flash("Post deleted");
      close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const setStatus = async (p, status) => {
    try {
      await api.patch(`/api/admin/blog/${p.id}`, { status }, ctx.token);
      ctx.loadPosts();
      ctx.flash(status === "published" ? "Published" : "Moved back to drafts");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="The journal">
          Stories on the storefront at <strong>/blog</strong>, with the three most recent on the home page. Write in plain text: leave a
          blank line between paragraphs, start a line with <code>## </code> for a heading or <code>&gt; </code> for a pull quote, and put a
          bare image URL on its own line to drop a picture in. A draft is invisible until you publish it.
        </Intro>
        {!ctx.posts.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>Nothing written yet</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Start the first story in the editor beside this.</div>
          </div>
        )}
        {ctx.posts.map((p) => (
          <div key={p.id} style={{ ...card, padding: 18, opacity: p.status === "published" ? 1 : 0.68 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: p.status === "published" ? "#e4efe4" : "var(--surface-sunken)", color: p.status === "published" ? "#3f6b45" : "var(--mr-purple-800)" }}>
                {p.status === "published" ? "Live" : "Draft"}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>/blog/{p.slug}</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginTop: 8 }}>{p.title}</div>
            {p.excerpt && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{p.excerpt}</div>}
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              {p.author}{p.tags ? ` · ${p.tags}` : ""}{p.publishedAt ? ` · ${String(p.publishedAt).slice(0, 10)}` : ""}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(p)} style={linkBtn}>Edit →</button>
              <button onClick={() => setStatus(p, p.status === "published" ? "draft" : "published")} style={linkBtn}>
                {p.status === "published" ? "Move to drafts" : "Publish"}
              </button>
              {p.status === "published" && <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5 }}>View →</a>}
              <button onClick={() => remove(p)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit story" : "New story"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>Write about a launch, how to layer a scent, or how to make one last all day.</div>
            <Button variant="primary" block onClick={() => open(null)}>Write a story</Button>
          </>
        ) : (
          <>
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="How to make an extrait last all day" />
            {editing !== "new" && (
              <Input label="URL slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })}
                hint="Changing this breaks any link already shared to the old address." />
            )}
            <Textarea label="Excerpt" value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} rows={2}
              hint="The line under the title on the cards and in search results." />
            <Input label="Cover image URL" value={f.coverUrl} onChange={(e) => setF({ ...f, coverUrl: e.target.value })} placeholder="/images/…"
              hint="Upload it under Products → the image picker, then paste the address here." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
              <Input label="Tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="layering, care" hint="Comma-separated." />
            </div>
            <Textarea label="The story" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={14}
              placeholder={"Open with the thing worth knowing.\n\n## A heading\n\nAnother paragraph.\n\n> A line worth pulling out.\n\nhttps://…/an-image.jpg"} />
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="primary" disabled={busy || !f.title.trim()} onClick={() => save("published")}>{busy ? "Saving…" : "Publish"}</Button>
              <Button variant="secondary" disabled={busy || !f.title.trim()} onClick={() => save("draft")}>Save as draft</Button>
            </div>
            {err && <div style={{ fontSize: 12, color: "#c0587a" }}>{err}</div>}
          </>
        )}
      </Panel>
    </main>
  );
}

// ---- Reviews & testimonials ----------------------------------------------

const KIND_LABELS = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", video: "Video file", quote: "Written quote" };

export function TestimonialsPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = { url: "", author: "", handle: "", quote: "", rating: 5, city: "", productId: "", thumbUrl: "", live: true };
  const open = (t) => {
    setErr("");
    setEditing(t ? t.id : "new");
    setF(t ? { url: t.url, author: t.author, handle: t.handle, quote: t.quote, rating: t.rating, city: t.city, productId: t.productId, thumbUrl: t.thumbUrl, live: t.live } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      if (editing === "new") await api.post("/api/admin/testimonials", f, ctx.token);
      else await api.patch(`/api/admin/testimonials/${editing}`, f, ctx.token);
      ctx.loadTestimonials();
      ctx.flash(editing === "new" ? "Testimonial added" : "Testimonial updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (t) => {
    if (!window.confirm("Remove this testimonial from the storefront?")) return;
    try {
      await api.del(`/api/admin/testimonials/${t.id}`, ctx.token);
      ctx.loadTestimonials();
      ctx.flash("Testimonial removed");
      close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const patch = async (t, body) => {
    try {
      await api.patch(`/api/admin/testimonials/${t.id}`, body, ctx.token);
      ctx.loadTestimonials();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const move = async (t, dir) => {
    const ordered = ctx.testimonials.slice().sort((a, b) => a.sort - b.sort);
    const i = ordered.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    await patch(t, { sort: ordered[j].sort });
    await patch(ordered[j], { sort: t.sort });
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Reviews & testimonials">
          The wall at <strong>/reviews</strong>, and the three shown on the home page. Paste the link to an Instagram post or reel, a
          TikTok or a YouTube video and it is embedded exactly as your customer published it — we work out which platform it is from the
          address, so a copied link with tracking on the end is fine. No link? Write the testimonial out as a quote instead.
        </Intro>
        {!ctx.testimonials.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>The wall is empty</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Add the first post beside this — paste a link and it embeds itself.</div>
          </div>
        )}
        {ctx.testimonials.map((t, i, all) => (
          <div key={t.id} style={{ ...card, padding: 18, opacity: t.live ? 1 : 0.62 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "var(--surface-sunken)", color: "var(--mr-purple-800)" }}>
                  {KIND_LABELS[t.kind] || t.kind}
                </span>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginTop: 8 }}>{t.author || t.handle || "Anonymous"}</div>
                {t.quote && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.6 }}>“{t.quote}”</div>}
                {t.url && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, wordBreak: "break-all" }}>{t.url}</div>}
              </div>
              <Switch checked={t.live} onChange={() => patch(t, { live: !t.live })} />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(t)} style={linkBtn}>Edit →</button>
              <button onClick={() => move(t, -1)} disabled={i === 0} style={{ ...linkBtn, opacity: i === 0 ? 0.4 : 1 }}>↑ Move up</button>
              <button onClick={() => move(t, 1)} disabled={i === all.length - 1} style={{ ...linkBtn, opacity: i === all.length - 1 ? 0.4 : 1 }}>↓ Move down</button>
              <button onClick={() => remove(t)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit testimonial" : "New testimonial"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>Embed a customer's own post, or write out what they told you.</div>
            <Button variant="primary" block onClick={() => open(null)}>Add a testimonial</Button>
          </>
        ) : (
          <>
            <Input label="Post link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })}
              placeholder="https://www.instagram.com/p/…"
              hint="Instagram post or reel, TikTok video, YouTube video, or a direct .mp4 link." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Customer" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Dorothy" />
              <Input label="Handle" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} placeholder="@northern_hibiscuss" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Cross River" />
              <Select label="Rating" value={String(f.rating)} onChange={(e) => setF({ ...f, rating: parseInt(e.target.value, 10) })}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </Select>
            </div>
            <Textarea label="Quote" value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} rows={3}
              hint="Required when there is no post link — otherwise it is shown under the embed." />
            <Select label="About which product (optional)" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
              <option value="">Not tied to one</option>
              {ctx.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Switch label="Live on the storefront" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
            <Button variant="primary" block disabled={busy} onClick={save}>
              {busy ? "Saving…" : editing === "new" ? "Add testimonial" : "Save changes"}
            </Button>
            {err && <div style={{ fontSize: 12, color: "#c0587a", textAlign: "center" }}>{err}</div>}
          </>
        )}
      </Panel>
    </main>
  );
}
