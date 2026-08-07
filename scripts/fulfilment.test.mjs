// Exercise the fulfilment planner directly — the cases that matter are about
// which stores hold what, and those are painful to set up through the API.
import { planFulfilment } from "../worker/fulfilment.js";

const locations = [
  { id: "abuja", city: "Abuja", store: "Life Camp", address: "a", ship_ngn: 2500, eta: "1–2 days", sort: 1 },
  { id: "lagos", city: "Lagos", store: "Lekki", address: "b", ship_ngn: 3000, eta: "1–2 days", sort: 2 },
  { id: "ibadan", city: "Ibadan", store: "Bodija", address: "c", ship_ngn: 3500, eta: "2–3 days", sort: 3 },
];
const settings = { crossCityShipNGN: 4500, crossCityEta: "3–5 days", freeShipAbujaOver: 100000 };

const line = (name, stock, ngn = 10000, qty = 1) => ({
  product: { id: name, name }, qty,
  variant: { id: name, size: "30ml", ngn, stock },
});

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};
const shape = (p) => ({
  mode: p.mode,
  parcels: p.shipments.map((s) => `${s.locationId}:${s.items.map((i) => i.productId).join("+")}@${s.ship}`),
  shipTotal: p.shipTotal,
  confirm: p.needsConfirmation,
  primary: p.primary,
});

// 1. Everything at the buyer's own store — one parcel, local rate.
check("all in the buyer's city → one local parcel", shape(planFulfilment({
  lines: [line("a", { abuja: 5, lagos: 0, ibadan: 0 }), line("b", { abuja: 2, lagos: 9, ibadan: 0 })],
  locations, city: "abuja", settings,
})), { mode: "single", parcels: ["abuja:a+b@2500"], shipTotal: 2500, confirm: false, primary: "abuja" });

// 2. Nothing at home but one other store has the lot — one routed parcel.
check("one other store holds everything → single routed parcel", shape(planFulfilment({
  lines: [line("a", { abuja: 0, lagos: 5, ibadan: 0 }), line("b", { abuja: 0, lagos: 3, ibadan: 1 })],
  locations, city: "abuja", settings,
})), { mode: "single", parcels: ["lagos:a+b@4500"], shipTotal: 4500, confirm: false, primary: "lagos" });

// 3. No single store has it all → split, and the buyer must confirm.
check("no single store → split needing confirmation", shape(planFulfilment({
  lines: [line("a", { abuja: 5, lagos: 0, ibadan: 0 }), line("b", { abuja: 0, lagos: 4, ibadan: 0 })],
  locations, city: "abuja", settings,
})), { mode: "split", parcels: ["abuja:a@2500", "lagos:b@4500"], shipTotal: 7000, confirm: true, primary: "abuja" });

// 4. Two items both held by one distant store is still a single parcel, not a
//    split — rule 2 catches it before any splitting happens.
check("a distant store holding both → single parcel, no confirmation", shape(planFulfilment({
  lines: [line("scarce", { abuja: 0, lagos: 0, ibadan: 3 }), line("common", { abuja: 0, lagos: 5, ibadan: 5 })],
  locations, city: "abuja", settings,
})), { mode: "single", parcels: ["ibadan:scarce+common@4500"], shipTotal: 4500, confirm: false, primary: "ibadan" });

// 4b. The consolidation that saves a fee: a naive "nearest store per line" pass
//     would open Abuja + Lagos + Ibadan (₦11,500). The flexible line should
//     instead ride along with the scarce one, leaving two parcels.
check("flexible line joins an open parcel instead of opening a third", shape(planFulfilment({
  lines: [
    line("home", { abuja: 4, lagos: 0, ibadan: 0 }),
    line("flexible", { abuja: 0, lagos: 6, ibadan: 6 }),
    line("scarce", { abuja: 0, lagos: 0, ibadan: 2 }),
  ],
  locations, city: "abuja", settings,
})), { mode: "split", parcels: ["abuja:home@2500", "ibadan:flexible+scarce@4500"], shipTotal: 7000, confirm: true, primary: "abuja" });

// 5. Free local delivery over the threshold still applies.
check("free Abuja delivery over the threshold", shape(planFulfilment({
  lines: [line("a", { abuja: 5, lagos: 0, ibadan: 0 }, 120000)],
  locations, city: "abuja", settings,
})), { mode: "single", parcels: ["abuja:a@0"], shipTotal: 0, confirm: false, primary: "abuja" });

// 6. …and on the local parcel of a split, judged on that parcel's own value.
check("split: free local parcel, paid cross-city parcel", shape(planFulfilment({
  lines: [line("rich", { abuja: 5, lagos: 0, ibadan: 0 }, 150000), line("far", { abuja: 0, lagos: 2, ibadan: 0 })],
  locations, city: "abuja", settings,
})), { mode: "split", parcels: ["abuja:rich@0", "lagos:far@4500"], shipTotal: 4500, confirm: true, primary: "abuja" });

// 7. Quantity matters, not just presence.
check("a store with too few units can't hold the line", shape(planFulfilment({
  lines: [line("a", { abuja: 1, lagos: 9, ibadan: 0 }, 10000, 4)],
  locations, city: "abuja", settings,
})), { mode: "single", parcels: ["lagos:a@4500"], shipTotal: 4500, confirm: false, primary: "lagos" });

// 8. Out everywhere → unavailable, with the offending line named.
const gone = planFulfilment({
  lines: [line("ghost", { abuja: 0, lagos: 0, ibadan: 0 })],
  locations, city: "abuja", settings,
});
check("out of stock everywhere → unavailable", { mode: gone.mode, out: gone.unavailable.map((u) => u.name) }, { mode: "unavailable", out: ["ghost"] });

// 9. Collect needs everything at the buyer's own store.
check("collect with a gap is blocked", (() => {
  const p = planFulfilment({
    lines: [line("a", { abuja: 5, lagos: 0, ibadan: 0 }), line("b", { abuja: 0, lagos: 4, ibadan: 0 })],
    locations, city: "abuja", settings, fulfil: "collect",
  });
  return { mode: p.mode, blocked: !!p.collectBlocked, out: p.unavailable.map((u) => u.name) };
})(), { mode: "unavailable", blocked: true, out: ["b"] });

check("collect when the home store has it all is free", shape(planFulfilment({
  lines: [line("a", { abuja: 5, lagos: 0, ibadan: 0 })],
  locations, city: "abuja", settings, fulfil: "collect",
})), { mode: "single", parcels: ["abuja:a@0"], shipTotal: 0, confirm: false, primary: "abuja" });

// 10. A fourth store the house opens later is routed like any other.
check("a newly opened store participates in routing", shape(planFulfilment({
  lines: [line("a", { abuja: 0, lagos: 0, ibadan: 0, "port-harcourt": 4 })],
  locations: locations.concat({ id: "port-harcourt", city: "Port Harcourt", store: "GRA", address: "d", ship_ngn: 3000, eta: "2–3 days", sort: 4 }),
  city: "abuja", settings,
})), { mode: "single", parcels: ["port-harcourt:a@4500"], shipTotal: 4500, confirm: false, primary: "port-harcourt" });

console.log(failures ? `\n${failures} failing` : "\nAll planner cases pass.");
process.exit(failures ? 1 : 0);
