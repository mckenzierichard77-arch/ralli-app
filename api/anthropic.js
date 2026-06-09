export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Prefer server-side secret; fall back to Vite-prefixed key for local dev
  const apiKey = process.env.ANTHROPIC_KEY || process.env.VITE_ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anthropic API key not configured on server." });
  }

  const { model, max_tokens, messages } = req.body || {};
  if (!model || !max_tokens || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "Missing required fields: model, max_tokens, messages." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, messages }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
