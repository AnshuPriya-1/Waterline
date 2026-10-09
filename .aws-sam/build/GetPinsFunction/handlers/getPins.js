import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";

const FLOOD_LIFETIME_SECONDS = 2700; // 45 minutes
const OLD_HAZARD_SECONDS = 60 * 86400; // 60 days

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const city = (event.queryStringParameters?.city || "delhi").trim().toLowerCase().slice(0, 40);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const floodCutoff = nowEpoch - FLOOD_LIFETIME_SECONDS;
    const oldHazardCutoff = nowEpoch - OLD_HAZARD_SECONDS;

    // Read all pages (DynamoDB returns at most 1 MB per call)
    const allItems = [];
    let lastKey;
    do {
      const response = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `CITY#${city}` },
          ExclusiveStartKey: lastKey
        })
      );
      allItems.push(...(response.Items || []));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    const activePins = [];

    for (const item of allItems) {
      const lat = item.lat !== undefined ? item.lat : item.latitude;
      const lng = item.lng !== undefined ? item.lng : item.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") continue;

      if (item.type === "flood") {
        // The 45-minute rule is enforced HERE. DynamoDB TTL deletes late, so it is cleanup only.
        if (item.reportedAt >= floodCutoff) {
          activePins.push({
            id: item.id || item.SK,
            SK: item.SK,
            type: "flood",
            city,
            lat,
            lng,
            level: item.level || "ankle",
            reportedAt: item.reportedAt,
            ageMinutes: Math.max(0, Math.floor((nowEpoch - item.reportedAt) / 60)),
            status: item.status || "unconfirmed",
            confirmedBy: item.confirmedBy || 1,
            compoundHazardNearby: !!item.compoundHazardNearby,
            isSampleData: !!item.isSampleData
          });
        }
      } else if (item.type === "hazard") {
        if (item.status !== "fixed") {
          const isOldUnverified = item.lastConfirmedAt ? item.lastConfirmedAt < oldHazardCutoff : false;
          activePins.push({
            id: item.id || item.SK,
            SK: item.SK,
            type: "hazard",
            city,
            lat,
            lng,
            hazardType: item.hazardType || "open_drain",
            description: item.description || "",
            reportedAt: item.reportedAt,
            lastConfirmedAt: item.lastConfirmedAt,
            fixedVotes: item.fixedVotes || 0,
            status: "active",
            isOldUnverified,
            isSampleData: !!item.isSampleData
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ pins: activePins, serverTime: nowEpoch, city })
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
