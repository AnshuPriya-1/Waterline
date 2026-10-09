# WaterLine: what the water hides

> WeMakeDevs x AWS Bharat Builds Tour, Environmental Hacks. Track 02: Heat and Water.
> Team Synvora (code `PPD9GX`): Anshu Priya, Pratham Khatwani.

## The problem
In Indian monsoons, a flooded road is risky for two-wheeler riders and delivery workers for a second reason beyond depth:
muddy water hides open drains, missing manhole covers and deep potholes. Weather apps say "heavy rain".
They do not say "this street is knee-deep and has an open drain".

## What WaterLine does
It is a map with two layers.

1. **Flood layer (short-lived).** A rider reports the water level with one tap. An optional photo gives an AI *hint*.
   The pin is hidden from the map 45 minutes after the report.
2. **Hazard layer (long-lived).** Open drains, missing covers and deep potholes are reported on dry days.
   Each pin shows its dates. Two different devices must mark a hazard "fixed" before it leaves the map.

Where they meet:
- **Before you report a flood,** the app warns you if a known hazard is within 50 m of that spot.
- **When a flood is reported within 50 m of a known hazard,** the pin is flagged as a compound danger and an alert email is sent (Amazon SNS).
- **Check my route:** pick A and B, the app fetches the real road path and lists flood pins and hazards near it.
  The result can be shared on WhatsApp.

## Honest limits
- The app cannot see under water. Reports can be wrong or old.
- The AI only suggests a level. The rider always taps the final level. If the AI is unavailable the app says so and the rider taps the level.
- "No reports on this route" does **not** mean the road is clear. It means nobody has reported anything there.
- Route lines come from the free OSRM demo server and are **car** routes, not bike routes.
- Photos are not stored. A report is confirmed only when a *different* device reports within 100 m.
- Device IDs live in the browser, so one-vote-per-device is a light protection, not strong security.
- Sample data is labelled SAMPLE on the map. The data counter shows how many pins are real and how many are sample.

## Wording rules we follow
- Never "safe". We say "lower risk" and "higher risk".
- Never "prevents accidents". We say "helps people decide with more information".
- Fixed notice: "Water can hide open drains. This is an estimate, not a guarantee."
- Fixed rider notice: "Do not use your phone while riding."

## AWS services (what the template creates)
API Gateway (HTTP API, throttled), Lambda (4 functions), DynamoDB (one table), SNS (email alerts), Bedrock (photo hint, optional).
Built and deployed with AWS SAM CLI (`template.yaml`).
TTL is enabled on DynamoDB only as background cleanup. DynamoDB deletes late, so the 45-minute rule is enforced in code in `getPins`.

## Run it locally (no AWS account needed)

Backend (in-memory fake of DynamoDB and SNS, real handler code):
```bash
cd backend
npm install
npm test            # 8 offline tests
npm run dev         # http://localhost:3001
```

Frontend:
```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:3001" > .env.local
npm run dev         # http://localhost:5173
```
Without `VITE_API_BASE_URL` the frontend runs in a clearly-marked **offline demo mode** (data only in your browser).
If `VITE_API_BASE_URL` is set but the server is down, the app shows a red "cannot reach the server" banner and refuses to pretend a report was saved.

Before you start, edit `frontend/src/config.js`: set `DEFAULT_CITY`, `DEFAULT_MAP_CENTER` and `PRESET_ROUTE` to your own area.

## Deploy the backend to AWS
1. Install Node.js, AWS CLI and AWS SAM CLI. Run `aws configure` with an IAM user's keys.
2. (Optional) In the Bedrock console, enable a vision model and note its exact ID. If Bedrock is blocked, skip this: the AI hint just returns "unknown".
3. From the project root:
   ```bash
   sam build
   sam deploy --guided
   ```
   Enter your real `AlertEmail` and click the confirmation link AWS emails you. Copy the `HttpApiUrl` from the output.
4. Put it in `frontend/.env.production` as `VITE_API_BASE_URL=<HttpApiUrl>` **before** `npm run build`
   (on Amplify, set it as an environment variable instead).

## Load real data
Edit `scripts/hazards.example.json` (copy it to `scripts/hazards.json`) with your real hazards, then:
```bash
API_URL=<HttpApiUrl> CITY=<your city> node scripts/seed.mjs hazards scripts/hazards.json
# right before recording the video (flood pins last 45 minutes):
API_URL=<HttpApiUrl> CITY=<your city> node scripts/seed.mjs demo-flood scripts/hazards.json
```
The demo flood pin is labelled SAMPLE on the map. Say so in the video.

## API
| Method and path | What it does |
|---|---|
| `POST /analyze` | Photo (base64) in, level hint out. Returns "unknown" on any failure. |
| `POST /reports` | Save a flood or hazard report. Needs `deviceId`. |
| `GET /pins?city=` | Active pins. Flood pins older than 45 minutes are filtered in code. |
| `POST /pins/vote` | "still_there" or "fixed". One vote per device. |
