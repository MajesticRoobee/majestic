import { useEffect, useState } from "react";

/**
 * Close an open menu when the next click, or Escape, lands outside it.
 *
 * The obvious implementation — a full-screen `position: fixed` backdrop — does
 * not work inside the storefront header: the header carries a `backdrop-filter`,
 * which makes it a containing block for fixed children, so such a backdrop
 * covers the header alone and every click on the page below it misses. This
 * listens on the document instead, which has no such problem.
 */
export function useDismiss(ref, active, onDismiss) {
  useEffect(() => {
    if (!active) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onDismiss(); };
    const key = (e) => { if (e.key === "Escape") onDismiss(); };
    // pointerdown, not click: a menu that closes only on mouse-up stays open
    // through a press-and-drag, which reads as it having ignored you.
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [ref, active, onDismiss]);
}

export function useWindowWidth() {
  const [w, setW] = useState(typeof window === "undefined" ? 1200 : window.innerWidth);
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return w;
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export function initialsOf(name) {
  return (name || "").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("");
}

export function fmtCurrency(ngn, currency, ngnPerUsd = 1550) {
  if (currency === "USD") return "$" + Math.ceil(ngn / ngnPerUsd).toLocaleString();
  return "₦" + ngn.toLocaleString();
}
