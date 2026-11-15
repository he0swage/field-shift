require("dotenv").config();
const express = require("express");
const { corsMiddleware, ORIGINS } = require("./config/cors");

const regionsRouter = require("./Router/RouteRegion");
const rotationsRouter = require("./Router/RouteRotation");
const climateRouter = require("./Router/RouteClimate");
const rankingRouter = require("./Router/RouteRanking");
const cropsRouter = require("./Router/RouteCrops");
const mapRouter = require("./Router/RouteMap");

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// CORS first, so preflight (OPTIONS) requests from the frontend are answered
app.use(corsMiddleware);
app.use(express.json({ limit: "100kb" }));

// Routes used by the React frontend
app.use("/api/v1/climate", climateRouter);
app.use("/api/v1/ranking", rankingRouter);
app.use("/api/v1/crops", cropsRouter);
app.use("/api/v1/map", mapRouter);

// Regions routes
app.use("/api/v1/regions", regionsRouter);

// Rotations routes (accessible via /rotations and /api/v1/rotations)
app.use("/rotations", rotationsRouter);
app.use("/api/v1/rotations", rotationsRouter);

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", service: "field-shift-backend-api" });
});

// Unknown route → JSON 404
app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
});

// Errors → JSON 500 (or the status the error carries, e.g. invalid JSON body = 400)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: { code: status === 400 ? "BAD_REQUEST" : "SERVER_ERROR", message: status >= 500 ? "Internal server error." : err.message } });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${ORIGINS.join(", ")}`);
});
