# WaterLine: Hyperlocal Urban Road Hazard, Flood & Civic Escalation Telemetry

WaterLine is an intelligent, crowd-verified urban road telemetry and civic safety platform. It addresses one of the most dangerous urban commuting problems: **monsoon floodwater and runoff concealing severe road hazards—open drains, missing manhole lids, and axle-breaking potholes.**

When commuters encounter a dangerous route with repeated pothole complaints, WaterLine aggregates the corridor defect telemetry and **automatically dispatches a formal Civic Grievance & Escalation Notice to the Public Works Department (PWD) and Municipal Road Engineering Division** via AWS Cloud services.

---

## Key Features

### 1. Route Pothole Cluster Aggregation & Government PWD Escalation
- **Corridor Scanning:** When commuters check a travel route or travel corridor, the system checks all road segments within a 50m corridor.
- **Threshold Escalation:** If $\ge 2$ severe potholes or structural road defects are detected along the corridor, the system flags the stretch for **Civic Government Escalation**.
- **Automated PWD Ticket Generation:** Generates a formal tracking grievance ticket (e.g., `PWD-DEL-9821`) with GPS defect bounds, defect counts, commuter remarks, and statutory road safety mandates.
- **Citizen Upvoting & Priority Escalation:** Other commuters riding the same corridor can upvote the ticket with a single tap, increasing urgency and visibility for municipal engineers.
- **Official Inspection Dossier:** Generates an official printable/downloadable Municipal Road Defect Dossier with S3 audit coordinates.

### 2. Multimodal AI Road Defect & Pothole Severity Analyzer (AWS Bedrock Vision)
- Powered by **Amazon Bedrock Claude 3 Haiku Vision**.
- Commuters can upload/snap a photo of a pothole or road fracture.
- The AI analyzes crater width, depth severity, standing water concealment, two-wheeler skidding risk, and provides a structured PWD maintenance recommendation.
- Automatic fallback ensures uninterrupted reporting even if cloud AI is offline.

### 3. Dynamic Route Road Safety Index (0 – 100)
- Dynamically computes a holistic safety score along the commuter route corridor:
  - **80 – 100:** Good / Low Hazard Density
  - **50 – 79:** Moderate Caution (Scattered road defects)
  - **0 – 49:** Hazardous / High Pothole & Flood Density (PWD Escalation Recommended)
- Integrates one-click WhatsApp sharing with road distance, safety score, and hazard telemetry.

### 4. Civic Redressal & PWD Road Action Portal
- Interactive modal portal displaying all active municipal complaint tickets for the city.
- Live status pipeline: `Escalated to PWD` ➔ `Inspection Assigned` ➔ `Repair Underway` ➔ `Resolved`.
- Citizens can directly file corridor grievances by road name.

### 5. Strict 45-Minute Flood Decay & Compound Hazard Memory Layer
- Flood reports expire and automatically drop off after 45 minutes.
- Dry-day hazards (open drains, deep potholes) remain mapped until 2 independent devices confirm repair.
- **50m Compound Warning:** If floodwater rises within 50m of a known dry-day drain or pothole, instant emergency compound warnings are triggered.

---

## AWS Multi-Service Architecture

The system utilizes an enterprise serverless AWS architecture:

```
[ Commuter Web App (Vite/React) ]
             |
             v
[ Amazon API Gateway (HTTP API v2) ] (Throttling & Burst Protection)
             |
             +---> [ Lambda: AnalyzeFloodFunction ] ---------> [ Amazon Bedrock Vision ]
             +---> [ Lambda: AnalyzeHazardFunction ] -------> [ Amazon Bedrock Vision ]
             +---> [ Lambda: CreateReportFunction ] --------> [ Amazon DynamoDB (Single-Table) ]
             |                                               +-> [ Amazon SNS (Critical Alerts Topic) ]
             +---> [ Lambda: GetPinsFunction ] -------------> [ Amazon DynamoDB ]
             +---> [ Lambda: VotePinFunction ] -------------> [ Amazon DynamoDB ]
             +---> [ Lambda: EscalateRouteFunction ] -------> [ Amazon DynamoDB ]
             |                                               +-> [ Amazon SNS (PWD Escalations Topic) ]
             |                                               +-> [ Amazon S3 (Evidence & Audit Bucket) ]
             +---> [ Lambda: GetEscalationsFunction ] -------> [ Amazon DynamoDB ]
             |
[ Amazon EventBridge (Hourly Cron) ]
             |
             +---> [ Lambda: RouteAuditScheduledFunction ] -> [ DynamoDB & SNS ]
```

1. **Amazon API Gateway (HTTP API v2):** Unified low-latency API entry point with CORS and rate throttling.
2. **AWS Lambda (Node.js 22):** 8 modular microservices handling vision inference, spatial deduplication, TTL filtering, and civic escalations.
3. **Amazon DynamoDB:** Single-table design (`WaterLine-Reports`) with Time-To-Live (TTL) and Global Secondary Index (`TypeUpdatedIndex`) for instant querying.
4. **Amazon Bedrock (Claude 3 Haiku Multimodal Vision):** Ephemeral visual depth and pothole defect severity classification.
5. **Amazon SNS (Simple Notification Service):**
   - `waterline-critical-hazard-alerts`: Instant email/SMS broadcast to commuters for submerged open drains.
   - `waterline-government-pwd-escalations`: Formal dispatch to PWD engineers and municipal road officers with ticket references.
6. **Amazon S3 (Simple Storage Service):** `waterline-evidence-<account>-<region>` bucket storing road defect photos and Municipal Audit Dossiers (`reports/<ticketId>.json`).
7. **Amazon EventBridge:** Scheduled cron rule (`rate(2 hours)`) triggering `RouteAuditScheduledFunction` to auto-scan and cluster road hazards across city partitions.
8. **Amazon CloudWatch:** Logs, custom metric filters for route hazard densities, and alarm thresholds.

---

## Running Locally (No AWS Account Required)

WaterLine includes a comprehensive in-memory AWS virtualization layer (`fakeDynamo.js`) so the entire backend, offline test suite, and frontend work locally out of the box.

### 1. Backend:
```bash
cd backend
npm install
npm test            # Runs 13 offline automated tests
npm run dev         # Starts local API on http://localhost:3001
```

### 2. Frontend:
```bash
cd frontend
npm install
npm run build       # Verifies production build
npm run dev         # Launches interface on http://localhost:5173
```

To connect the frontend to the local backend:
Create `frontend/.env.local`:
```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## Deploying to AWS

### Prerequisites:
- AWS CLI configured (`aws configure`) with valid credentials.
- AWS SAM CLI installed (`sam --version`).
- Node.js 22.x or 20.x installed.

### Step 1: Deploy Serverless Backend via AWS SAM
From the project root:
```bash
sam build
sam deploy --guided
```

When prompted:
- **Stack Name:** `waterline`
- **AWS Region:** `us-east-1` (or your preferred region with Bedrock access, e.g., `us-west-2` or `ap-south-1`)
- **AlertEmail:** Your real email address (AWS will send a subscription confirmation link; click it to receive SNS alerts).
- **GovEmail:** (Optional) PWD or municipal inbox for road escalations (defaults to AlertEmail if left blank).
- **BedrockModelId:** `anthropic.claude-3-haiku-20240307-v1:0`

SAM will deploy the DynamoDB table, S3 evidence bucket, 2 SNS topics, 8 Lambda functions, EventBridge rule, and API Gateway.

### Step 2: Configure & Deploy Frontend
1. Note the `HttpApiUrl` from the SAM deployment outputs (e.g. `https://xyz123.execute-api.us-east-1.amazonaws.com`).
2. Set the environment variable in `frontend/.env.production`:
   ```env
   VITE_API_BASE_URL=https://xyz123.execute-api.us-east-1.amazonaws.com
   ```
3. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```
4. Deploy the `frontend/dist` directory to **AWS Amplify**, **Amazon S3 + CloudFront**, or **Vercel/Netlify**.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/reports` | `POST` | Ingests a flood report or dry-day road hazard. Handles duplicate aggregation and compound danger detection. |
| `/pins?city=delhi` | `GET` | Retrieves active pins for a city. Enforces 45-minute decay cutoff in memory. |
| `/pins/vote` | `POST` | Allows commuters to confirm a hazard ("still there") or mark it "fixed" (2 votes retire pin). |
| `/routes/escalate` | `POST` | Escalates high-density pothole corridors to PWD, creates tracking ticket (`PWD-...`), updates complaints tally, and dispatches SNS alerts. |
| `/routes/escalations?city=delhi` | `GET` | Retrieves active municipal grievance tickets, citizen upvote tallies, and resolution statuses. |
| `/analyze` | `POST` | Ephemeral street flood depth estimation via Amazon Bedrock Vision. |
| `/analyze-hazard` | `POST` | AI pothole and road defect severity classification via Amazon Bedrock Vision. |

---

## License & Attribution
© 2026 WaterLine · Urban Road Safety & Flood Telemetry Platform.
