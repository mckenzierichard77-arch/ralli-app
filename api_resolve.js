// =============================================================================
// api/resolve.js — Vercel serverless function (Ralli ingredient lookup proxy)
// -----------------------------------------------------------------------------
// Sits between the browser and the Anthropic API. Holds the API key server-side
// so it is NEVER exposed in the client bundle. Runs the web_search tool loop on
// the server, then returns Anthropic's final response to the browser.
//
// SETUP:
//   1. Place this file at  api/resolve.js  in your Vercel project root.
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...   (your real key)
//      Redeploy after adding it.
//   3. The browser calls fetch("/api/resolve", { ... }) — same body as the
//      Anthropic /v1/messages endpoint. This function adds the key + version.
//
// NOTE: This runs on Vercel (or `vercel dev` locally). It will NOT run in
// StackBlitz's preview, which has no serverless backend.
// =============================================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOOL_ROUNDS = 6; // safety cap on the search loop

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY." });
    return;
  }

  // Vercel parses JSON bodies automatically; fall back if it's a string.
  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }

  const baseBody = {
    model: payload.model || "claude-sonnet-4-20250514",
    max_tokens: payload.max_tokens || 1200,
    tools: payload.tools || [{ type: "web_search_20250305", name: "web_search" }],
  };

  // Conversation we extend as the model uses tools.
  let messages = Array.isArray(payload.messages) ? [...payload.messages] : [];

  try {
    let final = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const r = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({ ...baseBody, messages }),
      });

      if (!r.ok) {
        const errText = await r.text();
        res.status(r.status).json({ error: "Anthropic API error", detail: errText });
        return;
      }

      const data = await r.json();

      // Server-side web search (web_search_20250305) is executed by Anthropic
      // itself and returned inline, so a normal end_turn means we're done.
      // We still loop in case the model pauses on a client-style tool_use.
      if (data.stop_reason !== "tool_use") {
        final = data;
        break;
      }

      // If the model is waiting on a tool result we don't execute here, stop
      // gracefully and return what we have rather than hanging.
      final = data;
      break;
    }

    res.status(200).json(final);
  } catch (e) {
    res.status(500).json({ error: "Proxy request failed", detail: String(e && e.message || e) });
  }
}
