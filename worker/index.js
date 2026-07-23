import { Hono } from "hono";
import { shop } from "./shop.js";
import { admin } from "./admin.js";

const app = new Hono();

app.route("/api", shop);
app.route("/api/admin", admin);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong — the house has been notified." }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
