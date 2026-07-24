import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useWindowWidth, cap, initialsOf, fmtCurrency } from "../lib/hooks.js";
import { Chrome } from "./chrome.jsx";
import { HomePage, ShopPage, ProductPage, AboutPage, CheckoutPage, ConfirmPage, TrackPage, ContactPage, PrivacyPage } from "./pages.jsx";
import { pathToRoute, routeToPath } from "./router.js";
import { headFor, setHead, setGscVerification } from "./seo.js";
import { hasTags, getConsent, setConsent, startAnalytics, track as trackEvent } from "./analytics.js";

const SCOPE_CATS = {
  Storewide: null,
  Fragrances: ["extrait", "designer", "sensual", "mist"],
  "Gift packages": ["package"],
  "Feminine care": ["care", "deo"],
};

export default function App() {
  const initialRoute = pathToRoute();
  const [D, setD] = useState(null);
  const dataRef = useRef(null);
  const [page, setPage] = useState(initialRoute.page);
  const [productId, setProductId] = useState(initialRoute.productId || null);
  const [prSize, setPrSize] = useState(null);
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
  const [fFam, setFFam] = useState("all");
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
      setPrSize(extra.prSize ?? null);
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
      if (r.page === "product") setPrSize(null);
      if (r.fCat) setFCat(r.fCat);
      setMnav(false);
      setCartOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const settings = D ? D.settings : {};
  const locations = D ? D.locations : [];
  const products = D ? D.products : [];
  const categories = D ? D.categories : [];
  const L = locations.find((l) => l.id === city) || null;
  const cityName = cap(city);

  const fmt = useCallback((ngn) => fmtCurrency(ngn, currency, settings.ngnPerUsd || 1550), [currency, settings.ngnPerUsd]);
  const catLabel = useCallback((id) => (categories.find((c) => c.id === id) || {}).label || "", [categories]);

  const bestAlt = useCallback((v) => {
    const alt = locations.filter((l) => l.id !== city && (v.stock[l.id] || 0) > 0);
    return alt.length ? alt[0] : null;
  }, [locations, city]);

  const availInfo = useCallback((p) => {
    const v = p.variants.find((x) => (x.stock[city] || 0) > 0) || p.variants[0];
    const inCity = (v.stock[city] || 0) > 0;
    const alt = inCity ? null : bestAlt(v);
    if (inCity) return { inCity, avail: "In " + cityName, badgeBg: "#e4efe4", badgeFg: "#3f6b45", soldOut: false, note: "At your store" };
    if (alt) return { inCity, avail: "Ships from " + alt.city, badgeBg: "transparent", badgeFg: "var(--mr-lavender-600)", soldOut: false, note: "3–5 days from " + alt.city, outline: true };
    return { inCity, avail: "Notify me", badgeBg: "var(--mr-sand)", badgeFg: "var(--mr-gold-600)", soldOut: true, note: "Out of stock" };
  }, [city, cityName, bestAlt]);

  const addToCart = useCallback((id, size, qty) => {
    setCart((cur) => {
      const next = cur.slice();
      const i = next.findIndex((c) => c.id === id && c.size === size);
      if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + qty };
      else next.push({ id, size, qty });
      return next;
    });
    setCartOpen(true);
    const D0 = dataRef.current;
    const p = D0 && D0.products.find((x) => x.id === id);
    const v = p && p.variants.find((x) => x.size === size);
    if (p && v) trackEvent("add_to_cart", { id, name: p.name, value: v.ngn * qty, items: [{ id, name: p.name, price: v.ngn, qty }] });
  }, []);

  const card = useCallback((p) => {
    const a = availInfo(p);
    const multi = p.variants.length > 1;
    const v0 = p.variants[0];
    return {
      id: p.id, name: p.name, imageUrl: p.imageUrl, catLabel: catLabel(p.cat), family: p.family,
      sizeLabel: multi ? "" : v0.size,
      priceLabel: (multi ? "From " : "") + fmt(v0.ngn),
      avail: a.avail, badgeBg: a.badgeBg, badgeFg: a.badgeFg, outline: !!a.outline,
      soldOut: a.soldOut, addLabel: a.soldOut ? "Notify me" : "Add to cart",
      href: "/product/" + p.id,
      open: () => nav("product", { productId: p.id, prSize: p.variants[0].size }),
      add: () => !a.soldOut && addToCart(p.id, v0.size, 1),
    };
  }, [availInfo, catLabel, fmt, nav, addToCart]);

  // Cart derivation (subtotal, shipping, discount, routing)
  const cc = useMemo(() => {
    if (!D) return { items: [], sub: 0, ship: 0, allInCity: true, discount: 0, total: 0 };
    let sub = 0;
    let allInCity = true;
    const lines = [];
    const items = cart.map((c, idx) => {
      const p = products.find((x) => x.id === c.id);
      if (!p) return null;
      const v = p.variants.find((x) => x.size === c.size) || p.variants[0];
      const inCity = (v.stock[city] || 0) >= c.qty;
      if (!inCity) allInCity = false;
      sub += v.ngn * c.qty;
      lines.push({ cat: p.cat, lineTotal: v.ngn * c.qty });
      const alt = inCity ? null : bestAlt(v);
      return {
        key: c.id + c.size, id: c.id, name: p.name, size: v.size, qty: c.qty,
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
    setHead(headFor({ page, product, settings, categories }));
    trackEvent("page_view");
    if (product) trackEvent("view_item", { id: product.id, name: product.name, value: product.variants[0].ngn });
    if (page === "checkout" && cc.items.length) trackEvent("begin_checkout", { value: cc.total });
    if (page === "confirm" && placed) trackEvent("purchase", { id: placed.no, value: placed.total || 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, productId, D, consent]);

  const applyPromo = useCallback(async () => {
    const code = co.promo.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api.post("/api/promos/validate", { code, items: cart.map((c) => ({ productId: c.id, size: c.size, qty: c.qty })) });
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
        items: cart.map((c) => ({ productId: c.id, size: c.size, qty: c.qty })),
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
    fmt, catLabel, availInfo, bestAlt, card,
    cart, cc, addToCart, cartOpen, setCartOpen, mnav, setMnav,
    search, setSearch, fCat, setFCat, fFam, setFFam, fSort, setFSort,
    productId, prSize, setPrSize, prQty, setPrQty,
    co, setCo, promoInfo, promoMsg, applyPromo, coErr, placing, placeOrder, placed,
    track, setTrack, doTrack,
    cf, setCf, contactSent, sendContact,
    chat, setChat, sendChat,
    popup, setPopup, plEmail, setPlEmail, plDone, submitLead,
    closePopup: () => { try { localStorage.setItem("mr-popup-seen", "1"); } catch {} setPopup(false); },
    consent, showConsent: !consent,
    grantConsent: () => { setConsent("granted"); setConsentState("granted"); },
    denyConsent: () => { setConsent("denied"); setConsentState("denied"); },
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
    <HomePage ctx={ctx} />;

  return <Chrome ctx={ctx}>{pageEl}</Chrome>;
}
