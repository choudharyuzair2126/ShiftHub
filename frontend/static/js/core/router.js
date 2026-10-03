export class Router {
  constructor() {
    this.handlers = new Map();
    window.addEventListener("hashchange", () => {});
  }
  on(path, handler) { this.handlers.set(path, handler); return this; }
  navigate(path) { window.location.hash = path.startsWith("#") ? path : `#${path}`; }
  current() {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    const [path, qs = ""] = hash.split("?");
    return { path, params: Object.fromEntries(new URLSearchParams(qs)) };
  }
  async resolve() {
    const { path, params } = this.current();
    let handler = this.handlers.get(path);
    if (!handler) {
      for (const [pattern, h] of this.handlers.entries()) {
        const rx = new RegExp("^" + pattern.replace(/:\w+/g, "([^/]+)") + "$");
        const m = path.match(rx);
        if (m) {
          const keys = (pattern.match(/:\w+/g) || []).map(k => k.slice(1));
          const dyn = Object.fromEntries(keys.map((k, i) => [k, m[i + 1]]));
          handler = (ctx) => h({ ...ctx, params: { ...params, ...dyn } });
          break;
        }
      }
    }
    if (!handler) {
      handler = () => `<div class="container section"><div class="empty"><div class="empty__icon">🔍</div><h3>Page not found</h3><p>The page you're looking for doesn't exist.</p></div></div>`;
    }
    const html = await handler({ params });
    return { html, path };
  }
}