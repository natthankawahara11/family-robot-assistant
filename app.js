/* app.js — FAR multi-frame controller (1–14)
   - Profile (avatar, nickname, age)
   - Home tabs filtering (Home/Healthcare/Sports/Education/Community)
   - Chat (Frame 7) with history threads per mode (localStorage)
   - Quiz (Frames 8-10) generated via /api/chat
   - Word Scramble (Frames 11-12) via /api/chat + local play
   - Tic Tac Toe (Frames 13-14) local
*/
(() => {
  "use strict";

  const API_URL = "/api/chat";

  const LS = {
    accounts: "far_accounts_v2",
    activeAccountId: "far_active_account_v2",
    chatThreads: "far_threads_v2", // {mode:{threadId:{title,updatedAt,messages:[{role,content}]}}}
    activeThread: "far_active_thread_v2", // {mode:threadId}
    lastTab: "far_last_tab_v2",
    quizCache: "far_quiz_cache_v2", // {mode:{...quizJson}}
  };

  const Modes = {
    healthcare: { title: "HealthCare Chatbot", type: "healthcare", quizType: "healthcare_quiz" },
    sports: { title: "Sports & Fitness Chatbot", type: "sports", quizType: "sports_quiz" },
    education: { title: "Education Chatbot", type: "education", quizType: "education_quiz" },
    community: { title: "Community Chatbot", type: "community", quizType: "community_quiz" },
  };

  // ---- DOM helpers
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function now() { return Date.now(); }
  function clamp(n, a, b){ n = Number(n); if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b, n)); }
  function safeJSONParse(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }
  function uid(){ return Math.random().toString(36).slice(2,10) + "-" + Math.random().toString(36).slice(2,8); }

  // ---- state
  const state = {
    frame: 1,
    activeMode: "healthcare",
    micLang: "en-US",
    speech: null,
    recognizing: false,

    // accounts
    accounts: loadAccounts(),
    activeAccountId: localStorage.getItem(LS.activeAccountId) || null,

    // age wheel
    age: 18,

    // chat
    threads: loadThreads(),
    activeThreadByMode: loadActiveThreadMap(),

    // quiz runtime
    quiz: {
      json: null,
      idx: 0,
      score: 0,
      timerSec: 60,
      tLeft: 0,
      timerId: null,
      locked: false,
      mode: "healthcare",
    },

    // scramble runtime
    scramble: {
      mode: "education",
      topic: "Random",
      difficulty: "Medium",
      answer: "",
      scrambled: "",
      hint: "",
      timerId: null,
      tLeft: 30,
    },

    // ttt runtime
    ttt: {
      mode: "1p",
      human: "X",
      ai: "O",
      board: Array(9).fill(""),
      turn: "X",
      over: false,
    }
  };

  // ---- Boot loader simulate asset prep
  document.addEventListener("DOMContentLoaded", () => {
    runBoot();
    wireWelcome();
    wireCarousel();
    wireProfileSetup();
    wireAgeWheel();
    wireAccounts();
    wireHome();
    wireChat();
    wireQuiz();
    wireScramble();
    wireTicTacToe();

    // restore last tab highlight
    setHomeTab(localStorage.getItem(LS.lastTab) || "home");

    // If have active account, show Frame 6 directly (optional)
    if (state.activeAccountId && getActiveAccount()) {
      showFrame(6);
      applyActiveAccountToUI();
    } else {
      showFrame(1);
    }
  });

  function runBoot(){
    const boot = $("bootLoader");
    const fill = $("bootBarFill");
    const status = $("bootStatus");
    const pct = $("bootPercent");
    if (!boot || !fill) return;

    const steps = [
      "Starting…",
      "Loading UI…",
      "Preparing chat…",
      "Preparing quiz…",
      "Preparing games…",
      "Almost done…",
    ];
    let i = 0;
    let p = 0;

    const t = setInterval(() => {
      p = Math.min(100, p + 12);
      fill.style.width = p + "%";
      if (status) status.textContent = steps[Math.min(steps.length - 1, i)];
      if (pct) pct.textContent = p + "%";
      if (p % 24 === 0) i++;
      if (p >= 100) {
        clearInterval(t);
        setTimeout(() => {
          boot.style.display = "none";
        }, 250);
      }
    }, 120);
  }

  // ---- Frame show/hide (frame-1 .. frame-14 + frame-avatar + frame-video)
  function showFrame(n){
    // Hide all numbered frames
    for (let i = 1; i <= 14; i++){
      const el = document.querySelector(".frame-" + i);
      if (el) el.style.display = "none";
    }
    // some frames are like frame11ScrambleSetup etc but class is frame-11; already handled
    // Hide overlay frames
    const fa = $("frameAvatar");
    if (fa) fa.classList.remove("show");
    const fv = $("frameVideo");
    if (fv) fv.style.display = "none";

    const target = document.querySelector(".frame-" + n);
    if (target) target.style.display = "block";
    state.frame = n;
  }

  // ---- Welcome
  function wireWelcome(){
    const o1 = $("welcomeOption1");
    const o2 = $("welcomeOption2");
    if (o1) o1.addEventListener("click", () => showFrame(2));
    if (o2) o2.addEventListener("click", () => showFrame(2));

    // optionally show intro video once
    const frameVideo = $("frameVideo");
    const introVideo = $("introVideo");
    if (frameVideo && introVideo) {
      // keep disabled by default; you can enable by setting style display block
    }
  }

  // ---- Carousel frame 2
  function wireCarousel(){
    const slider = $("slider");
    const left = $("btnLeft");
    const right = $("btnRight");
    const close = $("frame2CloseBtn");
    const dots = [ $("dot1"), $("dot2"), $("dot3") ].filter(Boolean);

    let idx = 0;
    function render(){
      if (slider) slider.style.transform = `translateX(${-idx * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    }
    render();

    left && left.addEventListener("click", () => { idx = (idx + 2) % 3; render(); });
    right && right.addEventListener("click", () => { idx = (idx + 1) % 3; render(); });

    close && close.addEventListener("click", () => showFrame(3));
  }

  // ---- Profile setup frame 3 + avatar overlay
  function wireProfileSetup(){
    const back = $("frame3Back");
    const next = $("frame3Next");
    const avatarBtn = $("avatarBtn");
    const avatarOverlay = $("frameAvatar");
    const avatarImage = $("avatarImage");
    const nicknameInput = $("nicknameInput");

    back && back.addEventListener("click", () => showFrame(2));
    next && next.addEventListener("click", () => {
      const nick = (nicknameInput?.value || "").trim();
      if (!nick) {
        nicknameInput?.focus();
        return;
      }
      showFrame(4);
    });

    avatarBtn && avatarBtn.addEventListener("click", () => {
      if (!avatarOverlay) return;
      avatarOverlay.classList.add("show");
    });

    // click choose avatar
    if (avatarOverlay) {
      avatarOverlay.addEventListener("click", (e) => {
        const opt = e.target.closest(".profile-option");
        if (!opt) {
          // click outside options closes
          if (e.target === avatarOverlay) avatarOverlay.classList.remove("show");
          return;
        }
        const img = opt.querySelector("img");
        if (img && avatarImage) {
          avatarImage.src = img.getAttribute("src");
        }
        avatarOverlay.classList.remove("show");
      });
    }
  }

  // ---- Age wheel frame 4
  function wireAgeWheel(){
    const back = $("frame4Back");
    const next = $("frame4Next");
    const wheel = $("ageWheel");
    const big = $("ageNumberBig");
    const band = $("ageBandLabel");

    back && back.addEventListener("click", () => showFrame(3));
    next && next.addEventListener("click", () => {
      const nick = ($("nicknameInput")?.value || "").trim();
      const avatar = $("avatarImage")?.getAttribute("src") || "Pic13.png";
      const age = state.age;

      const account = {
        id: uid(),
        nickname: nick || "User",
        age,
        avatar,
        createdAt: now(),
        updatedAt: now(),
      };
      state.accounts.unshift(account);
      saveAccounts();
      setActiveAccount(account.id);
      renderAccounts();
      showFrame(5);
    });

    if (!wheel || !big || !band) return;

    // Build wheel items 0..140
    wheel.innerHTML = "";
    for (let a = 0; a <= 140; a++){
      const item = document.createElement("div");
      item.className = "age-item";
      item.dataset.age = String(a);
      item.textContent = String(a);
      wheel.appendChild(item);
    }

    // Scroll to default
    const ITEM_H = 44;
    function setAge(a, smooth=false){
      state.age = clamp(a, 0, 140);
      big.textContent = String(state.age);
      band.textContent = ageBandLabel(state.age);

      // active style
      $$(".age-item", wheel).forEach(el => {
        el.classList.toggle("active", Number(el.dataset.age) === state.age);
      });

      // snap scroll
      const top = state.age * ITEM_H;
      wheel.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
    }

    // Determine age from scroll
    let raf = null;
    wheel.addEventListener("scroll", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const a = Math.round(wheel.scrollTop / ITEM_H);
        setAge(a, false);
      });
    });

    // click item
    wheel.addEventListener("click", (e) => {
      const it = e.target.closest(".age-item");
      if (!it) return;
      setAge(Number(it.dataset.age), true);
    });

    // initial
    setAge(18, false);
  }

  function ageBandLabel(age){
    if (age <= 5) return "Early Childhood Age: 0–5";
    if (age <= 12) return "Child Age: 6–12";
    if (age <= 17) return "Teen Age: 13–17";
    if (age <= 24) return "Young Adult Age: 18–24";
    if (age <= 59) return "Adult Age: 25–59";
    if (age <= 79) return "Senior Age: 60–79";
    return "Elder Age: 80–140";
  }

  // ---- Accounts frame 5
  function wireAccounts(){
    renderAccounts();

    // delete modal (simple)
    const modal = $("deleteModal");
    const cancel = $("deleteCancelBtn");
    const yes = $("deleteYesBtn");
    let pendingDeleteId = null;

    cancel && cancel.addEventListener("click", () => {
      pendingDeleteId = null;
      modal?.classList.remove("show");
    });

    yes && yes.addEventListener("click", () => {
      if (!pendingDeleteId) return;
      state.accounts = state.accounts.filter(a => a.id !== pendingDeleteId);
      if (state.activeAccountId === pendingDeleteId) {
        state.activeAccountId = state.accounts[0]?.id || null;
        localStorage.setItem(LS.activeAccountId, state.activeAccountId || "");
      }
      saveAccounts();
      renderAccounts();
      modal?.classList.remove("show");
      pendingDeleteId = null;
    });

    // delegate clicks on profile list
    const list = $("profilesList");
    if (list) {
      list.addEventListener("click", (e) => {
        const row = e.target.closest(".profile-row");
        if (!row) return;
        const id = row.dataset.id;
        const del = e.target.closest(".del");
        if (del) {
          pendingDeleteId = id;
          if (modal) modal.classList.add("show");
          return;
        }
        setActiveAccount(id);
        applyActiveAccountToUI();
        showFrame(6);
      });
    }
  }

  function renderAccounts(){
    const list = $("profilesList");
    if (!list) return;
    list.innerHTML = "";

    if (state.accounts.length === 0){
      const empty = document.createElement("div");
      empty.style.color = "rgba(232,238,246,.7)";
      empty.style.textAlign = "center";
      empty.style.padding = "18px";
      empty.textContent = "No accounts yet. Create one in the previous steps.";
      list.appendChild(empty);
      return;
    }

    state.accounts.forEach(acc => {
      const row = document.createElement("div");
      row.className = "profile-row";
      row.dataset.id = acc.id;
      row.innerHTML = `
        <img src="${escapeHTML(acc.avatar || "Pic13.png")}" alt="avatar">
        <div class="meta">
          <div class="name">${escapeHTML(acc.nickname || "User")}</div>
          <div class="sub">Age: ${Number(acc.age ?? "?")} • ${escapeHTML(ageBandLabel(Number(acc.age || 0)))}</div>
        </div>
        <div class="del">✕</div>
      `;
      list.appendChild(row);
    });
  }

  // ---- Home frame 6 tabs + cards
  function wireHome(){
    const tabHome = $("tabHome");
    const tabHealthcare = $("tabHealthcare");
    const tabSports = $("tabSports");
    const tabEducation = $("tabEducation");
    const tabCommunity = $("tabCommunity");

    tabHome && tabHome.addEventListener("click", () => setHomeTab("home"));
    tabHealthcare && tabHealthcare.addEventListener("click", () => setHomeTab("healthcare"));
    tabSports && tabSports.addEventListener("click", () => setHomeTab("sports"));
    tabEducation && tabEducation.addEventListener("click", () => setHomeTab("education"));
    tabCommunity && tabCommunity.addEventListener("click", () => setHomeTab("community"));

    // profile button on home goes to accounts list
    $("frame6ProfileBtn")?.addEventListener("click", () => {
      renderAccounts();
      showFrame(5);
    });

    // card click open chat/quiz/game
    const track = $("homeCardsTrack");
    if (track) {
      track.addEventListener("click", (e) => {
        const card = e.target.closest(".frame6-card");
        if (!card) return;

        const mode = card.dataset.card;
        const isQuiz = card.dataset.quiz === "1";
        const game = card.dataset.game;

        if (mode) {
          openChat(mode);
          return;
        }
        if (isQuiz) {
          const forTab = card.dataset.forTab || "healthcare";
          openQuizSetup(forTab);
          return;
        }
        if (game === "scramble") {
          openScrambleSetup();
          return;
        }
        if (game === "tictactoe") {
          openTttSetup();
          return;
        }
      });
    }
  }

  function setHomeTab(tab){
    tab = String(tab || "home").toLowerCase();
    localStorage.setItem(LS.lastTab, tab);

    const highlight = $("tabHighlight");
    const tabs = [
      { key:"home", el:$("tabHome"), idx:0 },
      { key:"healthcare", el:$("tabHealthcare"), idx:1 },
      { key:"sports", el:$("tabSports"), idx:2 },
      { key:"education", el:$("tabEducation"), idx:3 },
      { key:"community", el:$("tabCommunity"), idx:4 },
    ];
    tabs.forEach(t => t.el?.classList.toggle("active", t.key === tab));
    if (highlight) highlight.style.transform = `translateX(${(tabs.find(t=>t.key===tab)?.idx || 0) * 100}%)`;

    // filter cards
    $$(".frame6-card").forEach(card => {
      const home = card.dataset.home === "1";
      const forTab = card.dataset.forTab;
      const isQuiz = card.dataset.quiz === "1";
      const game = card.dataset.game;

      // default show on Home
      if (tab === "home"){
        card.style.display = home ? "block" : "none";
        return;
      }

      // show chat card for matching mode
      if (card.dataset.card){
        card.style.display = (card.dataset.card === tab) ? "block" : "none";
        return;
      }

      // show quiz/game only for matching tab
      if (isQuiz || game){
        card.style.display = (forTab === tab) ? "block" : "none";
        return;
      }

      // other home-only extras
      card.style.display = "none";
    });
  }

  function applyActiveAccountToUI(){
    const acc = getActiveAccount();
    if (!acc) return;
    const img6 = $("frame6ProfileImg");
    if (img6) img6.src = acc.avatar || "Pic13.png";
  }

  // ---- Chat (frame 7)
  function wireChat(){
    $("chatBackBtn")?.addEventListener("click", () => {
      stopSpeech();
      showFrame(6);
    });

    $("newChatBtn")?.addEventListener("click", () => {
      createNewThread(state.activeMode, true);
    });

    // threads list clicks
    $("threadsList")?.addEventListener("click", (e) => {
      const item = e.target.closest(".thread-item");
      if (!item) return;
      const del = e.target.closest(".thread-del");
      const id = item.dataset.id;
      if (del){
        deleteThread(state.activeMode, id);
        return;
      }
      setActiveThread(state.activeMode, id);
      renderThreads(state.activeMode);
      renderChat();
    });

    // send
    $("chatSend")?.addEventListener("click", () => sendChat());
    $("chatInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        sendChat();
      }
    });

    // add (file)
    $("chatAdd")?.addEventListener("click", () => $("filePicker")?.click());

    // mic language
    $("micLangBtn")?.addEventListener("click", () => $("micLangMenu")?.classList.toggle("show"));
    $$(".mic-lang-item").forEach(it => {
      it.addEventListener("click", () => {
        state.micLang = it.dataset.lang || "en-US";
        $("micLangBtn").textContent = (state.micLang.startsWith("th") ? "TH" : "EN");
        $("micLangMenu")?.classList.remove("show");
      });
    });

    // mic (speech recognition)
    $("chatMic")?.addEventListener("click", () => toggleSpeech());

    // tap to ask focus
    $("tapToAsk")?.addEventListener("click", () => $("chatInput")?.focus());
  }

  function openChat(mode){
    if (!Modes[mode]) mode = "healthcare";
    state.activeMode = mode;

    // title
    const title = $("chatTitle");
    if (title) title.textContent = Modes[mode].title;

    // ensure a thread exists
    const active = state.activeThreadByMode[mode];
    if (!active || !state.threads?.[mode]?.[active]){
      createNewThread(mode, false);
    }

    renderThreads(mode);
    renderChat();
    showFrame(7);
    $("chatInput")?.focus();
  }

  function renderThreads(mode){
    const list = $("threadsList");
    const title = $("threadsTitle");
    if (title) title.textContent = "History • " + (Modes[mode]?.title || mode);
    if (!list) return;

    const map = state.threads[mode] || {};
    const items = Object.values(map).sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

    list.innerHTML = "";
    if (items.length === 0){
      const d = document.createElement("div");
      d.style.color = "rgba(232,238,246,.7)";
      d.style.fontSize = "12px";
      d.style.padding = "6px";
      d.textContent = "No history yet. Click + New.";
      list.appendChild(d);
      return;
    }

    const activeId = state.activeThreadByMode[mode];
    items.forEach(th => {
      const div = document.createElement("div");
      div.className = "thread-item" + (th.id === activeId ? " active" : "");
      const lastMsg = (th.messages || []).slice(-1)[0]?.content || "";
      div.dataset.id = th.id;
      div.innerHTML = `
        <span class="thread-del">✕</span>
        <div class="thread-title">${escapeHTML(th.title || "Chat")}</div>
        <div class="thread-sub">${escapeHTML(lastMsg.slice(0,48) || "—")}</div>
      `;
      list.appendChild(div);
    });
  }

  function renderChat(){
    const box = $("chatHistory");
    if (!box) return;
    box.innerHTML = "";

    const thread = getActiveThread(state.activeMode);
    const messages = thread?.messages || [];

    if (messages.length === 0){
      box.appendChild(sysLine("Start a conversation. Be specific about goals and context."));
    }

    messages.forEach(m => {
      const row = document.createElement("div");
      row.className = "msg " + (m.role === "user" ? "user" : "assistant");
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = String(m.content || "");
      row.appendChild(bubble);
      box.appendChild(row);
    });

    box.scrollTop = box.scrollHeight + 9999;
  }

  function sysLine(text){
    const d = document.createElement("div");
    d.className = "sysline";
    d.textContent = text;
    return d;
  }

  async function sendChat(){
    const input = $("chatInput");
    if (!input) return;
    const text = String(input.value || "").trim();
    if (!text) return;

    input.value = "";
    const thread = getActiveThread(state.activeMode);
    if (!thread) return;

    thread.messages.push({ role:"user", content:text });
    thread.updatedAt = now();
    saveThreads();
    renderThreads(state.activeMode);
    renderChat();

    // assistant placeholder
    const thinking = { role:"assistant", content:"…" };
    thread.messages.push(thinking);
    saveThreads();
    renderChat();

    // call API
    try{
      const acc = getActiveAccount();
      const profile = {
        name: acc?.nickname || "",
        ageNumber: acc?.age ?? "",
      };

      const body = {
        type: Modes[state.activeMode].type,
        message: text,
        history: thread.messages.filter(m => m !== thinking).map(m => ({ role:m.role, content:m.content })),
        profile
      };

      const reply = await postJSON(API_URL, body);

      thinking.content = (reply && reply.reply) ? String(reply.reply) : String(reply || "No reply");
      thread.updatedAt = now();
      saveThreads();
      renderThreads(state.activeMode);
      renderChat();
    } catch (e){
      thinking.content = "Sorry — network/API error. Please try again.";
      saveThreads();
      renderChat();
    }
  }

  async function postJSON(url, data){
    const res = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(data)
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = j?.error || j?.message || ("HTTP " + res.status);
      throw new Error(msg);
    }
    return j;
  }

  // ---- Speech recognition (optional)
  function toggleSpeech(){
    if (state.recognizing){ stopSpeech(); return; }
    startSpeech();
  }

  function startSpeech(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      // no support
      flashFeedback("Mic not supported on this browser.");
      return;
    }
    stopSpeech();

    const rec = new SR();
    rec.lang = state.micLang || "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    state.speech = rec;
    state.recognizing = true;
    $("voiceCenter")?.classList.add("show");

    let startAt = now();
    const tick = setInterval(() => {
      if (!state.recognizing) { clearInterval(tick); return; }
      const s = Math.floor((now() - startAt)/1000);
      const mm = String(Math.floor(s/60)).padStart(2,"0");
      const ss = String(s%60).padStart(2,"0");
      const t = $("voiceTime");
      if (t) t.textContent = `${mm}:${ss}`;
    }, 250);

    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++){
        transcript += e.results[i][0].transcript;
      }
      const input = $("chatInput");
      if (input) input.value = transcript.trim();
    };

    rec.onerror = () => { /* ignore */ };
    rec.onend = () => {
      state.recognizing = false;
      $("voiceCenter")?.classList.remove("show");
    };

    rec.start();
  }

  function stopSpeech(){
    state.recognizing = false;
    $("voiceCenter")?.classList.remove("show");
    if (state.speech){
      try { state.speech.stop(); } catch {}
      state.speech = null;
    }
  }

  function flashFeedback(text){
    const box = $("quizFeedback") || $("scrambleFeedback") || $("tttFeedback");
    if (!box) return;
    box.textContent = text;
    setTimeout(() => { if (box.textContent === text) box.textContent = ""; }, 1600);
  }

  // ---- Threads storage helpers
  function loadThreads(){
    const obj = safeJSONParse(localStorage.getItem(LS.chatThreads) || "{}", {});
    // sanitize
    const out = {};
    Object.keys(Modes).forEach(mode => {
      const m = obj[mode] && typeof obj[mode] === "object" ? obj[mode] : {};
      out[mode] = {};
      Object.values(m).forEach(th => {
        if (!th || typeof th !== "object") return;
        const id = th.id || uid();
        out[mode][id] = {
          id,
          title: String(th.title || "Chat").slice(0,60),
          updatedAt: Number(th.updatedAt || 0),
          messages: Array.isArray(th.messages) ? th.messages.filter(x => x && (x.role==="user"||x.role==="assistant") && typeof x.content==="string").slice(-120) : []
        };
      });
    });
    return out;
  }
  function saveThreads(){
    localStorage.setItem(LS.chatThreads, JSON.stringify(state.threads));
  }
  function loadActiveThreadMap(){
    const obj = safeJSONParse(localStorage.getItem(LS.activeThread) || "{}", {});
    const out = {};
    Object.keys(Modes).forEach(mode => out[mode] = obj[mode] || null);
    return out;
  }
  function saveActiveThreadMap(){
    localStorage.setItem(LS.activeThread, JSON.stringify(state.activeThreadByMode));
  }

  function createNewThread(mode, focus){
    if (!Modes[mode]) mode = "healthcare";
    if (!state.threads[mode]) state.threads[mode] = {};

    const id = uid();
    const th = {
      id,
      title: "New chat",
      updatedAt: now(),
      messages: []
    };
    state.threads[mode][id] = th;
    setActiveThread(mode, id);
    saveThreads();
    renderThreads(mode);
    renderChat();
    if (focus) $("chatInput")?.focus();
  }

  function deleteThread(mode, id){
    if (!state.threads[mode]) return;
    delete state.threads[mode][id];
    // pick newest
    const ids = Object.keys(state.threads[mode]);
    state.activeThreadByMode[mode] = ids[0] || null;
    saveThreads(); saveActiveThreadMap();
    renderThreads(mode);
    renderChat();
  }

  function setActiveThread(mode, id){
    state.activeThreadByMode[mode] = id;
    saveActiveThreadMap();
  }

  function getActiveThread(mode){
    const id = state.activeThreadByMode[mode];
    if (!id) return null;
    return state.threads?.[mode]?.[id] || null;
  }

  // ---- Quiz (Frames 8-10)
  function wireQuiz(){
    // back buttons
    $("quizBackBtn1")?.addEventListener("click", () => showFrame(6));
    $("quizBackBtn2")?.addEventListener("click", () => { stopQuizTimer(); showFrame(8); });
    $("quizBackBtn3")?.addEventListener("click", () => showFrame(6));

    $("quizStartBtn")?.addEventListener("click", () => startQuiz());
    $("quizNextBtn")?.addEventListener("click", () => quizNext());

    $("quizPlayAgainBtn")?.addEventListener("click", () => {
      if (state.quiz.mode) openQuizSetup(state.quiz.mode);
    });
    $("quizBackHomeBtn")?.addEventListener("click", () => showFrame(6));
  }

  function openQuizSetup(mode){
    if (!Modes[mode]) mode = "healthcare";
    state.quiz.mode = mode;

    $("quizSetupTitle").textContent = titleFor(mode) + " Quiz";
    $("quizTopicLabel").textContent = `Enter a ${titleFor(mode)} quiz topic`;

    $("quizFeedback").textContent = "";
    showFrame(8);
  }

  async function startQuiz(){
    const mode = state.quiz.mode || "healthcare";
    const topic = String($("quizTopicInput")?.value || "").trim() || defaultQuizTopic(mode);
    const count = clamp($("quizCountSelect")?.value || 8, 5, 12);
    const gradeSel = String($("quizGradeSelect")?.value || "Auto (based on age)");
    const diff = String($("quizDifficultySelect")?.value || "Medium");
    const timer = clamp($("quizTimerSelect")?.value || 0, 0, 120);

    // grade auto based on age
    let grade = gradeSel;
    if (gradeSel.startsWith("Auto")){
      const age = Number(getActiveAccount()?.age || 18);
      if (age <= 6) grade = "Kindergarten";
      else if (age <= 9) grade = "Grade 1–3";
      else if (age <= 12) grade = "Grade 4–6";
      else if (age <= 15) grade = "Grade 7–9";
      else if (age <= 18) grade = "Grade 10–12";
      else grade = "University";
    }

    // UI loading
    $("quizQuestionText").textContent = "Generating quiz…";
    $("quizChoices").innerHTML = "";
    $("quizFeedback").textContent = "Please wait…";
    $("quizNextBtn").disabled = true;

    // move to play screen
    showFrame(9);

    try{
      const acc = getActiveAccount();
      const profile = { name: acc?.nickname || "", ageNumber: acc?.age ?? "" };
      const payload = { category: mode, topic, numQuestions: count, gradeLevel: grade, difficulty: diff, timed: timer > 0, secondsPerQuestion: timer || 0 };

      const reply = await postJSON(API_URL, {
        type: Modes[mode].quizType,
        message: JSON.stringify(payload),
        history: [],
        profile
      });

      // reply.reply is a JSON string
      const jsonStr = String(reply.reply || "");
      const obj = safeJSONParse(jsonStr, null);
      if (!obj || !Array.isArray(obj.questions)) throw new Error("Invalid quiz JSON");

      state.quiz.json = obj;
      state.quiz.idx = 0;
      state.quiz.score = 0;
      state.quiz.timerSec = timer || 0;
      state.quiz.locked = false;

      // cache
      const cache = safeJSONParse(localStorage.getItem(LS.quizCache) || "{}", {});
      cache[mode] = obj;
      localStorage.setItem(LS.quizCache, JSON.stringify(cache));

      renderQuizQuestion();
    } catch (e){
      $("quizFeedback").textContent = "Quiz generation failed. Try again.";
      $("quizQuestionText").textContent = "Error";
      $("quizChoices").innerHTML = "";
    }
  }

  function renderQuizQuestion(){
    stopQuizTimer();
    const q = state.quiz.json?.questions?.[state.quiz.idx];
    if (!q){
      showQuizResult();
      return;
    }
    $("quizProgress").textContent = `Q${state.quiz.idx + 1} / ${state.quiz.json.questions.length}`;
    $("quizFeedback").textContent = "";
    $("quizNextBtn").disabled = true;
    state.quiz.locked = false;

    $("quizQuestionText").textContent = q.question || "Question";
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const wrap = $("quizChoices");
    wrap.innerHTML = "";
    choices.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.type = "button";
      btn.textContent = String(text);
      btn.addEventListener("click", () => pickQuizChoice(i));
      wrap.appendChild(btn);
    });

    if (state.quiz.timerSec > 0){
      state.quiz.tLeft = state.quiz.timerSec;
      updateQuizTimerPill();
      state.quiz.timerId = setInterval(() => {
        state.quiz.tLeft -= 1;
        updateQuizTimerPill();
        if (state.quiz.tLeft <= 0){
          stopQuizTimer();
          $("quizFeedback").textContent = "Time up! Next question.";
          setTimeout(() => quizNext(true), 450);
        }
      }, 1000);
    } else {
      $("quizTimerPill").textContent = "No timer";
    }
  }

  function updateQuizTimerPill(){
    const s = Math.max(0, state.quiz.tLeft);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    $("quizTimerPill").textContent = `${mm}:${ss}`;
  }

  function stopQuizTimer(){
    if (state.quiz.timerId){
      clearInterval(state.quiz.timerId);
      state.quiz.timerId = null;
    }
  }

  function pickQuizChoice(i){
    if (state.quiz.locked) return;
    state.quiz.locked = true;
    stopQuizTimer();

    const q = state.quiz.json.questions[state.quiz.idx];
    const correct = clamp(q.answerIndex, 0, 3);

    const buttons = $$(".choice-btn", $("quizChoices"));
    buttons.forEach((b, idx) => {
      b.disabled = true;
      if (idx === correct) b.classList.add("correct");
      if (idx === i && idx !== correct) b.classList.add("wrong");
    });

    if (i === correct) state.quiz.score += 1;
    $("quizFeedback").textContent = q.explanation ? `Explanation: ${q.explanation}` : (i === correct ? "Correct ✅" : "Wrong ❌");

    $("quizNextBtn").disabled = false;
  }

  function quizNext(auto=false){
    if (!auto && !state.quiz.locked) return; // must answer before next
    state.quiz.idx += 1;
    renderQuizQuestion();
  }

  function showQuizResult(){
    stopQuizTimer();
    const total = state.quiz.json?.questions?.length || 0;
    const score = state.quiz.score || 0;
    $("quizScoreText").textContent = `Score: ${score} / ${total}`;
    $("quizCongratsText").textContent = score === total ? "Perfect! 🎉" : (score >= Math.ceil(total*0.7) ? "Great job! 👏" : "Nice try — keep practicing 💪");
    showFrame(10);
  }

  function defaultQuizTopic(mode){
    if (mode === "healthcare") return "First aid basics";
    if (mode === "sports") return "Training & recovery";
    if (mode === "education") return "General knowledge";
    return "Communication & kindness";
  }

  function titleFor(mode){
    return mode === "healthcare" ? "Healthcare" :
           mode === "sports" ? "Sports & Fitness" :
           mode === "education" ? "Education" :
           "Community";
  }

  // ---- Scramble (Frames 11-12)
  function wireScramble(){
    $("scrambleBackBtn1")?.addEventListener("click", () => showFrame(6));
    $("scrambleBackBtn2")?.addEventListener("click", () => { stopScrambleTimer(); showFrame(11); });

    $("scrambleStartBtn")?.addEventListener("click", () => {
      state.scramble.topic = $("scrambleTopicSelect")?.value || "Random";
      state.scramble.difficulty = $("scrambleDifficultySelect")?.value || "Medium";
      startScramble();
    });

    $("scrambleRefreshBtn")?.addEventListener("click", () => fetchScrambleWord(true));
    $("scrambleCheckBtn")?.addEventListener("click", () => checkScramble());
    $("scrambleAnswerInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); checkScramble(); }
    });
  }

  function openScrambleSetup(){
    $("scrambleFeedback").textContent = "";
    showFrame(11);
  }

  async function startScramble(){
    $("scrambleWordText").textContent = "L O A D I N G";
    $("scrambleHintText").textContent = "—";
    $("scrambleFeedback").textContent = "Getting a word…";
    $("scrambleAnswerInput").value = "";
    showFrame(12);

    state.scramble.tLeft = 30;
    updateScrambleTimer();
    stopScrambleTimer();
    state.scramble.timerId = setInterval(() => {
      state.scramble.tLeft -= 1;
      updateScrambleTimer();
      if (state.scramble.tLeft <= 0){
        stopScrambleTimer();
        $("scrambleFeedback").textContent = "Time up! Refreshing…";
        setTimeout(() => fetchScrambleWord(true), 350);
      }
    }, 1000);

    await fetchScrambleWord(false);
  }

  function updateScrambleTimer(){
    $("scrambleTimePill").textContent = `Time: 00:${String(Math.max(0,state.scramble.tLeft)).padStart(2,"0")}`;
  }
  function stopScrambleTimer(){
    if (state.scramble.timerId){
      clearInterval(state.scramble.timerId);
      state.scramble.timerId = null;
    }
  }

  function scrambleWord(word){
    const arr = word.split("");
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join("");
  }

  async function fetchScrambleWord(fromRefresh){
    try{
      const topic = state.scramble.topic || "Random";
      const difficulty = state.scramble.difficulty || "Medium";

      $("scrambleFeedback").textContent = fromRefresh ? "Refreshing…" : "Loading…";

      const prompt =
        `Give me 12 single English words for a word-scramble game. Topic="${topic}". Difficulty="${difficulty}". ` +
        `Rules: output ONLY JSON like {"words":["word1","word2",...],"hints":{"word1":"short hint",...}}. ` +
        `Words must be single words (no spaces), 4-12 letters, A-Z only.`;

      const acc = getActiveAccount();
      const profile = { name: acc?.nickname || "", ageNumber: acc?.age ?? "" };

      const reply = await postJSON(API_URL, {
        type: Modes.education.type, // use education for word generation
        message: prompt,
        history: [],
        profile
      });

      const obj = safeJSONParse(String(reply.reply || ""), null);
      const words = Array.isArray(obj?.words) ? obj.words : [];
      const hints = obj?.hints && typeof obj.hints === "object" ? obj.hints : {};

      const clean = words
        .map(w => String(w || "").trim())
        .filter(w => /^[A-Za-z]{4,12}$/.test(w));

      if (clean.length === 0) throw new Error("No words");

      const pick = clean[Math.floor(Math.random() * clean.length)];
      state.scramble.answer = pick.toLowerCase();
      state.scramble.scrambled = scrambleWord(pick.toUpperCase());
      state.scramble.hint = String(hints[pick] || `Length: ${pick.length} letters`);

      $("scrambleWordText").textContent = spaced(state.scramble.scrambled);
      $("scrambleHintText").textContent = state.scramble.hint;
      $("scrambleFeedback").textContent = "";
      $("scrambleAnswerInput").value = "";
      $("scrambleAnswerInput").focus();

      // reset timer for each new word
      state.scramble.tLeft = 30;
      updateScrambleTimer();

    } catch (e){
      $("scrambleFeedback").textContent = "Failed to get a word. Try Refresh.";
    }
  }

  function spaced(s){
    return String(s || "").split("").join(" ");
  }

  function checkScramble(){
    const guess = String($("scrambleAnswerInput")?.value || "").trim().toLowerCase();
    if (!guess) return;
    if (guess === state.scramble.answer){
      $("scrambleFeedback").textContent = "Correct ✅ Refresh for next word!";
      // auto refresh after short delay
      setTimeout(() => fetchScrambleWord(true), 700);
    } else {
      $("scrambleFeedback").textContent = "Wrong ❌ Try again.";
    }
  }

  // ---- Tic Tac Toe (Frames 13-14)
  function wireTicTacToe(){
    $("tttBackBtn1")?.addEventListener("click", () => showFrame(6));
    $("tttBackBtn2")?.addEventListener("click", () => showFrame(6));

    $("tttMode1p")?.addEventListener("click", () => setTttMode("1p"));
    $("tttMode2p")?.addEventListener("click", () => setTttMode("2p"));

    $("tttSideX")?.addEventListener("click", () => setTttSide("X"));
    $("tttSideO")?.addEventListener("click", () => setTttSide("O"));

    $("tttStartBtn")?.addEventListener("click", () => startTtt());
    $("tttResetBtn")?.addEventListener("click", () => resetTtt());

    $$(".ttt-cell").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.cell);
        playTtt(idx);
      });
    });

    renderTttSetup();
    resetTtt();
  }

  function openTttSetup(){
    renderTttSetup();
    showFrame(13);
  }

  function setTttMode(mode){
    state.ttt.mode = mode;
    renderTttSetup();
  }
  function setTttSide(side){
    state.ttt.human = side;
    state.ttt.ai = side === "X" ? "O" : "X";
    renderTttSetup();
  }
  function renderTttSetup(){
    $("tttMode1p")?.classList.toggle("active", state.ttt.mode === "1p");
    $("tttMode2p")?.classList.toggle("active", state.ttt.mode === "2p");
    $("tttSideX")?.classList.toggle("active", state.ttt.human === "X");
    $("tttSideO")?.classList.toggle("active", state.ttt.human === "O");
  }

  function startTtt(){
    resetTtt();
    showFrame(14);
    // if 1p and human chose O, AI starts
    if (state.ttt.mode === "1p" && state.ttt.human === "O"){
      aiMove();
    }
  }

  function resetTtt(){
    state.ttt.board = Array(9).fill("");
    state.ttt.turn = "X";
    state.ttt.over = false;
    $("tttFeedback").textContent = "";
    updateTttStatus();
    renderTttBoard();
  }

  function updateTttStatus(){
    const pill = $("tttStatusPill");
    if (!pill) return;

    if (state.ttt.over){
      // keep last feedback
      return;
    }
    if (state.ttt.mode === "2p"){
      pill.textContent = `Player ${state.ttt.turn} turn`;
    } else {
      pill.textContent = (state.ttt.turn === state.ttt.human) ? `Your (${state.ttt.human}) turn` : `AI (${state.ttt.ai}) turn`;
    }
  }

  function renderTttBoard(){
    $$(".ttt-cell").forEach((btn, i) => {
      btn.textContent = state.ttt.board[i] || "";
      btn.disabled = state.ttt.over || !!state.ttt.board[i] || (state.ttt.mode==="1p" && state.ttt.turn!==state.ttt.human);
    });
  }

  function playTtt(i){
    if (state.ttt.over) return;
    if (state.ttt.board[i]) return;

    // 2p: allow any
    // 1p: only allow human turn
    if (state.ttt.mode === "1p" && state.ttt.turn !== state.ttt.human) return;

    state.ttt.board[i] = state.ttt.turn;
    if (checkWin(state.ttt.board, state.ttt.turn)){
      endTtt(`${state.ttt.turn} wins!`);
      return;
    }
    if (state.ttt.board.every(x => x)){
      endTtt("Draw!");
      return;
    }
    state.ttt.turn = (state.ttt.turn === "X") ? "O" : "X";
    updateTttStatus();
    renderTttBoard();

    if (state.ttt.mode === "1p"){
      setTimeout(aiMove, 320);
    }
  }

  function aiMove(){
    if (state.ttt.over) return;
    if (state.ttt.turn !== state.ttt.ai) { updateTttStatus(); renderTttBoard(); return; }

    // simple AI: win > block > center > corners > random
    const b = state.ttt.board.slice();
    const ai = state.ttt.ai;
    const hu = state.ttt.human;

    const winIdx = findWinningMove(b, ai);
    if (winIdx != null) return commitAi(winIdx);

    const blockIdx = findWinningMove(b, hu);
    if (blockIdx != null) return commitAi(blockIdx);

    if (!b[4]) return commitAi(4);

    const corners = [0,2,6,8].filter(i => !b[i]);
    if (corners.length) return commitAi(corners[Math.floor(Math.random()*corners.length)]);

    const empties = b.map((v,i)=>v?null:i).filter(v=>v!=null);
    if (empties.length) return commitAi(empties[Math.floor(Math.random()*empties.length)]);
  }

  function commitAi(i){
    state.ttt.board[i] = state.ttt.ai;
    if (checkWin(state.ttt.board, state.ttt.ai)){
      endTtt(`AI (${state.ttt.ai}) wins!`);
      return;
    }
    if (state.ttt.board.every(x => x)){
      endTtt("Draw!");
      return;
    }
    state.ttt.turn = state.ttt.human;
    updateTttStatus();
    renderTttBoard();
  }

  function endTtt(text){
    state.ttt.over = true;
    $("tttFeedback").textContent = text;
    const pill = $("tttStatusPill");
    if (pill) pill.textContent = text;
    renderTttBoard();
  }

  function checkWin(b, p){
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return lines.some(([a,c,d]) => b[a]===p && b[c]===p && b[d]===p);
  }

  function findWinningMove(board, player){
    const empties = board.map((v,i)=>v?null:i).filter(v=>v!=null);
    for (const i of empties){
      const b = board.slice();
      b[i]=player;
      if (checkWin(b, player)) return i;
    }
    return null;
  }

  // ---- accounts storage
  function loadAccounts(){
    const arr = safeJSONParse(localStorage.getItem(LS.accounts) || "[]", []);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(a => a && typeof a === "object")
      .map(a => ({
        id: String(a.id || uid()),
        nickname: String(a.nickname || "User").slice(0,40),
        age: clamp(a.age ?? 18, 0, 140),
        avatar: String(a.avatar || "Pic13.png"),
        createdAt: Number(a.createdAt || now()),
        updatedAt: Number(a.updatedAt || now())
      }));
  }
  function saveAccounts(){
    localStorage.setItem(LS.accounts, JSON.stringify(state.accounts));
  }
  function setActiveAccount(id){
    state.activeAccountId = id;
    localStorage.setItem(LS.activeAccountId, id);
  }
  function getActiveAccount(){
    return state.accounts.find(a => a.id === state.activeAccountId) || null;
  }

  function escapeHTML(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();
