import { useEffect, useRef } from "react";
import { drawHand } from "./drawHand.js";
import { pressedFingers } from "./handMetrics.js";

// Runtime assets for MediaPipe Hand Landmarker (WASM runtime and the ~8 MB model). Frames never leave the browser.
export const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
export const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const REPORT_EVERY_MS = 100;

function failureStatus(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "denied";
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") return "nodevice";
  return "error";
}

/**
 * Opens the camera while `enabled`, tracks one hand with MediaPipe and reports which fingers are bent.
 * The video and overlay elements are owned by the caller; the library is only loaded when first needed.
 */
export function useHandTracking({ enabled, videoRef, overlayRef, expectedFingers = [], onStatus, onHand }) {
  const latest = useRef({});
  latest.current = { onStatus, onHand, expectedFingers };

  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.mediaDevices?.getUserMedia || (typeof window.isSecureContext === "boolean" && !window.isSecureContext)) {
      latest.current.onStatus?.("unsupported");
      return undefined;
    }

    let cancelled = false;
    let stream;
    let landmarker;
    let frame;
    let lastVideoTime = -1;
    let lastReport = 0;
    let lastKey = "";

    function release() {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close?.();
      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    function track() {
      frame = requestAnimationFrame(track);
      const video = videoRef.current;
      if (!video || !landmarker) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        Promise.resolve(video.play?.()).catch(() => {});
      }
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const result = landmarker.detectForVideo(video, performance.now());
      const landmarks = result.landmarks?.[0];
      const world = result.worldLandmarks?.[0];
      const pressed = landmarks && world ? pressedFingers(world) : [];
      const canvas = overlayRef?.current;
      if (canvas && video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (canvas) drawHand(canvas, landmarks, { pressed, expected: latest.current.expectedFingers });

      const present = Boolean(landmarks);
      const score = present ? Math.round((result.handedness?.[0]?.[0]?.score ?? 0) * 100) / 100 : 0;
      const key = `${present}:${pressed.join(",")}:${score}`;
      const now = performance.now();
      if (key !== lastKey && now - lastReport >= REPORT_EVERY_MS) {
        lastKey = key;
        lastReport = now;
        latest.current.onHand?.({ present, score, pressed });
      }
    }

    async function start() {
      latest.current.onStatus?.("requesting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
      } catch (error) {
        if (!cancelled) latest.current.onStatus?.(failureStatus(error));
        return;
      }
      if (cancelled) { release(); return; }
      latest.current.onStatus?.("loading");
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
        landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        if (!cancelled) latest.current.onStatus?.("error");
        release();
        return;
      }
      if (cancelled) { release(); return; }
      stream.getVideoTracks().forEach((videoTrack) => { videoTrack.onended = () => latest.current.onStatus?.("error"); });
      latest.current.onStatus?.("ready");
      frame = requestAnimationFrame(track);
    }

    start();
    return () => {
      cancelled = true;
      release();
    };
  }, [enabled, videoRef, overlayRef]);
}
