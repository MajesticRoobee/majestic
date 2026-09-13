// The low-stock line, exercised directly.
//
// The point of this file is that "low" is now a *reading* rather than a
// constant, and every way of reading it has a way of being wrong:
//
//   · an override on a variation must beat any computed figure
//   · days-of-cover must raise the line for a fast mover
//   · ...and must never lower it below the flat figure, or a piece that has
//     never sold goes from healthy to gone with no warning in between
//   · an alert must fire on the crossing, not every time the sweep runs
//   · ...and coming back up must re-arm it rather than being announced
import {
  lowStockConfig, thresholdFor, stateFor, worsened, computeStockStates,
  DEFAULT_THRESHOLD, DEFAULT_COVER_DAYS, DEFAULT_VELOCITY_DAYS,
} from "../worker/inventory.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. Reading the settings --------------------------------------------
console.log("\nSettings");

check("an empty settings blob is the old behaviour, exactly",
  lowStockConfig({}), { flat: DEFAULT_THRESHOLD, mode: "flat", coverDays: DEFAULT_COVER_DAYS, velocityDays: DEFAULT_VELOCITY_DAYS, alerts: true, onStorefront: true });
check("a number typed into a text box arrives as a string and is still a number",
  lowStockConfig({ lowStockThreshold: "12" }).flat, 12);
check("...and junk in the box does not become a threshold of NaN",
  lowStockConfig({ lowStockThreshold: "abc" }).flat, DEFAULT_THRESHOLD);
check("a negative threshold is clamped rather than making every shelf low",
  lowStockConfig({ lowStockThreshold: -4 }).flat, 0);
check("an unknown mode falls back to flat rather than silently doing nothing",
  lowStockConfig({ lowStockMode: "whatever" }).mode, "flat");
check("the velocity window has a floor — a week is the shortest honest sample",
  lowStockConfig({ lowStockVelocityDays: 1 }).velocityDays, 7);
check("alerts are on unless switched off",
  [lowStockConfig({}).alerts, lowStockConfig({ lowStockAlerts: false }).alerts], [true, false]);

// ---- 2. Where the line sits ---------------------------------------------
console.log("\nThe line");

const flat = lowStockConfig({ lowStockThreshold: 5 });
const cover = lowStockConfig({ lowStockThreshold: 5, lowStockMode: "cover", lowStockCoverDays: 14, lowStockVelocityDays: 30 });

check("with no override and no mode, the line is the house's number",
  thresholdFor({ cfg: flat }), 5);
check("an override on the variation wins outright",
  thresholdFor({ override: 40, cfg: flat }), 40);
check("...including an override of zero, which is the house saying 'never warn me'",
  thresholdFor({ override: 0, cfg: flat }), 0);
check("an empty override is not zero — it means 'use the store's'",
  thresholdFor({ override: "", cfg: flat }), 5);
check("...and neither is null",
  thresholdFor({ override: null, cfg: flat }), 5);
check("a negative override is ignored rather than inverting the test",
  thresholdFor({ override: -3, cfg: flat }), 5);

// 60 units over 30 days is two a day; fourteen days of cover is 28.
check("cover mode raises the line for something that actually sells",
  thresholdFor({ unitsSold: 60, cfg: cover }), 28);
check("...rounding up, because thirteen and a half days of cover is thirteen",
  thresholdFor({ unitsSold: 61, cfg: cover }), 29);
check("a piece that has never sold keeps the flat figure as its floor",
  thresholdFor({ unitsSold: 0, cfg: cover }), 5);
check("...and so does a slow one, rather than being warned about at one unit",
  thresholdFor({ unitsSold: 3, cfg: cover }), 5);
check("an override still beats the computed line in cover mode",
  thresholdFor({ override: 2, unitsSold: 600, cfg: cover }), 2);
check("cover mode is ignored while the mode is flat",
  thresholdFor({ unitsSold: 600, cfg: flat }), 5);

// ---- 3. State ------------------------------------------------------------
console.log("\nState");

check("nothing on the shelf is out, not low",
  stateFor(0, 5), "out");
check("the threshold itself counts as low — 'five or fewer' is what the box says",
  stateFor(5, 5), "low");
check("...and one above it is healthy",
  stateFor(6, 5), "ok");
check("a threshold of zero means only an empty shelf is ever news",
  [stateFor(1, 0), stateFor(0, 0)], ["ok", "out"]);

check("a shelf falling to low is news",
  worsened("ok", "low"), true);
check("low falling to out is news again — it is a different message",
  worsened("low", "out"), true);
check("a restock back to healthy is recorded, not announced",
  worsened("out", "ok"), false);
check("...and a sweep that finds nothing changed says nothing",
  worsened("low", "low"), false);
check("a pair the sweep has never seen before is treated as having been healthy",
  worsened(undefined, "low"), true);

// ---- 4. The sweep's arithmetic, across stores ---------------------------
console.log("\nAcross stores");

// The same variation, sitting differently in two stores, selling differently
// in each. This is the case a single global number cannot express.
const rows = [
  { variantId: 1, locationId: "abuja", qty: 20, lowStockAt: null },
  { variantId: 1, locationId: "ph", qty: 20, lowStockAt: null },
  { variantId: 2, locationId: "abuja", qty: 4, lowStockAt: null },
  { variantId: 3, locationId: "abuja", qty: 4, lowStockAt: 1 },
];
const sold = new Map([["1:abuja", 90], ["1:ph", 6]]);
const states = computeStockStates(rows, sold, cover);

check("the busy store's line is higher than the quiet store's for the same piece",
  [states[0].threshold, states[1].threshold], [42, 5]);
check("...so twenty units is low in one and healthy in the other",
  [states[0].state, states[1].state], ["low", "ok"]);
check("a piece with no sales anywhere still gets the flat line",
  [states[2].threshold, states[2].state], [5, "low"]);
check("and an override says 'this one is fine at four'",
  [states[3].threshold, states[3].state], [1, "ok"]);

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll inventory checks passed\n");
process.exit(failures ? 1 : 0);
