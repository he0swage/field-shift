// CORS: lets the frontend (and only the frontend) call this API from the browser.
// Allowed origins come from FRONTEND_ORIGINS in backend/.env (comma separated).
// Defaults cover every way the team runs the frontend locally:
//   5173 = npm run dev · 4173 = npm run preview · 5500 = VS Code "Go Live".
const cors = require("cors");

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5001",
  "http://127.0.0.1:5001",
];

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

const ORIGINS = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;

const corsMiddleware = cors({
  origin(origin, callback) {
    // Requests without an Origin header (curl, Postman, server-to-server) are allowed.
    if (!origin || ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false); // browser blocks the response; no error page
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  maxAge: 86400, // cache the preflight for a day
});

module.exports = { corsMiddleware, ORIGINS };
