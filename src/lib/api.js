// Thin API client shared by storefront and admin.

// The browser's own visitor id, sent on every call so the server can attach the
// visits this browser has already made to whoever it turns out to belong to
// when they sign in or order. It is a random string kept in this browser and
// means nothing anywhere else — see src/storefront/track.js. Absent in the
// admin, and absent for anyone who has opted out of being counted.
function visitorHeader() {
  try {
    if (localStorage.getItem("mr-no-measure") === "1") return {};
    const v = localStorage.getItem("mr-visitor");
    return v ? { "x-mr-visitor": v } : {};
  } catch { return {}; }
}

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...visitorHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data; // some errors carry a payload (e.g. the fulfilment plan)
    throw err;
  }
  return data;
}

export const api = {
  get: (path, token) => request(path, { token }),
  post: (path, body, token) => request(path, { method: "POST", body, token }),
  put: (path, body, token) => request(path, { method: "PUT", body, token }),
  patch: (path, body, token) => request(path, { method: "PATCH", body, token }),
  del: (path, token) => request(path, { method: "DELETE", token }),
};
