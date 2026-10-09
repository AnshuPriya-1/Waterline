/**
 * Offline tests for the Lambda handlers. No AWS account needed:
 * DynamoDB and SNS calls are replaced by an in-memory fake.
 * Run with:  npm test
 */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeAws, fake, resetFake, putFake } from "../utils/fakeDynamo.js";

let createReport, getPins, votePin;

before(async () => {
  installFakeAws();
  process.env.CRITICAL_ALERT_SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:test";
  ({ handler: createReport } = await import("../handlers/createReport.js"));
  ({ handler: getPins } = await import("../handlers/getPins.js"));
  ({ handler: votePin } = await import("../handlers/votePin.js"));
});

beforeEach(() => {
  resetFake();
});

const post = (handler, body) => handler({ body: JSON.stringify(body) });
const parse = (res) => JSON.parse(res.body);

const HAZ = { type: "hazard", hazardType: "open_drain", lat: 25.8, lng: 85.8, city: "testcity", deviceId: "dev-a" };
const FLOOD = { type: "flood", level: "knee", lat: 25.8, lng: 85.8, city: "testcity", deviceId: "dev-b" };

test("rejects bad coordinates and bad types", async () => {
  assert.equal((await post(createReport, { ...HAZ, lat: 999 })).statusCode, 400);
  assert.equal((await post(createReport, { ...HAZ, type: "nope" })).statusCode, 400);
  assert.equal((await post(createReport, { ...FLOOD, level: "ocean" })).statusCode, 400);
});

test("flood near a known hazard sets the compound flag and sends one alert email", async () => {
  await post(createReport, HAZ);
  const res = await post(createReport, { ...FLOOD, lat: 25.80015 }); // about 17 m away
  assert.equal(res.statusCode, 201);
  assert.equal(parse(res).item.compoundHazardNearby, true);
  assert.equal(fake.snsMessages.length, 1);
});

test("flood far from any hazard does not raise a compound warning", async () => {
  await post(createReport, HAZ);
  const res = await post(createReport, { ...FLOOD, lat: 25.81 }); // about 1 km away
  assert.equal(parse(res).item.compoundHazardNearby, false);
  assert.equal(fake.snsMessages.length, 0);
});

test("same device cannot confirm its own flood report, a different device can", async () => {
  await post(createReport, FLOOD);
  const same = parse(await post(createReport, FLOOD)).item;
  assert.equal(same.status, "unconfirmed");

  const other = parse(await post(createReport, { ...FLOOD, deviceId: "dev-c" })).item;
  assert.equal(other.status, "confirmed");
  assert.ok(other.confirmedBy >= 2);

  // the older pins were upgraded too
  const pins = parse(await getPins({ queryStringParameters: { city: "testcity" } })).pins;
  assert.ok(pins.filter((p) => p.type === "flood").every((p) => p.status === "confirmed" || p.confirmedBy >= 1));
  assert.ok(pins.some((p) => p.type === "flood" && p.status === "confirmed" && p.confirmedBy >= 2));
});

test("the same hazard reported twice becomes one pin", async () => {
  await post(createReport, HAZ);
  const again = await post(createReport, { ...HAZ, deviceId: "dev-z", lat: 25.80005 });
  assert.equal(parse(again).duplicate, true);
  const pins = parse(await getPins({ queryStringParameters: { city: "testcity" } })).pins;
  assert.equal(pins.filter((p) => p.type === "hazard").length, 1);
});

test("getPins hides flood pins older than 45 minutes even if DynamoDB has not deleted them", async () => {
  const now = Math.floor(Date.now() / 1000);
  const old = { PK: "CITY#testcity", SK: "FLOOD#old", id: "old", type: "flood", lat: 25.8, lng: 85.8, level: "knee", reportedAt: now - 46 * 60 };
  const fresh = { PK: "CITY#testcity", SK: "FLOOD#fresh", id: "fresh", type: "flood", lat: 25.8, lng: 85.8, level: "knee", reportedAt: now - 10 * 60 };
  putFake(old);
  putFake(fresh);
  const pins = parse(await getPins({ queryStringParameters: { city: "testcity" } })).pins;
  assert.deepEqual(pins.map((p) => p.id), ["fresh"]);
});

test("sample label is stored and returned, and internal fields are not leaked", async () => {
  const res = parse(await post(createReport, { ...HAZ, isSample: true })).item;
  assert.equal(res.isSampleData, true);
  assert.equal(res.deviceId, undefined);
  const pins = parse(await getPins({ queryStringParameters: { city: "testcity" } })).pins;
  assert.equal(pins[0].isSampleData, true);
});

test("voting: needs a device id, one vote per device, 2 fixed votes retire the hazard", async () => {
  const hazard = parse(await post(createReport, HAZ)).item;

  const noDevice = await post(votePin, { city: "testcity", sk: hazard.SK, voteType: "fixed" });
  assert.equal(noDevice.statusCode, 400);

  const anon = await post(votePin, { city: "testcity", sk: hazard.SK, voteType: "fixed", deviceId: "anonymous" });
  assert.equal(anon.statusCode, 400);

  const v1 = await post(votePin, { city: "testcity", sk: hazard.SK, voteType: "fixed", deviceId: "v1" });
  assert.equal(v1.statusCode, 200);
  assert.equal(parse(v1).status, "active");

  const repeat = await post(votePin, { city: "testcity", sk: hazard.SK, voteType: "fixed", deviceId: "v1" });
  assert.equal(repeat.statusCode, 409);

  const v2 = await post(votePin, { city: "testcity", sk: hazard.SK, voteType: "fixed", deviceId: "v2" });
  assert.equal(parse(v2).status, "fixed");

  const pins = parse(await getPins({ queryStringParameters: { city: "testcity" } })).pins;
  assert.equal(pins.filter((p) => p.type === "hazard").length, 0);
});
