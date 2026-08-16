// A stand-in for api.paystack.co, for exercising the checkout locally without
// touching a real gateway.
//
// It speaks the two endpoints the Worker calls — initialize and verify — and
// serves a page at the "authorization_url" with a Pay / Abandon choice, so the
// whole redirect round trip can be walked exactly as a shopper walks it.
//
// Run it, then point the Worker at it:
//   node scripts/paystack-stub.mjs &
//   PAYSTACK_API_BASE=http://127.0.0.1:9999 npx wrangler dev --local
import { createServer } from "node:http";
import { createHmac } from "node:crypto";

const PORT = Number(process.env.PORT || 9999);
const SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_stub";
const SITE = process.env.SITE_URL || "http://127.0.0.1:8788";
const txns = new Map();

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const body = (req) => new Promise((resolve) => {
  let s = "";
  req.on("data", (c) => (s += c));
  req.on("end", () => resolve(s));
});

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/transaction/initialize" && req.method === "POST") {
    const b = JSON.parse(await body(req));
    txns.set(b.reference, { ...b, status: "abandoned" });
    return json(res, 200, {
      status: true,
      data: {
        authorization_url: `http://127.0.0.1:${PORT}/pay/${encodeURIComponent(b.reference)}`,
        reference: b.reference,
      },
    });
  }

  if (url.pathname.startsWith("/transaction/verify/")) {
    const ref = decodeURIComponent(url.pathname.split("/").pop());
    const t = txns.get(ref);
    if (!t) return json(res, 404, { status: false, message: "not found" });
    return json(res, 200, {
      status: true,
      data: { status: t.status, currency: t.currency, amount: t.amount, channel: "card", reference: ref },
    });
  }

  // The hosted checkout page.
  if (url.pathname.startsWith("/pay/")) {
    const ref = decodeURIComponent(url.pathname.slice(5));
    const t = txns.get(ref);
    if (!t) { res.writeHead(404); return res.end("unknown reference"); }

    if (url.searchParams.get("do") === "pay") {
      t.status = "success";
      // Fire the webhook the way Paystack does — signed, server to server.
      const payload = JSON.stringify({
        event: "charge.success",
        data: { reference: ref, status: "success", currency: t.currency, amount: t.amount, channel: "card", metadata: t.metadata },
      });
      const sig = createHmac("sha512", SECRET).update(payload).digest("hex");
      fetch(`${SITE}/api/paystack/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-paystack-signature": sig },
        body: payload,
      }).then((r) => console.log(`  webhook -> HTTP ${r.status}`)).catch((e) => console.log("  webhook failed", e.message));
      res.writeHead(302, { location: t.callback_url });
      return res.end();
    }
    if (url.searchParams.get("do") === "abandon") {
      res.writeHead(302, { location: t.callback_url });
      return res.end();
    }

    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><meta charset=utf-8>
      <body style="font-family:system-ui;padding:40px;max-width:420px;margin:auto">
      <h2>Paystack (stub)</h2>
      <p>${t.email} — <strong>₦${(t.amount / 100).toLocaleString()}</strong></p>
      <p><code>${ref}</code></p>
      <p><a id=pay href="?do=pay">Pay</a> &nbsp;|&nbsp; <a id=abandon href="?do=abandon">Abandon</a></p>
      </body>`);
  }

  return json(res, 404, { status: false });
}).listen(PORT, "127.0.0.1", () => console.log(`Paystack stub on http://127.0.0.1:${PORT}`));
