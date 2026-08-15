// Where an order ships from.
//
// The rule the house works by, in order of preference:
//   1. One parcel from the buyer's own store — nothing travels between cities.
//   2. One parcel from whichever single store holds the whole order.
//   3. Several parcels, each from the nearest store holding those pieces, with
//      the buyer told what the extra delivery costs before they commit.
//
// Everything here is pure so the quote the shopper sees and the plan the order
// is written from come out of the same function — a split the buyer accepted
// can't turn into a different split at checkout.

// Delivery price for one parcel: the store's own rate when it is the buyer's
// city, the cross-city rate otherwise.
function parcelShip(locationId, city, locations, settings) {
  const loc = locations.find((l) => l.id === locationId);
  if (locationId === city) return loc ? loc.ship_ngn : 2500;
  return settings.crossCityShipNGN ?? 4500;
}

function parcelEta(locationId, city, locations, settings) {
  const loc = locations.find((l) => l.id === locationId);
  if (locationId === city) return loc ? loc.eta : "1–2 days";
  return settings.crossCityEta || "3–5 days";
}

// Stores in the order we would rather use: the buyer's city, then the rest by
// their configured sort (the admin orders them nearest-first).
function preference(city, locations) {
  const rest = locations.filter((l) => l.id !== city).sort((a, b) => a.sort - b.sort).map((l) => l.id);
  return locations.some((l) => l.id === city) ? [city, ...rest] : rest;
}

const holds = (line, locId) => (line.variant.stock[locId] || 0) >= line.qty;

/**
 * @param lines     [{ product, variant, qty }]
 * @param locations active location rows, ascending `sort`
 * @param city      the buyer's chosen city
 * @param settings  site settings (cross-city rate/eta, free-delivery threshold)
 * @param fulfil    "delivery" | "collect"
 * @returns {
 *   mode: "single" | "split" | "unavailable",
 *   shipments: [{ locationId, store, city, eta, ship, items: [{ productId, name, size, qty }] }],
 *   shipTotal, primary, unavailable: [{ name, size, qty }], needsConfirmation
 * }
 */
export function planFulfilment({ lines, locations, city, settings = {}, fulfil = "delivery" }) {
  const order = preference(city, locations);
  const sub = lines.reduce((n, l) => n + l.variant.ngn * l.qty, 0);

  // Click & collect only works if the buyer's own store holds everything —
  // there is nothing to collect otherwise.
  if (fulfil === "collect") {
    const ok = order.includes(city) && lines.every((l) => holds(l, city));
    if (!ok) {
      return {
        mode: "unavailable", shipments: [], shipTotal: 0, primary: city, needsConfirmation: false,
        unavailable: lines.filter((l) => !holds(l, city)).map((l) => ({ name: l.product.name, size: l.variant.size, qty: l.qty })),
        collectBlocked: true,
      };
    }
    return {
      mode: "single", shipTotal: 0, primary: city, needsConfirmation: false, unavailable: [],
      shipments: [{ locationId: city, ...storeLabels(city, locations), eta: "Ready in about 3 hours", ship: 0, items: lines.map(itemOf) }],
    };
  }

  // 1 & 2 — a single store that holds everything, buyer's city first.
  const whole = order.find((locId) => lines.every((l) => holds(l, locId)));
  if (whole) {
    let ship = parcelShip(whole, city, locations, settings);
    if (whole === city && city === (settings.freeShipCity ?? "abuja") && sub >= (settings.freeShipAbujaOver ?? 100000)) ship = 0;
    return {
      mode: "single", shipTotal: ship, primary: whole, needsConfirmation: false, unavailable: [],
      shipments: [{
        locationId: whole, ...storeLabels(whole, locations),
        eta: parcelEta(whole, city, locations, settings), ship, items: lines.map(itemOf),
      }],
    };
  }

  // 3 — split. Every parcel costs another delivery fee, so the goal is the
  // fewest parcels, not the nearest store per line. Place the scarcest pieces
  // first (they have the least choice and so decide which stores open), then
  // let every flexible piece join a parcel that is already open. Only when
  // nothing open holds a piece does another parcel start, at its most
  // preferred store.
  const candidates = lines.map((line, i) => ({ line, i, stores: order.filter((id) => holds(line, id)) }));
  const unavailable = candidates.filter((c) => !c.stores.length).map((c) => itemOf(c.line));
  if (unavailable.length) {
    return { mode: "unavailable", shipments: [], shipTotal: 0, primary: city, unavailable, needsConfirmation: false };
  }

  const byLocation = new Map();
  const opened = [];
  for (const c of candidates.slice().sort((a, b) => a.stores.length - b.stores.length)) {
    const locId = c.stores.find((id) => opened.includes(id)) || c.stores[0];
    if (!opened.includes(locId)) opened.push(locId);
    if (!byLocation.has(locId)) byLocation.set(locId, []);
    byLocation.get(locId).push(c);
  }
  // Parcels list their contents in the order the shopper added them, not in
  // the order the packing heuristic happened to place them.
  for (const [locId, cs] of byLocation) byLocation.set(locId, cs.sort((a, b) => a.i - b.i).map((c) => c.line));

  const shipments = order
    .filter((id) => byLocation.has(id))
    .map((locId, i) => {
      const parcelLines = byLocation.get(locId);
      const parcelSub = parcelLines.reduce((n, l) => n + l.variant.ngn * l.qty, 0);
      let ship = parcelShip(locId, city, locations, settings);
      // The free-delivery threshold is a promise about the buyer's own store,
      // so it applies to that parcel on its own value.
      if (locId === city && city === (settings.freeShipCity ?? "abuja") && parcelSub >= (settings.freeShipAbujaOver ?? 100000)) ship = 0;
      return {
        locationId: locId, ...storeLabels(locId, locations),
        eta: parcelEta(locId, city, locations, settings), ship,
        items: parcelLines.map(itemOf), sort: i,
      };
    });

  return {
    mode: "split",
    shipments,
    shipTotal: shipments.reduce((n, s) => n + s.ship, 0),
    // The order's "fulfilled from" — the buyer's own store when it sends one of
    // the parcels, so store-scoped admins still see their orders.
    primary: (shipments.find((s) => s.locationId === city) || shipments[0]).locationId,
    unavailable: [],
    // A split costs more and arrives in pieces — the buyer says yes to that
    // before the order is written.
    needsConfirmation: true,
  };
}

function storeLabels(locId, locations) {
  const l = locations.find((x) => x.id === locId);
  return { store: l ? l.store : locId, city: l ? l.city : locId, address: l ? l.address : "" };
}

function itemOf(line) {
  return {
    productId: line.product.id, name: line.product.name,
    // The variation, not just its label — a plan has to say which SKU ships
    // from where, and the label is not an identity.
    variantId: line.variant.id, sku: line.variant.sku, size: line.variant.size,
    qty: line.qty, ngn: line.variant.ngn,
  };
}

