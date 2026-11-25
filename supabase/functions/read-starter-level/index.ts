// Junior: reads a sourdough starter's height off the scale printed on its jar.
//
// Input:  { imageBase64: "data:image/jpeg;base64,..." }  (one photo)
// Output: { version, level_in, streak_in, confidence, note, model }
//   level_in   top of the starter now, inches on the jar's scale, or null
//   streak_in  top of the highest residue line left by an earlier rise, or null
//
// The model may answer "cannot tell" (null). The app shows its reading as a
// suggestion and the owner confirms or corrects it; nothing is saved here.
// Counts toward the daily AI limit; a failed call is given back.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/ai.ts";

const VERSION = "junior-reader-1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You read the height of a sourdough starter in a clear jar from a photo.
The jar has a measuring scale printed on it, usually in inches with half-inch labels and quarter-inch ticks.

Report two heights, both on the jar's own printed scale, to the nearest 0.05 inch:

1. level_in: the top surface of the starter right now, where it meets the glass at the front of the jar.
   Read the scale at that height. If the surface is domed or uneven, use the average height at the front.
   Ignore bubbles and froth on top only if they are clearly separate from the body of the starter.

2. streak_in: the top of the residue line that an earlier rise left on the glass, if there is one.
   A rise leaves a band of starter film or dried residue that runs roughly level around the jar.
   Splashes, drips and smears from stirring or pouring are irregular, vertical or patchy: they are NOT a rise line.
   Report the top of the highest band that is clearly a rise line. If you cannot tell a rise line from smears, return null.

Rules:
- Read the numbers printed on the jar. Interpolate between ticks. Do not guess the scale from the jar's size.
- If the scale is not in inches, or you cannot see it, return null for both and say why in note.
- Never invent a value. null is a correct answer when you cannot tell.
- confidence: "high" when the surface and the nearby ticks are sharp, "medium" when you interpolate across a blurry or angled area, "low" otherwise.
- note: one short sentence, plain words, about anything that affected the reading (angle, glare, smears).`;

const TOOL = {
  type: "function",
  function: {
    name: "report_starter_level",
    description: "Report the starter height and the highest earlier rise line, in inches on the jar's scale.",
    parameters: {
      type: "object",
      properties: {
        level_in: { type: ["number", "null"], description: "Current top of the starter, inches, or null." },
        streak_in: { type: ["number", "null"], description: "Top of the highest earlier rise line, inches, or null." },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        note: { type: "string" },
      },
      required: ["level_in", "streak_in", "confidence", "note"],
    },
  },
};

const inches = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.round(n * 100) / 100 : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await db.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    let image = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    if (!image) return json({ error: "A photo is required" }, 400);
    if (!image.startsWith("data:")) image = `data:image/jpeg;base64,${image}`;
    if (image.length > 8_000_000) return json({ error: "Photo is too large" }, 413);

    const { data: allowed, error: capError } = await db.rpc("claim_ai_use");
    if (capError) console.error("AI cap check failed:", capError.message);
    if (capError || allowed !== true) {
      return json({ error: capError ? "AI is unavailable right now." : "Daily AI limit reached. It resets at midnight UTC." }, 429);
    }

    const res = await aiFetch("", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Read this jar." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_starter_level" } },
      }),
    }, { tier: "scan" });
    const model = res.headers.get("x-ai-model") ?? "";

    if (!res.ok) {
      await db.rpc("refund_ai_use");
      console.error("read-starter-level AI error:", res.status, (await res.text()).slice(0, 300));
      return json({ error: "Couldn't read the photo. Try again, or type the level." }, res.status === 429 ? 429 : 502);
    }

    const reply = await res.json();
    const call = reply.choices?.[0]?.message?.tool_calls?.[0];
    let out: Record<string, unknown> = {};
    try {
      out = JSON.parse(call?.function?.arguments ?? reply.choices?.[0]?.message?.content ?? "{}");
    } catch {
      out = {};
    }
    const confidence = ["high", "medium", "low"].includes(String(out.confidence)) ? String(out.confidence) : "low";
    return json({
      version: VERSION,
      level_in: inches(out.level_in),
      streak_in: inches(out.streak_in),
      confidence,
      note: typeof out.note === "string" ? out.note.slice(0, 500) : "",
      model,
    });
  } catch (e) {
    console.error("read-starter-level error:", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong reading the photo." }, 500);
  }
});
