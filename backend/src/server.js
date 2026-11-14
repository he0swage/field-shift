const express = require("express");

const regionsRouter = require("./Router/RouteRegion");
const rotationsRouter = require("./Router/RouteRotation");

const app = express();
const PORT = 5001;

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Regions routes
app.use("/api/v1/regions", regionsRouter);

// Rotations routes (accessible via /rotations and /api/v1/rotations)
app.use("/rotations", rotationsRouter);
app.use("/api/v1/rotations", rotationsRouter);

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", service: "field-shift-backend-api" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});