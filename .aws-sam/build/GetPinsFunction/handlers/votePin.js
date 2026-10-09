import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";

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

    const parsed = JSON.parse(event.body);
    const city = typeof parsed.city === "string" ? parsed.city : "delhi";
    const { sk, voteType } = parsed;
    const deviceId = typeof parsed.deviceId === "string" ? parsed.deviceId.trim().slice(0, 60) : "";
    if (!sk || !voteType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "sk and voteType ('still_there' | 'fixed') are required" })
      };
    }

    // A vote must come from an identifiable device, otherwise the one-vote rule can be skipped
    if (!deviceId || deviceId === "anonymous") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "deviceId is required to vote" })
      };
    }

    const cleanCity = city.trim().toLowerCase().slice(0, 40);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const pk = `CITY#${cleanCity}`;

    const getRes = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk }
      })
    );

    if (!getRes.Item) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Hazard pin not found" }) };
    }

    const item = getRes.Item;
    if (item.type !== "hazard") {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Only hazard pins can be voted on" }) };
    }

    const existingVoters = item.voters || [];

    if (existingVoters.includes(deviceId)) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "This device has already recorded a vote for this hazard."
        })
      };
    }

    const updatedVoters = [...existingVoters, deviceId];

    if (voteType === "fixed") {
      const currentVotes = (item.fixedVotes || 0) + 1;
      const newStatus = currentVotes >= 2 ? "fixed" : "active";

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: sk },
          UpdateExpression: "SET fixedVotes = :v, #st = :s, voters = :voters",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":v": currentVotes,
            ":s": newStatus,
            ":voters": updatedVoters
          }
        })
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          voteType: "fixed",
          fixedVotes: currentVotes,
          status: newStatus,
          message: newStatus === "fixed" ? "Hazard verified as fixed and retired from map." : "1 more verification needed to retire."
        })
      };
    } else if (voteType === "still_there") {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: sk },
          UpdateExpression: "SET lastConfirmedAt = :t, #st = :s, voters = :voters",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":t": nowEpoch,
            ":s": "active",
            ":voters": updatedVoters
          }
        })
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          voteType: "still_there",
          lastConfirmedAt: nowEpoch,
          message: "Hazard confirmed as still present."
        })
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "voteType must be 'still_there' or 'fixed'" })
      };
    }
  } catch (err) {
    console.error("votePin error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Error recording vote" })
    };
  }
};