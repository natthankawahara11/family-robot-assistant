const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function getAgeBand(profile) {
  const key = profile?.ageKey || "";
  // รองรับทั้ง Age1..Age5 และเผื่อมีส่งเป็นข้อความ
  if (key === "Age1") return { id: "Age1", label: "Ages 5–8 (Early Kids)" };
  if (key === "Age2") return { id: "Age2", label: "Ages 9–12 (Kids)" };
  if (key === "Age3") return { id: "Age3", label: "Ages 13–17 (Teens)" };
  if (key === "Age4") return { id: "Age4", label: "Ages 18–59 (Adults)" };
  if (key === "Age5") return { id: "Age5", label: "Ages 60+ (Older Adults)" };

  // fallback: ลองเดาจาก ageText
  const t = (profile?.ageText || "").toLowerCase();
  if (t.includes("5") && t.includes("8")) return { id: "Age1", label: "Ages 5–8 (Early Kids)" };
  if (t.includes("9") && t.includes("12")) return { id: "Age2", label: "Ages 9–12 (Kids)" };
  if (t.includes("13") && t.includes("17")) return { id: "Age3", label: "Ages 13–17 (Teens)" };
  if (t.includes("18") || t.includes("59")) return { id: "Age4", label: "Ages 18–59 (Adults)" };
  if (t.includes("60")) return { id: "Age5", label: "Ages 60+ (Older Adults)" };

  return { id: "unknown", label: "Unknown age group" };
}

function buildSystemPrompt(type, profile) {
  const age = getAgeBand(profile);
  const name = profile?.name ? String(profile.name).slice(0, 60) : "User";

  // “กฎตามช่วงอายุ” ที่ใช้ร่วมกันทุกบอท
  const ageStyle = {
    Age1: [
      "Use very simple words and short sentences.",
      "Ask only 1 question at a time.",
      "Be gentle and encouraging. Use friendly tone.",
      "Avoid scary details. For health topics, always recommend asking a parent/guardian.",
    ],
    Age2: [
      "Use simple explanations but can be a bit more detailed than Age1.",
      "Give step-by-step instructions with examples.",
      "Encourage good habits and safety.",
      "For health topics, suggest telling a parent/guardian for anything serious.",
    ],
    Age3: [
      "Use clear explanations, slightly more mature tone.",
      "Support autonomy but emphasize safety and healthy boundaries.",
      "Give actionable steps and reasoning.",
      "For health/mental wellbeing, recommend trusted adult/professional when needed.",
    ],
    Age4: [
      "Use practical, direct guidance.",
      "Include pros/cons and options.",
      "Keep it efficient and realistic.",
      "For health: do not diagnose; recommend professional care when appropriate.",
    ],
    Age5: [
      "Use respectful, calm tone.",
      "Prioritize safety, fall-risk, joint care, and medication caution (no medical advice beyond general info).",
      "Keep instructions easy to follow and not too fast/complex.",
      "Encourage seeing a clinician for symptoms or existing conditions.",
    ],
    unknown: [
      "Be clear, safe, and ask a quick clarifying question if age matters.",
    ],
  }[age.id] || [
    "Be clear, safe, and age-appropriate.",
  ];

  const baseSafety = [
    "Never claim you are a doctor. No diagnosis. No prescribing medication.",
    "If user may be in danger or has severe symptoms, advise seeking professional help immediately.",
    "Be polite and helpful.",
  ];

  const typePrompt = {
    healthcare: [
      "You are a safe healthcare assistant for general wellness.",
      "Give simple self-care tips, prevention, and when-to-see-a-doctor guidance.",
      "If the question is urgent (chest pain, trouble breathing, fainting, severe bleeding, suicidal thoughts), advise emergency services right away.",
    ],
    sports: [
      "You are a friendly sports & fitness coach.",
      "Give safe workouts, warm-up/cool-down, and progressive plans.",
      "Ask about goal, experience, injuries, and available equipment when needed.",
    ],
    education: [
      "You are a patient tutor.",
      "Explain step-by-step, then give short practice questions and check answers.",
      "Adapt difficulty to the learner.",
    ],
    community: [
      "You are a kind supportive companion.",
      "Be encouraging, listen, and offer practical coping/helpful steps.",
      "If user expresses self-harm or immediate danger, encourage reaching out to local emergency help and trusted people.",
    ],
  }[type] || ["You are a helpful assistant."];

  return [
    `User: ${name}`,
    `Age group: ${age.label}`,
    "",
    ...typePrompt,
    "",
    "Age-appropriate style rules:",
    ...ageStyle.map(x => `- ${x}`),
    "",
    "Safety rules:",
    ...baseSafety.map(x => `- ${x}`),
  ].join("\n");
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method === "GET") {
      return res.status(200).json({ ok: true, message: "API is running. Use POST." });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { type, message, history = [], profile = null } = req.body || {};
    const userMsg = String(message || "").slice(0, 6000);

    // clean history (กันพัง/กัน token บวม)
    const cleanHistory = Array.isArray(history)
      ? history
          .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
      : [];

    const system = buildSystemPrompt(type, profile);

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        ...cleanHistory,
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
