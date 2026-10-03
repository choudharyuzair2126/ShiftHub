import { session } from "../core/store.js";
import { authVM } from "../viewmodels/auth.vm.js";
import { jobsVM } from "../viewmodels/jobs.vm.js";
import { studentVM } from "../viewmodels/employer.vm.js";
import { toast } from "../core/toast.js";

export async function studentDashboardView() {
  if (!session.user) return redirectLogin();

  const [recs, apps] = await Promise.all([
    jobsVM.recommended().catch(() => []),
    studentVM.myApplications().catch(() => []),
  ]);

  setTimeout(() => bind(), 0);

  return `
  <section class="section">
    <div class="container">
      <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:1rem">
        <div>
          <div class="badge badge--brand">Student dashboard</div>
          <h1 class="mt-2">Hi, ${escape(session.user.full_name.split(" ")[0])} 👋</h1>
          <p class="text-muted">Here are jobs picked for you and your application status.</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn--ghost" data-profile>Edit profile</button>
          <a href="#/jobs" class="btn btn--primary">Browse all jobs</a>
        </div>
      </div>

      <div class="grid grid--3 mb-6">
        <div class="stat"><div class="stat__label">Applications</div><div class="stat__value">${apps.length}</div></div>
        <div class="stat"><div class="stat__label">Recommended</div><div class="stat__value">${recs.length}</div></div>
        <div class="stat"><div class="stat__label">Verified</div><div class="stat__value">${session.user.is_verified ? "Yes ✓" : "No"}</div></div>
      </div>

      <h2>Your applications</h2>
      ${apps.length ? `
        <div class="table-wrap mt-2">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Match</th>
                <th>Status</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              ${apps.map(a => `
                <tr>
                  <td>
                    <a href="#/jobs/${a.job_id}" style="font-weight:600;color:var(--c-text);text-decoration:none">
                      ${escape(a.job_title || `Job #${a.job_id}`)}
                    </a>
                    <div class="text-xs text-muted" style="margin-top:.15rem">
                      ${escape(a.company_name || a.employer_name || "—")}${a.job_city ? ` · 📍 ${escape(a.job_city)}` : ""}${a.job_pay ? ` · 💰 ${escape(a.job_pay)}` : ""}
                    </div>
                  </td>
                  <td><span class="badge badge--brand">${a.match_score}%</span></td>
                  <td><span class="badge ${a.statusBadge}">${a.status}</span></td>
                  <td>${new Date(a.created_at).toLocaleDateString()}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : `<div class="empty mt-2"><div class="empty__icon">📄</div><p>You haven't applied to any jobs yet.</p></div>`}

      <h2 class="mt-6">Recommended for you</h2>
      ${recs.length ? `
        <div class="grid grid--3 mt-2">
          ${recs.slice(0, 6).map(r => `
            <a href="#/jobs/${r.job.id}" style="text-decoration:none;color:inherit">
              <div class="card card--hover">
                <div class="card__head">
                  <div>
                    <div class="card__title">${escape(r.job.title)}</div>
                    <div class="text-muted text-sm">${escape(r.job.city)}</div>
                  </div>
                  <div class="match" style="--p:${r.score}">${r.score}</div>
                </div>
                <div class="card__meta mt-2"><span>💰 ${escape(r.job.payLabel)}</span></div>
              </div>
            </a>`).join("")}
        </div>` : `<div class="empty mt-2"><p>No recommendations yet — add skills to your profile.</p></div>`}
    </div>
  </section>`;
}

function bind() {
  const btn = document.querySelector("[data-profile]");
  if (btn) btn.addEventListener("click", openProfile);
}

function openProfile() {
  const u = session.user;
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal>
        <div class="modal__head">
          <h3 style="margin:0">Edit profile</h3>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>
        <form data-profile-form>
          <div class="field"><label>Full name</label><input class="input" name="full_name" value="${escape(u.full_name)}" /></div>
          <div class="field"><label>City</label><input class="input" name="city" value="${escape(u.city || "")}" /></div>
          <div class="field"><label>Phone</label><input class="input" name="phone" value="${escape(u.phone || "")}" /></div>
          <div class="field"><label>Availability (e.g. "Evenings, Weekends")</label><input class="input" name="availability" value="${escape(u.availability || "")}" /></div>
          <div class="field"><label>Skills (comma-separated)</label><input class="input" name="skills" value="${(u.skills || []).join(", ")}" /></div>
          <div class="field"><label>Bio</label><textarea class="textarea" name="bio">${escape(u.bio || "")}</textarea></div>
          <div class="field">
            <label>Resume / CV</label>
            <input class="input" type="file" name="resume" accept=".pdf,.doc,.docx" />
            ${u.resume_path ? `<div class="text-xs text-muted mt-1">Current: <a href="${u.resume_path}" target="_blank" rel="noopener">View on Cloudinary</a></div>` : ""}
          </div>
          <div class="flex gap-2" style="justify-content:flex-end">
            <button type="button" class="btn btn--ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn--primary">Save changes</button>
          </div>
        </form>
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }

  root.querySelector("[data-profile-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const resumeFile = fd.get("resume");
      if (resumeFile && resumeFile.size > 0) await authVM.uploadResume(resumeFile);
      await authVM.updateProfile({
        full_name: fd.get("full_name"),
        city: fd.get("city"),
        phone: fd.get("phone"),
        availability: fd.get("availability"),
        bio: fd.get("bio"),
        skills: (fd.get("skills") || "").split(",").map(s => s.trim()).filter(Boolean),
      });
      close();
      window.dispatchEvent(new Event("hashchange"));
    } catch (err) {
      toast.error(err.message);
    }
  });
}

function redirectLogin() {
  setTimeout(() => { window.location.hash = "#/login"; }, 0);
  return `<div class="container section"><p>Redirecting…</p></div>`;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}