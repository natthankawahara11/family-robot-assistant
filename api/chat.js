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
      '      "answerIndex": 0,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      "4) Always 4 choices. answerIndex must be 0..3 (IMPORTANT).",
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
  if (/^[A-D]$/i.test(t)) return true; // "A"
  if (t.length <= 1) return true;
  return false;
}

function sanitizeChoices(rawChoices) {
  const choices = (Array.isArray(rawChoices) ? rawChoices : []).map((x) => stripLetterPrefix(x));
  // replace bad placeholders like "A" or empty
  for (let i = 0; i < choices.length; i++) {
    if (isBadChoice(choices[i])) choices[i] = "—";
  }
  // force 4
  const out = choices.slice(0, 4);
  while (out.length < 4) out.push("—");
  return out;
}

/* =========================================================
   ✅ NORMALIZE QUIZ JSON (IMPORTANT: fix the “shifted answer” bug)
   - Your frontend behavior matches 0-based answerIndex (0..3).
   - So we ALWAYS return 0..3.
   - We detect whether the model used 0-based or 1-based per whole-quiz,
     then convert safely.
   ========================================================= */
function detectIndexBaseFromAll(questions) {
  // returns "zero" or "one"
  const idxs = questions
    .map((q) => (Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null))
    .filter((x) => x !== null);

  if (!idxs.length) return "zero";

  // If ANY 0 appears => must be 0-based
  if (idxs.some((x) => x === 0)) return "zero";
  // If ANY 4 appears => must be 1-based
  if (idxs.some((x) => x === 4)) return "one";

  // Ambiguous (only 1..3). In practice, Groq/LLM often uses 0..3.
  // Choose 0-based to avoid the “3 becomes 2” bug.
  return "zero";
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;

  const qsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  if (!qsRaw.length) return null;

  const base = detectIndexBaseFromAll(qsRaw);

  const clean = qsRaw
    .map((q) => {
      const rawChoices = Array.isArray(q.choices)
        ? q.choices
        : Array.isArray(q.options)
        ? q.options
        : [];

      const choices = sanitizeChoices(rawChoices);

      let ai = Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null;
      if (ai === null && Number.isFinite(Number(q.correctIndex))) ai = Number(q.correctIndex);

      // Convert if whole-quiz looks 1-based
      if (ai !== null && base === "one") ai = ai - 1;

      // clamp 0..3
      ai = ai === null ? null : clamp(ai, 0, 3);

      return {
        question: String(q.question || q.q || "").trim(),
        choices,
        answerIndex: ai,
        explanation: String(q.explanation || q.reason || "").trim(),
      };
    })
    .filter((q) => q.question && Array.isArray(q.choices) && q.choices.length === 4 && q.answerIndex !== null);

  if (!clean.length) return null;
  return { questions: clean };
}

/* =========================================================
   ✅ EXACT DECIMAL (NO ROUNDING) FOR DISCOUNT
   sale = price * (100 - pct) / 100
   - price may have any decimals (e.g. 9.750)
   - pct may have decimals too (rare)
   Output: exact terminating decimal string (no rounding)
   ========================================================= */
function parseDecimalToBigIntParts(str) {
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
  return { bi, decimals };
}

function pow10BigInt(n) {
  let x = 1n;
  for (let i = 0; i < n; i++) x *= 10n;
  return x;
}

function bigIntScaledToDecimalString(intVal, decimals) {
  const neg = intVal < 0n;
  let v = neg ? -intVal : intVal;

  if (decimals === 0) return (neg ? "-" : "") + v.toString();

  const scale = pow10BigInt(decimals);
  const whole = v / scale;
  const frac = v % scale;

  let fracStr = frac.toString().padStart(decimals, "0");
  // trim trailing zeros (still exact, no rounding)
  fracStr = fracStr.replace(/0+$/, "");
  if (!fracStr) return (neg ? "-" : "") + whole.toString();

  return (neg ? "-" : "") + whole.toString() + "." + fracStr;
}

function exactSalePriceScaled(priceStr, pctStr) {
  const p = parseDecimalToBigIntParts(priceStr);
  const pct = parseDecimalToBigIntParts(pctStr);
  if (!p || !pct) return null;

  // price = p.bi / 10^p.decimals
  // pct = pct.bi / 10^pct.decimals
  // factor = (100 - pct) / 100
  // Let pctScaled = pct.bi (represents pct / 10^pct.dec)
  // (100 - pct) => 100*10^pctDec - pctScaled
  const pctDec = pct.decimals;
  const hundredScaled = 100n * pow10BigInt(pctDec);
  const keepScaled = hundredScaled - pct.bi; // (100 - pct) scaled by 10^pctDec

  // sale = (p.bi / 10^pDec) * (keepScaled / (100 * 10^pctDec))
  // denominator is 10^(pDec) * 100 * 10^(pctDec) = 10^(pDec + pctDec + 2)
  const outDecimals = p.decimals + pctDec + 2;
  const saleScaled = p.bi * keepScaled; // scaled by 10^(pDec+pctDec) already, and /100 adds +2 decimals
  // Because denominator is exactly 10^outDecimals, saleScaled already represents the number scaled by 10^outDecimals.
  return { scaled: saleScaled, decimals: outDecimals };
}

function moneyStrFromScaled(scaled, decimals) {
  const dec = bigIntScaledToDecimalString(scaled, decimals);
  return `$${dec}`;
}

/* =========================================================
   ✅ GENERATE MATH CHOICES
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
  const step = 1n; // smallest unit in the scaled world
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

  return out.sort(() => Math.random() - 0.5).map((v) => moneyStrFromScaled(v, decimals));
}

/* =========================================================
   ✅ MATH + THAI MATH SOLVER (fix your Thai questions too)
   ========================================================= */
function computeMathFromQuestionText(qText) {
  const t = String(qText || "");

  // -------- English patterns --------

  // Rectangle area
  let m = t.match(/length\s+of\s+(\d+(?:\.\d+)?)\s*cm.*width\s+of\s+(\d+(?:\.\d+)?)\s*cm/i);
  if (m) {
    const L = Number(m[1]);
    const W = Number(m[2]);
    if (Number.isFinite(L) && Number.isFinite(W)) {
      const ans = L * W;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans); // no rounding
      return {
        kind: "int_or_text",
        answerText: `${ansStr} square cm`,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `Area = length × width = ${L} × ${W} = ${ansStr}.`,
      };
    }
  }

  // Share candy: have X pieces and Y friends
  m = t.match(/have\s+(\d+)\s+pieces.*\s(\d+)\s+friends/i);
  if (m) {
    const total = Number(m[1]);
    const ppl = Number(m[2]);
    if (Number.isFinite(total) && Number.isFinite(ppl) && ppl !== 0) {
      const ans = total / ppl;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans); // no rounding
      return {
        kind: "int_or_text",
        answerText: `${ansStr} pieces`,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `Divide: ${total} ÷ ${ppl} = ${ansStr}.`,
      };
    }
  }

  // Percent filled: (Y/X)*100 (no rounding -> truncate if needed)
  m = t.match(/hold\s+(\d+)\s+gallons.*if\s+(\d+)\s+gallons.*what\s+percentage/i);
  if (m) {
    const cap = Number(m[1]);
    const inTank = Number(m[2]);
    if (Number.isFinite(cap) && Number.isFinite(inTank) && cap !== 0) {
      const pct = (inTank / cap) * 100;
      const pctInt = Number.isInteger(pct) ? pct : Math.trunc(pct); // NO rounding
      return {
        kind: "percent",
        answerText: `${pctInt}%`,
        answerNum: pctInt,
        explanation: `(${inTank} ÷ ${cap}) × 100 = ${pctInt}%.`,
      };
    }
  }

  // Subtraction
  m = t.match(/what\s+is\s+(\d+)\s*[-−]\s*(\d+)\s*\?/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a - b;
      return {
        kind: "int_or_text",
        answerText: String(ans),
        answerNum: ans,
        explanation: `${a} − ${b} = ${ans}.`,
      };
    }
  }

  // Discount (exact)
  m = t.match(/costs?\s*\$?(\d+(?:\.\d+)?).*(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (m) {
    const priceStr = m[1];
    const pctStr = m[2];
    const sale = exactSalePriceScaled(priceStr, pctStr);
    if (sale) {
      return {
        kind: "money_exact",
        answerText: moneyStrFromScaled(sale.scaled, sale.decimals),
        answerMoney: sale,
        explanation: `Pay ${100 - Number(pctStr)}% (exact, no rounding).`,
      };
    }
  }

  // -------- Thai patterns --------

  // หาร 24 ด้วย 4
  m = t.match(/หาร\s*(\d+(?:\.\d+)?)\s*ด้วย\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      const ans = a / b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans); // no rounding
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การหาร ${a} ด้วย ${b} คือ ${ansStr}`,
      };
    }
  }

  // บวก 3 และ 5
  m = t.match(/บวก\s*(\d+(?:\.\d+)?)\s*(?:และ|\+)\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a + b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การบวก ${a} และ ${b} คือ ${ansStr}`,
      };
    }
  }

  // ลบ 15 ด้วย 3 หรือ ลบ 15 กับ 3
  m = t.match(/ลบ\s*(\d+(?:\.\d+)?)\s*(?:ด้วย|กับ)?\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a - b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การลบ ${a} ด้วย ${b} คือ ${ansStr}`,
      };
    }
  }

  // คูณ 3 และ 5
  m = t.match(/คูณ\s*(\d+(?:\.\d+)?)\s*(?:และ|\*|x|×)\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a * b;
      const ansStr = Number.isInteger(ans) ? String(ans) : String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การคูณ ${a} และ ${b} คือ ${ansStr}`,
      };
    }
  }

  return null;
}

/* =========================================================
   ✅ SIMPLE HEALTH/FIRST AID REPAIR (fix “A” choice + wrong key)
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
    const choices = [
      "Apply gentle pressure with a bandage",
      "Apply heat to the area",
      "Apply soap to the area",
      "Leave it uncovered",
    ];
    return {
      answerText: correct,
      choices,
      explanation: "Gentle direct pressure helps stop bleeding.",
    };
  }

  return null;
}

/* =========================================================
   ✅ REPAIR QUIZ (math + first aid)
   ========================================================= */
function repairQuizQuestion(q, quizType) {
  const fixed = {
    question: String(q.question || "").trim(),
    choices: sanitizeChoices(q.choices),
    answerIndex: clamp(Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : 0, 0, 3),
    explanation: String(q.explanation || "").trim(),
  };

  // 1) Fix first-aid / healthcare common issues (missing "A", wrong key)
  if (quizType === "healthcare_quiz") {
    const fa = computeFirstAidFromQuestionText(fixed.question);
    if (fa) {
      // overwrite choices with safe known set (prevents "A" placeholder)
      fixed.choices = fa.choices;
      const idx = fixed.choices.findIndex((c) => norm(c) === norm(fa.answerText));
      fixed.answerIndex = idx >= 0 ? idx : 0;
      fixed.explanation = fa.explanation;
      return fixed;
    }
  }

  // 2) Fix math (English + Thai)
  const solved = computeMathFromQuestionText(fixed.question);
  if (!solved) return fixed;

  const correctText = solved.answerText;

  // if correct already exists -> just set answerIndex
  const idxExisting = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
  if (idxExisting >= 0) {
    fixed.answerIndex = idxExisting;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  // rebuild choices for known kinds
  if (solved.kind === "money_exact" && solved.answerMoney) {
    const { scaled, decimals } = solved.answerMoney;
    fixed.choices = makeMoneyChoicesExact(scaled, decimals);
    const idx = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = idx >= 0 ? idx : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  if (solved.kind === "percent") {
    fixed.choices = makePercentChoicesInt(solved.answerNum ?? 0);
    const idx = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = idx >= 0 ? idx : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  // int/text number
  const n = solved.answerNum;
  if (Number.isFinite(n)) {
    const base = makeIntChoices(n);
    // keep suffix style if present
    if (/\bsquare\s+cm\b/i.test(correctText)) {
      fixed.choices = base.map((x) => `${x} square cm`);
    } else if (/\bpieces\b/i.test(correctText)) {
      fixed.choices = base.map((x) => `${x} pieces`);
    } else {
      fixed.choices = base.map((x) => String(x));
    }
    const idx = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = idx >= 0 ? idx : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  // If we only have text answer (rare), just ensure answerIndex points to a matching choice if any
  fixed.explanation = solved.explanation || fixed.explanation;
  return fixed;
}

function repairQuizJSON(quiz, quizType) {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz;
  return {
    questions: quiz.questions.map((q) => repairQuizQuestion(q, quizType)),
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
  const types = ["rect_area", "share", "percent_fill", "discount", "subtract"];
  const pick = types[Math.floor(Math.random() * types.length)];

  if (pick === "rect_area") {
    const L = 2 + Math.floor(Math.random() * 9);
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
    const ppl = 2 + Math.floor(Math.random() * 9);
    const each = 2 + Math.floor(Math.random() * 9);
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
    const cap = 120 + Math.floor(Math.random() * 9) * 20;
    const inTank = cap / 2;
    const ans = 50;
    const choices = makePercentChoicesInt(ans);
    const answerIndex = choices.findIndex((c) => c === `${ans}%`);
    return {
      question: `A water tank can hold ${cap} gallons of water. If ${inTank} gallons of water are already in the tank, what percentage of the tank is filled?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `(${inTank} ÷ ${cap}) × 100 = ${ans}%.`,
    };
  }

  if (pick === "discount") {
    // make exact with 3 decimals sometimes to test "no rounding"
    const whole = 5 + Math.floor(Math.random() * 15);
    const priceStr = Math.random() < 0.5 ? `${whole}.50` : `${whole}.750`; // 2 or 3 decimals
    const pct = [10, 15, 20, 25][Math.floor(Math.random() * 4)];

    const sale = exactSalePriceScaled(priceStr, String(pct));
    const answerText = sale ? moneyStrFromScaled(sale.scaled, sale.decimals) : `$${priceStr}`;

    const choices = sale ? makeMoneyChoicesExact(sale.scaled, sale.decimals) : [answerText, `$${whole}.00`, `$${whole}.25`, `$${whole}.75`];
    const answerIndex = choices.findIndex((c) => c === answerText);

    return {
      question: `A shop has a sale. An item normally costs $${priceStr}, but it's on sale for ${pct}% off. How much will you pay during the sale?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `Pay ${100 - pct}% (exact, no rounding).`,
    };
  }

  // subtract
  const a = 6 + Math.floor(Math.random() * 14);
  const b = 1 + Math.floor(Math.random() * 5);
  const ans = a - b;
  const base = makeIntChoices(ans);
  const choices = base.map((x) => String(x));
  const answerIndex = base.indexOf(ans);
  return {
    question: `What is ${a} - ${b}?`,
    choices,
    answerIndex: answerIndex >= 0 ? answerIndex : 0,
    explanation: `${a} − ${b} = ${ans}.`,
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

    // ✅ deterministic math for education_quiz when topic looks math (guaranteed correct + correct index)
    if (isQuiz && type === "education_quiz" && quizPayload && isLikelyMathTopic(quizPayload)) {
      const n = clamp(Number(quizPayload.numQuestions) || 8, 3, 15);
      const quiz = makeDeterministicMathQuiz(n);
      // IMPORTANT: answerIndex stays 0..3 (fixes your shifted bug)
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

    // ✅ Quiz: normalize + repair (fix shifted index + Thai math + missing "A" choice)
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);

      if (normalized) {
        const repaired = repairQuizJSON(normalized, type);
        // IMPORTANT: answerIndex stays 0..3 (this fixes “3 becomes 2”, “4 becomes 3”)
        return res.status(200).json({ reply: JSON.stringify(repaired) });
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
