import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";
import { haversineDistanceMeters } from "../utils/geo.js";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);
const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME || "WaterLine-Reports";
const GOV_SNS_TOPIC_ARN = process.env.GOV_SNS_TOPIC_ARN || process.env.CRITICAL_ALERT_SNS_TOPIC_ARN || "";
const CLUSTER_DISTANCE_METERS = 250; // Group potholes within 250m corridor
const ESCALATION_THRESHOLD = 3; // Trigger automatic escalation if cluster has 3+ defects

export const handler = async (event) => {
  console.log("Starting scheduled corridor hazard audit via AWS EventBridge...", JSON.stringify(event));
  const cities = ["delhi", "mumbai", "bengaluru"];
  const results = [];

  for (const city of cities) {
    try {
      const pk = `CITY#${city}`;
      const nowEpoch = Math.floor(Date.now() / 1000);

      // Query all hazards in city
      const queryRes = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": pk }
        })
      );

      const items = queryRes.Items || [];
      const hazards = items.filter((it) => it.type === "hazard" && it.status !== "fixed");
      const existingEscalations = items.filter((it) => it.type === "escalation" && it.status !== "resolved");

      // Group hazards into geographic clusters
      const clusters = [];
      for (const h of hazards) {
        let addedToCluster = false;
        for (const cluster of clusters) {
          const dist = haversineDistanceMeters(h.lat, h.lng, cluster.centerLat, cluster.centerLng);
          if (dist <= CLUSTER_DISTANCE_METERS) {
            cluster.hazards.push(h);
            addedToCluster = true;
            break;
          }
        }
        if (!addedToCluster) {
          clusters.push({
            centerLat: h.lat,
            centerLng: h.lng,
            hazards: [h]
          });
        }
      }

      // Identify clusters exceeding threshold
      for (const cluster of clusters) {
        if (cluster.hazards.length >= ESCALATION_THRESHOLD) {
          const potholeCount = cluster.hazards.length;
          const routeName = `High-Density Corridor (${cluster.centerLat.toFixed(3)}, ${cluster.centerLng.toFixed(3)})`;

          // Check if already escalated
          const alreadyEscalated = existingEscalations.some(
            (e) => haversineDistanceMeters(cluster.centerLat, cluster.centerLng, e.startPoint?.lat || 0, e.startPoint?.lng || 0) < 300
          );

          if (!alreadyEscalated) {
            const ticketId = `PWD-${city.slice(0, 3).toUpperCase()}-AUTO-${randomUUID().slice(0, 4).toUpperCase()}`;
            const item = {
              PK: pk,
              SK: `ESCALATION#${ticketId}`,
              ticketId,
              type: "escalation",
              city,
              routeName,
              startPoint: { lat: cluster.centerLat, lng: cluster.centerLng },
              endPoint: null,
              potholeCount,
              complaintCount: potholeCount,
              potholeCoordinates: cluster.hazards.map((h) => ({ lat: h.lat, lng: h.lng, hazardType: h.hazardType })),
              citizenNotes: "Automated corridor audit detected high density of unaddressed road defects exceeding safety threshold.",
              status: "escalated_to_pwd",
              department: "Public Works Department (PWD) - Automated Civic Dispatch",
              escalatedAt: nowEpoch,
              lastUpdatedAt: nowEpoch,
              isAutomatedAudit: true
            };

            await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

            if (GOV_SNS_TOPIC_ARN) {
              await sns.send(
                new PublishCommand({
                  TopicArn: GOV_SNS_TOPIC_ARN,
                  Subject: `[EVENTBRIDGE AUDIT ALERT] ${potholeCount} Road Hazards on ${city.toUpperCase()} Corridor`.slice(0, 100),
                  Message: `AUTOMATED MUNICIPAL ACTION REQUIRED:
EventBridge scheduled corridor scan detected ${potholeCount} road defects within a ${CLUSTER_DISTANCE_METERS}m radius in ${city.toUpperCase()}.
Ticket ID: ${ticketId}
Center Coordinate: ${cluster.centerLat.toFixed(5)}, ${cluster.centerLng.toFixed(5)}`
                })
              );
            }

            results.push({ city, ticketId, potholeCount, status: "escalated" });
          }
        }
      }
    } catch (cityErr) {
      console.warn(`Audit error for ${city}:`, cityErr.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ auditCompleted: true, newEscalations: results }) };
};
