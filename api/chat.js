// api/chat.js
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
      "5) IMPORTANT: choices MUST contain the correct answer. Do not make impossible questions.",
      "6) For math questions: compute the correct numeric answer precisely and include it in choices.",
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

/* =========================================================
   ✅ QUIZ SANITIZER (Fix wrong / missing correct math answers)
   ========================================================= */

function safeJSONParse(text) {
  try { return JSON.parse(text); } catch (_) {}
  const t = String(text || "");
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch (_) {}
  }
  return null;
}

function normalizeQuiz(obj) {
  if (!obj || typeof obj !== "object") return null;
  const qs = Array.isArray(obj.questions) ? obj.questions : [];
  const clean = qs.map(q => ({
    question: String(q.question || "").trim(),
    choices: Array.isArray(q.choices) ? q.choices.map(x => String(x)) : [],
    answerIndex: Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null,
    explanation: String(q.explanation || "").trim(),
  })).filter(q => q.question && q.choices.length >= 2);
  if (!clean.length) return null;
  return { questions: clean };
}

function uniqChoices(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = String(x).trim();
    if (!k) continue;
    if (seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}

// Extract first integer-ish number from a string
function firstNumber(str) {
  const m = String(str || "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Detect simple math and compute correct answer.
// Returns { value: number, unitHint?: string } or null
function computeMathAnswer(question, choices) {
  const q = String(question || "").replace(/\u2212/g, "-"); // normalize minus
  const qc = q.toLowerCase();

  // pattern: "What is 7 - 2?"
  let m = q.match(/what\s+is\s+(-?\d+)\s*([\+\-\*x×\/])\s*(-?\d+)\s*\??/i);
  if (m) {
    const a = Number(m[1]);
    const op = m[2];
    const b = Number(m[3]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (op === "+") return { value: a + b };
      if (op === "-" ) return { value: a - b };
      if (op === "*" || op.toLowerCase() === "x" || op === "×") return { value: a * b };
      if (op === "/") return { value: a / b };
    }
  }

  // pattern: "Divide 15 cm by 5 parts" / "divided into 5 parts"
  if (qc.includes("divided") && qc.includes("parts")) {
    const nums = q.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) {
      const total = nums[0], parts = nums[1];
      if (parts !== 0) {
        const unit = qc.includes("cm") ? "cm" : null;
        return { value: total / parts, unitHint: unit };
      }
    }
  }

  // pattern: "If it takes 5 apples ... and you have 15 apples ... how many pies"
  if (qc.includes("apples") && qc.includes("pie")) {
    const nums = q.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) {
      // assume first is apples per pie, second is total apples (or vice versa)
      // choose the division that gives an integer and matches choices if possible
      const [n1, n2] = nums;
      const cand = [];
      if (n1 !== 0) cand.push(n2 / n1);
      if (n2 !== 0) cand.push(n1 / n2);
      // pick best: integer first
      let best = cand.find(v => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9);
      if (best === undefined) best = cand.find(v => Number.isFinite(v));
      if (best !== undefined) return { value: best };
    }
  }

  // pattern: rectangle area length L width W
  if (qc.includes("rectangle") && qc.includes("area") && (qc.includes("length") && qc.includes("width"))) {
    const nums = q.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) {
      const L = nums[0], W = nums[1];
      const unit = qc.includes("cm") ? "square cm" : null;
      return { value: L * W, unitHint: unit };
    }
  }

  // generic: if question contains "multiply" and has 2 nums
  if (qc.includes("multiply")) {
    const nums = q.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) return { value: nums[0] * nums[1] };
  }

  // If choices look like pure numbers and question includes + - x /, try fallback
  if (/[+\-*x×\/]/i.test(q)) {
    const nums = q.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) {
      // very rough: if has x or × => multiply, if has / => divide, if has - => subtract, if has + => add
      const a = nums[0], b = nums[1];
      if (qc.includes("×") || qc.includes(" x ") || qc.includes("x")) return { value: a * b };
      if (qc.includes("/")) return { value: b !== 0 ? a / b : NaN };
      if (qc.includes("-")) return { value: a - b };
      if (qc.includes("+")) return { value: a + b };
    }
  }

  return null;
}

// Format answer to match choice style (units etc.)
function formatAnswer(value, question, choices, unitHint) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;

  // integer if very close
  const isInt = Math.abs(v - Math.round(v)) < 1e-9;
  const base = isInt ? String(Math.round(v)) : String(v);

  // If choices contain "square cm" or question mentions area, add unit
  const all = [...(choices || []), String(question || "")].join(" ").toLowerCase();
  if (unitHint) return `${base} ${unitHint}`;

  if (all.includes("square cm")) return `${base} square cm`;
  if (all.includes(" cm")) return `${base} cm`;

  return base;
}

function sanitizeQuiz(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;

  for (const q of quiz.questions) {
    q.question = String(q.question || "").trim();
    q.explanation = String(q.explanation || "").trim();
    q.choices = uniqChoices(Array.isArray(q.choices) ? q.choices : []);

    // ensure 4 choices (pad if needed)
    while (q.choices.length < 4) q.choices.push(`Option ${String.fromCharCode(65 + q.choices.length)}`);

    // trim to 4
    q.choices = q.choices.slice(0, 4);

    // fix answerIndex range
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
      q.answerIndex = 0;
    }

    // ✅ Math auto-fix: if correct answer missing or answerIndex points wrong
    const computed = computeMathAnswer(q.question, q.choices);
    if (computed) {
      const correctText = formatAnswer(computed.value, q.question, q.choices, computed.unitHint);
      if (correctText) {
        const foundIdx = q.choices.findIndex(c => String(c).trim().toLowerCase() === correctText.trim().toLowerCase());

        if (foundIdx >= 0) {
          // ensure answerIndex points to correct
          q.answerIndex = foundIdx;
        } else {
          // inject correct answer by replacing a non-correct slot (prefer replacing current answer if it's wrong)
          const replaceIdx = (q.answerIndex >= 0 && q.answerIndex <= 3) ? q.answerIndex : 0;
          q.choices[replaceIdx] = correctText;
          q.answerIndex = replaceIdx;

          // re-unique again (if duplicates occur)
          q.choices = uniqChoices(q.choices).slice(0, 4);
          while (q.choices.length < 4) q.choices.push(`Option ${String.fromCharCode(65 + q.choices.length)}`);
        }

        // Make explanation consistent (optional but helps UX)
        if (!q.explanation) {
          q.explanation = "Compute the values carefully to find the correct answer.";
        }
      }
    }
  }

  // keep only valid questions with 4 choices and answerIndex 0..3
  quiz.questions = quiz.questions.filter(q =>
    q.question &&
    Array.isArray(q.choices) && q.choices.length === 4 &&
    Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex <= 3
  );

  return quiz;
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

    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        ...(isQuiz ? [] : cleanHistory),
        { role: "user", content: userMsg },
      ],
      temperature: isQuiz ? 0.25 : 0.7, // ลดสุ่มสำหรับ quiz
    };

    // NOTE: บางที Groq อาจ ignore response_format ได้ แต่ไม่เป็นไร เพราะเรามี sanitizer แล้ว
    if (isQuiz) {
      payload.response_format = { type: "json_object" };
    }

    const completion = await client.chat.completions.create(payload);
    let reply = completion?.choices?.[0]?.message?.content?.trim() || "…";

    // ✅ If quiz: parse->normalize->sanitize->return JSON (as string)
    if (isQuiz) {
      const obj = safeJSONParse(reply);
      const normalized = normalizeQuiz(obj);
      const fixed = sanitizeQuiz(normalized);

      if (fixed && fixed.questions?.length) {
        reply = JSON.stringify(fixed);
      } else {
        // fallback: return minimal safe quiz JSON
        reply = JSON.stringify({
          questions: [
            {
              question: "What is 6 × 4?",
              choices: ["24", "20", "16", "12"],
              answerIndex: 0,
              explanation: "Multiply 6 by 4."
            }
          ]
        });
      }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(200).json({
      reply: "AI is temporarily unavailable. Please try again in a moment."
    });
  }
};
