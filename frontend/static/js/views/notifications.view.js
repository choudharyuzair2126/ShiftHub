import { session } from "../core/store.js";
import { api } from "../core/api.js";

export function renderNotificationBell(unreadCount) {
  if (!session.user) return "";
  return `
    <div style="position:relative;display:inline-block;margin-right:.5rem">
      <button class="btn btn--icon btn--ghost" id="notif-bell" style="position:relative">
        🔔
        ${unreadCount > 0 ? `
          <span style="position:absolute;top:-2px;right:-2px;background:var(--c-danger);color:#fff;font-size:10px;font-weight:bold;padding:2px 5px;border-radius:10px;line-height:1;">
            ${unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ` : ""}
      </button>
      
      <div id="notif-panel" class="hidden" style="position:absolute;top:100%;right:0;width:320px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);z-index:1000;margin-top:.5rem;overflow:hidden">
        <div style="padding:.75rem 1rem;border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:center;background:var(--c-bg-soft)">
          <b style="font-size:.9rem">Notifications</b>
          <button class="text-xs text-muted" id="mark-read-btn" style="background:none;border:none;cursor:pointer;text-decoration:underline">Mark all read</button>
        </div>
        <div id="notif-list" style="max-height:300px;overflow-y:auto;padding:.5rem">
          <div class="text-center text-muted text-sm" style="padding:1rem">Loading…</div>
        </div>
      </div>
    </div>
  `;
}

export function bindNotificationEvents() {
  const bell = document.getElementById("notif-bell");
  const panel = document.getElementById("notif-panel");
  const list = document.getElementById("notif-list");
  const markReadBtn = document.getElementById("mark-read-btn");

  if (!bell || !panel) return;

  bell.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isHidden = panel.classList.contains("hidden");
    
    panel.classList.toggle("hidden");
    
    if (isHidden) {
      try {
        const notifs = await api.get("/api/notifications");
        if (notifs.length === 0) {
          list.innerHTML = `<div class="text-center text-muted text-sm" style="padding:1rem">No notifications yet.</div>`;
        } else {
          list.innerHTML = notifs.map(n => `
            <div style="padding:.75rem;border-bottom:1px solid var(--c-border);font-size:.85rem;background:${n.is_read ? 'transparent' : 'var(--brand-50)'}">
              <div style="font-weight:600;color:var(--c-text)">${escape(n.title)}</div>
              <div style="color:var(--c-text-soft);margin-top:.2rem">${escape(n.content)}</div>
              <div style="font-size:.7rem;color:var(--c-text-muted);margin-top:.35rem">${new Date(n.created_at).toLocaleString()}</div>
            </div>
          `).join("");
        }
      } catch (err) {
        list.innerHTML = `<div class="text-center text-danger text-sm" style="padding:1rem">Failed to load.</div>`;
      }
    }
  });

  markReadBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await api.post("/api/notifications/read");
    window.dispatchEvent(new CustomEvent("refresh-notifications"));
    panel.classList.add("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== bell) {
      panel.classList.add("hidden");
    }
  });
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}