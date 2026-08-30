import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useWindowWidth, cap, fmtCurrency } from "../lib/hooks.js";
import { Chrome } from "./chrome.jsx";
import {
  HomePage, ShopPage, ProductPage, AboutPage, CheckoutPage, ConfirmPage, TrackPage, ContactPage, PrivacyPage,
  WishlistPage, LocationsPage, ReviewsPage, BlogPage, BlogPostPage,
} from "./pages.jsx";
import { AccountPage } from "./account.jsx";
import { pathToRoute, routeToPath } from "./router.js";
import { headFor, setHead, setGscVerification } from "./seo.js";
import { getConsent, setConsent, startAnalytics, track as trackEvent } from "./analytics.js";

const SCOPE_CATS = {
  Storewide: null,
  Fragrances: ["extrait", "designer", "custom-oil", "mist"],
  "Gift packages": ["fragrance-set", "mist-set", "custom-oil-set", "gift-set"],
  "Feminine care": ["care", "deo"],
};

// Stable empty fallbacks — a fresh {} / [] each render would break memoisation.
const EMPTY_OBJ = {};
const EMPTY_ARR = [];

export default function App() {
  const initialRoute = pathToRoute();
  const [D, setD] = useState(null);
  const dataRef = useRef(null);
  const [page, setPage] = useState(initialRoute.page);
  const [productId, setProductId] = useState(initialRoute.productId || null);
  // The variation selected on the product page. Held as an id (stable) with the
  // SKU from the URL as the opening hint before the catalogue has loaded.
  const [prVariantId, setPrVariantId] = useState(null);
  const [prSku, setPrSku] = useState(initialRoute.prSku || null);
  const [consent, setConsentState] = useState(getConsent());
  const [prQty, setPrQty] = useState(1);
  const [city, setCity] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mr-cart") || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [mnav, setMnav] = useState(false);
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState(initialRoute.fCat || "all");
  const [fCol, setFCol] = useState(initialRoute.fCol || null);   // a collection, when one is chosen
  // The header's merchandising shelves: "new-arrivals" | "best-sellers" |
  // "deals" | "gift-sets". Which products are on each is the server's answer
  // (worker/merch.js) — this only says which shelf is being looked at.
  const [fSeg, setFSeg] = useState(initialRoute.fSeg || null);
  const [fBrand, setFBrand] = useState(initialRoute.fBrand || "");
  const [fScope, setFScope] = useState("city");    // "city" = my store's shelf, "all" = every store
  const [fSort, setFSort] = useState("featured");
  const [plan, setPlan] = useState(null);          // server's fulfilment plan for this cart
  const [planning, setPlanning] = useState(false);
  // Set only when the server rejects a split the shopper hadn't been shown.
  // Ordinarily the breakdown sits directly above the pay button and pressing it
  // is the agreement — this is the second ask when the two disagree.
  const [reconfirm, setReconfirm] = useState(false);
  const [co, setCo] = useState({ name: "", email: "", phone: "", address: "", fulfill: "delivery", pay: "paystack", promo: "" });
  const [promoInfo, setPromoInfo] = useState(null); // { code, kind, value, scope: desc, freeShip } from validate
  const [promoMsg, setPromoMsg] = useState("");
  const [coErr, setCoErr] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [track, setTrack] = useState({ no: "", contact: "", order: null, err: "" });
  const [cf, setCf] = useState({ name: "", email: "", msg: "" });
  const [contactSent, setContactSent] = useState(false);
  const [chat, setChat] = useState({ open: false, val: "", inquiryId: null, key: null, msgs: [{ from: "us", text: "Welcome to the house — how can we help today?" }] });
  const [popup, setPopup] = useState(false);
  const [plEmail, setPlEmail] = useState("");
  const [plDone, setPlDone] = useState(false);
  const [custToken, setCustToken] = useState(() => localStorage.getItem("mr-cust-token") || "");
  const [cust, setCust] = useState(null);
  // Present only when the shopper arrived from a password-reset email.
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [custData, setCustData] = useState({ addresses: [], wishlist: [], orders: [] });
  // A shopper can save things long before they make an account, so the wishlist
  // starts in their browser and is handed to the server the moment they sign in.
  const [guestWish, setGuestWish] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mr-wishlist") || "[]"); } catch { return []; }
  });
  const [postSlug, setPostSlug] = useState(initialRoute.postSlug || null);
  const [blog, setBlog] = useState({ posts: [], tags: [], loaded: false });
  const [post, setPost] = useState(null);
  const [blogTag, setBlogTag] = useState("");
  // Real, paid purchases, shown to the next shopper. Fetched once — this is a
  // note about what the house has been selling, not a live feed to poll.
  const [proof, setProof] = useState({ enabled: false, purchases: [], intervalMs: 14000 });
  const w = useWindowWidth();
  const isMobile = w < 860;

  // Bootstrap
  useEffect(() => {
    let stored = null;
    let confirmed = false;
    try {
      stored = localStorage.getItem("mr-city");
      confirmed = localStorage.getItem("mr-city-ok") === "1";
    } catch { /* private mode — treat as a first visit */ }
    api.get("/api/store").then((d) => {
      dataRef.current = d;
      setD(d);
      // The city has to be one of the stores that is actually open: a stored
      // choice for a store since closed would show an empty shop.
      const open = (d.locations || []).map((l) => l.id);
      const fallback = open.includes(d.settings.defaultCity) ? d.settings.defaultCity : open[0] || "";
      setCity(stored && open.includes(stored) ? stored : fallback);
    }).catch(() => {});
    setGateOpen(!confirmed);
  }, []);

  // Promo popup timer
  useEffect(() => {
    if (!D) return;
    if ((D.settings.promoPopup ?? true) && !localStorage.getItem("mr-popup-seen")) {
      const t = setTimeout(() => setPopup(true), 1800);
      return () => clearTimeout(t);
    }
  }, [D]);

  // Back from Paystack: /?psorder=MR-xxxxx
  //
  // The URL only says which order to ask about. Whether it was paid for is the
  // server's answer, checked against the gateway — a shopper who edits the
  // address bar gets an unpaid order, not a receipt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const no = params.get("psorder");
    if (!no) return;
    window.history.replaceState({}, "", window.location.pathname);
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem("mr-pending-order") || "null"); } catch {}
    const base = stored && stored.no === no ? stored : { no, totalLabel: "", pay: "Paystack", payKey: "paystack", deliverTo: "", eta: "" };
    api.get(`/api/paystack/verify?order=${encodeURIComponent(no)}`)
      .then((r) => setPlaced({ ...base, paid: r.paid }))
      .catch(() => setPlaced({ ...base, paid: false }))
      .finally(() => {
        setCart([]);
        setPage("confirm");
        try { sessionStorage.removeItem("mr-pending-order"); } catch {}
      });
  }, []);

  useEffect(() => {
    try { localStorage.setItem("mr-cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try { localStorage.setItem("mr-wishlist", JSON.stringify(guestWish)); } catch {}
  }, [guestWish]);

  // Purchase proof, once per visit.
  useEffect(() => {
    api.get("/api/social-proof").then(setProof).catch(() => {});
  }, []);

  const nav = useCallback((p, extra = {}) => {
    setPage(p);
    setMnav(false);
    setCartOpen(false);
    if (extra.fCat !== undefined) { setFCat(extra.fCat); setFCol(null); }
    if (extra.fCol !== undefined) { setFCol(extra.fCol); setFCat("all"); }
    // Leaving the shop grid by any route that doesn't name a shelf or a brand
    // clears both, so "/shop" never quietly keeps yesterday's filter on it.
    if (p === "shop") {
      setFSeg(extra.fSeg ?? null);
      setFBrand(extra.fBrand ?? "");
      if (extra.fSeg !== undefined && extra.fCat === undefined) setFCat("all");
    }
    if (extra.postSlug !== undefined) setPostSlug(extra.postSlug);
    if (extra.productId !== undefined) {
      setProductId(extra.productId);
      setPrVariantId(extra.prVariantId ?? null);
      setPrSku(extra.prSku ?? null);
      setPrQty(1);
    }
    window.history.pushState({}, "", routeToPath(p, extra));
    window.scrollTo(0, 0);
  }, []);

  // Back/forward buttons
  useEffect(() => {
    const onPop = () => {
      const r = pathToRoute();
      setPage(r.page);
      setProductId(r.productId || null);
      if (r.page === "product") { setPrVariantId(null); setPrSku(r.prSku || null); }
      setFCat(r.fCat || "all");
      setFCol(r.fCol || null);
      setFSeg(r.fSeg || null);
      setFBrand(r.fBrand || "");
      setPostSlug(r.postSlug || null);
      setMnav(false);
      setCartOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // ---- Customer accounts (optional, guest-first) ----
  const loadCust = useCallback(() => {
    if (!custToken) { setCust(null); return; }
    api.get("/api/account/me", custToken)
      .then((d) => { setCust(d.customer); setCustData({ addresses: d.addresses, wishlist: d.wishlist, orders: d.orders }); })
      .catch((e) => { if (e.status === 401) { localStorage.removeItem("mr-cust-token"); setCustToken(""); setCust(null); } });
  }, [custToken]);
  useEffect(() => { loadCust(); }, [loadCust]);

  // Whatever was saved as a guest belongs to the account being opened. Read
  // straight from storage rather than from state so this can be called from
  // inside sign-in without dragging the list through its dependencies.
  const mergeGuestWishlist = useCallback(async (token) => {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem("mr-wishlist") || "[]"); } catch {}
    if (!Array.isArray(ids) || !ids.length) return;
    try {
      await api.post("/api/account/wishlist/merge", { productIds: ids }, token);
      localStorage.setItem("mr-wishlist", "[]");
      setGuestWish([]);
    } catch { /* the guest list stays in the browser and merges next sign-in */ }
  }, []);

  const custRegister = useCallback(async (payload) => { const r = await api.post("/api/account/register", payload); localStorage.setItem("mr-cust-token", r.token); await mergeGuestWishlist(r.token); setCustToken(r.token); setCust(r.customer); }, [mergeGuestWishlist]);
  const custLogin = useCallback(async (email, password) => { const r = await api.post("/api/account/login", { email, password }); localStorage.setItem("mr-cust-token", r.token); await mergeGuestWishlist(r.token); setCustToken(r.token); setCust(r.customer); }, [mergeGuestWishlist]);
  const custLogout = useCallback(() => { localStorage.removeItem("mr-cust-token"); setCustToken(""); setCust(null); setCustData({ addresses: [], wishlist: [], orders: [] }); nav("home"); }, [nav]);
  // The server answers the same way whether or not the address is known, so
  // this hands back its message rather than deciding one of its own.
  const custForgotPassword = useCallback(async (email) => {
    const r = await api.post("/api/account/password/forgot", { email });
    return r.message || "If that email has an account, a reset link is on its way.";
  }, []);
  const custResetPassword = useCallback(async (token, password) => {
    const r = await api.post("/api/account/password/reset", { token, password });
    localStorage.setItem("mr-cust-token", r.token);
    setCustToken(r.token);
    setCust(r.customer);
    // Drop the token out of the URL so it isn't left in history or a shared
    // link, then land on the dashboard the new password just unlocked.
    setResetToken("");
    window.history.replaceState({}, "", "/account");
  }, []);
  const updateProfile = useCallback(async (p) => { await api.patch("/api/account/me", p, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  const addAddress = useCallback(async (a) => { await api.post("/api/account/addresses", a, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  const removeAddress = useCallback(async (id) => { await api.del(`/api/account/addresses/${id}`, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  // Saving something must never be the moment a shopper is asked to register —
  // a guest's wishlist lives in their browser and follows them into an account
  // when they eventually make one.
  const toggleWishlist = useCallback(async (productId) => {
    const tok = localStorage.getItem("mr-cust-token");
    if (!tok) {
      setGuestWish((wl) => (wl.includes(productId) ? wl.filter((x) => x !== productId) : wl.concat(productId)));
      return;
    }
    const has = custData.wishlist.includes(productId);
    setCustData((d) => ({ ...d, wishlist: has ? d.wishlist.filter((x) => x !== productId) : d.wishlist.concat(productId) }));
    try { if (has) await api.del(`/api/account/wishlist/${productId}`, tok); else await api.post("/api/account/wishlist", { productId }, tok); } catch { loadCust(); }
  }, [custData.wishlist, loadCust]);

  // The waitlist is per variation — someone waiting on the 50ml shouldn't be
  // told it's back because the 30ml was restocked.
  const joinWaitlist = useCallback(async (productId, variant) => {
    const contact = (cust && cust.email) || window.prompt("Enter your email and we'll tell you the moment it's back in stock:");
    if (!contact) return;
    try {
      await api.post("/api/waitlist", { productId, variantId: variant && variant.id, sku: variant && variant.sku, size: variant && variant.size, contact, city: cap(city) });
      window.alert("You're on the list — we'll let you know when it's back.");
    } catch { window.alert("Couldn't add you just now — please try again."); }
  }, [cust, city]);

  // Memoised so the fallbacks ({} / []) keep a stable identity across renders —
  // otherwise every downstream useMemo/useCallback dep changes on every render.
  const settings = useMemo(() => (D ? D.settings : EMPTY_OBJ), [D]);
  const locations = useMemo(() => (D ? D.locations : EMPTY_ARR), [D]);
  const products = useMemo(() => (D ? D.products : EMPTY_ARR), [D]);
  const categories = useMemo(() => (D ? D.categories : EMPTY_ARR), [D]);
  const collections = useMemo(() => (D ? (D.collections || EMPTY_ARR) : EMPTY_ARR), [D]);
  // The header's shelves, the reviews wall and the blog
  // strip all come down with the catalogue — one request, not five.
  const segments = useMemo(() => (D ? (D.segments || EMPTY_OBJ) : EMPTY_OBJ), [D]);
  const deals = useMemo(() => (D ? (D.deals || EMPTY_ARR) : EMPTY_ARR), [D]);
  const brands = useMemo(() => (D ? (D.brands || EMPTY_ARR) : EMPTY_ARR), [D]);
  const testimonials = useMemo(() => (D ? (D.testimonials || EMPTY_ARR) : EMPTY_ARR), [D]);
  const latestPosts = useMemo(() => (D ? (D.blog || EMPTY_ARR) : EMPTY_ARR), [D]);
  // One list of saved product ids whoever is looking: the account's when signed
  // in, the browser's when not.
  const wishlist = useMemo(() => (cust ? custData.wishlist : guestWish), [cust, custData.wishlist, guestWish]);
  // Which payment methods the server will actually accept. Defaults to card
  // being available so the option doesn't flicker away on a slow bootstrap.
  const payMethods = useMemo(() => (D && D.pay ? D.pay : { paystack: true, transfer: true, whatsapp: true }), [D]);
  const L = useMemo(() => locations.find((l) => l.id === city) || null, [locations, city]);
  const cityName = cap(city);

  const fmt = useCallback((ngn) => fmtCurrency(ngn, currency, settings.ngnPerUsd || 1550), [currency, settings.ngnPerUsd]);
  const catLabel = useCallback((id) => (categories.find((c) => c.id === id) || {}).label || "", [categories]);

  // Stock is read from the catalogue payload, which is written by whichever
  // Worker version answered the request. Every read of it is defaulted so a
  // shape the client didn't expect degrades to "unavailable" rather than
  // throwing inside a render and blanking the storefront.
  const stockAt = (v, id) => (v && v.stock ? v.stock[id] : 0) || 0;

  const bestAlt = useCallback((v) => {
    const alt = locations.filter((l) => l.id !== city && stockAt(v, l.id) > 0);
    return alt.length ? alt[0] : null;
  }, [locations, city]);

  // Availability is a property of the variation, not the product — the 30ml can
  // be on the shelf in Abuja while the 50ml is only in Lagos.
  const variantAvail = useCallback((v) => {
    const inCity = stockAt(v, city) > 0;
    const alt = inCity ? null : bestAlt(v);
    if (inCity) return { inCity, avail: "In " + cityName, badgeBg: "#e4efe4", badgeFg: "#3f6b45", soldOut: false, note: "At your store" };
    if (alt) return { inCity, avail: "Ships from " + alt.city, badgeBg: "transparent", badgeFg: "var(--mr-lavender-600)", soldOut: false, note: "3–5 days from " + alt.city, outline: true };
    return { inCity, avail: "Notify me", badgeBg: "var(--mr-sand)", badgeFg: "var(--mr-gold-600)", soldOut: true, note: "Out of stock" };
  }, [city, cityName, bestAlt]);

  // The variation a shopper should land on: the first one actually on the shelf
  // in their city, rather than whichever happens to be first in the list.
  const defaultVariant = useCallback(
    (variants) => (variants || []).find((v) => stockAt(v, city) > 0) || (variants || [])[0],
    [city]
  );

  const availInfo = useCallback((p) => variantAvail(defaultVariant(p.variants)), [variantAvail, defaultVariant]);

  const addToCart = useCallback((productId, variant, qty) => {
    setCart((cur) => {
      const next = cur.slice();
      // Lines are keyed by the variation's id, so two sizes of the same
      // fragrance are two lines and renaming a size never merges them.
      const i = next.findIndex((c) => c.variantId === variant.id);
      if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + qty };
      else next.push({ id: productId, variantId: variant.id, sku: variant.sku, size: variant.size, qty });
      return next;
    });
    setCartOpen(true);
    const D0 = dataRef.current;
    const p = D0 && D0.products.find((x) => x.id === productId);
    if (p) trackEvent("add_to_cart", { id: variant.sku || productId, name: `${p.name} ${variant.size}`.trim(), value: variant.ngn * qty, items: [{ id: variant.sku || productId, name: p.name, price: variant.ngn, qty }] });
  }, []);

  // One entry per card in the grid. A product normally contributes a single
  // entry carrying all of its variations (one card, a picker on it); a product
  // flagged split_listing contributes one entry per variation instead.
  const listings = useMemo(() => {
    const out = [];
    for (const p of products) {
      if (!p.variants.length) continue;
      if (p.splitListing) for (const v of p.variants) out.push({ key: `${p.id}::${v.id}`, product: p, variants: [v], split: true });
      else out.push({ key: p.id, product: p, variants: p.variants, split: false });
    }
    return out;
  }, [products]);

  const card = useCallback((entry) => {
    // Tolerate being handed a bare product (home page, related products).
    const e = entry.product ? entry : { key: entry.id, product: entry, variants: entry.variants || [], split: false };
    const { product: p, variants } = e;
    const def = defaultVariant(variants);
    if (!def) return null;
    const prices = variants.map((v) => v.ngn);
    const cheapest = Math.min(...prices);
    const rangeLabel = !e.split && variants.length > 1 && cheapest !== Math.max(...prices) ? "From " + fmt(cheapest) : "";

    return {
      key: e.key,
      id: p.id,
      split: e.split,
      // A split listing names the variation it stands for, so two cards for the
      // same product never read as duplicates.
      name: e.split ? `${p.name} ${def.size}`.trim() : p.name,
      catLabel: catLabel(p.cat),
      optionName: (p.optionNames && p.optionNames[0]) || "Size",
      href: "/product/" + p.id + (variants.length > 1 || e.split ? `?variant=${encodeURIComponent(def.sku || "")}` : ""),
      wished: wishlist.includes(p.id),
      toggleWish: () => toggleWishlist(p.id),
      defaultVariantId: def.id,
      // "From ₦25,000" only when the picker is genuinely showing a range.
      rangeLabel,
      // Flat fields for the simpler surfaces (home page picks, related
      // products) that show a card's headline without a picker.
      imageUrl: def.imageUrl || p.imageUrl,
      priceLabel: rangeLabel || fmt(def.ngn),
      open: () => nav("product", { productId: p.id, prSku: def.sku, prVariantId: def.id }),
      variants: variants.map((v) => {
        const a = variantAvail(v);
        return {
          id: v.id, sku: v.sku, label: v.size,
          imageUrl: v.imageUrl || p.imageUrl,
          priceLabel: fmt(v.ngn),
          compareAtLabel: v.compareAtNgn && v.compareAtNgn > v.ngn ? fmt(v.compareAtNgn) : "",
          avail: a.avail, badgeBg: a.badgeBg, badgeFg: a.badgeFg, outline: !!a.outline,
          soldOut: a.soldOut,
          addLabel: a.soldOut ? "Notify me" : "Add to cart",
          open: () => nav("product", { productId: p.id, prSku: v.sku, prVariantId: v.id }),
          add: () => (a.soldOut ? joinWaitlist(p.id, v) : addToCart(p.id, v, 1)),
        };
      }),
    };
  }, [variantAvail, defaultVariant, catLabel, fmt, nav, addToCart, wishlist, toggleWishlist, joinWaitlist]);

  // Cart derivation (subtotal, shipping, discount, routing)
  const cc = useMemo(() => {
    if (!D) return { items: [], sub: 0, ship: 0, allInCity: true, discount: 0, total: 0 };
    let sub = 0;
    let allInCity = true;
    const lines = [];
    const items = cart.map((c, idx) => {
      const p = products.find((x) => x.id === c.id);
      if (!p) return null;
      // Lines saved by an older build carry only a size — fall back to it so a
      // cart in someone's browser survives the upgrade.
      const pv = p.variants || [];
      const v = (c.variantId && pv.find((x) => x.id === c.variantId))
        || (c.sku && pv.find((x) => x.sku === c.sku))
        || pv.find((x) => x.size === c.size)
        || pv[0];
      // The variation was withdrawn while it sat in someone's cart — drop the
      // line rather than pricing something that no longer exists.
      if (!v) return null;
      const inCity = stockAt(v, city) >= c.qty;
      if (!inCity) allInCity = false;
      sub += v.ngn * c.qty;
      lines.push({ cat: p.cat, lineTotal: v.ngn * c.qty });
      const alt = inCity ? null : bestAlt(v);
      return {
        key: "v" + v.id, id: c.id, variantId: v.id, name: p.name, size: v.size, qty: c.qty,
        imageUrl: v.imageUrl || p.imageUrl,
        lineLabel: fmt(v.ngn * c.qty),
        availNote: inCity ? "In " + cityName : alt ? "Ships from " + alt.city : "Backorder",
        inc: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x))),
        dec: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))),
        remove: () => setCart((s) => s.filter((_, i) => i !== idx)),
      };
    }).filter(Boolean);
    // Delivery is the server's number once the fulfilment quote lands — a split
    // order pays per parcel, and only the server knows how it splits. Until
    // then this is an estimate so the summary is never blank.
    let ship;
    if (co.fulfill === "collect") ship = 0;
    else if (plan && plan.mode !== "unavailable") ship = plan.shipTotal;
    else {
      ship = allInCity ? (L ? L.shipNGN : 2500) : (settings.crossCityShipNGN ?? 4500);
      if (city === (settings.freeShipCity ?? "abuja") && sub >= (settings.freeShipAbujaOver ?? 100000) && allInCity) ship = 0;
    }
    let discount = 0;
    if (promoInfo) {
      const cats = SCOPE_CATS[promoInfo.scopeName] ?? null;
      const eligible = lines.filter((l) => !cats || cats.includes(l.cat)).reduce((n, l) => n + l.lineTotal, 0);
      if (promoInfo.kind === "pct") discount = Math.round((eligible * promoInfo.value) / 100);
      else if (promoInfo.kind === "amt") discount = Math.min(promoInfo.value, eligible);
      if (promoInfo.freeShip) ship = 0;
    }
    return { items, sub, ship, allInCity, discount, total: sub - discount + ship };
  }, [D, cart, city, co.fulfill, promoInfo, products, L, settings, fmt, cityName, bestAlt, plan]);

  // Ask the server where this cart ships from. Runs on the checkout page, and
  // again whenever the cart, the city or the fulfilment choice changes — the
  // plan the shopper agrees to is the one the order is written from.
  useEffect(() => {
    if (page !== "checkout" || !cart.length || !city) { setPlan(null); return; }
    let live = true;
    setPlanning(true);
    const t = setTimeout(() => {
      api.post("/api/fulfilment/quote", {
        city, fulfill: co.fulfill,
        items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, sku: c.sku, size: c.size, qty: c.qty })),
      })
        .then((r) => { if (live) setPlan(r.plan); })
        .catch((e) => { if (live) setPlan(e.data && e.data.plan ? e.data.plan : null); })
        .finally(() => { if (live) setPlanning(false); });
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [page, cart, city, co.fulfill]);

  // Any change to what is being shipped withdraws a previous agreement.
  useEffect(() => { setReconfirm(false); }, [cart, city, co.fulfill]);

  // Card is the default, but it is only real when a gateway key is configured.
  // If it isn't, move the selection to something the server will accept rather
  // than letting the shopper reach the last step and be refused.
  useEffect(() => {
    if (payMethods[co.pay]) return;
    const fallback = ["paystack", "transfer", "whatsapp"].find((m) => payMethods[m]);
    if (fallback) setCo((s) => ({ ...s, pay: fallback }));
  }, [payMethods, co.pay]);

  // The blog is fetched when it is first opened, not with the catalogue —
  // most visits never go there, and the home page already has its three cards.
  useEffect(() => {
    if (page !== "blog" || blog.loaded) return;
    api.get("/api/blog").then((r) => setBlog({ posts: r.posts, tags: r.tags, loaded: true })).catch(() => setBlog((b) => ({ ...b, loaded: true })));
  }, [page, blog.loaded]);

  useEffect(() => {
    if (page !== "post" || !postSlug) return;
    if (post && post.post && post.post.slug === postSlug) return;
    setPost(null);
    let live = true;
    api.get(`/api/blog/${encodeURIComponent(postSlug)}`)
      .then((r) => { if (live) setPost(r); })
      .catch((e) => { if (live) setPost({ error: e.message }); });
    return () => { live = false; };
  }, [page, postSlug, post]);

  // SEO head + consent-gated analytics
  useEffect(() => { if (D) setGscVerification(D.settings.gscVerification); }, [D]);
  useEffect(() => { if (D && consent === "granted") startAnalytics(D.settings); }, [D, consent]);
  useEffect(() => {
    if (!D) return;
    const product = page === "product" ? products.find((p) => p.id === productId) : null;
    // The head describes the selected variation — its price, its photo, its own
    // canonical URL — so a shared link previews what the shopper actually saw.
    const variant = product && (product.variants.find((v) => v.id === prVariantId || (prSku && v.sku === prSku)) || defaultVariant(product.variants));
    setHead(headFor({
      page, product, variant, settings, categories,
      segment: fSeg,
      brand: fBrand ? (brands.find((b) => b.id === fBrand) || { name: fBrand }).name : "",
      post: post && post.post ? post.post : null,
    }));
    trackEvent("page_view");
    if (product && variant) trackEvent("view_item", { id: variant.sku || product.id, name: product.name, value: variant.ngn });
    if (page === "checkout" && cc.items.length) trackEvent("begin_checkout", { value: cc.total });
    if (page === "confirm" && placed) trackEvent("purchase", { id: placed.no, value: placed.total || 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, productId, prVariantId, prSku, D, consent, fSeg, fBrand, post]);

  // Prefill checkout for a signed-in customer, once per visit to the page.
  const prefilled = useRef(false);
  useEffect(() => {
    if (page !== "checkout") { prefilled.current = false; return; }
    if (cust && !prefilled.current) {
      prefilled.current = true;
      const def = custData.addresses.find((a) => a.is_default) || custData.addresses[0];
      setCo((s) => ({
        ...s,
        name: s.name || cust.name || "",
        email: s.email || cust.email || "",
        phone: s.phone || cust.phone || "",
        address: s.address || (def ? def.address : ""),
      }));
    }
  }, [page, cust, custData]);

  const applyPromo = useCallback(async () => {
    const code = co.promo.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api.post("/api/promos/validate", { code, items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, sku: c.sku, size: c.size, qty: c.qty })) });
      if (r.valid) {
        setPromoInfo({ code: r.code, kind: r.kind, value: r.value, scopeName: scopeNameOf(r), freeShip: r.freeShip });
        setPromoMsg(r.code + " applied — " + r.desc + ", quietly.");
      } else {
        setPromoInfo(null);
        setPromoMsg("That code isn't active right now.");
      }
    } catch {
      setPromoInfo(null);
      setPromoMsg("That code isn't active right now.");
    }
  }, [co.promo, cart]);

  // Shoppers can take the promo back off — it is their cart.
  const clearPromo = useCallback(() => {
    setPromoInfo(null);
    setPromoMsg("");
    setCo((s) => ({ ...s, promo: "" }));
  }, []);

  function scopeNameOf(r) {
    // server sends desc; scope grouping mirrors the server's SCOPE_CATS keys
    return r.scope || (r.desc && Object.keys(SCOPE_CATS).find((k) => r.desc.includes(k))) || "Storewide";
  }

  // Abandoned-checkout heartbeat: once the shopper identifies themselves on
  // the checkout page, keep the admin's list current.
  const abandonTimer = useRef(null);
  useEffect(() => {
    if (page !== "checkout" || !cc.items.length) return;
    if (!co.name.trim() || (!co.phone.trim() && !co.email.trim())) return;
    clearTimeout(abandonTimer.current);
    abandonTimer.current = setTimeout(() => {
      const stage = co.address.trim() || co.fulfill === "collect" ? "Payment" : "Delivery details";
      api.post("/api/checkouts/activity", {
        name: co.name.trim(), phone: co.phone.trim(), email: co.email.trim(), city: cityName, value: cc.total, stage,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(abandonTimer.current);
  }, [page, co, cc.total, cc.items.length, cityName]);

  const placeOrder = useCallback(async () => {
    if (!co.name.trim()) return setCoErr("Enter your name.");
    if (!co.phone.trim()) return setCoErr("Enter your phone number.");
    if (co.fulfill === "delivery" && !co.address.trim()) return setCoErr("Enter a delivery address.");
    if (co.pay === "paystack" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(co.email.trim()))
      return setCoErr("Enter a valid email address for your receipt.");
    setCoErr("");
    setPlacing(true);
    try {
      const r = await api.post("/api/orders", {
        customer: { name: co.name, phone: co.phone, email: co.email, address: co.address },
        city, fulfill: co.fulfill, pay: co.pay,
        promo: promoInfo ? promoInfo.code : "",
        items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, sku: c.sku, size: c.size, qty: c.qty })),
        // The delivery breakdown is shown directly above the button, so pressing
        // it agrees to the arrangement on screen. If the server has planned a
        // different one it says so, and `reconfirm` makes the next press explicit.
        acceptSplit: reconfirm || !!(plan && plan.mode === "split"),
      });
      if (r.paystackUrl) {
        try { sessionStorage.setItem("mr-pending-order", JSON.stringify(r.order)); } catch {}
        window.location.href = r.paystackUrl;
        return;
      }
      if (co.pay === "whatsapp" && settings.contactPhone) {
        const waPhone = settings.contactPhone.replace(/[^\d]/g, "");
        const text = encodeURIComponent(`Hello Majestic Roobee! I just placed order ${r.order.no} (${r.order.totalLabel}) — completing it via WhatsApp.`);
        window.open(`https://wa.me/${waPhone}?text=${text}`, "_blank", "noopener");
      }
      setPlaced(r.order);
      setCart([]);
      setPromoInfo(null);
      setCo((s) => ({ ...s, promo: "" }));
      setPromoMsg("");
      setReconfirm(false);
      setPlan(null);
      nav("confirm");
      api.get("/api/store").then(setD).catch(() => {}); // refresh stock
    } catch (e) {
      // The server plans the delivery itself and refuses one the shopper hasn't
      // been shown, handing back its own breakdown to display.
      if (e.data && e.data.plan) setPlan(e.data.plan);
      if (e.data && e.data.needsConfirmation) setReconfirm(true);
      setCoErr(e.message);
    } finally {
      setPlacing(false);
    }
  }, [co, city, cart, promoInfo, plan, reconfirm, settings.contactPhone, nav]);

  // Finish paying for an order that was placed but never settled — from the
  // confirmation screen or from order tracking.
  const payNow = useCallback(async (no, contact) => {
    try {
      const r = await api.post(`/api/orders/${encodeURIComponent(no)}/pay`, { contact });
      if (r.paystackUrl) window.location.href = r.paystackUrl;
    } catch (e) {
      setTrack((t) => ({ ...t, err: e.message }));
      setCoErr(e.message);
    }
  }, []);

  const doTrack = useCallback(async () => {
    const no = track.no.trim().toUpperCase();
    if (!no) return setTrack((t) => ({ ...t, err: "Enter your order number — it starts with MR-.", order: null }));
    if (!track.contact.trim()) return setTrack((t) => ({ ...t, err: "Add the phone or email you ordered with.", order: null }));
    try {
      const o = await api.get(`/api/orders/track?no=${encodeURIComponent(no)}&contact=${encodeURIComponent(track.contact.trim())}`);
      setTrack((t) => ({ ...t, err: "", order: o }));
    } catch (e) {
      setTrack((t) => ({ ...t, err: e.message, order: null }));
    }
  }, [track.no, track.contact]);

  const sendChat = useCallback(() => {
    const v = chat.val.trim();
    if (!v) return;
    setChat((s) => ({ ...s, msgs: s.msgs.concat({ from: "them", text: v }), val: "" }));
    const persist = async () => {
      try {
        if (chat.inquiryId && chat.key) {
          await api.post(`/api/inquiries/${chat.inquiryId}/messages`, { key: chat.key, message: v });
        } else {
          const r = await api.post("/api/inquiries", { name: "Storefront guest", channel: "Live chat", subject: v.slice(0, 60), city: cityName, message: v });
          setChat((s) => ({ ...s, inquiryId: r.id, key: r.key }));
        }
      } catch {}
    };
    persist();
    setTimeout(() => {
      setChat((s) => ({ ...s, msgs: s.msgs.concat({ from: "us", text: `Noted — a concierge is checking that for you now. You can also reach us on WhatsApp at ${settings.contactPhone || "+234 906 227 7470"}.` }) }));
    }, 900);
  }, [chat.val, chat.inquiryId, chat.key, cityName, settings.contactPhone]);

  const sendContact = useCallback(async () => {
    if (!cf.msg.trim()) return;
    try {
      await api.post("/api/inquiries", { name: cf.name || "Guest", contact: cf.email, channel: "Email", subject: cf.msg.slice(0, 60), city: cityName, message: cf.msg });
    } catch {}
    setContactSent(true);
  }, [cf, cityName]);

  const submitLead = useCallback(async () => {
    if (!plEmail.includes("@")) return;
    try { localStorage.setItem("mr-popup-seen", "1"); } catch {}
    setPlDone(true);
    api.post("/api/leads", { email: plEmail, source: "popup" }).catch(() => {});
  }, [plEmail]);

  const ctx = {
    D, settings, locations, products, categories, page, nav, isMobile,
    city, cityName, L,
    setCityConfirmed: (c) => {
      try { localStorage.setItem("mr-city", c); localStorage.setItem("mr-city-ok", "1"); } catch {}
      setCity(c); setGateOpen(false);
    },
    gateOpen,
    currency, toggleCurrency: () => setCurrency((c) => (c === "NGN" ? "USD" : "NGN")),
    fmt, catLabel, availInfo, variantAvail, defaultVariant, bestAlt, card, listings, payMethods,
    cart, cc, addToCart, cartOpen, setCartOpen, mnav, setMnav,
    collections, segments, deals, brands, testimonials, latestPosts,
    search, setSearch, fCat, setFCat, fCol, setFCol, fScope, setFScope, fSort, setFSort,
    fSeg, setFSeg, fBrand, setFBrand,
    blog, blogTag, setBlogTag, post, postSlug,
    proof,
    plan, planning, reconfirm, clearPromo, payNow,
    productId, prVariantId, setPrVariantId, prSku, setPrSku, prQty, setPrQty,
    co, setCo, promoInfo, promoMsg, applyPromo, coErr, placing, placeOrder, placed,
    track, setTrack, doTrack,
    cf, setCf, contactSent, sendContact,
    chat, setChat, sendChat,
    popup, setPopup, plEmail, setPlEmail, plDone, submitLead,
    closePopup: () => { try { localStorage.setItem("mr-popup-seen", "1"); } catch {} setPopup(false); },
    consent, showConsent: !consent,
    grantConsent: () => { setConsent("granted"); setConsentState("granted"); },
    denyConsent: () => { setConsent("denied"); setConsentState("denied"); },
    cust, custData, custRegister, custLogin, custLogout, updateProfile, addAddress, removeAddress, toggleWishlist, joinWaitlist,
    wishlist,
    resetToken, custForgotPassword, custResetPassword,
  };

  const pageEl =
    page === "home" ? <HomePage ctx={ctx} /> :
    page === "shop" ? <ShopPage ctx={ctx} /> :
    page === "product" ? <ProductPage ctx={ctx} /> :
    page === "about" ? <AboutPage ctx={ctx} /> :
    page === "checkout" ? <CheckoutPage ctx={ctx} /> :
    page === "confirm" ? <ConfirmPage ctx={ctx} /> :
    page === "track" ? <TrackPage ctx={ctx} /> :
    page === "contact" ? <ContactPage ctx={ctx} /> :
    page === "privacy" ? <PrivacyPage ctx={ctx} /> :
    page === "account" ? <AccountPage ctx={ctx} /> :
    page === "wishlist" ? <WishlistPage ctx={ctx} /> :
    page === "locations" ? <LocationsPage ctx={ctx} /> :
    page === "reviews" ? <ReviewsPage ctx={ctx} /> :
    page === "blog" ? <BlogPage ctx={ctx} /> :
    page === "post" ? <BlogPostPage ctx={ctx} /> :
    <HomePage ctx={ctx} />;

  return <Chrome ctx={ctx}>{pageEl}</Chrome>;
}
