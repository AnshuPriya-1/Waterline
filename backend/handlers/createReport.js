import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";
import { haversineDistanceMeters } from "../utils/geo.js";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";
const SNS_TOPIC_ARN = process.env.CRITICAL_ALERT_SNS_TOPIC_ARN || "";

export const handler = async (event) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    if (!event.body) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing body" }) };
    }

    const payload = JSON.parse(event.body);
    const { city = "local", type, lat, lng, level, hazardType, description = "" } = payload;

    if (!type || typeof lat !== "number" || typeof lng !== "number") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "type, lat, and lng are required numbers" })
      };
    }

    const cleanCity = city.trim().toLowerCase();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const reportId = randomUUID();

    let itemToSave = {};

    if (type === "flood") {
      const allowedLevels = ["ankle", "knee", "waist", "stalled"];
      const finalLevel = allowedLevels.includes(level?.toLowerCase()) ? level.toLowerCase() : "ankle";

      // Query active pins in city to check for 2-report agreement and 50m hazard proximity
      const existingQuery = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `CITY#${cleanCity}` }
        })
      );

      const items = existingQuery.Items || [];
      const floodCutoff = nowEpoch - 2700; // 45 minutes

      // Rule: Check if another flood report is within 100m in the last 45 minutes
      const nearbyFloods = items.filter((it) => {
        if (it.type === "flood" && it.reportedAt >= floodCutoff) {
          const dist = haversineDistanceMeters(lat, lng, it.lat, it.lng);
          return dist <= 100;
        }
        return false;
      });

      const isConfirmed = nearbyFloods.length > 0;
      const confirmedCount = isConfirmed ? nearbyFloods.length + 1 : 1;

      // Rule: Check if any known hazard is within 50m (Compound Risk)
      let compoundDanger = null;
      for (const it of items) {
        if (it.type === "hazard" && it.status !== "fixed") {
          const dist = haversineDistanceMeters(lat, lng, it.lat, it.lng);
          if (dist <= 50) {
            compoundDanger = { hazard: it, dist: Math.round(dist) };
            break;
          }
        }
      }

      // If compound danger found, dispatch SNS alert email
      if (compoundDanger && SNS_TOPIC_ARN) {
        try {
          await sns.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Subject: `[WaterLine ALERT] Submerged Hazard Detected in ${cleanCity.toUpperCase()}`,
              Message: `CRITICAL ALERT:
A new flood report (${finalLevel} depth) was submitted within ${compoundDanger.dist}m of a known ${compoundDanger.hazard.hazardType.replace("_", " ")}.

Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Reported At: ${new Date(nowEpoch * 1000).toISOString()}
Status: High Risk - Submerged drain/hazard hazard.

WaterLine Telemetry Engine`
            })
          );
        } catch (snsErr) {
          console.warn("SNS Alert delivery failed (non-critical):", snsErr.message);
        }
      }

      itemToSave = {
        PK: `CITY#${cleanCity}`,
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
        ttl: nowEpoch + 2700 // Cleanup TTL
      };
    } else if (type === "hazard") {
      const allowedHazards = ["open_drain", "missing_manhole", "deep_pothole"];
      const finalHazard = allowedHazards.includes(hazardType?.toLowerCase())
        ? hazardType.toLowerCase()
        : "open_drain";

      itemToSave = {
        PK: `CITY#${cleanCity}`,
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
        status: "active"
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid type. Must be 'flood' or 'hazard'." })
      };
    }

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: itemToSave
      })
    );

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, item: itemToSave })
    };
  } catch (err) {
    console.error("createReport error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error saving report" })
    };
  }
};
