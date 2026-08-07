import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useWindowWidth, cap, initialsOf, fmtCurrency } from "../lib/hooks.js";
import { Chrome } from "./chrome.jsx";
import { HomePage, ShopPage, ProductPage, AboutPage, CheckoutPage, ConfirmPage, TrackPage, ContactPage, PrivacyPage } from "./pages.jsx";
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
  const [city, setCity] = useState("abuja");
  const [gateOpen, setGateOpen] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mr-cart") || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [mnav, setMnav] = useState(false);
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState(initialRoute.fCat || "all");
  const [fSort, setFSort] = useState("featured");
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
  const [custData, setCustData] = useState({ addresses: [], wishlist: [], orders: [] });
  const w = useWindowWidth();
  const isMobile = w < 860;

  // Bootstrap
  useEffect(() => {
    api.get("/api/store").then((d) => { dataRef.current = d; setD(d); }).catch(() => {});
    try {
      const c = localStorage.getItem("mr-city");
      const ok = localStorage.getItem("mr-city-ok") === "1";
      if (c) setCity(c);
      setGateOpen(!ok);
    } catch {
      setGateOpen(true);
    }
  }, []);

  // Promo popup timer
  useEffect(() => {
    if (!D) return;
    if ((D.settings.promoPopup ?? true) && !localStorage.getItem("mr-popup-seen")) {
      const t = setTimeout(() => setPopup(true), 1800);
      return () => clearTimeout(t);
    }
  }, [D]);

  // Paystack return leg: /?psorder=MR-xxxxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const no = params.get("psorder");
    if (!no) return;
    window.history.replaceState({}, "", window.location.pathname);
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem("mr-pending-order") || "null"); } catch {}
    api.get(`/api/paystack/verify?order=${encodeURIComponent(no)}`).then((r) => {
      setPlaced(stored && stored.no === no ? { ...stored, paid: r.paid } : { no, paid: r.paid, totalLabel: "", pay: "Paystack", route: "", eta: "" });
      setCart([]);
      setPage("confirm");
      sessionStorage.removeItem("mr-pending-order");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem("mr-cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  const nav = useCallback((p, extra = {}) => {
    setPage(p);
    setMnav(false);
    setCartOpen(false);
    if (extra.fCat !== undefined) setFCat(extra.fCat);
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
      if (r.fCat) setFCat(r.fCat);
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

  const custRegister = useCallback(async (payload) => { const r = await api.post("/api/account/register", payload); localStorage.setItem("mr-cust-token", r.token); setCustToken(r.token); setCust(r.customer); }, []);
  const custLogin = useCallback(async (email, password) => { const r = await api.post("/api/account/login", { email, password }); localStorage.setItem("mr-cust-token", r.token); setCustToken(r.token); setCust(r.customer); }, []);
  const custLogout = useCallback(() => { localStorage.removeItem("mr-cust-token"); setCustToken(""); setCust(null); setCustData({ addresses: [], wishlist: [], orders: [] }); nav("home"); }, [nav]);
  const updateProfile = useCallback(async (p) => { await api.patch("/api/account/me", p, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  const addAddress = useCallback(async (a) => { await api.post("/api/account/addresses", a, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  const removeAddress = useCallback(async (id) => { await api.del(`/api/account/addresses/${id}`, localStorage.getItem("mr-cust-token")); loadCust(); }, [loadCust]);
  const toggleWishlist = useCallback(async (productId) => {
    const tok = localStorage.getItem("mr-cust-token");
    if (!tok) { nav("account"); return; }
    const has = custData.wishlist.includes(productId);
    setCustData((d) => ({ ...d, wishlist: has ? d.wishlist.filter((x) => x !== productId) : d.wishlist.concat(productId) }));
    try { if (has) await api.del(`/api/account/wishlist/${productId}`, tok); else await api.post("/api/account/wishlist", { productId }, tok); } catch { loadCust(); }
  }, [custData.wishlist, nav, loadCust]);

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
  const L = useMemo(() => locations.find((l) => l.id === city) || null, [locations, city]);
  const cityName = cap(city);

  const fmt = useCallback((ngn) => fmtCurrency(ngn, currency, settings.ngnPerUsd || 1550), [currency, settings.ngnPerUsd]);
  const catLabel = useCallback((id) => (categories.find((c) => c.id === id) || {}).label || "", [categories]);

  const bestAlt = useCallback((v) => {
    const alt = locations.filter((l) => l.id !== city && (v.stock[l.id] || 0) > 0);
    return alt.length ? alt[0] : null;
  }, [locations, city]);

  // Availability is a property of the variation, not the product — the 30ml can
  // be on the shelf in Abuja while the 50ml is only in Lagos.
  const variantAvail = useCallback((v) => {
    const inCity = (v.stock[city] || 0) > 0;
    const alt = inCity ? null : bestAlt(v);
    if (inCity) return { inCity, avail: "In " + cityName, badgeBg: "#e4efe4", badgeFg: "#3f6b45", soldOut: false, note: "At your store" };
    if (alt) return { inCity, avail: "Ships from " + alt.city, badgeBg: "transparent", badgeFg: "var(--mr-lavender-600)", soldOut: false, note: "3–5 days from " + alt.city, outline: true };
    return { inCity, avail: "Notify me", badgeBg: "var(--mr-sand)", badgeFg: "var(--mr-gold-600)", soldOut: true, note: "Out of stock" };
  }, [city, cityName, bestAlt]);

  // The variation a shopper should land on: the first one actually on the shelf
  // in their city, rather than whichever happens to be first in the list.
  const defaultVariant = useCallback(
    (variants) => variants.find((v) => (v.stock[city] || 0) > 0) || variants[0],
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
    const e = entry.product ? entry : { key: entry.id, product: entry, variants: entry.variants, split: false };
    const { product: p, variants } = e;
    const def = defaultVariant(variants);
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
      wished: custData.wishlist.includes(p.id),
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
  }, [variantAvail, defaultVariant, catLabel, fmt, nav, addToCart, custData.wishlist, toggleWishlist, joinWaitlist]);

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
      const v = (c.variantId && p.variants.find((x) => x.id === c.variantId))
        || (c.sku && p.variants.find((x) => x.sku === c.sku))
        || p.variants.find((x) => x.size === c.size)
        || p.variants[0];
      const inCity = (v.stock[city] || 0) >= c.qty;
      if (!inCity) allInCity = false;
      sub += v.ngn * c.qty;
      lines.push({ cat: p.cat, lineTotal: v.ngn * c.qty });
      const alt = inCity ? null : bestAlt(v);
      return {
        key: "v" + v.id, id: c.id, variantId: v.id, name: p.name, size: v.size, qty: c.qty,
        imageUrl: v.imageUrl || p.imageUrl,
        initials: initialsOf(p.name),
        lineLabel: fmt(v.ngn * c.qty),
        availNote: inCity ? "In " + cityName : alt ? "Ships from " + alt.city : "Backorder",
        inc: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x))),
        dec: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))),
        remove: () => setCart((s) => s.filter((_, i) => i !== idx)),
      };
    }).filter(Boolean);
    let ship = co.fulfill === "collect" ? 0 : allInCity ? (L ? L.shipNGN : 2500) : (settings.crossCityShipNGN ?? 4500);
    if (co.fulfill === "delivery" && city === "abuja" && sub >= (settings.freeShipAbujaOver ?? 100000) && allInCity) ship = 0;
    let discount = 0;
    if (promoInfo) {
      const cats = SCOPE_CATS[promoInfo.scopeName] ?? null;
      const eligible = lines.filter((l) => !cats || cats.includes(l.cat)).reduce((n, l) => n + l.lineTotal, 0);
      if (promoInfo.kind === "pct") discount = Math.round((eligible * promoInfo.value) / 100);
      else if (promoInfo.kind === "amt") discount = Math.min(promoInfo.value, eligible);
      if (promoInfo.freeShip) ship = 0;
    }
    return { items, sub, ship, allInCity, discount, total: sub - discount + ship };
  }, [D, cart, city, co.fulfill, promoInfo, products, L, settings, fmt, cityName, bestAlt]);

  // SEO head + consent-gated analytics
  useEffect(() => { if (D) setGscVerification(D.settings.gscVerification); }, [D]);
  useEffect(() => { if (D && consent === "granted") startAnalytics(D.settings); }, [D, consent]);
  useEffect(() => {
    if (!D) return;
    const product = page === "product" ? products.find((p) => p.id === productId) : null;
    // The head describes the selected variation — its price, its photo, its own
    // canonical URL — so a shared link previews what the shopper actually saw.
    const variant = product && (product.variants.find((v) => v.id === prVariantId || (prSku && v.sku === prSku)) || defaultVariant(product.variants));
    setHead(headFor({ page, product, variant, settings, categories }));
    trackEvent("page_view");
    if (product && variant) trackEvent("view_item", { id: variant.sku || product.id, name: product.name, value: variant.ngn });
    if (page === "checkout" && cc.items.length) trackEvent("begin_checkout", { value: cc.total });
    if (page === "confirm" && placed) trackEvent("purchase", { id: placed.no, value: placed.total || 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, productId, prVariantId, prSku, D, consent]);

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
    if (!co.name.trim() || !co.phone.trim()) return setCoErr("Your name and phone help us find you — both are required.");
    if (co.fulfill === "delivery" && !co.address.trim()) return setCoErr("Add a delivery address, or switch to click & collect.");
    setCoErr("");
    setPlacing(true);
    try {
      const r = await api.post("/api/orders", {
        customer: { name: co.name, phone: co.phone, email: co.email, address: co.address },
        city, fulfill: co.fulfill, pay: co.pay,
        promo: promoInfo ? promoInfo.code : "",
        items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, sku: c.sku, size: c.size, qty: c.qty })),
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
      nav("confirm");
      api.get("/api/store").then(setD).catch(() => {}); // refresh stock
    } catch (e) {
      setCoErr(e.message);
    } finally {
      setPlacing(false);
    }
  }, [co, city, cart, promoInfo, settings.contactPhone, nav]);

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
    fmt, catLabel, availInfo, variantAvail, defaultVariant, bestAlt, card, listings,
    cart, cc, addToCart, cartOpen, setCartOpen, mnav, setMnav,
    search, setSearch, fCat, setFCat, fSort, setFSort,
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
    <HomePage ctx={ctx} />;

  return <Chrome ctx={ctx}>{pageEl}</Chrome>;
}
