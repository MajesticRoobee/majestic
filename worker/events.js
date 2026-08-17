// F2 — event + automation backbone, and F3 outbound webhook delivery.
//
// emitEvent() records a domain event, fans it out to registered webhooks, and
// enqueues any matching automations into the outbox. A scheduled (cron) handler
// drains time-based automations (abandoned carts, birthdays) and the outbox.

const te = new TextEncoder();

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, te.encode(msg));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deliverWebhooks(env, type, event) {
  const hooks = (await env.DB.prepare("SELECT * FROM webhooks WHERE enabled=1").all()).results;
  const matching = hooks.filter((h) => h.events === "*" || h.events.split(",").map((s) => s.trim()).includes(type));
  await Promise.all(matching.map(async (h) => {
    const body = JSON.stringify({ id: event.id, type, entity: event.entity, payload: event.payload, at: new Date().toISOString() });
    try {
      const sig = await hmacHex(h.secret, body);
      const res = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json", "x-mr-event": type, "x-mr-signature": sig }, body });
      await env.DB.prepare("UPDATE webhooks SET last_status=? WHERE id=?").bind(`${res.status} @ ${new Date().toISOString()}`, h.id).run();
    } catch (e) {
      await env.DB.prepare("UPDATE webhooks SET last_status=? WHERE id=?").bind(`error: ${String(e).slice(0, 60)}`, h.id).run();
    }
  }));
}

function renderRun(automation, payload) {
  // recipient + a lightly personalised subject/body from the event payload
  const recipient = payload.email || payload.contact || payload.phone || "";
  const name = (payload.name || payload.customer || "").split(" ")[0] || "there";
  let subject = automation.template_title;
  let body = automation.template_body;
  if (payload.orderNo) { subject += ` (${payload.orderNo})`; }
  body = `Hi ${name}, ${body}`;
  if (payload.orderNo) body += `\n\nOrder: ${payload.orderNo}${payload.total ? ` — ₦${Number(payload.total).toLocaleString("en-US")}` : ""}`;
  if (payload.productName) body += `\n\n${payload.productName} is ready at ${payload.city || "your store"}.`;
  return { recipient, subject, body };
}

async function enqueue(env, automation, eventId, payload, scheduledAt) {
  const { recipient, subject, body } = renderRun(automation, payload);
  await env.DB.prepare(
    "INSERT INTO automation_runs (automation_id, event_id, recipient, subject, body, status, scheduled_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
  ).bind(automation.id, eventId || null, recipient, subject, body, scheduledAt || null).run();
  await env.DB.prepare("UPDATE automations SET runs = runs + 1 WHERE id=?").bind(automation.id).run();
}

async function enqueueAutomations(env, type, eventId, payload) {
  const autos = (await env.DB.prepare("SELECT * FROM automations WHERE enabled=1 AND trigger=?").bind(type).all()).results;
  for (const a of autos) {
    if (type === "product_restocked") {
      // one run per waiting shopper, then clear them
      const waiters = (await env.DB.prepare("SELECT * FROM stock_waitlist WHERE product_id=? AND notified=0").bind(payload.productId).all()).results;
      for (const w of waiters) {
        await enqueue(env, a, eventId, { ...payload, contact: w.contact, city: w.city });
        await env.DB.prepare("UPDATE stock_waitlist SET notified=1 WHERE id=?").bind(w.id).run();
      }
    } else {
      await enqueue(env, a, eventId, payload);
    }
  }
}

export async function emitEvent(env, type, { entity = null, payload = {}, ctx } = {}) {
  const r = await env.DB.prepare("INSERT INTO events (type, entity, payload) VALUES (?, ?, ?)").bind(type, entity, JSON.stringify(payload)).run();
  const eventId = r.meta.last_row_id;
  const work = (async () => {
    try { await deliverWebhooks(env, type, { id: eventId, entity, payload }); } catch {}
    try { await enqueueAutomations(env, type, eventId, payload); } catch {}
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;
  return eventId;
}

/**
 * Send one email right now, outside the automation outbox.
 *
 * Password reset is the first thing here that is *transactional in the strict
 * sense*: it is worthless fifteen minutes later when the cron next drains the
 * outbox, so it cannot ride the same queue as a birthday greeting.
 *
 * With no provider configured it still records the message — as a `queued` run
 * carrying its own subject and body — so the reset link is recoverable from
 * Admin → Integrations rather than silently lost. That is what makes this
 * feature testable, and usable by the house, before Resend is connected.
 *
 * Returns { sent, detail }.
 */
export async function sendTransactional(env, { to, subject, body, kind = "transactional" }) {
  const recipient = String(to || "").trim();
  let outcome = { sent: false, detail: "no email provider configured" };
  if (env.RESEND_API_KEY && recipient.includes("@")) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.RESEND_FROM || "Majestic Roobee <hello@majesticroobee.com>", to: recipient, subject, text: body }),
      });
      outcome = res.ok ? { sent: true, detail: "via Resend" } : { sent: false, detail: `Resend ${res.status}` };
    } catch (e) {
      outcome = { sent: false, detail: String(e).slice(0, 60) };
    }
  }
  await env.DB.prepare(
    "INSERT INTO automation_runs (automation_id, recipient, subject, body, status, detail, processed_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(kind, recipient, subject, body, outcome.sent ? "sent" : "queued", outcome.detail).run();
  return outcome;
}

// Dispatch a single outbox run. Email/WhatsApp send once a provider is wired
// (Phase 2/3); until then they're marked "queued" so nothing is lost.
async function dispatchRun(env, run, automation) {
  if (automation.action === "email") {
    if (env.RESEND_API_KEY && run.recipient && run.recipient.includes("@")) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ from: env.RESEND_FROM || "Majestic Roobee <hello@majesticroobee.com>", to: run.recipient, subject: run.subject, text: run.body }),
        });
        return res.ok ? { status: "sent", detail: "via Resend" } : { status: "failed", detail: `Resend ${res.status}` };
      } catch (e) { return { status: "failed", detail: String(e).slice(0, 60) }; }
    }
    return { status: "queued", detail: "awaiting email provider (Resend)" };
  }
  if (automation.action === "whatsapp") return { status: "queued", detail: "awaiting WhatsApp Business API" };
  return { status: "skipped", detail: "no dispatcher for " + automation.action };
}

// Cron: enqueue time-based automations, then drain the outbox.
export async function runScheduled(env) {

  // Abandoned-cart recovery — one chase per cart, after its delay.
  const cartAuto = await env.DB.prepare("SELECT * FROM automations WHERE id='abandoned_cart' AND enabled=1").first();
  if (cartAuto) {
    const stale = (await env.DB.prepare(
      "SELECT * FROM abandoned_checkouts WHERE converted=0 AND reminded=0 AND updated_at <= datetime('now', ?)"
    ).bind(`-${cartAuto.delay_minutes} minutes`).all()).results;
    for (const c of stale) {
      const eventId = await emitEvent(env, "checkout_abandoned", { entity: c.contact_key, payload: { name: c.name, email: c.email, phone: c.phone, contact: c.email || c.phone, city: c.city, total: c.value_ngn } });
      await enqueue(env, cartAuto, eventId, { name: c.name, email: c.email, contact: c.email || c.phone, city: c.city, total: c.value_ngn });
      await env.DB.prepare("UPDATE abandoned_checkouts SET reminded=1 WHERE id=?").bind(c.id).run();
    }
  }

  // Drain the outbox (due runs).
  const due = (await env.DB.prepare(
    "SELECT r.*, a.action AS a_action FROM automation_runs r JOIN automations a ON a.id=r.automation_id WHERE r.status='pending' AND (r.scheduled_at IS NULL OR r.scheduled_at <= datetime('now')) LIMIT 100"
  ).all()).results;
  for (const run of due) {
    const automation = { id: run.automation_id, action: run.a_action };
    const { status, detail } = await dispatchRun(env, run, automation);
    await env.DB.prepare("UPDATE automation_runs SET status=?, detail=?, processed_at=datetime('now') WHERE id=?").bind(status, detail, run.id).run();
  }
  return { drained: due.length };
}
