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
      "4) Always 4 choices.",
      "5) answerIndex MUST be 0..3 (0-based). IMPORTANT.",
      "6) Do NOT prefix choices with 'A)', 'B)'. Choices must be plain text only.",
      "7) Never output placeholder choices like 'Option 1', '-', '—', 'A', or empty strings.",
      "8) For decimals: do NOT round up/down; show the full exact decimal result (no rounding).",
      "",
      "Domain safety:",
      ...quizDomainRules.map((x) => `- ${x}`),
      "",
      "General safety:",
      ...baseSafety.map((x) => `- ${x}`),
    ].join("\n");
  }

    // ✅ NEW: Scramble word game generator (JSON only)
  if (type === "scramble_game") {
    return [
      `User: ${name}`,
      `Age group: ${age.label}`,
      "",
      "You are a WORD SCRAMBLE game generator.",
      "The user message is JSON with fields:",
      "- topic (string), count (int), difficulty (Easy/Medium/Hard).",
      "",
      "OUTPUT RULES (VERY IMPORTANT):",
      "1) Output ONLY valid JSON. No markdown. No explanation outside JSON.",
      "2) JSON schema:",
      "{",
      '  "words": [',
      "    {",
      '      "answer": "UPPERCASE SINGLE WORD",',
      '      "scrambled": "SAME LETTERS SHUFFLED",',
      '      "hint": "1 simple sentence explaining meaning (DO NOT spell the word)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly count items.",
      "4) answer must be a SINGLE WORD (no spaces, no hyphens).",
      "5) scrambled must contain the EXACT same letters as answer, just shuffled (not identical to answer).",
      "6) No placeholders, no empty strings.",
      "",
      "Difficulty rules:",
      "- Easy: 4–5 letters",
      "- Medium: 6–8 letters",
      "- Hard: 9–12 letters",
      "",
      "Age-appropriate style rules:",
      ...ageStyle.map((x) => `- ${x}`),
      "",
      "Safety rules:",
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
  if (t === "—" || t === "-" || t === "...") return true;
  if (/^option\s*\d+$/i.test(t)) return true;
  return false;
}

// ✅ NEW: strict sanitize (NO placeholder injection)
function sanitizeChoicesStrict(rawChoices) {
  const arr = Array.isArray(rawChoices) ? rawChoices : [];
  const cleaned = [];

  for (const x of arr) {
    const t = stripLetterPrefix(x);
    if (isBadChoice(t)) continue;
    // avoid duplicates (case/space-insensitive)
    if (cleaned.some((y) => norm(y) === norm(t))) continue;
    cleaned.push(t);
    if (cleaned.length >= 4) break;
  }

  return cleaned; // might be <4, that's OK (verifier will fix)
}

function ensureValid4Choices(choices) {
  if (!Array.isArray(choices)) return null;
  if (choices.length !== 4) return null;
  if (choices.some((c) => isBadChoice(c))) return null;

  // ensure unique by normalized comparison
  const seen = new Set();
  for (const c of choices) {
    const k = norm(c);
    if (seen.has(k)) return null;
    seen.add(k);
  }
  return choices.map((c) => String(c).trim());
}

function shuffleChoicesKeepAnswer(choices, answerIndex) {
  const arr = choices.map((c, i) => ({ c, i })); // เก็บ index เดิมไว้
  // Fisher–Yates shuffle
  for (let j = arr.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [arr[j], arr[k]] = [arr[k], arr[j]];
  }

  const newChoices = arr.map((x) => x.c);
  const newAnswerIndex = arr.findIndex((x) => x.i === answerIndex);

  return { choices: newChoices, answerIndex: newAnswerIndex < 0 ? 0 : newAnswerIndex };
}

/* =========================================================
   ✅ NORMALIZE QUIZ JSON (0-based answerIndex)
   ========================================================= */
function detectIndexBaseFromAll(questions) {
  const idxs = questions
    .map((q) => (Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null))
    .filter((x) => x !== null);

  if (!idxs.length) return "zero";
  if (idxs.some((x) => x === 0)) return "zero";
  if (idxs.some((x) => x === 4)) return "one";
  return "zero";
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;

  const qsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  if (!qsRaw.length) return null;

  const base = detectIndexBaseFromAll(qsRaw);

  const clean = qsRaw
    .map((q) => {
      const rawChoices = Array.isArray(q.choices) ? q.choices : Array.isArray(q.options) ? q.options : [];
      const choices = sanitizeChoicesStrict(rawChoices);

      let ai = Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : null;
      if (ai === null && Number.isFinite(Number(q.correctIndex))) ai = Number(q.correctIndex);

      if (ai !== null && base === "one") ai = ai - 1;
      ai = ai === null ? 0 : clamp(ai, 0, 3);

      return {
        question: String(q.question || q.q || "").trim(),
        choices, // may be <4 (will be fixed later)
        answerIndex: ai,
        explanation: String(q.explanation || q.reason || "").trim(),
      };
    })
    .filter((q) => q.question);

  if (!clean.length) return null;
  return { questions: clean };
}

/* =========================================================
   ✅ EXACT DECIMAL (NO ROUNDING) FOR DISCOUNT
   sale = price * (100 - pct) / 100
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
  fracStr = fracStr.replace(/0+$/, "");
  if (!fracStr) return (neg ? "-" : "") + whole.toString();

  return (neg ? "-" : "") + whole.toString() + "." + fracStr;
}

function exactSalePriceScaled(priceStr, pctStr) {
  const p = parseDecimalToBigIntParts(priceStr);
  const pct = parseDecimalToBigIntParts(pctStr);
  if (!p || !pct) return null;

  const pctDec = pct.decimals;
  const hundredScaled = 100n * pow10BigInt(pctDec);
  const keepScaled = hundredScaled - pct.bi;

  const outDecimals = p.decimals + pctDec + 2;
  const saleScaled = p.bi * keepScaled;
  return { scaled: saleScaled, decimals: outDecimals };
}

function moneyStrFromScaled(scaled, decimals) {
  const dec = bigIntScaledToDecimalString(scaled, decimals);
  return `$${dec}`;
}

/* =========================================================
   ✅ GENERATE CHOICES (for deterministic math fallback)
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
  const step = 1n;
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
   ✅ MATH SOLVER (EN + TH)
   ========================================================= */
function computeMathFromQuestionText(qText) {
  const t = String(qText || "");
  let m;

  // Multiplication: "8 * 2 = ?", "9×8=?", "9 x 8"
  m = t.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*[*x×]\s*(\d+(?:\.\d+)?)(?:\s*(?:=|\?|$))/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a * b;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `${a} × ${b} = ${ansStr}`,
      };
    }
  }

  // Rectangle area
  m = t.match(/length\s+of\s+(\d+(?:\.\d+)?)\s*cm.*width\s+of\s+(\d+(?:\.\d+)?)\s*cm/i);
  if (m) {
    const L = Number(m[1]);
    const W = Number(m[2]);
    if (Number.isFinite(L) && Number.isFinite(W)) {
      const ans = L * W;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: `${ansStr} square cm`,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `Area = ${L} × ${W} = ${ansStr}.`,
      };
    }
  }

  // Share candy
  m = t.match(/have\s+(\d+)\s+pieces.*\s(\d+)\s+friends/i);
  if (m) {
    const total = Number(m[1]);
    const ppl = Number(m[2]);
    if (Number.isFinite(total) && Number.isFinite(ppl) && ppl !== 0) {
      const ans = total / ppl;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: `${ansStr} pieces`,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `${total} ÷ ${ppl} = ${ansStr}.`,
      };
    }
  }

  // Percent filled
  m = t.match(/hold\s+(\d+)\s+gallons.*if\s+(\d+)\s+gallons.*what\s+percentage/i);
  if (m) {
    const cap = Number(m[1]);
    const inTank = Number(m[2]);
    if (Number.isFinite(cap) && Number.isFinite(inTank) && cap !== 0) {
      const pct = (inTank / cap) * 100;
      const pctInt = Number.isInteger(pct) ? pct : Math.trunc(pct);
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

  // Discount exact
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
        explanation: `Pay ${100 - Number(pctStr)}% (exact).`,
      };
    }
  }

  // Thai: หาร X ด้วย Y
  m = t.match(/หาร\s*(\d+(?:\.\d+)?)\s*ด้วย\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      const ans = a / b;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การหาร ${a} ด้วย ${b} คือ ${ansStr}`,
      };
    }
  }

  // Thai: บวก
  m = t.match(/บวก\s*(\d+(?:\.\d+)?)\s*(?:และ|\+)\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a + b;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การบวก ${a} และ ${b} คือ ${ansStr}`,
      };
    }
  }

  // Thai: ลบ
  m = t.match(/ลบ\s*(\d+(?:\.\d+)?)\s*(?:ด้วย|กับ)?\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a - b;
      const ansStr = String(ans);
      return {
        kind: "int_or_text",
        answerText: ansStr,
        answerNum: Number.isInteger(ans) ? ans : null,
        explanation: `การลบ ${a} ด้วย ${b} คือ ${ansStr}`,
      };
    }
  }

  // Thai: คูณ
  m = t.match(/คูณ\s*(\d+(?:\.\d+)?)\s*(?:และ|\*|x|×)\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const ans = a * b;
      const ansStr = String(ans);
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
   ✅ SIMPLE HEALTH/FIRST AID PATCH
   ========================================================= */
function computeFirstAidFromQuestionText(qText) {
  const t = norm(qText);

  if (t.includes("chok") || t.includes("สำลัก") || t.includes("ติดคอ")) {
    const correct = "Back slaps";
    const choices = ["Back slaps", "Call emergency services", "Give them a drink of water", "Wait and do nothing"];
    return {
      answerText: correct,
      choices,
      explanation: "Back slaps are a basic first-aid step for choking (call emergency help if severe).",
    };
  }

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
   ✅ REPAIR QUIZ QUESTION (local patch only)
   - DO NOT inject placeholders
   ========================================================= */
function repairQuizQuestion(q, quizType) {
  const fixed = {
    question: String(q.question || "").trim(),
    choices: sanitizeChoicesStrict(q.choices),
    answerIndex: clamp(Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) : 0, 0, 3),
    explanation: String(q.explanation || "").trim(),
  };

  // healthcare patch (strong deterministic)
  if (quizType === "healthcare_quiz") {
    const fa = computeFirstAidFromQuestionText(fixed.question);
    if (fa) {
      fixed.choices = fa.choices;
      const idx = fixed.choices.findIndex((c) => norm(c) === norm(fa.answerText));
      fixed.answerIndex = idx >= 0 ? idx : 0;
      fixed.explanation = fa.explanation;
      return fixed;
    }
  }

  // math patch (strong deterministic)
  const solved = computeMathFromQuestionText(fixed.question);
  if (!solved) return fixed;

  const correctText = solved.answerText;

  // if correct choice exists already
  const idxExisting = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
  if (idxExisting >= 0) {
    fixed.answerIndex = idxExisting;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  // rebuild choices deterministically for math
  if (solved.kind === "money_exact" && solved.answerMoney) {
    const { scaled, decimals } = solved.answerMoney;
    fixed.choices = makeMoneyChoicesExact(scaled, decimals);
    fixed.answerIndex = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = fixed.answerIndex >= 0 ? fixed.answerIndex : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  if (solved.kind === "percent") {
    fixed.choices = makePercentChoicesInt(solved.answerNum ?? 0);
    fixed.answerIndex = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = fixed.answerIndex >= 0 ? fixed.answerIndex : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

  const n = solved.answerNum;
  if (Number.isFinite(n)) {
    const base = makeIntChoices(n);
    if (/\bsquare\s+cm\b/i.test(correctText)) {
      fixed.choices = base.map((x) => `${x} square cm`);
    } else if (/\bpieces\b/i.test(correctText)) {
      fixed.choices = base.map((x) => `${x} pieces`);
    } else {
      fixed.choices = base.map((x) => String(x));
    }
    fixed.answerIndex = fixed.choices.findIndex((c) => norm(c) === norm(correctText));
    fixed.answerIndex = fixed.answerIndex >= 0 ? fixed.answerIndex : 0;
    fixed.explanation = solved.explanation || fixed.explanation;
    return fixed;
  }

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
   ✅ LLM VERIFIER (ONE CALL) - returns corrected choices + answerIndex
   - Fixes:
     1) wrong highlight (answerIndex mismatch)
     2) bad choices ("-", "Option 1", etc.)
   ========================================================= */
async function verifyQuizWithLLM(quiz, quizType) {
  if (!client) return quiz;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) return quiz;

  const compact = quiz.questions.map((q, i) => ({
    i,
    question: q.question,
    // send whatever we have; may be <4
    choices: Array.isArray(q.choices) ? q.choices : [],
  }));

  const verifierSystem = [
    "You are a strict quiz quality fixer and answer verifier.",
    "For each question: produce EXACTLY 4 choices (plain text), and exactly ONE correct choice.",
    "Return ONLY JSON.",
    'Schema: { "answers": [ { "i": 0, "choices": ["c1","c2","c3","c4"], "answerIndex": 0, "explanation": "1 short sentence" } ] }',
    "Rules:",
    "- answerIndex MUST be 0..3 (0-based).",
    "- choices must NOT be '-', '—', 'Option 1', single letters, or empty.",
    "- choices must be unique (no duplicates).",
    "- Keep it age-appropriate and safe.",
    "- If the provided choices already contain a clear correct option, you may reuse them (but still output 4 clean choices).",
    "",
    `Quiz type: ${quizType}`,
  ].join("\n");

  const verifierUser = JSON.stringify({ questions: compact });

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: verifierSystem },
      { role: "user", content: verifierUser },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };

  try {
    const completion = await client.chat.completions.create(payload);
    const txt = completion?.choices?.[0]?.message?.content?.trim() || "";
    const obj = safeJSONParse(txt, null);
    const answers = Array.isArray(obj?.answers) ? obj.answers : null;
    if (!answers) return quiz;

    const map = new Map();
    for (const a of answers) {
      const i = Number(a?.i);
      const ai = Number(a?.answerIndex);
      const ch = Array.isArray(a?.choices) ? a.choices : null;
      const ex = typeof a?.explanation === "string" ? a.explanation : "";

      if (!Number.isFinite(i) || !Number.isFinite(ai)) continue;
      const fixedAI = clamp(ai, 0, 3);

      const cleanedChoices = ch ? ensureValid4Choices(ch.map(stripLetterPrefix)) : null;
      if (!cleanedChoices) continue;

      map.set(i, { answerIndex: fixedAI, choices: cleanedChoices, explanation: ex.trim() });
    }

    const out = {
      questions: quiz.questions.map((q, i) => {
        if (!map.has(i)) return q;

        const v = map.get(i);
        const finalChoices = v.choices;
        const finalAI = clamp(v.answerIndex, 0, 3);

        // final guard: answerIndex must point to a non-bad choice
        if (isBadChoice(finalChoices[finalAI])) return q;

        return {
          question: String(q.question || "").trim(),
          choices: finalChoices,
          answerIndex: finalAI,
          explanation: v.explanation || String(q.explanation || "").trim(),
        };
      }),
    };

    return out;
  } catch (_) {
    return quiz;
  }
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
  const types = ["rect_area", "share", "percent_fill", "discount", "subtract", "multiply"];
  const pick = types[Math.floor(Math.random() * types.length)];

  if (pick === "multiply") {
    const a = 2 + Math.floor(Math.random() * 10);
    const b = 2 + Math.floor(Math.random() * 10);
    const ans = a * b;
    const base = makeIntChoices(ans);
    const choices = base.map((x) => String(x));
    const answerIndex = choices.indexOf(String(ans));
    return {
      question: `${a} * ${b} = ?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `${a} × ${b} = ${ans}`,
    };
  }

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
      explanation: `Area = ${L} × ${W} = ${ans}.`,
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
    const whole = 5 + Math.floor(Math.random() * 15);
    const priceStr = Math.random() < 0.5 ? `${whole}.50` : `${whole}.750`;
    const pct = [10, 15, 20, 25][Math.floor(Math.random() * 4)];

    const sale = exactSalePriceScaled(priceStr, String(pct));
    const answerText = sale ? moneyStrFromScaled(sale.scaled, sale.decimals) : `$${priceStr}`;

    const choices = sale
      ? makeMoneyChoicesExact(sale.scaled, sale.decimals)
      : [answerText, `$${whole}.00`, `$${whole}.25`, `$${whole}.75`];

    const answerIndex = choices.findIndex((c) => c === answerText);

    return {
      question: `A shop has a sale. An item normally costs $${priceStr}, but it's on sale for ${pct}% off. How much will you pay during the sale?`,
      choices,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      explanation: `Pay ${100 - pct}% (exact).`,
    };
  }

  // subtract
  const a = 6 + Math.floor(Math.random() * 14);
  const b = 1 + Math.floor(Math.random() * 5);
  const ans = a - b;
  const base = makeIntChoices(ans);
  const choices = base.map((x) => String(x));
  const answerIndex = choices.indexOf(String(ans));
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

    const { type, message, history = [], profile = null, mode = null, prompt = null } = req.body || {};
    
const userMsg = String(message || (typeof prompt === "string" ? prompt : "")).slice(0, 9000);

// ✅ lightweight mode for Frame18 Flappy commentary (returns {commentary})
if (mode === "flappy_commentary") {
  if (!client) {
    return res.status(200).json({ commentary: "AI not configured yet." });
  }
  const system18 = [
    "You are a witty, slightly snarky arcade game commentator.",
    "Keep it ultra short: max 15 words.",
    "Retro gamer tone. No emojis.",
  ].join("\n");

  const completion18 = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: system18 },
      { role: "user", content: userMsg || "Give a short retro gamer comment." }
    ],
    temperature: 0.9
  });

  const text18 = completion18?.choices?.[0]?.message?.content?.trim() || "Ouch. That had to hurt.";
  return res.status(200).json({ commentary: text18 });
}

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
    const isScramble = type === "scramble_game";

    // parse quiz payload (user sends JSON)
    let quizPayload = null;
    if (isQuiz || isScramble) quizPayload = safeJSONParse(userMsg, null);

    // ✅ deterministic math for education_quiz when topic looks math
    if (isQuiz && type === "education_quiz" && quizPayload && isLikelyMathTopic(quizPayload)) {
      const n = clamp(Number(quizPayload.numQuestions) || 8, 3, 15);
      const quiz = makeDeterministicMathQuiz(n);
      return res.status(200).json({ reply: JSON.stringify(quiz) });
    }

    const payload = {
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: system }, ...(isQuiz ? [] : cleanHistory), { role: "user", content: userMsg }],
      temperature: (isQuiz || isScramble) ? 0.2 : 0.7,
    };

    if (isQuiz || isScramble) payload.response_format = { type: "json_object" };

    const completion = await client.chat.completions.create(payload);
    const replyText = completion?.choices?.[0]?.message?.content?.trim() || "…";

    // ✅ Quiz pipeline: normalize -> local repair (math/first aid) -> verifier fixes choices+answerIndex
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);

      if (normalized) {
        // 1) local deterministic repairs (only when solvable)
        let repaired = repairQuizJSON(normalized, type);

        // 2) verifier returns CLEAN 4 choices + answerIndex (ONE call total)
        repaired = await verifyQuizWithLLM(repaired, type);

        // 3) final hard validation (no placeholders)
        repaired.questions = repaired.questions
  .map((q) => {
    const question = String(q.question || "").trim();
    const choices0 = ensureValid4Choices((q.choices || []).map(stripLetterPrefix));
    const answerIndex0 = clamp(Number(q.answerIndex), 0, 3);
    const explanation = String(q.explanation || "").trim();

    if (!question || !choices0) return null;
    if (!Number.isFinite(answerIndex0)) return null;
    if (isBadChoice(choices0[answerIndex0])) return null;

    // ✅ Shuffle choices so correct answer is NOT always choice #1
    const shuffled = shuffleChoicesKeepAnswer(choices0, answerIndex0);

    // guard อีกชั้น
    if (!ensureValid4Choices(shuffled.choices)) return null;
    if (isBadChoice(shuffled.choices[shuffled.answerIndex])) return null;

    return {
      question,
      choices: shuffled.choices,
      answerIndex: shuffled.answerIndex,
      explanation,
    };
  })
  .filter(Boolean);

        // If verifier somehow fails and leaves us empty, fallback for education_quiz only
        if (repaired.questions.length === 0 && type === "education_quiz") {
          const n = clamp(Number(quizPayload?.numQuestions) || 8, 3, 15);
          const quiz = makeDeterministicMathQuiz(n);
          return res.status(200).json({ reply: JSON.stringify(quiz) });
        }

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
