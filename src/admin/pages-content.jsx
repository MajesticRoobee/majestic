// Admin — the content the storefront's new header leads to: categories and
// their sub-shelves, deals, the blog, and the reviews wall.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Button, DealCard, Input, Select, Switch, Textarea } from "../ds/components.jsx";
import { ImagePicker } from "./product-form.jsx";
import { catTree, countIn } from "../lib/categories.js";
import { PREVIEW_MAX, TITLE_MAX, TITLE_MAX_WORDS, words } from "../lib/blog.js";

const card = { background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-700)", padding: 0 };
const two = { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" };
const pageStyle = { padding: "26px 28px 48px", ...two };

// A page's heading card. Pages used to explain themselves here; the heading
// is enough.
function Intro({ title }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", padding: "2px 2px 0" }}>{title}</div>
  );
}

// The editor beside a list. On a phone it sits under the whole list, so it
// scrolls itself into view when something is opened in it.
function Panel({ title, onClose, children }) {
  const ref = useRef(null);
  const editing = !!onClose;
  useEffect(() => {
    if (editing && ref.current && window.innerWidth < 900) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing, title]);
  return (
    <div ref={ref} style={{ ...card, padding: 24, position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 14, scrollMarginTop: 70 }}>
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
function ProductMultiPicker({ ctx, ids, toggle }) {
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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
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
        {!matches.length && <div style={{ padding: 12, fontSize: 12.5, color: "var(--text-muted)" }}>No matches.</div>}
      </div>
    </div>
  );
}

// ---- Categories -----------------------------------------------------------

// What a category is *for*, which is what a promo scope and the Gift sets shelf
// read — distinct from where it sits in the tree.
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

  const blank = { label: "", desc: "", grp: "", live: true, parentId: "" };
  const open = (c) => {
    setErr("");
    setEditing(c ? c.id : "new");
    setF(c ? { label: c.label, desc: c.desc, grp: c.grp, live: c.live, parentId: c.parentId || "" } : { ...blank });
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
    if (!window.confirm(`Delete "${c.label}"?`)) return;
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

  // A category moves among its own siblings. Comparing it against the whole
  // table would swap a sub-category's place with a top-level shelf's.
  const move = async (c, dir) => {
    const ordered = ctx.categories
      .filter((x) => (x.parentId || null) === (c.parentId || null))
      .sort((a, b) => a.sort - b.sort);
    const i = ordered.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    await patch(c, { sort: ordered[j].sort });
    await patch(ordered[j], { sort: c.sort });
  };

  const shelves = catTree(ctx.categories);
  const liveProducts = ctx.products.filter((p) => p.cat);
  // One renderer for both levels: a sub-category is the same object as a shelf,
  // so it gets the same controls rather than a cut-down copy of them.
  const row = (c, i, n) => (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: c.parentId ? 15 : 17, color: "var(--text-strong)" }}>{c.label}</div>
          {c.desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{c.desc}</div>}
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
            {/* Two numbers where they differ: what is filed here, and what the
                shelf actually shows once its children are counted in. */}
            {c.products} filed
            {!c.parentId && countIn(ctx.categories, liveProducts, c.id) !== c.products
              && ` · ${countIn(ctx.categories, liveProducts, c.id)} on the shelf`}
            
            {c.grp ? ` · ${(GROUPS.find((g) => g.id === c.grp) || {}).label}` : ""}
          </div>
        </div>
        <Switch checked={c.live} onChange={() => patch(c, { live: !c.live }, c.live ? `${c.label} hidden` : `${c.label} is live`)} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={() => open(c)} style={linkBtn}>Edit</button>
        <button onClick={() => move(c, -1)} disabled={i === 0} style={{ ...linkBtn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
        <button onClick={() => move(c, 1)} disabled={i === n - 1} style={{ ...linkBtn, opacity: i === n - 1 ? 0.4 : 1 }}>↓</button>
        <button onClick={() => remove(c)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
      </div>
    </>
  );

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Categories" />
        {shelves.map((c, i) => (
          <div key={c.id} style={{ ...card, padding: 18, opacity: c.live ? 1 : 0.62 }}>
            {row(c, i, shelves.length)}
            {c.children.length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border-hairline)", paddingTop: 4 }}>
                {c.children.map((sc, j) => (
                  <div key={sc.id} style={{ paddingLeft: 16, borderLeft: "2px solid var(--surface-sunken)", marginTop: 10, opacity: sc.live ? 1 : 0.62 }}>
                    {row(sc, j, c.children.length)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit category" : "New category"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <Button variant="primary" block onClick={() => open(null)}>Add a category</Button>
          </>
        ) : (
          <>
            <Input label="Name" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Attar Oils" />
            <Textarea label="Description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={2} placeholder="Optional" />
            <Select label="Group" value={f.grp} onChange={(e) => setF({ ...f, grp: e.target.value })}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
            <Select label="Parent" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
              <option value="">None (top level)</option>
              {/* Only a category that is itself top level and childless-safe can
                  be a parent; the server refuses the rest either way. */}
              {ctx.categories.filter((c) => !c.parentId && c.id !== editing).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
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
    if (!window.confirm(`Delete "${d.title}"?`)) return;
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
      ctx.flash(d.status === "Active" ? "Deal ended" : "Deal restarted");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const toggle = (id) => setF((s) => ({ ...s, productIds: s.productIds.includes(id) ? s.productIds.filter((x) => x !== id) : s.productIds.concat(id) }));

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Deals" />
        {!ctx.deals.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>No deals yet</div>
          </div>
        )}
        {ctx.deals.map((d) => (
          <div key={d.id} style={{ ...card, padding: 18, opacity: d.live ? 1 : 0.62 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: "var(--accent-gold)", color: "var(--mr-purple-950)" }}>{d.badge}</span>
                  <span style={{ fontSize: 11.5, color: d.live ? "#3f6b45" : "var(--text-muted)" }}>{d.live ? "Live" : d.status === "Ended" ? "Ended" : "Scheduled"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginTop: 8 }}>{d.title}</div>
                {d.desc && <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--mr-purple-900)", marginTop: 4 }}>{d.desc}</div>}
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
                  {d.productIds.length} {d.productIds.length === 1 ? "product" : "products"} · {d.startsAt || "Now"} → {d.endsAt || "No end"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(d)} style={linkBtn}>Edit</button>
              <button onClick={() => endNow(d)} style={linkBtn}>{d.status === "Active" ? "End" : "Restart"}</button>
              <button onClick={() => remove(d)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit deal" : "New deal"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <Button variant="primary" block onClick={() => open(null)}>New deal</Button>
          </>
        ) : (
          <>
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Detty December" />
            <Textarea label="Description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} rows={2} placeholder="Optional" />
            <Input label="Badge" value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="Hot deal" />
            {/* Exactly the card the Deals page draws, updating as you type. */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Preview</div>
              <DealCard deal={f} meta={`${f.productIds.length} ${f.productIds.length === 1 ? "product" : "products"}${f.endsAt ? ` · ends ${f.endsAt}` : ""}`} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Starts" type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} hint="Optional" />
              <Input label="Ends" type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} hint="Optional" />
            </div>
            <ProductMultiPicker ctx={ctx} ids={f.productIds} toggle={toggle} />
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

// ---- The blog -------------------------------------------------------------

// The count under a box the writer has to stay inside.
//
// Shown while typing rather than reported on save, because "your heading is
// too long, here it is again" after the fact is how a writer learns to resent
// a form. It turns amber at four fifths and red at the line, and the box
// itself will not take another character past it.
function Counter({ value, max, unit = "characters", extra = "" }) {
  const n = String(value || "").length;
  const share = max ? n / max : 0;
  const tone = n >= max ? "#c0587a" : share >= 0.8 ? "var(--mr-gold-600)" : "var(--text-muted)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: tone, marginTop: -2 }}>
      <span>{extra}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {n} / {max} {unit}{n >= max ? " — that's the limit" : ""}
      </span>
    </div>
  );
}

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
    if (!window.confirm(`Delete "${p.title}"?`)) return;
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
      ctx.flash(status === "published" ? "Published" : "Moved to drafts");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  return (
    <main style={{ padding: "26px 28px 48px", display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Blog" />
        {!ctx.posts.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>Nothing written yet</div>
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
            {p.excerpt && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.excerpt}</div>
            )}
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              {p.author}{p.tags ? ` · ${p.tags}` : ""}{p.publishedAt ? ` · ${String(p.publishedAt).slice(0, 10)}` : ""}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(p)} style={linkBtn}>Edit</button>
              <button onClick={() => setStatus(p, p.status === "published" ? "draft" : "published")} style={linkBtn}>
                {p.status === "published" ? "Unpublish" : "Publish"}
              </button>
              {p.status === "published" && <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5 }}>View</a>}
              <button onClick={() => remove(p)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit post" : "New post"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <Button variant="primary" block onClick={() => open(null)}>New post</Button>
          </>
        ) : (
          <>
            <Input label="Heading" value={f.title} maxLength={TITLE_MAX}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="How to make an extrait last all day" />
            <Counter value={f.title} max={TITLE_MAX}
              extra={`${words(f.title)} word${words(f.title) === 1 ? "" : "s"}${words(f.title) > TITLE_MAX_WORDS ? " — long for a card" : ""}`} />
            {editing !== "new" && (
              <Input label="URL slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })}
                hint="Changing this breaks old links" />
            )}
            <Textarea label="Preview" value={f.excerpt} maxLength={PREVIEW_MAX} rows={3}
              onChange={(e) => setF({ ...f, excerpt: e.target.value })}
              hint="One or two sentences" />
            <Counter value={f.excerpt} max={PREVIEW_MAX}
              extra="" />
            {/* A post written before the limit existed can arrive holding the
                whole article in this box — which is the "the preview is the
                entire story" the house reported. Shoppers already see it cut
                short, but saving would cut the stored text too, so say so
                first. And where the story itself is empty, this box is the
                only copy of that writing: offer to move it rather than let
                somebody trim it away. */}
            {f.excerpt.length > PREVIEW_MAX && (
              <div style={{ fontSize: 12, color: "#c0587a", lineHeight: 1.6, background: "#f7e3ea", borderRadius: "var(--radius-md)", padding: "10px 12px", marginTop: -4 }}>
                Too long — saving trims it to {PREVIEW_MAX} characters.
                {!f.body.trim() && (
                  <>
                    <button
                      onClick={() => setF((cur) => ({ ...cur, body: cur.body.trim() ? `${cur.body.trim()}\n\n${cur.excerpt.trim()}` : cur.excerpt.trim(), excerpt: "" }))}
                      style={{ ...linkBtn, color: "#c0587a", fontWeight: 600, marginLeft: 4, textDecoration: "underline" }}>
                      Move it into the post
                    </button>
                  </>
                )}
              </div>
            )}
            <ImagePicker ctx={ctx} label="Cover image" value={f.coverUrl} onChange={(url) => setF({ ...f, coverUrl: url })}
              hint="Wide image" />
            {/* A picture inside the story is just its address on a line of its
                own, so uploading one appends that line rather than holding the
                file anywhere in this form. */}
            <ImagePicker ctx={ctx} label="Add an image to the post" value="" clearAfterPick
              onChange={(url) => setF((cur) => ({ ...cur, body: `${cur.body.replace(/\s+$/, "")}\n\n${url}\n` }))}
              hint="" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
              <Input label="Tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="layering, care" />
            </div>
            <Textarea label="Post" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={14}
              hint="## heading · **bold** · *italic* · - list · > quote" />
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="primary" disabled={busy || !f.title.trim() || !f.excerpt.trim()} onClick={() => save("published")}>{busy ? "Saving…" : "Publish"}</Button>
              <Button variant="secondary" disabled={busy || !f.title.trim()} onClick={() => save("draft")}>Save as draft</Button>
              {f.title.trim() && !f.excerpt.trim() && (
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Add a preview to publish.</span>
              )}
            </div>
            {err && <div style={{ fontSize: 12, color: "#c0587a" }}>{err}</div>}
          </>
        )}
      </Panel>
    </main>
  );
}

// ---- Reviews & testimonials ----------------------------------------------

const KIND_LABELS = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", video: "Video file", quote: "Written review" };

// Tying a review to a product used to mean finding it in a list of every piece
// the house carries. Type instead: name, brand or SKU-ish id, and pick.
function ProductPicker({ products, value, onChange, label = "About which product (optional)" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = products.find((p) => p.id === value) || null;
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? products.filter((p) => `${p.name} ${p.brand || ""} ${p.id}`.toLowerCase().includes(needle))
      : products;
    return list.slice(0, 8);
  }, [q, products]);

  if (chosen) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-strong)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", background: "var(--surface-sunken)" }}>
          <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-strong)" }}>{chosen.name}</span>
          <button onClick={() => { onChange(""); setQ(""); setOpen(true); }} style={linkBtn}>Change</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      <Input label={label} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search products (optional)" />
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 68, left: 0, right: 0, zIndex: 41, background: "var(--surface-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", maxHeight: 260, overflowY: "auto", padding: 6 }}>
            {!matches.length && <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>Nothing matches “{q.trim()}”.</div>}
            {matches.map((p) => (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-strong)", padding: "9px 12px", borderRadius: "var(--radius-sm)" }}>
                {p.name}
                {p.brand ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {p.brand}</span> : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TestimonialsPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // A review is either a customer's own post, embedded, or one written out —
  // told to us in a shop, over WhatsApp, in an email. Neither needs the other.
  const [mode, setMode] = useState("written");

  const blank = { url: "", author: "", handle: "", quote: "", rating: 5, city: "", productId: "", thumbUrl: "", live: true };
  const open = (t) => {
    setErr("");
    setEditing(t ? t.id : "new");
    setMode(t && t.url ? "embed" : "written");
    setF(t ? { url: t.url, author: t.author, handle: t.handle, quote: t.quote, rating: t.rating, city: t.city, productId: t.productId, thumbUrl: t.thumbUrl, live: t.live } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async () => {
    // Switching a review to written drops the link, which is what makes the
    // server file it as a quote rather than a broken embed.
    const body = mode === "written" ? { ...f, url: "" } : f;
    if (mode === "written" && !body.quote.trim()) return setErr("Write out what the customer said.");
    setBusy(true); setErr("");
    try {
      if (editing === "new") await api.post("/api/admin/testimonials", body, ctx.token);
      else await api.patch(`/api/admin/testimonials/${editing}`, body, ctx.token);
      ctx.loadTestimonials();
      ctx.flash(editing === "new" ? "Review added" : "Review updated");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const remove = async (t) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await api.del(`/api/admin/testimonials/${t.id}`, ctx.token);
      ctx.loadTestimonials();
      ctx.flash("Review deleted");
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
        <Intro title="Reviews" />
        {!ctx.testimonials.length && (
          <div style={{ ...card, padding: 24, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-strong)" }}>No reviews yet</div>
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
              <button onClick={() => open(t)} style={linkBtn}>Edit</button>
              <button onClick={() => move(t, -1)} disabled={i === 0} style={{ ...linkBtn, opacity: i === 0 ? 0.4 : 1 }}>↑ Up</button>
              <button onClick={() => move(t, 1)} disabled={i === all.length - 1} style={{ ...linkBtn, opacity: i === all.length - 1 ? 0.4 : 1 }}>↓ Down</button>
              <button onClick={() => remove(t)} style={{ ...linkBtn, color: "#c0587a", marginLeft: "auto" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <Panel title={editing && editing !== "new" ? "Edit review" : "New review"} onClose={editing ? close : null}>
        {!editing ? (
          <>
            <Button variant="primary" block onClick={() => open(null)}>Add a review</Button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              {[["written", "Written review"], ["embed", "Customer's post"]].map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)}
                  style={{ flex: 1, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, padding: "9px 12px", borderRadius: "var(--radius-pill)", border: `1px solid ${mode === id ? "var(--mr-purple-900)" : "var(--border-hairline)"}`, background: mode === id ? "var(--mr-purple-900)" : "var(--surface-card)", color: mode === id ? "var(--mr-cream)" : "var(--mr-purple-800)" }}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "embed" && (
              <Input label="Post link" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })}
                placeholder="https://www.instagram.com/p/…"
                hint="Instagram, TikTok, YouTube or .mp4" />
            )}
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
            <Textarea label={mode === "written" ? "What they said" : "Quote"} value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} rows={3}
              hint={mode === "written" ? "" : "Optional"} />
            {mode === "written" && (
              <ImagePicker ctx={ctx} label="Photo (optional)" value={f.thumbUrl || ""} onChange={(url) => setF({ ...f, thumbUrl: url })}
                hint="" />
            )}
            <ProductPicker products={ctx.products} value={f.productId} onChange={(id) => setF({ ...f, productId: id })} />
            <Switch label="Live" checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
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

// Information & legal pages.
//
// The privacy notice used to live in the storefront's JSX, "last updated July
// 2026" and all — a policy the house could not correct without a deploy, on a
// shop that takes card payments. It is content now, written exactly the way the
// blog is written, so there is one format and one renderer rather than two.
export function PagesPage({ ctx }) {
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const blank = { title: "", slug: "", eyebrow: "", body: "", seoTitle: "", seoDesc: "", inFooter: true, live: false };
  const open = (p) => {
    setErr("");
    setEditing(p ? p.slug : "new");
    setF(p ? { ...p } : { ...blank });
  };
  const close = () => { setEditing(null); setF(null); setErr(""); };

  const save = async (live) => {
    setBusy(true); setErr("");
    const body = live === undefined ? f : { ...f, live };
    try {
      if (editing === "new") await api.post("/api/admin/pages", body, ctx.token);
      else await api.patch(`/api/admin/pages/${encodeURIComponent(editing)}`, body, ctx.token);
      ctx.loadPages();
      ctx.flash(body.live ? "Published" : "Saved as a draft");
      close();
    } catch (e) { ctx.authFail(e); setErr(e.message); } finally { setBusy(false); }
  };

  const setLive = async (p, live) => {
    try {
      await api.patch(`/api/admin/pages/${encodeURIComponent(p.slug)}`, { live }, ctx.token);
      ctx.loadPages();
      ctx.flash(live ? "Published" : "Unpublished");
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try {
      await api.del(`/api/admin/pages/${encodeURIComponent(p.slug)}`, ctx.token);
      ctx.loadPages();
      ctx.flash("Page deleted");
      close();
    } catch (e) { ctx.authFail(e); ctx.flash(e.message); }
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Intro title="Pages" />
        {ctx.pages.map((p) => (
          <div key={p.slug} style={{ ...card, padding: 18, opacity: p.live ? 1 : 0.68 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: p.live ? "#e4efe4" : "var(--surface-sunken)", color: p.live ? "#3f6b45" : "var(--mr-purple-800)" }}>
                {p.live ? "Live" : "Draft"}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>/{p.slug}</span>
              {!p.inFooter && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>· hidden from footer</span>}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text-strong)", marginTop: 8 }}>{p.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              {p.body.trim() ? `${p.body.trim().split(/\s+/).length} words` : "Empty"}
              {p.updatedAt ? ` · saved ${String(p.updatedAt).slice(0, 10)}` : ""}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => open(p)} style={linkBtn}>Edit</button>
              <button onClick={() => setLive(p, !p.live)} style={linkBtn}>{p.live ? "Unpublish" : "Publish"}</button>
              {p.live && <a href={`/${p.slug}`} target="_blank" rel="noreferrer" style={{ ...linkBtn, textDecoration: "none" }}>View</a>}
              {p.slug !== "privacy" && <button onClick={() => remove(p)} style={{ ...linkBtn, color: "#c0587a" }}>Delete</button>}
            </div>
          </div>
        ))}
        <button onClick={() => open(null)} style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-pill)", padding: "8px 16px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--mr-purple-800)" }}>+ New page</button>
      </div>

      <div style={{ ...card, padding: 22, display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 20 }}>
        {!f ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Select a page to edit.</div>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{editing === "new" ? "New page" : `Edit /${editing}`}</div>
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Returns & refunds" />
            {editing === "new" && (
              <Input label="Address (optional)" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="returns" />
            )}
            <Input label="Eyebrow (optional)" value={f.eyebrow} onChange={(e) => setF({ ...f, eyebrow: e.target.value })} placeholder="Legal" />
            <Textarea label="The page" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={18}
              hint="## heading · > quote" />
            <Input label="Search title (optional)" value={f.seoTitle} onChange={(e) => setF({ ...f, seoTitle: e.target.value })} />
            <Textarea label="Search description (optional)" value={f.seoDesc} onChange={(e) => setF({ ...f, seoDesc: e.target.value })} rows={2} />
            <Switch label="Show in footer" checked={f.inFooter} onChange={(e) => setF({ ...f, inFooter: e.target.checked })} />
            {err && <div style={{ fontSize: 12.5, color: "#c0587a" }}>{err}</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : "Save & publish"}</Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => save(false)}>Save as a draft</Button>
              <button onClick={close} style={{ ...linkBtn, color: "var(--text-muted)" }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
