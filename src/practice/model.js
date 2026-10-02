// Modes are presets over the independent layers; toggling a layer afterwards keeps the mode label.
export const MODE_LAYERS = {
  learn: { track: false, lyrics: true, hand: true },
  challenge: { track: true, lyrics: true, hand: false },
};

// A live session starts from zero; the demo scoreboard returns when live input is switched off.
const LIVE_START = { score: 0, streak: 0, multiplier: 1, timingMs: 0, feedback: "TOQUE O ACORDE DA PISTA", celebrating: false };

export const createPracticeState = () => ({
  playing: false,
  elapsedMs: 74_000,
  mode: "learn",
  layers: { ...MODE_LAYERS.learn },
  effects: { smoke: true, lightning: true, sound: false, reducedMotion: false },
  score: 24_680,
  streak: 12,
  multiplier: 4,
  timingMs: 18,
  feedback: "NO TEMPO · SOOU LIMPO",
  celebrating: false,
  settingsOpen: false,
  soundUnavailable: false,
  // Live capture: `enabled` is what the user asked for, `status` what the browser granted.
  input: { enabled: false, status: "off", level: 0, heard: null },
  osReducedMotion: false,
});

const demoScoreboard = () => {
  const { score, streak, multiplier, timingMs, feedback, celebrating } = createPracticeState();
  return { score, streak, multiplier, timingMs, feedback, celebrating };
};

export function multiplierForStreak(streak) {
  if (streak >= 24) return 4;
  if (streak >= 8) return 2;
  return 1;
}

export function practiceReducer(state, action) {
  switch (action.type) {
    case "playback/toggle":
      return { ...state, playing: !state.playing };
    case "clock/tick":
      return { ...state, elapsedMs: action.payload.elapsedMs ?? state.elapsedMs + action.payload.deltaMs };
    case "mode/set":
      if (!MODE_LAYERS[action.payload.mode]) return state;
      return { ...state, mode: action.payload.mode, layers: { ...MODE_LAYERS[action.payload.mode] }, celebrating: false };
    case "layer/toggle":
      return {
        ...state,
        layers: { ...state.layers, [action.payload.layer]: !state.layers[action.payload.layer] },
      };
    case "effect/toggle":
      return {
        ...state,
        effects: { ...state.effects, [action.payload.effect]: !state.effects[action.payload.effect] },
      };
    case "input/toggle": {
      const enabled = !state.input.enabled;
      return { ...state, ...(enabled ? LIVE_START : demoScoreboard()), input: { enabled, status: enabled ? "requesting" : "off", level: 0, heard: null } };
    }
    case "input/status": {
      const { status } = action.payload;
      // A refused or missing device turns live input back off so the simulation takes over again.
      const failed = ["denied", "nodevice", "unsupported", "error"].includes(status);
      const revert = failed && state.input.enabled ? demoScoreboard() : {};
      return { ...state, ...revert, input: { ...state.input, enabled: failed ? false : state.input.enabled, status } };
    }
    case "input/level":
      return { ...state, input: { ...state.input, level: action.payload.level } };
    case "input/heard":
      return { ...state, input: { ...state.input, heard: action.payload } };
    case "motion/os":
      return { ...state, osReducedMotion: action.payload.reducedMotion };
    case "sound/unavailable":
      return { ...state, soundUnavailable: true };
    case "settings/toggle":
      return { ...state, settingsOpen: !state.settingsOpen };
    case "demo/prime":
      return { ...state, score: 24_480, streak: 23, multiplier: 2, celebrating: false };
    case "practice/hit": {
      const streak = state.streak + 1;
      const multiplier = multiplierForStreak(streak);
      return {
        ...state,
        streak,
        multiplier,
        score: state.score + 100 * multiplier,
        timingMs: action.payload.timingMs,
        feedback: "NO TEMPO · SOOU LIMPO",
        celebrating: multiplier > state.multiplier || state.celebrating,
      };
    }
    case "practice/late": {
      const streak = state.streak + 1;
      const multiplier = multiplierForStreak(streak);
      return {
        ...state,
        streak,
        multiplier,
        score: state.score + 50,
        timingMs: action.payload.timingMs,
        feedback: action.payload.timingMs < 0 ? "UM POUCO CEDO" : "UM POUCO TARDE",
        celebrating: multiplier > state.multiplier || state.celebrating,
      };
    }
    case "practice/miss":
      return {
        ...state,
        score: Math.max(0, state.score - 25),
        streak: 0,
        multiplier: 1,
        feedback: action.payload?.feedback ?? "AJUSTE O TEMPO",
        celebrating: false,
      };
    case "celebration/end":
      return { ...state, celebrating: false };
    default:
      return state;
  }
}
