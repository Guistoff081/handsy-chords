import { useEffect } from "react";
import { playLightningSound } from "./audio/lightningSound.js";
import { DEMO_SONG } from "./data/demoSong.js";
import { NoteHighway } from "./canvas/NoteHighway.jsx";
import { StageAtmosphere } from "./canvas/StageAtmosphere.jsx";
import { HandCoach } from "./components/HandCoach.jsx";
import { LayerControls } from "./components/LayerControls.jsx";
import { LyricsLayer } from "./components/LyricsLayer.jsx";
import { NextChordPanel } from "./components/NextChordPanel.jsx";
import { PerformanceBar } from "./components/PerformanceBar.jsx";
import { ScoreHud } from "./components/ScoreHud.jsx";
import { SettingsPopover } from "./components/SettingsPopover.jsx";
import { usePracticeSession } from "./practice/usePracticeSession.js";

function isInteractiveOrEditable(target) {
  return target instanceof Element && Boolean(
    target.closest(
      "button, input, select, textarea, [contenteditable], [role='button'], [role='checkbox'], [role='link'], [role='switch'], [role='textbox']",
    ),
  );
}

export function App() {
  const { state, dispatch, triggerScoreDemo } = usePracticeSession();
  const reducedMotion = state.effects.reducedMotion || state.osReducedMotion;
  const cueIndex = DEMO_SONG.lyrics.reduce(
    (activeIndex, candidate, index) => (candidate.atMs <= state.elapsedMs ? index : activeIndex),
    0,
  );
  const cue = DEMO_SONG.lyrics[cueIndex];
  const nextCue = DEMO_SONG.lyrics[(cueIndex + 1) % DEMO_SONG.lyrics.length];

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        (event.code !== "Space" && event.key !== " ")
        || event.repeat
        || isInteractiveOrEditable(event.target)
      ) return;

      event.preventDefault();
      dispatch({ type: "playback/toggle" });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!state.effects.sound || !state.celebrating) return;
    let active = true;
    playLightningSound().then((played) => {
      if (active && !played) dispatch({ type: "sound/unavailable" });
    });
    return () => { active = false; };
  }, [dispatch, state.celebrating, state.effects.sound]);

  return (
    <main className="practice-screen">
      <PerformanceBar
        elapsedMs={state.elapsedMs}
        playing={state.playing}
        song={DEMO_SONG}
        onTogglePlayback={() => dispatch({ type: "playback/toggle" })}
        onSettings={() => dispatch({ type: "settings/toggle" })}
      />

      <section className="practice-stage" aria-label="Sessão de prática">
        <StageAtmosphere smoke={state.effects.smoke} playing={state.playing} reducedMotion={reducedMotion} />
        <LayerControls
          layers={state.layers}
          onToggle={(layer) => dispatch({ type: "layer/toggle", payload: { layer } })}
        />
        <ScoreHud multiplier={state.multiplier} score={state.score} streak={state.streak} />
        {state.layers.lyrics && <LyricsLayer cue={cue} />}
        <p className="simulation-label">{DEMO_SONG.excerpt.label}</p>
        <NoteHighway
          events={DEMO_SONG.events}
          elapsedMs={state.elapsedMs}
          playing={state.playing}
          visible={state.layers.track}
          reducedMotion={reducedMotion}
          celebrating={state.celebrating}
          lightning={state.effects.lightning}
        />
        {state.layers.hand && <HandCoach chord={cue.chord} />}
        <NextChordPanel cue={cue} nextCue={nextCue} />
        <button type="button" onClick={triggerScoreDemo}>Demonstrar multiplicador</button>
        <div className="practice-feedback" role="status" aria-live="polite">{state.feedback}</div>
      </section>

      {state.settingsOpen && (
        <SettingsPopover
          effects={state.effects}
          onToggle={(effect) => dispatch({ type: "effect/toggle", payload: { effect } })}
          soundUnavailable={state.soundUnavailable}
        />
      )}
    </main>
  );
}

export default App;
