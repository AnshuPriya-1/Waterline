import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";

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
    const pk = `CITY#${city}`;

    const items = [];
    let lastKey;
    do {
      const response = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": pk,
            ":skPrefix": "ESCALATION#"
          },
          ExclusiveStartKey: lastKey
        })
      );
      items.push(...(response.Items || []));
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    const cleanEscalations = items.map((item) => {
      const { PK, SK, voters, ...rest } = item;
      return {
        ...rest,
        votersCount: Array.isArray(voters) ? voters.length : item.complaintCount || 1
      };
    }).sort((a, b) => (b.complaintCount || 0) - (a.complaintCount || 0));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        escalations: cleanEscalations,
        totalEscalations: cleanEscalations.length,
        city,
        serverTime: nowEpoch
      })
    };
  } catch (err) {
    console.error("getEscalations error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to retrieve civic escalations" })
    };
  }
};
