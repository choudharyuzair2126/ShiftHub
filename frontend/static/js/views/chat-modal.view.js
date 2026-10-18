import { api } from "../core/api.js";
import { session } from "../core/store.js";
import { toast } from "../core/toast.js";

let pollInterval = null;

export function openChatModal(appId, otherPersonName, jobTitle) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal style="width:min(100%,560px);height:600px;display:flex;flex-direction:column;padding:0;overflow:hidden;text-align:left;">
        
        <!-- Header -->
        <div style="padding:1rem;border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:center;background:var(--c-surface)">
          <div>
            <h3 style="margin:0;font-size:1.1rem">${escape(otherPersonName)}</h3>
            <div class="text-xs text-muted">Re: ${escape(jobTitle)}</div>
          </div>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>

        <!-- Message Area -->
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;background:var(--c-bg-soft)">
          <div class="text-center text-muted text-sm mt-4">Loading…</div>
        </div>

        <!-- Input Area -->
        <form id="chat-form" style="padding:1rem;border-top:1px solid var(--c-border);display:flex;gap:.5rem;background:var(--c-surface)">
          <input class="input" id="chat-input" placeholder="Type a message…" autocomplete="off" required />
          <button class="btn btn--primary" type="submit" id="chat-send-btn">Send</button>
        </form>

      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeChatModal));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());

  // Load initial messages
  fetchMessages(appId, true);
  markRead(appId);

  // Start polling every 3 seconds
  pollInterval = setInterval(() => {
    fetchMessages(appId, false);
    markRead(appId);
  }, 3000);

  // Handle Send
  const form = document.getElementById("chat-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    const btn = document.getElementById("chat-send-btn");
    const content = input.value.trim();
    if (!content) return;

    input.value = "";
    btn.disabled = true;
    
    try {
      await api.post(`/api/messages/application/${appId}`, { content });
      await fetchMessages(appId, false); // Fetch immediately after send
    } catch (err) {
      toast.error("Failed to send message");
      input.value = content; // restore
    } finally {
      btn.disabled = false;
      input.focus();
    }
  });
}

function closeChatModal() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  document.getElementById("modal-root").innerHTML = "";
}

async function fetchMessages(appId, isInitial = false) {
  try {
    const msgs = await api.get(`/api/messages/application/${appId}`);
    const container = document.getElementById("chat-messages");
    if (!container) return; // Modal closed while fetching

    if (isInitial && msgs.length === 0) {
      container.innerHTML = `<div class="text-center text-muted text-sm" style="margin-top:2rem">No messages yet. Say hello!</div>`;
      return;
    }

    // Check if we are already at the bottom (to auto-scroll)
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

    container.innerHTML = msgs.map(m => {
      const isMe = m.sender_id === session.user.id;
      return `
        <div style="display:flex; flex-direction:column; align-items:${isMe ? "flex-end" : "flex-start"}; max-width:85%">
          <div style="font-size:.7rem;color:var(--c-text-muted);margin-bottom:.2rem;text-align:${isMe ? "right" : "left"};width:100%">
            ${isMe ? "You" : escape(m.sender_name)} · ${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
          <div style="background:${isMe ? "var(--brand-600)" : "var(--c-surface)"};color:${isMe ? "#fff" : "var(--c-text)"};padding:.6rem .85rem;border-radius:var(--radius-md);border-bottom-${isMe ? "right" : "left"}-radius:4px;border:1px solid ${isMe ? "transparent" : "var(--c-border)"};white-space:pre-wrap;word-break:break-word;text-align:left;">
            ${escape(m.content)}
          </div>
        </div>`;
    }).join("");

    if (isInitial || isAtBottom) {
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error("Chat fetch error:", err);
  }
}

async function markRead(appId) {
  try {
    await api.post(`/api/messages/application/${appId}/read`);
  } catch {}
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}