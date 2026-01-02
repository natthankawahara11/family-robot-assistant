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
    YoungAdult: ["Use practical, direct guidance.", "Offer options and pros/cons.", "No diagnosis or prescribing."],
    Adult: [
      "Practical, efficient guidance.",
      "Include options, trade-offs, and next steps.",
      "No diagnosis; recommend clinician when appropriate.",
    ],
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
        sports: ["Quiz may include fitness basics, training principles, injury prevention basics, sports rules, anatomy basics."],
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
      '      "answerIndex": 0,',
      '      "explanation": "short reason (1 sentence)"',
      "    }",
      "  ]",
      "}",
      "3) Exactly numQuestions questions.",
      "4) Always 4 choices. answerIndex must be 0..3 (IMPORTANT).",
      "5) Do NOT prefix choices with 'A)', 'B)'. Choices must be plain text only.",
      "6) NEVER use placeholders like 'Option 1', 'Option 2', 'True/False/Depends/Not sure'. Put real answers.",
      "7) Make choices specific and factual; avoid ambiguous options.",
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
      education: ["You are a patient tutor.", "Explain step-by-step, then give short practice questions and check answers.", "Adapt difficulty to the learner."],
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
  if (/^[A-D]$/i.test(t)) return true;
  if (/^option\s*\d+$/i.test(t)) return true;
  if (t === "—" || t === "-" || t === "_") return true;
  if (t.length <= 1) return true;

  const lower = t.toLowerCase();
  if (["true", "false", "not sure", "depends"].includes(lower)) return true;

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
  return choices.every((c) => isBadChoice(c)) || choices.some((c) => isBadChoice(c));
}

function choicesAreDuplicatey(choices) {
  const cleaned = choices.map((c) => norm(c)).filter(Boolean);
  const u = new Set(cleaned);
  return u.size < 4; // any duplicates -> risky
}

function tooManyShortChoices(choices) {
  const lens = choices.map((c) => String(c || "").trim().length);
  const shortCount = lens.filter((L) => L <= 2).length;
  return shortCount >= 2;
}

/* =========================================================
   ✅ NORMALIZE QUIZ JSON (force answerIndex 0..3)
   - also converts 1..4 -> 0..3 safely per-question
   ========================================================= */
function normalizeAnswerIndex(aiRaw) {
  if (!Number.isFinite(Number(aiRaw))) return null;
  let ai = Number(aiRaw);

  // common: 1..4 -> 0..3
  if (ai >= 1 && ai <= 4) ai = ai - 1;

  return clamp(ai, 0, 3);
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;

  const qsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  if (!qsRaw.length) return null;

  const clean = qsRaw
    .map((q) => {
      const rawChoices = Array.isArray(q.choices) ? q.choices : Array.isArray(q.options) ? q.options : [];
      const choices = sanitizeChoices(rawChoices);

      let ai = normalizeAnswerIndex(q.answerIndex);
      if (ai === null) ai = normalizeAnswerIndex(q.correctIndex);

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
   ✅ DISTRACTORS
   ========================================================= */
function makeIntChoices(correct) {
  const c = Number(correct);
  const pool = uniq([c, c + 1, c - 1, c + 2, c - 2, c + 3, c - 3, c + 5, c - 5, c * 2]).filter((x) => Number.isFinite(x));
  const out = [c];

  for (const v of pool) {
    if (out.length >= 4) break;
    if (!out.includes(v)) out.push(v);
  }

  while (out.length < 4) out.push(c + out.length);

  // shuffle
  return out.sort(() => Math.random() - 0.5);
}

/* =========================================================
   ✅ MATH SOLVER (EN + TH + EXPRESSIONS)
   - Fixes: unicode × ÷ − – and pure expressions
   ========================================================= */
function normalizeMathText(qText) {
  return String(qText || "")
    .trim()
    .replace(/＝/g, "=")
    .replace(/[×✕]/g, "x")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ");
}

function looksLikeMathQuestion(qText) {
  const t = normalizeMathText(qText);
  if (/[0-9]/.test(t) && /[+\-*/x]/i.test(t)) return true;
  if (/(คูณ|หาร|บวก|ลบ)/.test(t)) return true;
  return false;
}

function computeMathFromQuestionText(qText) {
  const raw = normalizeMathText(qText);
  const t = raw;

  // 0) Pure expression: "7-3=?" / "9 x 8 = ?" / "12/4?"
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

  // 1) Thai word forms
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

  if (t.includes("chok") || t.includes("สำลัก") || t.includes("ติดคอ")) {
    const correct = "Back slaps";
    const choices = ["Back slaps", "Give them a drink of water", "Tell them to lie down", "Wait and do nothing"];
    return { answerText: correct, choices, explanation: "Back slaps are a basic first-aid step for choking (and call emergency help if severe)." };
  }

  if (t.includes("bleed") || t.includes("cut") || t.includes("เลือด") || t.includes("บาดแผล")) {
    const correct = "Apply gentle pressure with a bandage";
    const choices = ["Apply gentle pressure with a bandage", "Apply heat to the area", "Apply soap to the area", "Leave it uncovered"];
    return { answerText: correct, choices, explanation: "Gentle direct pressure helps stop bleeding." };
  }

  return null;
}

/* =========================================================
   ✅ SMART VERIFY (ถูกขึ้นแต่ไม่หนักมาก)
   - Verify เฉพาะข้อเสี่ยง
   ========================================================= */
function shouldVerifyNonMath(fixed) {
  const weak = !fixed.explanation || fixed.explanation.trim().length < 10;
  const placeholders = hasPlaceholders(fixed.choices);
  const dup = choicesAreDuplicatey(fixed.choices);
  const shorty = tooManyShortChoices(fixed.choices);

  // ถ้า answerIndex ชี้ไปตัวห่วย ถือว่าเสี่ยง
  const ai = clamp(Number(fixed.answerIndex), 0, 3);
  const pointsBad = isBadChoice(fixed.choices?.[ai]);

  // ถ้าคำถามสั้นมากๆ + explanation อ่อน -> เสี่ยง
  const qShort = String(fixed.question || "").trim().length < 10;

  return placeholders || dup || shorty || pointsBad || (weak && qShort) || (weak && dup);
}

/* =========================================================
   ✅ LLM VERIFY (เลือกคำตอบที่ถูกจาก choices เดิม)
   - ใช้เมื่อข้อเสี่ยงเท่านั้น
   ========================================================= */
async function verifyAnswerIndexLLM(question, choices, quizType) {
  if (!client) return null;

  const sys = [
    "You are a strict multiple-choice answer checker.",
    "Return ONLY valid JSON.",
    'Schema: { "answerIndex": 0, "explanation": "one short sentence", "confident": true }',
    "Rules:",
    "- answerIndex must be 0..3 and must match the correct choice.",
    "- If none are perfect, choose the best one and set confident=false.",
    `Quiz type: ${quizType}`,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify({ question, choices }) },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const txt = completion?.choices?.[0]?.message?.content?.trim() || "";
    const obj = safeJSONParse(txt, null);
    if (!obj) return null;

    const ai = normalizeAnswerIndex(obj.answerIndex);
    if (ai === null) return null;

    return {
      answerIndex: ai,
      explanation: String(obj.explanation || "").trim(),
      confident: Boolean(obj.confident),
    };
  } catch (_) {
    return null;
  }
}

/* =========================================================
   ✅ REGEN (สร้าง choices ใหม่ให้มีคำตอบถูกจริง 1 ข้อ)
   - เรียกเฉพาะตอน "แย่จริงๆ" เพื่อไม่หนัก
   ========================================================= */
async function regenQuestionLLM(question, quizType) {
  if (!client) return null;

  const sys = [
    "You are a quiz fixer that MUST produce exactly one best correct answer among the choices.",
    "Return ONLY valid JSON.",
    'Schema: { "choices": ["a","b","c","d"], "answerIndex": 0, "explanation": "one short sentence" }',
    "Rules:",
    "- Exactly 4 choices.",
    "- answerIndex must be 0..3 and must correspond to the correct choice.",
    "- Choices must be specific and factual. Avoid vague options.",
    "- NEVER output placeholders like Option 1/2, True/False, Depends, Not sure, or empty strings.",
    "- Avoid ambiguity; ensure one best answer.",
    `Quiz type: ${quizType}`,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify({ question }) },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const txt = completion?.choices?.[0]?.message?.content?.trim() || "";
    const obj = safeJSONParse(txt, null);
    if (!obj) return null;

    const choices = sanitizeChoices(obj.choices);
    const ai = normalizeAnswerIndex(obj.answerIndex);
    const explanation = String(obj.explanation || "").trim();

    if (ai === null) return null;
    if (hasPlaceholders(choices) || choicesAreDuplicatey(choices)) return null;

    return { choices, answerIndex: ai, explanation };
  } catch (_) {
    return null;
  }
}

/* =========================================================
   ✅ REPAIR SINGLE QUESTION (ALWAYS 0..3)
   - Math is always hard-fixed (override choices+answerIndex)
   - Non-math: Smart verify only when risky
   ========================================================= */
async function repairQuizQuestion(q, quizType) {
  let fixed = {
    question: String(q.question || "").trim(),
    choices: sanitizeChoices(q.choices),
    answerIndex: normalizeAnswerIndex(q.answerIndex) ?? 0,
    explanation: String(q.explanation || "").trim(),
  };

  // 1) healthcare hard-fix
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

  // 2) math hard-fix for ANY quiz if it looks like math
  if (looksLikeMathQuestion(fixed.question)) {
    const solved = computeMathFromQuestionText(fixed.question);
    if (solved) {
      const n = solved.answerNum;

      if (Number.isFinite(n)) {
        const base = makeIntChoices(n);
        fixed.choices = base.map((x) => String(x));
        fixed.answerIndex = fixed.choices.indexOf(String(n));
        if (fixed.answerIndex < 0) fixed.answerIndex = 0;
        fixed.explanation = solved.explanation || fixed.explanation;
        return fixed;
      }

      // decimal
      const correct = solved.answerText;
      const numeric = Number(correct);
      const pool = uniq([
        correct,
        Number.isFinite(numeric) ? String(numeric + 1) : correct,
        Number.isFinite(numeric) ? String(numeric - 1) : correct,
        Number.isFinite(numeric) ? String(numeric + 2) : correct,
        Number.isFinite(numeric) ? String(numeric - 2) : correct,
      ]).slice(0, 4);

      while (pool.length < 4) pool.push(correct);
      fixed.choices = pool.sort(() => Math.random() - 0.5);
      fixed.answerIndex = fixed.choices.findIndex((c) => norm(c) === norm(correct));
      if (fixed.answerIndex < 0) fixed.answerIndex = 0;
      fixed.explanation = solved.explanation || fixed.explanation;
      return fixed;
    }

    // looks like math but cannot solve -> regen once
    const regen = await regenQuestionLLM(fixed.question, quizType);
    if (regen) {
      fixed.choices = regen.choices;
      fixed.answerIndex = regen.answerIndex;
      fixed.explanation = regen.explanation || fixed.explanation;
      return fixed;
    }
  }

  // 3) non-math: Smart verify only when risky (ประหยัด)
  //    - ถ้า placeholders หนัก -> regen ก่อน (1 call)
  const risky = shouldVerifyNonMath(fixed);

  if (hasPlaceholders(fixed.choices)) {
    const regen = await regenQuestionLLM(fixed.question, quizType);
    if (regen) {
      fixed.choices = regen.choices;
      fixed.answerIndex = regen.answerIndex;
      fixed.explanation = regen.explanation || fixed.explanation;
      // regen แล้วถือว่าพอ ไม่ต้อง verify ซ้ำ
    }
  } else if (risky) {
    // verify (1 call) เฉพาะตอนเสี่ยง
    const v = await verifyAnswerIndexLLM(fixed.question, fixed.choices, quizType);
    if (v) {
      fixed.answerIndex = clamp(v.answerIndex, 0, 3);
      if (v.explanation) fixed.explanation = v.explanation;

      // ถ้าไม่มั่นใจจริงๆ ค่อย regen (เพิ่มอีก 1 call เฉพาะบางข้อ)
      if (!v.confident) {
        const regen = await regenQuestionLLM(fixed.question, quizType);
        if (regen) {
          fixed.choices = regen.choices;
          fixed.answerIndex = regen.answerIndex;
          fixed.explanation = regen.explanation || fixed.explanation;
        }
      }
    }
  }

  // 4) final guards
  fixed.choices = sanitizeChoices(fixed.choices);
  fixed.answerIndex = clamp(Number(fixed.answerIndex), 0, 3);

  if (isBadChoice(fixed.choices[fixed.answerIndex])) {
    const firstGood = fixed.choices.findIndex((c) => !isBadChoice(c));
    fixed.answerIndex = firstGood >= 0 ? firstGood : 0;
  }

  // ถ้าช้อยส์ยังซ้ำๆ/แปลกๆ มาก ให้กันไว้ (ไม่ regen เพื่อไม่หนัก)
  if (choicesAreDuplicatey(fixed.choices)) {
    // แค่ rotate ให้ไม่พัง UI (ทางเลือกเบาๆ)
    const rotated = fixed.choices.slice(1).concat([fixed.choices[0]]);
    fixed.choices = rotated;
    fixed.answerIndex = clamp(fixed.answerIndex, 0, 3);
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
   ✅ deterministic math quiz (guaranteed correct)
   - use when payload topic looks like math in ANY quiz type
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
    "subtraction",
    "addition",
    "arithmetic",
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

  if (/[0-9]/.test(topic) && /[+\-*/x×÷]/i.test(topic)) return true;

  if (
    grade.includes("grade 1") ||
    grade.includes("grade 2") ||
    grade.includes("grade 3") ||
    grade.includes("grade 4") ||
    grade.includes("grade 5") ||
    grade.includes("grade 6")
  ) {
    if (topic.includes("number") || topic.includes("basic") || topic.includes("times table")) return true;
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
    const base = makeIntChoices(ans);
    const choices = base.map(String);
    return { question: `${a} × ${b} = ?`, choices, answerIndex: choices.indexOf(String(ans)), explanation: `${a} × ${b} = ${ans}` };
  }

  if (pick === "sub") {
    const a = randInt(5, 30);
    const b = randInt(1, 12);
    const ans = a - b;
    const base = makeIntChoices(ans);
    const choices = base.map(String);
    return { question: `${a} - ${b} = ?`, choices, answerIndex: choices.indexOf(String(ans)), explanation: `${a} - ${b} = ${ans}` };
  }

  if (pick === "div") {
    const b = randInt(2, 12);
    const ans = randInt(2, 12);
    const a = b * ans;
    const base = makeIntChoices(ans);
    const choices = base.map(String);
    return { question: `${a} ÷ ${b} = ?`, choices, answerIndex: choices.indexOf(String(ans)), explanation: `${a} ÷ ${b} = ${ans}` };
  }

  const a = randInt(1, 30);
  const b = randInt(1, 30);
  const ans = a + b;
  const base = makeIntChoices(ans);
  const choices = base.map(String);
  return { question: `${a} + ${b} = ?`, choices, answerIndex: choices.indexOf(String(ans)), explanation: `${a} + ${b} = ${ans}` };
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
      ? history.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12)
      : [];

    const system = buildSystemPrompt(type, profile);
    const isQuiz = typeof type === "string" && type.endsWith("_quiz");

    // parse quiz payload (user sends JSON)
    let quizPayload = null;
    if (isQuiz) quizPayload = safeJSONParse(userMsg, null);

    // ✅ deterministic math for ANY quiz type when topic looks math (guaranteed correct)
    if (isQuiz && quizPayload && isLikelyMathTopic(quizPayload)) {
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

    // ✅ Quiz: normalize + repair (math forced correct + smart verify + index 0..3)
    if (isQuiz) {
      const obj = safeJSONParse(replyText, null);
      const normalized = normalizeQuizJSON(obj);

      if (normalized) {
        const repaired = await repairQuizJSON(normalized, type);

        // Final harden
        const hardened = {
          questions: repaired.questions.map((q) => {
            const choices = sanitizeChoices(q.choices);
            let ai = normalizeAnswerIndex(q.answerIndex);
            if (ai === null) ai = 0;

            if (isBadChoice(choices[ai])) {
              const firstGood = choices.findIndex((x) => !isBadChoice(x));
              ai = firstGood >= 0 ? firstGood : 0;
            }

            return {
              question: String(q.question || "").trim(),
              choices,
              answerIndex: clamp(ai, 0, 3),
              explanation: String(q.explanation || "").trim(),
            };
          }),
        };

        return res.status(200).json({ reply: JSON.stringify(hardened) });
      }

      // fallback: ถ้า LLM ส่ง JSON พัง ให้กลับเป็นคณิต deterministic (กันพัง UI)
      const fallbackN = clamp(Number(quizPayload?.numQuestions) || 8, 3, 15);
      const fallback = makeDeterministicMathQuiz(fallbackN);
      return res.status(200).json({ reply: JSON.stringify(fallback) });
    }

    return res.status(200).json({ reply: replyText });
  } catch (err) {
    console.error("CHAT_API_ERROR:", err);
    return res.status(200).json({ reply: "AI is temporarily unavailable. Please try again in a moment." });
  }
};
