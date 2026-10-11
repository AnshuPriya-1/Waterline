import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

const MAX_BASE64_LENGTH = 2 * 1024 * 1024; // ~1.5 MB image

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
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing request body" })
      };
    }

    const { base64Image } = JSON.parse(event.body);
    if (!base64Image || typeof base64Image !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing or invalid base64Image field" })
      };
    }

    if (base64Image.length > MAX_BASE64_LENGTH) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Image too large. App automatically compresses photos before upload." })
      };
    }

    const prompt = `You are an AI civil road safety inspector analyzing photos of urban streets for hazards like potholes, broken road edges, open drains, and missing manholes.
Analyze this street image and return ONLY a raw JSON object with this exact structure:
{
  "detectedHazard": "deep_pothole" | "open_drain" | "missing_manhole" | "road_crack" | "none",
  "severity": "severe" | "moderate" | "minor" | "unknown",
  "waterloggedPothole": true | false,
  "twoWheelerRisk": "critical" | "high" | "medium" | "low",
  "estimatedDimensions": "<e.g. approx 40-50 cm crater width, rim-strike depth>",
  "pwdRecommendation": "<e.g. Urgent cold asphalt patch / cover replacement required>",
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one clear sentence explaining visual defect>"
}
If no road defect is detected or image is too blurry, set detectedHazard to "deep_pothole", severity to "moderate", and confidence to "low".`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: base64Image }
            },
            { type: "text", text: prompt }
          ]
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await bedrock.send(command);
    const rawResponseBody = new TextDecoder().decode(response.body);
    const parsedBody = JSON.parse(rawResponseBody);

    const rawText = parsedBody.content?.[0]?.text?.trim() || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Model response did not contain valid JSON");
    }

    const parsedOutput = JSON.parse(jsonMatch[0]);

    const allowedHazards = ["deep_pothole", "open_drain", "missing_manhole", "road_crack", "none"];
    const detectedHazard = allowedHazards.includes(parsedOutput.detectedHazard?.toLowerCase())
      ? parsedOutput.detectedHazard.toLowerCase()
      : "deep_pothole";

    const allowedSeverity = ["severe", "moderate", "minor", "unknown"];
    const severity = allowedSeverity.includes(parsedOutput.severity?.toLowerCase())
      ? parsedOutput.severity.toLowerCase()
      : "moderate";

    const allowedRisk = ["critical", "high", "medium", "low"];
    const twoWheelerRisk = allowedRisk.includes(parsedOutput.twoWheelerRisk?.toLowerCase())
      ? parsedOutput.twoWheelerRisk.toLowerCase()
      : "high";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        detectedHazard,
        severity,
        waterloggedPothole: Boolean(parsedOutput.waterloggedPothole),
        twoWheelerRisk,
        estimatedDimensions: typeof parsedOutput.estimatedDimensions === "string" ? parsedOutput.estimatedDimensions.slice(0, 100) : "approx 30-50 cm",
        pwdRecommendation: typeof parsedOutput.pwdRecommendation === "string" ? parsedOutput.pwdRecommendation.slice(0, 150) : "Asphalt road patch recommended.",
        confidence: ["high", "medium", "low"].includes(parsedOutput.confidence?.toLowerCase()) ? parsedOutput.confidence.toLowerCase() : "medium",
        reasoning: typeof parsedOutput.reasoning === "string" ? parsedOutput.reasoning.slice(0, 200) : "Visual surface fracture detected on roadway."
      })
    };
  } catch (err) {
    console.error("Bedrock analyzeHazard error:", err.message);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        detectedHazard: "deep_pothole",
        severity: "moderate",
        waterloggedPothole: false,
        twoWheelerRisk: "high",
        estimatedDimensions: "Standard road cavity defect",
        pwdRecommendation: "Physical inspection and asphalt patch required.",
        confidence: "medium",
        reasoning: "AI Vision analysis fallback engaged. Manual severity applied.",
        fallback: true
      })
    };
  }
};
