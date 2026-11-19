const SHARED_STORAGE_KEY = "jianpu-teaching-shared-settings-v1";
const MODE_STORAGE_KEY = "jianpu-teaching-mode-state-v1";
const RHYTHM_STORAGE_KEY = "jianpu-teaching-rhythm-state-v1";
const EAR_STORAGE_KEY = "jianpu-teaching-ear-state-v1";

const DEFAULT_SHARED_STATE = {
  numerator: 4,
  denominator: 4,
  tonic: "C",
};

const DEFAULT_MODE_STATE = {
  visibleOctaves: 2,
  randomDegreeIndex: 4,
  keyboardAudioEnabled: false,
};

const DEFAULT_RHYTHM_STATE = {
  sequence: [],
  patterns: [],
  measureCount: 2,
  activeMeasure: -1,
  patternPanelCollapsed: false,
  showNoteNames: true,
  visualizerColumns: 4,
  bpm: 120,
};

const DEFAULT_EAR_STATE = {
  selectedExercise: "single",
  answerVisible: false,
  currentPrompt: null,
  bpm: 120,
  measureCount: 2,
  minSubdivision: "eighth",
  naturalChordOnly: true,
  enableRandomRhythm: false,
  enableBlackKeys: false,
  rhythmOnly: false,
};

const DEGREE_LABELS = ["1", "2", "3", "4", "5", "6", "7"];
const SOLFEGE_LABELS = ["Do", "Re", "Mi", "Fa", "So", "La", "Si"];
const DEGREE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const EAR_REFERENCE_ABSOLUTE = 45;
const EAR_MIN_SUBDIVISIONS = ["quarter", "eighth", "sixteenth"];

const NOTE_BANK = [
  { id: "whole", name: "全音符", symbol: "𝅝", denominator: 1 },
  { id: "half", name: "二分音符", symbol: "𝅗𝅥", denominator: 2 },
  { id: "quarter", name: "四分音符", symbol: "𝅘𝅥", denominator: 4 },
  { id: "eighth", name: "八分音符", symbol: "𝅘𝅥𝅮", denominator: 8 },
  { id: "sixteenth", name: "十六分音符", symbol: "𝅘𝅥𝅯", denominator: 16 },
  { id: "dotted-half", name: "附点二分音符", symbol: "𝅗𝅥.", denominator: 2, dotted: true },
  { id: "dotted-quarter", name: "附点四分音符", symbol: "𝅘𝅥.", denominator: 4, dotted: true },
  { id: "dotted-eighth", name: "附点八分音符", symbol: "𝅘𝅥𝅮.", denominator: 8, dotted: true },
];

const RHYTHM_SEGMENT_COLORS = ["#A77693", "#BF91A8", "#7E5A6F", "#D2AFBE"];

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const WHITE_INDEX_BY_PITCH_CLASS = {
  0: 0,
  2: 1,
  4: 2,
  5: 3,
  7: 4,
  9: 5,
  11: 6,
};

const PRECEDING_WHITE_INDEX = {
  1: 0,
  3: 1,
  6: 3,
  8: 4,
  10: 5,
};

function loadStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : { ...fallback };
  } catch (error) {
    return { ...fallback };
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 浏览器禁用本地存储时，设置只在本次打开期间有效
  }
}

function buildDefaultSharedState() {
  return { ...DEFAULT_SHARED_STATE };
}

function buildDefaultModeState() {
  return { ...DEFAULT_MODE_STATE };
}

function buildDefaultRhythmState() {
  return {
    ...DEFAULT_RHYTHM_STATE,
    sequence: [],
    patterns: [],
  };
}

function buildDefaultEarState() {
  return {
    ...DEFAULT_EAR_STATE,
    currentPrompt: null,
  };
}

function resetAllPersistentSettings() {
  saveStorage(SHARED_STORAGE_KEY, buildDefaultSharedState());
  saveStorage(MODE_STORAGE_KEY, buildDefaultModeState());
  saveStorage(RHYTHM_STORAGE_KEY, buildDefaultRhythmState());
  saveStorage(EAR_STORAGE_KEY, buildDefaultEarState());
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function easeInOutCubic(progress) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }

  return 1 - ((-2 * progress + 2) ** 3) / 2;
}

function sanitizeWholeNumber(value, fallback) {
  const numeric = Number.parseInt(String(value), 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return Math.min(numeric, 16);
}

function sanitizeOctaveCount(value, fallback) {
  const numeric = Number.parseInt(String(value), 10);

  if (!Number.isFinite(numeric) || numeric < 2) {
    return fallback;
  }

  return Math.min(numeric, 7);
}

function sanitizeBpm(value, fallback) {
  const numeric = Number.parseInt(String(value), 10);

  if (!Number.isFinite(numeric) || numeric < 30) {
    return fallback;
  }

  return Math.min(numeric, 240);
}

/* ---------- 真钢琴采样（Salamander Grand Piano, CC BY 3.0） ---------- */
const PIANO_SAMPLE_NOTE_INDEX = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

function pianoSampleNameToMidi(name) {
  const match = /^([A-G]#?)(\d)$/.exec(name);
  if (!match) {
    return null;
  }
  return (Number(match[2]) + 1) * 12 + PIANO_SAMPLE_NOTE_INDEX[match[1]];
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

const pianoSamplerCache = new WeakMap();

// 解码全部采样；没有采样文件或解码失败时返回 null，调用方改用合成音色
function loadPianoSampler(audioContext) {
  if (pianoSamplerCache.has(audioContext)) {
    return pianoSamplerCache.get(audioContext);
  }

  const source = window.PIANO_SAMPLES;
  const promise = !source
    ? Promise.resolve(null)
    : Promise.all(
        Object.entries(source).map(([name, base64]) => {
          const midi = pianoSampleNameToMidi(name);
          return new Promise((resolve) => {
            try {
              audioContext.decodeAudioData(
                base64ToArrayBuffer(base64),
                (buffer) => resolve(midi === null ? null : { midi, buffer }),
                () => resolve(null),
              );
            } catch (error) {
              resolve(null);
            }
          });
        }),
      ).then((entries) => {
        const samples = entries.filter(Boolean).sort((a, b) => a.midi - b.midi);
        return samples.length ? samples : null;
      });

  pianoSamplerCache.set(audioContext, promise);
  return promise;
}

function playPianoSample(audioContext, samples, midi, destination, startTime, options = {}) {
  let nearest = samples[0];
  samples.forEach((sample) => {
    if (Math.abs(sample.midi - midi) < Math.abs(nearest.midi - midi)) {
      nearest = sample;
    }
  });

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const level = options.gain ?? 1;
  const duration = Math.min(options.duration ?? nearest.buffer.duration, nearest.buffer.duration);

  source.buffer = nearest.buffer;
  source.playbackRate.setValueAtTime(2 ** ((midi - nearest.midi) / 12), startTime);
  gain.gain.setValueAtTime(level, startTime);
  if (duration < nearest.buffer.duration) {
    gain.gain.setValueAtTime(level, startTime + Math.max(0, duration - 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  }

  source.connect(gain);
  gain.connect(destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.02);
  return source;
}

function sanitizeMeasureCount(value, fallback) {
  const numeric = Number.parseInt(String(value), 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return Math.min(numeric, 8);
}

function sanitizeVisualizerColumns(value, fallback = DEFAULT_RHYTHM_STATE.visualizerColumns) {
  const numeric = Number.parseInt(String(value), 10);
  return numeric === 2 || numeric === 4 ? numeric : fallback;
}

function sanitizeMinSubdivision(value, fallback = DEFAULT_EAR_STATE.minSubdivision) {
  return EAR_MIN_SUBDIVISIONS.includes(value) ? value : fallback;
}

function getNoteDefinition(noteId) {
  return NOTE_BANK.find((item) => item.id === noteId) || null;
}

function formatMeter(sharedState) {
  return `${sharedState.numerator}/${sharedState.denominator}`;
}

function displayAccidentalText(value) {
  return String(value || "")
    .replaceAll("#", "♯")
    .replaceAll("b", "♭");
}

function parseTonicInput(rawValue) {
  const cleaned = String(rawValue || "")
    .trim()
    .replace(/\s+/g, "")
    .replaceAll("♯", "#")
    .replaceAll("♭", "b");

  if (!cleaned) {
    return "";
  }

  const sharpPrefixMatch = cleaned.match(/^#([A-Ga-g])$/);
  if (sharpPrefixMatch) {
    return `${sharpPrefixMatch[1].toUpperCase()}#`;
  }

  const suffixMatch = cleaned.match(/^([A-Ga-g])([#b]?)$/);
  if (suffixMatch) {
    return `${suffixMatch[1].toUpperCase()}${suffixMatch[2] || ""}`;
  }

  return "";
}

function formatTonicDisplay(tonic) {
  const normalized = normalizeTonicInput(tonic, "");
  const match = normalized.match(/^([A-G])([#b]?)$/);

  if (!match) {
    return displayAccidentalText(normalized);
  }

  const [, letter, accidental] = match;
  if (accidental === "#") {
    return `♯${letter}`;
  }

  if (accidental === "b") {
    return `${letter}♭`;
  }

  return letter;
}

function formatTonic(sharedState) {
  return `1=${formatTonicDisplay(sharedState.tonic)}`;
}

function normalizeTonicInput(rawValue, fallback = DEFAULT_SHARED_STATE.tonic) {
  const parsed = parseTonicInput(rawValue);
  return parsed || fallback;
}

function tonicToPitchClass(tonic) {
  const normalized = normalizeTonicInput(tonic);
  const map = {
    C: 0,
    "B#": 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    Fb: 4,
    "E#": 5,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
    Cb: 11,
  };

  return Number.isInteger(map[normalized]) ? map[normalized] : null;
}

function tonicToAnchorAbsolute(tonic, centralOctave = 4) {
  const normalized = normalizeTonicInput(tonic, "");
  const match = normalized.match(/^([A-G])([#b]?)/);

  if (!match) {
    return null;
  }

  const [, letter, accidental] = match;
  const naturalOffsets = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const naturalOffset = naturalOffsets[letter];

  if (!Number.isInteger(naturalOffset)) {
    return null;
  }

  let absolute = centralOctave * 12 + naturalOffset;
  if (accidental === "#") absolute += 1;
  if (accidental === "b") absolute -= 1;
  return absolute;
}

function prefersFlats(tonic) {
  const normalized = normalizeTonicInput(tonic);
  return normalized.includes("b") || ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"].includes(normalized);
}

function semitoneToPitchName(semitone, useFlats) {
  const collection = useFlats ? FLAT_NAMES : SHARP_NAMES;
  return collection[((semitone % 12) + 12) % 12];
}

function semitoneToKeyboardLabel(semitone, useFlats) {
  const pitchClass = ((semitone % 12) + 12) % 12;
  const isWhite = Number.isInteger(WHITE_INDEX_BY_PITCH_CLASS[pitchClass]);

  if (isWhite) {
    return semitoneToPitchName(pitchClass, useFlats);
  }

  return `${SHARP_NAMES[pitchClass]}/${FLAT_NAMES[pitchClass]}`;
}

function formatAccidentalLabel(label) {
  if (label.includes("#")) {
    return `♯${label.replace("#", "")}`;
  }

  if (label.includes("b")) {
    return `♭${label.replace("b", "")}`;
  }

  return label;
}

function buildPianoKeyLabelMarkup(key, keyboardTop, whiteHeight, blackHeight) {
  if (key.isWhite) {
    return `<text class="piano-scene__key-label piano-scene__key-label--white" x="${key.center}" y="${keyboardTop + whiteHeight - 12}">${key.label}</text>`;
  }

  const [sharpLabel, flatLabel] = String(key.label).split("/");

  return `
    <text class="piano-scene__key-label piano-scene__key-label--black" x="${key.center}" y="${keyboardTop + blackHeight - 28}">
      <tspan x="${key.center}" dy="0">${formatAccidentalLabel(sharpLabel || key.label)}</tspan>
      <tspan class="piano-scene__key-label-subline" x="${key.center}" dy="10">${formatAccidentalLabel(flatLabel || "")}</tspan>
    </text>
  `;
}

function absoluteToFrequency(absolute) {
  const midi = absolute + 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

function absoluteToPitchLabel(absolute, useFlats) {
  return `${semitoneToKeyboardLabel(absolute, useFlats)}${Math.floor(absolute / 12)}`;
}

function createClickBuffer(audioContext, frequency, durationSeconds) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const progress = index / audioContext.sampleRate;
    const envelope = Math.exp(-progress * 26);
    data[index] = Math.sin(2 * Math.PI * frequency * progress) * envelope;
  }

  return buffer;
}

function createNoiseBuffer(audioContext, durationSeconds) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const progress = index / length;
    data[index] = (Math.random() * 2 - 1) * (1 - progress);
  }

  return buffer;
}

function ensureClickBuffers(audioState) {
  if (!audioState.audioContext) {
    return;
  }

  if (!audioState.clickBuffers) {
    audioState.clickBuffers = {
      strong: createClickBuffer(audioState.audioContext, 1560, 0.08),
      weak: createClickBuffer(audioState.audioContext, 980, 0.06),
    };
  }
}

function scheduleClickSound(audioState, isStrongBeat, startTime) {
  ensureClickBuffers(audioState);

  const source = audioState.audioContext.createBufferSource();
  const gainNode = audioState.audioContext.createGain();

  source.buffer = isStrongBeat ? audioState.clickBuffers.strong : audioState.clickBuffers.weak;
  gainNode.gain.setValueAtTime(isStrongBeat ? 0.56 : 0.38, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.1);

  source.connect(gainNode);
  gainNode.connect(audioState.audioContext.destination);
  source.start(startTime);
  source.stop(startTime + 0.11);

  return source;
}

function decimalToFriendly(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function noteDurationInBeats(sharedState, note) {
  const base = sharedState.denominator / note.denominator;
  return note.dotted ? base * 1.5 : base;
}

function noteDurationLabel(sharedState, note) {
  return `${decimalToFriendly(noteDurationInBeats(sharedState, note))} 拍`;
}

function formatSubdivisionLabel(value) {
  const labels = {
    quarter: "四分音符",
    eighth: "八分音符",
    sixteenth: "十六分音符",
  };

  return labels[value] || labels[DEFAULT_EAR_STATE.minSubdivision];
}

function beatUnitId(sharedState) {
  const lookup = {
    1: "whole",
    2: "half",
    4: "quarter",
    8: "eighth",
    16: "sixteenth",
  };

  return lookup[sharedState.denominator] || "quarter";
}

function buildNoteIconMarkup(noteId) {
  const note = getNoteDefinition(noteId);
  if (!note) {
    return "";
  }

  const baseSymbol = note.dotted ? note.symbol.replace(".", "") : note.symbol;

  return `
    <span class="music-symbol music-symbol--${noteId}" aria-hidden="true">
      <span class="music-symbol__glyph">${baseSymbol}</span>
      ${note.dotted ? '<span class="music-symbol__dot">.</span>' : ""}
    </span>
  `;
}

function getRhythmCandidateIds(minSubdivision = DEFAULT_EAR_STATE.minSubdivision) {
  const threshold = sanitizeMinSubdivision(minSubdivision, DEFAULT_EAR_STATE.minSubdivision);
  const candidates = ["whole", "half", "quarter"];

  if (threshold === "quarter" || threshold === "eighth" || threshold === "sixteenth") {
    candidates.push("dotted-half");
  }

  if (threshold === "eighth" || threshold === "sixteenth") {
    candidates.push("dotted-quarter", "eighth");
  }

  if (threshold === "sixteenth") {
    candidates.push("dotted-eighth", "sixteenth");
  }

  return candidates;
}

function absoluteToJianpuToken(sharedState, absolute) {
  const tonicPitchClass = tonicToPitchClass(sharedState.tonic) ?? 0;
  const relativePitchClass = ((absolute - tonicPitchClass) % 12 + 12) % 12;
  const sharpTokens = ["1", "♯1", "2", "♯2", "3", "4", "♯4", "5", "♯5", "6", "♯6", "7"];
  const flatTokens = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

  return (prefersFlats(sharedState.tonic) ? flatTokens : sharpTokens)[relativePitchClass] || "1";
}

function splitTimelineIntoMeasures(sharedState, timeline) {
  const measures = [];
  let currentMeasure = [];
  let currentBeats = 0;

  timeline.forEach((item) => {
    currentMeasure.push(item);
    currentBeats += item.durationBeats || 0;

    if (currentBeats >= sharedState.numerator - 0.0001) {
      measures.push(currentMeasure);
      currentMeasure = [];
      currentBeats = 0;
    }
  });

  if (currentMeasure.length) {
    measures.push(currentMeasure);
  }

  return measures;
}

function getJianpuOctaveOffset(sharedState, absolute) {
  const tonicPitchClass = tonicToPitchClass(sharedState.tonic) ?? 0;
  const anchorAbsolute = tonicToAnchorAbsolute(sharedState.tonic) ?? (4 * 12 + tonicPitchClass);
  return Math.floor((absolute - anchorAbsolute) / 12);
}

function getNumberedRhythmParts(noteId) {
  const parts = {
    dashCount: 0,
    dotted: false,
    underlineCount: 0,
  };

  if (noteId === "whole") {
    parts.dashCount = 3;
  } else if (noteId === "half") {
    parts.dashCount = 1;
  } else if (noteId === "dotted-half") {
    parts.dashCount = 2;
  } else if (noteId === "dotted-quarter") {
    parts.dotted = true;
  } else if (noteId === "eighth") {
    parts.underlineCount = 1;
  } else if (noteId === "dotted-eighth") {
    parts.dotted = true;
    parts.underlineCount = 1;
  } else if (noteId === "sixteenth") {
    parts.underlineCount = 2;
  }

  return parts;
}

function buildParallelJianpuMarkup(sharedState, item, options = {}) {
  const maskPitch = Boolean(options.maskPitch);
  const token = maskPitch ? "x" : absoluteToJianpuToken(sharedState, item.absolute);
  const octaveOffset = maskPitch ? 0 : getJianpuOctaveOffset(sharedState, item.absolute);
  const topDots = octaveOffset > 0 ? "•".repeat(Math.min(octaveOffset, 3)) : "";
  const bottomDots = octaveOffset < 0 ? "•".repeat(Math.min(Math.abs(octaveOffset), 3)) : "";
  const rhythmParts = getNumberedRhythmParts(item.rhythmId);

  return `
    <article class="jianpu-answer__parallel-note">
      <span class="jianpu-answer__parallel-octave jianpu-answer__parallel-octave--top">${topDots}</span>
      <div class="jianpu-answer__parallel-core">
        <strong class="jianpu-answer__parallel-digit">${token}</strong>
        ${rhythmParts.dotted ? '<span class="jianpu-answer__parallel-dot"></span>' : ""}
        ${rhythmParts.dashCount ? `
          <span class="jianpu-answer__parallel-tail">
            ${Array.from({ length: rhythmParts.dashCount }, () => '<span class="jianpu-answer__parallel-dash"></span>').join("")}
          </span>
        ` : ""}
      </div>
      <span class="jianpu-answer__parallel-underlines">
        ${Array.from({ length: rhythmParts.underlineCount }, () => '<span class="jianpu-answer__parallel-underline"></span>').join("")}
      </span>
      <span class="jianpu-answer__parallel-octave jianpu-answer__parallel-octave--bottom">${bottomDots}</span>
    </article>
  `;
}

function buildJianpuAnswerMarkup(sharedState, timeline, options = {}) {
  const maskPitch = Boolean(options.maskPitch);
  const measures = splitTimelineIntoMeasures(sharedState, timeline);

  if (!measures.length) {
    return '<div class="jianpu-answer__empty">当前题目还没有生成简谱答案。</div>';
  }

  return measures
    .map(
      (measure, measureIndex) => `
        <section class="jianpu-answer__measure">
          <header class="jianpu-answer__measure-head">
            <strong>第 ${measureIndex + 1} 小节</strong>
            <span>${formatMeter(sharedState)}</span>
          </header>
          <div class="jianpu-answer__comparison">
            <div class="jianpu-answer__notes">
              ${measure
                .map((item) => {
                  const token = maskPitch ? "x" : absoluteToJianpuToken(sharedState, item.absolute);
                  const pitchText = maskPitch ? item.rhythmName : item.pitch;

                  return `
                    <article class="jianpu-answer__note">
                      <span class="jianpu-answer__symbol">${buildNoteIconMarkup(item.rhythmId)}</span>
                      <strong class="jianpu-answer__digit">${token}</strong>
                      <span class="jianpu-answer__pitch">${displayAccidentalText(pitchText || "")}</span>
                    </article>
                  `;
                })
                .join("")}
            </div>
            <div class="jianpu-answer__parallel-row">
              ${measure
                .map((item) => buildParallelJianpuMarkup(sharedState, item, { maskPitch }))
                .join("")}
            </div>
          </div>
        </section>
      `
    )
    .join("");
}

function getAccentPattern(sharedState) {
  const accents = [];

  for (let beat = 1; beat <= sharedState.numerator; beat += 1) {
    let label = "弱拍";

    if (beat === 1) {
      label = "强拍";
    } else if (sharedState.numerator === 4 && beat === 3) {
      label = "次强拍";
    } else if (sharedState.numerator === 6 && beat === 4) {
      label = "次强拍";
    } else if (sharedState.numerator >= 5 && sharedState.numerator % 2 === 0 && beat === sharedState.numerator / 2 + 1) {
      label = "次强拍";
    }

    accents.push({ beat, label });
  }

  return accents;
}

function getAccentHint(sharedState) {
  const meter = formatMeter(sharedState);

  if (sharedState.denominator === 8 && sharedState.numerator % 3 === 0 && sharedState.numerator > 3) {
    return `${meter} 可以先按复拍子的“大拍”去拍，再细分到每个八分音符。`;
  }

  return `${meter} 默认展示两个小节，并把每小节的 V 组明显分开。`;
}

function getPresetPatterns(sharedState) {
  const beatUnit = beatUnitId(sharedState);
  const candidatePresets = [
    {
      name: "平均分拍",
      description: "每一拍都先用最基础的拍单位。",
      pattern: Array.from({ length: sharedState.numerator }, () => beatUnit),
    },
  ];

  if (sharedState.numerator >= 2) {
    candidatePresets.push({
      name: "先长后短",
      description: "先用长时值建立重拍，再用基础拍单位补齐。",
      pattern: ["half"],
    });
  }

  candidatePresets.push({
    name: "流动型",
    description: "用更细分的音符体会拍内均分。",
    pattern: Array.from({ length: sharedState.numerator * 2 }, () => "eighth"),
  });

  if (sharedState.numerator >= 4) {
    candidatePresets.push({
      name: "附点感觉",
      description: "适合讲解长短对比和重音延展。",
      pattern: ["dotted-quarter", beatUnit, beatUnit],
    });
  }

  return candidatePresets
    .map((preset) => {
      let currentBeats = 0;
      const fittedPattern = preset.pattern.filter((noteId) => {
        const note = NOTE_BANK.find((item) => item.id === noteId);
        if (!note) return false;

        const duration = noteDurationInBeats(sharedState, note);
        if (currentBeats + duration > sharedState.numerator + 0.0001) {
          return false;
        }

        currentBeats += duration;
        return true;
      });

      return { ...preset, pattern: fittedPattern };
    })
    .filter((preset) => preset.pattern.length > 0);
}

function getOctaveWindow(octaveCount) {
  const leftCount = Math.floor((octaveCount - 1) / 2);
  const rightCount = Math.ceil((octaveCount - 1) / 2);

  return {
    startOctave: 4 - leftCount,
    endOctave: 4 + rightCount,
  };
}

function getKeyboardDimensions(viewWidth) {
  if (viewWidth < 540) {
    return { whiteWidth: 38, blackWidth: 24 };
  }

  if (viewWidth < 860) {
    return { whiteWidth: 48, blackWidth: 30 };
  }

  return { whiteWidth: 58, blackWidth: 36 };
}

function createKeyboardModel(octaveCount, useFlats, viewWidth) {
  const { startOctave, endOctave } = getOctaveWindow(octaveCount);
  const { whiteWidth, blackWidth } = getKeyboardDimensions(viewWidth);
  const keys = [];

  for (let octave = startOctave; octave <= endOctave; octave += 1) {
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      const absolute = octave * 12 + pitchClass;
      const isWhite = Number.isInteger(WHITE_INDEX_BY_PITCH_CLASS[pitchClass]);
      const whiteIndex = (octave - startOctave) * 7 + (WHITE_INDEX_BY_PITCH_CLASS[pitchClass] ?? PRECEDING_WHITE_INDEX[pitchClass]);
      const width = isWhite ? whiteWidth : blackWidth;
      const left = isWhite
        ? whiteIndex * whiteWidth
        : (whiteIndex + 1) * whiteWidth - blackWidth / 2;

      keys.push({
        absolute,
        pitchClass,
        octave,
        isWhite,
        width,
        left,
        center: left + width / 2,
        label: semitoneToKeyboardLabel(pitchClass, useFlats),
        isCentralOctave: octave === 4,
      });
    }
  }

  return {
    keys,
    width: (endOctave - startOctave + 1) * 7 * whiteWidth,
    whiteWidth,
    blackWidth,
    startOctave,
    endOctave,
  };
}

function createPiano88Model(useFlats) {
  const whiteWidth = 48;
  const blackWidth = 30;
  const keys = [];
  let whiteIndex = 0;
  let lastWhiteLeft = 0;

  for (let absolute = 9; absolute <= 96; absolute += 1) {
    const pitchClass = ((absolute % 12) + 12) % 12;
    const octave = Math.floor(absolute / 12);
    const isWhite = Number.isInteger(WHITE_INDEX_BY_PITCH_CLASS[pitchClass]);

    if (isWhite) {
      const left = whiteIndex * whiteWidth;
      keys.push({
        absolute,
        pitchClass,
        octave,
        isWhite: true,
        width: whiteWidth,
        left,
        center: left + whiteWidth / 2,
        label: semitoneToKeyboardLabel(pitchClass, useFlats),
        isCentralOctave: octave === 4,
      });
      lastWhiteLeft = left;
      whiteIndex += 1;
    } else {
      const left = lastWhiteLeft + whiteWidth - blackWidth / 2;
      keys.push({
        absolute,
        pitchClass,
        octave,
        isWhite: false,
        width: blackWidth,
        left,
        center: left + blackWidth / 2,
        label: semitoneToKeyboardLabel(pitchClass, useFlats),
        isCentralOctave: octave === 4,
      });
    }
  }

  return {
    keys,
    width: whiteIndex * whiteWidth,
    whiteWidth,
    blackWidth,
    startOctave: 0,
    endOctave: 8,
  };
}

function getScaleNotes(sharedState) {
  const tonicPitchClass = tonicToPitchClass(sharedState.tonic);
  const effectivePitchClass = tonicPitchClass ?? 0;
  const useFlats = prefersFlats(sharedState.tonic);
  const anchorAbsolute = tonicToAnchorAbsolute(sharedState.tonic) ?? (4 * 12 + effectivePitchClass);

  return DEGREE_LABELS.map((degree, index) => {
    const absolute = anchorAbsolute + DEGREE_OFFSETS[index];
    return {
      degree,
      solfege: SOLFEGE_LABELS[index],
      pitch: semitoneToPitchName(absolute, useFlats),
      absolute,
      isFallback: tonicPitchClass === null,
    };
  });
}

function formatScaleAnswer(note) {
  if (!note.degree || !note.solfege) {
    return note.pitch;
  }

  return `${note.pitch} (${note.degree} / ${note.solfege})`;
}

function formatOctaveRange(model) {
  return `C${model.startOctave} - B${model.endOctave}`;
}

function buildPianoSceneMarkup(viewWidth, stageHeight, keyboardModel, sceneNotes, camera) {
  const keyboardTop = 188;
  const whiteHeight = 150;
  const blackHeight = 92;
  const labelScale = camera.zoom;
  const badgeSize = 48 * labelScale;
  const badgeRadius = 24 * labelScale;
  const badgeY = camera.panY + 20 * labelScale;
  const badgeTextY = camera.panY + 45 * labelScale;
  const upperStemStartY = camera.panY + 76 * labelScale;
  const upperStemEndY = camera.panY + 104 * labelScale;
  const solfegeY = camera.panY + 124 * labelScale;
  const lowerStemStartY = camera.panY + 136 * labelScale;
  const degreeTextSize = 18 * labelScale;
  const solfegeTextSize = 14 * labelScale;
  const stemWidth = 2.6 * labelScale;
  const softStemWidth = 2.2 * labelScale;
  const leftmostAnchorX = Math.min(...sceneNotes.map((note) => note.anchorX));
  const labelX = Math.max(16, leftmostAnchorX - 90 * labelScale);
  const centralCKey = keyboardModel.keys.find((key) => key.absolute === 48 && key.isWhite)
    || keyboardModel.keys.find((key) => key.pitchClass === 0 && key.octave === 4 && key.isWhite)
    || keyboardModel.keys.find((key) => key.pitchClass === 0 && key.isWhite)
    || null;
  const centralCLabelX = centralCKey ? camera.panX + centralCKey.center * labelScale : viewWidth / 2;
  const centralCLabelY = camera.panY + (keyboardTop + whiteHeight - 12) * labelScale;
  const highlightMap = new Map(
    sceneNotes.map((note, index) => [
      note.absolute,
      {
        degree: note.degree,
        isTonic: index === 0,
      },
    ])
  );

  const whiteKeys = keyboardModel.keys
    .filter((key) => key.isWhite)
    .map((key) => {
      const highlight = highlightMap.get(key.absolute);
      const classes = [
        "piano-scene__white-key",
        key.isCentralOctave ? "is-central-octave" : "",
        highlight ? "is-scale-note" : "",
        highlight?.isTonic ? "is-tonic-key" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <g class="piano-scene__key-group piano-scene__key-group--white" data-key-absolute="${key.absolute}" data-key-label="${key.label}">
          <rect class="${classes}" x="${key.left}" y="${keyboardTop}" width="${key.width}" height="${whiteHeight}" rx="0" ry="0"></rect>
          <text class="piano-scene__key-label piano-scene__key-label--white" x="${key.center}" y="${keyboardTop + whiteHeight - 12}">${key.label}</text>
        </g>
      `;
    })
    .join("");

  const blackKeys = keyboardModel.keys
    .filter((key) => !key.isWhite)
    .map((key) => {
      const highlight = highlightMap.get(key.absolute);
      const classes = [
        "piano-scene__black-key",
        highlight ? "is-scale-note" : "",
        highlight?.isTonic ? "is-tonic-key" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <g class="piano-scene__key-group piano-scene__key-group--black" data-key-absolute="${key.absolute}" data-key-label="${key.label}">
          <rect class="${classes}" x="${key.left}" y="${keyboardTop}" width="${key.width}" height="${blackHeight}" rx="0" ry="0"></rect>
          ${buildPianoKeyLabelMarkup(key, keyboardTop, whiteHeight, blackHeight)}
        </g>
      `;
    })
    .join("");

  const rowLabels = [
    {
      y: badgeTextY - 2 * labelScale,
      chinese: "音级",
      english: "Scale Degree",
    },
    {
      y: solfegeY - 2 * labelScale,
      chinese: "唱名",
      english: "Solfege",
    },
  ]
    .map(
      (label) => `
        <g class="piano-scene__row-label">
          <text class="piano-scene__row-label-cn" x="${labelX}" y="${label.y - 6 * labelScale}">${label.chinese}</text>
          <text class="piano-scene__row-label-en" x="${labelX}" y="${label.y + 8 * labelScale}">${label.english}</text>
        </g>
      `
    )
    .join("");

  const noteNameLabel = `
    <g class="piano-scene__note-name-callout">
      <text class="piano-scene__note-name-callout-cn" x="${centralCLabelX}" y="${centralCLabelY - 36 * labelScale}">音名</text>
      <text class="piano-scene__note-name-callout-en" x="${centralCLabelX}" y="${centralCLabelY - 22 * labelScale}">Note Name</text>
      <line class="piano-scene__note-name-callout-line" x1="${centralCLabelX}" y1="${centralCLabelY - 18 * labelScale}" x2="${centralCLabelX}" y2="${centralCLabelY - 6 * labelScale}"></line>
    </g>
  `;

  const degreeColumns = sceneNotes
    .filter((note) => note.key)
    .map(
      (note) => `
        <g class="piano-scene__degree-column">
          <rect
            class="piano-scene__degree-number"
            x="${note.anchorX - badgeRadius}"
            y="${badgeY}"
            width="${badgeSize}"
            height="${badgeSize}"
            rx="${badgeRadius}"
            ry="${badgeRadius}"
          ></rect>
          <text class="piano-scene__degree-number-text" x="${note.anchorX}" y="${badgeTextY}" style="font-size:${degreeTextSize}px;">${note.degree}</text>
          <line class="piano-scene__stem" x1="${note.anchorX}" y1="${upperStemStartY}" x2="${note.anchorX}" y2="${upperStemEndY}" style="stroke-width:${stemWidth}px;"></line>
          <text class="piano-scene__degree-solfege" x="${note.anchorX}" y="${solfegeY}" style="font-size:${solfegeTextSize}px;">${note.solfege}</text>
          <line class="piano-scene__stem is-soft" x1="${note.anchorX}" y1="${lowerStemStartY}" x2="${note.keyX}" y2="${note.keyY}" style="stroke-width:${softStemWidth}px;"></line>
        </g>
      `
    )
    .join("");

  return `
    <svg viewBox="0 0 ${viewWidth} ${stageHeight}" preserveAspectRatio="xMidYMid meet" aria-label="钢琴教学图" style="height:${stageHeight}px">
      <defs>
        <linearGradient id="white-key-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fdf8f6"></stop>
          <stop offset="100%" stop-color="#e7dcd5"></stop>
        </linearGradient>
        <linearGradient id="white-key-central-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fffdfc"></stop>
          <stop offset="100%" stop-color="#dac6c8"></stop>
        </linearGradient>
        <linearGradient id="white-key-scale-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fcf7f5"></stop>
          <stop offset="100%" stop-color="#ead9e2"></stop>
        </linearGradient>
        <linearGradient id="white-key-tonic-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fff7fb"></stop>
          <stop offset="100%" stop-color="#e4c2d0"></stop>
        </linearGradient>
        <linearGradient id="black-key-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#5a4351"></stop>
          <stop offset="100%" stop-color="#2a1f29"></stop>
        </linearGradient>
        <linearGradient id="black-key-scale-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#b38a9f"></stop>
          <stop offset="100%" stop-color="#614654"></stop>
        </linearGradient>
        <linearGradient id="black-key-tonic-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#d6adbd"></stop>
          <stop offset="100%" stop-color="#845e70"></stop>
        </linearGradient>
        <linearGradient id="degree-badge-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#a77693"></stop>
          <stop offset="100%" stop-color="#c79db0"></stop>
        </linearGradient>
      </defs>
      <g class="piano-scene__camera" transform="translate(${camera.panX} ${camera.panY}) scale(${camera.zoom})">
        ${whiteKeys}
        ${blackKeys}
      </g>
      ${rowLabels}
      ${noteNameLabel}
      ${degreeColumns}
    </svg>
  `;
}

function buildKeyboardMarkup(model, scaleNotes) {
  const highlightMap = new Map(
    scaleNotes.map((note, index) => [
      note.absolute,
      {
        degree: note.degree,
        isTonic: index === 0,
      },
    ])
  );

  const whiteKeys = model.keys
    .filter((key) => key.isWhite)
    .map((key) => {
      const highlight = highlightMap.get(key.absolute);
      const classes = [
        "piano-key",
        "piano-key--white",
        key.isCentralOctave ? "is-central-octave" : "",
        highlight ? "is-scale-note" : "",
        highlight?.isTonic ? "is-tonic-key" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${classes}" style="left:${key.left}px;width:${key.width}px;">
          ${highlight ? `<span class="piano-key__degree">${highlight.degree}</span>` : ""}
          <span class="piano-key__label">${key.label}</span>
        </div>
      `;
    })
    .join("");

  const blackKeys = model.keys
    .filter((key) => !key.isWhite)
    .map((key) => {
      const highlight = highlightMap.get(key.absolute);
      const classes = [
        "piano-key",
        "piano-key--black",
        highlight ? "is-scale-note" : "",
        highlight?.isTonic ? "is-tonic-key" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${classes}" style="left:${key.left}px;width:${key.width}px;">
          ${highlight ? `<span class="piano-key__degree">${highlight.degree}</span>` : ""}
          <span class="piano-key__label">${key.label}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="piano-key-layer">${whiteKeys}</div>
    <div class="piano-key-layer">${blackKeys}</div>
  `;
}

function sanitizePatternForBeats(sharedState, pattern, maxBeats) {
  const nextPattern = [];
  let accumulated = 0;

  pattern.forEach((noteId) => {
    const note = NOTE_BANK.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const duration = noteDurationInBeats(sharedState, note);
    if (duration <= sharedState.numerator + 0.0001 && accumulated + duration <= maxBeats + 0.0001) {
      nextPattern.push(noteId);
      accumulated += duration;
    }
  });

  return nextPattern;
}

function sanitizePatternForMeter(sharedState, pattern) {
  return sanitizePatternForBeats(sharedState, pattern, sharedState.numerator);
}

function getPatternBeats(sharedState, pattern) {
  return pattern.reduce((sum, noteId) => {
    const note = NOTE_BANK.find((item) => item.id === noteId);
    return note ? sum + noteDurationInBeats(sharedState, note) : sum;
  }, 0);
}

function flattenRhythmPatterns(patterns) {
  return (Array.isArray(patterns) ? patterns : []).flatMap((pattern) => (Array.isArray(pattern) ? pattern : []));
}

function partitionPatternIntoMeasures(sharedState, pattern, measureCount) {
  const nextPatterns = Array.from({ length: sanitizeMeasureCount(measureCount, 1) }, () => []);
  const limitedPattern = sanitizePatternForBeats(
    sharedState,
    Array.isArray(pattern) ? pattern : [],
    sanitizeMeasureCount(measureCount, 1) * sharedState.numerator
  );
  let measureIndex = 0;
  let accumulated = 0;

  limitedPattern.forEach((noteId) => {
    const note = getNoteDefinition(noteId);
    if (!note || measureIndex >= nextPatterns.length) {
      return;
    }

    const beats = noteDurationInBeats(sharedState, note);
    if (accumulated + beats > sharedState.numerator + 0.0001) {
      measureIndex += 1;
      accumulated = 0;
    }

    if (measureIndex >= nextPatterns.length || beats > sharedState.numerator + 0.0001) {
      return;
    }

    nextPatterns[measureIndex].push(noteId);
    accumulated += beats;

    if (accumulated >= sharedState.numerator - 0.0001) {
      measureIndex += 1;
      accumulated = 0;
    }
  });

  return nextPatterns.map((measurePattern) => sanitizePatternForMeter(sharedState, measurePattern));
}

function sanitizeRhythmPatterns(sharedState, patterns, measureCount, legacyPattern = []) {
  const normalizedCount = sanitizeMeasureCount(measureCount, DEFAULT_RHYTHM_STATE.measureCount);
  const sourcePatterns = Array.isArray(patterns) ? patterns : [];

  if (sourcePatterns.length) {
    return Array.from({ length: normalizedCount }, (_, measureIndex) =>
      sanitizePatternForMeter(sharedState, Array.isArray(sourcePatterns[measureIndex]) ? sourcePatterns[measureIndex] : [])
    );
  }

  if (Array.isArray(legacyPattern) && legacyPattern.length) {
    return partitionPatternIntoMeasures(sharedState, legacyPattern, normalizedCount);
  }

  return Array.from({ length: normalizedCount }, () => []);
}

function sanitizeRhythmSequence(sharedState, sequence, measureCount, patterns = [], legacyPattern = []) {
  const normalizedCount = sanitizeMeasureCount(measureCount, DEFAULT_RHYTHM_STATE.measureCount);
  const sequenceSource = Array.isArray(sequence) ? sequence : [];
  const patternSource = Array.isArray(patterns) ? flattenRhythmPatterns(patterns) : [];
  const fallbackSource = sequenceSource.length
    ? sequenceSource
    : patternSource.length
      ? patternSource
      : Array.isArray(legacyPattern)
        ? legacyPattern
        : [];

  return sanitizePatternForBeats(sharedState, fallbackSource, normalizedCount * sharedState.numerator);
}

function buildRhythmTimeline(sharedState, sequence, measureCount) {
  const normalizedCount = sanitizeMeasureCount(measureCount, DEFAULT_RHYTHM_STATE.measureCount);
  const normalizedSequence = sanitizeRhythmSequence(sharedState, sequence, normalizedCount);
  const notes = [];
  let cursor = 0;

  normalizedSequence.forEach((noteId, sequenceIndex) => {
    const note = getNoteDefinition(noteId);
    if (!note) {
      return;
    }

    const beats = noteDurationInBeats(sharedState, note);
    notes.push({
      ...note,
      noteId,
      sequenceIndex,
      beats,
      startBeat: cursor,
      endBeat: cursor + beats,
      startMeasureIndex: Math.floor(cursor / sharedState.numerator),
      color: RHYTHM_SEGMENT_COLORS[sequenceIndex % RHYTHM_SEGMENT_COLORS.length],
    });
    cursor += beats;
  });

  return {
    sequence: normalizedSequence,
    notes,
    measureCount: normalizedCount,
    totalBeats: normalizedCount * sharedState.numerator,
    usedBeats: cursor,
  };
}

function getMeasureBounds(sharedState, measureIndex) {
  const startBeat = measureIndex * sharedState.numerator;
  return {
    startBeat,
    endBeat: startBeat + sharedState.numerator,
  };
}

function getMeasureBeatUsage(sharedState, timeline, measureIndex) {
  const { startBeat, endBeat } = getMeasureBounds(sharedState, measureIndex);

  return timeline.notes.reduce((sum, note) => {
    const overlap = Math.max(0, Math.min(note.endBeat, endBeat) - Math.max(note.startBeat, startBeat));
    return sum + overlap;
  }, 0);
}

function getMeasureInsertionContext(sharedState, timeline, measureIndex) {
  const { startBeat, endBeat } = getMeasureBounds(sharedState, measureIndex);
  let insertionIndex = timeline.sequence.length;
  let cursorBeat = startBeat;

  timeline.notes.forEach((note) => {
    if (note.startBeat < endBeat - 0.0001) {
      cursorBeat = Math.max(cursorBeat, note.endBeat);
      return;
    }

    if (insertionIndex === timeline.sequence.length) {
      insertionIndex = note.sequenceIndex;
    }
  });

  return {
    startBeat,
    endBeat,
    cursorBeat,
    insertionIndex,
  };
}

function getScopeTimelineItems(sharedState, timeline, activeMeasure) {
  if (activeMeasure < 0) {
    return timeline.notes;
  }

  const { startBeat, endBeat } = getMeasureBounds(sharedState, activeMeasure);
  return timeline.notes.filter(
    (note) => note.startBeat >= startBeat - 0.0001 && note.startBeat < endBeat - 0.0001
  );
}

function getGlyphPointAtPercent(percent) {
  const normalized = clamp(percent, 0, 100);

  if (normalized <= 50) {
    const progress = normalized / 50;
    return {
      x: 15 + 35 * progress,
      y: 10 + 50 * progress,
    };
  }

  const progress = (normalized - 50) / 50;
  return {
    x: 50 + 35 * progress,
    y: 60 - 50 * progress,
  };
}

function buildMeasureVisualData(sharedState, timeline, measureIndex) {
  const { startBeat, endBeat } = getMeasureBounds(sharedState, measureIndex);
  const beats = Array.from({ length: sharedState.numerator }, (_, beatIndex) => ({
    beatIndex,
    segments: [],
    markers: [],
  }));

  timeline.notes.forEach((note) => {
    const overlapStart = Math.max(note.startBeat, startBeat);
    const overlapEnd = Math.min(note.endBeat, endBeat);

    if (overlapEnd <= overlapStart + 0.0001) {
      return;
    }

    for (let beatIndex = 0; beatIndex < sharedState.numerator; beatIndex += 1) {
      const beatStart = startBeat + beatIndex;
      const beatEnd = beatStart + 1;
      const segmentStart = Math.max(overlapStart, beatStart);
      const segmentEnd = Math.min(overlapEnd, beatEnd);

      if (segmentEnd <= segmentStart + 0.0001) {
        continue;
      }

      beats[beatIndex].segments.push({
        color: note.color,
        startPercent: (segmentStart - beatStart) * 100,
        lengthPercent: (segmentEnd - segmentStart) * 100,
      });
    }

    if (note.startBeat >= startBeat - 0.0001 && note.startBeat < endBeat - 0.0001) {
      const localStart = note.startBeat - startBeat;
      const beatIndex = Math.min(sharedState.numerator - 1, Math.floor(localStart + 0.0001));
      const startPercent = (localStart - beatIndex) * 100;
      const point = getGlyphPointAtPercent(startPercent);

      beats[beatIndex].markers.push({
        color: note.color,
        startPercent,
        cx: point.x,
        cy: point.y,
      });
    }
  });

  beats.forEach((beat) => {
    beat.markers.sort((left, right) => left.startPercent - right.startPercent);
  });

  return beats;
}

function buildMeasureNotes(sharedState, pattern) {
  const items = [];
  let cursor = 0;

  pattern.forEach((noteId) => {
    const note = NOTE_BANK.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const beats = noteDurationInBeats(sharedState, note);
    if (cursor + beats > sharedState.numerator + 0.0001) {
      return;
    }

    const units = Math.round(beats * 4);
    items.push({
      id: note.id,
      name: note.name,
      caption: note.name,
      beats,
      units,
      startUnits: Math.round(cursor * 4),
      isPlaceholder: false,
    });
    cursor += beats;
  });

  const remainingBeats = Math.max(sharedState.numerator - cursor, 0);
  if (remainingBeats > 0.0001) {
    items.push({
      id: "placeholder",
      name: "留白",
      caption: `留白 ${decimalToFriendly(remainingBeats)} 拍`,
      beats: remainingBeats,
      units: Math.round(remainingBeats * 4),
      startUnits: Math.round(cursor * 4),
      isPlaceholder: true,
    });
  }

  return items;
}

function getVisualizerBeatWidth(containerWidth, sharedState, columns = 1) {
  const safeColumns = Math.max(1, columns);
  const gapAllowance = (safeColumns - 1) * 18;
  const available = Math.max(containerWidth - gapAllowance - 12, 320);
  const measureWidth = available / safeColumns;
  return clamp((measureWidth - 34) / sharedState.numerator, 42, 260);
}

function buildBeatSegments(sharedState, pattern) {
  const beats = Array.from({ length: sharedState.numerator }, (_, beatIndex) => ({
    beatIndex,
    segments: [],
  }));
  let cursor = 0;
  let colorIndex = 0;

  pattern.forEach((noteId) => {
    const note = NOTE_BANK.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const durationBeats = noteDurationInBeats(sharedState, note);
    const startBeat = cursor;
    const endBeat = Math.min(sharedState.numerator, cursor + durationBeats);
    const color = RHYTHM_SEGMENT_COLORS[colorIndex % RHYTHM_SEGMENT_COLORS.length];

    for (let beatIndex = Math.floor(startBeat); beatIndex < Math.ceil(endBeat - 0.0001); beatIndex += 1) {
      const beat = beats[beatIndex];
      if (!beat) {
        continue;
      }

      const overlapStart = Math.max(startBeat, beatIndex);
      const overlapEnd = Math.min(endBeat, beatIndex + 1);
      if (overlapEnd <= overlapStart + 0.0001) {
        continue;
      }

      beat.segments.push({
        color,
        startPercent: (overlapStart - beatIndex) * 100,
        lengthPercent: (overlapEnd - overlapStart) * 100,
      });
    }

    cursor = endBeat;
    colorIndex += 1;
  });

  return beats;
}

function renderRhythmVisualizer(sharedState, timeline, container, summaryNode, activeMeasure = -1, columns = 4) {
  const safeColumns = sanitizeVisualizerColumns(columns);
  const columnCount = Math.min(timeline.measureCount, safeColumns);
  const beatWidth = getVisualizerBeatWidth(container.clientWidth || 1280, sharedState, columnCount);
  const measureUnits = sharedState.numerator * 4;

  if (summaryNode) {
    summaryNode.textContent = `当前展示 ${timeline.measureCount} 个小节，每行 ${safeColumns} 个；每小节固定 ${sharedState.numerator} 个 V。`;
  }

  container.innerHTML = `
    <div class="visualizer-measures" style="--measure-columns:${columnCount};">
      ${Array.from({ length: timeline.measureCount }, (_, measureIndex) => {
        const beats = buildMeasureVisualData(sharedState, timeline, measureIndex);
        const beatMarkup = beats
          .map((beat, beatIndex) => {
            const startUnit = measureIndex * measureUnits + beatIndex * 4;
            const segmentsMarkup = beat.segments
              .map(
                (segment, segmentIndex) => `
                  <path
                    class="rhythm-glyph__segment"
                    d="M15 10 L50 60 L85 10"
                    pathLength="100"
                    stroke="${segment.color}"
                    data-segment-start="${segment.startPercent}"
                    data-segment-length="${segment.lengthPercent}"
                    data-segment-index="${segmentIndex}"
                  ></path>
                `
              )
              .join("");
            const markersMarkup = beat.markers
              .map(
                (marker) => `
                  <circle
                    class="rhythm-glyph__start-dot"
                    cx="${marker.cx}"
                    cy="${marker.cy}"
                    r="5.2"
                    fill="${marker.color}"
                  ></circle>
                `
              )
              .join("");

            return `
              <div class="visual-beat ${beat.segments.length ? "" : "is-rest"}" style="width:${beatWidth}px;">
                <div class="rhythm-glyph" data-glyph-start="${startUnit}">
                  <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                    <path class="rhythm-glyph__guide" d="M15 10 L50 60 L85 10" pathLength="100"></path>
                    ${segmentsMarkup || '<path class="rhythm-glyph__segment rhythm-glyph__segment--rest" d="M15 10 L50 60 L85 10" pathLength="100" stroke="rgba(118, 103, 92, 0.18)" data-segment-start="0" data-segment-length="100"></path>'}
                    ${markersMarkup}
                  </svg>
                </div>
                <span class="visual-beat__label">第 ${beatIndex + 1} 拍</span>
              </div>
            `;
          })
          .join("");

        return `
          <button
            class="visualizer-measure ${activeMeasure === measureIndex ? "is-active" : ""}"
            type="button"
            data-visualizer-measure-index="${measureIndex}"
            style="--beat-width:${beatWidth}px;"
          >
            <div class="visualizer-measure__header">
              <span class="visualizer-measure__title">第 ${measureIndex + 1} 小节</span>
              <span class="visualizer-measure__meter">${formatMeter(sharedState)}</span>
            </div>
            <div class="visualizer-track">${beatMarkup}</div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function updateGlyphProgress(glyphNodes, progressUnits) {
  glyphNodes.forEach((glyphNode) => {
    const startUnit = Number(glyphNode.dataset.glyphStart);
    const completedUnits = clamp(progressUnits - startUnit, 0, 4);
    const completedPercent = (completedUnits / 4) * 100;

    glyphNode.querySelectorAll("[data-segment-start]").forEach((segmentNode) => {
      const segmentStart = Number(segmentNode.dataset.segmentStart);
      const segmentLength = Number(segmentNode.dataset.segmentLength);
      const visibleLength = clamp(completedPercent - segmentStart, 0, segmentLength);

      segmentNode.style.strokeDasharray = `${visibleLength} 100`;
      segmentNode.style.strokeDashoffset = `${-segmentStart}`;
    });
  });
}

function getEarTrainingPool(sharedState) {
  const tonicPitchClass = tonicToPitchClass(sharedState.tonic) ?? 0;
  const useFlats = prefersFlats(sharedState.tonic);
  const anchorAbsolute = tonicToAnchorAbsolute(sharedState.tonic) ?? (4 * 12 + tonicPitchClass);

  const scalePool = DEGREE_LABELS.map((degree, index) => ({
    degree,
    solfege: SOLFEGE_LABELS[index],
    absolute: anchorAbsolute + DEGREE_OFFSETS[index],
    pitch: semitoneToPitchName(anchorAbsolute + DEGREE_OFFSETS[index], useFlats),
  }));

  const chromaticPool = Array.from({ length: 12 }, (_, offset) => {
    const degreeIndex = DEGREE_OFFSETS.indexOf(offset);

    return {
      degree: degreeIndex >= 0 ? DEGREE_LABELS[degreeIndex] : null,
      solfege: degreeIndex >= 0 ? SOLFEGE_LABELS[degreeIndex] : null,
      absolute: anchorAbsolute + offset,
      pitch: semitoneToKeyboardLabel(anchorAbsolute + offset, useFlats),
    };
  });

  return {
    scalePool,
    chromaticPool,
    extendedPool: [
      ...scalePool,
      ...DEGREE_LABELS.slice(0, 3).map((degree, index) => ({
        degree: `${degree}'`,
        solfege: SOLFEGE_LABELS[index],
        absolute: anchorAbsolute + 12 + DEGREE_OFFSETS[index],
        pitch: semitoneToPitchName(anchorAbsolute + 12 + DEGREE_OFFSETS[index], useFlats),
      })),
    ],
  };
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildFixedBeatPattern(sharedState, measureCount = 1) {
  return Array.from(
    { length: sanitizeMeasureCount(measureCount, 1) * sharedState.numerator },
    () => beatUnitId(sharedState)
  );
}

function buildSingleMeasureRandomRhythmPattern(sharedState, minSubdivision = DEFAULT_EAR_STATE.minSubdivision) {
  const candidateIds = getRhythmCandidateIds(minSubdivision);
  const pattern = [];
  let remaining = sharedState.numerator;
  let guard = 0;

  while (remaining > 0.0001 && guard < 64) {
    const candidates = candidateIds
      .map((noteId) => getNoteDefinition(noteId))
      .filter(Boolean)
      .map((note) => ({ ...note, beats: noteDurationInBeats(sharedState, note) }))
      .filter((note) => note.beats <= remaining + 0.0001);

    const weighted = [];
    candidates.forEach((note) => {
      let weight = 1;

      if (note.id === beatUnitId(sharedState)) weight = 4;
      if (note.id === "quarter") weight += 2;
      if (note.id === "eighth") weight += 3;
      if (note.id === "sixteenth") weight += 2;
      if (note.id === "dotted-quarter") weight += 2;
      if (note.id === "dotted-eighth") weight += 2;

      for (let index = 0; index < weight; index += 1) {
        weighted.push(note);
      }
    });

    const picked = pickRandomItem(weighted.length ? weighted : candidates);

    if (!picked) {
      break;
    }

    pattern.push(picked.id);
    remaining = Math.max(0, remaining - picked.beats);
    guard += 1;
  }

  return pattern.length ? pattern : buildFixedBeatPattern(sharedState);
}

function buildRandomRhythmPattern(sharedState, measureCount = 1, minSubdivision = DEFAULT_EAR_STATE.minSubdivision) {
  return Array.from(
    { length: sanitizeMeasureCount(measureCount, 1) },
    () => buildSingleMeasureRandomRhythmPattern(sharedState, minSubdivision)
  )
    .flat();
}

function splitPatternIntoMeasures(sharedState, pattern) {
  const measures = [];
  let currentMeasure = [];
  let currentBeats = 0;

  pattern.forEach((noteId) => {
    const note = getNoteDefinition(noteId);
    if (!note) {
      return;
    }

    const beats = noteDurationInBeats(sharedState, note);
    currentMeasure.push(noteId);
    currentBeats += beats;

    if (currentBeats >= sharedState.numerator - 0.0001) {
      measures.push(currentMeasure);
      currentMeasure = [];
      currentBeats = 0;
    }
  });

  if (currentMeasure.length) {
    measures.push(currentMeasure);
  }

  return measures;
}

function describeRhythmPattern(sharedState, pattern) {
  const measures = splitPatternIntoMeasures(sharedState, pattern);

  return measures
    .map((measure, index) => {
      const detail = measure
        .map((noteId) => {
          const note = getNoteDefinition(noteId);
          return note ? `${note.name}（${noteDurationLabel(sharedState, note)}）` : noteId;
        })
        .join("、");

      return measures.length > 1 ? `第 ${index + 1} 小节：${detail}` : detail;
    })
    .join(" ｜ ");
}

function getMelodyPitchPool(includeBlackKeys, useFlats) {
  const pool = [];

  for (let absolute = 36; absolute <= 71; absolute += 1) {
    const pitchClass = ((absolute % 12) + 12) % 12;
    const isWhite = Number.isInteger(WHITE_INDEX_BY_PITCH_CLASS[pitchClass]);

    if (includeBlackKeys || isWhite) {
      pool.push({
        absolute,
        pitch: absoluteToPitchLabel(absolute, useFlats),
        isWhite,
      });
    }
  }

  return pool;
}

function buildRandomMelodyLine(sharedState, pattern, includeBlackKeys) {
  const useFlats = prefersFlats(sharedState.tonic);
  const pool = getMelodyPitchPool(includeBlackKeys, useFlats);
  let cursor = Math.floor(pool.length / 2);

  return pattern.map((noteId) => {
    const rhythmNote = getNoteDefinition(noteId);
    const step = Math.floor(Math.random() * 5) - 2;
    cursor = clamp(cursor + step, 0, pool.length - 1);

    return {
      ...pool[cursor],
      rhythmId: noteId,
      rhythmName: rhythmNote?.name || noteId,
      durationBeats: rhythmNote ? noteDurationInBeats(sharedState, rhythmNote) : 1,
    };
  });
}

function buildTimelineEventsFromLine(line, bpm) {
  return line.map((item) => ({
    notes: [item.absolute],
    duration: item.durationBeats * (60 / bpm),
  }));
}

function buildEarPrompt(sharedState, mode, options = {}) {
  const { scalePool, chromaticPool, extendedPool } = getEarTrainingPool(sharedState);
  const reference = {
    absolute: EAR_REFERENCE_ABSOLUTE,
    label: "A3 (la)",
  };
  const bpm = sanitizeBpm(options.bpm, DEFAULT_EAR_STATE.bpm);
  const measureCount = sanitizeMeasureCount(options.measureCount, DEFAULT_EAR_STATE.measureCount);
  const includeBlackKeys = Boolean(options.enableBlackKeys);
  const rhythmOnly = Boolean(options.rhythmOnly);
  const naturalChordOnly = options.naturalChordOnly !== false;
  const useRandomRhythm = rhythmOnly ? true : Boolean(options.enableRandomRhythm);
  const minSubdivision = sanitizeMinSubdivision(options.minSubdivision, DEFAULT_EAR_STATE.minSubdivision);
  const activePool = includeBlackKeys ? chromaticPool : scalePool;

  if (mode === "single") {
    const target = pickRandomItem(activePool);

    return {
      mode,
      answerTitle: `单音答案：${target.pitch}`,
      answerDetail: `基准音之后播放 ${formatScaleAnswer(target)}。${includeBlackKeys ? " 当前允许出现黑键。" : " 当前仅使用白键。"}`,
      preview: [
        { label: "步骤 1", detail: "先听基准音 A3" },
        { label: "步骤 2", detail: "再听 1 个目标音" },
        { label: "黑键状态", detail: includeBlackKeys ? "开启，可出现黑键" : "关闭，仅白键" },
      ],
      events: [
        { notes: [reference.absolute], duration: 0.7 },
        { pause: 0.22 },
        { notes: [target.absolute], duration: 0.92 },
      ],
      metadata: {
        includeBlackKeys,
      },
    };
  }

  if (mode === "double") {
    const shuffled = [...activePool].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 2).sort((left, right) => left.absolute - right.absolute);

    return {
      mode,
      answerTitle: `双音答案：${targets.map((note) => note.pitch).join(" + ")}`,
      answerDetail: `基准音之后同时播放 ${targets.map(formatScaleAnswer).join(" 与 ")}。${includeBlackKeys ? " 当前允许出现黑键。" : " 当前仅使用白键。"}`,
      preview: [
        { label: "步骤 1", detail: "先听基准音 A3" },
        { label: "步骤 2", detail: "再听 2 个同时出现的音" },
        { label: "黑键状态", detail: includeBlackKeys ? "开启，可出现黑键" : "关闭，仅白键" },
      ],
      events: [
        { notes: [reference.absolute], duration: 0.7 },
        { pause: 0.22 },
        { notes: targets.map((note) => note.absolute), duration: 1.1 },
      ],
      metadata: {
        includeBlackKeys,
      },
    };
  }

  if (mode === "chord") {
    const chordNotes = naturalChordOnly
      ? (() => {
          const triadOptions = [
            [0, 2, 4],
            [1, 3, 5],
            [2, 4, 6],
            [3, 5, 7],
            [4, 6, 8],
            [5, 7, 9],
          ];
          const picked = pickRandomItem(triadOptions);
          return picked.map((index) => extendedPool[index]);
        })()
      : [...activePool]
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .sort((left, right) => left.absolute - right.absolute);

    return {
      mode,
      answerTitle: `和弦答案：${chordNotes.map((note) => note.pitch).join(" - ")}`,
      answerDetail: naturalChordOnly
        ? `基准音之后同时播放自然音三和弦 ${chordNotes.map(formatScaleAnswer).join("、")}。`
        : `基准音之后同时播放随机 3 音 ${chordNotes.map(formatScaleAnswer).join("、")}。${includeBlackKeys ? " 当前允许出现黑键。" : " 当前仅使用白键。"}`,
      preview: [
        { label: "步骤 1", detail: "先听基准音 A3" },
        { label: "步骤 2", detail: "再听 1 组同时响起的和弦" },
        { label: "和弦来源", detail: naturalChordOnly ? "自然音三和弦" : "随机 3 音组合" },
        { label: "黑键状态", detail: naturalChordOnly ? "自然音三和弦模式下不使用黑键" : (includeBlackKeys ? "开启，可出现黑键" : "关闭，仅白键") },
      ],
      events: [
        { notes: [reference.absolute], duration: 0.7 },
        { pause: 0.22 },
        { notes: chordNotes.map((note) => note.absolute), duration: 1.25 },
      ],
      metadata: {
        includeBlackKeys,
        naturalChordOnly,
      },
    };
  }

  const pattern = useRandomRhythm
    ? buildRandomRhythmPattern(sharedState, measureCount, minSubdivision)
    : buildFixedBeatPattern(sharedState, measureCount);
  const timeline = rhythmOnly
    ? pattern.map((noteId) => {
        const rhythmNote = getNoteDefinition(noteId);
        return {
          absolute: EAR_REFERENCE_ABSOLUTE,
          pitch: "A3",
          rhythmId: noteId,
          rhythmName: rhythmNote?.name || noteId,
          durationBeats: rhythmNote ? noteDurationInBeats(sharedState, rhythmNote) : 1,
        };
      })
    : buildRandomMelodyLine(sharedState, pattern, includeBlackKeys);

  const modeLabel = rhythmOnly
    ? "仅听节奏"
    : useRandomRhythm
      ? "随机旋律 + 随机节奏"
      : "随机旋律 + 均分节拍";
  const melodyAnswer = timeline.map((item) => item.pitch).join(" - ");
  const rhythmAnswer = describeRhythmPattern(sharedState, pattern);
  const beatDuration = 60 / bpm;
  const leadInBeats = mode === "melody" ? sharedState.numerator : 0;
  const leadInDuration = beatDuration * leadInBeats;
  const phraseStartOffset = 0.95 + leadInDuration;
  const notationMarkup = buildJianpuAnswerMarkup(sharedState, timeline, {
    maskPitch: rhythmOnly,
  });

  return {
    mode,
    answerTitle: rhythmOnly ? `节奏答案：${rhythmAnswer}` : `旋律答案：${melodyAnswer}`,
    answerDetail: rhythmOnly
      ? `基准音之后先给 1 小节预备拍，再固定播放 A3，并在 ${bpm} BPM、${formatMeter(sharedState)} 下输出 ${measureCount} 小节：${rhythmAnswer}。`
      : `基准音之后先给 1 小节预备拍，再播放 ${measureCount} 小节旋律：${melodyAnswer}；节奏为 ${rhythmAnswer}。`,
    preview: [
      { label: "步骤 1", detail: "先听基准音 A3" },
      { label: "步骤 2", detail: "再听 1 小节预备拍" },
      { label: "步骤 3", detail: rhythmOnly ? "最后进入 A3 的节奏型与底层节拍器" : "最后进入随机音高组成的旋律" },
      { label: "题目长度", detail: `${measureCount} 小节` },
      { label: "当前模式", detail: modeLabel },
      { label: "最小拆分", detail: formatSubdivisionLabel(minSubdivision) },
      {
        label: "开关状态",
        detail: `随机节奏 ${useRandomRhythm ? "开" : "关"} / 黑键 ${includeBlackKeys ? "开" : "关"} / 仅听节奏 ${rhythmOnly ? "开" : "关"}`,
      },
      { label: "速度", detail: `${bpm} BPM · ${formatMeter(sharedState)}` },
    ],
    events: [
      { notes: [reference.absolute], duration: 0.7 },
      { pause: 0.25 + leadInDuration },
      ...buildTimelineEventsFromLine(timeline, bpm),
    ],
    metronome: mode === "melody"
      ? {
          startOffset: phraseStartOffset,
          beatCount: sharedState.numerator * measureCount,
          beatsPerMeasure: sharedState.numerator,
          bpm,
          leadInBeats,
        }
      : null,
    metadata: {
      bpm,
      measureCount,
      pattern,
      timeline,
      includeBlackKeys,
      useRandomRhythm,
      rhythmOnly,
      minSubdivision,
      notationMarkup,
    },
  };
}

function mountSharedPanel(sharedState, onChange, options = {}) {
  const lockTonic = Boolean(options.lockTonic);
  const forcedTonic = normalizeTonicInput(options.forcedTonic || DEFAULT_SHARED_STATE.tonic);
  const meterTopInput = document.querySelector("[data-meter-top]");
  const meterBottomInput = document.querySelector("[data-meter-bottom]");
  const tonicInput = document.querySelector("[data-tonic-input]");
  let tonicDraft = lockTonic ? formatTonicDisplay(forcedTonic) : formatTonicDisplay(sharedState.tonic ?? "");

  const paint = () => {
    const meter = formatMeter(sharedState);
    const key = lockTonic
      ? `1=${formatTonicDisplay(forcedTonic)}（视唱练耳默认）`
      : formatTonic(sharedState);

    document.querySelectorAll("[data-shared-meter]").forEach((node) => {
      node.textContent = meter;
    });

    document.querySelectorAll("[data-shared-key]").forEach((node) => {
      node.textContent = key;
    });

    if (meterTopInput) meterTopInput.value = sharedState.numerator;
    if (meterBottomInput) meterBottomInput.value = sharedState.denominator;
    if (tonicInput) {
      const nextValue = lockTonic
        ? formatTonicDisplay(forcedTonic)
        : document.activeElement === tonicInput
          ? tonicDraft
          : formatTonicDisplay(sharedState.tonic ?? "");
      if (tonicInput.value !== nextValue) {
        tonicInput.value = nextValue;
      }
      tonicInput.readOnly = lockTonic;
      tonicInput.disabled = lockTonic;
    }
  };

  const updateSharedState = (patch) => {
    Object.assign(sharedState, patch);
    if (lockTonic) {
      const persistedState = loadStorage(SHARED_STORAGE_KEY, DEFAULT_SHARED_STATE);
      saveStorage(SHARED_STORAGE_KEY, {
        ...persistedState,
        numerator: sharedState.numerator,
        denominator: sharedState.denominator,
      });
    } else {
      saveStorage(SHARED_STORAGE_KEY, sharedState);
    }
    paint();
    onChange();
  };

  if (meterTopInput) {
    meterTopInput.addEventListener("input", (event) => {
      updateSharedState({
        numerator: sanitizeWholeNumber(event.target.value, DEFAULT_SHARED_STATE.numerator),
      });
    });
  }

  if (meterBottomInput) {
    meterBottomInput.addEventListener("input", (event) => {
      updateSharedState({
        denominator: sanitizeWholeNumber(event.target.value, DEFAULT_SHARED_STATE.denominator),
      });
    });
  }

  if (tonicInput) {
    if (!lockTonic) {
      const commitTonicDraft = () => {
        const normalized = normalizeTonicInput(tonicDraft, sharedState.tonic || DEFAULT_SHARED_STATE.tonic);
        tonicDraft = formatTonicDisplay(normalized);
        updateSharedState({
          tonic: normalized,
        });
      };

      tonicInput.addEventListener("input", (event) => {
        tonicDraft = event.target.value;
        const normalized = normalizeTonicInput(event.target.value, "");

        if (tonicToPitchClass(normalized) !== null) {
          updateSharedState({
            tonic: normalized,
          });
        }
      });

      tonicInput.addEventListener("change", commitTonicDraft);
      tonicInput.addEventListener("blur", commitTonicDraft);
    }
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== SHARED_STORAGE_KEY || !event.newValue) {
      return;
    }

    const nextState = JSON.parse(event.newValue);
    sharedState.numerator = sanitizeWholeNumber(nextState.numerator, DEFAULT_SHARED_STATE.numerator);
    sharedState.denominator = sanitizeWholeNumber(nextState.denominator, DEFAULT_SHARED_STATE.denominator);
    sharedState.tonic = lockTonic ? forcedTonic : normalizeTonicInput(nextState.tonic, "");
    tonicDraft = formatTonicDisplay(lockTonic ? forcedTonic : sharedState.tonic);
    paint();
    onChange();
  });

  sharedState.tonic = lockTonic ? forcedTonic : sharedState.tonic;
  tonicDraft = formatTonicDisplay(lockTonic ? forcedTonic : sharedState.tonic ?? "");
  paint();
}

function mountModePage(sharedState) {
  const boardViewport = document.querySelector("[data-mode-board-viewport]");
  const boardTrack = document.querySelector("[data-mode-board-track]");
  const octaveInput = document.querySelector("[data-octave-count]");
  const keyAudioToggle = document.querySelector("[data-mode-key-audio-toggle]");
  const zoomStatus = document.querySelector("[data-zoom-status]");
  const rangeNode = document.querySelector("[data-octave-range]");
  const anchorNode = document.querySelector("[data-mode-anchor]");
  const modeSummary = document.querySelector("[data-mode-summary]");
  const modeTone = document.querySelector("[data-mode-tone]");
  const modeTip = document.querySelector("[data-mode-tip]");
  const mappingGrid = document.querySelector("[data-degree-mapping]");
  const randomDegreeNode = document.querySelector("[data-random-degree]");
  const randomSolfegeNode = document.querySelector("[data-random-solfege]");
  const randomPitchNode = document.querySelector("[data-random-pitch]");
  const generateDegreeButton = document.querySelector("[data-generate-degree]");

  if (!boardViewport || !boardTrack) {
    return () => {};
  }

  const pageState = loadStorage(MODE_STORAGE_KEY, DEFAULT_MODE_STATE);
  pageState.visibleOctaves = sanitizeOctaveCount(pageState.visibleOctaves, DEFAULT_MODE_STATE.visibleOctaves);
  pageState.keyboardAudioEnabled = Boolean(pageState.keyboardAudioEnabled);
  const modeMotion = {
    animationFrameId: 0,
    currentScene: null,
    currentVisualTonic: normalizeTonicInput(sharedState.tonic),
  };
  const keyboardAudio = {
    audioContext: null,
    masterGain: null,
    activeNodes: new Set(),
  };
  const centerDegreeIndex = 3;

  const persist = () => saveStorage(MODE_STORAGE_KEY, pageState);
  const getVisualTonic = () => {
    const candidate = normalizeTonicInput(sharedState.tonic, "");
    if (tonicToPitchClass(candidate) !== null) {
      modeMotion.currentVisualTonic = candidate;
    }

    return modeMotion.currentVisualTonic || DEFAULT_SHARED_STATE.tonic;
  };

  const stopAnimation = () => {
    if (modeMotion.animationFrameId) {
      window.cancelAnimationFrame(modeMotion.animationFrameId);
      modeMotion.animationFrameId = 0;
    }
  };

  const getSceneStatusText = (scene, detail = "") => {
    const baseText = `全 88 键矢量钢琴 · 自动显示 ${scene.visibleOctaves} 个八度`;
    const audioText = pageState.keyboardAudioEnabled ? " · 点键盘发声已开启" : " · 点键盘发声已关闭";
    return `${baseText}${audioText}${detail ? ` · ${detail}` : ""}`;
  };

  const trackKeyboardAudioNode = (node) => {
    keyboardAudio.activeNodes.add(node);
    node.addEventListener("ended", () => {
      keyboardAudio.activeNodes.delete(node);
    }, { once: true });
    return node;
  };

  const ensureKeyboardAudio = async () => {
    if (!keyboardAudio.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) {
        throw new Error("当前浏览器不支持 Web Audio");
      }
      keyboardAudio.audioContext = new Context();
      keyboardAudio.masterGain = keyboardAudio.audioContext.createGain();
      keyboardAudio.masterGain.gain.value = 0.9;
      // 压缩器防止连续快速点键时破音
      keyboardAudio.compressor = keyboardAudio.audioContext.createDynamicsCompressor();
      keyboardAudio.compressor.threshold.value = -10;
      keyboardAudio.compressor.knee.value = 8;
      keyboardAudio.compressor.ratio.value = 4;
      keyboardAudio.masterGain.connect(keyboardAudio.compressor);
      keyboardAudio.compressor.connect(keyboardAudio.audioContext.destination);
      keyboardAudio.samplesPromise = loadPianoSampler(keyboardAudio.audioContext);
    }

    if (keyboardAudio.audioContext.state === "suspended") {
      await keyboardAudio.audioContext.resume();
    }
  };

  const playKeyboardPitch = async (absolute) => {
    await ensureKeyboardAudio();
    const samples = await keyboardAudio.samplesPromise;
    const startTime = keyboardAudio.audioContext.currentTime + 0.01;

    if (samples) {
      trackKeyboardAudioNode(
        playPianoSample(keyboardAudio.audioContext, samples, absolute + 12, keyboardAudio.masterGain, startTime),
      );
      return;
    }

    // 没有采样时退回合成音色（音量已提高）
    const frequency = 440 * (2 ** ((absolute - 57) / 12));
    const envelope = keyboardAudio.audioContext.createGain();
    const toneFilter = keyboardAudio.audioContext.createBiquadFilter();
    const partials = [
      { type: "triangle", multiple: 1, detune: 0, gain: 0.18 },
      { type: "sine", multiple: 2, detune: 2.5, gain: 0.09 },
      { type: "sine", multiple: 3, detune: -3.2, gain: 0.05 },
    ];

    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(Math.min(4200, frequency * 6), startTime);
    toneFilter.Q.value = 0.9;

    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.linearRampToValueAtTime(2.2, startTime + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.75, startTime + 0.16);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.9);

    toneFilter.connect(envelope);
    envelope.connect(keyboardAudio.masterGain);

    partials.forEach((partial) => {
      const oscillator = keyboardAudio.audioContext.createOscillator();
      const partialGain = keyboardAudio.audioContext.createGain();

      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(frequency * partial.multiple, startTime);
      oscillator.detune.setValueAtTime(partial.detune, startTime);
      partialGain.gain.setValueAtTime(partial.gain, startTime);

      oscillator.connect(partialGain);
      partialGain.connect(toneFilter);
      trackKeyboardAudioNode(oscillator);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.96);
    });
  };

  const getKeyNodeFromPointerEvent = (event) => {
    if (event.target && typeof event.target.closest === "function") {
      const directMatch = event.target.closest("[data-key-absolute]");
      if (directMatch) {
        return directMatch;
      }
    }

    if (typeof event.composedPath === "function") {
      const matchedNode = event
        .composedPath()
        .find((node) => node && node.dataset && node.dataset.keyAbsolute);

      if (matchedNode) {
        return matchedNode;
      }
    }

    return null;
  };

  const buildScene = (tonicValue, visibleOctaves) => {
    const viewWidth = boardViewport.clientWidth || 920;
    const keyboardModel = createPiano88Model(prefersFlats(tonicValue));
    const scaleNotes = getScaleNotes({ ...sharedState, tonic: tonicValue });
    const centerAbsolute = scaleNotes[centerDegreeIndex]?.absolute ?? 53;
    const visibleHalfSpan = Math.max(6, visibleOctaves * 6);
    const visibleRangeStart = centerAbsolute - visibleHalfSpan;
    const visibleRangeEnd = centerAbsolute + visibleHalfSpan;
    const visibleKeys = keyboardModel.keys.filter(
      (key) => key.absolute >= visibleRangeStart && key.absolute <= visibleRangeEnd
    );
    const minX = visibleKeys.length ? Math.min(...visibleKeys.map((key) => key.left)) : 0;
    const maxX = visibleKeys.length
      ? Math.max(...visibleKeys.map((key) => key.left + key.width))
      : keyboardModel.width;
    const visibleStartKey = visibleKeys[0] || keyboardModel.keys[0];
    const visibleEndKey = visibleKeys[visibleKeys.length - 1] || keyboardModel.keys[keyboardModel.keys.length - 1];
    const windowWidth = Math.max(maxX - minX, 1);
    const contentTop = 20;
    const contentBottom = 338;
    const contentHeight = contentBottom - contentTop;
    const maxStageHeight = 600;
    const zoom = Math.min(
      clamp((viewWidth - 120) / windowWidth, 0.48, 1.86),
      (maxStageHeight - 64) / contentHeight
    );
    const stageHeight = clamp(contentHeight * zoom + 64, 360, maxStageHeight);
    const centerAxisKey = keyboardModel.keys.find((key) => key.absolute === scaleNotes[centerDegreeIndex]?.absolute)
      || keyboardModel.keys.find((key) => key.absolute === 53)
      || keyboardModel.keys[0];
    const referenceCenterX = centerAxisKey ? centerAxisKey.center : viewWidth / 2;
    const minPanX = viewWidth - maxX * zoom - 36;
    const maxPanX = 36 - minX * zoom;
    const panX = clamp(viewWidth / 2 - referenceCenterX * zoom, minPanX, maxPanX);
    const panY = (stageHeight - contentHeight * zoom) / 2 - contentTop * zoom;
    const tonicKey = keyboardModel.keys.find((keyboardKey) => keyboardKey.absolute === scaleNotes[0]?.absolute) || null;
    const tonicAnchorX = tonicKey ? panX + tonicKey.center * zoom : viewWidth / 2;
    const uniformAnchorStep = keyboardModel.whiteWidth * zoom;
    const sceneNotes = scaleNotes.map((note, index) => {
      const key = keyboardModel.keys.find((keyboardKey) => keyboardKey.absolute === note.absolute) || null;
      const anchorX = tonicAnchorX + index * uniformAnchorStep;

      return {
        ...note,
        anchorX,
        key,
        keyX: key ? panX + key.center * zoom : anchorX,
        keyY: key ? panY + (188 - 16) * zoom : 172,
      };
    });

    return {
      tonic: tonicValue,
      visibleOctaves,
      viewWidth,
      stageHeight,
      keyboardModel,
      sceneNotes,
      panX,
      panY,
      zoom,
      minX,
      maxX,
      visibleStartAbsolute: visibleStartKey?.absolute ?? visibleRangeStart,
      visibleEndAbsolute: visibleEndKey?.absolute ?? visibleRangeEnd,
    };
  };

  const rebuildSceneGeometry = (scene, anchorXs = scene.sceneNotes.map((note) => note.anchorX)) => ({
    ...scene,
    sceneNotes: scene.sceneNotes.map((note, index) => {
      const key = scene.keyboardModel.keys.find((keyboardKey) => keyboardKey.absolute === note.absolute) || note.key || null;
      return {
        ...note,
        key,
        anchorX: anchorXs[index] ?? note.anchorX,
        keyX: key ? scene.panX + key.center * scene.zoom : anchorXs[index] ?? note.anchorX,
        keyY: key ? scene.panY + (188 - 16) * scene.zoom : 172,
      };
    }),
  });

  const alignSceneToCenterAxis = (scene, anchorXs) => {
    const centerNote = scene.sceneNotes[centerDegreeIndex];
    const targetAnchorX = anchorXs[centerDegreeIndex] ?? centerNote?.anchorX ?? scene.viewWidth / 2;
    const desiredPanX = centerNote?.key
      ? targetAnchorX - centerNote.key.center * scene.zoom
      : scene.panX;
    const minPanX = scene.viewWidth - scene.maxX * scene.zoom - 36;
    const maxPanX = 36 - scene.minX * scene.zoom;

    return rebuildSceneGeometry(
      {
        ...scene,
        panX: clamp(desiredPanX, minPanX, maxPanX),
      },
      anchorXs
    );
  };

  const renderScene = (scene) => {
    modeMotion.currentScene = scene;
    octaveInput.value = scene.visibleOctaves;
    rangeNode.textContent = `${semitoneToPitchName(scene.visibleStartAbsolute, prefersFlats(scene.tonic))}${Math.floor(scene.visibleStartAbsolute / 12)} - ${semitoneToPitchName(scene.visibleEndAbsolute, prefersFlats(scene.tonic))}${Math.floor(scene.visibleEndAbsolute / 12)}`;
    if (anchorNode) anchorNode.textContent = `fa 中轴 ${scene.sceneNotes[centerDegreeIndex].pitch} · do 对齐 ${scene.sceneNotes[0].pitch}`;
    if (modeSummary) modeSummary.textContent = `当前 1=${formatTonicDisplay(scene.tonic)} 下，1 到 7 固定在上方，整块关系会围绕当前 fa 指向的键等比放大或缩小。`;
    if (modeTone) modeTone.textContent = `现在的音级顺序是 ${scene.sceneNotes.map((note) => `${note.degree}=${note.pitch}`).join("、")}。`;
    if (modeTip) modeTip.textContent = `调八度时会围绕当前 fa 指向的键整块缩放；调调号时会先移动线的下端，再让键盘缓缓平移到新的垂直关系。`;
    boardViewport.style.height = `${scene.stageHeight}px`;
    boardViewport.style.minHeight = `${scene.stageHeight}px`;
    boardTrack.style.height = `${scene.stageHeight}px`;
    boardTrack.style.minHeight = `${scene.stageHeight}px`;
    boardTrack.classList.toggle("is-audio-enabled", pageState.keyboardAudioEnabled);
    boardTrack.innerHTML = buildPianoSceneMarkup(scene.viewWidth, scene.stageHeight, scene.keyboardModel, scene.sceneNotes, {
      panX: scene.panX,
      panY: scene.panY,
      zoom: scene.zoom,
    });
    zoomStatus.textContent = getSceneStatusText(scene);
    if (keyAudioToggle) {
      keyAudioToggle.checked = pageState.keyboardAudioEnabled;
    }

    if (mappingGrid) {
      mappingGrid.innerHTML = scene.sceneNotes
        .map(
          (note) => `
            <article class="degree-map-card">
              <strong>${note.degree}</strong>
              <span class="degree-map-card__solfege">${note.solfege}</span>
              <span class="degree-map-card__pitch">${note.pitch}</span>
            </article>
          `
        )
        .join("");
    }

    const randomIndex = pageState.randomDegreeIndex % scene.sceneNotes.length;
    randomDegreeNode.textContent = scene.sceneNotes[randomIndex].degree;
    randomSolfegeNode.textContent = scene.sceneNotes[randomIndex].solfege;
    randomPitchNode.textContent = scene.sceneNotes[randomIndex].pitch;
  };

  const interpolateScene = (fromScene, toScene, progress) => {
    const eased = easeInOutCubic(progress);

    return {
      ...toScene,
      stageHeight: lerp(fromScene.stageHeight, toScene.stageHeight, eased),
      panX: lerp(fromScene.panX, toScene.panX, eased),
      panY: lerp(fromScene.panY, toScene.panY, eased),
      zoom: lerp(fromScene.zoom, toScene.zoom, eased),
      sceneNotes: toScene.sceneNotes.map((note, index) => {
        const fromNote = fromScene.sceneNotes[index] || note;

        return {
          ...note,
          anchorX: lerp(fromNote.anchorX, note.anchorX, eased),
          keyX: lerp(fromNote.keyX, note.keyX, eased),
          keyY: lerp(fromNote.keyY, note.keyY, eased),
        };
      }),
    };
  };

  const animateScene = (fromScene, toScene, duration, onComplete) => {
    stopAnimation();
    const startTime = performance.now();

    const step = (now) => {
      const progress = clamp((now - startTime) / duration, 0, 1);
      renderScene(interpolateScene(fromScene, toScene, progress));

      if (progress < 1) {
        modeMotion.animationFrameId = window.requestAnimationFrame(step);
        return;
      }

      modeMotion.animationFrameId = 0;
      renderScene(toScene);
      if (onComplete) {
        onComplete();
      }
    };

    modeMotion.animationFrameId = window.requestAnimationFrame(step);
  };

  const updateModeScene = (reason = "refresh", immediate = false) => {
    const visualTonic = getVisualTonic();
    const targetScene = buildScene(visualTonic, pageState.visibleOctaves);

    if (!modeMotion.currentScene || immediate) {
      stopAnimation();
      renderScene(targetScene);
      return;
    }

    const currentScene = modeMotion.currentScene;
    const tonicChanged = currentScene.tonic !== targetScene.tonic;
    const anchorXs = currentScene.sceneNotes.map((note) => note.anchorX);

    if (!tonicChanged) {
      animateScene(currentScene, targetScene, reason === "octave" ? 860 : 280);
      return;
    }

    const phaseOneScene = rebuildSceneGeometry({
      ...targetScene,
      stageHeight: currentScene.stageHeight,
      panX: currentScene.panX,
      panY: currentScene.panY,
      zoom: currentScene.zoom,
    }, anchorXs);

    animateScene(currentScene, phaseOneScene, 760, () => {
      animateScene(phaseOneScene, targetScene, 960);
    });
  };

  octaveInput.addEventListener("input", (event) => {
    pageState.visibleOctaves = sanitizeOctaveCount(event.target.value, DEFAULT_MODE_STATE.visibleOctaves);
    persist();
    updateModeScene("octave");
  });

  boardTrack.addEventListener("pointerdown", async (event) => {
    if (!pageState.keyboardAudioEnabled) {
      return;
    }

    const keyNode = getKeyNodeFromPointerEvent(event);
    if (!keyNode) {
      return;
    }

    const absolute = Number(keyNode.dataset.keyAbsolute);
    if (!Number.isFinite(absolute)) {
      return;
    }

    try {
      await playKeyboardPitch(absolute);
      if (modeMotion.currentScene) {
        zoomStatus.textContent = getSceneStatusText(modeMotion.currentScene, `${keyNode.dataset.keyLabel || absolute}`);
      }
    } catch (error) {
      if (modeMotion.currentScene) {
        zoomStatus.textContent = getSceneStatusText(modeMotion.currentScene, "当前浏览器拦截了声音");
      }
    }
  });

  keyAudioToggle?.addEventListener("change", async (event) => {
    pageState.keyboardAudioEnabled = event.target.checked;
    if (pageState.keyboardAudioEnabled) {
      try {
        await ensureKeyboardAudio();
      } catch (error) {
        pageState.keyboardAudioEnabled = false;
        if (modeMotion.currentScene) {
          zoomStatus.textContent = getSceneStatusText(modeMotion.currentScene, "当前浏览器不支持点击发声");
        }
      }
    }
    persist();
    renderScene(modeMotion.currentScene || buildScene(getVisualTonic(), pageState.visibleOctaves));
  });

  generateDegreeButton.addEventListener("click", () => {
    pageState.randomDegreeIndex = Math.floor(Math.random() * DEGREE_LABELS.length);
    persist();
    renderScene(modeMotion.currentScene || buildScene(getVisualTonic(), pageState.visibleOctaves));
  });

  window.addEventListener("resize", () => {
    updateModeScene("resize", true);
  });
  updateModeScene("initial", true);

  return () => {
    updateModeScene("shared");
  };
}

function mountRhythmPage(sharedState) {
  const noteBank = document.querySelector("[data-note-bank]");
  const patternStrip = document.querySelector("[data-pattern-strip]");
  const patternTitle = document.querySelector("[data-pattern-title]");
  const patternProgress = document.querySelector("[data-pattern-progress]");
  const patternFill = document.querySelector("[data-pattern-fill]");
  const patternCollapseButton = document.querySelector("[data-pattern-collapse]");
  const patternNameToggle = document.querySelector("[data-pattern-name-toggle]");
  const scopeLabel = document.querySelector("[data-rhythm-scope-label]");
  const scopeSelector = document.querySelector("[data-scope-selector]");
  const clearButton = document.querySelector("[data-clear-pattern]");
  const fillButton = document.querySelector("[data-fill-pattern]");
  const measureCountInput = document.querySelector("[data-measure-count-input]");
  const bpmInput = document.querySelector("[data-bpm-input]");
  const playToggle = document.querySelector("[data-play-toggle]");
  const playStatus = document.querySelector("[data-play-status]");
  const visualizer = document.querySelector("[data-rhythm-visualizer]");
  const visualizerSummary = document.querySelector("[data-visualizer-summary]");
  const visualizerColumnButtons = document.querySelectorAll("[data-visualizer-columns]");

  if (!noteBank || !patternStrip || !bpmInput || !measureCountInput || !visualizer) {
    return () => {};
  }

  const pageState = loadStorage(RHYTHM_STORAGE_KEY, DEFAULT_RHYTHM_STATE);
  const legacyPattern = Array.isArray(pageState.pattern) ? pageState.pattern : [];
  const legacyPatterns = Array.isArray(pageState.patterns) ? pageState.patterns : [];
  pageState.measureCount = sanitizeMeasureCount(pageState.measureCount, DEFAULT_RHYTHM_STATE.measureCount);
  pageState.activeMeasure = Number.isInteger(pageState.activeMeasure) ? pageState.activeMeasure : DEFAULT_RHYTHM_STATE.activeMeasure;
  pageState.patternPanelCollapsed = Boolean(pageState.patternPanelCollapsed);
  pageState.showNoteNames = pageState.showNoteNames !== false;
  pageState.visualizerColumns = sanitizeVisualizerColumns(pageState.visualizerColumns);
  pageState.sequence = sanitizeRhythmSequence(
    sharedState,
    pageState.sequence,
    pageState.measureCount,
    legacyPatterns,
    legacyPattern
  );
  delete pageState.pattern;
  delete pageState.patterns;
  pageState.bpm = sanitizeBpm(pageState.bpm, DEFAULT_RHYTHM_STATE.bpm);
  let bpmDraft = String(pageState.bpm);
  let measureDraft = String(pageState.measureCount);

  const transport = {
    audioContext: null,
    clickBuffers: null,
    loopTimerId: 0,
    isPlaying: false,
    animationFrameId: 0,
    startAudioTime: 0,
    unitDurationSec: 0,
    cycleDurationSec: 0,
    glyphNodes: [],
    lastMeterSignature: formatMeter(sharedState),
    activeAudioNodes: new Set(),
  };
  const visualLeadSec = 0.12;
  const patternDrag = {
    dragIndex: null,
    justDropped: false,
  };

  const persist = () => {
    pageState.sequence = sanitizeRhythmSequence(sharedState, pageState.sequence, pageState.measureCount);
    if (pageState.activeMeasure >= pageState.measureCount) {
      pageState.activeMeasure = -1;
    }
    saveStorage(RHYTHM_STORAGE_KEY, pageState);
  };

  const buildTimeline = () => buildRhythmTimeline(sharedState, pageState.sequence, pageState.measureCount);

  const getActiveMeasure = () =>
    Number.isInteger(pageState.activeMeasure) && pageState.activeMeasure >= 0 && pageState.activeMeasure < pageState.measureCount
      ? pageState.activeMeasure
      : -1;

  const getScopeLabel = () => {
    const activeMeasure = getActiveMeasure();
    return activeMeasure >= 0 ? `第 ${activeMeasure + 1} 小节` : "全局";
  };

  const getScopeTotalBeats = (timeline, activeMeasure) =>
    activeMeasure >= 0 ? sharedState.numerator : timeline.totalBeats;

  const getScopeUsedBeats = (timeline, activeMeasure) =>
    activeMeasure >= 0 ? getMeasureBeatUsage(sharedState, timeline, activeMeasure) : timeline.usedBeats;

  const getScopeItems = (timeline, activeMeasure) => getScopeTimelineItems(sharedState, timeline, activeMeasure);

  const commitRhythmBpm = () => {
    bpmDraft = bpmInput.value;
    pageState.bpm = sanitizeBpm(bpmDraft, pageState.bpm);
    bpmDraft = String(pageState.bpm);
    persist();
    render();

    if (transport.isPlaying) {
      startPlayback();
    }
  };

  const commitMeasureCount = () => {
    measureDraft = measureCountInput.value;
    pageState.measureCount = sanitizeMeasureCount(measureDraft, pageState.measureCount);
    pageState.sequence = sanitizeRhythmSequence(sharedState, pageState.sequence, pageState.measureCount);
    if (pageState.activeMeasure >= pageState.measureCount) {
      pageState.activeMeasure = -1;
    }
    measureDraft = String(pageState.measureCount);
    persist();
    render();

    if (transport.isPlaying) {
      startPlayback();
    }
  };

  const canFit = (noteId, timeline) => {
    const note = NOTE_BANK.find((item) => item.id === noteId);
    if (!note) {
      return false;
    }

    const duration = noteDurationInBeats(sharedState, note);
    if (duration > timeline.totalBeats + 0.0001) {
      return false;
    }

    const activeMeasure = getActiveMeasure();
    if (activeMeasure < 0) {
      return timeline.usedBeats + duration <= timeline.totalBeats + 0.0001;
    }

    const insertion = getMeasureInsertionContext(sharedState, timeline, activeMeasure);
    return insertion.cursorBeat < insertion.endBeat - 0.0001
      && insertion.cursorBeat + duration <= timeline.totalBeats + 0.0001;
  };

  const addNoteToScope = (noteId, timeline) => {
    const activeMeasure = getActiveMeasure();
    if (activeMeasure < 0) {
      pageState.sequence = [...timeline.sequence, noteId];
      return;
    }

    const insertion = getMeasureInsertionContext(sharedState, timeline, activeMeasure);
    const nextSequence = [...timeline.sequence];
    nextSequence.splice(insertion.insertionIndex, 0, noteId);
    pageState.sequence = nextSequence;
  };

  const ensureAudioContext = async () => {
    if (!transport.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      transport.audioContext = new Context();
    }

    if (transport.audioContext.state === "suspended") {
      await transport.audioContext.resume();
    }
  };

  const resetGlyphs = () => {
    updateGlyphProgress(transport.glyphNodes, 0);
  };

  const trackAudioNode = (node) => {
    transport.activeAudioNodes.add(node);
    node.addEventListener("ended", () => {
      transport.activeAudioNodes.delete(node);
    }, { once: true });
    return node;
  };

  const stopScheduledAudio = () => {
    if (!transport.audioContext) {
      return;
    }

    transport.activeAudioNodes.forEach((node) => {
      try {
        node.stop(transport.audioContext.currentTime);
      } catch (error) {
        // no-op: node may already be stopped
      }
    });
    transport.activeAudioNodes.clear();
  };

  const scheduleRhythmTone = (startTime, durationSeconds, isMeasureStart) => {
    const oscillator = transport.audioContext.createOscillator();
    const gainNode = transport.audioContext.createGain();
    const filter = transport.audioContext.createBiquadFilter();
    const sustainTime = Math.max(0.08, durationSeconds - 0.02);

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(isMeasureStart ? 740 : 620, startTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isMeasureStart ? 2600 : 2200, startTime);
    filter.Q.value = 0.8;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(isMeasureStart ? 0.14 : 0.1, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.06, startTime + Math.min(0.18, sustainTime * 0.35));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + sustainTime);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(transport.audioContext.destination);
    trackAudioNode(oscillator);
    oscillator.start(startTime);
    oscillator.stop(startTime + sustainTime + 0.04);
  };

  const scheduleCycle = (cycleStartAudioTime) => {
    const timeline = buildTimeline();
    const beatDurationSec = 60 / pageState.bpm;
    const cycleUnits = timeline.totalBeats * 4;

    for (let beatIndex = 0; beatIndex < timeline.totalBeats; beatIndex += 1) {
      const beatTime = cycleStartAudioTime + beatIndex * beatDurationSec;
      trackAudioNode(scheduleClickSound(transport, beatIndex % sharedState.numerator === 0, beatTime));
    }

    timeline.notes.forEach((note) => {
      const startTime = cycleStartAudioTime + note.startBeat * (60 / pageState.bpm);
      const isMeasureStart = Math.abs(note.startBeat % sharedState.numerator) < 0.0001;
      scheduleRhythmTone(startTime, note.beats * (60 / pageState.bpm), isMeasureStart);
    });

    window.clearTimeout(transport.loopTimerId);
    transport.loopTimerId = window.setTimeout(() => {
      if (!transport.isPlaying) {
        return;
      }

      scheduleCycle(cycleStartAudioTime + cycleUnits * transport.unitDurationSec);
    }, Math.max(0, transport.cycleDurationSec * 1000 - 120));
  };

  const stopPlayback = () => {
    transport.isPlaying = false;
    window.clearTimeout(transport.loopTimerId);
    window.cancelAnimationFrame(transport.animationFrameId);
    stopScheduledAudio();
    playStatus.textContent = "已停止";
    playToggle.textContent = "播放节拍器";
    resetGlyphs();
  };

  const animationLoop = () => {
    if (!transport.isPlaying) {
      return;
    }

    const cycleUnits = buildTimeline().totalBeats * 4;
    const visualTime = transport.audioContext.currentTime + visualLeadSec;
    const elapsedUnits = visualTime < transport.startAudioTime
      ? 0
      : (visualTime - transport.startAudioTime) / transport.unitDurationSec;
    const progressUnits = ((elapsedUnits % cycleUnits) + cycleUnits) % cycleUnits;

    updateGlyphProgress(transport.glyphNodes, progressUnits);
    transport.animationFrameId = window.requestAnimationFrame(animationLoop);
  };

  const startPlayback = async () => {
    const timeline = buildTimeline();
    await ensureAudioContext();
    stopPlayback();
    transport.isPlaying = true;
    transport.unitDurationSec = (60 / pageState.bpm) / 4;
    transport.cycleDurationSec = timeline.totalBeats * 4 * transport.unitDurationSec;
    transport.startAudioTime = transport.audioContext.currentTime + 0.08;
    playStatus.textContent = `播放中 · ${pageState.bpm} BPM`;
    playToggle.textContent = "停止播放";
    scheduleCycle(transport.startAudioTime);
    animationLoop();
  };

  const render = () => {
    pageState.sequence = sanitizeRhythmSequence(sharedState, pageState.sequence, pageState.measureCount);
    persist();

    const timeline = buildTimeline();
    const activeMeasure = getActiveMeasure();
    const scopeItems = getScopeItems(timeline, activeMeasure);
    const scopeUsedBeats = getScopeUsedBeats(timeline, activeMeasure);
    const scopeTotalBeats = getScopeTotalBeats(timeline, activeMeasure);
    const remaining = Math.max(scopeTotalBeats - scopeUsedBeats, 0);

    const nextBpmValue = document.activeElement === bpmInput ? bpmDraft : String(pageState.bpm);
    const nextMeasureValue = document.activeElement === measureCountInput ? measureDraft : String(pageState.measureCount);
    if (bpmInput.value !== nextBpmValue) {
      bpmInput.value = nextBpmValue;
    }
    if (measureCountInput.value !== nextMeasureValue) {
      measureCountInput.value = nextMeasureValue;
    }
    if (patternTitle) {
      patternTitle.textContent = "来看看这些音符可以制造出怎样的节奏吧!";
    }
    if (scopeLabel) {
      scopeLabel.textContent = activeMeasure >= 0
        ? `当前为第 ${activeMeasure + 1} 小节`
        : `当前为全局（共 ${pageState.measureCount} 小节）`;
    }
    patternProgress.textContent = `${decimalToFriendly(scopeUsedBeats)} / ${decimalToFriendly(scopeTotalBeats)} 拍`;
    patternFill.style.width = scopeTotalBeats > 0 ? `${Math.min((scopeUsedBeats / scopeTotalBeats) * 100, 100)}%` : "0%";
    if (patternCollapseButton) {
      patternCollapseButton.textContent = pageState.patternPanelCollapsed ? "展开" : "收起";
    }
    if (patternNameToggle) {
      patternNameToggle.textContent = pageState.showNoteNames ? "隐藏名称" : "显示名称";
    }
    patternStrip.classList.toggle("is-collapsed", pageState.patternPanelCollapsed);
    playStatus.textContent = transport.isPlaying ? `播放中 · ${pageState.bpm} BPM` : "已停止";
    playToggle.textContent = transport.isPlaying ? "停止播放" : "播放节拍器";
    clearButton.textContent = activeMeasure >= 0 ? "清空当前小节" : "清空全局";
    fillButton.textContent = activeMeasure >= 0 ? "补满当前小节" : "补满全局";

    noteBank.innerHTML = NOTE_BANK.map((note) => {
      const duration = noteDurationInBeats(sharedState, note);
      const disabled = activeMeasure < 0
        ? duration > timeline.totalBeats || duration > remaining + 0.0001 || !canFit(note.id, timeline)
        : !canFit(note.id, timeline);

      return `
        <button class="note-card" type="button" data-note-id="${note.id}" ${disabled ? "disabled" : ""}>
          <span class="note-card__symbol">${buildNoteIconMarkup(note.id)}</span>
          <strong class="note-card__title">${note.name}</strong>
          <p class="note-card__meta">${noteDurationLabel(sharedState, note)}</p>
        </button>
      `;
    }).join("");

    if (scopeSelector) {
      scopeSelector.innerHTML = `
        <button
          class="scope-pill ${activeMeasure < 0 ? "is-active" : ""}"
          type="button"
          data-scope-index="-1"
        >
          全局
        </button>
        ${Array.from({ length: pageState.measureCount }, (_, measureIndex) => `
          <button
            class="scope-pill ${activeMeasure === measureIndex ? "is-active" : ""}"
            type="button"
            data-scope-index="${measureIndex}"
          >
            第 ${measureIndex + 1} 小节
          </button>
        `).join("")}
      `;
    }

    patternStrip.innerHTML = scopeItems.length
      ? scopeItems
          .map((item, index) => {
            const measureBadge = activeMeasure >= 0
              ? ""
              : `<span class="measure-chip__scope">第 ${item.startMeasureIndex + 1} 小节</span>`;
            const nameMarkup = pageState.showNoteNames ? `<strong>${item.name}</strong>` : "";

            return `
              <button
                class="measure-chip"
                type="button"
                draggable="true"
                data-pattern-index="${index}"
                data-sequence-index="${item.sequenceIndex}"
                title="点击删除，拖动排序"
              >
                ${measureBadge}
                <span class="measure-chip__symbol">${buildNoteIconMarkup(item.noteId)}</span>
                ${nameMarkup}
                <span class="measure-chip__beats">${noteDurationLabel(sharedState, item)}</span>
              </button>
            `;
          })
          .join("")
      : `<div class="pattern-empty">${
          activeMeasure >= 0 && scopeUsedBeats > 0
            ? "本小节前段已被上一小节延音占用。"
            : activeMeasure >= 0
              ? "这个小节还没有节奏。"
              : "全局还没有节奏。"
        }</div>`;

    renderRhythmVisualizer(sharedState, timeline, visualizer, visualizerSummary, activeMeasure, pageState.visualizerColumns);
    transport.glyphNodes = [...visualizer.querySelectorAll("[data-glyph-start]")];

    if (transport.isPlaying) {
      const cycleUnits = timeline.totalBeats * 4;
      const visualTime = transport.audioContext.currentTime + visualLeadSec;
      const elapsedUnits = visualTime < transport.startAudioTime
        ? 0
        : (visualTime - transport.startAudioTime) / transport.unitDurationSec;
      const progressUnits = ((elapsedUnits % cycleUnits) + cycleUnits) % cycleUnits;
      updateGlyphProgress(transport.glyphNodes, progressUnits);
    }

    noteBank.querySelectorAll("[data-note-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const { noteId } = button.dataset;
        if (!canFit(noteId, timeline)) {
          return;
        }

        addNoteToScope(noteId, timeline);
        persist();
        render();

        if (transport.isPlaying) {
          startPlayback();
        }
      });
    });

    scopeSelector?.querySelectorAll("[data-scope-index]").forEach((button) => {
      button.addEventListener("click", () => {
        pageState.activeMeasure = Number(button.dataset.scopeIndex);
        persist();
        render();
      });
    });

    patternStrip.querySelectorAll("[data-pattern-index]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (patternDrag.justDropped) {
          return;
        }

        const sequenceIndex = Number(chip.dataset.sequenceIndex);
        pageState.sequence.splice(sequenceIndex, 1);
        persist();
        render();

        if (transport.isPlaying) {
          startPlayback();
        }
      });

      chip.addEventListener("dragstart", (event) => {
        patternDrag.dragIndex = Number(chip.dataset.patternIndex);
        chip.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
      });

      chip.addEventListener("dragend", () => {
        chip.classList.remove("is-dragging");
        patternDrag.dragIndex = null;
      });

      chip.addEventListener("dragover", (event) => {
        event.preventDefault();
        chip.classList.add("is-drop-target");
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("is-drop-target");
      });

      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        chip.classList.remove("is-drop-target");

        const fromIndex = patternDrag.dragIndex;
        const toIndex = Number(chip.dataset.patternIndex);
        if (!Number.isInteger(fromIndex) || fromIndex === toIndex) {
          return;
        }

        const scopeSequenceIndices = scopeItems.map((item) => item.sequenceIndex);
        const reorderedIds = scopeItems.map((item) => item.noteId);
        const [moved] = reorderedIds.splice(fromIndex, 1);
        reorderedIds.splice(toIndex, 0, moved);
        const nextSequence = [...timeline.sequence];
        scopeSequenceIndices.forEach((sequenceIndex, scopeIndex) => {
          nextSequence[sequenceIndex] = reorderedIds[scopeIndex];
        });
        pageState.sequence = nextSequence;
        patternDrag.justDropped = true;
        window.setTimeout(() => {
          patternDrag.justDropped = false;
        }, 0);
        persist();
        render();

        if (transport.isPlaying) {
          startPlayback();
        }
      });
    });

    visualizer.querySelectorAll("[data-visualizer-measure-index]").forEach((button) => {
      button.addEventListener("click", () => {
        pageState.activeMeasure = Number(button.dataset.visualizerMeasureIndex);
        persist();
        render();
      });
    });

    visualizerColumnButtons.forEach((button) => {
      const columns = sanitizeVisualizerColumns(button.dataset.visualizerColumns, pageState.visualizerColumns);
      button.classList.toggle("is-active", columns === pageState.visualizerColumns);
    });
  };

  clearButton.addEventListener("click", () => {
    const timeline = buildTimeline();
    const activeMeasure = getActiveMeasure();
    if (activeMeasure < 0) {
      pageState.sequence = [];
    } else {
      const removable = getScopeItems(timeline, activeMeasure)
        .map((item) => item.sequenceIndex)
        .sort((left, right) => right - left);
      removable.forEach((sequenceIndex) => {
        pageState.sequence.splice(sequenceIndex, 1);
      });
    }
    persist();
    render();

    if (transport.isPlaying) {
      startPlayback();
    }
  });

  fillButton.addEventListener("click", () => {
    const fillId = beatUnitId(sharedState);
    let timeline = buildTimeline();
    while (canFit(fillId, timeline)) {
      addNoteToScope(fillId, timeline);
      timeline = buildTimeline();
    }
    persist();
    render();

    if (transport.isPlaying) {
      startPlayback();
    }
  });

  bpmInput.addEventListener("input", (event) => {
    bpmDraft = event.target.value;
    const numeric = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(numeric) || numeric < 30) {
      return;
    }

    pageState.bpm = sanitizeBpm(event.target.value, pageState.bpm);
    bpmDraft = String(pageState.bpm);
    persist();
    render();

    if (transport.isPlaying) {
      startPlayback();
    }
  });
  bpmInput.addEventListener("change", commitRhythmBpm);
  bpmInput.addEventListener("blur", commitRhythmBpm);

  patternCollapseButton?.addEventListener("click", () => {
    pageState.patternPanelCollapsed = !pageState.patternPanelCollapsed;
    persist();
    render();
  });

  patternNameToggle?.addEventListener("click", () => {
    pageState.showNoteNames = !pageState.showNoteNames;
    persist();
    render();
  });

  measureCountInput.addEventListener("input", (event) => {
    measureDraft = event.target.value;
  });
  measureCountInput.addEventListener("change", commitMeasureCount);
  measureCountInput.addEventListener("blur", commitMeasureCount);

  visualizerColumnButtons.forEach((button) => {
    button.addEventListener("click", () => {
      pageState.visualizerColumns = sanitizeVisualizerColumns(button.dataset.visualizerColumns, pageState.visualizerColumns);
      persist();
      render();
    });
  });

  playToggle.addEventListener("click", async () => {
    if (transport.isPlaying) {
      stopPlayback();
      return;
    }

    await startPlayback();
  });

  window.addEventListener("resize", render);
  render();

  return async () => {
    const nextMeterSignature = formatMeter(sharedState);
    pageState.sequence = sanitizeRhythmSequence(sharedState, pageState.sequence, pageState.measureCount);
    render();

    if (transport.isPlaying && nextMeterSignature !== transport.lastMeterSignature) {
      transport.lastMeterSignature = nextMeterSignature;
      await startPlayback();
    } else {
      transport.lastMeterSignature = nextMeterSignature;
    }
  };
}

function mountEarTrainingPage(sharedState) {
  const modeButtons = document.querySelectorAll("[data-ear-mode]");
  const playButton = document.querySelector("[data-ear-play]");
  const replayButton = document.querySelector("[data-ear-replay]");
  const statusNode = document.querySelector("[data-ear-status]");
  const melodyControls = document.querySelector("[data-melody-controls]");
  const bpmField = document.querySelector("[data-ear-bpm-field]");
  const bpmInput = document.querySelector("[data-ear-bpm]");
  const measureField = document.querySelector("[data-ear-measure-field]");
  const measureInput = document.querySelector("[data-ear-measure-count]");
  const randomRhythmCard = document.querySelector("[data-ear-random-rhythm-card]");
  const randomRhythmInput = document.querySelector("[data-ear-random-rhythm]");
  const naturalChordCard = document.querySelector("[data-ear-natural-chord-card]");
  const naturalChordInput = document.querySelector("[data-ear-natural-chord]");
  const blackKeysCard = document.querySelector("[data-ear-black-keys-card]");
  const blackKeysInput = document.querySelector("[data-ear-black-keys]");
  const rhythmOnlyCard = document.querySelector("[data-ear-rhythm-only-card]");
  const rhythmOnlyInput = document.querySelector("[data-ear-rhythm-only]");
  const minSubdivisionField = document.querySelector("[data-ear-min-subdivision-field]");
  const minSubdivisionInput = document.querySelector("[data-ear-min-subdivision]");
  const melodyHint = document.querySelector("[data-melody-hint]");
  const answerToggle = document.querySelector("[data-answer-toggle]");
  const answerBody = document.querySelector("[data-answer-body]");
  const answerTitle = document.querySelector("[data-answer-title]");
  const answerDetail = document.querySelector("[data-answer-detail]");
  const answerNotation = document.querySelector("[data-answer-notation]");
  const answerHint = document.querySelector("[data-answer-hint]");
  const summaryNode = document.querySelector("[data-ear-summary]");
  const queueNode = document.querySelector("[data-ear-queue]");
  const previewGrid = document.querySelector("[data-ear-preview]");

  if (!playButton || !answerToggle) {
    return () => {};
  }

  const pageState = loadStorage(EAR_STORAGE_KEY, DEFAULT_EAR_STATE);
  pageState.bpm = sanitizeBpm(pageState.bpm, DEFAULT_EAR_STATE.bpm);
  pageState.measureCount = sanitizeMeasureCount(pageState.measureCount, DEFAULT_EAR_STATE.measureCount);
  pageState.minSubdivision = sanitizeMinSubdivision(pageState.minSubdivision, DEFAULT_EAR_STATE.minSubdivision);
  pageState.naturalChordOnly = pageState.naturalChordOnly !== false;
  pageState.enableRandomRhythm = Boolean(pageState.enableRandomRhythm);
  pageState.enableBlackKeys = Boolean(pageState.enableBlackKeys);
  pageState.rhythmOnly = Boolean(pageState.rhythmOnly);
  let bpmDraft = String(pageState.bpm);
  let measureDraft = String(pageState.measureCount);
  const audioState = {
    audioContext: null,
    clickBuffers: null,
    hammerBuffer: null,
    masterGain: null,
    statusTimerId: 0,
    activeAudioNodes: new Set(),
  };

  const persist = () => saveStorage(EAR_STORAGE_KEY, pageState);

  const ensureAudioContext = async () => {
    if (!audioState.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioState.audioContext = new Context();
    }

    if (audioState.audioContext.state === "suspended") {
      await audioState.audioContext.resume();
    }
  };

  const ensureEarAudioChain = () => {
    if (!audioState.masterGain) {
      const compressor = audioState.audioContext.createDynamicsCompressor();
      const masterGain = audioState.audioContext.createGain();

      compressor.threshold.value = -22;
      compressor.knee.value = 20;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;

      masterGain.gain.value = 1.56;
      masterGain.connect(compressor);
      compressor.connect(audioState.audioContext.destination);
      audioState.masterGain = masterGain;
    }

    if (!audioState.hammerBuffer) {
      audioState.hammerBuffer = createNoiseBuffer(audioState.audioContext, 0.08);
    }
  };

  const trackEarAudioNode = (node) => {
    audioState.activeAudioNodes.add(node);
    node.addEventListener("ended", () => {
      audioState.activeAudioNodes.delete(node);
    }, { once: true });
    return node;
  };

  const stopScheduledAudio = () => {
    if (!audioState.audioContext) {
      return;
    }

    audioState.activeAudioNodes.forEach((node) => {
      try {
        node.stop(audioState.audioContext.currentTime);
      } catch (error) {
        // no-op: source may already be stopped
      }
    });
    audioState.activeAudioNodes.clear();
    window.clearTimeout(audioState.statusTimerId);
  };

  const scheduleTone = (absolute, startTime, duration, gain = 0.2) => {
    ensureEarAudioChain();

    const frequency = absoluteToFrequency(absolute);
    const noteGain = audioState.audioContext.createGain();
    const toneFilter = audioState.audioContext.createBiquadFilter();
    const hammerFilter = audioState.audioContext.createBiquadFilter();
    const hammerGain = audioState.audioContext.createGain();
    const hammerSource = audioState.audioContext.createBufferSource();

    toneFilter.type = "lowpass";
    toneFilter.frequency.setValueAtTime(Math.min(6200, frequency * 8), startTime);
    toneFilter.frequency.exponentialRampToValueAtTime(Math.min(2600, frequency * 4.5), startTime + duration + 0.18);
    toneFilter.Q.value = 0.7;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(gain, startTime + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(gain * 0.38, 0.0001), startTime + 0.16);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.42);

    toneFilter.connect(noteGain);
    noteGain.connect(audioState.masterGain);

    [
      { type: "triangle", multiple: 1, detune: -1.2, weight: 0.62 },
      { type: "sine", multiple: 2, detune: 0.8, weight: 0.24 },
      { type: "sine", multiple: 3, detune: -0.5, weight: 0.11 },
      { type: "sine", multiple: 4, detune: 1.3, weight: 0.05 },
    ].forEach((partial) => {
      const oscillator = audioState.audioContext.createOscillator();
      const partialGain = audioState.audioContext.createGain();

      oscillator.type = partial.type;
      oscillator.frequency.setValueAtTime(frequency * partial.multiple, startTime);
      oscillator.detune.setValueAtTime(partial.detune, startTime);
      partialGain.gain.setValueAtTime(partial.weight, startTime);
      oscillator.connect(partialGain);
      partialGain.connect(toneFilter);
      trackEarAudioNode(oscillator);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.46);
    });

    hammerFilter.type = "bandpass";
    hammerFilter.frequency.setValueAtTime(Math.min(4800, frequency * 10), startTime);
    hammerFilter.Q.value = 1.8;

    hammerGain.gain.setValueAtTime(gain * 0.36, startTime);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.055);

    hammerSource.buffer = audioState.hammerBuffer;
    hammerSource.connect(hammerFilter);
    hammerFilter.connect(hammerGain);
    hammerGain.connect(audioState.masterGain);
    trackEarAudioNode(hammerSource);
    hammerSource.start(startTime);
    hammerSource.stop(startTime + 0.06);
  };

  const playPrompt = async (prompt) => {
    await ensureAudioContext();
    stopScheduledAudio();
    const startAt = audioState.audioContext.currentTime + 0.08;
    let cursor = startAt;

    prompt.events.forEach((event) => {
      if (event.pause) {
        cursor += event.pause;
        return;
      }

      const gain = event.notes.length > 1 ? 0.14 : 0.22;
      event.notes.forEach((absolute) => {
        scheduleTone(absolute, cursor, event.duration, gain);
      });
      cursor += event.duration;
    });

    if (prompt.metronome) {
      const beatDuration = 60 / prompt.metronome.bpm;
      const leadInBeats = Math.max(0, prompt.metronome.leadInBeats || 0);

      for (let leadIndex = leadInBeats; leadIndex >= 1; leadIndex -= 1) {
        const leadBeat = (prompt.metronome.leadInBeats - leadIndex) % (prompt.metronome.beatsPerMeasure || 1);
        trackEarAudioNode(
          scheduleClickSound(
            audioState,
            leadBeat === 0,
            startAt + prompt.metronome.startOffset - leadIndex * beatDuration
          )
        );
      }

      for (let beatIndex = 0; beatIndex < prompt.metronome.beatCount; beatIndex += 1) {
        trackEarAudioNode(
          scheduleClickSound(
            audioState,
            beatIndex % (prompt.metronome.beatsPerMeasure || prompt.metronome.beatCount) === 0,
            startAt + prompt.metronome.startOffset + beatIndex * beatDuration
          )
        );
      }
      cursor = Math.max(
        cursor,
        startAt + prompt.metronome.startOffset + prompt.metronome.beatCount * beatDuration
      );
    }

    window.clearTimeout(audioState.statusTimerId);
    statusNode.textContent = "播放中";
    audioState.statusTimerId = window.setTimeout(() => {
      statusNode.textContent = "已就绪";
    }, Math.round((cursor - startAt) * 1000) + 120);
  };

  const generatePrompt = () => {
    pageState.currentPrompt = buildEarPrompt(sharedState, pageState.selectedExercise, {
      bpm: pageState.bpm,
      measureCount: pageState.measureCount,
      minSubdivision: pageState.minSubdivision,
      naturalChordOnly: pageState.naturalChordOnly,
      enableRandomRhythm: pageState.enableRandomRhythm,
      enableBlackKeys: pageState.enableBlackKeys,
      rhythmOnly: pageState.rhythmOnly,
    });
    pageState.answerVisible = false;
    persist();
  };

  const render = () => {
    if (
      !pageState.currentPrompt
      || pageState.currentPrompt.mode !== pageState.selectedExercise
      || (pageState.selectedExercise === "melody" && !pageState.currentPrompt.metadata?.notationMarkup)
    ) {
      generatePrompt();
    }

    modeButtons.forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.earMode === pageState.selectedExercise);
    });

    const prompt = pageState.currentPrompt;
    const isMelody = pageState.selectedExercise === "melody";
    const isChord = pageState.selectedExercise === "chord";
    const supportsBlackKeys = ["single", "double", "chord", "melody"].includes(pageState.selectedExercise);
    const modeText = {
      single: `单音模式：A3 之后播放 1 个目标音。黑键当前${prompt.metadata?.includeBlackKeys ? "开启" : "关闭"}。`,
      double: `双音模式：A3 之后同时播放 2 个音。黑键当前${prompt.metadata?.includeBlackKeys ? "开启" : "关闭"}。`,
      chord: prompt.metadata?.naturalChordOnly
        ? "和弦模式：A3 之后播放 1 组自然音三和弦。"
        : `和弦模式：A3 之后播放 1 组随机 3 音。黑键当前${prompt.metadata?.includeBlackKeys ? "开启" : "关闭"}。`,
      melody: prompt.metadata?.rhythmOnly
        ? `仅听节奏：${pageState.measureCount} 小节，A3 固定音 + ${pageState.bpm} BPM 节拍器 + ${formatMeter(sharedState)}。`
        : prompt.metadata?.useRandomRhythm
          ? `随机旋律：共 ${pageState.measureCount} 小节，在 C3 - B5 中随机取音，并按 ${formatMeter(sharedState)} 的随机节奏播放。`
          : `随机旋律：共 ${pageState.measureCount} 小节，在 C3 - B5 中随机取音，按均分拍播放。`,
    };

    if (melodyControls) {
      melodyControls.classList.toggle("is-hidden", false);
    }

    const subdivisionEnabled = isMelody && (pageState.enableRandomRhythm || pageState.rhythmOnly);

    if (bpmField) bpmField.classList.toggle("is-hidden", !isMelody);
    if (bpmInput) {
      const nextValue = document.activeElement === bpmInput ? bpmDraft : String(pageState.bpm);
      if (bpmInput.value !== nextValue) {
        bpmInput.value = nextValue;
      }
    }
    if (measureField) measureField.classList.toggle("is-hidden", !isMelody);
    if (measureInput) {
      const nextValue = document.activeElement === measureInput ? measureDraft : String(pageState.measureCount);
      if (measureInput.value !== nextValue) {
        measureInput.value = nextValue;
      }
    }
    if (minSubdivisionField) minSubdivisionField.classList.toggle("is-hidden", !isMelody);
    if (minSubdivisionField) minSubdivisionField.classList.toggle("is-disabled", isMelody && !subdivisionEnabled);
    if (minSubdivisionInput) minSubdivisionInput.value = pageState.minSubdivision;
    if (minSubdivisionInput) minSubdivisionInput.disabled = !subdivisionEnabled;
    if (randomRhythmCard) randomRhythmCard.classList.toggle("is-hidden", !isMelody);
    if (randomRhythmInput) randomRhythmInput.checked = pageState.enableRandomRhythm;
    if (randomRhythmInput) randomRhythmInput.disabled = Boolean(pageState.rhythmOnly);
    if (randomRhythmCard) randomRhythmCard.classList.toggle("is-disabled", Boolean(pageState.rhythmOnly));
    if (naturalChordCard) naturalChordCard.classList.toggle("is-hidden", !isChord);
    if (naturalChordInput) naturalChordInput.checked = pageState.naturalChordOnly;
    if (blackKeysCard) blackKeysCard.classList.toggle("is-hidden", !supportsBlackKeys);
    if (blackKeysInput) blackKeysInput.checked = pageState.enableBlackKeys;
    if (blackKeysInput) blackKeysInput.disabled = Boolean(isMelody && pageState.rhythmOnly);
    if (blackKeysCard) blackKeysCard.classList.toggle("is-disabled", Boolean(isMelody && pageState.rhythmOnly));
    if (rhythmOnlyCard) rhythmOnlyCard.classList.toggle("is-hidden", !isMelody);
    if (rhythmOnlyInput) rhythmOnlyInput.checked = pageState.rhythmOnly;

    if (melodyHint) {
      melodyHint.textContent = pageState.selectedExercise === "single"
        ? (pageState.enableBlackKeys
            ? "单音模式已允许出现黑键，题目会在当前调号附近加入升降音。"
            : "单音模式当前只出白键音，便于先训练基础音高。")
        : pageState.selectedExercise === "double"
          ? (pageState.enableBlackKeys
              ? "双音模式已允许出现黑键，两个音里都可能带升降号。"
              : "双音模式当前只出白键组合，先聚焦纯白键听辨。")
          : isChord
            ? (pageState.naturalChordOnly
                ? "和弦模式当前固定出自然音三和弦；即使打开黑键，这一模式里也不会加入升降音。"
                : (pageState.enableBlackKeys
                    ? "和弦模式当前出随机 3 音，并允许出现黑键。"
                    : "和弦模式当前出随机 3 音，但只使用白键。"))
          : pageState.rhythmOnly
            ? `仅听节奏开启后，会先给 1 小节预备拍，再用 A3 输出 ${pageState.measureCount} 小节随机节奏，并在底层垫上 ${pageState.bpm} BPM 的节拍器。`
            : pageState.enableRandomRhythm
              ? `随机节奏已开启：旋律会自动生成 ${pageState.measureCount} 小节；当前最小拆分是 ${formatSubdivisionLabel(pageState.minSubdivision)}；黑键开关决定是否允许出现黑键。`
              : `随机节奏关闭时，旋律会按每拍一个音的均分方式输出，共 ${pageState.measureCount} 小节；此时最小拆分不会生效；黑键开关决定旋律里是否允许出现黑键。`;
    }

    if (summaryNode) {
      summaryNode.textContent = isMelody
        ? `随机旋律支持 BPM、小节数、最小拆分、随机节奏、黑键和仅听节奏；单音 / 双音 / 和弦保持原来的听辨逻辑。`
        : pageState.selectedExercise === "chord"
          ? (pageState.naturalChordOnly
              ? `和弦模式当前按 ${formatTonic(sharedState)} 的自然音三和弦出题；答案默认隐藏。`
              : `和弦模式当前按随机 3 音出题，黑键可单独开关；答案默认隐藏。`)
          : `当前按 ${formatTonic(sharedState)} 的音高体系随机出题，单音 / 双音都支持黑键开关。`;
    }
    if (queueNode) queueNode.textContent = modeText[pageState.selectedExercise];
    answerToggle.textContent = pageState.answerVisible ? "隐藏答案" : "显示答案";
    if (answerHint) {
      answerHint.textContent = pageState.answerVisible
        ? "答案已经展开，可以带学生核对听写结果。"
        : "当前答案已隐藏，等学生听写完成后再点击显示。";
    }

    answerTitle.textContent = isMelody ? "" : prompt.answerTitle;
    answerDetail.textContent = isMelody ? "" : prompt.answerDetail;
    answerTitle.classList.toggle("is-hidden", isMelody);
    answerDetail.classList.toggle("is-hidden", isMelody);
    if (answerNotation) {
      const shouldShowNotation = isMelody && Boolean(prompt.metadata?.notationMarkup);
      answerNotation.innerHTML = shouldShowNotation ? prompt.metadata.notationMarkup : "";
      answerNotation.classList.toggle("is-hidden", !pageState.answerVisible || !shouldShowNotation);
    }
    answerBody.classList.toggle("is-hidden", !pageState.answerVisible);

    if (previewGrid) {
      previewGrid.innerHTML = prompt.preview
        .map(
          (item) => `
            <article class="degree-map-card">
              <strong>${item.label}</strong>
              <span class="degree-map-card__pitch">${item.detail}</span>
            </article>
          `
        )
        .join("");
    }
  };

  const updateMelodySetting = (patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, "bpm")) {
      bpmDraft = String(patch.bpm);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "measureCount")) {
      measureDraft = String(patch.measureCount);
    }
    Object.assign(pageState, patch);
    if (pageState.rhythmOnly) {
      pageState.enableRandomRhythm = false;
      pageState.enableBlackKeys = false;
    }
    pageState.minSubdivision = sanitizeMinSubdivision(pageState.minSubdivision, DEFAULT_EAR_STATE.minSubdivision);
    generatePrompt();
    render();
  };

  const commitEarBpm = () => {
    bpmDraft = bpmInput ? bpmInput.value : bpmDraft;
    const nextBpm = sanitizeBpm(bpmDraft, pageState.bpm);
    updateMelodySetting({ bpm: nextBpm });
  };

  const commitMeasureCount = () => {
    measureDraft = measureInput ? measureInput.value : measureDraft;
    const nextMeasureCount = sanitizeMeasureCount(measureDraft, pageState.measureCount);
    updateMelodySetting({ measureCount: nextMeasureCount });
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      pageState.selectedExercise = button.dataset.earMode;
      generatePrompt();
      persist();
      render();
    });
  });

  if (bpmInput) {
    bpmInput.addEventListener("input", (event) => {
      bpmDraft = event.target.value;
      const numeric = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(numeric) || numeric < 30) {
        return;
      }

      updateMelodySetting({
        bpm: sanitizeBpm(event.target.value, pageState.bpm),
      });
    });
    bpmInput.addEventListener("change", commitEarBpm);
    bpmInput.addEventListener("blur", commitEarBpm);
  }

  if (measureInput) {
    measureInput.addEventListener("input", (event) => {
      measureDraft = event.target.value;
      const numeric = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(numeric) || numeric < 1) {
        return;
      }

      updateMelodySetting({
        measureCount: sanitizeMeasureCount(event.target.value, pageState.measureCount),
      });
    });
    measureInput.addEventListener("change", commitMeasureCount);
    measureInput.addEventListener("blur", commitMeasureCount);
  }

  if (minSubdivisionInput) {
    minSubdivisionInput.addEventListener("change", (event) => {
      updateMelodySetting({
        minSubdivision: sanitizeMinSubdivision(event.target.value, pageState.minSubdivision),
      });
    });
  }

  if (randomRhythmInput) {
    randomRhythmInput.addEventListener("change", (event) => {
      updateMelodySetting({
        enableRandomRhythm: event.target.checked,
      });
    });
  }

  if (blackKeysInput) {
    blackKeysInput.addEventListener("change", (event) => {
      updateMelodySetting({
        enableBlackKeys: event.target.checked,
      });
    });
  }

  if (naturalChordInput) {
    naturalChordInput.addEventListener("change", (event) => {
      updateMelodySetting({
        naturalChordOnly: event.target.checked,
      });
    });
  }

  if (rhythmOnlyInput) {
    rhythmOnlyInput.addEventListener("change", (event) => {
      updateMelodySetting({
        rhythmOnly: event.target.checked,
      });
    });
  }

  playButton.addEventListener("click", async () => {
    if (!pageState.currentPrompt) {
      generatePrompt();
      render();
    }

    await playPrompt(pageState.currentPrompt);
  });

  replayButton.addEventListener("click", async () => {
    generatePrompt();
    render();

    await playPrompt(pageState.currentPrompt);
  });

  answerToggle.addEventListener("click", () => {
    pageState.answerVisible = !pageState.answerVisible;
    persist();
    render();
  });

  render();

  return () => {
    generatePrompt();
    render();
  };
}

function init() {
  document.querySelectorAll("[data-reset-defaults]").forEach((button) => {
    button.addEventListener("click", () => {
      resetAllPersistentSettings();
      window.location.reload();
    });
  });

  const page = document.body.dataset.page;
  const sharedState = loadStorage(SHARED_STORAGE_KEY, DEFAULT_SHARED_STATE);
  sharedState.numerator = sanitizeWholeNumber(sharedState.numerator, DEFAULT_SHARED_STATE.numerator);
  sharedState.denominator = sanitizeWholeNumber(sharedState.denominator, DEFAULT_SHARED_STATE.denominator);
  sharedState.tonic = normalizeTonicInput(sharedState.tonic);

  let rerenderPage = () => {};

  if (page === "mode") {
    rerenderPage = mountModePage(sharedState);
  }

  if (page === "rhythm") {
    rerenderPage = mountRhythmPage(sharedState);
  }

  if (page === "ear") {
    sharedState.tonic = "C";
    rerenderPage = mountEarTrainingPage(sharedState);
  }

  mountSharedPanel(sharedState, rerenderPage, page === "ear" ? { lockTonic: true, forcedTonic: "C" } : {});
}

init();
