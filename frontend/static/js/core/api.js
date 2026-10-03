// Reads the API base URL from window.SHIFTHUB_API_BASE (set in index.html).
// Falls back to "" (same-origin) if not defined.
const BASE = (typeof window !== "undefined" && window.SHIFTHUB_API_BASE) || "";

export const tokenStore = {
  get() { return localStorage.getItem("sh_token") || ""; },
  set(t) { localStorage.setItem("sh_token", t); },
  clear() { localStorage.removeItem("sh_token"); },
};

async function request(path, { method = "GET", body, formData, auth = true } = {}) {
  const headers = {};
  if (!formData) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = tokenStore.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data;
}

export const api = {
  get:  (p, o) => request(p, { ...o, method: "GET" }),
  post: (p, body, o) => request(p, { ...o, method: "POST", body }),
  patch:(p, body, o) => request(p, { ...o, method: "PATCH", body }),
  del:  (p, o) => request(p, { ...o, method: "DELETE" }),
  upload: (p, formData, o) => request(p, { ...o, method: "POST", formData }),
};