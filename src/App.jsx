import { useEffect, useReducer } from "react";
import { DEMO_SONG } from "./data/demoSong.js";
import { LayerControls } from "./components/LayerControls.jsx";
import { LyricsLayer } from "./components/LyricsLayer.jsx";
import { NextChordPanel } from "./components/NextChordPanel.jsx";
import { PerformanceBar } from "./components/PerformanceBar.jsx";
import { ScoreHud } from "./components/ScoreHud.jsx";
import { SettingsPopover } from "./components/SettingsPopover.jsx";
import { createPracticeState, practiceReducer } from "./practice/model.js";

function isInteractiveOrEditable(target) {
  return target instanceof Element && Boolean(
    target.closest(
      "button, input, select, textarea, [contenteditable], [role='button'], [role='checkbox'], [role='link'], [role='switch'], [role='textbox']",
    ),
  );
}

export function App() {
  const [state, dispatch] = useReducer(practiceReducer, undefined, createPracticeState);
  const [cue, nextCue] = DEMO_SONG.lyrics;

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
        <LayerControls
          layers={state.layers}
          onToggle={(layer) => dispatch({ type: "layer/toggle", payload: { layer } })}
        />
        <ScoreHud multiplier={state.multiplier} score={state.score} streak={state.streak} />
        {state.layers.lyrics && <LyricsLayer cue={cue} />}
        {state.layers.track && <p className="track-guidance">Trilha de notas ativa</p>}
        {state.layers.hand && <p className="hand-guidance">Orientação de mão ativa</p>}
        <NextChordPanel cue={cue} nextCue={nextCue} />
        <div className="practice-feedback" role="status" aria-live="polite">{state.feedback}</div>
      </section>

      {state.settingsOpen && (
        <SettingsPopover
          effects={state.effects}
          onToggle={(effect) => dispatch({ type: "effect/toggle", payload: { effect } })}
        />
      )}
    </main>
  );
}

export default App;
