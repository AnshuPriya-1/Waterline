/**
 * Tiny in-memory stand-in for DynamoDB + SNS.
 * Used ONLY by the local dev server (no AWS credentials) and by the tests,
 * so the REAL Lambda handler code runs unchanged without an AWS account.
 */
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";

export const fake = {
  table: new Map(), // "PK|SK" -> item
  snsMessages: []
};

export function resetFake() {
  fake.table = new Map();
  fake.snsMessages = [];
}

export function putFake(item) {
  fake.table.set(`${item.PK}|${item.SK}`, { ...item });
}

function send(command) {
  const name = command.constructor.name;
  const input = command.input;

  if (name === "QueryCommand") {
    const pk = input.ExpressionAttributeValues[":pk"];
    return { Items: [...fake.table.values()].filter((i) => i.PK === pk).map((i) => ({ ...i })) };
  }
  if (name === "PutCommand") {
    putFake(input.Item);
    return {};
  }
  if (name === "GetCommand") {
    const item = fake.table.get(`${input.Key.PK}|${input.Key.SK}`);
    return { Item: item ? { ...item } : undefined };
  }
  if (name === "UpdateCommand") {
    const item = fake.table.get(`${input.Key.PK}|${input.Key.SK}`);
    if (!item) throw new Error("update on missing item");
    const names = input.ExpressionAttributeNames || {};
    const values = input.ExpressionAttributeValues || {};
    const setPart = input.UpdateExpression.replace(/^SET\s+/, "");
    for (const assignment of setPart.split(",")) {
      const [left, right] = assignment.split("=").map((x) => x.trim());
      item[names[left] || left] = values[right];
    }
    return {};
  }
  throw new Error("fakeDynamo: unexpected command " + name);
}

export function installFakeAws() {
  DynamoDBDocumentClient.prototype.send = async function (command) {
    return send(command);
  };
  SNSClient.prototype.send = async function (command) {
    fake.snsMessages.push(command.input);
    console.log("[fake SNS] alert would be emailed:", command.input.Subject);
    return {};
  };
}
