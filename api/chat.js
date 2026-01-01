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
    YoungAdult: [
      "Use practical, direct guidance.",
      "Offer options and pros/cons.",
      "No diagnosis or prescribing.",
    ],
    Adult: [
      "Practical, efficient guidance.",
      "Include options, trade-offs, and next steps.",
      "No diagnosis; recommend clinician when appropriate.",
    ],
    MidAdult: [
      "Practical, direct guidance with safety emphasis.",
      "Include options, trade-offs, and next steps.",
    ],
    OlderAdult: [
      "Calm, respectful guidance.",
      "Safety first; avoid medication advice.",
      "Recommend professional care when appropriate.",
    ],
    Senior: [
      "Respectful and calm.",
      "Prioritize safety and easy steps.",
      "Recommend clinician when appropriate.",
    ],
    Elderly: [
      "Respectful and calm.",
      "Prioritize safety; keep instructions easy.",
      "Recommend clinician when appropriate.",
    ],
    VeryElderly: [
      "Respectful and calm.",
      "Keep instructions simple and safe.",
      "Recommend clinician when appropriate.",
    ],
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
    ...ageStyle.map((x) => `- ${x}`),
    "",
    "Safety rules:",
    ...baseSafety.map((x) => `- ${x}`),
  ].join("\n");
}

/* =========================================================
   ✅ QUIZ HELPERS (parse/repair)
   ========================================================= */
function safeJSONParse(s, fallback = null) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;
  const qs = Array.isArray(obj.questions) ? obj.questions : [];
  const clean = qs
    .map((q) => ({
      question: String(q.question || q.q || "").trim(),
      choices: Array.isArray(q.choices)
        ? q.choices.map((x) => String(x).trim())
        : Array.isArray(q.options)
        ? q.options.map((x) => String(x).trim())
        : [],
      answerIndex: Number.isFinite(Number(q.answerIndex))
        ? Number(q.answerIndex)
        : Number.isFinite(Number(q.correctIndex))
        ? Number(q.correctIndex)
        : null,
      explanation: String(q.explanation || q.reason || "").trim(),
    }))
    .filter((q) => q.question && q.choices.length >= 2 && q.answerIndex !== null);

  if (!clean.length) return null;
  return { questions: clean };
}

/* =========================================================
   ✅ MATH SOLVER (regex-based) + repair choices
   ========================================================= */
function toMoney2(x) {
  // currency should be 2 decimals
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return `$${n.toFixed(2)}`;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function makeIntChoices(correct) {
  const c = Number(correct);
  const pool = uniq([
    c,
    c + 1,
    c - 1,
    c + 2,
    c - 2,
    c + 3,
    c - 3,
    c * 2,
    Math.max(0, c - 5),
  ]).filter((x) => Number.isFinite(x));
  // pick 4 distinct with correct included
  const out = [c];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(c + out.length);
  // shuffle
  return out.sort(() => Math.random() - 0.5);
}

function makePercentChoices(correctPct) {
  const c = Number(correctPct);
  const pool = uniq([c, c - 10, c + 10, c - 17, c + 17, c - 25, c + 25, c - 5, c + 5])
    .map((x) => clamp(Math.round(x), 0, 100))
    .filter((x, i, a) => a.indexOf(x) === i);

  const out = [Math.round(c)];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(clamp(out[out.length - 1] + 1, 0, 100));
  return out.sort(() => Math.random() - 0.5).map((x) => `${x}%`);
}

function makeMoneyChoices(correctMoneyNumber) {
  const c = Number(correctMoneyNumber);
  const cents = (d) => Math.round(d * 100) / 100;

  const pool = uniq([
    c,
    cents(c + 0.05),
    cents(c - 0.05),
    cents(c + 0.10),
    cents(c - 0.10),
    cents(c + 0.25),
    cents(c - 0.25),
  ]).filter((x) => Number.isFinite(x) && x > 0);

  const out = [c];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(cents(c + 0.01 * out.length));
  return out.sort(() => Math.random() - 0.5).map(toMoney2);
}

function computeMathFromQuestionText(qText) {
  const t = String(qText || "");

  // 1) Rectangle area: length X cm and width Y cm
  let m = t.match(/length\s+of\s+(\d+(?:\.\d+)?)\s*cm.*width\s+of\s+(\d+(?:\.\d+)?)\s*cm/i);
  if (m) {
    const L = Number(m[1]);
    const W = Number(m[2]);
    if (Number.isFinite(L) && Number.isFinite(W)) {
      const ans = L * W;
      return {
        kind: "int",
        answer: Math.round(ans),
        answerStr: `${Math.round(ans)} square cm`,
        explanation: `To find the area of a rectangle, multiply length by width: ${L} × ${W} = ${Math.round(ans)}.`,
      };
    }
  }

  // 2) Division equally: 48 pieces and 8 friends
  m = t.match(/have\s+(\d+)\s+pieces.*\s(\d+)\s+friends/i);
  if (m) {
    const total = Number(m[1]);
    const ppl = Number(m[2]);
    if (Number.isFinite(total) && Number.isFinite(ppl) && ppl !== 0) {
      const ans = total / ppl;
      if (Number.isFinite(ans)) {
        return {
          kind: "int",
          answer: Math.round(ans),
          answerStr: `${Math.round(ans)} pieces`,
          explanation: `Divide total pieces by friends: ${total} ÷ ${ppl} = ${Math.round(ans)}.`,
        };
      }
    }
  }

  // 3) "If it takes 5 apples ... have 15 apples ... how many pies"
  m = t.match(/takes\s+(\d+)\s+apples.*have\s+(\d+)\s+apples.*how\s+many\s+pies/i);
  if (m) {
    const per = Number(m[1]);
    const total = Number(m[2]);
    if (Number.isFinite(per) && Number.isFinite(total) && per !== 0) {
      const ans = Math.floor(total / per);
      return {
        kind: "int",
        answer: ans,
        answerStr: String(ans),
        explanation: `Divide apples by apples per pie: ${total} ÷ ${per} = ${ans}.`,
      };
    }
  }

  // 4) Pencil divided: 15 cm divided into 5 parts
  m = t.match(/(\d+)\s*cm.*divided\s+into\s+(\d+)\s+parts/i);
  if (m) {
    const len = Number(m[1]);
    const parts = Number(m[2]);
    if (Number.isFinite(len) && Number.isFinite(parts) && parts !== 0) {
      const ans = len / parts;
      // show as integer if clean
      const nice = Number.isInteger(ans) ? String(ans) : String(ans);
      return {
        kind: "int",
        answer: Number.isInteger(ans) ? ans : ans,
        answerStr: nice,
        explanation: `Divide total length by parts: ${len} ÷ ${parts} = ${ans}.`,
      };
    }
  }

  // 5) Percent filled: can hold X, already Y => (Y/X)*100
  m = t.match(/hold\s+(\d+)\s+gallons.*if\s+(\d+)\s+gallons.*what\s+percentage/i);
  if (m) {
    const cap = Number(m[1]);
    const inTank = Number(m[2]);
    if (Number.isFinite(cap) && Number.isFinite(inTank) && cap !== 0) {
      const pct = (inTank / cap) * 100;
      const ans = Math.round(pct);
      return {
        kind: "percent",
        answer: ans,
        answerStr: `${ans}%`,
        explanation: `Percentage filled = (${inTank} ÷ ${cap}) × 100 = ${Math.round(pct)}%.`,
      };
    }
  }

  // 6) Simple subtraction: "What is 7 - 2?"
  m = t.match(/what\s+is\s+(\d+)\s*[-−]\s*(\d+)\s*\?/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a - b;
      return {
        kind: "int",
        answer: ans,
        answerStr: String(ans),
        explanation: `Subtract ${b} from ${a}: ${a} − ${b} = ${ans}.`,
      };
    }
  }

  // 7) Discount: costs $2.50, 15% off
  m = t.match(/costs?\s*\$?(\d+(?:\.\d+)?).*(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (m) {
    const price = Number(m[1]);
    const pct = Number(m[2]);
    if (Number.isFinite(price) && Number.isFinite(pct)) {
      const sale = price * (1 - pct / 100);
      const rounded = Math.round(sale * 100) / 100;
      return {
        kind: "money",
        answer: rounded,
        answerStr: toMoney2(rounded),
        explanation: `${pct}% off means pay ${100 - pct}%: $${price.toFixed(2)} × ${(1 - pct / 100).toFixed(2)} ≈ ${toMoney2(
          rounded
        )}.`,
      };
    }
  }

  return null;
}

function repairQuizMath(q) {
  // Ensure choices include the true answer when solvable
  const solved = computeMathFromQuestionText(q.question);
  if (!solved) return q;

  let choices = Array.isArray(q.choices) ? q.choices.map((x) => String(x).trim()) : [];
  if (choices.length < 4) {
    while (choices.length < 4) choices.push("");
  }
  choices = choices.slice(0, 4);

  // Build correct choice text based on kind
  let correctText = solved.answerStr;

  // Normalize existing choices to compare loosely
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  const idxExisting = choices.findIndex((c) => norm(c) === norm(correctText));

  if (idxExisting >= 0) {
    q.answerIndex = idxExisting;
    q.explanation = solved.explanation || q.explanation;
    q.choices = choices;
    return q;
  }

  // If not exist: rebuild all choices for that kind
  if (solved.kind === "money") {
    const base = makeMoneyChoices(solved.answer);
    choices = base;
    correctText = toMoney2(solved.answer);
  } else if (solved.kind === "percent") {
    choices = makePercentChoices(solved.answer);
    correctText = `${Math.round(solved.answer)}%`;
  } else {
    // int (or numeric)
    const c = Number(solved.answer);
    const base = makeIntChoices(Number.isFinite(c) ? Math.round(c) : 0);
    // If question expects "square cm"/"pieces" etc, keep suffix style:
    if (/\bsquare\s+cm\b/i.test(correctText)) {
      choices = base.map((x) => `${x} square cm`);
      correctText = `${Math.round(c)} square cm`;
    } else if (/\bpieces\b/i.test(correctText)) {
      choices = base.map((x) => `${x} pieces`);
      correctText = `${Math.round(c)} pieces`;
    } else {
      choices = base.map((x) => String(x));
      correctText = String(Math.round(c));
    }
  }

  const answerIndex = choices.findIndex((c) => norm(c) === norm(correctText));
  q.choices = choices;
  q.answerIndex = answerIndex >= 0 ? answerIndex : 0;
  q.explanation = solved.explanation || q.explanation || "Because it matches the correct calculation.";
  return q;
}

function repairQuizJSON(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;
  quiz.questions = quiz.questions.map((q) => {
    const fixed = {
      question: String(q.question || "").trim(),
      choices: Array.isArray(q.choices) ? q.choices.map((x) => String(x)) : [],
      answerIndex: Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : 0,
      explanation: String(q.explanation || "").trim(),
    };

    // Ensure 4 choices
    if (fixed.choices.length !== 4) {
      fixed.choices = fixed.choices.slice(0, 4);
      while (fixed.choices.length < 4) fixed.choices.push("—");
    }

    // Ensure answerIndex in range
    if (fixed.answerIndex < 0 || fixed.answerIndex > 3) fixed.answerIndex = 0;

    // ✅ attempt to solve/repair common math errors
    return repairQuizMath(fixed);
  });
  return quiz;
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
  ];
  if (keys.some((k) => topic.includes(k))) return true;
  if (grade.includes("grade 1") || grade.includes("grade 2") || grade.includes("grade 3") || grade.includes("grade 4") || grade.includes("grade 5") || grade.includes("grade 6")) {
    // many elementary "Education" quizzes are math; allow
    if (topic.includes("number") || topic.includes("arithmetic") || topic.includes("basic")) return true;
  }
  return false;
}

function genMathQuestion() {
  const types = ["rect_area", "share", "percent_fill", "discount", "subtract", "pies"];
  const pick = types[Math.floor(Math.random() * types.length)];

  if (pick === "rect_area") {
    const L = 2 + Math.floor(Math.random() * 9); // 2..10
    const W = 2 + Math.floor(Math.random() * 9);
    const ans = L * W;
    const choices = makeIntChoices(ans).map((x) => `${x} square cm`);
    const answerIndex = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A rectangle has a length of ${L} cm and a width of ${W} cm. What is its area?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `Area = length × width = ${L} × ${W} = ${ans}.`,
    };
  }

  if (pick === "share") {
    const ppl = 2 + Math.floor(Math.random() * 9); // 2..10
    const each = 2 + Math.floor(Math.random() * 9); // 2..10
    const total = ppl * each;
    const ans = each;
    const choices = makeIntChoices(ans).map((x) => `${x} pieces`);
    const answerIndex = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A group of friends want to share some candy equally. If they have ${total} pieces of candy and there are ${ppl} friends, how many pieces of candy will each friend get?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `${total} ÷ ${ppl} = ${ans}.`,
    };
  }

  if (pick === "percent_fill") {
    const cap = 120 + Math.floor(Math.random() * 9) * 20; // 120..280 step 20
    const inTank = cap / 2; // always 50% (simple + guaranteed)
    const ans = Math.round((inTank / cap) * 100);
    const choices = makePercentChoices(ans);
    const answerIndex = choices.findIndex((c) => c === `${ans}%`);
    return {
      question: `A water tank can hold ${cap} gallons of water. If ${inTank} gallons of water are already in the tank, what percentage of the tank is filled?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `(${inTank} ÷ ${cap}) × 100 = ${ans}%.`,
    };
  }

  if (pick === "discount") {
    const price = (2 + Math.floor(Math.random() * 10)) + 0.5; // x.50
    const pct = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
    const sale = Math.round(price * (1 - pct / 100) * 100) / 100;
    const ansText = toMoney2(sale);
    const choices = makeMoneyChoices(sale);
    const answerIndex = choices.findIndex((c) => c === ansText);
    return {
      question: `A shop has a sale. An item normally costs $${price.toFixed(2)}, but it's on sale for ${pct}% off. How much will you pay during the sale?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `Pay ${100 - pct}%: $${price.toFixed(2)} × ${(1 - pct / 100).toFixed(2)} ≈ ${ansText}.`,
    };
  }

  if (pick === "subtract") {
    const a = 6 + Math.floor(Math.random() * 14); // 6..19
    const b = 1 + Math.floor(Math.random() * 5); // 1..5
    const ans = a - b;
    const base = makeIntChoices(ans);
    const choices = base.map((x, i) => `${String.fromCharCode(65 + i)}) ${x}`);
    const answerIndex = base.indexOf(ans);
    return {
      question: `What is ${a} - ${b}?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `${a} − ${b} = ${ans}.`,
    };
  }

  // pies
  const per = [3, 4, 5][Math.floor(Math.random() * 3)];
  const pies = 2 + Math.floor(Math.random() * 4); // 2..5
  const total = per * pies;
  const ans = pies;
  const choices = makeIntChoices(ans).map(String);
  const answerIndex = choices.indexOf(String(ans));
  return {
    question: `If it takes ${per} apples to make a pie and you have ${total} apples, how many pies can you make?`,
    choices,
    answerIndex: answerIndex >= 0 ? answerIndex : 0,
    explanation: `${total} ÷ ${per} = ${ans}.`,
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

    // ✅ If quiz: try to parse payload to decide deterministic fallback
    let quizPayload = null;
    if (isQuiz) quizPayload = safeJSONParse(userMsg, null);

    // ✅ If it's education quiz + likely math topic => generate deterministic quiz (guaranteed correct)
    if (isQuiz && type === "education_quiz" && quizPayload && isLikelyMathTopic(quizPayload)) {
      const n = clamp(Number(quizPayload.numQuestions) || 8, 3, 15);
      const quiz = makeDeterministicMathQuiz(n);
      return res.status(200).json({ reply: JSON.stringify(quiz) });
    }

    // ✅ Base completion payload
    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: system }, ...(isQuiz ? [] : cleanHistory), { role: "user", content: userMsg }],
      temperature: isQuiz ? 0.25 : 0.7,
    };

    // ✅ Try force JSON object for quiz (may be ignored by Groq for some models, but harmless)
    if (isQuiz) payload.response_format = { type: "json_object" };

    const completion = await client.chat.completions.create(payload);
    const replyText = completion?.choices?.[0]?.message?.content?.trim() || "…";

    // ✅ If quiz: normalize + repair math errors
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);
      if (normalized) {
        const repaired = repairQuizJSON(normalized);
        return res.status(200).json({ reply: JSON.stringify(repaired) });
      }
      // if model returns junk: fallback deterministic for education
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
