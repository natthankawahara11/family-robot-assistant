const OpenAI = require("openai");

const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";

let client = null;
if (GROQ_KEY) {
  client = new OpenAI({
    apiKey: GROQ_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function getAgeBand(profile) {
  const ageNumber = Number(profile?.ageNumber);
  if (Number.isFinite(ageNumber)) {
    const a = Math.max(0, Math.min(140, ageNumber));

    if (a <= 2)  return { id: "Baby",       label: "Baby Age: 0–2" };
    if (a <= 5)  return { id: "Child",      label: "Child Age: 3–5" };
    if (a <= 8)  return { id: "YoungChild", label: "Young Child Age: 6–8" };
    if (a <= 12) return { id: "PreTeen",    label: "Pre-Teen Age: 9–12" };
    if (a <= 17) return { id: "Teen",       label: "Teen Age: 13–17" };
    if (a <= 24) return { id: "YoungAdult", label: "Young Adult Age: 18–24" };
    if (a <= 34) return { id: "Adult",      label: "Adult Age: 25–34" };
    if (a <= 44) return { id: "MidAdult",   label: "Mid Adult Age: 35–44" };
    if (a <= 54) return { id: "OlderAdult", label: "Older Adult Age: 45–54" };
    if (a <= 64) return { id: "Senior",     label: "Senior Age: 55–64" };
    if (a <= 74) return { id: "Elderly",    label: "Elderly Age: 65–74" };
    return          { id: "VeryElderly", label: "Very Elderly Age: 75+" };
  }

  const key = profile?.ageKey || "unknown";
  const text = profile?.ageText || "Unknown age group";
  return { id: key, label: text };
}

function buildSystemPrompt(type, profile) {
  const age = getAgeBand(profile);
  const name = profile?.name ? String(profile.name).slice(0, 60) : "User";

  const isQuiz = typeof type === "string" && type.endsWith("_quiz");
  const quizBase = isQuiz ? type.replace("_quiz", "") : null;

  const ageStyleMap = {
    Baby: [
      "Use ultra-simple language and very short sentences.",
      "Be gentle and calm.",
      "Avoid scary details. Encourage caregiver involvement.",
      "For health concerns: advise seeing a parent/guardian and clinician when needed."
    ],
    Child: [
      "Use simple words and short steps.",
      "Ask 1 question at a time.",
      "Be friendly and encouraging.",
      "For health: suggest telling a parent/guardian for serious symptoms."
    ],
    YoungChild: [
      "Use simple explanations with small steps and examples.",
      "Be encouraging and clear.",
      "Avoid complex medical wording; no diagnosis."
    ],
    PreTeen: [
      "Use clear explanations, short steps, and examples.",
      "Encourage good habits and safety.",
      "For health: suggest talking to a trusted adult if serious."
    ],
    Teen: [
      "Use clear, respectful tone.",
      "Give actionable steps and reasoning.",
      "For health/mental wellbeing: suggest trusted adult/professional when needed."
    ],
    YoungAdult: [
      "Use practical, direct guidance.",
      "Offer options and pros/cons.",
      "No diagnosis or prescribing."
    ],
    Adult: [
      "Practical, efficient guidance.",
      "Include options, trade-offs, and next steps.",
      "No diagnosis; recommend clinician when appropriate."
    ],
    MidAdult: [
      "Practical, direct guidance with safety emphasis.",
      "Include options, trade-offs, and next steps."
    ],
    OlderAdult: [
      "Calm, respectful guidance.",
      "Safety first; avoid medication advice.",
      "Recommend professional care when appropriate."
    ],
    Senior: [
      "Respectful and calm.",
      "Prioritize safety and easy steps.",
      "Recommend clinician when appropriate."
    ],
    Elderly: [
      "Respectful and calm.",
      "Prioritize safety; keep instructions easy.",
      "Recommend clinician when appropriate."
    ],
    VeryElderly: [
      "Respectful and calm.",
      "Keep instructions simple and safe.",
      "Recommend clinician when appropriate."
    ],
    unknown: [
      "Be clear, safe, and ask a quick clarifying question if age matters."
    ]
  };

  const ageStyle = ageStyleMap[age.id] || ageStyleMap.unknown;

  const baseSafety = [
    "Never claim you are a doctor. No diagnosis. No prescribing medication.",
    "If user may be in danger or has severe symptoms, advise seeking professional help immediately.",
    "Be polite and helpful.",
  ];

  if (isQuiz) {
    const quizDomainRules = {
      healthcare: [
        "Quiz must be educational and general (wellness, first aid basics, nutrition, hygiene, safety).",
        "Do NOT give diagnosis or personalized medical treatment advice.",
      ],
      sports: [
        "Quiz may include fitness basics, training principles, injury prevention basics, sports rules, anatomy basics.",
      ],
      education: [
        "Quiz may include general school topics based on the user's topic (math, science, language, history, etc.).",
      ],
      community: [
        "Quiz may include civics, empathy, communication, safety, digital citizenship, teamwork, basic social skills.",
      ],
    }[quizBase] || ["Quiz must be safe and age-appropriate."];

    return [
      `User: ${name}`,
      `Age group: ${age.label}`,
      "",
      "You are a quiz generator.",
      "The user message is JSON with fields:",
      "- category (string), topic (string), numQuestions (int), gradeLevel (string), difficulty (Easy/Medium/Hard), timed (bool), secondsPerQuestion (int).",
      "",
      "OUTPUT RULES (VERY IMPORTANT):",
      "1) Output ONLY valid JSON. No markdown. No explanation outside JSON.",
      "2) JSON schema:",
      "{",
      '  "questions": [',
      "    {",
      '      "question": "string",',
      '      "choices": ["A","B","C","D"],',
      '      "answerIndex": 0,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      "4) Always 4 choices. answerIndex must be 0..3.",
      "5) Keep language simple and match gradeLevel and age.",
      "",
      "Domain safety:",
      ...quizDomainRules.map(x => `- ${x}`),
      "",
      "General safety:",
      ...baseSafety.map(x => `- ${x}`),
    ].join("\n");
  }

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
    const userMsg = String(message || "").slice(0, 9000);

    if (!client) {
      return res.status(200).json({
        reply: "AI is not configured yet (missing GROQ_API_KEY). Please set it in your deployment environment."
      });
    }

    const cleanHistory = Array.isArray(history)
      ? history
          .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
      : [];

    const system = buildSystemPrompt(type, profile);

    const isQuiz = typeof type === "string" && type.endsWith("_quiz");

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        ...(isQuiz ? [] : cleanHistory),
        { role: "user", content: userMsg },
      ],
      temperature: isQuiz ? 0.35 : 0.7,
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "…";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(200).json({
      reply: "AI is temporarily unavailable. Please try again in a moment."
    });
  }
};
