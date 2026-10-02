import { useEffect, useRef, useState } from "react";
import { CaretUp, Hand } from "@phosphor-icons/react";
import { playLightningSound, prepareLightningSound } from "./audio/lightningSound.js";
import { useLiveInput } from "./audio/useLiveInput.js";
import { DEMO_SONG } from "./data/demoSong.js";
import { NoteHighway } from "./canvas/NoteHighway.jsx";
import { StageAtmosphere } from "./canvas/StageAtmosphere.jsx";
import { HandCoach } from "./components/HandCoach.jsx";
import { LayerControls } from "./components/LayerControls.jsx";
import { LiveStatus } from "./components/LiveStatus.jsx";
import { LyricsLayer } from "./components/LyricsLayer.jsx";
import { ModeSwitch } from "./components/ModeSwitch.jsx";
import { NextChordPanel } from "./components/NextChordPanel.jsx";
import { PerformanceBar } from "./components/PerformanceBar.jsx";
import { ScoreHud } from "./components/ScoreHud.jsx";
import { SettingsPopover } from "./components/SettingsPopover.jsx";
import { usePracticeSession } from "./practice/usePracticeSession.js";
import { getChord } from "./data/chords.js";
import { fingersForChord } from "./vision/handMetrics.js";
import { useHandTracking } from "./vision/useHandTracking.js";

function isInteractiveOrEditable(target) {
  return target instanceof Element && Boolean(
    target.closest(
      "button, input, select, textarea, [contenteditable], [role='button'], [role='checkbox'], [role='link'], [role='switch'], [role='textbox']",
    ),
  );
}

// The chords of the song: the live detector chooses among these instead of all 24 triads.
const SONG_CHORDS = [...new Set(DEMO_SONG.events.filter((event) => event.kind === "chord").map((event) => event.chord))];

const isMissFeedback = (feedback) => feedback === "AJUSTE O TEMPO" || feedback.startsWith("OUVI ") || feedback.startsWith("FALTOU ");

export function App() {
  const { state, dispatch, triggerScoreDemo, handleStrum } = usePracticeSession();
  useLiveInput({
    enabled: state.input.enabled,
    onStrum: handleStrum,
    onStatus: (status) => dispatch({ type: "input/status", payload: { status } }),
    onLevel: (level) => dispatch({ type: "input/level", payload: { level } }),
    vocabulary: SONG_CHORDS,
  });
  const live = state.input.enabled && state.input.status === "listening";
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const reducedMotion = state.effects.reducedMotion || state.osReducedMotion;
  const cueIndex = DEMO_SONG.lyrics.reduce(
    (activeIndex, candidate, index) => (candidate.atMs <= state.elapsedMs ? index : activeIndex),
    0,
  );
  const cue = DEMO_SONG.lyrics[cueIndex];
  // The camera only runs while the coach card (which holds the video) is on screen.
  const cameraOn = state.camera.enabled && state.layers.hand;
  const cameraLive = cameraOn && state.camera.status === "ready";
  useHandTracking({
    enabled: cameraOn,
    videoRef,
    overlayRef,
    expectedFingers: fingersForChord(getChord(cue.chord)),
    onStatus: (status) => dispatch({ type: "camera/status", payload: { status } }),
    onHand: (hand) => dispatch({ type: "camera/hand", payload: hand }),
  });
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
    if (!state.effects.sound || !state.celebrating || !state.layers.track) return;
    let active = true;
    playLightningSound().then((played) => {
      if (active && !played) dispatch({ type: "sound/unavailable" });
    });
    return () => { active = false; };
  }, [dispatch, state.celebrating, state.effects.sound, state.layers.track]);

  function toggleEffect(effect) {
    if (effect === "sound" && !state.effects.sound) {
      prepareLightningSound().then((prepared) => {
        if (!prepared) dispatch({ type: "sound/unavailable" });
      });
    }
    dispatch({ type: "effect/toggle", payload: { effect } });
  }

  return (
    <main className="practice-shell practice-screen" data-playing={state.playing} data-reduced-motion={reducedMotion} data-hand={state.layers.hand} data-track={state.layers.track} data-mode={state.mode}>
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
        <ModeSwitch mode={state.mode} onChange={(mode) => dispatch({ type: "mode/set", payload: { mode } })} />
        {state.layers.track && (
          <ScoreHud multiplier={state.multiplier} score={state.score} streak={state.streak} onDemonstrate={triggerScoreDemo} celebrating={state.celebrating} />
        )}
        {state.layers.lyrics && <LyricsLayer cue={cue} />}
        <LiveStatus input={state.input} expectedChord={cue.chord} />
        <p className="simulation-label">{live ? "TRECHO EM LOOP · AO VIVO" : DEMO_SONG.excerpt.label}</p>
        {state.layers.track && (
          <NoteHighway
            events={DEMO_SONG.events}
            elapsedMs={state.elapsedMs}
            playing={state.playing}
            visible
            reducedMotion={reducedMotion}
            celebrating={state.celebrating}
            lightning={state.effects.lightning}
          />
        )}
        {state.layers.hand && (
          <div className="coach-drawer" data-open={coachOpen}>
            <button
              className="coach-drawer-toggle"
              type="button"
              aria-label="Orientação de mão"
              aria-expanded={coachOpen}
              aria-controls="hand-coach-drawer"
              onClick={() => setCoachOpen((open) => !open)}
            >
              <Hand aria-hidden="true" />
              <span>Orientação de mão</span>
              <CaretUp aria-hidden="true" />
            </button>
            <div className="coach-drawer-content" id="hand-coach-drawer" data-open={coachOpen}>
              <HandCoach chord={cue.chord} camera={cameraOn ? state.camera : undefined} videoRef={videoRef} overlayRef={overlayRef} />
            </div>
          </div>
        )}
        <NextChordPanel
          cue={cue}
          nextCue={nextCue}
          audioLabel={live && state.input.heard ? `Áudio ${Math.round(state.input.heard.confidence * 100)}%` : undefined}
          handLabel={cameraLive ? (state.camera.present ? `Mão ${Math.round(state.camera.score * 100)}%` : "Mão —") : undefined}
        />
        {(state.layers.track || live) && (
          <div className="practice-feedback" data-result={isMissFeedback(state.feedback) ? "miss" : state.feedback === "UM POUCO TARDE" || state.feedback === "UM POUCO CEDO" ? "late" : "success"} role="status" aria-live="polite">
            <span>{state.feedback}</span>
            {!isMissFeedback(state.feedback) && <small>{state.timingMs > 0 ? "+" : ""}{state.timingMs} ms</small>}
          </div>
        )}
        <p className="landscape-hint">Use a tela principal em modo paisagem para a experiência completa.</p>
      </section>

      {state.settingsOpen && (
        <SettingsPopover
          effects={state.effects}
          onToggle={toggleEffect}
          soundUnavailable={state.soundUnavailable}
          input={state.input}
          onToggleInput={() => dispatch({ type: "input/toggle" })}
          camera={state.camera}
          onToggleCamera={() => dispatch({ type: "camera/toggle" })}
        />
      )}
    </main>
  );
}

export default App;
