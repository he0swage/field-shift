# Field Shift

## Run the app locally

**Windows, simplest:** double-click **`start.bat`**. It:
1. installs whatever is missing;
2. builds the website;
3. starts the server and opens **http://localhost:5001** (website and API on one port).

Keep the window open while you use the app. Demo login: `demo@fieldshift.app` / `fieldshift2026`.

**Developer mode (live reload):** double-click **`dev.bat`**, or run in two terminals:

```bash
cd backend && node src/server.js     # API on http://localhost:5001
cd frontend && npm run dev           # site on http://localhost:5173 (/api forwarded to 5001)
```

Without the server, the login page shows "Server offline". Use "Continue without an account" to
browse with sample data.

Details: `backend/README.md` (routes, CORS, login, data) and `frontend/README.md` (structure,
design, i18n).
