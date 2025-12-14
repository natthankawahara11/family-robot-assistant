// /api/chat.js
import OpenAI from "openai";

// Groq ใช้ OpenAI-compatible endpoint
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export default async function handler(req, res) {
  // CORS (เผื่อเปิดจาก iPhone/อุปกรณ์อื่น)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ให้เปิดลิงก์แล้วเห็นว่า API อยู่
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "API is running. Use POST with JSON { type, message, history?, profile? }",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, message, history = [], profile = null } = req.body || {};

    const systemPromptByType = {
      healthcare:
        "You are a safe healthcare assistant. Give general wellness guidance only. Do not diagnose. If urgent, advise seeing a medical professional.",
      sports:
        "You are a friendly sports and fitness coach. Give safe, age-appropriate workout advice. Ask clarifying questions when needed.",
      education:
        "You are a clear, patient tutor. Explain simply step-by-step, then give practice questions.",
      community:
        "You are a kind, supportive companion. Be friendly, encouraging, and helpful.",
    };

    const systemPrompt = systemPromptByType[type] || "You are a helpful assistant.";

    const profileLine = profile?.name
      ? `User profile: name=${profile.name}, ageGroup=${profile.ageText || profile.ageKey || "unknown"}`
      : "User profile: unknown";

    const cleanHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-12)
      : [];

    const userMsg = String(message || "").slice(0, 6000);

    const messages = [
      { role: "system", content: `${systemPrompt}\n\n${profileLine}` },
      ...cleanHistory,
      { role: "user", content: userMsg },
    ];

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.7,
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "…";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: "AI error",
      detail: err?.message || String(err),
    });
  }
}
