import { api } from "../core/api.js";

let _refresh = () => {};
export function setChatRefresh(fn) { _refresh = fn; }

export const chatVM = {
  open: false,
  loading: false,
  draft: "",
  history: [
    { role: "assistant", content: "Hi! 👋 I'm your ShiftHub assistant. Ask me about jobs, resumes, or applications." },
  ],

  toggle() {
    this.open = !this.open;
    _refresh();
  },

  close() {
    this.open = false;
    _refresh();
  },

  async send() {
    const msg = (this.draft || "").trim();
    if (!msg || this.loading) return;

    this.history = [...this.history, { role: "user", content: msg }];
    this.draft = "";
    this.loading = true;
    _refresh();

    try {
      const history = this.history
        .slice(-9, -1)
        .map(h => ({ role: h.role === "assistant" ? "model" : "user", content: h.content }));

      const res = await api.post("/api/ai/chat", { message: msg, history });
      this.history = [...this.history, { role: "assistant", content: res.reply || "…" }];
    } catch (e) {
      this.history = [...this.history, { role: "assistant", content: "Sorry, I couldn't respond right now." }];
    } finally {
      this.loading = false;
      _refresh();
    }
  },
};