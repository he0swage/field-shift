const auth = require("../utils/authStore");

const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();

// POST /api/v1/auth/login  { email, password }
function postLogin(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } });
  }
  const result = auth.login(email, password, req.ip);
  if (result.error === "TOO_MANY_ATTEMPTS") {
    return res.status(429).json({ error: { code: "TOO_MANY_ATTEMPTS", message: "Too many failed attempts. Try again in 10 minutes." } });
  }
  if (result.error) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Wrong email or password." } });
  }
  return res.json(result);
}

// GET /api/v1/auth/me  (Authorization: Bearer <token>)
function getMe(req, res) {
  const user = auth.userFromToken(bearer(req));
  if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session expired or invalid." } });
  return res.json({ user });
}

// POST /api/v1/auth/logout
function postLogout(req, res) {
  auth.logout(bearer(req));
  return res.status(204).end();
}

module.exports = { postLogin, getMe, postLogout };
