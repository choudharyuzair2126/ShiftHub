import { api } from "../core/api.js";
import { Application } from "../models/application.model.js";

export const employerVM = {
  async applicants(jobId) {
    const data = await api.get(`/api/applications/job/${jobId}`);
    return data.map(Application.from);
  },
  async setStatus(appId, status) {
    await api.patch(`/api/applications/${appId}/status?status=${status}`, {});
  },
};

export const studentVM = {
  async myApplications() {
    const data = await api.get("/api/applications/mine");
    return data.map(Application.from);
  },
  async apply(jobId, cover_note) {
    const data = await api.post(`/api/applications/job/${jobId}`, { cover_note });
    return Application.from(data);
  },
};