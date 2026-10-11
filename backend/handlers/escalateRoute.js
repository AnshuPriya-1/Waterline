import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";
const GOV_SNS_TOPIC_ARN = process.env.GOV_SNS_TOPIC_ARN || process.env.CRITICAL_ALERT_SNS_TOPIC_ARN || "";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const reply = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });

// Read all escalation items for a city
async function loadCityEscalations(pk) {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(
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
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    if (!event.body) return reply(400, { error: "Missing body" });

    const payload = JSON.parse(event.body);
    const {
      routeName,
      startPoint,
      endPoint,
      potholeCount = 1,
      potholeCoordinates = [],
      citizenNotes = "",
      action = "escalate",
      ticketId: targetTicketId
    } = payload;

    const city = typeof payload.city === "string" ? payload.city : "delhi";
    const cleanCity = city.trim().toLowerCase().slice(0, 40) || "delhi";
    const deviceId = typeof payload.deviceId === "string" && payload.deviceId ? payload.deviceId.slice(0, 60) : "anonymous";
    const isSample = payload.isSample === true;
    const pk = `CITY#${cleanCity}`;
    const nowEpoch = Math.floor(Date.now() / 1000);

    // ------------------------------------------------------------- ACTION: UPVOTE
    if (action === "upvote" && targetTicketId) {
      if (!deviceId || deviceId === "anonymous") {
        return reply(400, { error: "A valid deviceId is required to support/upvote an escalation" });
      }

      const sk = `ESCALATION#${targetTicketId}`;
      const escalations = await loadCityEscalations(pk);
      const existing = escalations.find((e) => e.ticketId === targetTicketId || e.SK === sk);

      if (!existing) {
        return reply(404, { error: "Escalation ticket not found" });
      }

      const voters = Array.isArray(existing.voters) ? existing.voters : [];
      if (voters.includes(deviceId)) {
        return reply(409, { error: "This device has already upvoted this route complaint" });
      }

      const updatedVoters = [...voters, deviceId];
      const updatedComplaints = (existing.complaintCount || 1) + 1;

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: existing.SK },
          UpdateExpression: "SET complaintCount = :c, voters = :v, lastUpdatedAt = :t",
          ExpressionAttributeValues: {
            ":c": updatedComplaints,
            ":v": updatedVoters,
            ":t": nowEpoch
          }
        })
      );

      return reply(200, {
        success: true,
        ticketId: targetTicketId,
        complaintCount: updatedComplaints,
        message: "Your complaint was added to this active government escalation"
      });
    }

    // ------------------------------------------------------------- ACTION: ESCALATE (NEW OR RE-ESCALATE)
    const cleanRouteName = typeof routeName === "string" && routeName.trim()
      ? routeName.trim().slice(0, 120)
      : `Route Corridor (${cleanCity.toUpperCase()})`;

    // Check for an existing open ticket along the same route name within the city
    const existingEscalations = await loadCityEscalations(pk);
    const openTicket = existingEscalations.find(
      (e) =>
        e.status !== "resolved" &&
        e.routeName &&
        e.routeName.toLowerCase().trim() === cleanRouteName.toLowerCase().trim()
    );

    if (openTicket) {
      // Route already has an active escalation; increment citizen complaints tally
      const voters = Array.isArray(openTicket.voters) ? openTicket.voters : [];
      const isNewVoter = deviceId !== "anonymous" && !voters.includes(deviceId);
      const updatedVoters = isNewVoter ? [...voters, deviceId] : voters;
      const updatedCount = (openTicket.complaintCount || 1) + 1;
      const maxPotholes = Math.max(openTicket.potholeCount || 0, Number(potholeCount) || 1);

      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: openTicket.SK },
          UpdateExpression: "SET complaintCount = :c, potholeCount = :p, voters = :v, lastUpdatedAt = :t",
          ExpressionAttributeValues: {
            ":c": updatedCount,
            ":p": maxPotholes,
            ":v": updatedVoters,
            ":t": nowEpoch
          }
        })
      );

      return reply(200, {
        success: true,
        alreadyActive: true,
        ticketId: openTicket.ticketId,
        complaintCount: updatedCount,
        potholeCount: maxPotholes,
        status: openTicket.status,
        message: `An active PWD grievance already exists for this route (${openTicket.ticketId}). Complaint tally updated to ${updatedCount}.`
      });
    }

    // Generate formal Government Grievance Ticket ID (e.g. PWD-DEL-9A4B)
    const randomSuffix = randomUUID().slice(0, 4).toUpperCase();
    const cityCode = cleanCity.slice(0, 3).toUpperCase();
    const ticketId = `PWD-${cityCode}-${randomSuffix}`;
    const sk = `ESCALATION#${ticketId}`;

    const numPotholes = Math.max(1, parseInt(potholeCount, 10) || 1);
    const departmentName = "Public Works Department (PWD) / Municipal Road Maintenance Division";

    const escalationItem = {
      PK: pk,
      SK: sk,
      ticketId,
      type: "escalation",
      city: cleanCity,
      routeName: cleanRouteName,
      startPoint: startPoint || null,
      endPoint: endPoint || null,
      potholeCount: numPotholes,
      complaintCount: 1,
      potholeCoordinates: Array.isArray(potholeCoordinates) ? potholeCoordinates.slice(0, 20) : [],
      citizenNotes: citizenNotes.slice(0, 500),
      status: "escalated_to_pwd",
      department: departmentName,
      escalatedAt: nowEpoch,
      lastUpdatedAt: nowEpoch,
      voters: deviceId !== "anonymous" ? [deviceId] : [],
      isSampleData: isSample,
      auditReportUrl: `s3://waterline-evidence-bucket/reports/${ticketId}.json`
    };

    // Dispatch formal notification via AWS SNS
    if (GOV_SNS_TOPIC_ARN) {
      try {
        const coordsSummary = escalationItem.potholeCoordinates.length > 0
          ? escalationItem.potholeCoordinates.map((c, i) => `  ${i + 1}. [${c.lat?.toFixed(5)}, ${c.lng?.toFixed(5)}] ${c.hazardType || 'pothole'}`).join("\n")
          : "  Coordinates logged along route corridor.";

        const messageBody = `=====================================================
WATERLINE CIVIC DISPATCH: OFFICIAL ROAD HAZARD NOTICE
=====================================================
Ticket Reference ID : ${ticketId}
Department          : ${departmentName}
City / Jurisdiction : ${cleanCity.toUpperCase()}
Corridor / Route    : ${cleanRouteName}
Total Potholes Flagged: ${numPotholes}
Initial Grievance   : 1 Citizen Complaint (Corridor threshold exceeded)
Timestamp           : ${new Date(nowEpoch * 1000).toISOString()}
${isSample ? "[NOTE: SAMPLE / DEMO DATA FOR VERIFICATION]\n" : ""}
INCIDENT DETAILS:
A high concentration of severe potholes and road defects was detected along this commuter corridor.
Submerged potholes during heavy rain pose immediate risk of two-wheeler skidding, suspension failure, and traffic choke points.

FLAGGED DEFECT LOCATIONS:
${coordsSummary}

CITIZEN REMARKS:
"${citizenNotes || 'High pothole density impacting daily commuter safety.'}"

ACTION REQUIRED:
1. Conduct physical inspection of road surface.
2. Issue emergency cold-mix / asphalt patch work order.
3. Update civic resolution status on municipal grievance portal.

Generated by WaterLine Civic Road Telemetry Platform (AWS Serverless Architecture).`;

        await sns.send(
          new PublishCommand({
            TopicArn: GOV_SNS_TOPIC_ARN,
            Subject: `[URGENT PWD DISPATCH] ${numPotholes}+ Potholes Escalated on ${cleanRouteName}`.slice(0, 100),
            Message: messageBody
          })
        );
      } catch (snsErr) {
        console.warn("Failed to dispatch AWS SNS civic alert:", snsErr.message);
      }
    }

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: escalationItem }));

    // Strip internal fields for response
    const { PK, SK, voters, ...publicEscalation } = escalationItem;

    return reply(201, {
      success: true,
      ticketId,
      escalation: publicEscalation,
      message: `Corridor successfully escalated to ${departmentName}. Tracking ID: ${ticketId}`
    });
  } catch (err) {
    console.error("escalateRoute error:", err);
    return reply(500, { error: "Internal server error escalating route" });
  }
};
