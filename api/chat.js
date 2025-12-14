import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS (เผื่อเปิดจากอุปกรณ์อื่น)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { type, message, history = [], profile = null } = req.body || {};

    const systemPromptByType = {
      healthcare:
        "You are a safe healthcare assistant. Give general wellness guidance only. If symptoms seem urgent, advise seeing a medical professional. Do not diagnose.",
      sports:
        "You are a friendly sports and fitness coach. Give safe, age-appropriate workout advice and ask clarifying questions when needed.",
      education:
        "You are a clear, patient tutor. Explain simply, step-by-step, then offer practice questions.",
      community:
        "You are a kind supportive companion. Be friendly, encouraging, and helpful.",
    };

    const systemPrompt =
      systemPromptByType[type] || "You are a helpful assistant.";

    const profileLine = profile?.name
      ? `User profile: name=${profile.name}, ageGroup=${profile.ageText || profile.ageKey || "unknown"}`
      : "User profile: unknown";

    const messages = [
      { role: "system", content: `${systemPrompt}\n\n${profileLine}` },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: String(message || "").slice(0, 6000) },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content || "…";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "AI error", detail: err?.message || String(err) });
  }
}
