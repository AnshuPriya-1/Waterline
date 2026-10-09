import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

const ALLOWED_LEVELS = ["ankle", "knee", "waist", "stalled", "unknown"];
const ALLOWED_CONFIDENCE = ["low", "medium", "high"];
const MAX_BASE64_LENGTH = 2 * 1024 * 1024; // about 2 million characters of base64 (roughly 1.5 MB of image)

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
        body: JSON.stringify({ error: "Image is too large. The app shrinks photos before sending, so please try again." })
      };
    }

    const prompt = `You are an assistant estimating street waterlogging depth from a commuter perspective.
Examine this street photo for water depth using physical reference anchors:
- Vehicle wheels (tire contact, rim level, hub level, tailpipe, engine stall depth)
- Pedestrian legs (ankle, calf, knee, thigh, waist)
- Curbs, road dividers, steps, barricades

Return ONLY a raw JSON object with this exact structure and nothing else:
{
  "suggestedLevel": "ankle" | "knee" | "waist" | "stalled" | "unknown",
  "confidence": "low" | "medium" | "high",
  "referenceObject": "<brief description of anchor object seen, or 'none'>",
  "reasoning": "<one concise sentence explaining visual cue>"
}
If no water is present, lighting is too poor, or water depth is ambiguous, return suggestedLevel: "unknown" and confidence: "low".`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 250,
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
      throw new Error("Model response did not contain a valid JSON block");
    }

    const parsedOutput = JSON.parse(jsonMatch[0]);

    const suggestedLevel = ALLOWED_LEVELS.includes(parsedOutput.suggestedLevel?.toLowerCase())
      ? parsedOutput.suggestedLevel.toLowerCase()
      : "unknown";

    const confidence = ALLOWED_CONFIDENCE.includes(parsedOutput.confidence?.toLowerCase())
      ? parsedOutput.confidence.toLowerCase()
      : "low";

    const referenceObject = typeof parsedOutput.referenceObject === "string" && parsedOutput.referenceObject.length > 0
      ? parsedOutput.referenceObject.slice(0, 100)
      : "none";

    const reasoning = typeof parsedOutput.reasoning === "string" && parsedOutput.reasoning.length > 0
      ? parsedOutput.reasoning.slice(0, 200)
      : "Visual depth cue extracted from surroundings.";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        suggestedLevel,
        confidence,
        referenceObject,
        reasoning,
        notice: "Water can hide open drains. This is an estimate, not a guarantee."
      })
    };
  } catch (err) {
    console.error("Bedrock analyzeFlood error:", err);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        suggestedLevel: "unknown",
        confidence: "low",
        referenceObject: "none",
        reasoning: "Automated analysis unavailable. Please tap your observed water depth below.",
        notice: "Water can hide open drains. This is an estimate, not a guarantee.",
        fallback: true
      })
    };
  }
};