// Turns detected strums into hit / late / miss against the song's chord events.
// Works on an unwrapped clock (the excerpt loops), so loop k of an event sits at atMs + k * duration.

export const HIT_WINDOW_MS = 150;
export const LATE_WINDOW_MS = 400;
// A strum is named about 350 ms after its attack; an event may only be called missed after that has had time to arrive.
export const DECISION_LAG_MS = 450;
export const CLOSE_AFTER_MS = LATE_WINDOW_MS + DECISION_LAG_MS;

export function createEvaluator(song) {
  const { startMs, endMs } = song.excerpt;
  const duration = endMs - startMs;
  const chordEvents = song.events.filter((event) => event.kind === "chord");
  const resolved = new Set();
  let since = -Infinity;

  const key = (loop, index) => `${loop}:${index}`;
  const occurrenceTime = (loop, event) => event.atMs + loop * duration;

  function* occurrencesNear(timeMs, reach) {
    const firstLoop = Math.floor((timeMs - reach - startMs) / duration);
    const lastLoop = Math.floor((timeMs + reach - startMs) / duration);
    for (let loop = firstLoop; loop <= lastLoop; loop += 1) {
      for (let index = 0; index < chordEvents.length; index += 1) {
        const at = occurrenceTime(loop, chordEvents[index]);
        if (at >= since && Math.abs(at - timeMs) <= reach && !resolved.has(key(loop, index))) {
          yield { loop, index, at, event: chordEvents[index] };
        }
      }
    }
  }

  return {
    /** A strum was heard at unwrapped song time `timeMs`. Returns the verdict or null for a free strum. */
    strum({ timeMs, chord }) {
      let nearest = null;
      for (const candidate of occurrencesNear(timeMs, LATE_WINDOW_MS)) {
        if (!nearest || Math.abs(candidate.at - timeMs) < Math.abs(nearest.at - timeMs)) nearest = candidate;
      }
      if (!nearest) return null;
      resolved.add(key(nearest.loop, nearest.index));
      const timingMs = Math.round(timeMs - nearest.at);
      const expected = nearest.event.chord;
      if (chord !== expected) return { kind: "wrong", expected, heard: chord, timingMs };
      return { kind: Math.abs(timingMs) <= HIT_WINDOW_MS ? "hit" : "late", expected, heard: chord, timingMs };
    },

    /** Events whose window (plus the decision lag) closed with no strum become misses. */
    advance(timeMs) {
      const misses = [];
      for (const candidate of occurrencesNear(timeMs - CLOSE_AFTER_MS, LATE_WINDOW_MS)) {
        if (candidate.at + CLOSE_AFTER_MS < timeMs) {
          resolved.add(key(candidate.loop, candidate.index));
          misses.push({ kind: "miss", expected: candidate.event.chord, heard: null, timingMs: 0 });
        }
      }
      return misses;
    },

    /** Forgets earlier verdicts and ignores events that were already behind `timeMs`. */
    reset(timeMs = -Infinity) {
      resolved.clear();
      since = timeMs;
    },
  };
}
