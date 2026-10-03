import { session } from "../core/store.js";

export function loginView() {
  return authShell("Welcome back", "Sign in to continue to ShiftHub", `
    <form data-form="login">
      <div class="field">
        <label>Email</label>
        <input class="input" type="email" name="email" required placeholder="you@example.com" />
      </div>
      <div class="field">
        <label>Password</label>
        <input class="input" type="password" name="password" required placeholder="••••••••" />
      </div>
      <button class="btn btn--primary w-full mt-2" type="submit">Sign in</button>
    </form>
    <div class="flex justify-between mt-4 text-sm">
      <a href="#/forgot">Forgot password?</a>
      <a href="#/register">Create account</a>
    </div>
  `);
}

export function registerView() {
  return authShell("Create your account", "Join ShiftHub in under a minute", `
    <form data-form="register">
      <div class="field">
        <label>I am a…</label>
        <select class="select" name="role">
          <option value="student">Student looking for work</option>
          <option value="employer">Employer posting jobs</option>
        </select>
      </div>
      <div class="field"><label>Full name</label><input class="input" name="full_name" required placeholder="Jane Doe" /></div>
      <div class="field"><label>Email</label><input class="input" type="email" name="email" required placeholder="you@example.com" /></div>
      <div class="field"><label>City</label><input class="input" name="city" placeholder="Sahiwal" /></div>
      <div class="field"><label>Password</label><input class="input" type="password" name="password" minlength="6" required placeholder="At least 6 characters" /></div>
      <button class="btn btn--primary w-full mt-2" type="submit">Create account</button>
    </form>
    <div class="text-sm mt-4 text-center">Already have an account? <a href="#/login">Sign in</a></div>
  `);
}

export function forgotView() {
  return authShell("Forgot password", "We'll email you a reset link", `
    <form data-form="forgot">
      <div class="field"><label>Email</label><input class="input" type="email" name="email" required /></div>
      <button class="btn btn--primary w-full mt-2" type="submit">Send reset link</button>
    </form>
    <div class="text-sm mt-4 text-center"><a href="#/login">← Back to sign in</a></div>
  `);
}

export function resetView() {
  return authShell("Reset password", "Choose a new password for your account", `
    <form data-form="reset">
      <div class="field"><label>New password</label><input class="input" type="password" name="new_password" minlength="6" required /></div>
      <button class="btn btn--primary w-full mt-2" type="submit">Update password</button>
    </form>
  `);
}

// ---------------------------------------------------------------------------
// Verify-pending page — shown when user is logged in but not verified
// ---------------------------------------------------------------------------

export function verifyPendingView() {
  const u = session.user;
  const email = u?.email || "your email";
  const firstName = (u?.full_name || "there").split(" ")[0];

  return `
  <div class="auth-wrap">
    <div class="auth-card" style="max-width:520px">
      <div class="text-center mb-4">
        <div style="font-size:3.25rem;line-height:1;margin-bottom:.5rem">📬</div>
        <h2>Verify your email</h2>
        <p class="text-muted text-sm" style="margin-top:.5rem">
          Hi ${escape(firstName)}, we've sent a verification link to
          <br>
          <b style="color:var(--c-text);word-break:break-all">${escape(email)}</b>
        </p>
      </div>

      <div class="card" style="background:var(--c-bg-soft);padding:1rem;border:1px solid var(--c-border)">
        <p style="margin:0;font-size:.88rem;line-height:1.55">
          Click the link in the email to activate your account.
          <br><br>
          <b>Didn't receive it?</b> Check your spam folder, or click the button below to resend.
        </p>
      </div>

      <div class="flex flex-col gap-2 mt-4">
        <button class="btn btn--primary w-full" data-resend-verify>Resend verification email</button>
        <button class="btn btn--ghost w-full" data-logout>Sign out</button>
      </div>

      <div class="text-sm mt-4 text-center text-muted">
        Already verified? <a href="#/login">Sign in</a>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function authShell(title, subtitle, body) {
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="text-center mb-4">
        <div class="brand__mark" style="margin:auto">S</div>
        <h2 class="mt-4">${title}</h2>
        <p class="text-muted text-sm">${subtitle}</p>
      </div>
      ${body}
    </div>
  </div>`;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}