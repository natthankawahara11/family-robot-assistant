// ✅ same-origin เสมอ
const SERVER_BASE = window.location.origin;

// =========================================================
// ✅ LOCAL STORAGE
// =========================================================
const LS_PROFILES_KEY = "fra_profiles_v1";
const LS_CHATS_KEY = "fra_chats_v2";
const LS_STATE_KEY = "fra_state_v1";

function safeJSONParse(s, fallback) {
  try { return JSON.parse(s); } catch (_) { return fallback; }
}
function lsGet(key, fallback) {
  return safeJSONParse(localStorage.getItem(key) || "", fallback);
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

let _saveTimer = null;
function scheduleSaveAll() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    lsSet(LS_PROFILES_KEY, profiles);
    lsSet(LS_CHATS_KEY, chatDBByProfile);
    lsSet(LS_STATE_KEY, {
      currentProfileId: currentProfile?.id || null,
      micLang
    });
  }, 150);
}

// =========================================================
// ✅ PRELOAD SYSTEM (iPhone-safe staged preload)
// =========================================================
const bootLoader = document.getElementById('bootLoader');
const bootBarFill = document.getElementById('bootBarFill');
const bootStatus = document.getElementById('bootStatus');
const bootPercent = document.getElementById('bootPercent');

let bootReady = false;

function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";

    img.onload = async () => {
      if (!isIOS()) {
        try { if (img.decode) await img.decode(); } catch (_) {}
      }
      resolve({ url, ok: true });
    };

    img.onerror = () => resolve({ url, ok: false });
    img.src = url;
  });
}

function preloadVideo(url) {
  return new Promise((resolve) => {
    fetch(url, { cache: "force-cache" })
      .then(() => resolve({ url, ok: true }))
      .catch(() => resolve({ url, ok: false }));
  });
}

function cssBgUrls() {
  return [
    "Pic4.png","Pic5.png","Pic12.png","Pic14.png","Pic15.png","Pic17.png","Pic18.png",
    "Quiz_Background.png"
  ];
}

function domImgUrls() {
  return [
    "Pic1.png","Pic2.png","Pic3.png",
    "Pic6.png","Pic7.png","Pic8.png","Pic9.png","Pic10.png","Pic11.png",
    "Pic13.png",
    "Profile1.png","Profile2.png","Profile3.png","Profile4.png","Profile5.png",
    "Profile6.png","Profile7.png","Profile8.png","Profile9.png","Profile10.png",
    "ProfileAdd.png",
    "Pic16.png",
    "Bluetooth.png",
    "Card1.png","Card2.png","Card3.png","Card4.png","Card5.png","Card6.png",
    "Card_Quiz1.png","Card_Quiz2.png","Card_Quiz3.png","Card_Quiz4.png",
    "Fix_Menu.png",
    "ChatBot_GoBack.png",
    "ChatBot_Add.png","ChatBot_Mic.png","ChatBot_Send.png",
    "ChatBot_No.png","ChatBot_Yes.png",
  ];
}

async function preloadAssets() {
  const imgs = uniq([...cssBgUrls(), ...domImgUrls()]);
  const vids = ["Face.webm"];

  const tasks = [
    ...imgs.map(u => ({ type: "img", url: u })),
    ...vids.map(u => ({ type: "vid", url: u })),
  ];

  let done = 0;
  const total = tasks.length || 1;

  function updateUI(label) {
    const pct = Math.round((done / total) * 100);
    if (bootBarFill) bootBarFill.style.width = pct + "%";
    if (bootPercent) bootPercent.textContent = pct + "%";
    if (label && bootStatus) bootStatus.textContent = label;
  }

  updateUI("Starting…");

  const fontsPromise = (document.fonts && document.fonts.ready)
    ? document.fonts.ready.catch(() => null)
    : Promise.resolve(null);

  for (const t of tasks) {
    try {
      if (t.type === "img") await preloadImage(t.url);
      else await preloadVideo(t.url);
    } catch (_) {}
    done++;
    updateUI(`Loading: ${t.url}`);
  }

  updateUI("Finalizing…");
  await Promise.race([fontsPromise, new Promise(r => setTimeout(r, 600))]);

  if (bootLoader) {
    bootLoader.classList.add('hidden');
    bootLoader.style.pointerEvents = 'none';
  }

  bootReady = true;
}
preloadAssets();

// =========================================================
// ✅ DIRECTION LOCK HELPERS
// =========================================================
function directionLockState() {
  return { locked: false, isHorizontal: false, sx: 0, sy: 0 };
}
function shouldLockHorizontal(lock, x, y, threshold = 10) {
  const dx = x - lock.sx;
  const dy = y - lock.sy;

  if (!lock.locked) {
    if (Math.abs(dx) + Math.abs(dy) < threshold) return null;
    lock.locked = true;
    lock.isHorizontal = Math.abs(dx) > Math.abs(dy);
  }
  return lock.isHorizontal;
}

// =========================================================
// ✅ APP DOM
// =========================================================
const frameVideo = document.getElementById('frameVideo');

const frame1 = document.querySelector('.frame-1');
const frame2 = document.querySelector('.frame-2');
const frame3 = document.querySelector('.frame-3');
const frameAvatar = document.getElementById('frameAvatar');
const frame4 = document.getElementById('frame4');
const frame5 = document.getElementById('frame5');
const frame6 = document.getElementById('frame6');
const frame7 = document.getElementById('frame7');

// ✅ quiz frames
const frame8 = document.getElementById('frame8');
const frame9 = document.getElementById('frame9');
const frame10 = document.getElementById('frame10');

// ✅ game frames (11–14)
const frame11 = document.getElementById('frame11'); // Scramble setup
const frame12 = document.getElementById('frame12'); // TicTacToe setup
const frame13 = document.getElementById('frame13'); // Scramble play
const frame14 = document.getElementById('frame14'); // TicTacToe play

// ---- Scramble UI ----
const scrambleStageSetup = document.getElementById('scrambleStageSetup');
const scrambleStagePlay  = document.getElementById('scrambleStagePlay');

const scrambleBackBtn1 = document.getElementById('scrambleBackBtn1');
const scrambleBackBtn2 = document.getElementById('scrambleBackBtn2');

const scrambleSetupTitle = document.getElementById('scrambleSetupTitle');
const scrambleTopicInput = document.getElementById('scrambleTopicInput');
const scrambleCountSelect = document.getElementById('scrambleCountSelect');
const scrambleDifficultySelect = document.getElementById('scrambleDifficultySelect');
const scrambleTimerSelect = document.getElementById('scrambleTimerSelect');
const scrambleStartBtn = document.getElementById('scrambleStartBtn');
const scrambleSetupHint = document.getElementById('scrambleSetupHint');

const scrambleProgress = document.getElementById('scrambleProgress');
const scrambleTimerPill = document.getElementById('scrambleTimerPill');
const scrambleWordText = document.getElementById('scrambleWordText');
const scrambleHintText = document.getElementById('scrambleHintText');
const scrambleGuessInput = document.getElementById('scrambleGuessInput');
const scrambleCheckBtn = document.getElementById('scrambleCheckBtn');
const scrambleNextBtn = document.getElementById('scrambleNextBtn');
const scrambleFeedback = document.getElementById('scrambleFeedback');

// ---- TicTacToe UI ----
const tttStageSetup = document.getElementById('tttStageSetup');
const tttStagePlay  = document.getElementById('tttStagePlay');

const tttBackBtn1 = document.getElementById('tttBackBtn1');
const tttBackBtn2 = document.getElementById('tttBackBtn2');

const tttSetupTitle = document.getElementById('tttSetupTitle');
const tttModeBtns = Array.from(document.querySelectorAll('[data-ttt-mode]'));
const tttSideBtns = Array.from(document.querySelectorAll('[data-ttt-side]'));
const tttDiffSelect = document.getElementById('tttDiffSelect');
const tttStartBtn = document.getElementById('tttStartBtn');
const tttSetupHint = document.getElementById('tttSetupHint');

const tttStatus = document.getElementById('tttStatus');
const tttGrid = document.getElementById('tttGrid');
const tttRestartBtn = document.getElementById('tttRestartBtn');

const quizStageSetup = document.getElementById('quizStageSetup');
const quizStagePlay = document.getElementById('quizStagePlay');
const quizStageResult = document.getElementById('quizStageResult');

const quizBackBtn1 = document.getElementById('quizBackBtn1');
const quizBackBtn2 = document.getElementById('quizBackBtn2');
const quizBackBtn3 = document.getElementById('quizBackBtn3');

const quizSetupTitle = document.getElementById('quizSetupTitle');
const quizTopicLabel = document.getElementById('quizTopicLabel');
const quizTopicInput = document.getElementById('quizTopicInput');
const quizCountSelect = document.getElementById('quizCountSelect');
const quizGradeSelect = document.getElementById('quizGradeSelect');
const quizDifficultySelect = document.getElementById('quizDifficultySelect');
const quizTimerSelect = document.getElementById('quizTimerSelect');
const quizStartBtn = document.getElementById('quizStartBtn');
const quizSetupHint = document.getElementById('quizSetupHint');

const quizProgress = document.getElementById('quizProgress');
const quizTimerPill = document.getElementById('quizTimerPill');
const quizQuestionText = document.getElementById('quizQuestionText');
const quizChoices = document.getElementById('quizChoices');
const quizNextBtn = document.getElementById('quizNextBtn');
const quizFeedback = document.getElementById('quizFeedback');

const quizScoreText = document.getElementById('quizScoreText');
const quizCongratsText = document.getElementById('quizCongratsText');
const quizPlayAgainBtn = document.getElementById('quizPlayAgainBtn');
const quizBackHomeBtn = document.getElementById('quizBackHomeBtn');

const option1 = document.getElementById('welcomeOption1');
const option2 = document.getElementById('welcomeOption2');

const slider = document.getElementById('slider');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const frame2Close = document.getElementById('frame2CloseBtn');

const dot1 = document.getElementById('dot1');
const dot2 = document.getElementById('dot2');
const dot3 = document.getElementById('dot3');

const frame3Back = document.getElementById('frame3Back');
const frame3Next = document.getElementById('frame3Next');
const avatarBtn = document.getElementById('avatarBtn');
const avatarImage = document.getElementById('avatarImage');
const nicknameInput = document.getElementById('nicknameInput');

const profileOptions = document.querySelectorAll('.frame-avatar .profile-option');

const frame4Back = document.getElementById('frame4Back');
const frame4Next = document.getElementById('frame4Next');

const ageWheel = document.getElementById('ageWheel');
const ageNumberBig = document.getElementById('ageNumberBig');
const ageBandLabel = document.getElementById('ageBandLabel');

const profilesList = document.getElementById('profilesList');

const frame6ProfileImg = document.getElementById('frame6ProfileImg');
const frame6ProfileBtn = document.getElementById('frame6ProfileBtn');
const tabHighlight = document.getElementById('tabHighlight');
const tabHome = document.getElementById('tabHome');
const tabHealthcare = document.getElementById('tabHealthcare');
const tabSports = document.getElementById('tabSports');
const tabEducation = document.getElementById('tabEducation');
const tabCommunity = document.getElementById('tabCommunity');
const homeCardsWrapper = document.getElementById('homeCards');
const homeCardsTrack = document.getElementById('homeCardsTrack');

const chatStage = document.getElementById('chatStage');
const chatTitle = document.getElementById('chatTitle');
const chatHistory = document.getElementById('chatHistory');
const chatInput = document.getElementById('chatInput');
const tapToAsk = document.getElementById('tapToAsk');
const chatBackBtn = document.getElementById('chatBackBtn');

const chatAdd = document.getElementById('chatAdd');
const chatMic = document.getElementById('chatMic');
const chatSend = document.getElementById('chatSend');
const chatMicImg = document.getElementById('chatMicImg');
const chatSendImg = document.getElementById('chatSendImg');

const voiceCenter = document.getElementById('voiceCenter');
const voiceTime = document.getElementById('voiceTime');
const voiceWave = document.getElementById('voiceWave');

const filePicker = document.getElementById('filePicker');

const micLangWrap = document.getElementById('micLangWrap');
const micLangBtn = document.getElementById('micLangBtn');
const micLangMenu = document.getElementById('micLangMenu');

const newChatBtn = document.getElementById('newChatBtn');
const threadsList = document.getElementById('threadsList');
const threadHeader = document.getElementById('threadHeader');

const deleteModal = document.getElementById('deleteModal');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteYesBtn = document.getElementById('deleteYesBtn');

// =========================================================
// ✅ STATE + RESTORE
// =========================================================
const totalSlides = 3;
let currentIndex = 0;
let startX = 0;
let startTranslate = 0;
let isDragging = false;
let sliderWidth = 0;

let sliderLock = directionLockState();
let homeLock = directionLockState();

let profiles = lsGet(LS_PROFILES_KEY, []);
let chatDBByProfile = lsGet(LS_CHATS_KEY, {});
const savedState = lsGet(LS_STATE_KEY, { currentProfileId: null, micLang: "en-US" });

let deleteModeId = null;
let currentProfile = null;

let micLang = (savedState?.micLang === "th-TH") ? "th-TH" : "en-US";

if (profiles.length > 0) {
  const id = savedState?.currentProfileId;
  currentProfile = profiles.find(p => p?.id === id) || profiles[0];
}

// =========================================================
// ✅ CHAT THREADS MODEL + MIGRATION
// =========================================================
function ensureChatBucket(profileId) {
  if (!profileId) return null;

  const fresh = () => ({
    healthcare: { threads: [], activeThreadId: null },
    sports: { threads: [], activeThreadId: null },
    education: { threads: [], activeThreadId: null },
    community: { threads: [], activeThreadId: null },
  });

  if (!chatDBByProfile[profileId]) {
    chatDBByProfile[profileId] = fresh();
    return chatDBByProfile[profileId];
  }

  const old = chatDBByProfile[profileId];
  ["healthcare","sports","education","community"].forEach((k) => {
    if (Array.isArray(old[k])) {
      const id = "t_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      old[k] = { threads: [{ id, title: "Chat 1", messages: old[k] }], activeThreadId: id };
    } else if (!old[k]) {
      old[k] = { threads: [], activeThreadId: null };
    } else {
      old[k].threads ||= [];
      old[k].activeThreadId ||= (old[k].threads[0]?.id || null);
    }
  });

  return old;
}

function getActiveChatDB() {
  const pid = currentProfile?.id;
  if (!pid) return {
    healthcare: { threads: [], activeThreadId: null },
    sports: { threads: [], activeThreadId: null },
    education: { threads: [], activeThreadId: null },
    community: { threads: [], activeThreadId: null },
  };
  return ensureChatBucket(pid);
}

function getTypeStore(type) {
  const db = getActiveChatDB();
  db[type] ||= { threads: [], activeThreadId: null };
  return db[type];
}

function createNewThread(type, autoRender = true) {
  const store = getTypeStore(type);
  const nextNum = store.threads.length + 1;
  const id = "t_" + Date.now() + "_" + Math.random().toString(16).slice(2);

  const thread = { id, title: `Chat ${nextNum}`, messages: [] };
  store.threads.unshift(thread);
  store.activeThreadId = id;

  scheduleSaveAll();
  if (autoRender) {
    renderThreadsList();
    renderChatHistory(type);
    updateThreadHeader();
  }
  return thread;
}

function getActiveThread(type) {
  const store = getTypeStore(type);
  let t = store.threads.find(x => x.id === store.activeThreadId);
  if (!t) t = createNewThread(type, false);
  return t;
}

function setActiveThread(type, threadId) {
  const store = getTypeStore(type);
  if (!store.threads.some(t => t.id === threadId)) return;
  store.activeThreadId = threadId;
  scheduleSaveAll();
  renderThreadsList();
  renderChatHistory(type);
  updateThreadHeader();
}

let activeChatType = "healthcare";

function updateThreadHeader() {
  if (!threadHeader) return;
  const t = getActiveThread(activeChatType);
  threadHeader.textContent = t?.title || "History";
}

function renderThreadsList() {
  if (!threadsList) return;
  const store = getTypeStore(activeChatType);
  threadsList.innerHTML = "";

  store.threads.forEach((t) => {
    const row = document.createElement("div");
    row.className = "thread-item" + (t.id === store.activeThreadId ? " active" : "");

    const title = document.createElement("div");
    title.className = "thread-title";
    title.textContent = t.title;

    row.appendChild(title);

    row.addEventListener("click", () => setActiveThread(activeChatType, t.id));
    row.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveThread(activeChatType, t.id);
    }, { passive: false });

    threadsList.appendChild(row);
  });
}

if (currentProfile?.id) ensureChatBucket(currentProfile.id);

// =========================================================
// ✅ AGE BAND
// =========================================================
function ageBandFromNumber(n) {
  const a = Math.max(0, Math.min(140, Math.round(Number(n) || 0)));

  if (a <= 2)  return { ageKey: "Baby",       ageText: "Baby Age: 0–2" };
  if (a <= 5)  return { ageKey: "Child",      ageText: "Child Age: 3–5" };
  if (a <= 8)  return { ageKey: "YoungChild", ageText: "Young Child Age: 6–8" };
  if (a <= 12) return { ageKey: "PreTeen",    ageText: "Pre-Teen Age: 9–12" };
  if (a <= 17) return { ageKey: "Teen",       ageText: "Teen Age: 13–17" };
  if (a <= 24) return { ageKey: "YoungAdult", ageText: "Young Adult Age: 18–24" };
  if (a <= 34) return { ageKey: "Adult",      ageText: "Adult Age: 25–34" };
  if (a <= 44) return { ageKey: "MidAdult",   ageText: "Mid Adult Age: 35–44" };
  if (a <= 54) return { ageKey: "OlderAdult", ageText: "Older Adult Age: 45–54" };
  if (a <= 64) return { ageKey: "Senior",     ageText: "Senior Age: 55–64" };
  if (a <= 74) return { ageKey: "Elderly",    ageText: "Elderly Age: 65–74" };
  return        { ageKey: "VeryElderly", ageText: "Very Elderly Age: 75+" };
}

function defaultGradeByAge(profile) {
  const a = Number(profile?.ageNumber);
  if (!Number.isFinite(a)) return "Grade 7–9";
  if (a <= 5) return "Kindergarten";
  if (a <= 8) return "Grade 1–3";
  if (a <= 12) return "Grade 4–6";
  if (a <= 15) return "Grade 7–9";
  if (a <= 17) return "Grade 10–12";
  if (a <= 24) return "University";
  return "Professional";
}

// =========================================================
// ✅ TABS / HOME CARDS
// =========================================================
const tabConfig = {
  home: { left: 174, width: 76 },
  healthcare: { left: 259, width: 115 },
  sports: { left: 374, width: 143 },
  education: { left: 516, width: 107 },
  community: { left: 623, width: 122 }
};

let currentTabName = 'home';
let lastFrame6Tab = 'home';

const HOME_CARD_WIDTH = 340;
const HOME_CARD_GAP = 17;
const HOME_STEP = HOME_CARD_WIDTH + HOME_CARD_GAP;

let homeIndex = 0;
let lastHomeIndex = 0;
let homeStartX = 0;
let homeStartTranslate = 0;
let homeDragging = false;
let homeMinTranslate = 0;
let homeMaxTranslate = 0;
let homeLastX = 0;
let homeLastTime = 0;
let homeVelocity = 0;

// ---- VIDEO / IDLE STATE ----
let startupMode = true;
let startupTimer = null;
let idleTimer = null;
let isVideoVisible = false;
let lastActiveFrame = null;

// =========================================================
// ✅ FRAME NAV
// =========================================================
function hideAllFrames() {
  [
    frame1, frame2, frame3, frameAvatar, frame4, frame5, frame6, frame7,
    frame8, frame9, frame10,
    frame11, frame12, frame13, frame14
  ].forEach(f => { if (f) f.style.display = 'none'; });
}

function goToFrame1() {
  hideAllFrames();
  if (frame1) frame1.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic4.png")';
  lastActiveFrame = 'frame1';
}

function goToFrame2() {
  hideAllFrames();
  if (frame2) frame2.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic5.png")';

  updateSliderSize();
  setIndex(0, false);
  requestAnimationFrame(() => {
    if (slider) slider.style.transition = 'transform 0.25s ease';
  });
  lastActiveFrame = 'frame2';
}

function goToFrame3New() {
  hideAllFrames();
  if (frame3) frame3.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic12.png")';
  if (nicknameInput) {
    nicknameInput.value = '';
    nicknameInput.placeholder = 'Nickname';
  }
  if (avatarImage) avatarImage.src = 'Pic13.png';
  lastActiveFrame = 'frame3';
}

function goToFrame3Keep() {
  hideAllFrames();
  if (frame3) frame3.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic12.png")';
  lastActiveFrame = 'frame3';
}

function goToAvatarFrame() {
  hideAllFrames();
  if (frameAvatar) frameAvatar.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic14.png")';
  lastActiveFrame = 'frameAvatar';
}

function goToFrame4Age() {
  hideAllFrames();
  if (frame4) frame4.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic15.png")';
  lastActiveFrame = 'frame4';
  initAgeWheelIfNeeded();
  scrollAgeWheelTo(ageNumber);
}

function goToFrame5Accounts() {
  hideAllFrames();
  if (frame5) frame5.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic15.png")';
  renderProfiles();
  lastActiveFrame = 'frame5';
}

function goToFrame6(preferredTab = null) {
  if (!currentProfile && profiles.length > 0) currentProfile = profiles[0];
  if (currentProfile?.id) ensureChatBucket(currentProfile.id);

  hideAllFrames();
  if (frame6) frame6.style.display = 'block';
  document.body.style.backgroundImage = 'url("Pic17.png")';

  if (currentProfile && frame6ProfileImg) frame6ProfileImg.src = currentProfile.avatarSrc;

  const tabToUse = preferredTab || 'home';
  setActiveTab(tabToUse);

  if (tabToUse === "home") setHomeIndex(lastHomeIndex || 0, false);

  lastActiveFrame = 'frame6';
  scheduleSaveAll();
}

function restoreLastFrame() {
  switch (lastActiveFrame) {
    case 'frame1': goToFrame1(); break;
    case 'frame2': goToFrame2(); break;
    case 'frame3': goToFrame3Keep(); break;
    case 'frameAvatar': goToAvatarFrame(); break;
    case 'frame4': goToFrame4Age(); break;
    case 'frame5': goToFrame5Accounts(); break;
    case 'frame6': goToFrame6(); break;
    case 'frame7': goToFrame7(activeChatType); break;
    case 'frame8': goToFrame8(currentQuizTab || "healthcare"); break;
    case 'frame9': goToFrame9(); break;
    case 'frame10': goToFrame10(); break;
    case 'frame11': goToFrame11(currentGameTab || "education"); break;
    case 'frame12': goToFrame12(currentGameTab || "education"); break;
    case 'frame13': goToFrame13(); break;
    case 'frame14': goToFrame14(); break;
    default: goToFrame1(); break;
  }
}

// =========================================================
// ✅ VIDEO OVERLAY
// =========================================================
function showVideoOverlay() {
  if (!frameVideo) return;
  frameVideo.style.display = 'flex';
  frameVideo.style.pointerEvents = 'auto';
  isVideoVisible = true;
}

function hideVideoOverlay() {
  if (!frameVideo) return;
  frameVideo.style.display = 'none';
  frameVideo.style.pointerEvents = 'none';
  isVideoVisible = false;
}

if (frameVideo) frameVideo.style.pointerEvents = 'none';
if (bootLoader) bootLoader.style.pointerEvents = 'auto';

function startIdleTimer() {
  if (startupMode) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!startupMode && !isVideoVisible) showVideoOverlay();
  }, 20000);
}

function handleUserInteraction(e) {
  if (!bootReady) return;

  if (e && e.target) {
    const block = e.target.closest(
      '.frame6-profile, .frame6-card, .frame6-card-menu, .frame6-tab, #tabHighlight,' +
      '.chat-icon, .chat-input, .profile-card, .profile-option, .option-card, ' +
      '.frame2-btn-left, .frame2-btn-right, .frame2-close, .mic-lang, .mini-btn, .thread-item,' +
      '.modal, .modal-card, .modal-btn, .quiz-primary, .quiz-secondary, .quiz-input, .quiz-select, .quiz-choice, .quiz-back,' +
      '.game-primary, .game-secondary, .toggle-btn, .ttt-cell, .game-back'
    );
    if (block) return;
  }

  if (isVideoVisible) {
    hideVideoOverlay();

    if (startupMode) {
      startupMode = false;
      clearTimeout(startupTimer);
      goToFrame1();
    } else {
      restoreLastFrame();
    }
    startIdleTimer();
  } else {
    if (!startupMode) startIdleTimer();
  }
}

(function bootFlow() {
  const t = setInterval(() => {
    if (!bootReady) return;
    clearInterval(t);

    showVideoOverlay();
    startupMode = true;

    startupTimer = setTimeout(() => {
      if (startupMode) {
        startupMode = false;
        hideVideoOverlay();
        goToFrame1();
        startIdleTimer();
      }
    }, 20000);

    ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(evt => {
      document.addEventListener(evt, handleUserInteraction, { passive: true });
    });
  }, 30);
})();

// =========================================================
// ✅ TAP BINDER
// =========================================================
function bindTap(el, fn) {
  if (!el) return;
  el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); }, { passive: false });
}

// =========================================================
// ✅ SLIDER (Frame2)
// =========================================================
function updateDots() {
  const dots = [dot1, dot2, dot3].filter(Boolean);
  dots.forEach(dot => {
    dot.style.background = 'transparent';
    dot.style.border = '3px solid rgba(0,0,0,0.45)';
  });

  if (!dot1 || !dot2 || !dot3) return;

  if (currentIndex === 0) { dot1.style.background = 'rgba(0,0,0,0.65)'; dot1.style.border = 'none'; }
  else if (currentIndex === 1) { dot2.style.background = 'rgba(0,0,0,0.65)'; dot2.style.border = 'none'; }
  else if (currentIndex === 2) { dot3.style.background = 'rgba(0,0,0,0.65)'; dot3.style.border = 'none'; }
}

function updateSliderSize() {
  if (!slider) return;
  sliderWidth = slider.offsetWidth / totalSlides;
}

function setIndex(idx, withTransition = true) {
  if (!slider) return;
  currentIndex = idx;
  slider.style.transition = withTransition ? 'transform 0.25s ease' : 'none';
  const tx = -sliderWidth * currentIndex;
  slider.style.transform = `translateX(${tx}px)`;
  updateDots();
}

function showFrame2FromWelcome() {
  goToFrame2();
  startIdleTimer();
}

bindTap(option1, showFrame2FromWelcome);
bindTap(option2, showFrame2FromWelcome);

bindTap(frame2Close, () => {
  if (profiles.length > 0) goToFrame5Accounts();
  else goToFrame3New();
  startIdleTimer();
});

function goNext() {
  if (currentIndex < totalSlides - 1) setIndex(currentIndex + 1, true);
  else {
    if (profiles.length > 0) goToFrame5Accounts();
    else goToFrame3New();
  }
  startIdleTimer();
}

function goLeftAction() {
  if (currentIndex > 0) setIndex(currentIndex - 1, true);
  else goToFrame1();
  startIdleTimer();
}

bindTap(btnRight, goNext);
bindTap(btnLeft, goLeftAction);

if (slider) {
  slider.addEventListener('touchstart', (e) => {
    if (sliderWidth === 0) updateSliderSize();
    isDragging = true;
    slider.style.transition = 'none';

    sliderLock = directionLockState();
    sliderLock.sx = e.touches[0].clientX;
    sliderLock.sy = e.touches[0].clientY;

    startX = sliderLock.sx;
    startTranslate = -sliderWidth * currentIndex;
  }, { passive: true });

  slider.addEventListener('touchmove', (e) => {
    if (!isDragging) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    const isH = shouldLockHorizontal(sliderLock, x, y);
    if (isH === null) return;
    if (!isH) return;

    e.preventDefault();

    const deltaX = x - startX;
    let nextTranslate = startTranslate + deltaX;

    const minTranslate = -sliderWidth * (totalSlides - 1);
    const maxTranslate = 0;
    if (nextTranslate > maxTranslate) nextTranslate = maxTranslate;
    if (nextTranslate < minTranslate) nextTranslate = minTranslate;

    slider.style.transform = `translateX(${nextTranslate}px)`;
  }, { passive: false });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    slider.style.transition = 'transform 0.25s ease';

    if (!sliderLock.locked || !sliderLock.isHorizontal) {
      setIndex(currentIndex, true);
      startIdleTimer();
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;
    const threshold = sliderWidth * 0.15;

    if (diff < -threshold && currentIndex < totalSlides - 1) setIndex(currentIndex + 1, true);
    else if (diff > threshold && currentIndex > 0) setIndex(currentIndex - 1, true);
    else setIndex(currentIndex, true);

    startIdleTimer();
  }

  slider.addEventListener('touchend', endDrag, { passive: true });
  slider.addEventListener('touchcancel', endDrag, { passive: true });
}

window.addEventListener('resize', () => {
  if (frame2 && frame2.style.display === 'block') {
    updateSliderSize();
    setIndex(currentIndex, false);
  }
});

// =========================================================
// ✅ FRAME 3 / AVATAR / FRAME 4
// =========================================================
bindTap(frame3Back, () => {
  goToFrame2();
  setIndex(totalSlides - 1, false);
  startIdleTimer();
});

bindTap(frame3Next, () => { goToFrame4Age(); startIdleTimer(); });
bindTap(avatarBtn, () => { goToAvatarFrame(); startIdleTimer(); });

profileOptions.forEach(option => {
  bindTap(option, () => {
    const img = option.querySelector('img');
    if (img && avatarImage) avatarImage.src = img.src;
    goToFrame3Keep();
    startIdleTimer();
  });
});

if (nicknameInput) {
  nicknameInput.addEventListener('focus', () => {
    nicknameInput.setAttribute('data-old-placeholder', nicknameInput.placeholder);
    nicknameInput.placeholder = '';
  });
  nicknameInput.addEventListener('blur', () => {
    if (nicknameInput.value.trim() === '') {
      const oldPh = nicknameInput.getAttribute('data-old-placeholder') || 'Nickname';
      nicknameInput.placeholder = oldPh;
    }
  });
}

bindTap(frame4Back, () => { goToFrame3Keep(); startIdleTimer(); });
bindTap(frame4Next, () => { createProfileFromAgeNumber(); startIdleTimer(); });

// =========================================================
// ✅ AGE WHEEL SYSTEM
// =========================================================
let ageWheelReady = false;
let ageNumber = 18;

function initAgeWheelIfNeeded() {
  if (!ageWheel || ageWheelReady) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i <= 140; i++) {
    const div = document.createElement('div');
    div.className = 'age-item';
    div.textContent = String(i);
    div.dataset.age = String(i);
    frag.appendChild(div);
  }
  ageWheel.appendChild(frag);

  let raf = null;
  function onScroll() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      updateActiveAgeFromWheel(false);
    });
  }
  ageWheel.addEventListener('scroll', onScroll, { passive: true });

  ageWheel.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.age-item');
    if (!item) return;
    const a = Number(item.dataset.age);
    if (Number.isFinite(a)) scrollAgeWheelTo(a);
  });

  ageWheelReady = true;

  updateAgeUI(ageNumber);
  updateActiveAgeFromWheel(true);
}

function getWheelItemHeight() {
  const first = ageWheel?.querySelector?.('.age-item');
  return first ? first.getBoundingClientRect().height : 38;
}

function scrollAgeWheelTo(n) {
  if (!ageWheel) return;
  const a = Math.max(0, Math.min(140, Math.round(Number(n) || 0)));
  const itemH = getWheelItemHeight();

  ageWheel.scrollTo({ top: a * itemH, behavior: "smooth" });

  setTimeout(() => {
    ageNumber = a;
    updateAgeUI(ageNumber);
    highlightActiveItem(ageNumber);
  }, 80);
}

function updateActiveAgeFromWheel(forceSnap) {
  if (!ageWheel) return;
  const itemH = getWheelItemHeight();
  const scrollTop = ageWheel.scrollTop;

  let idx = Math.round(scrollTop / itemH);
  idx = Math.max(0, Math.min(140, idx));

  ageNumber = idx;
  updateAgeUI(ageNumber);
  highlightActiveItem(ageNumber);

  if (forceSnap) {
    ageWheel.scrollTop = idx * itemH;
  }
}

function highlightActiveItem(n) {
  if (!ageWheel) return;
  const items = ageWheel.querySelectorAll('.age-item');
  items.forEach((el) => el.classList.remove('active'));
  const target = ageWheel.querySelector(`.age-item[data-age="${n}"]`);
  if (target) target.classList.add('active');
}

function updateAgeUI(n) {
  if (ageNumberBig) ageNumberBig.textContent = String(n);
  const band = ageBandFromNumber(n);
  if (ageBandLabel) ageBandLabel.textContent = band.ageText;
}

function createProfileFromAgeNumber() {
  const name = (nicknameInput?.value || '').trim() || 'Guest';
  const avatarSrc = avatarImage?.src || 'Pic13.png';

  const band = ageBandFromNumber(ageNumber);

  const profile = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    name,
    avatarSrc,
    ageNumber,
    ageKey: band.ageKey,
    ageText: band.ageText
  };

  profiles.push(profile);
  ensureChatBucket(profile.id);
  currentProfile = profile;
  scheduleSaveAll();

  goToFrame5Accounts();
}

// =========================================================
// ✅ FRAME 5 (Profiles) - delete flow
// =========================================================
let suppressProfileClickUntil = 0;
let pendingDeleteProfileId = null;

function suppressProfileClicks(ms = 350) {
  suppressProfileClickUntil = Date.now() + ms;
}
function isProfileClickSuppressed() {
  return Date.now() < suppressProfileClickUntil;
}

function showDeleteModal(profileId) {
  pendingDeleteProfileId = profileId;
  if (!deleteModal) return;
  deleteModal.classList.add("show");
  deleteModal.setAttribute("aria-hidden", "false");
}

function hideDeleteModal() {
  pendingDeleteProfileId = null;
  if (!deleteModal) return;
  deleteModal.classList.remove("show");
  deleteModal.setAttribute("aria-hidden", "true");
}

if (deleteCancelBtn) bindTap(deleteCancelBtn, () => hideDeleteModal());
if (deleteYesBtn) bindTap(deleteYesBtn, () => {
  if (!pendingDeleteProfileId) return;
  const id = pendingDeleteProfileId;

  profiles = profiles.filter(p => p.id !== id);
  deleteModeId = null;

  if (chatDBByProfile[id]) delete chatDBByProfile[id];
  if (currentProfile?.id === id) currentProfile = profiles[0] || null;

  scheduleSaveAll();
  hideDeleteModal();
  renderProfiles();
});

if (deleteModal) {
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) hideDeleteModal();
  });
  deleteModal.addEventListener("touchstart", (e) => {
    if (e.target === deleteModal) hideDeleteModal();
  }, { passive: true });
}

function renderProfiles() {
  if (!profilesList) return;
  profilesList.innerHTML = '';

  profiles.forEach(profile => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.id = profile.id;

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'profile-card-avatar';

    const img = document.createElement('img');
    img.src = profile.avatarSrc;
    img.alt = profile.name;
    avatarWrap.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'profile-delete-overlay';
    overlay.innerHTML = '<img src="Pic16.png" alt="Delete mode">';
    avatarWrap.appendChild(overlay);

    const nameEl = document.createElement('div');
    nameEl.className = 'profile-name';
    nameEl.textContent = profile.name;

    card.appendChild(avatarWrap);
    card.appendChild(nameEl);

    attachLongPressDeleteToggle(card, profile.id);

    const onPickOrAskDelete = (e) => {
      if (isProfileClickSuppressed()) return;

      if (deleteModeId === profile.id) {
        showDeleteModal(profile.id);
        return;
      }

      currentProfile = profile;
      ensureChatBucket(profile.id);
      scheduleSaveAll();
      goToFrame6("home");
      startIdleTimer();
    };

    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPickOrAskDelete(e);
    });

    card.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isProfileClickSuppressed()) return;
      onPickOrAskDelete(e);
    }, { passive: false });

    profilesList.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'profile-card add-card';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'profile-card-avatar';

  const addImg = document.createElement('img');
  addImg.src = 'ProfileAdd.png';
  addImg.alt = 'Add Profile';

  avatarWrap.appendChild(addImg);
  addCard.appendChild(avatarWrap);

  bindTap(addCard, () => { goToFrame3New(); startIdleTimer(); });

  profilesList.appendChild(addCard);

  const cards = profilesList.querySelectorAll('.profile-card');
  cards.forEach(c => {
    const id = c.dataset.id;
    if (!id) return;
    if (id === deleteModeId) c.classList.add('show-delete');
    else c.classList.remove('show-delete');
  });
}

function attachLongPressDeleteToggle(card, id) {
  let timer = null;
  let fired = false;

  const THRESHOLD_MS = 520;

  const start = () => {
    fired = false;
    clearTimeout(timer);

    timer = setTimeout(() => {
      fired = true;

      if (deleteModeId === id) deleteModeId = null;
      else deleteModeId = id;

      suppressProfileClicks(650);
      renderProfiles();
    }, THRESHOLD_MS);
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = null;

    if (fired) suppressProfileClicks(450);
  };

  card.addEventListener('touchstart', start, { passive: true });
  card.addEventListener('mousedown', start);

  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(evt => {
    card.addEventListener(evt, cancel);
  });
}

// =========================================================
// ✅ FRAME 6 Tabs
//    ✅ Home: show ONLY data-home="1"
//    ✅ Sub-tabs: show 2 cards (chat card + quiz card) in order
// =========================================================
function applyFrame6TabView(name) {
  if (!homeCardsWrapper || !homeCardsTrack) return;

  const cards = Array.from(homeCardsTrack.querySelectorAll('.frame6-card'));

  // reset order
  cards.forEach(c => { c.style.order = ""; });

  if (name === "home") {
    cards.forEach(c => {
      const isHome = c.getAttribute("data-home") === "1";
      c.style.display = isHome ? "" : "none";
    });
    setHomeIndex(lastHomeIndex || 0, false);
    return;
  }

  // sub tab => show: chat + quiz + (optional) game
  cards.forEach(c => { c.style.display = "none"; });

  const chatCard = cards.find(c => c.getAttribute("data-card") === name);
  const quizCard = cards.find(c => c.getAttribute("data-quiz") === "1" && c.getAttribute("data-for-tab") === name);

  // ✅ game card: use data-game="scramble" or "ttt" and data-for-tab
  const gameCard = cards.find(c => c.getAttribute("data-game") && c.getAttribute("data-for-tab") === name);

  let order = 1;
  if (chatCard) { chatCard.style.display = ""; chatCard.style.order = String(order++); }
  if (quizCard) { quizCard.style.display = ""; quizCard.style.order = String(order++); }
  if (gameCard) { gameCard.style.display = ""; gameCard.style.order = String(order++); }

  homeIndex = 0;
  homeCardsTrack.style.transition = "none";
  homeCardsTrack.style.transform = "translateX(0px)";
}

function setActiveTab(name) {
  const cfg = tabConfig[name];
  if (!cfg || !tabHighlight) return;

  if (currentTabName === "home") lastHomeIndex = homeIndex;

  currentTabName = name;
  tabHighlight.style.left = cfg.left + 'px';
  tabHighlight.style.width = cfg.width + 'px';

  if (tabHome) tabHome.style.color = 'rgba(0,0,0,0.9)';
  if (tabHealthcare) tabHealthcare.style.color = 'rgba(0,0,0,0.9)';
  if (tabSports) tabSports.style.color = 'rgba(0,0,0,0.9)';
  if (tabEducation) tabEducation.style.color = 'rgba(0,0,0,0.9)';
  if (tabCommunity) tabCommunity.style.color = 'rgba(0,0,0,0.9)';

  if (name === 'home' && tabHome) tabHome.style.color = 'rgba(255,255,255,0.9)';
  if (name === 'healthcare' && tabHealthcare) tabHealthcare.style.color = 'rgba(255,255,255,0.9)';
  if (name === 'sports' && tabSports) tabSports.style.color = 'rgba(255,255,255,0.9)';
  if (name === 'education' && tabEducation) tabEducation.style.color = 'rgba(255,255,255,0.9)';
  if (name === 'community' && tabCommunity) tabCommunity.style.color = 'rgba(255,255,255,0.9)';

  if (homeCardsWrapper) homeCardsWrapper.style.display = 'block';
  applyFrame6TabView(name);
}

bindTap(tabHome, () => { setActiveTab('home'); startIdleTimer(); });
bindTap(tabHealthcare, () => { setActiveTab('healthcare'); startIdleTimer(); });
bindTap(tabSports, () => { setActiveTab('sports'); startIdleTimer(); });
bindTap(tabEducation, () => { setActiveTab('education'); startIdleTimer(); });
bindTap(tabCommunity, () => { setActiveTab('community'); startIdleTimer(); });

bindTap(frame6ProfileBtn, () => { goToFrame5Accounts(); startIdleTimer(); });

// home card swipe helpers
function getTranslateX(el) {
  const t = window.getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m2 = t.match(/^matrix\((.+)\)$/);
  if (m2) return parseFloat(m2[1].split(',')[4]) || 0;
  const m3 = t.match(/^matrix3d\((.+)\)$/);
  if (m3) return parseFloat(m3[1].split(',')[12]) || 0;
  return 0;
}

function calcHomeBounds() {
  if (!homeCardsTrack || !homeCardsWrapper) return { min: 0, max: 0 };

  const trackWidth = homeCardsTrack.scrollWidth;
  const wrapperWidth = homeCardsWrapper.offsetWidth;

  const max = 0;
  const min = Math.min(0, wrapperWidth - trackWidth - 42);
  return { min, max };
}

function setHomeIndex(idx, withTransition = true) {
  if (!homeCardsTrack) return;

  homeIndex = idx;
  const bounds = calcHomeBounds();
  const tx = Math.max(bounds.min, Math.min(bounds.max, -HOME_STEP * homeIndex));
  homeCardsTrack.style.transition = withTransition ? 'transform 0.25s ease' : 'none';
  homeCardsTrack.style.transform = `translateX(${tx}px)`;
}

if (homeCardsWrapper && homeCardsTrack) {
  homeCardsWrapper.addEventListener('touchstart', (e) => {
    homeDragging = true;
    homeCardsTrack.style.transition = 'none';

    homeLock = directionLockState();
    homeLock.sx = e.touches[0].clientX;
    homeLock.sy = e.touches[0].clientY;

    homeStartX = homeLock.sx;
    homeStartTranslate = getTranslateX(homeCardsTrack);

    const bounds = calcHomeBounds();
    homeMinTranslate = bounds.min;
    homeMaxTranslate = bounds.max;

    homeLastX = homeStartX;
    homeLastTime = performance.now();
    homeVelocity = 0;
  }, { passive: true });

  homeCardsWrapper.addEventListener('touchmove', (e) => {
    if (!homeDragging) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    const isH = shouldLockHorizontal(homeLock, x, y);
    if (isH === null) return;
    if (!isH) return;

    e.preventDefault();

    const deltaX = (x - homeStartX) * 1.2;
    let nextTranslate = homeStartTranslate + deltaX;

    if (nextTranslate > homeMaxTranslate) nextTranslate = homeMaxTranslate;
    if (nextTranslate < homeMinTranslate) nextTranslate = homeMinTranslate;

    homeCardsTrack.style.transform = `translateX(${nextTranslate}px)`;

    const now = performance.now();
    const dt = now - homeLastTime;
    if (dt > 0) homeVelocity = (x - homeLastX) / dt;
    homeLastX = x;
    homeLastTime = now;
  }, { passive: false });

  function endHomeDrag() {
    if (!homeDragging) return;
    homeDragging = false;

    if (!homeLock.locked || !homeLock.isHorizontal) {
      startIdleTimer();
      return;
    }

    let current = getTranslateX(homeCardsTrack);

    const projectionMs = 450;
    let projected = current + homeVelocity * projectionMs;

    if (projected > homeMaxTranslate) projected = homeMaxTranslate;
    if (projected < homeMinTranslate) projected = homeMinTranslate;

    homeCardsTrack.style.transition = 'transform 0.3s ease-out';
    homeCardsTrack.style.transform = `translateX(${projected}px)`;
    startIdleTimer();
  }

  homeCardsWrapper.addEventListener('touchend', endHomeDrag, { passive: true });
  homeCardsWrapper.addEventListener('touchcancel', endHomeDrag, { passive: true });
}

/* =========================================================
   ✅ FIX Frame6: “tap-only” open card
   ========================================================= */
function bindCardTapOnly(cardEl, onTap) {
  if (!cardEl) return;

  const TH = 12;
  let sx = 0, sy = 0;
  let moved = false;

  cardEl.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
    moved = false;
  }, { passive: true });

  cardEl.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) > TH || Math.abs(dy) > TH) moved = true;
  }, { passive: true });

  cardEl.addEventListener("touchend", (e) => {
    if (moved) return;
    const isMenu = e.target?.closest?.(".frame6-card-menu");
    if (isMenu) return;
    onTap(e);
  }, { passive: true });

  cardEl.addEventListener("click", (e) => {
    e.preventDefault();
    const isMenu = e.target?.closest?.(".frame6-card-menu");
    if (isMenu) return;
    onTap(e);
  });
}

function attachFrame6CardHandlers() {
  document.querySelectorAll('.frame6-card').forEach(card => {
    if (card.dataset.bound === "1") return;
    card.dataset.bound = "1";

    bindCardTapOnly(card, () => {
      lastFrame6Tab = currentTabName || "home";

      const isQuiz = card.getAttribute("data-quiz") === "1";
      if (isQuiz) {
        const tab = card.getAttribute("data-for-tab") || currentTabName || "healthcare";
        goToFrame8(tab);
        return;
      }

        const game = card.getAttribute("data-game");
      if (game) {
        const tab = card.getAttribute("data-for-tab") || currentTabName || "education";
        if (game === "scramble") { goToFrame11(tab); return; }
        if (game === "ttt")      { goToFrame12(tab); return; }
        return;
      }

      let type = card.getAttribute('data-card');
      if (!type) return;
      goToFrame7(type);
    });
  });
}
attachFrame6CardHandlers();

// =========================================================
// ✅ FRAME 7 Chatbot
// =========================================================
const cardToTitle = {
  healthcare: "HealthCare Chatbot",
  sports: "Sports&Fitness Chatbot",
  education: "Education Chatbot",
  community: "Community Chatbot",
};

function updateChatScale() {
  if (!chatStage) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const baseW = 864;
  const baseH = 444;
  const s = Math.min(vw / baseW, vh / baseH);
  chatStage.style.setProperty('--s', s.toString());
}

window.addEventListener('resize', () => {
  if (frame7 && frame7.style.display === 'block') updateChatScale();
  if ((frame8 && frame8.style.display === 'block') ||
      (frame9 && frame9.style.display === 'block') ||
      (frame10 && frame10.style.display === 'block')) {
    updateQuizScale();
  }
  if ((frame11 && frame11.style.display === 'block') ||
      (frame12 && frame12.style.display === 'block') ||
      (frame13 && frame13.style.display === 'block') ||
      (frame14 && frame14.style.display === 'block')) {
    updateGameScale();
  }
});

function goToFrame7(chatType) {
  activeChatType = chatType || "healthcare";
  hideAllFrames();

  if (frame7) frame7.style.backgroundImage = 'url("Pic18.png")';
  document.body.style.backgroundImage = 'url("Pic18.png")';

  if (frame7) frame7.style.display = 'block';
  lastActiveFrame = 'frame7';

  if (chatTitle) chatTitle.textContent = cardToTitle[activeChatType] || "Chatbot";
  updateChatScale();
  startIdleTimer();

  getActiveThread(activeChatType);

  renderChatHistory(activeChatType);
  renderThreadsList();
  updateThreadHeader();
  focusChatInput();
}

function focusChatInput() {
  if (!chatInput) return;
  setTimeout(() => chatInput.focus({ preventScroll: true }), 50);
}

if (newChatBtn) {
  newChatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startIdleTimer();
    createNewThread(activeChatType, true);
  }, { passive: false });

  newChatBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startIdleTimer();
    createNewThread(activeChatType, true);
  }, { passive: false });
}

bindTap(chatBackBtn, () => {
  startIdleTimer();
  stopVoiceIfAny();
  goToFrame6(lastFrame6Tab || "home");
});

// =========================================================
// ✅ CHAT RENDER + SEND
// =========================================================
function renderChatHistory(type) {
  if (!chatHistory) return;
  chatHistory.innerHTML = '';

  const thread = getActiveThread(type);
  const list = thread.messages || [];

  list.forEach(m => addBubbleToDOM(m.role, m.text, m.attachments, false));
  scrollChatToBottom(true);
}

function scrollChatToBottom(force = false) {
  if (!chatHistory) return;
  if (force) {
    requestAnimationFrame(() => {
      chatHistory.scrollTop = chatHistory.scrollHeight;
    });
  } else {
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}

function addBubbleToDOM(role, text, attachments = null, autoScroll = true) {
  if (!chatHistory) return;

  const row = document.createElement('div');
  row.className = 'msg-row ' + (role === 'user' ? 'user' : 'bot');

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (role === 'bot' ? ' bot' : '');

  let finalText = text || '';
  if (attachments && attachments.length) {
    finalText += (finalText ? '\n\n' : '');
    finalText += '📎 Attachments:\n' + attachments.map(a => `- ${a.name}`).join('\n');
  }

  bubble.textContent = finalText;
  row.appendChild(bubble);
  chatHistory.appendChild(row);
  if (autoScroll) scrollChatToBottom(true);
}

function pushMessage(type, role, text, attachments = null) {
  const thread = getActiveThread(type);
  thread.messages ||= [];
  thread.messages.push({ role, text, attachments });

  addBubbleToDOM(role, text, attachments, true);
  scheduleSaveAll();
}

function updateTapHint() {
  if (!tapToAsk || !chatInput) return;
  const hasText = (chatInput.value || '').trim().length > 0;
  tapToAsk.style.opacity = hasText ? '0' : '1';
}

if (chatInput) {
  chatInput.addEventListener('input', () => { updateTapHint(); startIdleTimer(); });
  chatInput.addEventListener('focus', () => { updateTapHint(); startIdleTimer(); });
}

function buildHistoryForServer(type, maxTurns = 14) {
  const thread = getActiveThread(type);
  const list = thread.messages || [];
  const msgs = [];

  for (const m of list) {
    const txt = String(m.text || '').trim();
    if (!txt) continue;

    if (txt === '…') continue;
    if (txt.startsWith('⚠️')) continue;

    if (m.role === 'user') msgs.push({ role: 'user', content: txt });
    if (m.role === 'bot') msgs.push({ role: 'assistant', content: txt });
  }
  return msgs.slice(-maxTurns);
}

async function callServerAI(type, userText) {
  const history = buildHistoryForServer(type);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const r = await fetch(`${SERVER_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        type,
        message: userText,
        history,
        profile: currentProfile ? {
          id: currentProfile.id,
          name: currentProfile.name,
          ageNumber: currentProfile.ageNumber,
          ageKey: currentProfile.ageKey,
          ageText: currentProfile.ageText
        } : null
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.detail || data?.error || `Server error (${r.status})`);
    return String(data?.reply || "").trim() || "…";
  } finally {
    clearTimeout(timeout);
  }
}

// ✅ fallback responds by age (front-end only)
function frontAgeStyle(profile) {
  const key = profile?.ageKey || "unknown";
  const styles = {
    Baby: { short: true },
    Child: { short: true },
    YoungChild: { short: true },
    PreTeen: { short: false },
    Teen: { short: false },
    YoungAdult: { short: false },
    Adult: { short: false },
    MidAdult: { short: false },
    OlderAdult: { short: false },
    Senior: { short: false },
    Elderly: { short: false },
    VeryElderly: { short: false },
    unknown: { short: false },
  };
  return styles[key] || styles.unknown;
}

async function mockAI(type, userText) {
  const t = (userText || '').toLowerCase();
  await new Promise(r => setTimeout(r, 200));

  const style = frontAgeStyle(currentProfile);
  const name = currentProfile?.name || "there";
  const S = (kidText, normalText) => style.short ? kidText : normalText;

  if (type === 'community') {
    return S(
      `Hi ${name} 😊 Tell me one thing that happened today.`,
      `I’m here with you, ${name} 😊 What’s on your mind right now?`
    );
  }

  if (type === 'healthcare') {
    if (t.includes('pain') || t.includes('hurt') || t.includes('เจ็บ') || t.includes('ปวด')) {
      return S(
        `I’m sorry 😟 Tell an adult. Rest and drink water.`,
        `Rest, hydrate, and monitor symptoms. If pain is severe or unusual, seek medical care.`
      );
    }
    return S(
      `Tell me: where does it hurt?`,
      `HealthCare mode ✅ Tell me your symptoms, how long it’s been, and how severe it is (1–10).`
    );
  }

  if (type === 'sports') {
    return S(
      `What sport do you like?`,
      `Sports&Fitness ✅ Tell me your goal, experience, and any injuries.`
    );
  }

  if (type === 'education') {
    return S(
      `What subject? Math or English?`,
      `Education ✅ Tell me the subject and what part you don’t understand. I’ll explain step-by-step.`
    );
  }

  return S(
    `Hi ${name}! What do you need help with?`,
    `Hi ${name}! How can I help?`
  );
}

async function handleSend(text, attachments = null) {
  const msg = (text || '').trim();
  if (!msg && (!attachments || !attachments.length)) return;

  if (chatInput) chatInput.value = '';
  updateTapHint();

  const userPayload = msg || (attachments?.length ? `(sent attachments: ${attachments.length} file(s))` : "(sent attachments)");
  pushMessage(activeChatType, 'user', userPayload, attachments);

  pushMessage(activeChatType, 'bot', '…');

  const thread = getActiveThread(activeChatType);
  const list = thread.messages || [];
  const thinkingIndex = list.length - 1;

  try {
    const reply = await callServerAI(activeChatType, userPayload);
    list[thinkingIndex].text = reply;

    const lastBubble = chatHistory?.querySelector('.msg-row.bot:last-child .bubble');
    if (lastBubble) lastBubble.textContent = reply;

    scrollChatToBottom(true);
    scheduleSaveAll();
  } catch (_) {
    const reply = await mockAI(activeChatType, msg);
    list[thinkingIndex].text = reply;

    const lastBubble = chatHistory?.querySelector('.msg-row.bot:last-child .bubble');
    if (lastBubble) lastBubble.textContent = reply;

    scrollChatToBottom(true);
    scheduleSaveAll();
  }
}

if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend(chatInput.value, null); }
  });
}

bindTap(chatAdd, () => {
  startIdleTimer();
  if (!filePicker) return;
  filePicker.value = '';
  filePicker.click();
});

if (filePicker) filePicker.addEventListener('change', () => {
  startIdleTimer();
  const files = Array.from(filePicker.files || []);
  if (!files.length) return;
  handleSend('', files);
});

// =========================================================
// ✅ Mic language menu (EN/TH)
// =========================================================
function setMicLangUI() {
  if (!micLangBtn) return;
  micLangBtn.textContent = (micLang === "th-TH") ? "TH" : "EN";
}
setMicLangUI();

function closeMicMenu() {
  if (!micLangMenu) return;
  micLangMenu.classList.remove("show");
}

if (micLangBtn && micLangMenu) {
  micLangBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    micLangMenu.classList.toggle("show");
  });

  micLangBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    micLangMenu.classList.toggle("show");
  }, { passive: false });

  micLangMenu.querySelectorAll(".mic-lang-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const lang = item.getAttribute("data-lang");
      if (lang === "th-TH" || lang === "en-US") micLang = lang;
      setMicLangUI();
      closeMicMenu();
      scheduleSaveAll();
    });
    item.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const lang = item.getAttribute("data-lang");
      if (lang === "th-TH" || lang === "en-US") micLang = lang;
      setMicLangUI();
      closeMicMenu();
      scheduleSaveAll();
    }, { passive: false });
  });

  document.addEventListener("click", () => closeMicMenu());
  document.addEventListener("touchstart", () => closeMicMenu(), { passive: true });
}

// =========================================================
// ✅ Voice input (same as yours)
// =========================================================
let recognition = null;
let isListening = false;
let voiceDraft = '';
let voiceTimer = null;
let voiceSec = 0;

function hasSpeechAPI() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

function startVoiceTimer() {
  clearInterval(voiceTimer);
  voiceSec = 0;
  if (voiceTime) voiceTime.textContent = "00:00";
  voiceTimer = setInterval(() => {
    voiceSec++;
    const mm = String(Math.floor(voiceSec / 60)).padStart(2, '0');
    const ss = String(voiceSec % 60).padStart(2, '0');
    if (voiceTime) voiceTime.textContent = `${mm}:${ss}`;
    const waves = ["▂▃▅▆▅▃▂", "▁▂▃▅▃▂▁", "▂▄▆▇▆▄▂", "▁▃▅▇▅▃▁"];
    if (voiceWave) voiceWave.textContent = waves[voiceSec % waves.length];
  }, 1000);
}
function stopVoiceTimer() { clearInterval(voiceTimer); voiceTimer = null; }

function enterVoiceConfirmMode() {
  if (chatMicImg) chatMicImg.src = 'ChatBot_No.png';
  if (chatSendImg) chatSendImg.src = 'ChatBot_Yes.png';
  if (voiceCenter) voiceCenter.style.display = 'flex';
}

function exitVoiceConfirmMode() {
  if (chatMicImg) chatMicImg.src = 'ChatBot_Mic.png';
  if (chatSendImg) chatSendImg.src = 'ChatBot_Send.png';
  if (voiceCenter) voiceCenter.style.display = 'none';
  stopVoiceTimer();
  voiceDraft = '';
}

function stopVoiceIfAny() {
  if (recognition && isListening) {
    try { recognition.stop(); } catch (e) {}
  }
  isListening = false;
  stopVoiceTimer();
}

function startListening() {
  if (!hasSpeechAPI()) {
    pushMessage(activeChatType, 'bot', "Mic is not supported on this browser.");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();

  recognition.lang = micLang;
  recognition.interimResults = true;
  recognition.continuous = true;

  voiceDraft = '';
  isListening = true;

  enterVoiceConfirmMode();
  startVoiceTimer();

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    voiceDraft = transcript.trim();
    if (chatInput) chatInput.value = voiceDraft;
    updateTapHint();
  };

  recognition.onerror = () => { isListening = false; stopVoiceTimer(); };
  recognition.onend = () => { isListening = false; stopVoiceTimer(); };

  try { recognition.start(); } catch (e) {}
}

function onMicOrNoClick() {
  startIdleTimer();

  if (chatMicImg?.src?.includes('ChatBot_No.png')) {
    stopVoiceIfAny();
    if (chatInput) chatInput.value = '';
    updateTapHint();
    exitVoiceConfirmMode();
    return;
  }
  startListening();
}

function onSendOrYesClick() {
  startIdleTimer();

  if (chatSendImg?.src?.includes('ChatBot_Yes.png')) {
    stopVoiceIfAny();
    const finalText = (chatInput?.value || voiceDraft || '').trim();
    exitVoiceConfirmMode();
    handleSend(finalText, null);
    return;
  }
  handleSend(chatInput?.value || '', null);
}

bindTap(chatMic, onMicOrNoClick);
bindTap(chatSend, onSendOrYesClick);

updateTapHint();

// =========================================================
// ✅ QUIZ SYSTEM
// =========================================================
let currentQuizTab = "healthcare"; // healthcare | sports | education | community
let quizData = null; // { questions: [...] }
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizSelectedIndex = null;

let quizTimerSecPerQ = 0;
let quizCountdown = 0;
let quizTimerHandle = null;

function quizLabelForTab(tab) {
  if (tab === "healthcare") return { title: "Healthcare Quiz", label: "Enter a Healthcare quiz topic" };
  if (tab === "sports") return { title: "Sports & Fitness Quiz", label: "Enter a Sports & Fitness quiz topic" };
  if (tab === "education") return { title: "Education Quiz", label: "Enter an Education quiz topic" };
  if (tab === "community") return { title: "Community Quiz", label: "Enter a Community quiz topic" };
  return { title: "Quiz", label: "Enter a quiz topic" };
}

function updateQuizScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const baseW = 864;
  const baseH = 444;
  const s = Math.min(vw / baseW, vh / baseH);

  if (quizStageSetup) quizStageSetup.style.setProperty('--qs', s.toString());
  if (quizStagePlay) quizStagePlay.style.setProperty('--qs', s.toString());
  if (quizStageResult) quizStageResult.style.setProperty('--qs', s.toString());
}

function updateGameScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const baseW = 864;
  const baseH = 444;
  const s = Math.min(vw / baseW, vh / baseH);

  if (scrambleStageSetup) scrambleStageSetup.style.setProperty('--gs', s.toString());
  if (scrambleStagePlay)  scrambleStagePlay.style.setProperty('--gs', s.toString());
  if (tttStageSetup)      tttStageSetup.style.setProperty('--gs', s.toString());
  if (tttStagePlay)       tttStagePlay.style.setProperty('--gs', s.toString());
}

function goToFrame8(tab) {
  currentQuizTab = tab || "healthcare";
  hideAllFrames();

  if (frame8) frame8.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame8';

  updateQuizScale();
  startIdleTimer();

  const meta = quizLabelForTab(currentQuizTab);
  if (quizSetupTitle) quizSetupTitle.textContent = meta.title;
  if (quizTopicLabel) quizTopicLabel.textContent = meta.label;

  // default grade by age
  const autoGrade = defaultGradeByAge(currentProfile);
  if (quizGradeSelect) {
    quizGradeSelect.value = "Auto (based on age)";
    quizGradeSelect.setAttribute("data-auto-grade", autoGrade);
  }

  if (quizTopicInput) quizTopicInput.value = "";
  if (quizSetupHint) quizSetupHint.textContent = "Tip: Choose a topic and press Start. The AI will generate the quiz for you.";
  if (quizStartBtn) {
    quizStartBtn.disabled = false;
    quizStartBtn.textContent = "Start Quiz";
  }
}

function goToFrame9() {
  hideAllFrames();
  if (frame9) frame9.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame9';
  updateQuizScale();
  startIdleTimer();
}

function goToFrame10() {
  hideAllFrames();
  if (frame10) frame10.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame10';
  updateQuizScale();
  startIdleTimer();
}

function clearQuizTimer() {
  clearInterval(quizTimerHandle);
  quizTimerHandle = null;
  quizCountdown = 0;
  if (quizTimerPill) quizTimerPill.textContent = "—";
}

function startQuizTimer(secPerQ) {
  clearQuizTimer();
  if (!secPerQ || secPerQ <= 0) {
    if (quizTimerPill) quizTimerPill.textContent = "No timer";
    return;
  }
  quizCountdown = secPerQ;
  if (quizTimerPill) quizTimerPill.textContent = formatTime(quizCountdown);

  quizTimerHandle = setInterval(() => {
    quizCountdown -= 1;
    if (quizTimerPill) quizTimerPill.textContent = formatTime(Math.max(0, quizCountdown));
    if (quizCountdown <= 0) {
      clearQuizTimer();
      // auto lock + show correct
      if (!quizAnswered) {
        lockQuizAnswer(null, true);
      }
    }
  }, 1000);
}

function formatTime(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function normalizeQuizJSON(obj) {
  if (!obj || typeof obj !== "object") return null;
  const qs = Array.isArray(obj.questions) ? obj.questions : [];

  const clean = qs.map(q => {
    let idx =
      Number.isFinite(Number(q.answerIndex)) ? Number(q.answerIndex) :
      Number.isFinite(Number(q.correctIndex)) ? Number(q.correctIndex) :
      null;

    // FIX: ถ้าโมเดลส่ง 1..4 ให้แปลงเป็น 0..3
    if (idx !== null && idx >= 1 && idx <= 4) idx = idx - 1;

    return {
      question: String(q.question || q.q || "").trim(),
      choices: Array.isArray(q.choices)
        ? q.choices.map(x => String(x))
        : Array.isArray(q.options)
        ? q.options.map(x => String(x))
        : [],
      answerIndex: idx,
      explanation: String(q.explanation || q.reason || "").trim()
    };
  }).filter(q =>
    q.question &&
    q.choices.length === 4 &&
    q.answerIndex !== null &&
    q.answerIndex >= 0 &&
    q.answerIndex < 4
  );

  if (!clean.length) return null;
  return { questions: clean };
}

function extractJSON(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  // try direct JSON
  try { return JSON.parse(t); } catch (_) {}

  // try find first {...} block
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const chunk = t.slice(start, end + 1);
    try { return JSON.parse(chunk); } catch (_) {}
  }
  return null;
}

/* =========================================================
   ✅ NEW: LOCAL QUIZ GENERATOR (สุ่มจริง ไม่ซ้ำแบบเดิม)
   ✅ ใช้แทน mockQuiz เดิม เพื่อกัน quiz โล่ง + ไม่ซ้ำ
   ========================================================= */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLocalQuiz(topic, count = 5, domain = "general") {
  const pools = {
    healthcare: [
      ["Which is a healthy daily habit?", ["Drink enough water", "Never sleep", "Only eat candy", "Never move"], 0, "Staying hydrated supports your body."],
      ["What helps prevent getting sick?", ["Wash hands", "Share cups", "Skip hygiene", "Never clean"], 0, "Handwashing reduces germs."],
      ["If you feel dizzy, what is safest first step?", ["Sit down and rest", "Run fast", "Ignore it", "Hold your breath"], 0, "Rest first; seek help if it continues."],
      ["Which food group should you eat often?", ["Vegetables", "Only sugar", "Only soda", "Only chips"], 0, "Vegetables provide vitamins and fiber."],
      ["Before exercising, what should you do?", ["Warm up", "Start max speed", "Skip stretching always", "Train with pain"], 0, "Warm-ups reduce injury risk."],
    ],
    sports: [
      ["What is a good warm-up?", ["Light jogging", "Sleeping", "Heavy max lift", "No movement"], 0, "Warm-ups increase blood flow."],
      ["To build endurance, you should…", ["Train consistently", "Do one session only", "Never rest", "Only sprint once"], 0, "Consistency matters."],
      ["What helps prevent injury?", ["Proper form", "Ignoring pain", "Overtraining", "No rest days"], 0, "Form protects joints and muscles."],
      ["After workout, what helps recovery?", ["Cool down + water", "No sleep", "Only soda", "Skip eating always"], 0, "Recovery supports progress."],
      ["Best first step for a beginner plan?", ["Start easy and increase", "Go hardest every day", "Never warm up", "Copy pro athletes"], 0, "Progressive overload safely builds fitness."],
    ],
    education: [
      ["Which is a good study method?", ["Practice questions", "Cram once", "Never review", "Only read titles"], 0, "Practice improves recall."],
      ["What helps you remember better?", ["Spaced repetition", "All-night study", "No breaks ever", "Zero sleep"], 0, "Spacing improves memory."],
      ["If a topic is hard, you should…", ["Break it into steps", "Give up", "Skip basics", "Guess always"], 0, "Small steps make learning easier."],
      ["Best way to improve writing?", ["Write and revise", "Never edit", "Avoid feedback", "Only copy"], 0, "Revision improves clarity."],
      ["What helps math accuracy?", ["Check your work", "Rush always", "Skip steps", "Ignore units"], 0, "Checking catches mistakes."],
    ],
    community: [
      ["A good way to resolve conflict is…", ["Listen calmly", "Shout louder", "Insult people", "Ignore forever"], 0, "Listening reduces tension."],
      ["Online safety: you should…", ["Keep personal info private", "Share passwords", "Meet strangers alone", "Post your address"], 0, "Privacy keeps you safe."],
      ["If a friend feels sad, you can…", ["Ask and support", "Laugh at them", "Ignore them", "Spread rumors"], 0, "Support helps mental wellbeing."],
      ["Teamwork works best when people…", ["Communicate clearly", "Never talk", "Only blame", "Hide problems"], 0, "Communication helps coordination."],
      ["Being a good community member means…", ["Respect others", "Break rules", "Hurt others", "Make trouble"], 0, "Respect supports peace and cooperation."],
    ],
    general: [
      ["Which is the best choice?", ["Option A", "Option B", "Option C", "Option D"], 0, "This is a safe default fallback."],
    ]
  };

  const pool = pools[domain] || pools.general;
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = pick(pool);
    const originalChoices = base[1].map(x => String(x));
    const correctText = originalChoices[base[2]];
    const choices = shuffle(originalChoices);
    const answerIndex = choices.indexOf(correctText);

    out.push({
      question: `(${i + 1}) ${topic}: ${base[0]}`,
      choices,
      answerIndex,
      explanation: base[3] || "This is the best general choice."
    });
  }
  return { questions: out };
}

function renderQuizQuestion() {
  if (!quizData || !quizData.questions || !quizData.questions.length) return;

  const total = quizData.questions.length;
  const q = quizData.questions[quizIndex];

  quizAnswered = false;
  quizSelectedIndex = null;
  if (quizFeedback) quizFeedback.textContent = "";
  if (quizNextBtn) { quizNextBtn.disabled = true; quizNextBtn.textContent = (quizIndex === total - 1) ? "Finish" : "Next"; }

  if (quizProgress) quizProgress.textContent = `Q${quizIndex + 1} / ${total}`;
  if (quizQuestionText) quizQuestionText.textContent = q.question;

  if (quizChoices) {
    quizChoices.innerHTML = "";
    q.choices.forEach((choiceText, idx) => {
      const btn = document.createElement("button");
      btn.className = "quiz-choice";
      btn.type = "button";
      btn.textContent = choiceText;

      btn.addEventListener("click", () => {
        if (quizAnswered) return;
        lockQuizAnswer(idx, false);
      });

      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (quizAnswered) return;
        lockQuizAnswer(idx, false);
      }, { passive: false });

      quizChoices.appendChild(btn);
    });
  }

  startQuizTimer(quizTimerSecPerQ);
}

function lockQuizAnswer(selectedIdx, timedOut) {
  if (!quizData) return;
  const q = quizData.questions[quizIndex];
  quizAnswered = true;
  quizSelectedIndex = selectedIdx;

  clearQuizTimer();

  const correct = q.answerIndex;
  const children = Array.from(quizChoices?.children || []);

  children.forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    if (i === correct) el.classList.add("correct");
    if (selectedIdx !== null && i === selectedIdx && i !== correct) el.classList.add("wrong");
    el.style.pointerEvents = "none";
  });

  if (!timedOut && selectedIdx !== null && selectedIdx === correct) quizScore += 1;

  if (quizFeedback) {
    if (timedOut) quizFeedback.textContent = `Time’s up! Correct answer highlighted. ${q.explanation ? " " + q.explanation : ""}`;
    else if (selectedIdx === correct) quizFeedback.textContent = `Correct ✅ ${q.explanation ? " " + q.explanation : ""}`;
    else quizFeedback.textContent = `Not quite. Correct answer highlighted. ${q.explanation ? " " + q.explanation : ""}`;
  }

  if (quizNextBtn) quizNextBtn.disabled = false;
}

async function generateQuizFromAI(payload) {
  const quizType = `${currentQuizTab}_quiz`; // healthcare_quiz, sports_quiz, ...

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const r = await fetch(`${SERVER_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        type: quizType,
        message: JSON.stringify(payload),
        history: [],
        profile: currentProfile ? {
          id: currentProfile.id,
          name: currentProfile.name,
          ageNumber: currentProfile.ageNumber,
          ageKey: currentProfile.ageKey,
          ageText: currentProfile.ageText
        } : null
      })
    });

    const data = await r.json().catch(() => ({}));
    const raw = String(data?.reply || "").trim();
    const obj = extractJSON(raw);
    const normalized = normalizeQuizJSON(obj);

    // ✅ HARD SAFETY: ถ้า AI ส่งมาแต่พัง/ไม่ครบ ให้เป็น null เพื่อ fallback
    if (!normalized || !normalized.questions || !normalized.questions.length) return null;
    return normalized;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function resetQuizState() {
  quizData = null;
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizSelectedIndex = null;
  clearQuizTimer();
}

async function startQuizFlow() {
  startIdleTimer();

  const topic = (quizTopicInput?.value || "").trim();
  const count = Number(quizCountSelect?.value || 8);
  const difficulty = String(quizDifficultySelect?.value || "Medium");
  const timer = Number(quizTimerSelect?.value || 0);

  let grade = String(quizGradeSelect?.value || "Auto (based on age)");
  const autoGrade = quizGradeSelect?.getAttribute("data-auto-grade") || defaultGradeByAge(currentProfile);
  if (grade.startsWith("Auto")) grade = autoGrade;

  if (!topic) {
    if (quizSetupHint) quizSetupHint.textContent = "Please enter a topic first.";
    return;
  }

  if (quizStartBtn) { quizStartBtn.disabled = true; quizStartBtn.textContent = "Generating…"; }
  if (quizSetupHint) quizSetupHint.textContent = "Generating quiz with AI…";

  resetQuizState();

  const payload = {
    category: currentQuizTab,
    topic,
    numQuestions: Math.max(3, Math.min(15, count)),
    gradeLevel: grade,
    difficulty,
    timed: timer > 0,
    secondsPerQuestion: timer
  };

  let data = await generateQuizFromAI(payload);

  // ✅ HARD GUARANTEE fallback: ไม่มีทางโล่ง + สุ่มจริง
  if (!data) {
    data = generateLocalQuiz(topic, payload.numQuestions, currentQuizTab);
  }

  quizData = data;
  quizTimerSecPerQ = payload.timed ? payload.secondsPerQuestion : 0;

  goToFrame9();
  renderQuizQuestion();
}

function finishQuiz() {
  const total = quizData?.questions?.length || 0;
  goToFrame10();

  if (quizScoreText) quizScoreText.textContent = `Score: ${quizScore} / ${total}`;

  // customize congrats
  const pct = total ? (quizScore / total) : 0;
  let msg = "Congratulations! 🎉";
  if (pct >= 0.9) msg = "Amazing! You crushed it! 🏆";
  else if (pct >= 0.7) msg = "Great job! 🎉";
  else if (pct >= 0.5) msg = "Nice work — keep going! 💪";
  else msg = "Good try! Practice makes perfect 💜";

  if (quizCongratsText) quizCongratsText.textContent = msg;
}

if (quizStartBtn) bindTap(quizStartBtn, startQuizFlow);

if (quizNextBtn) bindTap(quizNextBtn, () => {
  startIdleTimer();
  if (!quizData) return;

  const total = quizData.questions.length;
  if (quizIndex >= total - 1) {
    finishQuiz();
    return;
  }
  quizIndex += 1;
  goToFrame9();
  renderQuizQuestion();
});

function quizBackToHome() {
  clearQuizTimer();
  goToFrame6(lastFrame6Tab || "home");
}

if (quizBackBtn1) bindTap(quizBackBtn1, quizBackToHome);
if (quizBackBtn2) bindTap(quizBackBtn2, quizBackToHome);
if (quizBackBtn3) bindTap(quizBackBtn3, quizBackToHome);

if (quizPlayAgainBtn) bindTap(quizPlayAgainBtn, () => goToFrame8(currentQuizTab));
if (quizBackHomeBtn) bindTap(quizBackHomeBtn, quizBackToHome);


// =========================================================
// ✅ GAMES SYSTEM (Scramble + TicTacToe)
// =========================================================
let currentGameTab = "education";

// ---------- NAV ----------
function goToFrame11(tab) {
  currentGameTab = tab || "education";
  hideAllFrames();
  if (frame11) frame11.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame11';
  updateGameScale();
  startIdleTimer();

  if (scrambleSetupTitle) scrambleSetupTitle.textContent = "Word Scramble";
  if (scrambleTopicInput) scrambleTopicInput.value = "";
  if (scrambleSetupHint) scrambleSetupHint.textContent = "Tip: choose a topic then Start.";
  if (scrambleStartBtn) { scrambleStartBtn.disabled = false; scrambleStartBtn.textContent = "Start Game"; }
}

function goToFrame12(tab) {
  currentGameTab = tab || "education";
  hideAllFrames();
  if (frame12) frame12.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame12';
  updateGameScale();
  startIdleTimer();

  if (tttSetupTitle) tttSetupTitle.textContent = "Tic Tac Toe";
  // defaults
  setTTTMode("1p");
  setTTTSide("X");
  if (tttSetupHint) tttSetupHint.textContent = "Choose mode and press Start.";
}

function goToFrame13() {
  hideAllFrames();
  if (frame13) frame13.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame13';
  updateGameScale();
  startIdleTimer();
}

function goToFrame14() {
  hideAllFrames();
  if (frame14) frame14.style.display = "block";
  document.body.style.backgroundImage = 'url("Pic18.png")';
  lastActiveFrame = 'frame14';
  updateGameScale();
  startIdleTimer();
}

function gameBackToHome() {
  clearScrambleTimer();
  goToFrame6(lastFrame6Tab || "home");
}

if (scrambleBackBtn1) bindTap(scrambleBackBtn1, gameBackToHome);
if (scrambleBackBtn2) bindTap(scrambleBackBtn2, gameBackToHome);
if (tttBackBtn1) bindTap(tttBackBtn1, gameBackToHome);
if (tttBackBtn2) bindTap(tttBackBtn2, gameBackToHome);

// ---------- Scramble ----------
let scrambleData = null; // { words:[{answer,scrambled,hint}] }
let scrambleIndex = 0;
let scrambleScore = 0;
let scrambleAnswered = false;

let scrambleSecPerWord = 0;
let scrambleCountdown = 0;
let scrambleTimerHandle = null;

function clearScrambleTimer() {
  clearInterval(scrambleTimerHandle);
  scrambleTimerHandle = null;
  scrambleCountdown = 0;
  if (scrambleTimerPill) scrambleTimerPill.textContent = "—";
}
function startScrambleTimer(sec) {
  clearScrambleTimer();
  if (!sec || sec <= 0) {
    if (scrambleTimerPill) scrambleTimerPill.textContent = "No timer";
    return;
  }
  scrambleCountdown = sec;
  if (scrambleTimerPill) scrambleTimerPill.textContent = formatTime(scrambleCountdown);
  scrambleTimerHandle = setInterval(() => {
    scrambleCountdown -= 1;
    if (scrambleTimerPill) scrambleTimerPill.textContent = formatTime(Math.max(0, scrambleCountdown));
    if (scrambleCountdown <= 0) {
      clearScrambleTimer();
      if (!scrambleAnswered) scrambleLockAnswer(true);
    }
  }, 1000);
}

function scrambleShuffleWord(word) {
  const s = (word || "").toUpperCase().replace(/\s+/g, "");
  if (s.length <= 2) return s;
  const arr = s.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const out = arr.join("");
  return (out === s) ? arr.reverse().join("") : out;
}

// simple local word pools (offline)
function scramblePoolByTab(tab) {
  const base = {
    healthcare: ["HYDRATION","NUTRITION","SLEEP","EXERCISE","VITAMINS","STRETCH","FIRSTAID","HEALTH"],
    sports: ["ENDURANCE","STAMINA","WARMUP","COOLDOWN","TRAINING","BALANCE","MUSCLE","RECOVERY"],
    education: ["ALGEBRA","HISTORY","SCIENCE","LANGUAGE","GEOMETRY","ESSAY","READING","HOMEWORK"],
    community: ["RESPECT","KINDNESS","TEAMWORK","HELPFUL","HONESTY","SAFETY","FRIENDSHIP","COMMUNITY"]
  };
  return base[tab] || base.education;
}

function buildScrambleWords(topic, count, tab, difficulty) {
  const pool = scramblePoolByTab(tab);
  const words = [];
  const used = new Set();

  const wantLen = (difficulty === "Hard") ? 9 : (difficulty === "Easy") ? 5 : 7;

  while (words.length < count) {
    let w = pool[Math.floor(Math.random() * pool.length)];
    // mix in topic letters sometimes (just to feel “topic-based” offline)
    if (topic && Math.random() < 0.25) {
      const t = topic.toUpperCase().replace(/[^A-Z]/g, "");
      if (t.length >= 4) w = t.slice(0, Math.min(10, Math.max(4, wantLen)));
    }

    if (w.length < 4) continue;
    if (difficulty === "Hard" && w.length < 8) continue;
    if (difficulty === "Easy" && w.length > 9) continue;

    if (used.has(w)) continue;
    used.add(w);

    const scrambled = scrambleShuffleWord(w);
    const hint = `Starts with "${w[0]}" • ${w.length} letters`;

    words.push({ answer: w, scrambled, hint });
  }
  return { words };
}

function renderScramble() {
  if (!scrambleData || !scrambleData.words?.length) return;

  const total = scrambleData.words.length;
  const item = scrambleData.words[scrambleIndex];

  scrambleAnswered = false;
  if (scrambleFeedback) scrambleFeedback.textContent = "";
  if (scrambleGuessInput) { scrambleGuessInput.value = ""; }
  if (scrambleWordText) scrambleWordText.textContent = item.scrambled;
  if (scrambleHintText) scrambleHintText.textContent = "Hint: (tap Check if you want feedback)";
  if (scrambleProgress) scrambleProgress.textContent = `Word ${scrambleIndex + 1} / ${total} • Score ${scrambleScore}`;

  if (scrambleNextBtn) {
    scrambleNextBtn.disabled = true;
    scrambleNextBtn.textContent = (scrambleIndex === total - 1) ? "Finish" : "Next";
  }

  startScrambleTimer(scrambleSecPerWord);
}

function scrambleLockAnswer(timedOut) {
  if (!scrambleData) return;
  const item = scrambleData.words[scrambleIndex];
  scrambleAnswered = true;
  clearScrambleTimer();

  const guess = (scrambleGuessInput?.value || "").toUpperCase().replace(/\s+/g, "");
  const ok = (!timedOut && guess && guess === item.answer);

  if (ok) scrambleScore += 1;

  if (scrambleHintText) scrambleHintText.textContent = `Hint: ${item.hint}`;

  if (scrambleFeedback) {
    if (timedOut) scrambleFeedback.textContent = `Time’s up! Answer: ${item.answer}`;
    else if (ok) scrambleFeedback.textContent = `Correct ✅`;
    else scrambleFeedback.textContent = `Not quite. Answer: ${item.answer}`;
  }

  if (scrambleNextBtn) scrambleNextBtn.disabled = false;
}

function startScrambleFlow() {
  startIdleTimer();

  const topic = (scrambleTopicInput?.value || "").trim();
  const count = Number(scrambleCountSelect?.value || 8);
  const difficulty = String(scrambleDifficultySelect?.value || "Medium");
  const timer = Number(scrambleTimerSelect?.value || 0);

  if (!topic) {
    if (scrambleSetupHint) scrambleSetupHint.textContent = "Please enter a topic first.";
    return;
  }

  if (scrambleStartBtn) { scrambleStartBtn.disabled = true; scrambleStartBtn.textContent = "Starting…"; }

  scrambleData = buildScrambleWords(topic, Math.max(3, Math.min(15, count)), currentGameTab, difficulty);
  scrambleIndex = 0;
  scrambleScore = 0;
  scrambleSecPerWord = timer;

  goToFrame13();
  renderScramble();
}

if (scrambleStartBtn) bindTap(scrambleStartBtn, startScrambleFlow);

if (scrambleCheckBtn) bindTap(scrambleCheckBtn, () => {
  startIdleTimer();
  if (scrambleAnswered) return;
  scrambleLockAnswer(false);
});

if (scrambleNextBtn) bindTap(scrambleNextBtn, () => {
  startIdleTimer();
  if (!scrambleData) return;

  const total = scrambleData.words.length;
  if (scrambleIndex >= total - 1) {
    // finish => go back setup with result text
    goToFrame11(currentGameTab);
    if (scrambleSetupHint) scrambleSetupHint.textContent = `Finished! Final score: ${scrambleScore} / ${total}`;
    return;
  }
  scrambleIndex += 1;
  goToFrame13();
  renderScramble();
});

// ---------- TicTacToe ----------
let tttMode = "1p";     // "1p" | "2p"
let tttHumanSide = "X"; // "X" | "O"
let tttDifficulty = "Easy";

let tttBoard = Array(9).fill("");
let tttTurn = "X";
let tttOver = false;

function setTTTMode(mode) {
  tttMode = (mode === "2p") ? "2p" : "1p";
  tttModeBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-ttt-mode") === tttMode));
}
function setTTTSide(side) {
  tttHumanSide = (side === "O") ? "O" : "X";
  tttSideBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-ttt-side") === tttHumanSide));
}

tttModeBtns.forEach(btn => bindTap(btn, () => { setTTTMode(btn.getAttribute("data-ttt-mode")); startIdleTimer(); }));
tttSideBtns.forEach(btn => bindTap(btn, () => { setTTTSide(btn.getAttribute("data-ttt-side")); startIdleTimer(); }));

function tttLines() {
  return [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
}
function tttWinner(board) {
  for (const [a,b,c] of tttLines()) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(x => x)) return "draw";
  return null;
}

function renderTTT() {
  if (!tttGrid) return;
  tttGrid.innerHTML = "";

  tttBoard.forEach((v, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ttt-cell";
    btn.textContent = v || "";
    btn.disabled = tttOver || !!v;
    bindTap(btn, () => onTTTMove(i));
    tttGrid.appendChild(btn);
  });

  const w = tttWinner(tttBoard);
  if (tttStatus) {
    if (w === "draw") tttStatus.textContent = "Draw 🤝";
    else if (w) tttStatus.textContent = `${w} wins! 🏆`;
    else tttStatus.textContent = `Turn: ${tttTurn}`;
  }
}

function tttBestMove(board, aiSide) {
  const human = (aiSide === "X") ? "O" : "X";

  // Easy: random
  if (tttDifficulty === "Easy") {
    const empties = board.map((v,i)=>v?null:i).filter(v=>v!==null);
    return empties[Math.floor(Math.random() * empties.length)];
  }

  // Medium/Hard: simple win/block + center + corners
  const empties = board.map((v,i)=>v?null:i).filter(v=>v!==null);

  // win
  for (const i of empties) {
    const b = board.slice(); b[i] = aiSide;
    if (tttWinner(b) === aiSide) return i;
  }
  // block
  for (const i of empties) {
    const b = board.slice(); b[i] = human;
    if (tttWinner(b) === human) return i;
  }
  // center
  if (board[4] === "") return 4;
  // corners
  const corners = [0,2,6,8].filter(i => board[i] === "");
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  // else random
  return empties[Math.floor(Math.random() * empties.length)];
}

function maybeAIMove() {
  if (tttMode !== "1p") return;
  const aiSide = (tttHumanSide === "X") ? "O" : "X";
  if (tttTurn !== aiSide) return;
  if (tttOver) return;

  setTimeout(() => {
    const idx = tttBestMove(tttBoard, aiSide);
    if (idx == null) return;

    tttBoard[idx] = aiSide;
    const w = tttWinner(tttBoard);
    if (w) tttOver = true;
    else tttTurn = (aiSide === "X") ? "O" : "X";

    renderTTT();
  }, 180);
}

function onTTTMove(i) {
  startIdleTimer();
  if (tttOver || tttBoard[i]) return;

  // in 1p: lock human side
  if (tttMode === "1p" && tttTurn !== tttHumanSide) return;

  tttBoard[i] = tttTurn;

  const w = tttWinner(tttBoard);
  if (w) {
    tttOver = true;
    renderTTT();
    return;
  }

  tttTurn = (tttTurn === "X") ? "O" : "X";
  renderTTT();
  maybeAIMove();
}

function startTTTFlow() {
  startIdleTimer();
  tttDifficulty = String(tttDiffSelect?.value || "Easy");
  tttBoard = Array(9).fill("");
  tttTurn = "X";
  tttOver = false;

  goToFrame14();
  renderTTT();

  // if human chose O and mode 1p => AI starts
  if (tttMode === "1p" && tttHumanSide === "O") {
    maybeAIMove();
  }
}

if (tttStartBtn) bindTap(tttStartBtn, startTTTFlow);
if (tttRestartBtn) bindTap(tttRestartBtn, () => {
  startIdleTimer();
  startTTTFlow();
});

// =========================================================
// ✅ Initial screen
// =========================================================
goToFrame1();


