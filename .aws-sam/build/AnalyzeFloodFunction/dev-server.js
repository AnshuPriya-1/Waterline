import http from 'http';
import { handler as analyzeHandler } from './handlers/analyzeFlood.js';
import { handler as createReportHandler } from './handlers/createReport.js';
import { handler as getPinsHandler } from './handlers/getPins.js';
import { handler as votePinHandler } from './handlers/votePin.js';

const PORT = process.env.PORT || 3001;

// In-memory fallback database for local testing when AWS DynamoDB is not yet connected
const localDb = {
  pins: [
    {
      id: "hazard-sample-01",
      SK: "HAZARD#1728000001",
      type: "hazard",
      city: "delhi",
      lat: 28.7505,
      lng: 77.1188,
      hazardType: "open_drain",
      description: "Uncovered deep concrete storm drain beside curb.",
      reportedAt: Math.floor(Date.now() / 1000) - 86400 * 3,
      lastConfirmedAt: Math.floor(Date.now() / 1000) - 3600,
      fixedVotes: 0,
      voters: [],
      status: "active",
      isSampleData: true
    },
    {
      id: "hazard-sample-02",
      SK: "HAZARD#1728000002",
      type: "hazard",
      city: "delhi",
      lat: 28.7538,
      lng: 77.1132,
      hazardType: "missing_manhole",
      description: "Iron manhole cover broken on Bawana Road.",
      reportedAt: Math.floor(Date.now() / 1000) - 86400 * 10,
      lastConfirmedAt: Math.floor(Date.now() / 1000) - 7200,
      fixedVotes: 1,
      voters: ["dev-prior-vote"],
      status: "active",
      isSampleData: true
    },
    {
      id: "flood-sample-01",
      SK: "FLOOD#1728400001",
      type: "flood",
      city: "delhi",
      lat: 28.7507,
      lng: 77.1186, // 25m from hazard-01 -> Compound danger!
      level: "knee",
      reportedAt: Math.floor(Date.now() / 1000) - 15 * 60,
      status: "confirmed",
      confirmedBy: 2,
      compoundHazardNearby: true,
      isSampleData: true
    }
  ]
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    try {
      const event = {
        body,
        httpMethod: req.method,
        queryStringParameters: Object.fromEntries(url.searchParams),
        requestContext: { http: { method: req.method } }
      };

      console.log(`[DEV-SERVER] ${req.method} ${pathname}`);

      // 1. POST /analyze (Bedrock Vision)
      if (pathname === "/analyze" && req.method === "POST") {
        try {
          const result = await analyzeHandler(event);
          res.writeHead(result.statusCode || 200, { "Content-Type": "application/json" });
          res.end(result.body);
          return;
        } catch (err) {
          console.warn("[DEV-SERVER] Bedrock local execution error:", err.message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            suggestedLevel: "unknown",
            confidence: "low",
            reasoning: "Local test server: Bedrock unavailable without live AWS credentials. Please tap water level below.",
            notice: "Water can hide open drains. This is an estimate, not a guarantee.",
            isOffline: true
          }));
          return;
        }
      }

      // 2. GET /pins (Telemetry pins)
      if (pathname === "/pins" && req.method === "GET") {
        try {
          if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            const result = await getPinsHandler(event);
            res.writeHead(result.statusCode || 200, { "Content-Type": "application/json" });
            res.end(result.body);
            return;
          }
        } catch (e) {
          console.warn("[DEV-SERVER] DynamoDB unavailable, using local mock store");
        }

        const now = Math.floor(Date.now() / 1000);
        const cutoff = now - 2700;
        const activePins = localDb.pins.filter((p) => {
          if (p.type === "hazard") return p.status !== "fixed";
          if (p.type === "flood") return p.reportedAt >= cutoff;
          return false;
        }).map(p => ({
          ...p,
          ageMinutes: p.type === "flood" ? Math.max(0, Math.floor((now - p.reportedAt) / 60)) : undefined
        }));

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ pins: activePins, serverTime: now, city: "delhi" }));
        return;
      }

      // 3. POST /reports (Create flood or hazard report)
      if (pathname === "/reports" && req.method === "POST") {
        try {
          if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            const result = await createReportHandler(event);
            res.writeHead(result.statusCode || 201, { "Content-Type": "application/json" });
            res.end(result.body);
            return;
          }
        } catch (e) {
          console.warn("[DEV-SERVER] DynamoDB unavailable, using local mock store");
        }

        const payload = JSON.parse(body || "{}");
        const now = Math.floor(Date.now() / 1000);
        const newPin = {
          id: "rep-" + Date.now(),
          SK: `${payload.type?.toUpperCase()}#${now}`,
          ...payload,
          reportedAt: now,
          status: "confirmed",
          confirmedBy: payload.type === "flood" ? 2 : undefined,
          fixedVotes: 0,
          voters: [],
          isSampleData: false
        };
        localDb.pins.unshift(newPin);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, item: newPin }));
        return;
      }

      // 4. POST /pins/vote (Vote hazard)
      if ((pathname === "/pins/vote" || pathname.startsWith("/pins/")) && req.method === "POST") {
        try {
          if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            const result = await votePinHandler(event);
            res.writeHead(result.statusCode || 200, { "Content-Type": "application/json" });
            res.end(result.body);
            return;
          }
        } catch (e) {
          console.warn("[DEV-SERVER] DynamoDB unavailable, using local mock store");
        }

        const payload = JSON.parse(body || "{}");
        const target = localDb.pins.find(p => p.SK === payload.sk || p.id === payload.sk);
        if (target) {
          if (payload.voteType === "fixed") {
            target.fixedVotes = (target.fixedVotes || 0) + 1;
            if (target.fixedVotes >= 2) target.status = "fixed";
          } else {
            target.lastConfirmedAt = Math.floor(Date.now() / 1000);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, target, message: "Vote recorded." }));
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Hazard not found" }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
    } catch (err) {
      console.error("[DEV-SERVER ERROR]", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` WaterLine Local Backend Server running on port ${PORT}`);
  console.log(` Endpoints active:`);
  console.log(`   POST http://localhost:${PORT}/analyze`);
  console.log(`   GET  http://localhost:${PORT}/pins?city=delhi`);
  console.log(`   POST http://localhost:${PORT}/reports`);
  console.log(`   POST http://localhost:${PORT}/pins/vote`);
  console.log(`=======================================================`);
});