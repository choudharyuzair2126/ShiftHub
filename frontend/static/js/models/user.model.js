export class User {
  constructor(data = {}) { Object.assign(this, data); }
  get isStudent()  { return this.role === "student"; }
  get isEmployer() { return this.role === "employer"; }
  get initials() {
    return (this.full_name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  }
  static from(data) { return new User(data); }
}