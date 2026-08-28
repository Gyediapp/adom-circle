// Lightweight content moderation.
//
// Free tier (always on): a local keyword/hate-speech filter that flags
// obviously toxic content instantly — no cost, no external call.
//
// AI tier (opt-in): when DEEPSEEK_API_KEY (or OPENROUTER_API_KEY) is set, a
// message that passes the local filter but looks suspicious is sent to the
// LLM for a second opinion. Cost is near-zero because only flagged messages
// go to the AI (not every message).

const TOXIC_PATTERNS: Array<RegExp> = [
  /\bfuck(ing|er|s)?\b/i,
  /\bshit\b/i,
  /\bbitch(es)?\b/i,
  /\basshole(s)?\b/i,
  /\bwhore(s)?\b/i,
  /\bslut(s)?\b/i,
  /\bdick(s)?\b/i,
  /\bcunt(s)?\b/i,
  /\bnigg[ae]r(s)?\b/i,
  /\bkill\s+(yourself|yourselves)\b/i,
  /\bdie\s+(you|bitch)\b/i,
  /\bfag(got)?s?\b/i,
  /\btraitor\b/i, // politically charged in Ghana — flag for review
  /\bfoolish\s+(man|woman|boy|girl|people)\b/i,
];

// Words that are often fine in context but worth a second look
const SUSPICIOUS_PATTERNS: Array<RegExp> = [
  /\b(dumb|stupid|idiot|moron|ignorant)\b/i,
  /\b(hate|kill|attack|destroy)\b/i,
  /\b(sex|nude|porn|xxx)\b/i,
  /\b(scam|fraud|cheat)\b/i,
];

export type ModerationResult = {
  ok: boolean; // true = safe to post
  flagged: boolean; // true = flagged for review (still posted unless hard-blocked)
  blocked: boolean; // true = hard-blocked (toxic)
  reasons: string[];
};

export function localFilter(text: string): ModerationResult {
  const reasons: string[] = [];
  let blocked = false;
  for (const p of TOXIC_PATTERNS) {
    if (p.test(text)) {
      reasons.push("toxic-language");
      blocked = true;
    }
  }
  for (const p of SUSPICIOUS_PATTERNS) {
    if (p.test(text)) reasons.push("suspicious");
  }
  return {
    ok: !blocked,
    flagged: reasons.length > 0,
    blocked,
    reasons,
  };
}

// Optional AI second opinion — only called for messages that look suspicious
export async function aiModerate(text: string): Promise<ModerationResult | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model =
    process.env.MODERATION_MODEL || (process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "openai/gpt-4o-mini");
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a content moderator for Adom Circle, a respectful Ghanaian community. Classify the user's message. Reply with exactly one JSON object: {\"blocked\":bool,\"flagged\":bool,\"reasons\":[string]}. Block only clear hate speech, severe abuse or harassment. Flag anything that could warrant review.",
          },
          { role: "user", content: text.slice(0, 500) },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
      blocked?: boolean;
      flagged?: boolean;
      reasons?: string[];
    };
    return {
      ok: !parsed.blocked,
      flagged: Boolean(parsed.blocked || parsed.flagged),
      blocked: Boolean(parsed.blocked),
      reasons: parsed.reasons ?? [],
    };
  } catch {
    return null; // AI down — fall through to local filter result
  }
}
