// Email through Resend, exercised with Resend stubbed out.
//
// What has to be true before the house pastes a key in: nothing a customer
// typed can break out of the letterhead, the link that is the point of an
// email becomes a button, a retry never sends twice, and a refusal says *why*
// — an unverified domain looked exactly like a wrong key in the old log.
import { renderEmail, sendEmail, emailConfig } from "../worker/email.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const db = { prepare: () => ({ first: async () => ({ value: JSON.stringify({ siteName: "Majestic Roobee", siteUrl: "https://shop.example", contactPhone: "0800" }) }) }) };

console.log("\nThe letterhead");
const { html, text } = renderEmail({
  subject: "Your <order>",
  text: "Hi Ada, <script>alert(1)</script> thanks.\n\nPick up where you left off: https://shop.example/?recover=abc\n\nQuestions? See https://shop.example/faq.",
  brand: { name: "Majestic Roobee", siteUrl: "https://shop.example" },
});
check("what a customer typed is escaped, never markup", html.includes("<script>"), false);
check("...including the subject", html.includes("Your &lt;order&gt;"), true);
check("a label and a lone link become a button", /<a href="https:\/\/shop\.example\/\?recover=abc"[^>]*>Pick up where you left off<\/a>/.test(html), true);
check("other links stay links in the text", html.includes('href="https://shop.example/faq"'), true);
check("...without swallowing the full stop after them", html.includes('href="https://shop.example/faq."'), false);
check("the plain-text part is the original", text.startsWith("Hi Ada,"), true);
check("the logo is the shop's own, absolute", html.includes('src="https://shop.example/logo-light.png"'), true);
check("with no site address, the name is set in type instead",
  renderEmail({ subject: "x", text: "y", brand: { name: "MR" } }).html.includes("<img"), false);

console.log("\nConfiguration");
check("no key, not connected", emailConfig({}).connected, false);
check("a Resend key is connected", emailConfig({ RESEND_API_KEY: "re_123" }).connected, true);
check("a mangled key is called out", emailConfig({ RESEND_API_KEY: "Bearer re_123" }).keyLooksWrong, true);
check("the sending domain is read off From", emailConfig({ RESEND_FROM: "MR <hello@majesticroobee.com>" }).domain, "majesticroobee.com");

console.log("\nSending");
let last = null;
globalThis.fetch = async (url, init) => { last = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ id: "em_1" }), { status: 200 }); };
const env = { DB: db, RESEND_API_KEY: "re_test", RESEND_FROM: "MR <hello@majesticroobee.com>", RESEND_REPLY_TO: "care@majesticroobee.com" };

check("no key: nothing is sent", (await sendEmail({ DB: db }, { to: "a@b.co", subject: "s", text: "t" })).sent, false);
check("no address: nothing is sent", (await sendEmail(env, { to: "08012345678", subject: "s", text: "t" })).detail, "no email address to send to");

const r = await sendEmail(env, { to: "ada@example.com", subject: "Hello", text: "Body", idempotencyKey: "run-42", tags: ["order_paid"] });
check("a send goes to Resend's API", [r.sent, r.id, last.url], [true, "em_1", "https://api.resend.com/emails"]);
check("...as HTML and text both", [typeof last.body.html, last.body.text], ["string", "Body"]);
check("...from the configured address, with replies routed", [last.body.from, last.body.reply_to], ["MR <hello@majesticroobee.com>", "care@majesticroobee.com"]);
check("...carrying the idempotency key, so a retry is sent once", last.init.headers["idempotency-key"], "run-42");
check("...and tagged with what it was", last.body.tags, [{ name: "kind", value: "order_paid" }]);
check("...with the key as a bearer token", last.init.headers.authorization, "Bearer re_test");

globalThis.fetch = async () => new Response(JSON.stringify({ name: "validation_error", message: "The majesticroobee.com domain is not verified." }), { status: 403 });
const refused = await sendEmail(env, { to: "ada@example.com", subject: "s", text: "t" });
check("a refusal carries Resend's own reason", refused.detail.includes("domain is not verified"), true);
check("...and says what to do", refused.detail.includes("Resend → Domains"), true);
check("...and is not retried — it would fail the same way", !!refused.retry, false);

globalThis.fetch = async () => new Response("{}", { status: 503 });
check("an outage on their side is worth one retry", (await sendEmail(env, { to: "ada@example.com", subject: "s", text: "t" })).retry, true);
globalThis.fetch = async () => { throw new Error("network down"); };
check("a network failure never throws", (await sendEmail(env, { to: "ada@example.com", subject: "s", text: "t" })).sent, false);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
