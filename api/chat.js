// Vercel serverless function: AI backend for the AI Workforce site.
// POST /api/chat  { message, system, history:[{role:"user"|"ai", text}] }
// Needs the GEMINI_API_KEY environment variable set in the Vercel project.
// The key never touches the browser or the repo.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not_configured" }); return; }

  var data = req.body;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }
  data = data || {};
  var message = String(data.message || "").slice(0, 2000);
  var system = String(data.system || "").slice(0, 2000);
  var history = Array.isArray(data.history) ? data.history.slice(-10) : [];
  if (!message.trim()) { res.status(400).json({ error: "empty message" }); return; }

  var contents = [];
  history.forEach(function (h) {
    if (h && h.text) {
      contents.push({
        role: h.role === "ai" ? "model" : "user",
        parts: [{ text: String(h.text).slice(0, 2000) }]
      });
    }
  });
  contents.push({ role: "user", parts: [{ text: message }] });

  var payload = { contents: contents };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };

  try {
    var r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    var j = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: "ai_error", detail: (j && j.error && j.error.message) || ("HTTP " + r.status) });
      return;
    }
    var parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    var text = parts.map(function (p) { return p.text || ""; }).join("").trim();
    res.status(200).json({ reply: text });
  } catch (e) {
    res.status(502).json({ error: "ai_error", detail: String((e && e.message) || e) });
  }
};
