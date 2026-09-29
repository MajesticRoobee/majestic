import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useWindowWidth, cap, fmtCurrency } from "../lib/hooks.js";
import { Chrome } from "./chrome.jsx";
import { MobileChrome } from "./mobile-chrome.jsx";
import {
  HomePage, ShopPage, ProductPage, AboutPage, CheckoutPage, ConfirmPage, TrackPage, ContactPage, InfoPage,
  WishlistPage, LocationsPage, ReviewsPage, BlogPage, BlogPostPage, FaqPage, ConsultationPage,
} from "./pages.jsx";
import { CategoriesPage, CartPage, MobileHome, MobileShop, MobileProduct, MobileCheckout, MobileWishlist } from "./mobile-pages.jsx";
import { AccountPage } from "./account.jsx";
import { pathToRoute, routeToPath } from "./router.js";
import { consultationContent } from "../lib/consultation.js";
import { headFor, setHead, setGscVerification } from "./seo.js";
import { getConsent, setConsent, startAnalytics, track as trackEvent } from "./analytics.js";
import { startTracking, record as mrRecord, setCity as mrSetCity, optedOut, setOptOut, visitorId, noteViewed, recentlyViewed, clearRecent } from "./track.js";
import { captureAttribution, attributionForOrder } from "./attribution.js";

const SCOPE_CATS = {
  Storewide: null,
  Fragrances: ["perfumes", "perfume-oils", "designer", "custom-oil", "mist"],
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
  const [currency, setCurrency] = useState("NGN");
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mr-cart") || "[]"); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [mnav, setMnav] = useState(false);
  const [search, setSearch] = useState(initialRoute.q || "");
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
  const [chat, setChat] = useState({ open: false, val: "", inquiryId: null, key: null, msgs: [{ from: "us", text: "Hi! How can we help you today?" }] });
  const [popup, setPopup] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [plEmail, setPlEmail] = useState("");
  const [plDone, setPlDone] = useState(false);
  const [custToken, setCustToken] = useState(() => localStorage.getItem("mr-cust-token") || "");
  const [cust, setCust] = useState(null);
  // Present only when the shopper arrived from a password-reset email.
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [custData, setCustData] = useState({ addresses: [], wishlist: [], orders: [], rewards: [] });
  // A shopper can save things long before they make an account, so the wishlist
  // starts in their browser and is handed to the server the moment they sign in.
  const [guestWish, setGuestWish] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mr-wishlist") || "[]"); } catch { return []; }
  });
  const [postSlug, setPostSlug] = useState(initialRoute.postSlug || null);
  // Privacy, terms, returns — whatever the house has written. Fetched by name,
  // because the list lives on the server and this component is built before any
  // of it has arrived.
  const [pageSlug, setPageSlug] = useState(initialRoute.pageSlug || null);
  const [infoPage, setInfoPage] = useState(null);
  const [blog, setBlog] = useState({ posts: [], tags: [], loaded: false });
  const [post, setPost] = useState(null);
  const [blogTag, setBlogTag] = useState("");
  // The opt-out lives in localStorage, which React cannot see change; this is
  // what makes the switch on the privacy page redraw when it is flipped.
  const [, setMeasureTick] = useState(0);
  // Real, paid purchases, shown to the next shopper. Fetched once — this is a
  // note about what the store has been selling, not a live feed to poll.
  const [proof, setProof] = useState({ enabled: false, purchases: [], intervalMs: 14000 });
  const w = useWindowWidth();
  const isMobile = w < 860;
  // Callbacks built once (addToCart, the recovery link) still need to know
  // which layout they are acting in, without being rebuilt on every resize.
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  // The phone's sheets — menu, search, city, "choose a size", "added to your
  // cart", chat — are one at a time, so one piece of state says which is up.
  // `{ kind, ...data }` or null.
  const [sheet, setSheet] = useState(null);
  // A one-line note at the foot of the screen ("Link copied").
  const [note, setNote] = useState("");
  const noteTimer = useRef(null);
  const flash = useCallback((text) => {
    clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = setTimeout(() => setNote(""), 3200);
  }, []);
  // The filters the phone's filter sheet adds on top of the shop's own:
  // price bands, and "for" / scent family where the catalogue actually varies.
  const [mf, setMf] = useState({ price: "all", gender: "all", fam: "all" });
  // How deep into this visit's history the shopper is. The phone header shows
  // a back arrow instead of the menu once there is somewhere to go back to —
  // which the browser can't be asked directly, so each entry carries its index.
  const [histIdx, setHistIdx] = useState(() => (window.history.state && window.history.state.idx) || 0);

  // Bootstrap
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem("mr-city"); } catch { /* private mode — treat as a first visit */ }
    api.get("/api/store").then((d) => {
      dataRef.current = d;
      setD(d);
      // The city has to be one of the stores that is actually open: a stored
      // choice for a store since closed would show an empty shop.
      const open = (d.locations || []).map((l) => l.id);
      const fallback = open.includes(d.settings.defaultCity) ? d.settings.defaultCity : open[0] || "";
      setCity(stored && open.includes(stored) ? stored : fallback);
    }).catch(() => {});
  }, []);

  // Re-read the catalogue without reloading the page. The daily deal is what
  // needs this: when its clock runs out the prices on screen are no longer the
  // prices the server will honour, so the page asks again rather than waiting
  // for the shopper to navigate. The chosen city is left alone — that is the
  // shopper's decision, not the server's.
  const refreshStore = useCallback(() => {
    api.get("/api/store").then((d) => { dataRef.current = d; setD(d); }).catch(() => {});
  }, []);

  // The first-order pop-up.
  //
  // It has shown to everybody since it was built, which means a first-time
  // browser meets an interruption before they have seen a single bottle. It can
  // now wait for somebody who has been in before and not bought — which is who
  // a first-order offer was always for. Whose visit this is, is something the
  // browser already knows: it has been here before if it has a visit behind it.
  useEffect(() => {
    if (!D) return;
    if (!(D.settings.promoPopup ?? true)) return;
    // Never over a cart. Somebody with something in their basket is past the
    // question a first-order offer asks, and somebody arriving on a recovery
    // link has been sent here on purpose — meeting either with an interruption
    // is how a nudge becomes an obstacle.
    if (cart.length) return;
    if (new URLSearchParams(window.location.search).has("recover")) return;
    try { if (localStorage.getItem("mr-popup-seen")) return; } catch { return; }
    const when = D.settings.promoPopupWhen || "everyone";
    if (when === "returning") {
      let visits = 0;
      try { visits = parseInt(localStorage.getItem("mr-visits") || "0", 10) || 0; } catch { visits = 0; }
      if (visits < 2) return;
    }
    // A beat after arrival, not on it: the offer waits until the shopper has
    // had a look round.
    const t = setTimeout(() => setPopup(true), 15000);
    return () => clearTimeout(t);
  }, [D, cart.length]);

  // How many visits this browser has made. Counted once a visit, in the
  // browser's own storage — it is what the pop-up targeting reads, and it never
  // leaves the page.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mr-visit-counted")) return;
      sessionStorage.setItem("mr-visit-counted", "1");
      localStorage.setItem("mr-visits", String((parseInt(localStorage.getItem("mr-visits") || "0", 10) || 0) + 1));
    } catch { /* private windows simply never look like returning visitors */ }
  }, []);

  // Back from Paystack: /?psorder=MR-xxxxx
  //
  // The URL only says which order to ask about. Whether it was paid for is the
  // server's answer, checked against the gateway — a shopper who edits the
  // address bar gets an unpaid order, not a receipt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const no = params.get("psorder");
    if (!no) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
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

  // Purchase proof: fetched on arrival, then again every two minutes while the
  // tab is open and in view, so a purchase made during the visit shows up.
  useEffect(() => {
    const load = () => api.get("/api/social-proof").then(setProof).catch(() => {});
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 120000);
    return () => clearInterval(t);
  }, []);

  // `opts.replace` refines the page the shopper is already on — a filter chip,
  // a sort — without leaving a history entry per tap or jumping to the top.
  const nav = useCallback((p, extra = {}, opts = {}) => {
    setPage(p);
    setMnav(false);
    setCartOpen(false);
    setSheet(null);
    // A category and a collection are two ways of narrowing the same grid, so
    // naming one clears the other. The order matters: `fCol: null` means "no
    // collection", and reading it as "a collection was chosen" is what used to
    // reset the category to "all" on every click in the header's category menu
    // — the URL changed, the grid didn't.
    if (extra.fCat !== undefined) { setFCat(extra.fCat); setFCol(extra.fCol ?? null); }
    else if (extra.fCol !== undefined) { setFCol(extra.fCol); setFCat("all"); }
    // Leaving the shop grid by any route that doesn't name a shelf or a brand
    // clears both, so "/shop" never quietly keeps yesterday's filter on it.
    if (p === "shop") {
      setFSeg(extra.fSeg ?? null);
      setFBrand(extra.fBrand ?? "");
      if (extra.fSeg !== undefined && extra.fCat === undefined) setFCat("all");
    }
    if (extra.postSlug !== undefined) setPostSlug(extra.postSlug);
    if (extra.pageSlug !== undefined) setPageSlug(extra.pageSlug);
    if (extra.productId !== undefined) {
      setProductId(extra.productId);
      setPrVariantId(extra.prVariantId ?? null);
      setPrSku(extra.prSku ?? null);
      setPrQty(1);
    }
    if (opts.replace) {
      window.history.replaceState(window.history.state, "", routeToPath(p, extra));
      return;
    }
    const idx = ((window.history.state && window.history.state.idx) || 0) + 1;
    window.history.pushState({ idx }, "", routeToPath(p, extra));
    setHistIdx(idx);
    window.scrollTo(0, 0);
  }, []);

  // Back/forward buttons
  useEffect(() => {
    const onPop = (e) => {
      setHistIdx((e.state && e.state.idx) || 0);
      setSheet(null);
      const r = pathToRoute();
      setPage(r.page);
      setProductId(r.productId || null);
      if (r.page === "product") { setPrVariantId(null); setPrSku(r.prSku || null); }
      setFCat(r.fCat || "all");
      setFCol(r.fCol || null);
      setFSeg(r.fSeg || null);
      setFBrand(r.fBrand || "");
      setPostSlug(r.postSlug || null);
      setPageSlug(r.pageSlug || null);
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
    window.history.replaceState(window.history.state, "", "/account");
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
  // The countdown card at the top of the home page — the server resolves which
  // product it is and at what price, having already applied that price to the
  // catalogue above, so nothing here re-derives it.
  const dailyDeal = useMemo(() => (D ? (D.dailyDeal || null) : null), [D]);
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

  // How few is "nearly gone" for this variation at this store. The server sends
  // the line it drew itself — per store, honouring any override on the piece —
  // so the shop and the back office never disagree about what "low" means. With
  // the setting off the lines are simply absent, and nothing is claimed.
  const lowLine = useCallback((v, locationId) => {
    const lines = v && v.lowAt;
    return lines && lines[locationId] !== undefined ? lines[locationId] : null;
  }, []);
  // "Only 2 left" — for the shopper's own city, and only when it is true and
  // there is something left to buy.
  const scarcity = useCallback((v) => {
    const line = lowLine(v, city);
    if (line === null) return null;
    const n = stockAt(v, city);
    return n > 0 && n <= line ? n : null;
  }, [lowLine, city]);

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
    // A drawer on a desktop; on a phone a short sheet that says what went in and
    // offers the cart or more shopping, so the shopper isn't pulled off the page.
    if (isMobileRef.current) setSheet({ kind: "added", productId, variantId: variant.id, qty });
    else setCartOpen(true);
    const D0 = dataRef.current;
    const p = D0 && D0.products.find((x) => x.id === productId);
    if (p) trackEvent("add_to_cart", { id: variant.sku || productId, name: `${p.name} ${variant.size}`.trim(), value: variant.ngn * qty, items: [{ id: variant.sku || productId, name: p.name, price: variant.ngn, qty }] });
    mrRecord("add_to_cart", { productId, variantId: variant.id, value: variant.ngn * qty });
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
    // A card with more than one size can't be added in one tap without picking
    // for the shopper, so on a phone it opens the size sheet instead.
    const chooseSize = () => setSheet({ kind: "variant", productId: p.id, variantIds: variants.map((v) => v.id), selId: def.id, qty: 1 });

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
      // What the phone's card shows under the name: the size (or how many), and
      // the badge — a real mark-down or a place on the new-arrivals shelf.
      sizeLabel: e.split || variants.length === 1 ? def.size : `${variants.length} sizes`,
      offPct: def.compareAtNgn && def.compareAtNgn > def.ngn ? Math.round((1 - def.ngn / def.compareAtNgn) * 100) : 0,
      isNew: (segments["new-arrivals"] || []).includes(p.id),
      chooseSize: variants.length > 1 ? chooseSize : null,
      open: () => nav("product", { productId: p.id, prSku: def.sku, prVariantId: def.id }),
      variants: variants.map((v) => {
        const a = variantAvail(v);
        const scarce = scarcity(v);
        const alt = a.inCity || a.soldOut ? null : bestAlt(v);
        return {
          id: v.id, sku: v.sku, label: v.size,
          imageUrl: v.imageUrl || p.imageUrl,
          priceLabel: fmt(v.ngn),
          compareAtLabel: v.compareAtNgn && v.compareAtNgn > v.ngn ? fmt(v.compareAtNgn) : "",
          avail: a.avail, badgeBg: a.badgeBg, badgeFg: a.badgeFg, outline: !!a.outline,
          soldOut: a.soldOut,
          // The phone's one line of availability, in words a shopper can act on.
          availLine: a.inCity
            ? (scarce !== null ? `Only ${scarce} left in ${cityName}` : `In stock in ${cityName}`)
            : alt ? `Ships from ${alt.city} · 3–5 days` : "Out of stock",
          availColor: a.inCity ? (scarce !== null ? "var(--mr-orchid-600)" : "#3f6b45") : "var(--text-muted)",
          addLabel: a.soldOut ? "Notify me" : "Add to cart",
          open: () => nav("product", { productId: p.id, prSku: v.sku, prVariantId: v.id }),
          add: () => (a.soldOut ? joinWaitlist(p.id, v) : addToCart(p.id, v, 1)),
        };
      }),
    };
  }, [variantAvail, defaultVariant, catLabel, fmt, nav, addToCart, wishlist, toggleWishlist, joinWaitlist, scarcity, bestAlt, cityName, segments]);

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
      lines.push({ cat: p.cat, unit: v.ngn, variantId: v.id, lineTotal: v.ngn * c.qty });
      const alt = inCity ? null : bestAlt(v);
      return {
        key: "v" + v.id, id: c.id, variantId: v.id, name: p.name, size: v.size, qty: c.qty,
        imageUrl: v.imageUrl || p.imageUrl,
        lineLabel: fmt(v.ngn * c.qty),
        unitLabel: fmt(v.ngn),
        inCity,
        availNote: inCity ? "In " + cityName : alt ? "Ships from " + alt.city : "Backorder",
        inc: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x))),
        dec: () => setCart((s) => s.map((x, i) => (i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))),
        // A cart emptied on purpose is not an abandoned cart, so the stream
        // hears about it and the running value follows the shopper down.
        remove: () => setCart((s) => {
          const next = s.filter((_, i) => i !== idx);
          mrRecord("remove_from_cart", { productId: c.id, variantId: v.id, value: Math.max(0, sub - v.ngn * c.qty) });
          return next;
        }),
      };
    }).filter(Boolean);
    // Delivery is the server's number once the fulfilment quote lands — a split
    // order pays per parcel, and only the server knows how it splits. Until
    // then this is an estimate so the summary is never blank.
    let ship;
    const freeOver = settings.freeShipAbujaOver ?? 100000;
    const freeHere = city === (settings.freeShipCity ?? "abuja") && allInCity;
    if (co.fulfill === "collect") ship = 0;
    else if (plan && plan.mode !== "unavailable") ship = plan.shipTotal;
    else {
      ship = allInCity ? (L ? L.shipNGN : 2500) : (settings.crossCityShipNGN ?? 4500);
      if (freeHere && sub >= freeOver) ship = 0;
    }
    // Free delivery has been enforced since the beginning and never once shown
    // to the person it would move. How much more, and how far along they are.
    const freeShip = freeHere && freeOver > 0 && co.fulfill !== "collect"
      ? { over: freeOver, remaining: Math.max(0, freeOver - sub), pct: Math.min(100, Math.round((sub / freeOver) * 100)) }
      : null;
    // A preview of the code's worth, recomputed as the cart changes so the
    // summary never quotes a discount for a cart that has moved on. The server
    // does this arithmetic again at checkout and its answer is the one charged.
    let discount = 0;
    if (promoInfo) {
      const cats = SCOPE_CATS[promoInfo.scopeName] ?? null;
      const inScope = lines.filter((l) => !cats || cats.includes(l.cat));
      if (promoInfo.kind === "item") {
        // A reward for a free product: one unit of the size it names, or of the
        // cheapest qualifying thing in the cart when it names none.
        const hit = promoInfo.freeVariantId
          ? inScope.find((l) => Number(l.variantId) === Number(promoInfo.freeVariantId))
          : inScope.reduce((a, b) => (!a || b.unit < a.unit ? b : a), null);
        discount = hit ? hit.unit : 0;
      } else {
        const eligible = inScope.reduce((n, l) => n + l.lineTotal, 0);
        if (promoInfo.kind === "pct") discount = Math.round((eligible * promoInfo.value) / 100);
        else if (promoInfo.kind === "amt") discount = Math.min(promoInfo.value, eligible);
      }
      if (promoInfo.freeShip) ship = 0;
    }
    return { items, sub, ship, allInCity, discount, freeShip, total: sub - discount + ship };
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

  useEffect(() => {
    if (page !== "info" || !pageSlug) return;
    if (infoPage && infoPage.slug === pageSlug) return;
    setInfoPage(null);
    let live = true;
    api.get(`/api/pages/${encodeURIComponent(pageSlug)}`)
      .then((r) => { if (live) setInfoPage({ slug: pageSlug, page: r.page }); })
      .catch((e) => { if (live) setInfoPage({ slug: pageSlug, error: e.message }); });
    return () => { live = false; };
  }, [page, pageSlug, infoPage]);

  // The leave-behind nudge.
  //
  // Exit intent on a desktop (the pointer leaving for the tab bar), and on a
  // phone — which has no such gesture — a long pause with a cart that has been
  // sitting there. It only ever fires for somebody who *has* a cart and has not
  // reached the confirmation page, it is capped to once every few days, and it
  // ships switched off until the house has written its own words.
  useEffect(() => {
    const st = D && D.settings;
    if (!st || !st.nudgeOn) return;
    if (!cart.length || page === "checkout" || page === "confirm") return;
    let last = 0;
    try { last = parseInt(localStorage.getItem("mr-nudge-at") || "0", 10) || 0; } catch { return; }
    const every = Math.max(1, parseInt(st.nudgeEveryDays, 10) || 7) * 86400000;
    if (Date.now() - last < every) return;

    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      setNudge(true);
      mrRecord("nudge_shown", {});
    };
    const onOut = (e) => { if (e.clientY <= 0) fire(); };
    // 45 seconds of a cart sitting untouched is the phone's version of turning
    // to leave.
    const idle = setTimeout(fire, 45000);
    document.addEventListener("mouseout", onOut);
    return () => { clearTimeout(idle); document.removeEventListener("mouseout", onOut); };
  }, [D, cart.length, page]);

  // A recovery link: ?recover=<token> puts the cart back and takes the shopper
  // to it. Done once, and the token is taken off the address bar immediately so
  // it is not shared onward or left in a browser's history.
  const recovered = useRef(false);
  useEffect(() => {
    if (recovered.current) return;
    const token = new URLSearchParams(window.location.search).get("recover");
    if (!token) return;
    recovered.current = true;
    api.get(`/api/cart/recover?t=${encodeURIComponent(token)}`)
      .then((r) => {
        const url = new URL(window.location.href);
        url.searchParams.delete("recover");
        window.history.replaceState(window.history.state, "", url.pathname + url.search);
        if (!r.items || !r.items.length) return;
        setCart(r.items.map((i) => ({ id: i.id, variantId: i.variantId, sku: i.sku, size: i.size, qty: i.qty })));
        if (r.city) setCity(r.city);
        // A phone has no drawer: its cart is a page.
        if (isMobileRef.current) nav("cart");
        else setCartOpen(true);
        mrRecord("nudge_clicked", { path: "/recover" });
      })
      .catch(() => {});
  }, [nav]);

  // SEO head + consent-gated analytics
  useEffect(() => { if (D) setGscVerification(D.settings.gscVerification); }, [D]);
  useEffect(() => { if (D && consent === "granted") startAnalytics(D.settings); }, [D, consent]);
  // The house's own measurement. Not gated on the cookie banner — it is the
  // shop counting its own shop, sets no third-party cookie and shares nothing —
  // but switched off entirely by the setting, or by anyone who says no.
  useEffect(() => { if (D) startTracking({ on: D.settings.insightsOn !== false }); }, [D]);
  // How this visit arrived — an ad, a tagged link, another site — noted once.
  useEffect(() => { captureAttribution({ optedOut: optedOut() }); }, []);
  useEffect(() => { mrSetCity(city); }, [city]);
  useEffect(() => {
    if (!D) return;
    const product = page === "product" ? products.find((p) => p.id === productId) : null;
    // The head describes the selected variation — its price, its photo, its own
    // canonical URL — so a shared link previews what the shopper actually saw.
    const variant = product && (product.variants.find((v) => v.id === prVariantId || (prSku && v.sku === prSku)) || defaultVariant(product.variants));
    setHead(headFor({
      page, product, variant, settings, categories,
      variantInUrl: !!new URLSearchParams(window.location.search).get("variant"),
      segment: fSeg,
      category: page === "shop" && fCat && fCat !== "all" ? fCat : "",
      brand: fBrand ? (brands.find((b) => b.id === fBrand) || { name: fBrand }).name : "",
      post: post && post.post ? post.post : null,
      infoPage: infoPage && infoPage.page ? infoPage.page : null,
    }), settings);
    trackEvent("page_view");
    mrRecord("page_view", { path: window.location.pathname });
    if (product && variant) {
      trackEvent("view_item", { id: variant.sku || product.id, name: product.name, value: variant.ngn });
      mrRecord("view_item", { productId: product.id, variantId: variant.id, value: variant.ngn });
      noteViewed(product.id);
    }
    if (page === "shop" && fCat && fCat !== "all") mrRecord("view_category", { cat: fCat });
    if (page === "checkout" && cc.items.length) {
      trackEvent("begin_checkout", { value: cc.total });
      mrRecord("begin_checkout", { value: cc.total });
    }
    if (page === "confirm" && placed) {
      trackEvent("purchase", { id: placed.no, value: placed.total || 0 });
      mrRecord("purchase", { value: placed.total || 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, productId, prVariantId, prSku, D, consent, fSeg, fCat, fBrand, post, infoPage]);

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

  // One box, two kinds of code: a public sale code, or a personal reward. The
  // server decides which it is — and, when it refuses, says why in a sentence
  // worth repeating, so "that reward was issued to a different email" reaches
  // the shopper instead of a flat "invalid".
  const applyPromo = useCallback(async () => {
    const code = co.promo.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api.post("/api/promos/validate", {
        code,
        // Sent so a reward bound to somebody else is refused now, while the
        // shopper can still do something about it, rather than at the end.
        contact: co.email.trim() || co.phone.trim(),
        items: cart.map((c) => ({ productId: c.id, variantId: c.variantId, sku: c.sku, size: c.size, qty: c.qty })),
      });
      if (r.valid) {
        setPromoInfo({
          code: r.code, kind: r.kind, value: r.value, scopeName: scopeNameOf(r),
          freeShip: r.freeShip, freeVariantId: r.freeVariantId || null, type: r.type || "promo",
        });
        setPromoMsg(`${r.code} applied — ${r.desc}.`);
      } else {
        setPromoInfo(null);
        setPromoMsg(r.reason || "That code isn't active right now.");
      }
    } catch (e) {
      setPromoInfo(null);
      setPromoMsg(e.message || "That code isn't active right now.");
    }
  }, [co.promo, co.email, co.phone, cart]);

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
        // What was in it, so the chase can put it back rather than only
        // mentioning that there was something.
        items: cart.map((c) => ({ variantId: c.variantId, qty: c.qty })),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(abandonTimer.current);
  }, [page, co, cc.total, cc.items.length, cityName, cart]);

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
        // Where this shopper came from, so the order can be credited to the ad
        // or link that brought them; and whether they accepted marketing
        // cookies, which alone lets the sale be reported to Meta.
        attribution: attributionForOrder(),
        adConsent: consent === "granted",
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
  }, [co, city, cart, promoInfo, plan, reconfirm, settings.contactPhone, nav, consent]);

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

  // The same list the pop-up feeds, joined from anywhere else on the store —
  // the newsletter block on the homepage today. The source is recorded so the
  // house can see which one people actually use.
  const joinList = useCallback((email, source) => {
    if (!String(email).includes("@")) return false;
    api.post("/api/leads", { email, source }).catch(() => {});
    return true;
  }, []);

  // Resolved from settings, with the words the store shipped with underneath —
  // see src/lib/consultation.js.
  const consultation = useMemo(
    () => consultationContent(settings, typeof window === "undefined" ? "" : window.location.hostname),
    [settings]
  );

  const ctx = {
    D, settings, locations, products, categories, page, nav, isMobile,
    city, cityName, L,
    setCityConfirmed: (c) => {
      try { localStorage.setItem("mr-city", c); localStorage.setItem("mr-city-ok", "1"); } catch {}
      setCity(c);
    },
    currency, setCurrency, toggleCurrency: () => setCurrency((c) => (c === "NGN" ? "USD" : "NGN")),
    fmt, catLabel, availInfo, variantAvail, defaultVariant, bestAlt, lowLine, scarcity, card, listings, payMethods,
    cart, cc, addToCart, cartOpen, setCartOpen, mnav, setMnav,
    // The phone's cart is a page; a desktop's is the drawer.
    openCart: () => (isMobile ? nav("cart") : setCartOpen(true)),
    sheet, setSheet, note, flash, mf, setMf,
    canGoBack: histIdx > 0,
    goBack: () => window.history.back(),
    collections, segments, deals, dailyDeal, brands, testimonials, latestPosts, refreshStore,
    search, setSearch, fCat, setFCat, fCol, setFCol, fScope, setFScope, fSort, setFSort,
    fSeg, setFSeg, fBrand, setFBrand,
    blog, blogTag, setBlogTag, post, postSlug, pageSlug, infoPage, pages: D ? (D.pages || []) : [],
    // The Perfume Studio's consultation page, resolved once here so the page,
    // the floating button and the footer all read one answer to "is the studio
    // taking bookings?". `embed_domain` has to be this host, which is why the
    // Calendly URL is assembled in the browser rather than on the server.
    consultation,
    // The home page, as the house arranged it. Empty until the store payload
    // lands — HomePage renders its hero from settings and nothing else, rather
    // than flashing a page in the wrong order.
    homeBlocks: D ? (D.homeBlocks || []) : [],
    proof, joinList,
    // The two rails off the stream: what this shopper was looking at, and what
    // other shoppers opened alongside it.
    recentIds: recentlyViewed(),
    clearRecent: () => { clearRecent(); setMeasureTick((n) => n + 1); },
    alsoViewed: D ? (D.alsoViewed || {}) : {},
    plan, planning, reconfirm, clearPromo, payNow,
    productId, prVariantId, setPrVariantId, prSku, setPrSku, prQty, setPrQty,
    co, setCo, promoInfo, promoMsg, applyPromo, coErr, placing, placeOrder, placed,
    track, setTrack, doTrack,
    cf, setCf, contactSent, sendContact,
    chat, setChat, sendChat,
    popup, setPopup, plEmail, setPlEmail, plDone, submitLead,
    nudge, dismissNudge: () => { setNudge(false); try { localStorage.setItem("mr-nudge-at", String(Date.now())); } catch {} },
    takeNudge: () => {
      setNudge(false);
      try { localStorage.setItem("mr-nudge-at", String(Date.now())); } catch {}
      mrRecord("nudge_clicked", {});
      if (isMobile) nav("cart");
      else setCartOpen(true);
    },
    closePopup: () => { try { localStorage.setItem("mr-popup-seen", "1"); } catch {} setPopup(false); },
    consent, showConsent: !consent,
    // Anyone can stop being counted, and no means no measurement at all rather
    // than "measure anyway and mark the row". The privacy page points here.
    measuring: !optedOut(),
    setMeasuring: (on) => { setOptOut(!on); setMeasureTick((n) => n + 1); },
    visitorId,
    grantConsent: () => { setConsent("granted"); setConsentState("granted"); },
    denyConsent: () => { setConsent("denied"); setConsentState("denied"); },
    cust, custData, custRegister, custLogin, custLogout, updateProfile, addAddress, removeAddress, toggleWishlist, joinWaitlist,
    wishlist,
    resetToken, custForgotPassword, custResetPassword,
  };

  // The shopping pages have a phone layout of their own (mobile-pages.jsx);
  // the rest are already single-column and simply sit in the phone's chrome.
  // Switched here rather than inside each page so a resize swaps components
  // instead of changing how many hooks one component calls.
  const pageEl =
    page === "home" ? (isMobile ? <MobileHome ctx={ctx} /> : <HomePage ctx={ctx} />) :
    page === "shop" ? (isMobile ? <MobileShop ctx={ctx} /> : <ShopPage ctx={ctx} />) :
    page === "categories" ? <CategoriesPage ctx={ctx} /> :
    page === "cart" ? <CartPage ctx={ctx} /> :
    page === "product" ? (isMobile ? <MobileProduct ctx={ctx} /> : <ProductPage ctx={ctx} />) :
    page === "about" ? <AboutPage ctx={ctx} /> :
    page === "checkout" ? (isMobile ? <MobileCheckout ctx={ctx} /> : <CheckoutPage ctx={ctx} />) :
    page === "confirm" ? <ConfirmPage ctx={ctx} /> :
    page === "track" ? <TrackPage ctx={ctx} /> :
    page === "contact" ? <ContactPage ctx={ctx} /> :
    page === "faq" ? <FaqPage ctx={ctx} /> :
    page === "info" ? <InfoPage ctx={ctx} /> :
    page === "account" ? <AccountPage ctx={ctx} /> :
    page === "wishlist" ? (isMobile ? <MobileWishlist ctx={ctx} /> : <WishlistPage ctx={ctx} />) :
    page === "locations" ? <LocationsPage ctx={ctx} /> :
    page === "reviews" ? <ReviewsPage ctx={ctx} /> :
    page === "blog" ? <BlogPage ctx={ctx} /> :
    page === "post" ? <BlogPostPage ctx={ctx} /> :
    page === "consultation" ? <ConsultationPage ctx={ctx} /> :
    isMobile ? <MobileHome ctx={ctx} /> : <HomePage ctx={ctx} />;

  // A phone gets its own chrome — tab bar, sheets, pinned actions — around the
  // same pages; see mobile-chrome.jsx.
  return isMobile ? <MobileChrome ctx={ctx}>{pageEl}</MobileChrome> : <Chrome ctx={ctx}>{pageEl}</Chrome>;
}
