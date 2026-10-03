import { jobsVM } from "../viewmodels/jobs.vm.js";
import { studentVM } from "../viewmodels/employer.vm.js";
import { session } from "../core/store.js";
import { tokenStore } from "../core/api.js";
import { toast } from "../core/toast.js";

// Strip trailing slashes from the injected API base so raw fetches work too.
const API = (typeof window !== "undefined" && window.SHIFTHUB_API_BASE
  ? String(window.SHIFTHUB_API_BASE).replace(/\/+$/, "")
  : "");

export async function jobDetailView(ctx) {
  // The router passes a context object: { params: { id: "123", ...qs } }
  const id = Number(ctx.params.id);
  if (!id || Number.isNaN(id)) {
    return `<div class="container section"><div class="empty"><div class="empty__icon">🔍</div><h3>Invalid job</h3><p>The job you're looking for doesn't exist.</p></div></div>`;
  }

  let job;
  try {
    job = await jobsVM.get(id);
  } catch (e) {
    return `<div class="container section"><div class="empty"><div class="empty__icon">🔍</div><h3>Job not found</h3><p>${escape(e.message)}</p></div></div>`;
  }

  const canApply = session.user && session.user.role === "student";

  // ---- Check if this student already applied to this job ----
  let alreadyApplied = false;
  if (canApply) {
    try {
      const myApps = await studentVM.myApplications();
      alreadyApplied = myApps.some(a => Number(a.job_id) === id);
    } catch {
      alreadyApplied = false;
    }
  }

  // ---- Match score (only if not applied yet — no need to compute for applied) ----
  let score = null;
  if (canApply && !alreadyApplied) {
    try {
      const res = await fetch(`${API}/api/jobs/${id}/match`, {
        headers: { Authorization: `Bearer ${tokenStore.get()}` },
      });
      if (res.ok) {
        const data = await res.json();
        score = data.score;
      }
    } catch {}
  }

  setTimeout(() => bind(job, alreadyApplied), 0);

  return `
  <section class="section">
    <div class="container" style="max-width:960px">
      <a href="#/jobs" class="text-sm">← Back to jobs</a>
      <div class="card mt-4" style="padding:2rem">
        <div class="card__head">
          <div>
            <div class="badge badge--brand mb-2">${escape(job.job_type)}</div>
            <h1 style="margin:.25rem 0">${escape(job.title)}</h1>
            <div class="text-muted">${escape(job.company_name || job.employer_name || "Employer")} · 📍 ${escape(job.city)}</div>
          </div>
          ${score != null ? `<div class="match" style="--p:${score};--sz:78px;font-size:1.05rem">${score}</div>` : ""}
        </div>

        <div class="grid grid--3 mt-6" style="gap:.75rem">
          <div class="stat"><div class="stat__label">Pay</div><div class="stat__value" style="font-size:1.2rem">${escape(job.payLabel)}</div></div>
          <div class="stat"><div class="stat__label">Shift</div><div class="stat__value" style="font-size:1.2rem">${escape(job.shift || "Flexible")}</div></div>
          <div class="stat"><div class="stat__label">Category</div><div class="stat__value" style="font-size:1.2rem">${escape(job.category)}</div></div>
        </div>

        <h3 class="mt-6">Job description</h3>
        <p style="white-space:pre-wrap">${escape(job.description)}</p>

        ${job.address ? `<h3 class="mt-6">Location</h3><p>${escape(job.address)}, ${escape(job.city)}</p>` : ""}

        ${job.skillsList.length ? `
          <h3 class="mt-6">Required skills</h3>
          <div class="chip-list">${job.skillsList.map(s => `<span class="chip">${escape(s)}</span>`).join("")}</div>
        ` : ""}

        <div class="mt-6" id="apply-zone">
          ${renderApplyZone({ canApply, alreadyApplied, loggedIn: !!session.user })}
        </div>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Apply button logic
// ---------------------------------------------------------------------------

function renderApplyZone({ canApply, alreadyApplied, loggedIn }) {
  if (!canApply) {
    return loggedIn
      ? `<div class="badge badge--slate">Only students can apply</div>`
      : `<a href="#/login" class="btn btn--primary btn--lg">Sign in to apply</a>`;
  }
  if (alreadyApplied) {
    return `
      <button class="btn btn--lg" disabled
              style="background:var(--c-bg-muted);color:var(--mint-500);border:1px solid var(--c-border);cursor:not-allowed;opacity:1;font-weight:700">
        ✓ Already Applied
      </button>
      <div class="text-sm text-muted mt-2">You've already submitted an application for this job.</div>
    `;
  }
  return `<button class="btn btn--primary btn--lg" data-apply>Apply now</button>`;
}

// ---------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------

function bind(job, alreadyApplied) {
  const btn = document.querySelector("[data-apply]");
  if (!btn || alreadyApplied) return;
  btn.addEventListener("click", () => openApplyModal(job));
}

function openApplyModal(job) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" data-modal>
        <div class="modal__head">
          <div>
            <h3 style="margin:0">Apply to ${escape(job.title)}</h3>
            <div class="text-muted text-sm">at ${escape(job.company_name || job.employer_name || "Employer")}</div>
          </div>
          <button class="btn btn--icon btn--ghost" data-close>✕</button>
        </div>
        <form data-apply-form>
          <div class="field">
            <label>Cover note (optional)</label>
            <textarea class="textarea" name="cover_note" placeholder="Tell them why you're a great fit…"></textarea>
          </div>
          <div class="flex gap-2" style="justify-content:flex-end">
            <button type="button" class="btn btn--ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn--primary">Send application</button>
          </div>
        </form>
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }

  root.querySelector("[data-apply-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    try {
      await studentVM.apply(job.id, fd.get("cover_note"));
      toast.success("Application sent!");

      // Instantly flip the button to the "Already Applied" state
      const zone = document.getElementById("apply-zone");
      if (zone) {
        zone.innerHTML = `
          <button class="btn btn--lg" disabled
                  style="background:var(--c-bg-muted);color:var(--mint-500);border:1px solid var(--c-border);cursor:not-allowed;opacity:1;font-weight:700">
            ✓ Already Applied
          </button>
          <div class="text-sm text-muted mt-2">You've already submitted an application for this job.</div>
        `;
      }
      close();
    } catch (err) {
      toast.error(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Send application";
    }
  });
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}