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