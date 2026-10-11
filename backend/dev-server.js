/**
 * Local dev server. Runs the REAL Lambda handlers on http://localhost:3001
 *
 *   - Without AWS credentials: DynamoDB and SNS are replaced by an in-memory fake
 *     (data is lost when you stop the server). The AI routes return safe fallbacks.
 *   - With AWS credentials (AWS_PROFILE or AWS_ACCESS_KEY_ID set): it talks to real AWS,
 *     so the DynamoDB table must already exist (set TABLE_NAME).
 *
 * Use it with the frontend by putting this in frontend/.env.local:
 *   VITE_API_BASE_URL=http://localhost:3001
 */
import http from "http";
import { installFakeAws, putFake } from "./utils/fakeDynamo.js";

const PORT = process.env.PORT || 3001;
const useRealAws = Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);
const CITY = (process.env.DEV_CITY || "delhi").toLowerCase();

if (!useRealAws) {
  installFakeAws();

  // A few clearly-labelled SAMPLE pins and escalations so the local map is not empty.
  const now = Math.floor(Date.now() / 1000);
  putFake({
    PK: `CITY#${CITY}`, SK: "HAZARD#sample-1", id: "sample-hazard-1", type: "hazard", city: CITY,
    lat: 28.7505, lng: 77.1188, hazardType: "deep_pothole",
    description: "SAMPLE: 40cm wide crater pothole with damaged road base.",
    reportedAt: now - 86400 * 3, lastConfirmedAt: now - 3600, fixedVotes: 0, voters: [], status: "active", isSampleData: true
  });
  putFake({
    PK: `CITY#${CITY}`, SK: "HAZARD#sample-2", id: "sample-hazard-2", type: "hazard", city: CITY,
    lat: 28.7518, lng: 77.1165, hazardType: "deep_pothole",
    description: "SAMPLE: recurring road fissure causing vehicle rim damage.",
    reportedAt: now - 86400 * 2, lastConfirmedAt: now - 1800, fixedVotes: 0, voters: [], status: "active", isSampleData: true
  });
  putFake({
    PK: `CITY#${CITY}`, SK: "HAZARD#sample-3", id: "sample-hazard-3", type: "hazard", city: CITY,
    lat: 28.7538, lng: 77.1132, hazardType: "open_drain",
    description: "SAMPLE: uncovered stormwater culvert along curb.",
    reportedAt: now - 86400 * 10, lastConfirmedAt: now - 7200, fixedVotes: 1, voters: ["sample-voter"], status: "active", isSampleData: true
  });
  // Sample active PWD Civic Escalation ticket
  putFake({
    PK: `CITY#${CITY}`, SK: "ESCALATION#PWD-DEL-DEMO1", ticketId: "PWD-DEL-DEMO1", type: "escalation", city: CITY,
    routeName: "Bawana Road Corridor (DTU to Sector 16)",
    potholeCount: 3, complaintCount: 5, status: "escalated_to_pwd",
    department: "Public Works Department (PWD) - North Delhi Road Division",
    escalatedAt: now - 86400, lastUpdatedAt: now - 3600,
    citizenNotes: "Multiple deep craters along the bus stop stretch. Two-wheelers frequently losing balance.",
    voters: ["dev-1", "dev-2", "dev-3", "dev-4", "dev-5"], isSampleData: true,
    auditReportUrl: "s3://waterline-evidence-bucket/reports/PWD-DEL-DEMO1.json"
  });
}

// Import handlers AFTER the fake is installed
const { handler: analyzeHandler } = await import("./handlers/analyzeFlood.js");
const { handler: analyzeHazardHandler } = await import("./handlers/analyzeHazard.js");
const { handler: createReportHandler } = await import("./handlers/createReport.js");
const { handler: getPinsHandler } = await import("./handlers/getPins.js");
const { handler: votePinHandler } = await import("./handlers/votePin.js");
const { handler: escalateRouteHandler } = await import("./handlers/escalateRoute.js");
const { handler: getEscalationsHandler } = await import("./handlers/getEscalations.js");

const routes = {
  "POST /analyze": analyzeHandler,
  "POST /analyze-hazard": analyzeHazardHandler,
  "POST /reports": createReportHandler,
  "GET /pins": getPinsHandler,
  "POST /pins/vote": votePinHandler,
  "POST /routes/escalate": escalateRouteHandler,
  "GET /routes/escalations": getEscalationsHandler
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const handler = routes[`${req.method} ${url.pathname}`];
      console.log(`[dev-server] ${req.method} ${url.pathname}`);
      if (!handler) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Not found: ${url.pathname}` }));
        return;
      }
      const result = await handler({
        body,
        httpMethod: req.method,
        queryStringParameters: Object.fromEntries(url.searchParams),
        requestContext: { http: { method: req.method } }
      });
      res.writeHead(result.statusCode || 200, { "Content-Type": "application/json" });
      res.end(result.body);
    } catch (err) {
      console.error("[dev-server] error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log("=======================================================");
  console.log(` WaterLine local server on http://localhost:${PORT}`);
  console.log(useRealAws ? " Mode: REAL AWS (DynamoDB/SNS/Bedrock)" : " Mode: in-memory fake (no AWS needed, data resets on restart)");
  console.log(` City partition: ${CITY}`);
  console.log(" Routes available: /reports, /pins, /pins/vote, /analyze, /analyze-hazard, /routes/escalate, /routes/escalations");
  console.log("=======================================================");
});
