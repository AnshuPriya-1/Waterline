import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";
import { haversineDistanceMeters } from "../utils/geo.js";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";
const SNS_TOPIC_ARN = process.env.CRITICAL_ALERT_SNS_TOPIC_ARN || "";

const FLOOD_LIFETIME_SECONDS = 2700; // 45 minutes
const CONFIRM_RADIUS_M = 100; // another flood report this close can confirm yours
const COMPOUND_RADIUS_M = 50; // flood this close to a known hazard = compound danger
const DUPLICATE_HAZARD_RADIUS_M = 15; // same hazard type this close = same hazard

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const reply = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });

// Read every item of one city (handles DynamoDB's 1 MB page limit)
async function loadCityItems(pk) {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ExclusiveStartKey: lastKey
      })
    );
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// Never send internal fields back to the browser
function publicItem(item) {
  const { deviceId, voters, ttl, PK, ...rest } = item;
  return rest;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    if (!event.body) return reply(400, { error: "Missing body" });

    const payload = JSON.parse(event.body);
    const { type, lat, lng, level, hazardType } = payload;
    const city = typeof payload.city === "string" ? payload.city : "delhi";
    const description = typeof payload.description === "string" ? payload.description : "";
    const deviceId = typeof payload.deviceId === "string" && payload.deviceId ? payload.deviceId.slice(0, 60) : "anonymous";
    const isSample = payload.isSample === true; // only used by the seed script to label demo data

    if (typeof lat !== "number" || typeof lng !== "number" || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return reply(400, { error: "lat (-90 to 90) and lng (-180 to 180) are required valid numbers" });
    }
    if (type !== "flood" && type !== "hazard") {
      return reply(400, { error: "type must be 'flood' or 'hazard'" });
    }

    const cleanCity = city.trim().toLowerCase().slice(0, 40) || "delhi";
    const pk = `CITY#${cleanCity}`;
    const nowEpoch = Math.floor(Date.now() / 1000);
    const reportId = randomUUID();
    const items = await loadCityItems(pk);

    // ------------------------------------------------------------------ FLOOD
    if (type === "flood") {
      const allowedLevels = ["ankle", "knee", "waist", "stalled"];
      const finalLevel = allowedLevels.includes(level?.toLowerCase()) ? level.toLowerCase() : null;
      if (!finalLevel) {
        return reply(400, { error: "level must be one of: ankle, knee, waist, stalled" });
      }

      const floodCutoff = nowEpoch - FLOOD_LIFETIME_SECONDS;

      // A flood report only confirms yours if it comes from a DIFFERENT device,
      // so one person cannot confirm their own report by sending it twice.
      const nearbyFloods = items.filter((it) => {
        if (it.type !== "flood" || it.reportedAt < floodCutoff) return false;
        if (haversineDistanceMeters(lat, lng, it.lat, it.lng) > CONFIRM_RADIUS_M) return false;
        const bothKnown = deviceId !== "anonymous" && it.deviceId && it.deviceId !== "anonymous";
        return bothKnown && it.deviceId !== deviceId;
      });

      const distinctDevices = new Set(nearbyFloods.map((it) => it.deviceId));
      const isConfirmed = distinctDevices.size > 0;
      const confirmedCount = distinctDevices.size + 1;

      if (isConfirmed) {
        for (const older of nearbyFloods) {
          try {
            await ddb.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: pk, SK: older.SK },
                UpdateExpression: "SET #st = :s, confirmedBy = :c",
                ExpressionAttributeNames: { "#st": "status" },
                ExpressionAttributeValues: { ":s": "confirmed", ":c": confirmedCount }
              })
            );
          } catch (updateErr) {
            console.warn("Failed to update older flood pin:", updateErr.message);
          }
        }
      }

      // Compound danger: flood within 50 m of a known, not-fixed hazard
      let compoundDanger = null;
      for (const it of items) {
        if (it.type === "hazard" && it.status !== "fixed") {
          const dist = haversineDistanceMeters(lat, lng, it.lat, it.lng);
          if (dist <= COMPOUND_RADIUS_M && (!compoundDanger || dist < compoundDanger.dist)) {
            compoundDanger = { hazard: it, dist: Math.round(dist) };
          }
        }
      }

      if (compoundDanger && SNS_TOPIC_ARN) {
        try {
          await sns.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Subject: `[WaterLine ALERT] Flooding near a known hazard in ${cleanCity.toUpperCase()}`.slice(0, 100),
              Message: `WATERLINE ALERT${isSample ? " (SAMPLE / DEMO DATA)" : ""}

A new flood report (${finalLevel} level) was submitted ${compoundDanger.dist} m from a known ${compoundDanger.hazard.hazardType.replace("_", " ")}.

Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Reported at: ${new Date(nowEpoch * 1000).toISOString()}
Risk: HIGHER. Water may be hiding the hazard.

This is a crowd report, not a guarantee.`
            })
          );
        } catch (snsErr) {
          console.warn("SNS alert delivery failed:", snsErr.message);
        }
      }

      const itemToSave = {
        PK: pk,
        SK: `FLOOD#${nowEpoch}#${reportId}`,
        id: reportId,
        type: "flood",
        city: cleanCity,
        lat,
        lng,
        level: finalLevel,
        reportedAt: nowEpoch,
        status: isConfirmed ? "confirmed" : "unconfirmed",
        confirmedBy: confirmedCount,
        compoundHazardNearby: !!compoundDanger,
        isSampleData: isSample,
        deviceId,
        ttl: nowEpoch + FLOOD_LIFETIME_SECONDS // DynamoDB cleanup only. The 45-min rule is enforced in getPins.
      };

      await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: itemToSave }));
      return reply(201, { success: true, item: publicItem(itemToSave) });
    }

    // ----------------------------------------------------------------- HAZARD
    const allowedHazards = ["open_drain", "missing_manhole", "deep_pothole"];
    const finalHazard = allowedHazards.includes(hazardType?.toLowerCase()) ? hazardType.toLowerCase() : null;
    if (!finalHazard) {
      return reply(400, { error: "hazardType must be one of: open_drain, missing_manhole, deep_pothole" });
    }

    // Same type within 15 m = the same hazard. Count it as a "still there" instead of a duplicate pin.
    const existing = items.find(
      (it) =>
        it.type === "hazard" &&
        it.status !== "fixed" &&
        it.hazardType === finalHazard &&
        haversineDistanceMeters(lat, lng, it.lat, it.lng) <= DUPLICATE_HAZARD_RADIUS_M
    );

    if (existing) {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: existing.SK },
          UpdateExpression: "SET lastConfirmedAt = :t",
          ExpressionAttributeValues: { ":t": nowEpoch }
        })
      );
      return reply(200, {
        success: true,
        duplicate: true,
        item: publicItem({ ...existing, lastConfirmedAt: nowEpoch })
      });
    }

    const itemToSave = {
      PK: pk,
      SK: `HAZARD#${nowEpoch}#${reportId}`,
      id: reportId,
      type: "hazard",
      city: cleanCity,
      lat,
      lng,
      hazardType: finalHazard,
      description: description.slice(0, 300),
      reportedAt: nowEpoch,
      lastConfirmedAt: nowEpoch,
      fixedVotes: 0,
      status: "active",
      isSampleData: isSample,
      deviceId
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: itemToSave }));
    return reply(201, { success: true, item: publicItem(itemToSave) });
  } catch (err) {
    console.error("createReport error:", err);
    return reply(500, { error: "Internal server error saving report" });
  }
};
