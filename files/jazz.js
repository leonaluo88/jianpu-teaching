/* 爵士和弦听辨（C 调）。依赖 app.js 里的 loadStorage / saveStorage / loadPianoSampler / playPianoSample。 */
(() => {
  if (document.body.dataset.page !== "jazz") {
    return;
  }

  const JAZZ_STORAGE_KEY = "jianpu-teaching-jazz-state-v1";
  const DEFAULT_JAZZ_STATE = {
    view: "listen",
    listenArpeggio: false,
    quizArpeggio: false,
    reference: false,
    groups: ["diatonic"],
    right: 0,
    total: 0,
  };

  const SOLFEGE = { 1: "Do", 2: "Re", 3: "Mi", 4: "Fa", 5: "So", 6: "La", 7: "Si" };
  const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

  const GROUPS = [
    { id: "diatonic", title: "自然七和弦", note: "C 大调音阶上叠出的七个七和弦" },
    { id: "extended", title: "六和弦与九和弦", note: "在七和弦上加 6 音、9 音、13 音的色彩" },
    { id: "dominant", title: "属七变化与副属和弦", note: "挂留、降九，以及指向其他和弦的属七" },
    { id: "borrowed", title: "借用与减七", note: "从 c 小调借来的和弦与减七和弦" },
  ];

  // bass：最低音的 MIDI 音高（C4 = 60）；offsets：相对最低音的半音数，按实际弹奏从低到高
  // degrees：实际弹出的音（去掉重复的根音），用简谱数字写
  const CHORDS = [
    { id: "Cmaj7", group: "diatonic", symbol: "Cmaj7", roman: "Imaj7", bass: 48, offsets: [0, 12, 16, 19, 23], degrees: ["1", "3", "5", "7"], notes: "C E G B" },
    { id: "Dm7", group: "diatonic", symbol: "Dm7", roman: "IIm7", bass: 50, offsets: [0, 12, 15, 19, 22], degrees: ["2", "4", "6", "1"], notes: "D F A C" },
    { id: "Em7", group: "diatonic", symbol: "Em7", roman: "IIIm7", bass: 52, offsets: [0, 12, 15, 19, 22], degrees: ["3", "5", "7", "2"], notes: "E G B D" },
    { id: "Fmaj7", group: "diatonic", symbol: "Fmaj7", roman: "IVmaj7", bass: 41, offsets: [0, 12, 16, 19, 23], degrees: ["4", "6", "1", "3"], notes: "F A C E" },
    { id: "G7", group: "diatonic", symbol: "G7", roman: "V7", bass: 43, offsets: [0, 12, 16, 19, 22], degrees: ["5", "7", "2", "4"], notes: "G B D F" },
    { id: "Am7", group: "diatonic", symbol: "Am7", roman: "VIm7", bass: 45, offsets: [0, 12, 15, 19, 22], degrees: ["6", "1", "3", "5"], notes: "A C E G" },
    { id: "Bm7b5", group: "diatonic", symbol: "Bm7♭5", roman: "VIIm7♭5", bass: 47, offsets: [0, 12, 15, 18, 22], degrees: ["7", "2", "4", "6"], notes: "B D F A" },

    { id: "C6", group: "extended", symbol: "C6", roman: "I6", bass: 48, offsets: [0, 12, 16, 19, 21], degrees: ["1", "3", "5", "6"], notes: "C E G A" },
    { id: "C69", group: "extended", symbol: "C6/9", roman: "I6/9", bass: 48, offsets: [0, 12, 16, 21, 26], degrees: ["1", "3", "6", "2"], notes: "C E A D", remark: "省略五音" },
    { id: "Cmaj9", group: "extended", symbol: "Cmaj9", roman: "Imaj9", bass: 48, offsets: [0, 12, 16, 19, 23, 26], degrees: ["1", "3", "5", "7", "2"], notes: "C E G B D" },
    { id: "Dm9", group: "extended", symbol: "Dm9", roman: "IIm9", bass: 50, offsets: [0, 12, 15, 19, 22, 26], degrees: ["2", "4", "6", "1", "3"], notes: "D F A C E" },
    { id: "G9", group: "extended", symbol: "G9", roman: "V9", bass: 43, offsets: [0, 12, 16, 19, 22, 26], degrees: ["5", "7", "2", "4", "6"], notes: "G B D F A" },
    { id: "G13", group: "extended", symbol: "G13", roman: "V13", bass: 43, offsets: [0, 10, 16, 21], degrees: ["5", "4", "7", "3"], notes: "G F B E", remark: "常见弹法：根音 + 七音 + 三音 + 十三音" },

    { id: "G7sus4", group: "dominant", symbol: "G7sus4", roman: "V7sus4", bass: 43, offsets: [0, 12, 17, 19, 22], degrees: ["5", "1", "2", "4"], notes: "G C D F", remark: "用 4 级音代替 3 级音" },
    { id: "G7b9", group: "dominant", symbol: "G7♭9", roman: "V7♭9", bass: 43, offsets: [0, 12, 16, 22, 25], degrees: ["5", "7", "4", "♭6"], notes: "G B F A♭", remark: "省略五音" },
    { id: "C7", group: "dominant", symbol: "C7", roman: "I7", bass: 48, offsets: [0, 12, 16, 19, 22], degrees: ["1", "3", "5", "♭7"], notes: "C E G B♭", remark: "副属和弦：通往 Fmaj7" },
    { id: "D7", group: "dominant", symbol: "D7", roman: "II7", bass: 50, offsets: [0, 12, 16, 19, 22], degrees: ["2", "♯4", "6", "1"], notes: "D F♯ A C", remark: "副属和弦：通往 G7" },
    { id: "E7", group: "dominant", symbol: "E7", roman: "III7", bass: 52, offsets: [0, 12, 16, 19, 22], degrees: ["3", "♯5", "7", "2"], notes: "E G♯ B D", remark: "副属和弦：通往 Am7" },
    { id: "A7", group: "dominant", symbol: "A7", roman: "VI7", bass: 45, offsets: [0, 12, 16, 19, 22], degrees: ["6", "♯1", "3", "5"], notes: "A C♯ E G", remark: "副属和弦：通往 Dm7" },

    { id: "Fm6", group: "borrowed", symbol: "Fm6", roman: "IVm6", bass: 41, offsets: [0, 12, 15, 19, 21], degrees: ["4", "♭6", "1", "2"], notes: "F A♭ C D" },
    { id: "Fm7", group: "borrowed", symbol: "Fm7", roman: "IVm7", bass: 41, offsets: [0, 12, 15, 19, 22], degrees: ["4", "♭6", "1", "♭3"], notes: "F A♭ C E♭" },
    { id: "Bb7", group: "borrowed", symbol: "B♭7", roman: "♭VII7", bass: 46, offsets: [0, 12, 16, 19, 22], degrees: ["♭7", "2", "4", "♭6"], notes: "B♭ D F A♭", remark: "常直接回到 Cmaj7（后门进行）" },
    { id: "Fdim7", group: "borrowed", symbol: "Fdim7", roman: "IV°7", bass: 41, offsets: [0, 12, 15, 18, 21], degrees: ["4", "♭6", "7", "2"], notes: "F A♭ B D", remark: "和 Bdim7 是同一组音；也可看作无根音的 G7♭9" },
  ];

  const KEY_LOW = 41; // F2
  const KEY_HIGH = 77; // F5
  const REFERENCE = { bass: 48, offsets: [0, 12, 16, 19] }; // C 大三和弦

  const chordById = new Map(CHORDS.map((chord) => [chord.id, chord]));
  const groupIds = GROUPS.map((group) => group.id);

  const state = Object.assign({}, DEFAULT_JAZZ_STATE, loadStorage(JAZZ_STORAGE_KEY, DEFAULT_JAZZ_STATE));
  state.view = state.view === "quiz" ? "quiz" : "listen";
  state.groups = Array.isArray(state.groups) ? state.groups.filter((id) => groupIds.includes(id)) : [];
  if (!state.groups.length) {
    state.groups = ["diatonic"];
  }
  state.right = Number.isInteger(state.right) && state.right >= 0 ? state.right : 0;
  state.total = Number.isInteger(state.total) && state.total >= state.right ? state.total : state.right;

  const save = () => saveStorage(JAZZ_STORAGE_KEY, state);

  const $ = (selector) => document.querySelector(selector);
  const statusNode = $("[data-jazz-status]");
  const keyboardNode = $("[data-jazz-keyboard]");
  const listNode = $("[data-jazz-list]");
  const groupsNode = $("[data-jazz-groups]");
  const answerWait = $("[data-jazz-answer-wait]");
  const answerBody = $("[data-jazz-answer-body]");
  const answerCard = $("[data-jazz-answer-card]");
  const tallyNode = $("[data-jazz-tally]");

  const solfegeOf = (degree) => {
    const accidental = degree.startsWith("♭") || degree.startsWith("♯") ? degree[0] : "";
    return `${accidental}${SOLFEGE[degree.slice(accidental.length)]}`;
  };
  const chordMidis = (chord) => chord.offsets.map((offset) => chord.bass + offset);

  /* ---------- 键盘 ---------- */
  const isBlack = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);
  const buildKeyboard = () => {
    const whites = [];
    for (let midi = KEY_LOW; midi <= KEY_HIGH; midi += 1) {
      if (!isBlack(midi)) whites.push(midi);
    }
    const whiteWidth = 100 / whites.length;
    let html = "";
    whites.forEach((midi, index) => {
      const label = midi % 12 === 0 ? `<span>C${Math.floor(midi / 12) - 1}</span>` : "";
      html += `<div class="jazz-key jazz-key--white" data-midi="${midi}" style="left:${index * whiteWidth}%;width:${whiteWidth}%">${label}</div>`;
    });
    for (let midi = KEY_LOW; midi <= KEY_HIGH; midi += 1) {
      if (!isBlack(midi)) continue;
      const leftWhiteIndex = whites.indexOf(midi - 1);
      html += `<div class="jazz-key jazz-key--black" data-midi="${midi}" style="left:${(leftWhiteIndex + 1) * whiteWidth - whiteWidth * 0.31}%;width:${whiteWidth * 0.62}%"></div>`;
    }
    keyboardNode.innerHTML = html;
  };

  const highlightKeys = (midis) => {
    const active = new Set(midis);
    keyboardNode.querySelectorAll(".jazz-key").forEach((key) => {
      key.classList.toggle("is-active", active.has(Number(key.dataset.midi)));
    });
  };

  /* ---------- 声音 ---------- */
  const audio = { context: null, master: null, samples: null, voices: [] };

  const ensureAudio = async () => {
    if (!audio.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("当前浏览器不支持 Web Audio");
      audio.context = new Context();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.85;
      const compressor = audio.context.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      audio.master.connect(compressor);
      compressor.connect(audio.context.destination);
      audio.samplesPromise = loadPianoSampler(audio.context);
    }
    if (audio.context.state === "suspended") {
      await audio.context.resume();
    }
    audio.samples = await audio.samplesPromise;
  };

  const stopAll = () => {
    audio.voices.forEach((voice) => {
      try {
        voice.stop();
      } catch (error) {
        // 已经停止
      }
    });
    audio.voices = [];
  };

  // 合成音色（没有采样时的备用）
  const playSynth = (midi, startTime, gainLevel) => {
    const context = audio.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainLevel * 0.6, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.2);
    oscillator.connect(gain);
    gain.connect(audio.master);
    oscillator.start(startTime);
    oscillator.stop(startTime + 2.3);
    return oscillator;
  };

  // 返回这组音全部弹完所需的秒数
  const playNotes = (midis, startTime, arpeggio) => {
    const gainLevel = 0.9 / Math.sqrt(midis.length);
    const step = arpeggio ? 0.13 : 0;
    midis.forEach((midi, index) => {
      const time = startTime + index * step;
      const voice = audio.samples
        ? playPianoSample(audio.context, audio.samples, midi, audio.master, time, { gain: gainLevel, duration: 2.6 })
        : playSynth(midi, time, gainLevel);
      audio.voices.push(voice);
    });
    return (midis.length - 1) * step;
  };

  const playChord = async (chord, arpeggio, withReference = false) => {
    try {
      await ensureAudio();
    } catch (error) {
      setStatus("当前浏览器无法发声");
      return;
    }
    stopAll();
    let time = audio.context.currentTime + 0.03;
    if (withReference) {
      playNotes(REFERENCE.offsets.map((offset) => REFERENCE.bass + offset), time, false);
      time += 1.6;
    }
    playNotes(chordMidis(chord), time, arpeggio);
  };

  const setStatus = (text) => {
    statusNode.textContent = text;
  };

  /* ---------- 和弦卡片 ---------- */
  const chordDetailHtml = (chord) => `
    <span class="jazz-chord__roman">${chord.roman}</span>
    <span class="jazz-chord__solfege">${chord.degrees.map(solfegeOf).join(" ")}</span>
    <span class="jazz-chord__degrees">${chord.degrees.join(" ")}</span>
    <span class="jazz-chord__notes">${chord.notes}</span>
    ${chord.remark ? `<span class="jazz-chord__remark">${chord.remark}</span>` : ""}`;

  const renderList = () => {
    listNode.innerHTML = GROUPS.map((group) => `
      <section class="jazz-group">
        <h3>${group.title}<small>${group.note}</small></h3>
        <div class="jazz-grid">
          ${CHORDS.filter((chord) => chord.group === group.id).map((chord) => `
            <button class="jazz-chord" type="button" data-jazz-chord="${chord.id}">
              <strong>${chord.symbol}</strong>
              ${chordDetailHtml(chord)}
            </button>`).join("")}
        </div>
      </section>`).join("");
  };

  listNode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jazz-chord]");
    if (!button) return;
    const chord = chordById.get(button.dataset.jazzChord);
    listNode.querySelectorAll(".jazz-chord.is-playing").forEach((node) => node.classList.remove("is-playing"));
    button.classList.add("is-playing");
    highlightKeys(chordMidis(chord));
    setStatus(`正在弹：${chord.symbol}（${chord.degrees.map(solfegeOf).join(" ")}）${state.listenArpeggio ? " · 琶音" : ""}`);
    playChord(chord, state.listenArpeggio);
  });

  /* ---------- 测验 ---------- */
  const quiz = { current: null, revealed: false, marked: false };

  const renderGroups = () => {
    groupsNode.innerHTML = GROUPS.map((group) => {
      const count = CHORDS.filter((chord) => chord.group === group.id).length;
      const checked = state.groups.includes(group.id) ? "checked" : "";
      return `<label class="toggle-card toggle-card--compact"><input type="checkbox" data-jazz-group="${group.id}" ${checked} /><span>${group.title}（${count}）</span></label>`;
    }).join("");
  };

  groupsNode.addEventListener("change", (event) => {
    const input = event.target.closest("[data-jazz-group]");
    if (!input) return;
    const next = groupIds.filter((id) => (id === input.dataset.jazzGroup ? input.checked : state.groups.includes(id)));
    if (!next.length) {
      input.checked = true;
      setStatus("至少要选一组和弦");
      return;
    }
    state.groups = next;
    save();
    quiz.current = null;
    resetAnswer();
    setStatus(`出题范围：${poolOf().length} 个和弦`);
  });

  const poolOf = () => CHORDS.filter((chord) => state.groups.includes(chord.group));

  const pickChord = () => {
    const pool = poolOf();
    const candidates = pool.length > 1 && quiz.current ? pool.filter((chord) => chord.id !== quiz.current.id) : pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const resetAnswer = () => {
    quiz.revealed = false;
    quiz.marked = false;
    answerBody.classList.add("is-hidden");
    answerWait.classList.remove("is-hidden");
    highlightKeys([]);
  };

  const renderTally = () => {
    tallyNode.textContent = `已答 ${state.total} 题，答对 ${state.right} 题${state.total ? `（${Math.round((state.right / state.total) * 100)}%）` : ""}`;
  };

  const playQuiz = () => {
    if (!quiz.current) {
      quiz.current = pickChord();
      resetAnswer();
    }
    setStatus(`第 ${state.total + 1} 题${quiz.revealed ? "" : " · 心里想好再看答案"}`);
    playChord(quiz.current, state.quizArpeggio, state.reference);
  };

  const reveal = () => {
    if (!quiz.current) {
      setStatus("先点“播放题目”");
      return;
    }
    const chord = quiz.current;
    quiz.revealed = true;
    answerWait.classList.add("is-hidden");
    answerBody.classList.remove("is-hidden");
    answerCard.innerHTML = `<strong>${chord.symbol}</strong>${chordDetailHtml(chord)}`;
    answerBody.querySelectorAll("[data-jazz-mark]").forEach((button) => {
      button.disabled = quiz.marked;
    });
    highlightKeys(chordMidis(chord));
    setStatus(`答案：${chord.symbol}`);
  };

  $("[data-jazz-play]").addEventListener("click", playQuiz);
  $("[data-jazz-reveal]").addEventListener("click", reveal);
  $("[data-jazz-next]").addEventListener("click", () => {
    quiz.current = pickChord();
    resetAnswer();
    playQuiz();
  });

  answerBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jazz-mark]");
    if (!button || quiz.marked) return;
    quiz.marked = true;
    state.total += 1;
    if (button.dataset.jazzMark === "right") state.right += 1;
    save();
    renderTally();
    answerBody.querySelectorAll("[data-jazz-mark]").forEach((node) => {
      node.disabled = true;
    });
    setStatus("已记录，点“下一题”继续");
  });

  $("[data-jazz-tally-reset]").addEventListener("click", () => {
    state.right = 0;
    state.total = 0;
    save();
    renderTally();
  });

  /* ---------- 开关与模块切换 ---------- */
  document.querySelectorAll("[data-jazz-arpeggio]").forEach((input) => {
    const key = input.dataset.jazzArpeggio === "quiz" ? "quizArpeggio" : "listenArpeggio";
    input.checked = Boolean(state[key]);
    input.addEventListener("change", () => {
      state[key] = input.checked;
      save();
    });
  });

  const referenceInput = $("[data-jazz-reference]");
  referenceInput.checked = Boolean(state.reference);
  referenceInput.addEventListener("change", () => {
    state.reference = referenceInput.checked;
    save();
  });

  const showView = (view) => {
    state.view = view;
    save();
    stopAll();
    document.querySelectorAll("[data-jazz-view]").forEach((button) => {
      const selected = button.dataset.jazzView === view;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    document.querySelectorAll("[data-jazz-panel]").forEach((panel) => {
      panel.classList.toggle("is-hidden", panel.dataset.jazzPanel !== view);
    });
    listNode.querySelectorAll(".jazz-chord.is-playing").forEach((node) => node.classList.remove("is-playing"));
    if (view === "quiz") {
      if (quiz.revealed && quiz.current) {
        highlightKeys(chordMidis(quiz.current));
      } else {
        highlightKeys([]);
      }
      setStatus(`出题范围：${poolOf().length} 个和弦`);
    } else {
      highlightKeys([]);
      setStatus("点任意和弦卡片即可听到");
    }
  };

  document.querySelectorAll("[data-jazz-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.jazzView));
  });

  buildKeyboard();
  renderList();
  renderGroups();
  renderTally();
  showView(state.view);
})();
