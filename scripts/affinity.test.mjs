// "Other people also opened…", exercised directly.
//
// A recommendation rail is a shop's opinion, stated to a shopper as if it were
// a fact, so the arithmetic behind it has to be honest about how thin it is:
//
//   · one person opening two things together is not a pattern
//   · somebody browsing the entire shop is not a pattern either
//   · the ranking has to be stable, or the same page reorders on every rebuild
import { pairCounts, affinityRows, MAX_BASKET, MIN_SCORE } from "../worker/affinity.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};
const counted = (c) => Object.fromEntries([...c.entries()].sort());

// ---- 1. Counting pairs ----------------------------------------------------
console.log("\nPairs");

check("two products opened in one visit is one pairing",
  counted(pairCounts([["a", "b"]])), { "a|b": 1 });
check("three products make three pairings, not six",
  Object.keys(counted(pairCounts([["a", "b", "c"]]))), ["a|b", "a|c", "b|c"]);
check("the same visit opening one product twice is still one product",
  counted(pairCounts([["a", "a", "b"]])), { "a|b": 1 });
check("order within a visit does not matter — a pairing is a pairing",
  counted(pairCounts([["b", "a"]])), { "a|b": 1 });
check("two visits agreeing counts twice",
  counted(pairCounts([["a", "b"], ["b", "a"]])), { "a|b": 2 });
check("a visit that opened one thing pairs it with nothing",
  counted(pairCounts([["a"]])), {});

// Somebody who opens the entire shop in one sitting is browsing, not
// comparing, and pairing all of it would end up saying everything goes with
// everything — which is the classic way this feature becomes useless.
const wide = [Array.from({ length: MAX_BASKET + 1 }, (_, i) => "p" + i)];
check("a visit wider than the cap is left out of the graph entirely",
  counted(pairCounts(wide)), {});
check("...and one exactly at the cap is still counted",
  pairCounts([Array.from({ length: MAX_BASKET }, (_, i) => "p" + i)]).size, (MAX_BASKET * (MAX_BASKET - 1)) / 2);

// ---- 2. What survives to become a recommendation --------------------------
console.log("\nWhat becomes a recommendation");

check("one person, once, is not a pattern and is thrown away",
  affinityRows(pairCounts([["a", "b"]])), []);
check("...two visits agreeing is the least that counts",
  affinityRows(pairCounts([["a", "b"], ["a", "b"]])).map((r) => `${r.productId}->${r.otherId}`), ["a->b", "b->a"]);
check("a pairing is stored both ways round, so neither page has to look for it",
  affinityRows(pairCounts([["a", "b"], ["a", "b"]])).length, 2);
check("the threshold is the one named, not a number hidden in the query",
  MIN_SCORE, 2);

const busy = [];
for (let i = 0; i < 5; i++) busy.push(["hero", "strong"]);
for (let i = 0; i < 3; i++) busy.push(["hero", "middle"]);
for (let i = 0; i < 2; i++) busy.push(["hero", "weak"]);
const ranked = affinityRows(pairCounts(busy)).filter((r) => r.productId === "hero");
check("the strongest pairing leads",
  ranked.map((r) => r.otherId), ["strong", "middle", "weak"]);
check("only so many are kept per product — a rail is four cards, not forty",
  affinityRows(pairCounts(Array.from({ length: 40 }, (_, i) => ["hero", "p" + (i % 20)])
    .concat(Array.from({ length: 40 }, (_, i) => ["hero", "p" + (i % 20)]))), { keep: 3 })
    .filter((r) => r.productId === "hero").length, 3);
// Two products tied on score must not swap places between rebuilds, or the
// same page quietly reorders itself every night for no reason.
check("a tie breaks the same way every time",
  affinityRows(pairCounts([["hero", "b"], ["hero", "b"], ["hero", "a"], ["hero", "a"]]))
    .filter((r) => r.productId === "hero").map((r) => r.otherId), ["a", "b"]);

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll affinity checks passed\n");
process.exit(failures ? 1 : 0);
