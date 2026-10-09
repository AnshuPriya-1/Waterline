/**
 * Local dev server. Runs the REAL Lambda handlers on http://localhost:3001
 *
 *   - Without AWS credentials: DynamoDB and SNS are replaced by an in-memory fake
 *     (data is lost when you stop the server). The AI route returns "unknown".
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

  // A few clearly-labelled SAMPLE pins so the local map is not empty.
  // Edit the coordinates to your own area if you like.
  const now = Math.floor(Date.now() / 1000);
  putFake({
    PK: `CITY#${CITY}`, SK: "HAZARD#sample-1", id: "sample-hazard-1", type: "hazard", city: CITY,
    lat: 28.7505, lng: 77.1188, hazardType: "open_drain",
    description: "SAMPLE: uncovered storm drain beside the curb.",
    reportedAt: now - 86400 * 3, lastConfirmedAt: now - 3600, fixedVotes: 0, voters: [], status: "active", isSampleData: true
  });
  putFake({
    PK: `CITY#${CITY}`, SK: "HAZARD#sample-2", id: "sample-hazard-2", type: "hazard", city: CITY,
    lat: 28.7538, lng: 77.1132, hazardType: "missing_manhole",
    description: "SAMPLE: manhole cover missing.",
    reportedAt: now - 86400 * 10, lastConfirmedAt: now - 7200, fixedVotes: 1, voters: ["sample-voter"], status: "active", isSampleData: true
  });
}

// Import handlers AFTER the fake is installed
const { handler: analyzeHandler } = await import("./handlers/analyzeFlood.js");
const { handler: createReportHandler } = await import("./handlers/createReport.js");
const { handler: getPinsHandler } = await import("./handlers/getPins.js");
const { handler: votePinHandler } = await import("./handlers/votePin.js");

const routes = {
  "POST /analyze": analyzeHandler,
  "POST /reports": createReportHandler,
  "GET /pins": getPinsHandler,
  "POST /pins/vote": votePinHandler
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
  console.log("=======================================================");
});
