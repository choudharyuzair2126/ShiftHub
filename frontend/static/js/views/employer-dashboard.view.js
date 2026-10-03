import { session } from "../core/store.js";
import { jobsVM } from "../viewmodels/jobs.vm.js";
import { employerVM } from "../viewmodels/employer.vm.js";
import { toast } from "../core/toast.js";

export async function employerDashboardView() {
  if (!session.user) return redirectLogin();
  const jobs = await jobsVM.mine().catch(() => []);

  setTimeout(() => bind(jobs), 0);

  return `
  <section class="section">
    <div class="container">
      <div class="flex justify-between items-center mb-6" style="flex-wrap:wrap;gap:1rem">
        <div>
          <div class="badge badge--brand">Employer dashboard</div>
          <h1 class="mt-2">Your postings</h1>
          <p class="text-muted">Manage your job listings and review applicants.</p>
        </div>
        <button class="btn btn--primary" data-new-job>+ Post a job</button>
      </div>

      ${jobs.length ? `
        <div class="grid grid--2">
          ${jobs.map(j => `
            <div class="card">
              <div class="card__head">
                <div>
                  <div class="card__title">${escape(j.title)}</div>
                  <div class="text-muted text-sm">📍 ${escape(j.city)} · ${escape(j.job_type)}</div>
                </div>
                <span class="badge ${j.is_active ? "badge--mint" : "badge--slate"}">${j.is_active ? "Active" : "Closed"}</span>
              </div>
              <div class="card__meta mt-2">
                <span>💰 ${escape(j.payLabel)}</span>
                ${j.shift ? `<span>⏰ ${escape(j.shift)}</span>` : ""}
              </div>
              <div class="flex gap-2 mt-4">
                <button class="btn btn--soft btn--sm" data-view-apps="${j.id}">View applicants</button>
                <button class="btn btn--ghost btn--sm" data-del-job="${j.id}">Delete</button>
              </div>
            </div>`).join("")}
        </div>` : `<div class="empty"><div class="empty__icon">📢</div><h3>No jobs yet</h3><p>Post your first job to start receiving applications.</p></div>`}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

function bind(jobs) {
  document.querySelector("[data-new-job]")?.addEventListener("click", openPostModal);
  document.querySelectorAll("[data-del-job]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this job?")) return;
    try {
      await jobsVM.remove(Number(b.dataset.delJob));
      toast.success("Job deleted");
      window.dispatchEvent(new Event("hashchange"));
    } catch (e) { toast.error(e.message); }
  }));
  document.querySelectorAll("[data-view-apps]").forEach(b =>
    b.addEventListener("click", () => openApplicants(Number(b.dataset.viewApps), jobs))
  );
}

// ---------------------------------------------------------------------------
// Post a new job modal
// ---------------------------------------------------------------------------

function openPostModal() {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal>
        <div class="modal__head">
          <h3 style="margin:0">Post a new job</h3>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>
        <form data-job-form>
          <div class="field"><label>Title</label><input class="input" name="title" required /></div>
          <div class="grid grid--2" style="gap:.75rem">
            <div class="field"><label>City</label><input class="input" name="city" required /></div>
            <div class="field"><label>Category</label>
              <select class="select" name="category">
                ${["General","Cafe","Restaurant","Retail","Tutoring","Delivery","Office","Events"].map(c => `<option>${c}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Pay</label><input class="input" name="pay" placeholder="Rs 300/hr" /></div>
            <div class="field"><label>Job type</label>
              <select class="select" name="job_type"><option>Part-time</option><option>Full-time</option><option>Internship</option><option>Gig</option></select>
            </div>
            <div class="field"><label>Shift</label><input class="input" name="shift" placeholder="Evenings 5-9 PM" /></div>
            <div class="field"><label>Address</label><input class="input" name="address" /></div>
          </div>
          <div class="field"><label>Required skills (comma-separated)</label><input class="input" name="required_skills" placeholder="Communication, POS" /></div>
          <div class="field"><label>Description</label><textarea class="textarea" name="description" required></textarea></div>
          <div class="flex gap-2" style="justify-content:flex-end">
            <button type="button" class="btn btn--ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn--primary">Publish job</button>
          </div>
        </form>
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }

  root.querySelector("[data-job-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd);
    payload.required_skills = (payload.required_skills || "").split(",").map(s => s.trim()).filter(Boolean);
    try {
      await jobsVM.create(payload);
      toast.success("Job posted!");
      close();
      window.dispatchEvent(new Event("hashchange"));
    } catch (err) { toast.error(err.message); }
  });
}

// ---------------------------------------------------------------------------
// Applicants modal
// ---------------------------------------------------------------------------

async function openApplicants(jobId, jobs) {
  const job = jobs.find(j => j.id === jobId);
  const apps = await employerVM.applicants(jobId);
  const root = document.getElementById("modal-root");

  // Store apps on a WeakMap-free global so the inner modals can access them
  window.__sh_apps = apps;

  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal style="width:min(100%,820px)">
        <div class="modal__head">
          <div>
            <h3 style="margin:0">Applicants (${apps.length})</h3>
            <div class="text-muted text-sm">${escape(job.title)}</div>
          </div>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>

        ${apps.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Match</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${apps.map(a => `
                  <tr>
                    <td>
                      <div style="font-weight:600;color:var(--c-text)">${escape(a.student_name || `Student #${a.student_id}`)}</div>
                      <div class="text-xs text-muted" style="margin-top:.15rem">
                        ${a.student_city ? `📍 ${escape(a.student_city)}` : ""}
                        ${a.student_availability ? ` · ⏰ ${escape(a.student_availability)}` : ""}
                      </div>
                    </td>
                    <td><span class="badge badge--brand">${a.match_score}%</span></td>
                    <td>
                      <select class="select" data-status="${a.id}" style="padding:.35rem .5rem;font-size:.8rem">
                        ${["pending","shortlisted","rejected","hired"].map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
                      </select>
                    </td>
                    <td>
                      <button class="btn btn--soft btn--sm" data-view-profile="${a.id}">View profile</button>
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>` : `<div class="empty"><p>No applications yet.</p></div>`}
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }

  // Status changes
  root.querySelectorAll("[data-status]").forEach(sel => {
    sel.addEventListener("change", async () => {
      try {
        await employerVM.setStatus(Number(sel.dataset.status), sel.value);
        toast.success("Status updated");
      } catch (e) { toast.error(e.message); }
    });
  });

  // View profile buttons
  root.querySelectorAll("[data-view-profile]").forEach(b => {
    b.addEventListener("click", () => {
      const a = window.__sh_apps.find(x => x.id === Number(b.dataset.viewProfile));
      if (a) openProfileModal(a);
    });
  });
}

// ---------------------------------------------------------------------------
// Applicant profile modal
// ---------------------------------------------------------------------------

function openProfileModal(a) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal style="width:min(100%,640px)">
        <div class="modal__head">
          <div>
            <h3 style="margin:0">${escape(a.student_name || `Student #${a.student_id}`)}</h3>
            <div class="text-muted text-sm">
              Applied ${new Date(a.created_at).toLocaleDateString()} · Match ${a.match_score}%
            </div>
          </div>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>

        <!-- Contact info -->
        <div class="grid grid--2" style="gap:.75rem">
          <div class="card" style="padding:1rem">
            <div class="stat__label">Email</div>
            <div style="margin-top:.25rem;font-size:.92rem;word-break:break-all">
              ${a.student_email
                ? `<a href="mailto:${escape(a.student_email)}" style="color:var(--brand-600)">${escape(a.student_email)}</a>`
                : "—"}
            </div>
          </div>
          <div class="card" style="padding:1rem">
            <div class="stat__label">Phone</div>
            <div style="margin-top:.25rem;font-size:.92rem">
              ${a.student_phone
                ? `<a href="tel:${escape(a.student_phone)}" style="color:var(--brand-600)">${escape(a.student_phone)}</a>`
                : "—"}
            </div>
          </div>
          <div class="card" style="padding:1rem">
            <div class="stat__label">City</div>
            <div style="margin-top:.25rem;font-size:.92rem">${escape(a.student_city || "—")}</div>
          </div>
          <div class="card" style="padding:1rem">
            <div class="stat__label">Availability</div>
            <div style="margin-top:.25rem;font-size:.92rem">${escape(a.student_availability || "—")}</div>
          </div>
        </div>

        <!-- Skills -->
        ${a.student_skills && a.student_skills.length ? `
          <h4 class="mt-6 mb-2" style="font-size:.95rem">Skills</h4>
          <div class="chip-list">
            ${a.student_skills.map(s => `<span class="chip">${escape(s)}</span>`).join("")}
          </div>
        ` : ""}

        <!-- Bio -->
        ${a.student_bio ? `
          <h4 class="mt-6 mb-2" style="font-size:.95rem">About</h4>
          <p style="font-size:.9rem;white-space:pre-wrap;margin:0">${escape(a.student_bio)}</p>
        ` : ""}

        <!-- Cover note -->
        ${a.cover_note ? `
          <h4 class="mt-6 mb-2" style="font-size:.95rem">Cover note</h4>
          <div style="background:var(--c-bg-soft);border:1px solid var(--c-border);border-radius:var(--radius-md);padding:.85rem;font-size:.9rem;white-space:pre-wrap;color:var(--c-text-soft)">${escape(a.cover_note)}</div>
        ` : ""}

        <!-- Resume / CV -->
        <h4 class="mt-6 mb-2" style="font-size:.95rem">Resume / CV</h4>
        ${a.student_resume_path
          ? `<a href="${escape(a.student_resume_path)}" target="_blank" rel="noopener" class="btn btn--primary" style="display:inline-flex">📄 Open Resume</a>
             <div class="text-xs text-muted mt-2" style="word-break:break-all">${escape(a.student_resume_path)}</div>`
          : `<div class="empty" style="padding:1.25rem"><p style="margin:0;font-size:.9rem">This applicant hasn't uploaded a resume yet.</p></div>`}

        <div class="flex gap-2 mt-6" style="justify-content:flex-end">
          <button class="btn btn--ghost" data-close>Close</button>
        </div>
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function redirectLogin() {
  setTimeout(() => { window.location.hash = "#/login"; }, 0);
  return `<div class="container section"><p>Redirecting…</p></div>`;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}