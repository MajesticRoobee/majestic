// F3 — the integration layer: a scoped, API-key-authed partner API (/api/v1)
// and an MCP-compatible JSON-RPC endpoint (/api/mcp) exposing store data as
// tools to AI agents and external automation.
import { Hono } from "hono";
import { sha256hex, loadProducts, displayDate } from "./util.js";

// ---- shared API-key auth ----
async function authKey(env, req, ctx) {
  const hdr = req.header("authorization") || "";
  const key = hdr.startsWith("Bearer ") ? hdr.slice(7) : (req.header("x-api-key") || "");
  if (!key) return null;
  const row = await env.DB.prepare("SELECT * FROM api_keys WHERE key_hash=? AND enabled=1").bind(await sha256hex(key)).first();
  if (!row) return null;
  if (ctx && ctx.waitUntil) ctx.waitUntil(env.DB.prepare("UPDATE api_keys SET last_used=datetime('now') WHERE id=?").bind(row.id).run());
  return row;
}

// ---- shared data readers (used by both v1 and MCP) ----
async function readProducts(env) {
  const products = await loadProducts(env.DB);
  return products.map((p) => ({
    id: p.id, name: p.name, category: p.cat, family: p.family, live: p.live,
    prices: p.variants.map((v) => ({ size: v.size, ngn: v.ngn })),
    stock: p.variants.reduce((n, v) => n + v.stock.abuja + v.stock.lagos + v.stock.ibadan, 0),
  }));
}
async function readInventory(env, productId) {
  const products = await loadProducts(env.DB);
  return products.filter((p) => !productId || p.id === productId).map((p) => ({
    id: p.id, name: p.name,
    variants: p.variants.map((v) => ({ size: v.size, abuja: v.stock.abuja, lagos: v.stock.lagos, ibadan: v.stock.ibadan })),
  }));
}
async function readOrders(env, limit = 25) {
  const rows = (await env.DB.prepare("SELECT no, customer, city, fulfilled_from, method, pay, pay_status, status, total, placed_at FROM orders ORDER BY placed_at DESC LIMIT ?").bind(Math.min(100, limit)).all()).results;
  return rows.map((o) => ({ no: o.no, customer: o.customer, city: o.city, fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, paid: o.pay_status === "paid", status: o.status, total: o.total, placed: displayDate(new Date(o.placed_at.replace(" ", "T") + "Z")) }));
}
async function readOrder(env, no) {
  const o = await env.DB.prepare("SELECT * FROM orders WHERE no=?").bind(String(no).toUpperCase()).first();
  if (!o) return null;
  const items = (await env.DB.prepare("SELECT product_id, name, size, qty, unit_ngn FROM order_items WHERE order_no=?").bind(o.no).all()).results;
  return { no: o.no, customer: o.customer, phone: o.phone, email: o.email, city: o.city, fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, paid: o.pay_status === "paid", status: o.status, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, total: o.total, items };
}

// ---- /api/v1 (REST, read scope) ----
export const v1 = new Hono();
v1.use("*", async (c, next) => {
  const k = await authKey(c.env, c.req, c.executionCtx);
  if (!k) return c.json({ error: "Invalid or missing API key." }, 401);
  c.set("apiKey", k);
  return next();
});
v1.get("/products", async (c) => c.json({ products: await readProducts(c.env) }));
v1.get("/inventory", async (c) => c.json({ inventory: await readInventory(c.env, c.req.query("product")) }));
v1.get("/orders", async (c) => c.json({ orders: await readOrders(c.env, parseInt(c.req.query("limit") || "25", 10)) }));
v1.get("/orders/:no", async (c) => { const o = await readOrder(c.env, c.req.param("no")); return o ? c.json(o) : c.json({ error: "Order not found." }, 404); });
v1.get("/customers", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, email, name, phone, city, created_at FROM customers ORDER BY created_at DESC LIMIT 100").all()).results;
  return c.json({ customers: rows });
});

// ---- MCP tools ----
const TOOLS = [
  { name: "list_products", description: "List the Majestic Roobee catalogue with prices and total stock.", inputSchema: { type: "object", properties: {} } },
  { name: "get_inventory", description: "Per-store stock levels; pass productId to filter.", inputSchema: { type: "object", properties: { productId: { type: "string" } } } },
  { name: "list_orders", description: "Recent orders (most recent first).", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "get_order", description: "Full details of one order by its number (e.g. MR-10234).", inputSchema: { type: "object", properties: { no: { type: "string" } }, required: ["no"] } },
];

async function callTool(env, name, args = {}) {
  if (name === "list_products") return await readProducts(env);
  if (name === "get_inventory") return await readInventory(env, args.productId);
  if (name === "list_orders") return await readOrders(env, args.limit || 25);
  if (name === "get_order") return await readOrder(env, args.no);
  throw new Error("Unknown tool: " + name);
}

// MCP-compatible JSON-RPC over HTTP (single request/response).
export async function handleMcp(c) {
  const key = await authKey(c.env, c.req, c.executionCtx);
  if (!key) return c.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing API key." } }, 401);
  let msg;
  try { msg = await c.req.json(); } catch { return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const { id, method, params } = msg || {};
  const ok = (result) => c.json({ jsonrpc: "2.0", id, result });
  const err = (code, message) => c.json({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") return ok({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "majestic-roobee", version: "1.0.0" } });
  if (method === "notifications/initialized" || method === "notifications/cancelled") return new Response(null, { status: 204 });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    try {
      const result = await callTool(c.env, params?.name, params?.arguments || {});
      return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      return ok({ content: [{ type: "text", text: "Error: " + String(e.message || e) }], isError: true });
    }
  }
  return err(-32601, "Method not found: " + method);
}
