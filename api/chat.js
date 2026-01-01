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
   ✅ CONFIG (IMPORTANT)
   - Your UI bug strongly suggests it expects answerIndex = 1..4 (NOT 0..3)
   - Also avoids the "0 is falsy" bug from frontend (answerIndex || 1)
   ========================================================= */
const ANSWER_INDEX_BASE = 1; // 1 => answerIndex is 1..4

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

    const answerIndexRule =
      ANSWER_INDEX_BASE === 1
        ? "4) Always 4 choices. answerIndex must be 1..4 (1-based)."
        : "4) Always 4 choices. answerIndex must be 0..3 (0-based).";

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
      '      "answerIndex": 1,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      answerIndexRule,
      "5) Keep language simple and match gradeLevel and age.",
      "6) For decimals/money: do NOT round up or down; keep the exact decimal result.",
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
   ✅ INDEX NORMALIZATION (fix the "shift" bug)
   - Accept both 0-based and 1-based from model, then convert to your UI base.
   ========================================================= */
function toUiAnswerIndex(rawAnswerIndex, choicesLen = 4) {
  const n = Number(rawAnswerIndex);
  if (!Number.isFinite(n)) return ANSWER_INDEX_BASE === 1 ? 1 : 0;

  // If UI wants 1..4:
  if (ANSWER_INDEX_BASE === 1) {
    // If model gave 0..3, convert to 1..4
    if (n >= 0 && n <= choicesLen - 1) return n + 1;
    // If model gave 1..4 already
    if (n >= 1 && n <= choicesLen) return n;
    return 1;
  }

  // If UI wants 0..3:
  if (n >= 1 && n <= choicesLen) return n - 1;
  if (n >= 0 && n <= choicesLen - 1) return n;
  return 0;
}

function from0BasedToUi(idx0) {
  return ANSWER_INDEX_BASE === 1 ? idx0 + 1 : idx0;
}

/* =========================================================
   ✅ EXACT DECIMAL HELPERS (NO ROUND UP/DOWN)
   ========================================================= */
function uniq(arr) {
  return Array.from(new Set(arr));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function parseDecimalToBigInt(s) {
  // returns { int: BigInt, scale: number } where value = int / 10^scale
  const str = String(s).trim();
  const m = str.match(/^([+-])?(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1n : 1n;
  const whole = m[2] || "0";
  const frac = m[3] || "";
  const scale = frac.length;
  const intStr = whole + frac;
  const int = BigInt(intStr || "0") * sign;
  return { int, scale };
}

function bigIntToDecimalString(int, scale) {
  // exact representation, no rounding
  const neg = int < 0n;
  let x = neg ? -int : int;

  const s = x.toString();
  if (scale <= 0) return (neg ? "-" : "") + s;

  const pad = scale - s.length;
  const full = pad > 0 ? "0".repeat(pad) + s : s;

  const i = full.length - scale;
  const whole = full.slice(0, i) || "0";
  const frac = full.slice(i);

  return (neg ? "-" : "") + whole + "." + frac;
}

function mulDecimal(aStr, bStr) {
  const A = parseDecimalToBigInt(aStr);
  const B = parseDecimalToBigInt(bStr);
  if (!A || !B) return null;
  return {
    int: A.int * B.int,
    scale: A.scale + B.scale,
  };
}

function mulDecimalByPercentPay(priceStr, payPercentInt) {
  // price * (payPercentInt/100) exact
  const P = parseDecimalToBigInt(priceStr);
  if (!P) return null;
  const pay = BigInt(payPercentInt);
  // (P.int / 10^P.scale) * (pay/100) = (P.int*pay) / (10^P.scale * 100)
  return {
    int: P.int * pay,
    scale: P.scale + 2, // +2 for /100
  };
}

function formatMoneyExact(priceStr, payPercentInt) {
  const r = mulDecimalByPercentPay(priceStr, payPercentInt);
  if (!r) return null;
  // keep EXACT decimals (no trimming) because user asked "ครบๆ ไม่เอาปัด"
  return "$" + bigIntToDecimalString(r.int, r.scale);
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
  const out = [c];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(c + out.length);
  return out.sort(() => Math.random() - 0.5);
}

function makePercentChoicesExact(correctStr) {
  // correctStr like "50%" or "33.333%"
  const c = String(correctStr).trim();
  const num = Number(c.replace("%", ""));
  const base = Number.isFinite(num) ? num : 50;

  const pool = uniq([
    base,
    base - 10,
    base + 10,
    base - 25,
    base + 25,
    base - 5,
    base + 5,
  ]).map((x) => clamp(x, 0, 100));

  const out = [base];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(clamp(out[out.length - 1] + 1, 0, 100));

  // keep formatting like integer percent unless it has decimals
  const fmt = (v) => {
    if (Number.isInteger(v)) return `${v}%`;
    // keep up to 3 decimals WITHOUT rounding (truncate)
    const s = String(v);
    const m = s.match(/^(\d+)(?:\.(\d+))?$/);
    if (!m) return `${v}%`;
    const d = (m[2] || "").slice(0, 3);
    return d.length ? `${m[1]}.${d}%` : `${m[1]}%`;
  };

  return out.sort(() => Math.random() - 0.5).map(fmt);
}

function makeMoneyChoicesExact(priceStr, pctOff) {
  // Build 4 choices around exact sale value, NO rounding.
  const pay = 100 - Number(pctOff);
  const correct = formatMoneyExact(priceStr, pay); // "$7.3125"
  if (!correct) return [correct, "$0.00", "$0.00", "$0.00"];

  // Try nearby “common mistakes” using exact math too
  const p = String(priceStr);
  const cands = uniq([
    correct,
    formatMoneyExact(p, pay + 1),
    formatMoneyExact(p, pay - 1),
    formatMoneyExact(p, pay + 5),
    formatMoneyExact(p, pay - 5),
    formatMoneyExact(p, 100), // no discount
    formatMoneyExact(p, 0), // free (edge)
  ]).filter(Boolean);

  // Ensure 4 distinct
  const out = [correct];
  for (const v of cands) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(correct); // fallback
  // If duplicates happen, patch with tiny variants by appending zeros isn't good; instead just keep.
  return out.slice(0, 4).sort(() => Math.random() - 0.5);
}

/* =========================================================
   ✅ MATH SOLVER (regex-based) + repair choices
   ========================================================= */
function computeMathFromQuestionText(qText) {
  const t = String(qText || "");

  // 1) Rectangle area: length X cm and width Y cm
  let m = t.match(/length\s+of\s+(\d+(?:\.\d+)?)\s*cm.*width\s+of\s+(\d+(?:\.\d+)?)\s*cm/i);
  if (m) {
    const L = Number(m[1]);
    const W = Number(m[2]);
    if (Number.isFinite(L) && Number.isFinite(W)) {
      const ans = L * W;
      const ansInt = Math.round(ans);
      return {
        kind: "int",
        answer: ansInt,
        answerStr: `${ansInt} square cm`,
        explanation: `To find the area of a rectangle, multiply length by width: ${L} × ${W} = ${ansInt}.`,
      };
    }
  }

  // 2) Division equally: have X pieces ... Y friends
  m = t.match(/have\s+(\d+)\s+pieces.*\s(\d+)\s+friends/i);
  if (m) {
    const total = Number(m[1]);
    const ppl = Number(m[2]);
    if (Number.isFinite(total) && Number.isFinite(ppl) && ppl !== 0) {
      const ans = total / ppl;
      const ansInt = Math.round(ans);
      return {
        kind: "int",
        answer: ansInt,
        answerStr: `${ansInt} pieces`,
        explanation: `Divide total pieces by friends: ${total} ÷ ${ppl} = ${ansInt}.`,
      };
    }
  }

  // 3) apples -> pies
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

  // 4) Pencil: 15 cm divided into 5 parts
  m = t.match(/(\d+)\s*cm.*divided\s+into\s+(\d+)\s+parts/i);
  if (m) {
    const len = Number(m[1]);
    const parts = Number(m[2]);
    if (Number.isFinite(len) && Number.isFinite(parts) && parts !== 0) {
      const ans = len / parts;
      // exact for integers; if not integer, show full JS (still ok for these simple quizzes)
      return {
        kind: "int",
        answer: Number.isInteger(ans) ? ans : ans,
        answerStr: Number.isInteger(ans) ? String(ans) : String(ans),
        explanation: `Divide total length by parts: ${len} ÷ ${parts} = ${ans}.`,
      };
    }
  }

  // 5) Percent filled: hold X, already Y => (Y/X)*100
  m = t.match(/hold\s+(\d+)\s+gallons.*if\s+(\d+)\s+gallons.*what\s+percentage/i);
  if (m) {
    const cap = Number(m[1]);
    const inTank = Number(m[2]);
    if (Number.isFinite(cap) && Number.isFinite(inTank) && cap !== 0) {
      const pct = (inTank / cap) * 100;
      // do NOT round; show exact up to 3 decimals without rounding (truncate)
      const s = String(pct);
      const mm = s.match(/^(\d+)(?:\.(\d+))?$/);
      const frac = (mm?.[2] || "").slice(0, 3);
      const pctStr = frac.length ? `${mm[1]}.${frac}%` : `${mm[1]}%`;
      return {
        kind: "percent",
        answer: pctStr,
        answerStr: pctStr,
        explanation: `Percentage filled = (${inTank} ÷ ${cap}) × 100 = ${pctStr}.`,
      };
    }
  }

  // 6) subtraction
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

  // 7) discount: costs $X, Y% off (support X with any decimals)
  m = t.match(/costs?\s*\$?(\d+(?:\.\d+)?).*(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (m) {
    const priceStr = m[1];
    const pct = Number(m[2]);
    if (Number.isFinite(pct)) {
      const pay = 100 - pct;
      const money = formatMoneyExact(priceStr, pay);
      if (money) {
        return {
          kind: "money",
          answer: { priceStr, pctOff: pct, money },
          answerStr: money,
          explanation: `Pay ${pay}% of $${priceStr}: $${priceStr} × ${pay}% = ${money}.`,
        };
      }
    }
  }

  return null;
}

function repairQuizMath(q) {
  const solved = computeMathFromQuestionText(q.question);
  if (!solved) return q;

  let choices = Array.isArray(q.choices) ? q.choices.map((x) => String(x).trim()) : [];
  while (choices.length < 4) choices.push("—");
  choices = choices.slice(0, 4);

  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();

  // If correct already exists, just fix answerIndex + explanation
  const idx0 = choices.findIndex((c) => norm(c) === norm(solved.answerStr));
  if (idx0 >= 0) {
    q.answerIndex = from0BasedToUi(idx0);
    q.explanation = solved.explanation || q.explanation;
    q.choices = choices;
    return q;
  }

  // Not exist => rebuild choices by kind
  if (solved.kind === "money") {
    const priceStr = solved.answer.priceStr;
    const pctOff = solved.answer.pctOff;
    choices = makeMoneyChoicesExact(priceStr, pctOff);
    const idx = choices.findIndex((c) => norm(c) === norm(solved.answerStr));
    q.choices = choices;
    q.answerIndex = from0BasedToUi(idx >= 0 ? idx : 0);
    q.explanation = solved.explanation || q.explanation || "Because it matches the correct calculation.";
    return q;
  }

  if (solved.kind === "percent") {
    choices = makePercentChoicesExact(solved.answerStr);
    const idx = choices.findIndex((c) => norm(c) === norm(solved.answerStr));
    q.choices = choices;
    q.answerIndex = from0BasedToUi(idx >= 0 ? idx : 0);
    q.explanation = solved.explanation || q.explanation || "Because it matches the correct calculation.";
    return q;
  }

  // int
  const c = Number(solved.answer);
  const base = makeIntChoices(Number.isFinite(c) ? Math.round(c) : 0);

  if (/\bsquare\s+cm\b/i.test(solved.answerStr)) {
    choices = base.map((x) => `${x} square cm`);
  } else if (/\bpieces\b/i.test(solved.answerStr)) {
    choices = base.map((x) => `${x} pieces`);
  } else {
    choices = base.map((x) => String(x));
  }

  const idx = choices.findIndex((c2) => norm(c2) === norm(solved.answerStr));
  q.choices = choices;
  q.answerIndex = from0BasedToUi(idx >= 0 ? idx : 0);
  q.explanation = solved.explanation || q.explanation || "Because it matches the correct calculation.";
  return q;
}

function repairQuizJSON(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;

  quiz.questions = quiz.questions.map((q) => {
    const fixed = {
      question: String(q.question || "").trim(),
      choices: Array.isArray(q.choices) ? q.choices.map((x) => String(x)) : [],
      // IMPORTANT: normalize incoming answerIndex (0-based or 1-based) to UI base
      answerIndex: toUiAnswerIndex(q.answerIndex, 4),
      explanation: String(q.explanation || "").trim(),
    };

    // Ensure 4 choices
    fixed.choices = fixed.choices.slice(0, 4);
    while (fixed.choices.length < 4) fixed.choices.push("—");

    // Ensure answerIndex in range
    if (ANSWER_INDEX_BASE === 1) {
      if (fixed.answerIndex < 1 || fixed.answerIndex > 4) fixed.answerIndex = 1;
    } else {
      if (fixed.answerIndex < 0 || fixed.answerIndex > 3) fixed.answerIndex = 0;
    }

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
  const types = ["rect_area", "share", "percent_fill", "discount", "subtract", "pies"];
  const pick = types[Math.floor(Math.random() * types.length)];

  if (pick === "rect_area") {
    const L = 2 + Math.floor(Math.random() * 9);
    const W = 2 + Math.floor(Math.random() * 9);
    const ans = L * W;
    const choices = makeIntChoices(ans).map((x) => `${x} square cm`);
    const idx0 = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A rectangle has a length of ${L} cm and a width of ${W} cm. What is its area?`,
      choices,
      answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
      explanation: `Area = length × width = ${L} × ${W} = ${ans}.`,
    };
  }

  if (pick === "share") {
    const ppl = 2 + Math.floor(Math.random() * 9);
    const each = 2 + Math.floor(Math.random() * 9);
    const total = ppl * each;
    const ans = each;
    const choices = makeIntChoices(ans).map((x) => `${x} pieces`);
    const idx0 = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A group of friends want to share some candy equally. If they have ${total} pieces of candy and there are ${ppl} friends, how many pieces of candy will each friend get?`,
      choices,
      answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
      explanation: `${total} ÷ ${ppl} = ${ans}.`,
    };
  }

  if (pick === "percent_fill") {
    // choose numbers that give an integer percent to avoid rounding issues
    const cap = 200 + Math.floor(Math.random() * 6) * 40; // 200,240,280,320,360,400
    const pct = [25, 50, 75][Math.floor(Math.random() * 3)];
    const inTank = (cap * pct) / 100;
    const ansStr = `${pct}%`;
    const choices = makePercentChoicesExact(ansStr);
    const idx0 = choices.findIndex((c) => c === ansStr);
    return {
      question: `A water tank can hold ${cap} gallons of water. If ${inTank} gallons of water are already in the tank, what percentage of the tank is filled?`,
      choices,
      answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
      explanation: `(${inTank} ÷ ${cap}) × 100 = ${ansStr}.`,
    };
  }

  if (pick === "discount") {
    // allow 2–3 decimals in the price sometimes; output exact sale (no rounding)
    const base = 2 + Math.floor(Math.random() * 18); // 2..19
    const decimals = [2, 3][Math.floor(Math.random() * 2)];
    const frac = decimals === 2 ? "50" : "750";
    const priceStr = `${base}.${frac}`; // e.g. 9.750
    const pctOff = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
    const pay = 100 - pctOff;

    const correct = formatMoneyExact(priceStr, pay);
    const choices = makeMoneyChoicesExact(priceStr, pctOff);
    const idx0 = choices.findIndex((c) => c === correct);

    return {
      question: `A shop has a sale. An item normally costs $${priceStr}, but it's on sale for ${pctOff}% off. How much will you pay during the sale?`,
      choices,
      answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
      explanation: `Pay ${pay}%: $${priceStr} × ${pay}% = ${correct}.`,
    };
  }

  if (pick === "subtract") {
    const a = 6 + Math.floor(Math.random() * 14);
    const b = 1 + Math.floor(Math.random() * 5);
    const ans = a - b;

    const base = makeIntChoices(ans);
    const choices = base.map((x, i) => `${String.fromCharCode(65 + i)}) ${x}`);
    const idx0 = base.indexOf(ans);

    return {
      question: `What is ${a} - ${b}?`,
      choices,
      answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
      explanation: `${a} − ${b} = ${ans}.`,
    };
  }

  // pies
  const per = [3, 4, 5][Math.floor(Math.random() * 3)];
  const pies = 2 + Math.floor(Math.random() * 4);
  const total = per * pies;
  const ans = pies;
  const choices = makeIntChoices(ans).map(String);
  const idx0 = choices.indexOf(String(ans));
  return {
    question: `If it takes ${per} apples to make a pie and you have ${total} apples, how many pies can you make?`,
    choices,
    answerIndex: from0BasedToUi(idx0 >= 0 ? idx0 : 0),
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

    // ✅ If quiz: parse payload to decide deterministic fallback
    let quizPayload = null;
    if (isQuiz) quizPayload = safeJSONParse(userMsg, null);

    // ✅ If it's education quiz + likely math topic => deterministic quiz (guaranteed correct)
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

    // ✅ If quiz: normalize + repair math errors + normalize answerIndex base
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);
      if (normalized) {
        const repaired = repairQuizJSON(normalized);
        return res.status(200).json({ reply: JSON.stringify(repaired) });
      }

      // fallback deterministic for education quizzes
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
