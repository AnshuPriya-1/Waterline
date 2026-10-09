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
    const { city = "delhi", type, lat, lng, level, hazardType, description = "", deviceId = "anonymous" } = payload;

    if (typeof lat !== "number" || typeof lng !== "number" || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "lat (-90 to 90) and lng (-180 to 180) are required valid numbers" })
      };
    }

    if (!type || (type !== "flood" && type !== "hazard")) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "type must be 'flood' or 'hazard'" })
      };
    }

    const cleanCity = city.trim().toLowerCase();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const reportId = randomUUID();

    let itemToSave = {};

    if (type === "flood") {
      const allowedLevels = ["ankle", "knee", "waist", "stalled"];
      const finalLevel = allowedLevels.includes(level?.toLowerCase()) ? level.toLowerCase() : "ankle";

      const existingQuery = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `CITY#${cleanCity}` }
        })
      );

      const items = existingQuery.Items || [];
      const floodCutoff = nowEpoch - 2700;

      const nearbyFloods = items.filter((it) => {
        if (it.type === "flood" && it.reportedAt >= floodCutoff) {
          const dist = haversineDistanceMeters(lat, lng, it.lat, it.lng);
          return dist <= 100;
        }
        return false;
      });

      const isConfirmed = nearbyFloods.length > 0;
      const confirmedCount = isConfirmed ? nearbyFloods.length + 1 : 1;

      if (isConfirmed) {
        for (const older of nearbyFloods) {
          try {
            await ddb.send(
              new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { PK: older.PK || `CITY#${cleanCity}`, SK: older.SK },
                UpdateExpression: "SET #st = :s, confirmedBy = :c",
                ExpressionAttributeNames: { "#st": "status" },
                ExpressionAttributeValues: { ":s": "confirmed", ":c": confirmedCount }
              })
            );
          } catch (updateErr) {
            console.warn("Failed to update older flood pin status:", updateErr.message);
          }
        }
      }

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

      if (compoundDanger && SNS_TOPIC_ARN) {
        try {
          await sns.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Subject: `[WaterLine ALERT] Submerged Road Hazard Detected in ${cleanCity.toUpperCase()}`,
              Message: `CRITICAL WATERLINE TELEMETRY ALERT:
A new flood report (${finalLevel} depth) was submitted within ${compoundDanger.dist}m of a known ${compoundDanger.hazard.hazardType.replace("_", " ")}.

Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Reported At: ${new Date(nowEpoch * 1000).toISOString()}
Status: HIGHER RISK - Water may be hiding submerged open drain/manhole.

WaterLine Telemetry Engine`
            })
          );
        } catch (snsErr) {
          console.warn("SNS Alert delivery failed:", snsErr.message);
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
        deviceId: deviceId.slice(0, 60),
        ttl: nowEpoch + 2700
      };
    } else {
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
        status: "active",
        deviceId: deviceId.slice(0, 60)
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