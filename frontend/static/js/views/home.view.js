export function homeView() {
  return `
  <section class="hero">
    <div class="container hero__grid">
      <div>
        <div class="hero__eyebrow"><span class="dot"></span> Now live in Sahiwal & nearby cities</div>
        <h1>Find <span class="grad">part-time jobs</span> that fit your student life.</h1>
        <p class="hero__lead">ShiftHub connects university and hostel students with trusted local businesses — cafes, shops, tuition centers — with AI-powered job matching and instant applications.</p>
        <div class="hero__cta">
          <a href="#/register" class="btn btn--primary btn--lg">Get started free</a>
          <a href="#/jobs" class="btn btn--ghost btn--lg">Browse jobs →</a>
        </div>
        <div class="hero__stats">
          <div class="hero__stat"><b>2,000+</b><span>Students ready to work</span></div>
          <div class="hero__stat"><b>350+</b><span>Local employers</span></div>
          <div class="hero__stat"><b>94%</b><span>Match accuracy</span></div>
        </div>
      </div>
      <div class="hero__visual">
        <div class="mock-card">
          <div class="mock-row">
            <div>
              <div style="font-weight:700;font-family:var(--font-display)">Barista — Morning Shift</div>
              <div class="text-muted text-sm">Brew & Bean Café · Sahiwal</div>
            </div>
            <div class="match" style="--p:92">92</div>
          </div>
        </div>
        <div class="mock-card">
          <div class="mock-row">
            <div>
              <div style="font-weight:700;font-family:var(--font-display)">Math Tutor (Evenings)</div>
              <div class="text-muted text-sm">Bright Minds Academy · Sahiwal</div>
            </div>
            <div class="match" style="--p:88">88</div>
          </div>
        </div>
        <div class="mock-card">
          <div class="mock-row">
            <div>
              <div style="font-weight:700;font-family:var(--font-display)">Retail Assistant — Weekend</div>
              <div class="text-muted text-sm">UrbanMart · Sahiwal</div>
            </div>
            <div class="match" style="--p:81">81</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="text-center mb-6">
        <div class="badge badge--brand">Why ShiftHub</div>
        <h2 class="mt-4">Built for students. Loved by employers.</h2>
        <p style="max-width:560px;margin:auto">Everything you need to find, apply, and land the right part-time job — with an AI assistant by your side.</p>
      </div>
      <div class="grid grid--3">
        ${feature("🎯", "AI Job Matching", "We calculate a real match score from your skills, city, and availability.")}
        ${feature("🤖", "Virtual Assistant", "Ask our Gemini-powered chatbot anything about jobs or applications.")}
        ${feature("📍", "City-Based Listings", "Only see jobs near you — no more scrolling through irrelevant posts.")}
        ${feature("📄", "Resume Upload", "Store your CV once and apply to any job in seconds.")}
        ${feature("✉️", "Email Verified", "Secure signups with email verification and password reset.")}
        ${feature("⚡", "Instant Apply", "One-click applications with a personalized cover note.")}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--c-bg-soft)">
    <div class="container">
      <div class="text-center mb-6">
        <div class="badge badge--mint">How it works</div>
        <h2 class="mt-4">Three steps to your next shift.</h2>
      </div>
      <div class="grid grid--3">
        ${step("01", "Create your profile", "Sign up as a student or employer. Verify your email and add your details.")}
        ${step("02", "Get matched", "Our AI ranks jobs based on your skills, city, and availability.")}
        ${step("03", "Apply & get hired", "Send instant applications and track their status from your dashboard.")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="card" style="background:var(--grad-hero);color:#fff;border:none;padding:3rem;text-align:center;box-shadow:var(--shadow-xl)">
        <h2 style="color:#fff">Ready to start earning?</h2>
        <p style="color:rgba(255,255,255,.9);max-width:520px;margin:auto auto 1.5rem">
          Join thousands of students already finding flexible work through ShiftHub.
        </p>
        <div class="flex gap-3" style="justify-content:center;flex-wrap:wrap">
          <a href="#/register" class="btn btn--lg" style="background:#fff;color:var(--brand-700)">Create free account</a>
          <a href="#/jobs" class="btn btn--lg" style="background:rgba(255,255,255,.15);color:#fff">Explore jobs</a>
        </div>
      </div>
    </div>
  </section>
  `;
}

function feature(icon, title, desc) {
  return `
  <div class="card card--hover">
    <div style="font-size:1.8rem;margin-bottom:.6rem">${icon}</div>
    <div class="card__title">${title}</div>
    <p style="margin:.35rem 0 0;font-size:.9rem">${desc}</p>
  </div>`;
}

function step(n, title, desc) {
  return `
  <div class="card">
    <div style="font-family:var(--font-display);font-weight:800;font-size:2rem;background:var(--grad-hero);-webkit-background-clip:text;background-clip:text;color:transparent">${n}</div>
    <div class="card__title mt-2">${title}</div>
    <p style="margin:.35rem 0 0;font-size:.9rem">${desc}</p>
  </div>`;
}