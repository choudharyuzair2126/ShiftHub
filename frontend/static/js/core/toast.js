export const toast = {
  show(message, type = "info", ttl = 3600) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease, transform .25s ease";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 250);
    }, ttl);
  },
  success(m) { this.show(m, "success"); },
  error(m)   { this.show(m, "error"); },
  info(m)    { this.show(m, "info"); },
};