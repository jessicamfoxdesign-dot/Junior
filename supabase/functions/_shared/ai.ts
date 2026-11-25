// One place for calling an AI model, shared by every AI function.
//
// A request is offered to a short chain of models in turn and the first good
// answer wins. Any model that is busy, slow, missing or refuses is skipped.
//
//   1. Claude (Anthropic), when ANTHROPIC_API_KEY is set. Paid per use.
//      "facts" requests (plant attributes) go to ANTHROPIC_MODEL_FACTS,
//      everything else (reading a picture) to ANTHROPIC_MODEL_SCAN.
//   2. Google Gemini, when GEMINI_API_KEY is set: AI_MODEL, then each name
//      in AI_FALLBACK_MODELS.
//
// The functions speak the OpenAI chat format, which Google accepts as is.
// Claude has its own format, so requests and replies are translated here and
// the functions never know which model answered. The reply carries the
// header `x-ai-model` naming it.

const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/** Whole-request budget. Callers in the app give up at 30 seconds. */
const BUDGET_MS = 26000;
/** The first model may take this long; a busy model must not eat the budget. */
const FIRST_MS = 17000;
const LATER_MS = 9000;

export type Tier = "facts" | "scan";
interface Entry { provider: "anthropic" | "google"; model: string }

// Read through globalThis so this file also type-checks in the app's test suite.
// deno-lint-ignore no-explicit-any
const env = (k: string, d = "") => String((globalThis as any).Deno?.env.get(k) ?? "").trim() || d;

export function modelChain(tier: Tier): Entry[] {
  // Junior uses Claude only (its privacy policy names Anthropic alone), so Gemini
  // is never offered here even if a GEMINI_API_KEY were set on the project.
  const chain: Entry[] = [];
  if (env("ANTHROPIC_API_KEY")) {
    chain.push({
      provider: "anthropic",
      model: tier === "facts"
        ? env("ANTHROPIC_MODEL_FACTS", "claude-sonnet-5-5")
        : env("ANTHROPIC_MODEL_SCAN", "claude-haiku-5-5"),
    });
  }
  if (false && env("GEMINI_API_KEY")) {
    const names = [env("AI_MODEL", "gemini-3.8-flash"), ...env("AI_FALLBACK_MODELS", "gemini-3.7-flash").split(",")];
    for (const m of new Set(names.map((n) => n.trim()).filter(Boolean))) chain.push({ provider: "google", model: m });
  }
  return chain;
}

/**
 * Same shape as fetch(). The url and the Authorization header in `init` are
 * ignored: each provider gets its own. `init.body` is an OpenAI-format chat
 * request and the reply is always an OpenAI-format chat reply.
 */
export async function aiFetch(_url: string, init: RequestInit, opts: { tier?: Tier } = {}): Promise<Response> {
  const started = Date.now();
  const body = JSON.parse(String(init.body ?? "{}"));
  const chain = modelChain(opts.tier ?? "scan");
  let lastStatus = 503;
  let lastModel = "";

  for (const [i, entry] of chain.entries()) {
    const remaining = BUDGET_MS - (Date.now() - started);
    if (remaining < 3000) break;
    const isLast = i === chain.length - 1;
    const allowed = isLast ? remaining : Math.min(remaining, i === 0 ? FIRST_MS : LATER_MS);
    lastModel = entry.model;
    try {
      const res = entry.provider === "anthropic"
        ? await callAnthropic(entry.model, body, allowed)
        : await callGoogle(entry.model, body, allowed);
      if (res.ok) return tag(res, entry.model);
      lastStatus = res.status;
      console.error(`AI ${entry.provider}/${entry.model} gave ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } catch (e) {
      lastStatus = 504;
      console.error(`AI ${entry.provider}/${entry.model} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  const message = chain.length ? "No AI model answered. Please try again shortly." : "No AI key is configured.";
  return tag(new Response(JSON.stringify({ error: message }), { status: lastStatus === 429 ? 429 : 503 }), lastModel);
}

function tag(res: Response, model: string): Response {
  const headers = new Headers(res.headers);
  headers.set("x-ai-model", model);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function callGoogle(model: string, body: Record<string, unknown>, ms: number): Promise<Response> {
  return fetch(GOOGLE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("GEMINI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model }),
    signal: AbortSignal.timeout(ms),
  });
}

// ---------------------------------------------------------------- Claude

// deno-lint-ignore no-explicit-any
type Any = any;

/** One OpenAI content part to one Claude content block. */
export function toClaudeBlock(part: Any): Any {
  if (typeof part === "string") return { type: "text", text: part };
  if (part?.type === "text") return { type: "text", text: String(part.text ?? "") };
  if (part?.type === "image_url") {
    const url = String(part.image_url?.url ?? "");
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(url);
    if (!m) return { type: "image", source: { type: "url", url } };
    const [, media_type, data] = m;
    return media_type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type, data } }
      : { type: "image", source: { type: "base64", media_type, data } };
  }
  return { type: "text", text: JSON.stringify(part) };
}

/** An OpenAI chat request to a Claude Messages request. */
export function toClaudeRequest(model: string, body: Any, forceTool = true): Any {
  const system: string[] = [];
  const messages: Any[] = [];
  for (const msg of body.messages ?? []) {
    if (msg.role === "system") {
      system.push(typeof msg.content === "string" ? msg.content : (msg.content ?? []).map((p: Any) => p.text ?? "").join("\n"));
      continue;
    }
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: typeof msg.content === "string" ? msg.content : (msg.content ?? []).map(toClaudeBlock),
    });
  }
  const out: Any = { model, max_tokens: Math.max(Number(body.max_tokens) || 0, 8000), messages };

  if (Array.isArray(body.tools) && body.tools.length) {
    out.tools = body.tools.map((t: Any) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
    const wanted = body.tool_choice?.function?.name;
    if (wanted && forceTool) out.tool_choice = { type: "tool", name: wanted };
    else if (wanted) system.push(`You must answer by calling the ${wanted} tool exactly once. Do not answer in prose.`);
    else if (body.tool_choice === "required") out.tool_choice = { type: "any" };
  }
  if (body.response_format?.type === "json_object") {
    system.push("Reply with a single JSON object and nothing else: no code fences, no commentary.");
  }
  if (system.length) out.system = system.join("\n\n");
  return out;
}

/** A Claude Messages reply to an OpenAI chat reply. */
export function fromClaudeReply(reply: Any, wantsJson: boolean): Any {
  const blocks: Any[] = Array.isArray(reply?.content) ? reply.content : [];
  let text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (wantsJson) text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const tool_calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({
    id: b.id,
    type: "function",
    function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
  }));
  return {
    model: reply?.model,
    choices: [{
      index: 0,
      finish_reason: reply?.stop_reason === "tool_use" ? "tool_calls" : reply?.stop_reason === "max_tokens" ? "length" : "stop",
      message: { role: "assistant", content: text || null, ...(tool_calls.length ? { tool_calls } : {}) },
    }],
  };
}

async function callAnthropic(model: string, body: Any, ms: number): Promise<Response> {
  const deadline = Date.now() + ms;
  const send = (forceTool: boolean) =>
    fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(toClaudeRequest(model, body, forceTool)),
      signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1000)),
    });

  let res = await send(true);
  // Some models refuse a forced tool call. Ask again, requiring it in words.
  if (res.status === 400 && body.tool_choice?.function?.name) {
    console.error(`AI anthropic/${model} refused a forced tool call: ${(await res.text()).slice(0, 200)}`);
    res = await send(false);
  }
  if (!res.ok) return res;
  const converted = fromClaudeReply(await res.json(), body.response_format?.type === "json_object");
  return new Response(JSON.stringify(converted), { status: 200, headers: { "Content-Type": "application/json" } });
}
