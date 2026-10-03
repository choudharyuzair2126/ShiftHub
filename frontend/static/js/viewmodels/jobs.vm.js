import { api } from "../core/api.js";
import { Job } from "../models/job.model.js";

export const jobsVM = {
  async list(filters = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ).toString();
    const data = await api.get(`/api/jobs${qs ? "?" + qs : ""}`, { auth: false });
    return data.map(Job.from);
  },
  async get(id) {
    const data = await api.get(`/api/jobs/${id}`, { auth: false });
    return Job.from(data);
  },
  async recommended() {
    const data = await api.get("/api/jobs/recommended");
    return data.map(d => ({ job: Job.from(d.job), score: d.score }));
  },
  async create(payload) {
    const data = await api.post("/api/jobs", payload);
    return Job.from(data);
  },
  async mine() {
    const data = await api.get("/api/jobs/employer/mine");
    return data.map(Job.from);
  },
  async remove(id) {
    await api.del(`/api/jobs/${id}`);
  },
};