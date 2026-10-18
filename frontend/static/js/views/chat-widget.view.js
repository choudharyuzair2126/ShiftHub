import { chatVM } from "../viewmodels/chat.vm.js";

export function renderChatWidget() {
  const { open, loading, history } = chatVM;
  return `
    ${open ? `
      <div class="chat-panel">
        <div class="chat-panel__head">
          <div style="display:flex;align-items:center;gap:.6rem">
            <div class="brand__mark" style="width:28px;height:28px;font-size:.75rem">AI</div>
            <div>
              <div style="font-weight:700;font-family:var(--font-display);font-size:.95rem">ShiftHub Assistant</div>
              <div style="font-size:.72rem;opacity:.85">Powered by AI</div>
            </div>
          </div>
          <button class="btn btn--icon" data-chat-close style="background:rgba(255,255,255,.15);color:#fff">✕</button>
        </div>
        <div class="chat-panel__body" id="chat-body">
          ${history.map(h => `
            <div class="chat-bubble chat-bubble--${h.role === "user" ? "user" : "ai"}">${escapeHtml(h.content)}</div>
          `).join("")}
          ${loading ? `<div class="chat-bubble chat-bubble--ai">Typing…</div>` : ""}
        </div>
        <form class="chat-panel__input" data-chat-form>
          <input class="input" placeholder="Ask about jobs…" data-chat-input autocomplete="off" />
          <button class="btn btn--primary" type="submit" ${loading ? "disabled" : ""}>Send</button>
        </form>
      </div>
    ` : `
      <button class="chat-fab" data-chat-open aria-label="Open chat">💬</button>
    `}
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function bindChatWidget(root) {
  // FAB — open via VM method so refresh fires
  const open = root.querySelector("[data-chat-open]");
  if (open) open.addEventListener("click", () => { chatVM.toggle(); });

  // Close button — also via VM
  const close = root.querySelector("[data-chat-close]");
  if (close) close.addEventListener("click", () => { chatVM.close(); });

  // Send form
  const form = root.querySelector("[data-chat-form]");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await chatVM.send();
    });
  }

  // Input — free typing updates draft WITHOUT triggering a refresh
  const input = root.querySelector("[data-chat-input]");
  if (input) {
    input.addEventListener("input", e => { chatVM.draft = e.target.value; });
    input.focus();
  }

  // Auto-scroll to newest message
  const body = root.querySelector("#chat-body");
  if (body) body.scrollTop = body.scrollHeight;
}