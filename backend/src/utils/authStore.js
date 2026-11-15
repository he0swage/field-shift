// Minimal session auth for the demo: accounts come from backend/.env, sessions live in memory.
// Replace with a real user table (hashed passwords) before any public deployment.
const crypto = require("node:crypto");

const SESSION_HOURS = 8;
const sessions = new Map(); // token -> { email, name, expires }
const failures = new Map(); // ip -> { count, until }

function accounts() {
  // DEMO_USERS="email:password:Name,email2:password2:Name 2"  (falls back to one demo account)
  const raw = process.env.DEMO_USERS || "demo@fieldshift.app:fieldshift2026:Demo Farmer";
  return raw.split(",").map((entry) => {
    const [email, password, name] = entry.split(":").map((s) => (s || "").trim());
    return { email: email.toLowerCase(), password, name: name || email };
  }).filter((a) => a.email && a.password);
}

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Max 10 failed attempts per IP per 10 minutes. */
function isLocked(ip) {
  const f = failures.get(ip);
  return Boolean(f && f.count >= 10 && f.until > Date.now());
}
function recordFailure(ip) {
  const f = failures.get(ip);
  const fresh = !f || f.until < Date.now();
  failures.set(ip, { count: fresh ? 1 : f.count + 1, until: Date.now() + 10 * 60 * 1000 });
}

function login(email, password, ip) {
  if (isLocked(ip)) return { error: "TOO_MANY_ATTEMPTS" };
  const account = accounts().find((a) => a.email === String(email || "").trim().toLowerCase());
  if (!account || !sameSecret(account.password, password || "")) {
    recordFailure(ip);
    return { error: "INVALID_CREDENTIALS" };
  }
  failures.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  const user = { email: account.email, name: account.name };
  sessions.set(token, { ...user, expires: Date.now() + SESSION_HOURS * 3600 * 1000 });
  return { token, user, expiresInHours: SESSION_HOURS };
}

function userFromToken(token) {
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return { email: s.email, name: s.name };
}

function logout(token) {
  sessions.delete(token);
}

module.exports = { login, userFromToken, logout };
