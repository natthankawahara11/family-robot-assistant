const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

module.exports = async function handler(req, res) {
  try {
    console.log("METHOD:", req.method);
    console.log("HAS_KEY:", !!process.env.GROQ_API_KEY);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method === "GET") {
      return res.status(200).json({ ok: true, message: "API is running" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { type, message } = req.body || {};
    const userMsg = String(message || "").slice(0, 6000);

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: `Type=${type || "unknown"}. You are helpful.` },
        { role: "user", content: userMsg },
      ],
      temperature: 0.7,
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "…";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(500).json({
      error: "AI error",
      detail: err?.message || String(err),
    });
  }
};
