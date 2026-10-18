import { Router } from "./core/router.js";
import { tokenStore, api } from "./core/api.js";
import { session } from "./core/store.js";
import { toast } from "./core/toast.js";
import { authVM } from "./viewmodels/auth.vm.js";
import { setChatRefresh } from "./viewmodels/chat.vm.js";

import { homeView } from "./views/home.view.js";
import { loginView, registerView, forgotView, resetView, verifyPendingView } from "./views/auth.view.js";
import { jobsView, bindJobs } from "./views/jobs.view.js";
import { jobDetailView } from "./views/job-detail.view.js";
import { studentDashboardView } from "./views/student-dashboard.view.js";
import { employerDashboardView } from "./views/employer-dashboard.view.js";
import { renderChatWidget, bindChatWidget } from "./views/chat-widget.view.js";
import { renderNotificationBell, bindNotificationEvents } from "./views/notifications.view.js"; // <-- Import

const router = new Router();
let unreadNotifCount = 0;
let notifPollInterval = null;

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot", "/reset", "/verify", "/verify-pending"];
const isPublicPath = (path) => PUBLIC_ROUTES.includes(path) || path.startsWith("/jobs");

const routes = {
  "/": homeView,
  "/login": loginView,
  "/register": registerView,
  "/forgot": forgotView,
  "/reset": resetView,
  "/verify-pending": verifyPendingView,
  "/jobs": jobsView,
  "/jobs/:id": jobDetailView,
  "/dashboard": async () => {
    if (!session.user) { window.location.hash = "#/login"; return ""; }
    return session.user.role === "employer" ? await employerDashboardView() : await studentDashboardView();
  },
  "/verify": async (ctx) => {
    try {
      await authVM.verify(ctx.params.token);
      if (session.user && session.user.is_verified) window.location.hash = "#/dashboard";
      else window.location.hash = "#/login";
    } catch (e) { toast.error(e.message); window.location.hash = "#/login"; }
    return `<div class="container section"><p>Verifying…</p></div>`;
  },
};

Object.entries(routes).forEach(([p, h]) => router.on(p, h));

function refreshChat() {
  const mount = document.getElementById("chat-widget-root");
  if (!mount) return;
  mount.innerHTML = renderChatWidget();
  bindChatWidget(mount);
}
setChatRefresh(refreshChat);

// --- NOTIFICATION LOGIC ---
async function pollNotifications() {
  if (!session.user) return;
  try {
    const notifs = await api.get("/api/notifications");
    const unread = notifs.filter(n => !n.is_read).length;
    
    // If count changed, re-render the bell
    if (unread !== unreadNotifCount) {
      unreadNotifCount = unread;
      const bellMount = document.getElementById("notif-bell-root");
      if (bellMount) {
        bellMount.innerHTML = renderNotificationBell(unreadNotifCount);
        bindNotificationEvents();
      }
    }
  } catch {}
}

window.addEventListener("refresh-notifications", () => {
  unreadNotifCount = -1; // force refresh
  pollNotifications();
});

function navHTML() {
  const u = session.user;
  const isActive = (path) => window.location.hash.replace(/^#/, "").startsWith(path) ? "is-active" : "";
  return `
  <header class="nav">
    <div class="container nav__inner">
      <a href="#/" class="brand"><span class="brand__mark">S</span> ShiftHub</a>
      <nav class="nav__links">
        <a class="nav__link ${isActive("/jobs")}" href="#/jobs">Jobs</a>
        ${u ? `<a class="nav__link ${isActive("/dashboard")}" href="#/dashboard">Dashboard</a>` : ""}
      </nav>
      <div class="nav__spacer"></div>
      <div class="nav__actions">
        <button class="btn btn--icon btn--ghost" data-theme-toggle title="Toggle theme">🌙</button>
        
        <!-- Notification Bell -->
        <div id="notif-bell-root">${renderNotificationBell(unreadNotifCount)}</div>

        ${u ? `
          <div class="flex items-center gap-2">
            <span class="text-sm text-soft" style="display:inline">${escape(u.full_name)}</span>
            <button class="btn btn--ghost btn--sm" data-logout>Sign out</button>
          </div>
        ` : `
          <a href="#/login" class="btn btn--ghost btn--sm">Sign in</a>
          <a href="#/register" class="btn btn--primary btn--sm">Get started</a>
        `}
      </div>
    </div>
  </header>`;
}

function footerHTML() {
  return `
  <footer class="footer">
    <div class="container footer__grid">
      <div><div class="brand mb-2"><span class="brand__mark">S</span> ShiftHub</div><p class="text-sm" style="max-width:280px">City-based part-time jobs for students, powered by AI.</p></div>
      <div><div class="footer__title">Product</div><ul class="footer__list"><li><a href="#/jobs">Browse jobs</a></li><li><a href="#/register">Post a job</a></li><li><a href="#/dashboard">Dashboard</a></li></ul></div>
      <div><div class="footer__title">Company</div><ul class="footer__list"><li><a href="#">About</a></li><li><a href="#">Contact</a></li><li><a href="#">Privacy</a></li></ul></div>
      <div><div class="footer__title">Get in touch</div><ul class="footer__list"><li><a href="mailto:info@baraniinstitute.edu.pk">info@baraniinstitute.edu.pk</a></li><li><span class="text-sm text-muted">Sahiwal, Pakistan</span></li></ul></div>
    </div>
    <div class="container footer__bottom"><span>© ${new Date().getFullYear()} ShiftHub. All rights reserved.</span><span>Built with ♥ for students.</span></div>
  </footer>`;
}

function escape(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

async function render() {
  const { path } = router.current();

  if (session.user && !session.user.is_verified && !isPublicPath(path) && path !== "/verify-pending") {
    window.location.hash = "#/verify-pending";
    return;
  }

  const app = document.getElementById("app");
  const { html } = await router.resolve();

  app.innerHTML = `
    ${navHTML()}
    <main id="view-root">${html}</main>
    ${footerHTML()}
    <div id="chat-widget-root">${renderChatWidget()}</div>
  `;

  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙";
    btn.addEventListener("click", toggleTheme);
  });

  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    authVM.logout();
    window.location.hash = "#/";
    render();
  });

  const chatMount = document.getElementById("chat-widget-root");
  if (chatMount) bindChatWidget(chatMount);

  bindNotificationEvents();
  bindForms();
  bindResendVerification();
  if (path === "/jobs") bindJobs();
}

function bindForms() {
  document.querySelectorAll("[data-form]").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd);
      try {
        if (form.dataset.form === "login") {
          const u = await authVM.login({ email: data.email, password: data.password });
          window.location.hash = u.is_verified ? "#/dashboard" : "#/verify-pending";
        } else if (form.dataset.form === "register") {
          const u = await authVM.register(data);
          window.location.hash = u.is_verified ? "#/dashboard" : "#/verify-pending";
        } else if (form.dataset.form === "forgot") {
          await authVM.forgot(data.email); window.location.hash = "#/login";
        } else if (form.dataset.form === "reset") {
          const token = new URLSearchParams(window.location.hash.split("?")[1] || "").get("token");
          await authVM.reset(token, data.new_password); window.location.hash = "#/login";
        }
      } catch (err) { toast.error(err.message); }
    });
  });
}

function bindResendVerification() {
  const btn = document.querySelector("[data-resend-verify]");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true; const original = btn.textContent; btn.textContent = "Sending…";
    try { await authVM.resendVerification(); } catch (e) { toast.error(e.message); } 
    finally { btn.disabled = false; btn.textContent = original; }
  });
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("sh_theme", next);
  document.querySelectorAll("[data-theme-toggle]").forEach(b => b.textContent = next === "dark" ? "☀️" : "🌙");
}

async function boot() {
  await authVM.loadMe();
  if (!session.token) tokenStore.clear();

  const { path } = router.current();

  if (path === "/jobs") {
    const app = document.getElementById("app");
    app.innerHTML = `
      ${navHTML()}
      <main id="view-root"></main>
      ${footerHTML()}
      <div id="chat-widget-root">${renderChatWidget()}</div>
    `;
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙";
      btn.addEventListener("click", toggleTheme);
    });
    document.querySelector("[data-logout]")?.addEventListener("click", () => { authVM.logout(); window.location.hash = "#/"; render(); });
    
    const chatMount = document.getElementById("chat-widget-root");
    if (chatMount) bindChatWidget(chatMount);
    
    bindNotificationEvents();
    await jobsView();
    bindJobs();
  } else {
    await render();
  }

  // Start Notification Polling
  if (session.user) {
    pollNotifications();
    notifPollInterval = setInterval(pollNotifications, 10000); // 10 seconds
  }

  window.addEventListener("hashchange", render);

  const loader = document.getElementById("app-loading");
  if (loader) { loader.classList.add("is-hidden"); setTimeout(() => loader.remove(), 400); }
}

boot();