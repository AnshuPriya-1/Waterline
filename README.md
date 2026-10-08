# WaterLine: Urban Monsoon Telemetry & Submerged Hazard Memory

> **Track 02: Heat and Water** — WeMakeDevs Bharat Builds Tour (Event 02)  
> **Team:** Synvora (Code: `PPD9GX`)  
> **Builders:** Anshu Priya (Lead), Pratham Khatwani  
> **Venue / Host:** Delhi Technological University (DTU), Delhi  

---

## 1. The Real-World Problem
During Indian monsoons, waterlogging on urban roads transforms routine two-wheeler commutes and delivery gig work into hazardous trips. The deadliest threat is not the visible water depth—it is **what the water is hiding**:
- Uncovered roadside storm drains
- Missing cast-iron sewer manhole lids
- Deep potholes beneath murky floodwater

Existing civic apps rely on passive municipal complaints or show stale flood maps hours after waters have receded.

---

## 2. The Solution: Dual-Layer Hazard Telemetry

WaterLine introduces a **dual-layer telemetry map** designed with honest, reliable constraints:

1. **Short-Lived Flood Layer (45-Minute Decay):**
   - A rider snaps a quick photo of street water.
   - **Client-Side Canvas Compression:** Resizes the image in-browser to max 1000px (<200KB) to prevent API Gateway 10MB timeouts.
   - **Amazon Bedrock Vision (Claude 3 Haiku / Multimodal):** Detects physical reference anchors (car wheel rims, curbs, pedestrian steps) and provides an immediate depth hint (Ankle / Knee / Waist / Stalled) with Low/Medium/High confidence and reasoning.
   - **Human Confirmation:** The user confirms with one tap.
   - **Strict Decay Policy:** The flood pin is rendered with an age badge and disappears after **45 minutes**.
   - **Ephemeral In-Memory Handling:** Photos are analyzed in memory and immediately discarded. No user faces or license plates are stored.

2. **Long-Lived Hazard Layer (Open Drains & Manholes):**
   - Mapped on dry days before the rain starts.
   - Remembers exact GPS coordinates of uncovered trenches and missing manholes.
   - Includes community verification buttons: *"Still There"* vs *"Fixed / Covered"* (requires 2 independent confirmations to retire).

3. **The Core Moment: 50-Meter Compound Threat Alert:**
   - When a short-lived flood report occurs within **50 meters** of a known dry-day drain, WaterLine flags a **CRITICAL WARNING**:  
     `"Higher risk: Water may be hiding a known open drain within 50 meters."`
   - Automatically dispatches an immediate notification via **Amazon SNS Email Topic**.

4. **"Check My Route" Corridor Scan:**
   - Riders tap Point A (Start) and Point B (End) before starting their journey.
   - Uses geometric **point-to-segment projection math** (cross-track distance) along road segments to detect hazards within a 45m corridor.

---

## 3. Production Architecture on AWS

```
[ Two-Wheeler / Rider Mobile PWA ]
              │
              ├── (Canvas Resize to <200KB)
              │
              ▼
   [ Amazon API Gateway (HTTP API) ]
   (Throttling: 10 req/s, 20 burst to safeguard credits)
              │
     ┌────────┴──────────────────────────┐
     ▼                                   ▼
[ POST /analyze ]                 [ POST /reports ]
(AWS Lambda)                      (AWS Lambda)
     │                                   │
     ▼                                   ├──▶ [ Amazon DynamoDB (Single-Table) ]
[ Amazon Bedrock Vision ]                │    (PK: CITY#delhi, SK: FLOOD/HAZARD)
(In-memory analysis; zero storage)       │    (TTL enabled for auto-cleanup)
                                         │
                                         └──▶ [ Amazon SNS Topic ]
                                              (Instant email alert on 50m compound risk)
```

- **GET `/pins`:** Returns active pins with strict 45-minute timestamp filtering in application code (`reportedAt >= now - 2700`).
- **POST `/pins/vote`:** Increments fixed votes; retires hazard upon 2 verified confirmations.

---

## 4. Local Quickstart (Frontend & Mock Data)

The frontend is built with **Vite + React + Tailwind CSS + Leaflet** and includes a complete offline telemetry simulator, allowing anyone to test all features immediately without AWS credentials.

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Deploying the AWS Backend with AWS SAM CLI

1. **Verify AWS Bedrock Model Access:**
   - Open AWS Management Console → **Amazon Bedrock** → **Model access**.
   - Ensure an Anthropic Claude 3 or Claude 3.5 vision model is enabled.

2. **Deploy with SAM CLI:**
   ```bash
   sam build
   sam deploy --guided
   ```
   Provide:
   - Stack Name: `waterline-stack`
   - AWS Region: `us-east-1` (or your preferred Bedrock region)
   - `AlertEmail`: Your email to receive critical compound hazard alerts
   - `BedrockModelId`: `anthropic.claude-3-haiku-20240307-v1:0`

3. **Connect Frontend to Backend:**
   In `frontend/.env`:
   ```env
   VITE_API_BASE_URL=https://<your-api-id>.execute-api.us-east-1.amazonaws.com
   ```

---

## 6. 3-Minute Video Storyboard (Judging Rubric)

| Timestamp | Visual Screen | Voiceover Narrative |
| :--- | :--- | :--- |
| **0:00 – 0:30** | Real photo of an Indian urban road flooded in monsoon; street drain hazard. | *"Every monsoon across Indian cities, two-wheeler riders navigate waterlogged roads. The danger isn't just the water—it's what the water hides: open drains and missing manhole covers. Existing apps are passive or give stale data. We built WaterLine."* |
| **0:30 – 1:30** | Live Demo: Map with dry-day hazard pins and decaying flood pins. | *"WaterLine has two layers. First, dry-day hazards recorded on sunny days. Second, short-lived flood pins that strictly decay after 45 minutes. Watch what happens when a flood occurs within 50 meters of a known drain: WaterLine flags an immediate compound risk."* |
| **1:30 – 2:15** | Live Demo: Upload Photo & AI Hint → Route Corridor Check. | *"A rider snaps a photo. Client-side canvas scales it to under 200KB. Bedrock suggests depth based on car wheel hubs with low/medium/high confidence. The user confirms with one tap. When checking a route, our point-to-segment algorithm flags submerged hazards along the corridor."* |
| **2:15 – 2:45** | System Architecture Diagram slide. | *"Built serverless on AWS using SAM CLI, API Gateway with credit-safety throttling, Amazon Bedrock, DynamoDB single-table design, and Amazon SNS email alerts."* |
| **2:45 – 3:00** | Honest Limits & Closing slide. | *"WaterLine does not claim to see through opaque water or prevent accidents. It gives commuters honest information so they can decide safely. Built by Team Synvora."* |

---

## 7. Mandatory Safety Rules & Language
- Never says *"Safe"*. Uses **"Lower Risk"** and **"Higher Risk"**.
- Never claims to *"prevent accidents"*.
- Fixed persistent notice: *"Water can hide open drains. This is an estimate, not a guarantee."*
- Fixed rider safety rule: *"Don't use your phone while riding."*
