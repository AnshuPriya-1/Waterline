import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";

export const handler = async (event) => {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const city = (event.queryStringParameters?.city || "local").trim().toLowerCase();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const floodCutoff = nowEpoch - 2700; // Strictly 45 minutes
    const oldHazardCutoff = nowEpoch - 60 * 86400; // 60 days

    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `CITY#${city}`
      }
    });

    const response = await ddb.send(queryCommand);
    const allItems = response.Items || [];

    const activePins = [];

    for (const item of allItems) {
      // Normalize lat and lng fields
      const lat = item.lat !== undefined ? item.lat : item.latitude;
      const lng = item.lng !== undefined ? item.lng : item.longitude;

      if (typeof lat !== "number" || typeof lng !== "number") {
        continue;
      }

      if (item.type === "flood") {
        // Enforce in-code 45-minute freshness (TTL is only async cleanup)
        if (item.reportedAt >= floodCutoff) {
          activePins.push({
            id: item.id || item.SK,
            SK: item.SK,
            type: "flood",
            lat,
            lng,
            level: item.level || "ankle",
            reportedAt: item.reportedAt,
            ageMinutes: Math.max(0, Math.floor((nowEpoch - item.reportedAt) / 60)),
            status: item.status || "unconfirmed",
            confirmedBy: item.confirmedBy || 1,
            compoundHazardNearby: !!item.compoundHazardNearby
          });
        }
      } else if (item.type === "hazard") {
        // Return hazard unless 2+ votes marked it fixed
        if (item.status !== "fixed") {
          const isOldUnverified = item.lastConfirmedAt ? item.lastConfirmedAt < oldHazardCutoff : false;
          activePins.push({
            id: item.id || item.SK,
            SK: item.SK,
            type: "hazard",
            lat,
            lng,
            hazardType: item.hazardType || "open_drain",
            description: item.description || "",
            reportedAt: item.reportedAt,
            lastConfirmedAt: item.lastConfirmedAt,
            fixedVotes: item.fixedVotes || 0,
            status: "active",
            isOldUnverified
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        pins: activePins,
        serverTime: nowEpoch,
        city
      })
    };
  } catch (err) {
    console.error("getPins error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to retrieve map pins" })
    };
  }
};
