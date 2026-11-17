import { session } from "../core/store.js";
import { authVM } from "../viewmodels/auth.vm.js";
import { jobsVM } from "../viewmodels/jobs.vm.js";
import { studentVM } from "../viewmodels/employer.vm.js";
import { toast } from "../core/toast.js";
import { openChatModal } from "./chat-modal.view.js";

export async function studentDashboardView(ctx) {
  if (!session.user) return redirectLogin();

  // Render the page instantly with loading skeletons
  setTimeout(() => loadDashboardData(ctx), 0);

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
        <div class="stat"><div class="stat__label">Applications</div><div class="stat__value" id="stat-apps">-</div></div>
        <div class="stat"><div class="stat__label">Recommended</div><div class="stat__value" id="stat-recs">-</div></div>
        <div class="stat"><div class="stat__label">Verified</div><div class="stat__value">${session.user.is_verified ? "Yes ✓" : "No"}</div></div>
      </div>

      <h2>Your applications</h2>
      <div id="applications-container">
        <div class="empty mt-2"><div class="text-muted">Loading your applications...</div></div>
      </div>

      <h2 class="mt-6">Recommended for you</h2>
      <div id="recommended-container" class="grid grid--3 mt-2">
        <!-- Skeleton Loaders for AI Recommendations -->
        ${Array(3).fill(`
          <div class="card">
            <div class="sk sk--line" style="width:60%"></div>
            <div class="sk sk--line short"></div>
            <div class="sk sk--line" style="margin-top:1rem;height:40px"></div>
            <div class="sk sk--line" style="width:80%"></div>
          </div>
        `).join("")}
        <div style="grid-column: 1 / -1; text-align:center; padding: 1rem;">
          <span class="text-sm text-brand" style="font-weight: 600; color: var(--brand-500);">✨ AI is finding your best matches...</span>
        </div>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Data Fetching & DOM Updating
// ---------------------------------------------------------------------------

async function loadDashboardData(ctx) {
  // 1. Load Applications first (Fast)
  try {
    const apps = await studentVM.myApplications();
    const appContainer = document.getElementById("applications-container");
    const statApps = document.getElementById("stat-apps");
    
    if (statApps) statApps.textContent = apps.length;
    
    if (appContainer) {
      if (!apps.length) {
        appContainer.innerHTML = `<div class="empty mt-2"><div class="empty__icon">📄</div><p>You haven't applied to any jobs yet.</p></div>`;
      } else {
        appContainer.innerHTML = `
          <div class="table-wrap mt-2">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Match</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th style="text-align:right">Actions</th>
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
                    <td style="text-align:right">
                      <button class="btn btn--primary btn--sm" data-chat="${a.id}" data-name="${escape(a.company_name || a.employer_name)}" data-job="${escape(a.job_title)}">
                        💬 Message
                      </button>
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>`;
      }
      bindActions();
    }

    // Auto-open chat if URL has ?chat=xxx
    if (ctx && ctx.params && ctx.params.chat) {
      const appId = Number(ctx.params.chat);
      const app = apps.find(a => a.id === appId);
      if (app) {
        openChatModal(appId, app.company_name || app.employer_name, app.job_title);
        window.history.replaceState(null, null, window.location.pathname + "#/dashboard");
      }
    }
  } catch (err) {
    document.getElementById("applications-container").innerHTML = `<p class="text-danger">Failed to load applications.</p>`;
  }

  // 2. Load AI Recommendations (Slow)
  try {
    const recs = await jobsVM.recommended();
    const recContainer = document.getElementById("recommended-container");
    const statRecs = document.getElementById("stat-recs");
    
    if (statRecs) statRecs.textContent = recs.length;
    
    if (recContainer) {
      if (!recs.length) {
        recContainer.innerHTML = `
          <div class="empty" style="padding: 3rem 1rem; grid-column: 1 / -1;">
            <div class="empty__icon">🎯</div>
            <h3>No strong matches found</h3>
            <p style="max-width: 400px; margin: 0 auto;">We only show jobs where your match score is 50% or higher. Try adding more skills, your latest education, or your city in your profile to get better recommendations!</p>
            <button class="btn btn--primary mt-4" data-profile>Update Profile</button>
          </div>`;
        bindProfileAction();
      } else {
        recContainer.innerHTML = recs.slice(0, 6).map(r => `
          <a href="#/jobs/${r.job.id}" style="text-decoration:none;color:inherit">
            <div class="card card--hover" style="display:flex;flex-direction:column;height:100%">
              <div class="card__head">
                <div>
                  <div class="card__title">${escape(r.job.title)}</div>
                  <div class="text-muted text-sm">${escape(r.job.city)}</div>
                </div>
                <div class="match" style="--p:${r.score}">${r.score}</div>
              </div>
              
              ${r.job.match_reason ? `
                <div style="background:var(--c-bg-soft);padding:.6rem;border-radius:var(--radius-sm);font-size:.75rem;color:var(--c-text-soft);margin-top:.5rem;flex:1;">
                  <span style="color:var(--brand-500);font-weight:700">✨ AI Insight:</span> ${escape(r.job.match_reason)}
                </div>
              ` : ""}
              
              <div class="card__meta mt-2"><span>💰 ${escape(r.job.payLabel)}</span></div>
            </div>
          </a>`).join("");
      }
    }
  } catch (err) {
    document.getElementById("recommended-container").innerHTML = `<p class="text-danger" style="grid-column: 1 / -1;">Failed to load AI recommendations.</p>`;
  }
}

// ---------------------------------------------------------------------------
// Event Bindings
// ---------------------------------------------------------------------------

function bindActions() {
  document.querySelectorAll("[data-chat]").forEach(b => {
    // Remove existing listeners to avoid duplicates if re-rendered
    b.replaceWith(b.cloneNode(true)); 
  });

  document.querySelectorAll("[data-chat]").forEach(b => {
    b.addEventListener("click", () => {
      openChatModal(Number(b.dataset.chat), b.dataset.name, b.dataset.job);
    });
  });
  
  bindProfileAction();
}

function bindProfileAction() {
  document.querySelectorAll("[data-profile]").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll("[data-profile]").forEach(btn => {
    btn.addEventListener("click", openProfile);
  });
}

// ---------------------------------------------------------------------------
// Profile Modal
// ---------------------------------------------------------------------------

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
        
        <div style="background:rgba(99, 102, 241, 0.1);border:1px solid rgba(99, 102, 241, 0.2);color:var(--brand-700);padding:.75rem;border-radius:var(--radius-sm);font-size:.85rem;margin-bottom:1.25rem;display:flex;gap:.5rem;align-items:center;">
          <span style="font-size:1.2rem">💡</span>
          <span><b>Tip:</b> Upload your CV below to automatically extract and fill your profile details!</span>
        </div>

        <form data-profile-form>
          <div class="field"><label>Full name</label><input class="input" name="full_name" value="${escape(u.full_name)}" /></div>
          <div class="field"><label>City</label><input class="input" name="city" value="${escape(u.city || "")}" /></div>
          <div class="field"><label>Phone</label><input class="input" name="phone" value="${escape(u.phone || "")}" /></div>
          <div class="field"><label>Latest Education / Degree</label><input class="input" name="education" value="${escape(u.education || "")}" placeholder="e.g. BS Computer Science" /></div>
          <div class="field"><label>Total Experience</label><input class="input" name="experience" value="${escape(u.experience || "")}" placeholder="e.g. 2 years" /></div>
          <div class="field"><label>Skills (comma-separated)</label><input class="input" name="skills" value="${(u.skills || []).join(", ")}" /></div>
          <div class="field"><label>Bio</label><textarea class="textarea" name="bio">${escape(u.bio || "")}</textarea></div>
          
          <div class="field" style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px dashed var(--c-border);">
            <label>Resume / CV</label>
            <input class="input" type="file" name="resume" accept=".pdf,.doc,.docx" />
            <div class="text-xs text-muted mt-1" id="cv-status-text">
              ${u.resume_path ? `Current: <a href="${u.resume_path}" target="_blank" rel="noopener">View on Cloudinary</a>` : "Select a PDF or Word file to auto-fill your profile."}
            </div>
          </div>
          
          <div class="flex gap-2" style="justify-content:flex-end; margin-top:1.5rem;">
            <button type="button" class="btn btn--ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn--primary" id="save-profile-btn">Save changes</button>
          </div>
        </form>
      </div>
    </div>`;

  root.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", close));
  root.querySelector("[data-modal]").addEventListener("click", e => e.stopPropagation());
  function close() { root.innerHTML = ""; }

  const fileInput = root.querySelector('input[name="resume"]');
  const saveBtn = root.querySelector("#save-profile-btn");
  const statusText = root.querySelector("#cv-status-text");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Processing CV...";
    statusText.innerHTML = `<span style="color:var(--brand-600);font-weight:600">⏳ AI is reading your resume...</span>`;

    try {
      await authVM.uploadResume(file);
      statusText.innerHTML = `<span style="color:var(--mint-500);font-weight:600">✅ CV processed successfully!</span>`;
      toast.success("CV processed! Profile updated automatically.");
      
      await authVM.loadMe();
      close();
      openProfile(); // Reopen to show updated data
      
      // Trigger dashboard refresh so recommendations update based on new CV
      window.dispatchEvent(new Event("hashchange"));
      
    } catch (err) {
      toast.error(err.message || "Failed to process CV");
      statusText.innerHTML = `Current: <span style="color:var(--c-danger)">Failed to process.</span>`;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  });

  root.querySelector("[data-profile-form]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await authVM.updateProfile({
        full_name: fd.get("full_name"),
        city: fd.get("city"),
        phone: fd.get("phone"),
        education: fd.get("education"),
        experience: fd.get("experience"),
        bio: fd.get("bio"),
        skills: (fd.get("skills") || "").split(",").map(s => s.trim()).filter(Boolean),
      });
      close();
      window.dispatchEvent(new Event("hashchange"));
    } catch (err) {
      toast.error(err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
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