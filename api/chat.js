// api/chat.js
const OpenAI = require("openai");

const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";

// ===============================
// ✅ CONFIG: CHOOSE ONE INDEX BASE
// เรา "บังคับ" output เป็น 1..4 (ONE-BASED) ทุก quiz
// ===============================
const INDEX_BASE = "one"; // "one" only in this file
const MIN_INDEX = 1;
const MAX_INDEX = 4;

let client = null;
if (GROQ_KEY) {
  client = new OpenAI({
    apiKey: GROQ_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

/* =========================================================
   ✅ AGE BAND
   ========================================================= */
function getAgeBand(profile) {
  const ageNumber = Number(profile?.ageNumber);
  if (Number.isFinite(ageNumber)) {
    const a = Math.max(0, Math.min(140, ageNumber));

    if (a <= 2) return { id: "Baby", label: "Baby Age: 0–2" };
    if (a <= 5) return { id: "Child", label: "Child Age: 3–5" };
    if (a <= 8) return { id: "YoungChild", label: "Young Child Age: 6–8" };
    if (a <= 12) return { id: "PreTeen", label: "Pre-Teen Age: 9–12" };
    if (a <= 17) return { id: "Teen", label: "Teen Age: 13–17" };
    if (a <= 24) return { id: "YoungAdult", label: "Young Adult Age: 18–24" };
    if (a <= 34) return { id: "Adult", label: "Adult Age: 25–34" };
    if (a <= 44) return { id: "MidAdult", label: "Mid Adult Age: 35–44" };
    if (a <= 54) return { id: "OlderAdult", label: "Older Adult Age: 45–54" };
    if (a <= 64) return { id: "Senior", label: "Senior Age: 55–64" };
    if (a <= 74) return { id: "Elderly", label: "Elderly Age: 65–74" };
    return { id: "VeryElderly", label: "Very Elderly Age: 75+" };
  }

  const key = profile?.ageKey || "unknown";
  const text = profile?.ageText || "Unknown age group";
  return { id: key, label: text };
}

/* =========================================================
   ✅ PROMPT BUILDER
   ========================================================= */
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
      "For health concerns: advise seeing a parent/guardian and clinician when needed.",
    ],
    Child: [
      "Use simple words and short steps.",
      "Ask 1 question at a time.",
      "Be friendly and encouraging.",
      "For health: suggest telling a parent/guardian for serious symptoms.",
    ],
    YoungChild: [
      "Use simple explanations with small steps and examples.",
      "Be encouraging and clear.",
      "Avoid complex medical wording; no diagnosis.",
    ],
    PreTeen: [
      "Use clear explanations, short steps, and examples.",
      "Encourage good habits and safety.",
      "For health: suggest talking to a trusted adult if serious.",
    ],
    Teen: [
      "Use clear, respectful tone.",
      "Give actionable steps and reasoning.",
      "For health/mental wellbeing: suggest trusted adult/professional when needed.",
    ],
    YoungAdult: ["Use practical, direct guidance.", "Offer options and pros/cons.", "No diagnosis or prescribing."],
    Adult: ["Practical, efficient guidance.", "Include options, trade-offs, and next steps.", "No diagnosis; recommend clinician when appropriate."],
    MidAdult: ["Practical, direct guidance with safety emphasis.", "Include options, trade-offs, and next steps."],
    OlderAdult: ["Calm, respectful guidance.", "Safety first; avoid medication advice.", "Recommend professional care when appropriate."],
    Senior: ["Respectful and calm.", "Prioritize safety and easy steps.", "Recommend clinician when appropriate."],
    Elderly: ["Respectful and calm.", "Prioritize safety; keep instructions easy.", "Recommend clinician when appropriate."],
    VeryElderly: ["Respectful and calm.", "Keep instructions simple and safe.", "Recommend clinician when appropriate."],
    unknown: ["Be clear, safe, and ask a quick clarifying question if age matters."],
  };

  const ageStyle = ageStyleMap[age.id] || ageStyleMap.unknown;

  const baseSafety = [
    "Never claim you are a doctor. No diagnosis. No prescribing medication.",
    "If user may be in danger or has severe symptoms, advise seeking professional help immediately.",
    "Be polite and helpful.",
  ];

  if (isQuiz) {
    const quizDomainRules =
      {
        healthcare: [
          "Quiz must be educational and general (wellness, first aid basics, nutrition, hygiene, safety).",
          "Do NOT give diagnosis or personalized medical treatment advice.",
        ],
        sports: [
          "Quiz may include fitness basics, training principles, injury prevention basics, sports rules, anatomy basics.",
        ],
        education: ["Quiz may include general school topics based on the user's topic (math, science, language, history, etc.)."],
        community: ["Quiz may include civics, empathy, communication, safety, digital citizenship, teamwork, basic social skills."],
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
      '      "choices": ["choice1","choice2","choice3","choice4"],',
      '      "answerIndex": 1,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      "4) Always 4 choices. answerIndex must be 1..4 (IMPORTANT).",
      "5) Do NOT prefix choices with 'A)', 'B)'. Choices must be plain text only.",
      "6) NEVER use placeholders like 'Option 1', 'Option 2', '—', '-', '_'. Put real answers.",
      "",
      "Domain safety:",
      ...quizDomainRules.map((x) => `- ${x}`),
      "",
      "General safety:",
      ...baseSafety.map((x) => `- ${x}`),
    ].join("\n");
  }

  const typePrompt =
    {
      healthcare: [
        "You are a safe healthcare assistant for general wellness.",
        "Give simple self-care tips, prevention, and when-to-see-a-doctor guidance.",
        "If the question is urgent (chest pain, trouble breathing, fainting, severe bleeding, suicidal thoughts), advise emergency services right away.",
      ],
      sports: ["You are a friendly sports & fitness coach.", "Give safe workouts, warm-up/cool-down, and progressive plans.", "Ask about goal, experience, injuries, and available equipment when needed."],
      education: ["You are a patient tutor.", "Explain step-by-step, then give short practice questions and check answers.", "Adapt difficulty to the learner."],
      community: ["You are a kind supportive companion.", "Be encouraging, listen, and offer practical coping/helpful steps.", "If user expresses self-harm or immediate danger, encourage reaching out to local emergency help and trusted people."],
    }[type] || ["You are a helpful assistant."];

  return [
    `User: ${name}`,
    `Age group: ${age.label}`,
    "",
    ...typePrompt,
    "",
    "Age-appropriate style rules:",
    ...ageStyle.map((x) => `- ${x}`),
    "",
    "Safety rules:",
    ...baseSafety.map((x) => `- ${x}`),
  ].join("\n");
}

/* =========================================================
   ✅ HELPERS
   ========================================================= */
function safeJSONParse(s, fallback = null) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stripLetterPrefix(s) {
  return String(s || "")
    .trim()
    .replace(/^[A-D]\s*[\)\.\-:]\s*/i, "")
    .trim();
}

function isBadChoice(s) {
  const t = String(s || "").trim();
  if (!t) return true;
  if (/^[A-D]$/i.test(t)) return true;
  if (/^option\s*\d+$/i.test(t)) return true;
  if (t === "—" || t === "-" || t === "_" || t === "–") return true;
  if (t.length <= 1) return true;
  return false;
}

function sanitizeChoices(rawChoices) {
  const choices = (Array.isArray(rawChoices) ? rawChoices : []).map((x) => stripLetterPrefix(x));
  for (let i = 0; i < choices.length; i++) {
    if (isBadChoice(choices[i])) choices[i] = "—";
  }
  const out = choices.slice(0, 4);
  while (out.length < 4) out.push("—");
  return out;
}

function hasPlaceholders(choices) {
  return (choices || []).some((c) => isBadChoice(c));
}

// ---------- index convert ----------
function toOneBasedIndex(ai) {
  // accepts 0..3 or 1..4; output 1..4
  const n = Number(ai);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 4) return n;
  if (n >= 0 && n <= 3) return n + 1;
  return null;
}

function toZeroBasedIndex(ai) {
  // output 0..3
  const n = Number(ai);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 3) return n;
  if (n >= 1 && n <= 4) return n - 1;
  return null;
}

/* =========================================================
   ✅ NORMALIZE QUIZ JSON (FORCE 1..4 OUTPUT)
   - Accept model output 0..3 or 1..4
   - Always return 1..4
   ========================================================= */
function detectIndexBaseFromAll(questions) {
  const idxs = questions
    .map((q) => (Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null))
    .filter((x) => x !== null);

  if (!idxs.length) return "one"; // default: one-based
  if (idxs.some((x) => x === 0)) return "zero";
  if (idxs.some((x) => x === 4)) return "one";
  // ambiguous (1..3 only): assume one-based because UI uses 1..4
  return "one";
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;

  const qsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  if (!qsRaw.length) return null;

  const base = detectIndexBaseFromAll(qsRaw);

  const clean = qsRaw
    .map((q) => {
      const rawChoices = Array.isArray(q.choices) ? q.choices : Array.isArray(q.options) ? q.options : [];
      const choices = sanitizeChoices(rawChoices);

      let ai = Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null;
      if (ai === null && Number.isFinite(Number(q.correctIndex))) ai = Number(q.correctIndex);

      // convert to one-based
      if (ai !== null) {
        if (base === "zero") ai = ai + 1; // 0..3 -> 1..4
        ai = clamp(ai, MIN_INDEX, MAX_INDEX);
      }

      const question = String(q.question || q.q || "").trim();
      const explanation = String(q.explanation || q.reason || "").trim();

      return { question, choices, answerIndex: ai, explanation };
    })
    .filter((q) => q.question && Array.isArray(q.choices) && q.choices.length === 4 && q.answerIndex !== null);

  if (!clean.length) return null;
  return { questions: clean };
}

/* =========================================================
   ✅ GENERATE DISTRACTORS (for math)
   ========================================================= */
function makeIntChoices(correct) {
  const c = Number(correct);
  const pool = uniq([c, c + 1, c - 1, c + 2, c - 2, c + 3, c - 3, c * 2, Math.max(0, c - 5)]).filter((x) =>
    Number.isFinite(x)
  );
  const out = [c];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(c + out.length);
  return out.sort(() => Math.random() - 0.5);
}

/* =========================================================
   ✅ MATH SOLVER (EN + TH + SIMPLE EXPRESSIONS)
   ========================================================= */
function computeMathFromQuestionText(qText) {
  const raw = String(qText || "").trim();

  // normalize common symbols
  const t = raw
    .replace(/＝/g, "=")
    .replace(/[×xX]/g, "x")
    .replace(/[÷]/g, "/")
    .replace(/[−–]/g, "-");

  // 0) Pure expression: "9 x 8 = ?" , "7-3=?", "12/4=?"
  let m = t.match(/^\s*(\d+(?:\.\d+)?)\s*([+\-*/x])\s*(\d+(?:\.\d+)?)\s*(?:=\s*\?)?\s*\?*\s*$/i);
  if (m) {
    const a = Number(m[1]);
    const op = m[2].toLowerCase();
    const b = Number(m[3]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      let ans;
      if (op === "+") ans = a + b;
      if (op === "-") ans = a - b;
      if (op === "x" || op === "*") ans = a * b;
      if (op === "/" && b !== 0) ans = a / b;

      if (ans !== undefined && ans !== null && Number.isFinite(ans)) {
        const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
        return {
          kind: "number",
          answerText: ansStr,
          answerNum: Number.isInteger(ans) ? ans : null,
          explanation: `${a} ${op === "x" ? "×" : op} ${b} = ${ansStr}`,
        };
      }
    }
  }

  // Thai word forms
  // หาร A ด้วย B
  m = t.match(/หาร\s*(\d+(?:\.\d+)?)\s*ด้วย\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      const ans = a / b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return { kind: "number", answerText: ansStr, answerNum: Number.isInteger(ans) ? ans : null, explanation: `การหาร ${a} ด้วย ${b} คือ ${ansStr}` };
    }
  }

  // บวก A และ B
  m = t.match(/บวก\s*(\d+(?:\.\d+)?)\s*(?:และ|\+)\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a + b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return { kind: "number", answerText: ansStr, answerNum: Number.isInteger(ans) ? ans : null, explanation: `การบวก ${a} และ ${b} คือ ${ansStr}` };
    }
  }

  // ลบ A ด้วย/กับ B
  m = t.match(/ลบ\s*(\d+(?:\.\d+)?)\s*(?:ด้วย|กับ)?\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a - b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return { kind: "number", answerText: ansStr, answerNum: Number.isInteger(ans) ? ans : null, explanation: `การลบ ${a} ด้วย ${b} คือ ${ansStr}` };
    }
  }

  // คูณ A และ B
  m = t.match(/คูณ\s*(\d+(?:\.\d+)?)\s*(?:และ|\*|x)\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a * b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return { kind: "number", answerText: ansStr, answerNum: Number.isInteger(ans) ? ans : null, explanation: `การคูณ ${a} และ ${b} คือ ${ansStr}` };
    }
  }

  return null;
}

/* =========================================================
   ✅ SIMPLE HEALTH/FIRST AID REPAIR
   ========================================================= */
function computeFirstAidFromQuestionText(qText) {
  const t = norm(qText);

  // choking
  if (t.includes("chok") || t.includes("สำลัก") || t.includes("ติดคอ")) {
    const correct = "Back slaps";
    const choices = ["Back slaps", "Give them a drink of water", "Tell them to lie down", "Wait and do nothing"];
    return {
      answerText: correct,
      choices,
      explanation: "Back slaps are a basic first-aid step for choking (and call emergency help if severe).",
    };
  }

  // bleeding from a cut
  if (t.includes("bleed") || t.includes("cut") || t.includes("เลือด") || t.includes("บาดแผล")) {
    const correct = "Apply gentle pressure with a bandage";
    const choices = ["Apply gentle pressure with a bandage", "Apply heat to the area", "Apply soap to the area", "Leave it uncovered"];
    return {
      answerText: correct,
      choices,
      explanation: "Gentle direct pressure helps stop bleeding.",
    };
  }

  return null;
}

/* =========================================================
   ✅ LLM REPAIR WHOLE QUESTION (when placeholders)
   - returns {question, choices[4], answerIndex(1..4), explanation}
   ========================================================= */
async function regenerateQuestionLLM(question, quizType) {
  if (!client) return null;

  const sys = [
    "You are a quiz repair tool.",
    "You MUST output ONLY valid JSON.",
    "Schema:",
    '{ "question": "string", "choices": ["a","b","c","d"], "answerIndex": 1, "explanation": "one short sentence" }',
    "Rules:",
    "- choices must be REAL answers (no 'Option 1', no dashes).",
    "- exactly 4 choices.",
    "- answerIndex must be 1..4 and must point to the correct choice.",
    "- keep the same meaning as the original question.",
    `Quiz type: ${quizType}`,
    "",
    "Original question:",
    question,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: sys }],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const txt = completion?.choices?.[0]?.message?.content?.trim() || "";
    const obj = safeJSONParse(txt, null);
    if (!obj) return null;

    const q = String(obj.question || "").trim();
    const c = sanitizeChoices(obj.choices);
    const ai = toOneBasedIndex(obj.answerIndex);
    const exp = String(obj.explanation || "").trim();

    if (!q || c.length !== 4 || !ai) return null;
    if (hasPlaceholders(c)) return null;

    return { question: q, choices: c, answerIndex: clamp(ai, 1, 4), explanation: exp };
  } catch (_) {
    return null;
  }
}

/* =========================================================
   ✅ VERIFY ANSWER INDEX (non-math, keep choices)
   - returns {answerIndex(1..4), explanation}
   ========================================================= */
async function verifyAnswerIndexLLM(question, choices, quizType) {
  if (!client) return null;

  const sys = [
    "You are an answer checker for a multiple-choice quiz.",
    "Return ONLY valid JSON.",
    'Schema: { "answerIndex": 1, "explanation": "one short sentence" }',
    "answerIndex must be 1..4 and must correspond to the correct choice.",
    "If none are perfect, choose the best one anyway and explain briefly.",
    `Quiz type: ${quizType}`,
  ].join("\n");

  const user = JSON.stringify({ question, choices });

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const txt = completion?.choices?.[0]?.message?.content?.trim() || "";
    const obj = safeJSONParse(txt, null);
    if (!obj) return null;

    const ai = toOneBasedIndex(obj.answerIndex);
    if (!ai) return null;

    const exp = String(obj.explanation || "").trim();
    return { answerIndex: clamp(ai, 1, 4), explanation: exp };
  } catch (_) {
    return null;
  }
}

/* =========================================================
   ✅ REPAIR SINGLE QUESTION (FORCE 1..4 OUTPUT)
   ========================================================= */
async function repairQuizQuestion(q, quizType) {
  let fixed = {
    question: String(q.question || "").trim(),
    choices: sanitizeChoices(q.choices),
    // convert whatever to one-based
    answerIndex: clamp(toOneBasedIndex(q.answerIndex) ?? 1, 1, 4),
    explanation: String(q.explanation || "").trim(),
  };

  // If placeholder choices -> try regenerate immediately
  if (hasPlaceholders(fixed.choices)) {
    const regen = await regenerateQuestionLLM(fixed.question, quizType);
    if (regen) return regen;
  }

  // 1) Healthcare first aid hard-fix
  if (quizType === "healthcare_quiz") {
    const fa = computeFirstAidFromQuestionText(fixed.question);
    if (fa) {
      fixed.choices = fa.choices;
      const idx0 = fixed.choices.findIndex((c) => norm(c) === norm(fa.answerText));
      fixed.answerIndex = clamp((idx0 >= 0 ? idx0 + 1 : 1), 1, 4);
      fixed.explanation = fa.explanation;
      return fixed;
    }
  }

  // 2) Math hard-fix (works for EVERY quiz type)
  const solved = computeMathFromQuestionText(fixed.question);
  if (solved) {
    const correctText = solved.answerText;

    // if correct exists in choices -> set answerIndex
    const idx0 = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    if (idx0 >= 0 && !isBadChoice(fixed.choices[idx0])) {
      fixed.answerIndex = clamp(idx0 + 1, 1, 4);
      fixed.explanation = solved.explanation || fixed.explanation;
      return fixed;
    }

    // rebuild choices with correct included
    const n = solved.answerNum;
    if (Number.isFinite(n)) {
      const base = makeIntChoices(n).map((x) => String(x));
      fixed.choices = base;
      const idx0b = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
      fixed.answerIndex = clamp((idx0b >= 0 ? idx0b + 1 : 1), 1, 4);
      fixed.explanation = solved.explanation || fixed.explanation;
      return fixed;
    }

    // fallback decimal text
    const correct = correctText;
    const num = Number(correct);
    const distract = uniq([
      correct,
      Number.isFinite(num) ? String(num + 1) : correct,
      Number.isFinite(num) ? String(num - 1) : correct,
      Number.isFinite(num) ? String(num + 2) : correct,
      Number.isFinite(num) ? String(num - 2) : correct,
    ]).filter((x) => !isBadChoice(x));

    while (distract.length < 4) distract.push(correct);
    fixed.choices = distract.slice(0, 4).sort(() => Math.random() - 0.5);
    const idx0c = fixed.choices.findIndex((c) => norm(c) === norm(correct));
    fixed.answerIndex = clamp((idx0c >= 0 ? idx0c + 1 : 1), 1, 4);
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  // 3) Non-math: verify answerIndex if explanation weak / suspicious
  const shouldVerify = !fixed.explanation || fixed.explanation.length < 6;
  if (shouldVerify) {
    const v = await verifyAnswerIndexLLM(fixed.question, fixed.choices, quizType);
    if (v) {
      fixed.answerIndex = clamp(v.answerIndex, 1, 4);
      if (v.explanation) fixed.explanation = v.explanation;
    }
  }

  // 4) Final guard: ensure answerIndex points to non-placeholder
  const idx0final = clamp(fixed.answerIndex - 1, 0, 3);
  if (isBadChoice(fixed.choices[idx0final])) {
    const firstGood = fixed.choices.findIndex((c) => !isBadChoice(c));
    fixed.answerIndex = clamp((firstGood >= 0 ? firstGood + 1 : 1), 1, 4);
  }

  // 5) If still placeholders (rare) -> last attempt regenerate
  if (hasPlaceholders(fixed.choices)) {
    const regen2 = await regenerateQuestionLLM(fixed.question, quizType);
    if (regen2) return regen2;

    // absolute last fallback: put generic non-empty choices
    fixed.choices = ["True", "False", "Not sure", "Depends"];
    fixed.answerIndex = 1;
    if (!fixed.explanation) fixed.explanation = "Best available choice.";
  }

  return fixed;
}

/* =========================================================
   ✅ REPAIR QUIZ JSON (async)
   ========================================================= */
async function repairQuizJSON(quiz, quizType) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;
  const out = [];
  for (const q of quiz.questions) out.push(await repairQuizQuestion(q, quizType));
  return { questions: out };
}

/* =========================================================
   ✅ OPTIONAL: deterministic math quiz fallback
   ========================================================= */
function isLikelyMathTopic(payload) {
  const topic = String(payload?.topic || "").toLowerCase();
  const grade = String(payload?.gradeLevel || "").toLowerCase();
  const keys = [
    "math",
    "percentage",
    "percent",
    "discount",
    "sale",
    "division",
    "divide",
    "multiplication",
    "multiply",
    "area",
    "rectangle",
    "fraction",
    "decimal",
    "word problem",
    "ratio",
    // Thai
    "คณิต",
    "หาร",
    "บวก",
    "ลบ",
    "คูณ",
    "ทศนิยม",
    "เปอร์เซ็น",
  ];
  if (keys.some((k) => topic.includes(k))) return true;

  if (
    grade.includes("grade 1") ||
    grade.includes("grade 2") ||
    grade.includes("grade 3") ||
    grade.includes("grade 4") ||
    grade.includes("grade 5") ||
    grade.includes("grade 6")
  ) {
    if (topic.includes("number") || topic.includes("arithmetic") || topic.includes("basic")) return true;
  }
  return false;
}

function genMathQuestion() {
  const types = ["mul", "sub", "div", "add"];
  const pick = types[Math.floor(Math.random() * types.length)];

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  if (pick === "mul") {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    const ans = a * b;
    const choices = makeIntChoices(ans).map(String);
    return {
      question: `${a} × ${b} = ?`,
      choices,
      answerIndex: choices.indexOf(String(ans)) + 1, // ✅ 1..4
      explanation: `${a} × ${b} = ${ans}`,
    };
  }

  if (pick === "sub") {
    const a = randInt(5, 30);
    const b = randInt(1, 12);
    const ans = a - b;
    const choices = makeIntChoices(ans).map(String);
    return {
      question: `${a} - ${b} = ?`,
      choices,
      answerIndex: choices.indexOf(String(ans)) + 1,
      explanation: `${a} - ${b} = ${ans}`,
    };
  }

  if (pick === "div") {
    const b = randInt(2, 12);
    const ans = randInt(2, 12);
    const a = b * ans;
    const choices = makeIntChoices(ans).map(String);
    return {
      question: `${a} ÷ ${b} = ?`,
      choices,
      answerIndex: choices.indexOf(String(ans)) + 1,
      explanation: `${a} ÷ ${b} = ${ans}`,
    };
  }

  // add
  const a = randInt(1, 30);
  const b = randInt(1, 30);
  const ans = a + b;
  const choices = makeIntChoices(ans).map(String);
  return {
    question: `${a} + ${b} = ?`,
    choices,
    answerIndex: choices.indexOf(String(ans)) + 1,
    explanation: `${a} + ${b} = ${ans}`,
  };
}

function makeDeterministicMathQuiz(n) {
  const questions = [];
  for (let i = 0; i < n; i++) questions.push(genMathQuestion());
  return { questions };
}

/* =========================================================
   ✅ HANDLER
   ========================================================= */
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
        reply: "AI is not configured yet (missing GROQ_API_KEY). Please set it in your deployment environment.",
      });
    }

    const cleanHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
      : [];

    const system = buildSystemPrompt(type, profile);
    const isQuiz = typeof type === "string" && type.endsWith("_quiz");

    // parse quiz payload (user sends JSON)
    let quizPayload = null;
    if (isQuiz) quizPayload = safeJSONParse(userMsg, null);

    // ✅ deterministic math for education_quiz when topic looks math
    if (isQuiz && type === "education_quiz" && quizPayload && isLikelyMathTopic(quizPayload)) {
      const n = clamp(Number(quizPayload.numQuestions) || 8, 3, 15);
      const quiz = makeDeterministicMathQuiz(n);
      return res.status(200).json({ reply: JSON.stringify(quiz) });
    }

    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: system }, ...(isQuiz ? [] : cleanHistory), { role: "user", content: userMsg }],
      temperature: isQuiz ? 0.25 : 0.7,
    };

    if (isQuiz) payload.response_format = { type: "json_object" };

    const completion = await client.chat.completions.create(payload);
    const replyText = completion?.choices?.[0]?.message?.content?.trim() || "…";

    // ✅ Quiz: normalize + repair (FORCE answerIndex 1..4)
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);

      if (normalized) {
        const repaired = await repairQuizJSON(normalized, type);

        // Final harden: ensure choices ok + answerIndex 1..4 always valid
        const hardened = {
          questions: repaired.questions.map((q) => {
            const c = sanitizeChoices(q.choices);

            // if still placeholders -> keep minimal safe text
            let choices = c;
            if (hasPlaceholders(choices)) choices = ["True", "False", "Not sure", "Depends"];

            let ai = toOneBasedIndex(q.answerIndex) ?? 1;
            ai = clamp(ai, 1, 4);

            // ensure not pointing to bad choice
            const idx0 = ai - 1;
            if (isBadChoice(choices[idx0])) {
              const firstGood = choices.findIndex((x) => !isBadChoice(x));
              ai = clamp((firstGood >= 0 ? firstGood + 1 : 1), 1, 4);
            }

            return {
              question: String(q.question || "").trim(),
              choices,
              answerIndex: ai, // ✅ 1..4 only
              explanation: String(q.explanation || "").trim(),
            };
          }),
        };

        return res.status(200).json({ reply: JSON.stringify(hardened) });
      }

      // fallback deterministic ONLY for education quiz
      if (type === "education_quiz") {
        const n = clamp(Number(quizPayload?.numQuestions) || 8, 3, 15);
        const quiz = makeDeterministicMathQuiz(n);
        return res.status(200).json({ reply: JSON.stringify(quiz) });
      }
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(200).json({ reply: "AI is temporarily unavailable. Please try again in a moment." });
  }
};
