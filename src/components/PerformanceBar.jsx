import { Gear, Pause, Play } from "@phosphor-icons/react";

function formatTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PerformanceBar({ elapsedMs, onSettings, onTogglePlayback, playing, song }) {
  const progress = Math.min((elapsedMs / song.durationMs) * 100, 100);

  return (
    <header className="performance-bar">
      <div className="song-details">
        <p>{song.section}</p>
        <h1>{song.title}</h1>
        <p>{song.bpm} BPM</p>
      </div>
      <div className="playback-progress">
        <span>{formatTime(elapsedMs)}</span>
        <progress aria-label="Progresso da música" max="100" value={progress} />
        <span>{formatTime(song.durationMs)}</span>
      </div>
      <div className="performance-actions">
        <button
          type="button"
          className="playback-toggle"
          aria-label={playing ? "Pausar" : "Reproduzir"}
          onClick={onTogglePlayback}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{playing ? "PAUSAR" : "REPRODUZIR"}</span>
        </button>
        <button type="button" className="settings-toggle" aria-label="Configurações" onClick={onSettings}>
          <Gear aria-hidden="true" />
          <span>CONFIGURAÇÕES</span>
        </button>
      </div>
    </header>
  );
}
