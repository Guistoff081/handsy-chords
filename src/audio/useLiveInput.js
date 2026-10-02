import { useEffect, useRef } from "react";
import { createStrumListener, FFT_SIZE } from "./strumListener.js";

const TICK_MS = 25;

function failureStatus(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "denied";
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") return "nodevice";
  return "error";
}

/** Opens the microphone while `enabled` and reports strums, level and status. Never connects audio to the speakers. */
export function useLiveInput({ enabled, onStrum, onStatus, onLevel, vocabulary }) {
  const callbacks = useRef({});
  callbacks.current = { onStrum, onStatus, onLevel, vocabulary };

  useEffect(() => {
    if (!enabled) return undefined;
    const { onStatus: report } = callbacks.current;
    if (!navigator.mediaDevices?.getUserMedia || (typeof window.isSecureContext === "boolean" && !window.isSecureContext)) {
      report?.("unsupported");
      return undefined;
    }

    let cancelled = false;
    let stream;
    let context;
    let timer;

    async function start() {
      report?.("requesting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (error) {
        if (!cancelled) callbacks.current.onStatus?.(failureStatus(error));
        return;
      }
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
      try {
        const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
        context = new AudioContextClass();
        await context.resume?.();
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0;
        context.createMediaStreamSource(stream).connect(analyser);
        stream.getAudioTracks().forEach((track) => { track.onended = () => callbacks.current.onStatus?.("error"); });
        const listener = createStrumListener({
          analyser,
          sampleRate: context.sampleRate,
          now: () => performance.now(),
          onStrum: (strum) => callbacks.current.onStrum?.(strum),
          onLevel: (level) => callbacks.current.onLevel?.(level),
          vocabulary: callbacks.current.vocabulary,
        });
        timer = window.setInterval(() => listener.tick(), TICK_MS);
        callbacks.current.onStatus?.("listening");
      } catch {
        callbacks.current.onStatus?.("error");
      }
    }

    start();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      context?.close?.().catch(() => {});
    };
  }, [enabled]);
}
