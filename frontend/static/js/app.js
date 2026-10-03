import { Router } from "./core/router.js";
import { tokenStore } from "./core/api.js";
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

const router = new Router();

// Routes anyone can access, even when logged-in-but-unverified
const PUBLIC_ROUTES = [
  "/", "/login", "/register", "/forgot", "/reset",
  "/verify", "/verify-pending",
];
const isPublicPath = (path) =>
  PUBLIC_ROUTES.includes(path) || path.startsWith("/jobs");

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
    return session.user.role === "employer"
      ? await employerDashboardView()
      : await studentDashboardView();
  },
  "/verify": async (ctx) => {
    try {
      await authVM.verify(ctx.params.token);
      // authVM.verify already refreshed session.user
      if (session.user && session.user.is_verified) {
        window.location.hash = "#/dashboard";
      } else {
        window.location.hash = "#/login";
      }
    } catch (e) {
      toast.error(e.message);
      window.location.hash = "#/login";
    }
    return `<div class="container section"><p>Verifying…</p></div>`;
  },
};

Object.entries(routes).forEach(([p, h]) => router.on(p, h));

// ---------------------------------------------------------------------------
// Chat widget refresh hook
// ---------------------------------------------------------------------------

function refreshChat() {
  const mount = document.getElementById("chat-widget-root");
  if (!mount) return;
  mount.innerHTML = renderChatWidget();
  bindChatWidget(mount);
}
setChatRefresh(refreshChat);

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function navHTML() {
  const u = session.user;
  const isActive = (path) =>
    window.location.hash.replace(/^#/, "").startsWith(path) ? "is-active" : "";
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
      <div>
        <div class="brand mb-2"><span class="brand__mark">S</span> ShiftHub</div>
        <p class="text-sm" style="max-width:280px">City-based part-time jobs for students, powered by AI.</p>
      </div>
      <div>
        <div class="footer__title">Product</div>
        <ul class="footer__list">
          <li><a href="#/jobs">Browse jobs</a></li>
          <li><a href="#/register">Post a job</a></li>
          <li><a href="#/dashboard">Dashboard</a></li>
        </ul>
      </div>
      <div>
        <div class="footer__title">Company</div>
        <ul class="footer__list">
          <li><a href="#">About</a></li>
          <li><a href="#">Contact</a></li>
          <li><a href="#">Privacy</a></li>
        </ul>
      </div>
      <div>
        <div class="footer__title">Get in touch</div>
        <ul class="footer__list">
          <li><a href="mailto:info@baraniinstitute.edu.pk">info@baraniinstitute.edu.pk</a></li>
          <li><span class="text-sm text-muted">Sahiwal, Pakistan</span></li>
        </ul>
      </div>
    </div>
    <div class="container footer__bottom">
      <span>© ${new Date().getFullYear()} ShiftHub. All rights reserved.</span>
      <span>Built with ♥ for students.</span>
    </div>
  </footer>`;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Main render (with verification guard)
// ---------------------------------------------------------------------------

async function render() {
  const { path } = router.current();

  // ---- GUARD: logged in but not verified → force verify page ----
  if (
    session.user &&
    !session.user.is_verified &&
    !isPublicPath(path) &&
    path !== "/verify-pending"
  ) {
    window.location.hash = "#/verify-pending";
    return; // hashchange will re-trigger render()
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

  bindForms();
  bindResendVerification();
  if (path === "/jobs") bindJobs();
}

// ---------------------------------------------------------------------------
// Form bindings (login / register / forgot / reset)
// ---------------------------------------------------------------------------

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
          await authVM.forgot(data.email);
          window.location.hash = "#/login";
        } else if (form.dataset.form === "reset") {
          const token = new URLSearchParams(window.location.hash.split("?")[1] || "").get("token");
          if (!token) throw new Error("Missing reset token");
          await authVM.reset(token, data.new_password);
          window.location.hash = "#/login";
        }
      } catch (err) {
        toast.error(err.message);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Resend verification button (on the /verify-pending page)
// ---------------------------------------------------------------------------

function bindResendVerification() {
  const btn = document.querySelector("[data-resend-verify]");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Sending…";
    try {
      await authVM.resendVerification();
    } catch (e) {
      toast.error(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("sh_theme", next);
  document.querySelectorAll("[data-theme-toggle]").forEach(b => {
    b.textContent = next === "dark" ? "☀️" : "🌙";
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  await authVM.loadMe();
  if (!session.token) tokenStore.clear();

  const { path } = router.current();

  // Special case: direct hit on /jobs (jobsView renders its own skeleton)
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
    document.querySelector("[data-logout]")?.addEventListener("click", () => {
      authVM.logout();
      window.location.hash = "#/";
      render();
    });

    await jobsView();

    const chatMount = document.getElementById("chat-widget-root");
    if (chatMount) bindChatWidget(chatMount);
    bindJobs();
  } else {
    await render();
  }

  window.addEventListener("hashchange", render);

  const loader = document.getElementById("app-loading");
  if (loader) {
    loader.classList.add("is-hidden");
    setTimeout(() => loader.remove(), 400);
  }
}

boot();