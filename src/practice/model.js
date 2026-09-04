export const createPracticeState = () => ({
  playing: false,
  elapsedMs: 74_000,
  layers: { track: true, lyrics: true, hand: true },
  effects: { smoke: true, lightning: true, sound: false, reducedMotion: false },
  score: 24_680,
  streak: 12,
  multiplier: 4,
  timingMs: 18,
  feedback: "NO TEMPO · SOOU LIMPO",
  celebrating: false,
  settingsOpen: false,
  soundUnavailable: false,
  osReducedMotion: false,
});

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
        feedback: "UM POUCO TARDE",
        celebrating: multiplier > state.multiplier || state.celebrating,
      };
    }
    case "practice/miss":
      return {
        ...state,
        score: Math.max(0, state.score - 25),
        streak: 0,
        multiplier: 1,
        feedback: "AJUSTE O TEMPO",
        celebrating: false,
      };
    case "celebration/end":
      return { ...state, celebrating: false };
    default:
      return state;
  }
}
