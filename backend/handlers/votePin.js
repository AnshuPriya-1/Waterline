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

    const { city = "local", sk, voteType } = JSON.parse(event.body);
    if (!sk || !voteType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "sk and voteType ('still_there' | 'fixed') are required" })
      };
    }

    const cleanCity = city.trim().toLowerCase();
    const nowEpoch = Math.floor(Date.now() / 1000);

    const pk = `CITY#${cleanCity}`;

    // Get current item to inspect votes
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

    if (voteType === "fixed") {
      const currentVotes = (item.fixedVotes || 0) + 1;
      const newStatus = currentVotes >= 2 ? "fixed" : "active";

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: sk },
          UpdateExpression: "SET fixedVotes = :v, #st = :s",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: { ":v": currentVotes, ":s": newStatus }
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
          message: newStatus === "fixed" ? "Hazard verified as fixed and removed from map." : "1 more verification needed to remove."
        })
      };
    } else if (voteType === "still_there") {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: sk },
          UpdateExpression: "SET lastConfirmedAt = :t, #st = :s",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: { ":t": nowEpoch, ":s": "active" }
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
