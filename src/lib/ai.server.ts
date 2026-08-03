const CHAT_COMPLETIONS_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_TEXT_MODEL = "openai/gpt-5.5";

type JsonSchema = Record<string, unknown>;
type MessageContent = string | Array<Record<string, unknown>>;

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

export async function callAI(
  system: string,
  user: MessageContent,
  jsonSchema?: JsonSchema,
  model = DEFAULT_TEXT_MODEL,
) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const body: Record<string, unknown> = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (jsonSchema) {
    body.tools = [
      {
        type: "function",
        function: {
          name: "result",
          description: "Resultado estruturado da análise.",
          parameters: jsonSchema,
        },
      },
    ];
    body.tool_choice = { type: "function", function: { name: "result" } };
  }

  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json();
  const message = payload.choices?.[0]?.message;

  if (jsonSchema) {
    const args = message?.tool_calls?.[0]?.function?.arguments;
    if (args) return JSON.parse(args);

    const content = typeof message?.content === "string" ? message.content : "";
    return extractJsonObject(content);
  }

  return message?.content ?? "";
}
