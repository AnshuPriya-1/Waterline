/**
 * Loads data into a running WaterLine backend through its public API.
 * Needs Node 18+ (built-in fetch). No npm install needed.
 *
 * 1) Load YOUR REAL hazards (photographed and noted on a dry day):
 *      API_URL=https://xxxx.execute-api.us-east-1.amazonaws.com CITY=delhi \
 *        node scripts/seed.mjs hazards scripts/hazards.json
 *
 * 2) Create a labelled SAMPLE flood pin ~20 m from your first hazard, right before you record
 *    the demo video (flood pins disappear after 45 minutes):
 *      API_URL=... CITY=delhi node scripts/seed.mjs demo-flood scripts/hazards.json [level]
 *    This also triggers the alert email, so you can show it in the video.
 *
 * The same hazard is never added twice (same type within 15 m counts as one), so it is safe to re-run.
 * Windows PowerShell: set variables first, e.g.  $env:API_URL="https://..." ; $env:CITY="delhi"
 */
import { readFile } from "node:fs/promises";

const API_URL = (process.env.API_URL || "").replace(/\/$/, "");
const CITY = (process.env.CITY || "delhi").toLowerCase();
const [, , command, file, levelArg] = process.argv;

if (!API_URL) fail("Set API_URL to your backend URL (the HttpApiUrl printed by sam deploy).");
if (!["hazards", "demo-flood"].includes(command) || !file) {
  fail("Usage: node scripts/seed.mjs <hazards|demo-flood> <path/to/hazards.json> [level]");
}

function fail(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

async function post(body) {
  const res = await fetch(`${API_URL}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city: CITY, deviceId: "seed-script", ...body })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || "request failed"}`);
  return data;
}

function validate(h, i) {
  const problems = [];
  if (typeof h.lat !== "number" || typeof h.lng !== "number") problems.push("lat/lng must be numbers");
  else if (h.lat === 0 && h.lng === 0) problems.push("lat/lng are still 0,0. Put the real position.");
  if (!["open_drain", "missing_manhole", "deep_pothole"].includes(h.hazardType)) {
    problems.push("hazardType must be open_drain, missing_manhole or deep_pothole");
  }
  if (/EDIT ME/i.test(h.description || "")) problems.push('description still says "EDIT ME"');
  return problems.map((p) => `entry #${i + 1}: ${p}`);
}

const hazards = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(hazards) || hazards.length === 0) fail("The file must be a non-empty JSON array.");

const problems = hazards.flatMap(validate);
if (problems.length) fail("Fix these first:\n  - " + problems.join("\n  - "));

if (command === "hazards") {
  let added = 0;
  let already = 0;
  for (const h of hazards) {
    try {
      const out = await post({ type: "hazard", hazardType: h.hazardType, lat: h.lat, lng: h.lng, description: h.description || "" });
      if (out.duplicate) already++;
      else added++;
      console.log(`${out.duplicate ? "already there" : "added"}: ${h.hazardType} at ${h.lat}, ${h.lng}`);
    } catch (err) {
      console.error(`FAILED: ${h.hazardType} at ${h.lat}, ${h.lng} -> ${err.message}`);
    }
  }
  console.log(`\nDone. Added ${added}, already present ${already}.`);
} else {
  const level = ["ankle", "knee", "waist", "stalled"].includes(levelArg) ? levelArg : "knee";
  const first = hazards[0];
  const lat = first.lat + 0.00018; // about 20 m north
  const out = await post({ type: "flood", level, lat, lng: first.lng, isSample: true });
  console.log(`Sample flood pin (${level}) created at ${lat.toFixed(5)}, ${first.lng}.`);
  console.log(`Compound hazard flag: ${out.item.compoundHazardNearby}. It is labelled SAMPLE on the map and disappears in 45 minutes.`);
}
