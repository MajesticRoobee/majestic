import { useEffect, useState } from "react";

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
