# Field Shift — backend API (Express)

Serves the team's processed data (`../data/`) and the rotation ranking to the React frontend.

## Run it

```bash
cd backend
npm install
npm run dev          # http://localhost:5001  (auto-restart with nodemon)
```

The frontend (`cd frontend && npm run dev`) calls `http://localhost:5001/api/v1` automatically
(see `frontend/.env.development`).

## Configuration (`backend/.env`, optional)

Copy `.env.example` to `.env`:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5001` | API port |
| `DEMO_USERS` | `demo@fieldshift.app:fieldshift2026:Demo Farmer` | Login accounts, `email:password:Name`, comma separated |
| `FRONTEND_ORIGINS` | localhost 5173, 4173, 5500 (and 127.0.0.1) | Frontend URLs allowed by CORS, comma separated. Add the deployed frontend URL here. |

## CORS

`src/config/cors.js` only allows requests from the frontend URLs listed in `FRONTEND_ORIGINS`:
- 5173 = `npm run dev`
- 4173 = `npm run preview`
- 5500 = VS Code "Go Live"

Browsers on any other site are blocked. Tools without an `Origin` header (curl, Postman) still
work. Preflight `OPTIONS` requests are answered and cached for 24 h.

## Routes

| Method | Route | Used by | Data |
|---|---|---|---|
| POST | `/api/v1/auth/login` | login page | `{ email, password }` → `{ token, user }` (401 wrong credentials, 429 after 10 failures in 10 min) |
| GET | `/api/v1/auth/me` | session check | header `Authorization: Bearer <token>` |
| POST | `/api/v1/auth/logout` | Log out button | ends the session |
| GET | `/api/v1/health` | data banner (LIVE / SAMPLE) | — |
| GET | `/api/v1/climate?region=setif` | climate pages 2.1–2.3, map | `data/regional/all_indicators.json`, `data/processed/<region>/climate_*.json` |
| POST | `/api/v1/ranking` | Analyse & Rank, top 4, avoid, summary, PDF | `data/processed/crops/*.json` + `utils/rotationScorer.js` |
| GET | `/api/v1/crops`, `/api/v1/crops/:id` | — (reference) | crop table |
| GET | `/api/v1/map` | — (reference) | `data/processed/regions_summary.json` |
| GET | `/api/v1/regions/:code/context?season=2026-2027` | — | regional indicators |
| POST | `/api/v1/rotations/generate`, `/compare`; GET `/rotations/:id` | — | permutations of 2–4 crops |

Errors are always JSON: `{ "error": { "code", "message" } }`. Status codes:
- 400: validation error
- 404: unknown region, crop or route
- 500: server error

### POST /api/v1/ranking

Request body (sent by the frontend):

```json
{ "region": "setif", "rotation": ["durum", "barley", "durum"],
  "allowed": ["durum", "soft", "barley", "chickpea", "lentil", "vetch", "rapeseed", "safflower"],
  "priorities": { "water": 42, "soil": 33, "yield": 25 },
  "scenario": { "rain": -20, "temp": 2 }, "custom": [] }
```

How the engine works (`src/utils/rankingEngine.js`):
1. It loads the allowed crops from the team table. Frontend ids are mapped to data ids, e.g. `durum` → `wheat` and `rapeseed` → `canola`.
2. It scores every 3-year rotation of distinct crops with `scoreRotation()` (water, soil and yield, weighted by the priorities), minus a penalty for thirsty crops in a dry or hot scenario.
3. It keeps the best order of each crop set and returns the top 4.
4. It adds:
   - the farmer's usual rotation;
   - 3 rotations to avoid, chosen by rules (monoculture, same family in a row, no legume, two thirsty crops);
   - a 100-run Monte-Carlo stability check.

Crops without data (alfalfa, onion, custom crops) are listed in `ignoredCrops`. The simplifying
assumptions (start soil N, soil health, legume credit, NDVI proxy) are returned in `assumptions`
and shown in the app.

## Data coverage

The team's processed data covers Sétif, Constantine and Tiaret. The frontend currently features
**Kansas, Sétif and Punjab**:
- **Sétif:** uses the real data.
- **Kansas and Punjab:** `/climate` returns 404 and the frontend shows its sample values, with the notice "no processed data for this region yet". Adding `data/processed/kansas/` and `data/processed/punjab/`, plus entries in `data/regional/all_indicators.json`, makes them live without any code change.

## Login (demo)

`src/utils/authStore.js` gives a minimal login for the demo:
- Accounts are read from `DEMO_USERS` in `.env`.
- Passwords are compared in constant time.
- Sessions are random 64-character tokens, kept in memory for 8 hours (they reset when the server restarts).
- An IP is locked for 10 minutes after 10 failed attempts.

The rotation and climate routes stay public, so the app still works for guests.

Before any public deployment, replace this with a real user table (hashed passwords, e.g. bcrypt)
and HTTPS.
