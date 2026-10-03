export class Job {
  constructor(data = {}) { Object.assign(this, data); }
  get payLabel() { return this.pay || "Negotiable"; }
  get skillsList() { return Array.isArray(this.required_skills) ? this.required_skills : []; }
  static from(data) { return new Job(data); }
}