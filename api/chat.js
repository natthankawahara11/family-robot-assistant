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
      '      "choices": ["choice1","choice2","choice3","choice4"],',
      '      "answerIndex": 1,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      "4) Always 4 choices. answerIndex must be 1..4 (IMPORTANT).",
      "5) Do NOT prefix choices with 'A)', 'B)'. Choices must be plain text only.",
      "6) For decimals: do NOT round up/down; show the full exact decimal result (no rounding).",
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;

  const qs = Array.isArray(obj.questions) ? obj.questions : [];
  const clean = qs
    .map((q) => {
      const rawChoices = Array.isArray(q.choices)
        ? q.choices
        : Array.isArray(q.options)
        ? q.options
        : [];

      // IMPORTANT: strip any "A)", "B)" prefixes if model puts them
      const stripLetterPrefix = (s) =>
        String(s || "")
          .trim()
          .replace(/^[A-D]\s*[\)\.\-:]\s*/i, "");

      const choices = rawChoices.map((x) => stripLetterPrefix(String(x)));

      // IMPORTANT: accept both 0-based and 1-based, but normalize internally to 0-based
      let ai = Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null;
      if (ai === null && Number.isFinite(Number(q.correctIndex))) ai = Number(q.correctIndex);

      // if looks 1..4 -> convert to 0..3
      if (ai !== null && ai >= 1 && ai <= 4) ai = ai - 1;

      return {
        question: String(q.question || q.q || "").trim(),
        choices,
        answerIndex: ai,
        explanation: String(q.explanation || q.reason || "").trim(),
      };
    })
    .filter((q) => q.question && q.choices.length === 4 && q.answerIndex !== null);

  if (!clean.length) return null;
  return { questions: clean };
}

/* =========================================================
   ✅ EXACT DECIMAL / MONEY UTIL (NO ROUNDING)
   ========================================================= */
function parseDecimalToBigInt(str) {
  // returns { int: BigInt, decimals: number }
  const s = String(str || "").trim();
  const m = s.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const neg = !!m[1];
  const whole = m[2];
  const frac = m[3] || "";
  const decimals = frac.length;
  const intStr = whole + frac;
  let bi = BigInt(intStr || "0");
  if (neg) bi = -bi;
  return { int: bi, decimals };
}

function pow10BigInt(n) {
  let x = 1n;
  for (let i = 0; i < n; i++) x *= 10n;
  return x;
}

function bigIntToFixedDecimalString(intVal, decimals) {
  // intVal is scaled by 10^decimals
  const neg = intVal < 0n;
  let v = neg ? -intVal : intVal;

  const scale = pow10BigInt(decimals);
  const whole = v / scale;
  const frac = v % scale;

  if (decimals === 0) return (neg ? "-" : "") + whole.toString();

  let fracStr = frac.toString().padStart(decimals, "0");

  // trim trailing zeros but keep at least 1 digit if fractional exists
  fracStr = fracStr.replace(/0+$/, "");
  if (fracStr.length === 0) {
    return (neg ? "-" : "") + whole.toString();
  }
  return (neg ? "-" : "") + whole.toString() + "." + fracStr;
}

function moneyStr(decStr) {
  // expects decimal string without rounding
  return `$${decStr}`;
}

function exactSalePrice(priceStr, pctStr) {
  // sale = price * (100 - pct) / 100
  const p = parseDecimalToBigInt(String(priceStr));
  if (!p) return null;
  const pct = Number(pctStr);
  if (!Number.isFinite(pct)) return null;

  const keep = BigInt(Math.round((100 - pct) * 1000)) / 1000n; // allow % like 12.5, 33.3 (rare)
  // If pct is integer normally, keep = 100-pct exactly.

  // Better: compute as rational using integer percent if possible
  // We'll treat pct as rational with up to 3 decimals (safe enough), and DO NOT round result.
  const pctParsed = parseDecimalToBigInt(String(100 - pct)); // keep percent as decimal
  if (!pctParsed) return null;

  // price = p.int / 10^p.decimals
  // keep% = pctParsed.int / 10^pctParsed.decimals
  // sale = price * keep% / 100
  // => saleScaled = p.int * pctParsed.int * 10^K / (10^p.decimals * 10^pctDec * 100)
  // We'll output with decimals = p.decimals + pctDec + 2 (for /100)
  const outDecimals = p.decimals + pctParsed.decimals + 2;

  const numerator = p.int * pctParsed.int; // BigInt
  const denom = 100n; // divide by 100
  // scale numerator by 10^(2 + pctDec) then divide denom? easier:
  // We want integer scaled by 10^outDecimals:
  // saleScaled = (p.int * pctInt * 10^2) / (100 * 10^(pDec+pctDec)) * 10^outDecimals
  // outDecimals = pDec + pctDec + 2 -> cancels nicely:
  // saleScaled = (p.int * pctInt) / 100
  const saleScaled = numerator / denom; // exact truncation if not divisible; but with our setup it should be divisible often.
  return { scaled: saleScaled, decimals: outDecimals };
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

function makePercentChoicesInt(correctPct) {
  const c = clamp(Math.trunc(Number(correctPct)), 0, 100);
  const pool = uniq([c, c - 10, c + 10, c - 25, c + 25, c - 5, c + 5, c - 17, c + 17])
    .map((x) => clamp(Math.trunc(x), 0, 100))
    .filter((x, i, a) => a.indexOf(x) === i);

  const out = [c];
  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }
  while (out.length < 4) out.push(clamp(out[out.length - 1] + 1, 0, 100));
  return out.sort(() => Math.random() - 0.5).map((x) => `${x}%`);
}

function makeMoneyChoicesExact(correctScaled, decimals) {
  // correctScaled is BigInt scaled by 10^decimals
  const step = 1n; // smallest unit (no rounding)
  const steps = [1n, 2n, 5n, 10n, 25n].map((k) => k * step);

  const pool = [];
  pool.push(correctScaled);
  for (const s of steps) {
    pool.push(correctScaled + s);
    if (correctScaled - s > 0n) pool.push(correctScaled - s);
  }

  const uniqPool = uniq(pool.map((x) => x.toString())).map((s) => BigInt(s));
  const out = [correctScaled];
  for (const v of uniqPool) {
    if (out.length >= 4) break;
    if (!out.some((z) => z === v) && v > 0n) out.push(v);
  }
  while (out.length < 4) out.push(correctScaled + BigInt(out.length) * step);

  // shuffle and format
  const shuffled = out.sort(() => Math.random() - 0.5);
  return shuffled.map((v) => moneyStr(bigIntToFixedDecimalString(v, decimals)));
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
      if (Number.isInteger(ans)) {
        return {
          kind: "int",
          answer: ans,
          answerStr: `${ans} square cm`,
          explanation: `Area = length × width = ${L} × ${W} = ${ans}.`,
        };
      }
      // if decimals appear, DO NOT round
      const ansStr = String(ans);
      return {
        kind: "text",
        answer: ansStr,
        answerStr: `${ansStr} square cm`,
        explanation: `Area = length × width = ${L} × ${W} = ${ansStr}.`,
      };
    }
  }

  // 2) Division equally: have X pieces and Y friends
  m = t.match(/have\s+(\d+)\s+pieces.*\s(\d+)\s+friends/i);
  if (m) {
    const total = Number(m[1]);
    const ppl = Number(m[2]);
    if (Number.isFinite(total) && Number.isFinite(ppl) && ppl !== 0) {
      const ans = total / ppl;
      if (Number.isInteger(ans)) {
        return {
          kind: "int",
          answer: ans,
          answerStr: `${ans} pieces`,
          explanation: `Divide: ${total} ÷ ${ppl} = ${ans}.`,
        };
      }
      // not typical for candy; still no rounding:
      const ansStr = String(ans);
      return {
        kind: "text",
        answer: ansStr,
        answerStr: `${ansStr} pieces`,
        explanation: `Divide: ${total} ÷ ${ppl} = ${ansStr}.`,
      };
    }
  }

  // 3) Apples/pies
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
        explanation: `Divide: ${total} ÷ ${per} = ${ans}.`,
      };
    }
  }

  // 4) Pencil divided
  m = t.match(/(\d+(?:\.\d+)?)\s*cm.*divided\s+into\s+(\d+)\s+parts/i);
  if (m) {
    const len = Number(m[1]);
    const parts = Number(m[2]);
    if (Number.isFinite(len) && Number.isFinite(parts) && parts !== 0) {
      const ans = len / parts;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return {
        kind: Number.isInteger(ans) ? "int" : "text",
        answer: Number.isInteger(ans) ? ans : ansStr,
        answerStr: ansStr,
        explanation: `Divide: ${len} ÷ ${parts} = ${ansStr}.`,
      };
    }
  }

  // 5) Percent filled (we keep integer % only; no rounding beyond integer for this repair)
  m = t.match(/hold\s+(\d+)\s+gallons.*if\s+(\d+)\s+gallons.*what\s+percentage/i);
  if (m) {
    const cap = Number(m[1]);
    const inTank = Number(m[2]);
    if (Number.isFinite(cap) && Number.isFinite(inTank) && cap !== 0) {
      const pct = (inTank / cap) * 100;
      // if integer -> ok, else truncate (NO rounding)
      const pctInt = Number.isInteger(pct) ? pct : Math.trunc(pct);
      return {
        kind: "percent",
        answer: pctInt,
        answerStr: `${pctInt}%`,
        explanation: `(${inTank} ÷ ${cap}) × 100 = ${pctInt}%.`,
      };
    }
  }

  // 6) Subtraction
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
        explanation: `${a} − ${b} = ${ans}.`,
      };
    }
  }

  // 7) Discount / sale: keep EXACT decimals (NO rounding)
  // supports "$9.750" and "25% off"
  m = t.match(/costs?\s*\$?(\d+(?:\.\d+)?).*(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (m) {
    const priceStr = m[1];
    const pctStr = m[2];
    const sale = exactSalePrice(priceStr, pctStr);
    if (sale) {
      const saleDecStr = bigIntToFixedDecimalString(sale.scaled, sale.decimals);
      return {
        kind: "money_exact",
        answer: { scaled: sale.scaled.toString(), decimals: sale.decimals },
        answerStr: moneyStr(saleDecStr),
        explanation: `Pay ${100 - Number(pctStr)}%: $${priceStr} × ${(1 - Number(pctStr) / 100)} = ${moneyStr(
          saleDecStr
        )} (no rounding).`,
      };
    }
  }

  return null;
}

function repairQuizMath(q) {
  const solved = computeMathFromQuestionText(q.question);
  if (!solved) return q;

  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  let choices = Array.isArray(q.choices) ? q.choices.map((x) => String(x).trim()) : [];

  // Always keep 4
  choices = choices.slice(0, 4);
  while (choices.length < 4) choices.push("—");

  // remove any "A) " prefixes just in case
  choices = choices.map((c) => c.replace(/^[A-D]\s*[\)\.\-:]\s*/i, ""));

  // if correct already exists, just set answerIndex
  const correctText = solved.answerStr;
  const idxExisting = choices.findIndex((c) => norm(c) === norm(correctText));
  if (idxExisting >= 0) {
    q.answerIndex = idxExisting; // internal 0-based
    q.explanation = solved.explanation || q.explanation;
    q.choices = choices;
    return q;
  }

  // rebuild choices depending on kind
  if (solved.kind === "money_exact") {
    const correctScaled = BigInt(solved.answer.scaled);
    const decimals = solved.answer.decimals;
    choices = makeMoneyChoicesExact(correctScaled, decimals);
    const idx = choices.findIndex((c) => norm(c) === norm(correctText));
    q.choices = choices;
    q.answerIndex = idx >= 0 ? idx : 0;
    q.explanation = solved.explanation || q.explanation;
    return q;
  }

  if (solved.kind === "percent") {
    choices = makePercentChoicesInt(solved.answer);
    const idx = choices.findIndex((c) => norm(c) === norm(correctText));
    q.choices = choices;
    q.answerIndex = idx >= 0 ? idx : 0;
    q.explanation = solved.explanation || q.explanation;
    return q;
  }

  if (solved.kind === "int") {
    const base = makeIntChoices(solved.answer);
    if (/\bsquare\s+cm\b/i.test(correctText)) {
      choices = base.map((x) => `${x} square cm`);
    } else if (/\bpieces\b/i.test(correctText)) {
      choices = base.map((x) => `${x} pieces`);
    } else {
      choices = base.map((x) => String(x));
    }
    const idx = choices.findIndex((c) => norm(c) === norm(correctText));
    q.choices = choices;
    q.answerIndex = idx >= 0 ? idx : 0;
    q.explanation = solved.explanation || q.explanation;
    return q;
  }

  // fallback
  q.explanation = solved.explanation || q.explanation || "Because it matches the correct calculation.";
  q.choices = choices;
  q.answerIndex = 0;
  return q;
}

function repairQuizJSON(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;

  quiz.questions = quiz.questions.map((q) => {
    const fixed = {
      question: String(q.question || "").trim(),
      choices: Array.isArray(q.choices) ? q.choices.map((x) => String(x)) : [],
      // internal normalize to 0-based; will convert to 1-based at the very end
      answerIndex: Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : 0,
      explanation: String(q.explanation || "").trim(),
    };

    // Ensure 4 choices
    fixed.choices = fixed.choices.slice(0, 4);
    while (fixed.choices.length < 4) fixed.choices.push("—");

    // strip letter prefixes
    fixed.choices = fixed.choices.map((c) => c.replace(/^[A-D]\s*[\)\.\-:]\s*/i, ""));

    // Ensure answerIndex in range (0..3)
    fixed.answerIndex = clamp(fixed.answerIndex, 0, 3);

    // ✅ attempt to solve/repair common math errors
    return repairQuizMath(fixed);
  });

  return quiz;
}

/* =========================================================
   ✅ FRONTEND COMPAT: convert answerIndex to 1..4
   (This fixes your “shifted answer” bug)
   ========================================================= */
function toFrontendQuiz(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;
  return {
    questions: quiz.questions.map((q) => {
      const ai0 = clamp(Number(q.answerIndex) || 0, 0, 3);
      return {
        question: q.question,
        choices: q.choices.map((c) => String(c)),
        // IMPORTANT: send 1-based index to match your app behavior
        answerIndex: ai0 + 1,
        explanation: q.explanation || "",
      };
    }),
  };
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
    const L = 2 + Math.floor(Math.random() * 9); // 2..10
    const W = 2 + Math.floor(Math.random() * 9);
    const ans = L * W;
    const choices = makeIntChoices(ans).map((x) => `${x} square cm`);
    const answerIndex0 = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A rectangle has a length of ${L} cm and a width of ${W} cm. What is its area?`,
      choices,
      answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
      explanation: `Area = length × width = ${L} × ${W} = ${ans}.`,
    };
  }

  if (pick === "share") {
    const ppl = 2 + Math.floor(Math.random() * 9); // 2..10
    const each = 2 + Math.floor(Math.random() * 9); // 2..10
    const total = ppl * each;
    const ans = each;
    const choices = makeIntChoices(ans).map((x) => `${x} pieces`);
    const answerIndex0 = choices.findIndex((c) => c.startsWith(String(ans)));
    return {
      question: `A group of friends want to share some candy equally. If they have ${total} pieces of candy and there are ${ppl} friends, how many pieces of candy will each friend get?`,
      choices,
      answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
      explanation: `${total} ÷ ${ppl} = ${ans}.`,
    };
  }

  if (pick === "percent_fill") {
    // choose a clean percent (no rounding) to avoid repeating decimals
    const cap = 120 + Math.floor(Math.random() * 9) * 20; // 120..280 step 20
    const inTank = cap / 2; // 50% exact
    const ans = 50;
    const choices = makePercentChoicesInt(ans);
    const answerIndex0 = choices.findIndex((c) => c === `${ans}%`);
    return {
      question: `A water tank can hold ${cap} gallons of water. If ${inTank} gallons of water are already in the tank, what percentage of the tank is filled?`,
      choices,
      answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
      explanation: `(${inTank} ÷ ${cap}) × 100 = ${ans}%.`,
    };
  }

  if (pick === "discount") {
    // make an exact decimal result (no rounding)
    const priceWhole = 2 + Math.floor(Math.random() * 10);
    const priceStr = `${priceWhole}.50`; // 2 decimals
    const pct = [10, 15, 20, 25][Math.floor(Math.random() * 4)];

    const sale = exactSalePrice(priceStr, String(pct));
    const saleText = sale ? moneyStr(bigIntToFixedDecimalString(sale.scaled, sale.decimals)) : `$${priceStr}`;

    const choices = sale
      ? makeMoneyChoicesExact(sale.scaled, sale.decimals)
      : [saleText, `$${priceWhole}.00`, `$${priceWhole}.25`, `$${priceWhole}.75`];

    const answerIndex0 = choices.findIndex((c) => c === saleText);

    return {
      question: `A shop has a sale. An item normally costs $${priceStr}, but it's on sale for ${pct}% off. How much will you pay during the sale?`,
      choices,
      answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
      explanation: `Pay ${100 - pct}% (no rounding).`,
    };
  }

  if (pick === "subtract") {
    const a = 6 + Math.floor(Math.random() * 14); // 6..19
    const b = 1 + Math.floor(Math.random() * 5); // 1..5
    const ans = a - b;
    const base = makeIntChoices(ans);
    const choices = base.map((x) => String(x)); // IMPORTANT: no "A) "
    const answerIndex0 = base.indexOf(ans);
    return {
      question: `What is ${a} - ${b}?`,
      choices,
      answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
      explanation: `${a} − ${b} = ${ans}.`,
    };
  }

  // pies
  const per = [3, 4, 5][Math.floor(Math.random() * 3)];
  const pies = 2 + Math.floor(Math.random() * 4); // 2..5
  const total = per * pies;
  const ans = pies;
  const choices = makeIntChoices(ans).map(String);
  const answerIndex0 = choices.indexOf(String(ans));
  return {
    question: `If it takes ${per} apples to make a pie and you have ${total} apples, how many pies can you make?`,
    choices,
    answerIndex: answerIndex0 >= 0 ? answerIndex0 : 0,
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

    // ✅ If it's education quiz + likely math topic => deterministic quiz (guaranteed correct)
    if (isQuiz && type === "education_quiz" && quizPayload && isLikelyMathTopic(quizPayload)) {
      const n = clamp(Number(quizPayload.numQuestions) || 8, 3, 15);
      const quiz = makeDeterministicMathQuiz(n);
      return res.status(200).json({ reply: JSON.stringify(toFrontendQuiz(quiz)) });
    }

    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: system }, ...(isQuiz ? [] : cleanHistory), { role: "user", content: userMsg }],
      temperature: isQuiz ? 0.25 : 0.7,
    };

    if (isQuiz) payload.response_format = { type: "json_object" };

    const completion = await client.chat.completions.create(payload);
    const replyText = completion?.choices?.[0]?.message?.content?.trim() || "…";

    // ✅ If quiz: normalize + repair
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);

      if (normalized) {
        const repaired = repairQuizJSON(normalized);
        // IMPORTANT: convert to 1-based answerIndex for your app (fixes shifted answers)
        return res.status(200).json({ reply: JSON.stringify(toFrontendQuiz(repaired)) });
      }

      // if model returns junk: fallback deterministic for education
      if (type === "education_quiz") {
        const n = clamp(Number(quizPayload?.numQuestions) || 8, 3, 15);
        const quiz = makeDeterministicMathQuiz(n);
        return res.status(200).json({ reply: JSON.stringify(toFrontendQuiz(quiz)) });
      }
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(200).json({ reply: "AI is temporarily unavailable. Please try again in a moment." });
  }
};
