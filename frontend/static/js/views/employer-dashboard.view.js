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
  document.querySelectorAll("[data-view-apps]").forEach(b => b.addEventListener("click", () => openApplicants(Number(b.dataset.viewApps), jobs)));
}

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

async function openApplicants(jobId, jobs) {
  const job = jobs.find(j => j.id === jobId);
  const apps = await employerVM.applicants(jobId);
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal style="width:min(100%,720px)">
        <div class="modal__head">
          <div>
            <h3 style="margin:0">Applicants</h3>
            <div class="text-muted text-sm">${escape(job.title)}</div>
          </div>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>
        ${apps.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Student ID</th><th>Match</th><th>Note</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${apps.map(a => `
                  <tr>
                    <td>#${a.student_id}</td>
                    <td><span class="badge badge--brand">${a.match_score}%</span></td>
                    <td class="text-xs">${escape((a.cover_note || "").slice(0, 60)) || "—"}</td>
                    <td><span class="badge ${a.statusBadge}">${a.status}</span></td>
                    <td>
                      <select class="select" data-status="${a.id}" style="padding:.35rem .5rem;font-size:.8rem">
                        ${["pending","shortlisted","rejected","hired"].map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
                      </select>
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

  root.querySelectorAll("[data-status]").forEach(sel => {
    sel.addEventListener("change", async () => {
      try {
        await employerVM.setStatus(Number(sel.dataset.status), sel.value);
        toast.success("Status updated");
      } catch (e) { toast.error(e.message); }
    });
  });
}

function redirectLogin() {
  setTimeout(() => { window.location.hash = "#/login"; }, 0);
  return `<div class="container section"><p>Redirecting…</p></div>`;
}
function escape(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }