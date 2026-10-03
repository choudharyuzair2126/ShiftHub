import { jobsVM } from "../viewmodels/jobs.vm.js";

const state = { filters: { city: "", category: "", q: "" }, jobs: [], loading: true };

export async function jobsView() {
  state.loading = true;
  const root = document.getElementById("view-root");
  if (root) root.innerHTML = layout();
  state.jobs = await jobsVM.list(state.filters);
  state.loading = false;
  return layout();
}

function layout() {
  const jobs = state.jobs;
  return `
    <section class="section" style="background:var(--c-bg-soft)">
      <div class="container">
        <div class="mb-4">
          <div class="badge badge--brand">Browse</div>
          <h1 class="mt-2">Find your next shift</h1>
          <p class="text-muted">Filter by city, category, or keyword to find your best match.</p>
        </div>
        <div class="card" style="padding:1rem">
          <form data-filter-form class="grid" style="grid-template-columns:1.5fr 1fr 1fr auto;gap:.75rem;align-items:end">
            <div class="field" style="margin:0">
              <label>Search</label>
              <input class="input" name="q" placeholder="Job title…" value="${state.filters.q}" />
            </div>
            <div class="field" style="margin:0">
              <label>City</label>
              <input class="input" name="city" placeholder="Sahiwal" value="${state.filters.city}" />
            </div>
            <div class="field" style="margin:0">
              <label>Category</label>
              <select class="select" name="category">
                ${["", "General", "Cafe", "Restaurant", "Retail", "Tutoring", "Delivery", "Office", "Events"]
                  .map(c => `<option value="${c}" ${state.filters.category === c ? "selected" : ""}>${c || "All categories"}</option>`).join("")}
              </select>
            </div>
            <button class="btn btn--primary" type="submit">Search</button>
          </form>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${state.loading ? renderSkeletons() : renderList(jobs)}
      </div>
    </section>
  `;
}

export function bindJobs() {
  const form = document.querySelector("[data-filter-form]");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    state.filters = { q: fd.get("q") || "", city: fd.get("city") || "", category: fd.get("category") || "" };
    state.loading = true;
    const root = document.getElementById("view-root");
    if (root) root.innerHTML = layout();
    state.jobs = await jobsVM.list(state.filters);
    state.loading = false;
    if (root) { root.innerHTML = layout(); bindJobs(); }
  });
}

function renderList(jobs) {
  if (!jobs.length) {
    return `<div class="empty"><div class="empty__icon">📭</div><h3>No jobs found</h3><p>Try changing your filters or check back later.</p></div>`;
  }
  return `<div class="grid grid--3">${jobs.map(jobCard).join("")}</div>`;
}

function jobCard(j) {
  return `
  <a href="#/jobs/${j.id}" style="text-decoration:none;color:inherit">
    <div class="card card--hover">
      <div class="card__head">
        <div>
          <div class="card__title">${escape(j.title)}</div>
          <div class="text-muted text-sm">${escape(j.company_name || j.employer_name || "Employer")}</div>
        </div>
        <span class="badge badge--brand">${escape(j.job_type || "Part-time")}</span>
      </div>
      <p style="font-size:.9rem;margin:.5rem 0">${truncate(escape(j.description), 110)}</p>
      <div class="card__meta">
        <span>📍 ${escape(j.city)}</span>
        <span>💰 ${escape(j.payLabel)}</span>
        ${j.shift ? `<span>⏰ ${escape(j.shift)}</span>` : ""}
      </div>
      ${j.skillsList.length ? `<div class="chip-list mt-2">${j.skillsList.slice(0,4).map(s => `<span class="chip">${escape(s)}</span>`).join("")}</div>` : ""}
    </div>
  </a>`;
}

function renderSkeletons() {
  return `<div class="grid grid--3">${Array.from({ length: 6 }).map(() => `
    <div class="card">
      <div class="sk sk--line" style="width:60%"></div>
      <div class="sk sk--line short"></div>
      <div class="sk sk--line" style="margin-top:1rem"></div>
      <div class="sk sk--line" style="width:80%"></div>
    </div>`).join("")}</div>`;
}

function escape(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }