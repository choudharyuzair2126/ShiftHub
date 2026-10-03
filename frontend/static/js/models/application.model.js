export class Application {
  constructor(data = {}) { Object.assign(this, data); }
  get statusBadge() {
    return {
      pending:     "badge--amber",
      shortlisted: "badge--sky",
      hired:       "badge--mint",
      rejected:    "badge--rose",
    }[this.status] || "badge--slate";
  }
  static from(data) { return new Application(data); }
}