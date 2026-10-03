import { api, tokenStore } from "../core/api.js";
import { toast } from "../core/toast.js";
import { session } from "../core/store.js";
import { User } from "../models/user.model.js";

export const authVM = {
  async register(form) {
    const res = await api.post("/api/auth/register", form, { auth: false });
    tokenStore.set(res.access_token);
    session.user = User.from(res.user);
    session.token = res.access_token;
    toast.success("Account created — check your email to verify.");
    return session.user;
  },

  async login(form) {
    const res = await api.post("/api/auth/login", form, { auth: false });
    tokenStore.set(res.access_token);
    session.user = User.from(res.user);
    session.token = res.access_token;
    toast.success(`Welcome back, ${session.user.full_name.split(" ")[0]}!`);
    return session.user;
  },

  async loadMe() {
    if (!tokenStore.get()) return null;
    try {
      const me = await api.get("/api/users/me");
      session.user = User.from(me);
      return session.user;
    } catch {
      tokenStore.clear();
      session.user = null;
      return null;
    }
  },

  logout() {
    tokenStore.clear();
    session.user = null;
    session.token = "";
    toast.info("Signed out");
  },

  async updateProfile(patch) {
    const me = await api.patch("/api/users/me", patch);
    session.user = User.from(me);
    toast.success("Profile updated");
    return session.user;
  },

  async uploadResume(file) {
    const fd = new FormData();
    fd.append("file", file);
    const me = await api.upload("/api/users/me/resume", fd);
    session.user = User.from(me);
    toast.success("Resume uploaded to Cloudinary");
    return session.user;
  },

  async resendVerification() {
    await api.post("/api/auth/resend-verification", {});
    toast.success("Verification email sent — check your inbox");
  },

  async forgot(email) {
    await api.post("/api/auth/forgot-password", { email }, { auth: false });
    toast.success("If that email exists, a reset link has been sent.");
  },

  async reset(token, new_password) {
    await api.post("/api/auth/reset-password", { token, new_password }, { auth: false });
    toast.success("Password reset — you can sign in now.");
  },

  async verify(token) {
    await api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`, { auth: false });
    toast.success("Email verified!");
    // Refresh the local user so is_verified flips to true
    await this.loadMe();
  },
};