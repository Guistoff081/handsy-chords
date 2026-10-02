import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import { HandCoach } from "../src/components/HandCoach.jsx";
import { drawHand } from "../src/vision/drawHand.js";
import { HAND_MODEL_URL, useHandTracking, VISION_WASM_URL } from "../src/vision/useHandTracking.js";
import { createPracticeState, practiceReducer } from "../src/practice/model.js";
import { makeHand } from "./helpers/hand.js";

const mp = vi.hoisted(() => ({ result: { landmarks: [], worldLandmarks: [], handedness: [] }, close: vi.fn(), create: vi.fn(), resolve: vi.fn() }));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: (...args) => mp.resolve(...args) },
  HandLandmarker: { createFromOptions: (...args) => mp.create(...args) },
}));
vi.mock("../src/audio/lightningSound.js", () => ({
  playLightningSound: vi.fn(() => Promise.resolve(true)),
  prepareLightningSound: vi.fn(() => Promise.resolve(true)),
}));

const landmarksFor = () => Array.from({ length: 21 }, (_, i) => ({ x: 0.2 + i * 0.02, y: 0.3 + i * 0.01, z: 0 }));
const handResult = (bent) => ({ landmarks: [landmarksFor()], worldLandmarks: [makeHand({ bent })], handedness: [[{ score: 0.97 }]] });

let frames;
let clock;

beforeEach(() => {
  frames = new Map();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (handle) => frames.delete(handle));
  clock = 1_000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  mp.result = { landmarks: [], worldLandmarks: [], handedness: [] };
  mp.close = vi.fn();
  mp.resolve = vi.fn(() => Promise.resolve({ fileset: true }));
  mp.create = vi.fn(() => Promise.resolve({ detectForVideo: () => mp.result, close: mp.close }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function stubCamera({ rejectWith } = {}) {
  const track = { stop: vi.fn(), onended: null };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const getUserMedia = vi.fn(() => (rejectWith ? Promise.reject(Object.assign(new Error("x"), { name: rejectWith })) : Promise.resolve(stream)));
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  return { getUserMedia, track, stream };
}

function recordingCanvas() {
  const fills = []; const strokes = [];
  const context = {
    clearRect: vi.fn(), beginPath() {}, moveTo() {}, lineTo() {}, arc() {},
    fill() { fills.push(this.fillStyle); }, stroke() { strokes.push(this.strokeStyle); },
  };
  return { width: 1280, height: 720, getContext: () => context, context, fills, strokes };
}

const nextFrame = (video) => { video.currentTime += 0.033; act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((cb) => cb()); }); };

function setup(props = {}) {
  const video = { srcObject: null, play: vi.fn(() => Promise.resolve()), readyState: 4, currentTime: 0, videoWidth: 1280, videoHeight: 720 };
  const overlay = recordingCanvas();
  const onStatus = vi.fn(); const onHand = vi.fn();
  const hook = renderHook((p) => useHandTracking({ enabled: true, videoRef: { current: video }, overlayRef: { current: overlay }, expectedFingers: [2, 3], onStatus, onHand, ...p }), { initialProps: props });
  return { video, overlay, onStatus, onHand, ...hook };
}

describe("hand tracking hook", () => {
  it("opens the camera, loads the model from its CDN, and reports requesting, loading, ready", async () => {
    const cam = stubCamera();
    const { onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(["requesting", "loading", "ready"]);
    expect(cam.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
    expect(mp.resolve).toHaveBeenCalledWith(VISION_WASM_URL);
    expect(mp.create).toHaveBeenCalledWith({ fileset: true }, { baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" }, runningMode: "VIDEO", numHands: 1 });
  });

  it("attaches the stream to the video and reports which fingers are pressing", async () => {
    const cam = stubCamera();
    const { video, overlay, onHand, onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    mp.result = handResult([2, 3]);
    nextFrame(video);
    expect(video.srcObject).toBe(cam.stream);
    expect(video.play).toHaveBeenCalled();
    expect(onHand).toHaveBeenCalledWith({ present: true, score: 0.97, pressed: [2, 3] });
    expect(overlay.context.clearRect).toHaveBeenCalled();
  });

  it("reports when the hand leaves the picture and throttles unchanged readings", async () => {
    stubCamera();
    const { video, onHand, onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    mp.result = handResult([2, 3]);
    nextFrame(video);
    nextFrame(video);
    expect(onHand).toHaveBeenCalledTimes(1);
    clock += 200;
    mp.result = { landmarks: [], worldLandmarks: [], handedness: [] };
    nextFrame(video);
    expect(onHand).toHaveBeenLastCalledWith({ present: false, score: 0, pressed: [] });
  });

  it("skips frames the video has not advanced", async () => {
    stubCamera();
    const { video, onHand, onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    mp.result = handResult([2]);
    nextFrame(video);
    clock += 200;
    mp.result = handResult([2, 3]);
    act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((cb) => cb()); });
    expect(onHand).toHaveBeenCalledTimes(1);
  });

  it("releases the camera, the model and the animation loop when disabled", async () => {
    const cam = stubCamera();
    const { video, rerender, onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    video.srcObject = cam.stream;
    rerender({ enabled: false });
    expect(cam.track.stop).toHaveBeenCalled();
    expect(mp.close).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(frames.size).toBe(0);
  });

  it.each([["NotAllowedError", "denied"], ["NotFoundError", "nodevice"], ["AbortError", "error"]])("maps %s to %s", async (name, status) => {
    stubCamera({ rejectWith: name });
    const { onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith(status));
    expect(mp.create).not.toHaveBeenCalled();
  });

  it("turns the camera off again and reports an error when the model cannot be loaded", async () => {
    const cam = stubCamera();
    mp.create = vi.fn(() => Promise.reject(new Error("offline")));
    const { onStatus } = setup();
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith("error"));
    expect(cam.track.stop).toHaveBeenCalled();
  });

  it("reports unsupported without a capture API and does nothing while disabled", () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    const { onStatus } = setup();
    expect(onStatus).toHaveBeenCalledWith("unsupported");
    const cam = stubCamera();
    setup({ enabled: false });
    expect(cam.getUserMedia).not.toHaveBeenCalled();
  });
});

describe("hand tracking with the coach engine", () => {
  const snapshotOf = (calibrated) => ({ calibrated, calibration: { status: calibrated ? "ready" : "none", progress: 0, message: "" }, fingers: [], summary: "" });
  const fakeEngine = (calibrated = false) => ({ process: vi.fn(), draw: vi.fn(), snapshot: vi.fn(() => snapshotOf(calibrated)) });

  it("hands the engine the fingertips in pixels, every frame, and merges its snapshot into the report", async () => {
    stubCamera();
    const engine = fakeEngine();
    const { video, onHand, onStatus } = setup({ engine });
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    mp.result = handResult([2, 3]);
    nextFrame(video);
    const frameArg = engine.process.mock.calls[0][0];
    expect(frameArg).toMatchObject({ present: true, pressed: [2, 3], size: { width: 1280, height: 720 } });
    expect(frameArg.angles[2]).toBeCloseTo(95, 0);
    expect(frameArg.angles[1]).toBeCloseTo(180, 0);
    const lm = mp.result.landmarks[0];
    expect(frameArg.tips[2]).toEqual({ x: lm[12].x * 1280, y: lm[12].y * 720 });
    expect(frameArg.tips[4]).toEqual({ x: lm[20].x * 1280, y: lm[20].y * 720 });
    expect(onHand).toHaveBeenCalledWith(expect.objectContaining({ present: true, pressed: [2, 3], calibrated: false, calibration: { status: "none", progress: 0, message: "" } }));
    nextFrame(video);
    expect(engine.process).toHaveBeenCalledTimes(2);
    expect(engine.draw).toHaveBeenCalledTimes(2);
  });

  it("still tells the engine when no hand is visible", async () => {
    stubCamera();
    const engine = fakeEngine();
    const { video, onStatus } = setup({ engine });
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("ready"));
    nextFrame(video);
    expect(engine.process).toHaveBeenCalledWith({ present: false, pressed: [], tips: {}, size: { width: 1280, height: 720 } });
  });

  it("drops the generic fingertip marks once the neck is calibrated, leaving the engine's cell rings", async () => {
    stubCamera();
    mp.result = handResult([2, 3]);
    const plain = setup({ engine: fakeEngine(false) });
    await waitFor(() => expect(plain.onStatus).toHaveBeenCalledWith("ready"));
    nextFrame(plain.video);
    const markedFills = plain.overlay.fills.filter((c) => c === "#38d6e8").length;
    cleanup();
    stubCamera();
    const calibrated = setup({ engine: fakeEngine(true) });
    await waitFor(() => expect(calibrated.onStatus).toHaveBeenCalledWith("ready"));
    nextFrame(calibrated.video);
    expect(markedFills).toBeGreaterThan(0);
    expect(calibrated.overlay.fills.filter((c) => c === "#38d6e8")).toHaveLength(0);
  });
});

describe("hand overlay", () => {
  it("marks needed fingers that press in cyan, needed ones that do not in magenta, and surplus ones in amber", () => {
    const canvas = recordingCanvas();
    drawHand(canvas, landmarksFor(), { pressed: [2, 3, 4], expected: [1, 2, 3] });
    expect(canvas.fills.filter((c) => c === "#38d6e8")).toHaveLength(2);
    expect(canvas.strokes).toContain("#e24a8d");
    expect(canvas.strokes).toContain("#f4b942");
  });

  it("only clears the canvas when no hand is visible", () => {
    const canvas = recordingCanvas();
    drawHand(canvas, undefined, { pressed: [], expected: [2, 3] });
    expect(canvas.context.clearRect).toHaveBeenCalledWith(0, 0, 1280, 720);
    expect(canvas.fills).toHaveLength(0);
  });
});

describe("calibration controls in the coach", () => {
  const base = { enabled: true, status: "ready", present: true, score: 0.9, pressed: [2, 3], calibrated: false, calibration: { status: "none", progress: 0, message: "" }, fingers: [], summary: "" };

  it("invites the person to calibrate with a G, and starts when asked", async () => {
    const user = userEvent.setup();
    const onCalibrate = vi.fn();
    render(<HandCoach chord="Em" camera={base} onCalibrate={onCalibrate} />);
    expect(screen.getByText(/calibre o braço/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Calibrar braço" }));
    expect(onCalibrate).toHaveBeenCalledTimes(1);
  });

  it("cannot calibrate until a hand is in view", () => {
    render(<HandCoach chord="Em" camera={{ ...base, present: false }} onCalibrate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Calibrar braço" })).toBeDisabled();
  });

  it("shows progress while reading and lets the person cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<HandCoach chord="Em" camera={{ ...base, calibration: { status: "collecting", progress: 0.5, message: "" } }} onCalibrate={vi.fn()} onCancelCalibration={onCancel} />);
    expect(screen.getByRole("progressbar", { name: "Leitura do braço" })).toHaveValue(50);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("explains a failed reading and offers another try", () => {
    render(<HandCoach chord="Em" camera={{ ...base, calibration: { status: "failed", progress: 0, message: "Gire o violão para o braço ficar de frente para a câmera e tente de novo." } }} onCalibrate={vi.fn()} />);
    expect(screen.getByText(/Gire o violão/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });

  it("lists what each finger is doing once calibrated, and leads with the first problem", () => {
    const fingers = [
      { finger: 2, status: "ok", message: "Dedo 2 · corda A, casa 2", target: { string: 1, fret: 2 } },
      { finger: 3, status: "wrong-string", message: "Dedo 3 · está em G2. Leve para a corda D (mais grave)", target: { string: 2, fret: 2 } },
    ];
    render(<HandCoach chord="Em" camera={{ ...base, calibrated: true, calibration: { status: "ready", progress: 1, message: "" }, fingers, summary: "DEDO 3 · ESTÁ EM G2. LEVE PARA A CORDA D (MAIS GRAVE)" }} onCalibrate={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Conferência por dedo" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(list.querySelector('li[data-status="ok"]')).toHaveTextContent("Dedo 2 · corda A, casa 2");
    expect(screen.getByText("DEDO 3 · ESTÁ EM G2. LEVE PARA A CORDA D (MAIS GRAVE)")).toHaveAttribute("data-tone", "fix");
    expect(screen.getByRole("button", { name: "Recalibrar" })).toBeVisible();
  });

  it("marks the summary as right when every finger is on its cell", () => {
    const fingers = [{ finger: 2, status: "ok", message: "Dedo 2 · corda A, casa 2", target: { string: 1, fret: 2 } }];
    render(<HandCoach chord="Em" camera={{ ...base, calibrated: true, calibration: { status: "ready", progress: 1, message: "" }, fingers, summary: "CASAS E CORDAS CERTAS" }} onCalibrate={vi.fn()} />);
    expect(screen.getByText("CASAS E CORDAS CERTAS")).toHaveAttribute("data-tone", "ok");
  });

  it("falls back to the bent-finger check before calibration", () => {
    render(<HandCoach chord="Em" camera={{ ...base, pressed: [2] }} onCalibrate={vi.fn()} />);
    expect(screen.getByText("FALTA O DEDO 3")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Conferência por dedo" })).toBeNull();
  });
});

describe("camera state", () => {
  it("asks for the camera, stores the tracked hand, and falls back to the photo on refusal", () => {
    const asked = practiceReducer(createPracticeState(), { type: "camera/toggle" });
    expect(asked.camera).toMatchObject({ enabled: true, status: "requesting" });
    const ready = practiceReducer(asked, { type: "camera/status", payload: { status: "ready" } });
    const seen = practiceReducer(ready, { type: "camera/hand", payload: { present: true, score: 0.9, pressed: [2, 3] } });
    expect(seen.camera).toMatchObject({ enabled: true, status: "ready", present: true, pressed: [2, 3] });
    const denied = practiceReducer(asked, { type: "camera/status", payload: { status: "denied" } });
    expect(denied.camera).toMatchObject({ enabled: false, status: "denied" });
    expect(practiceReducer(seen, { type: "camera/toggle" }).camera).toMatchObject({ enabled: false, present: false, pressed: [] });
  });
});

describe("hand coach with the live camera", () => {
  const ready = { enabled: true, status: "ready", present: true, score: 0.9, pressed: [2, 3] };

  it("shows the live feed, hides the simulated observation, and confirms the right fingers", () => {
    render(<HandCoach chord="Em" camera={ready} />);
    expect(screen.getByLabelText(/Imagem ao vivo da câmera/)).toBeInTheDocument();
    expect(screen.getByText("Câmera ao vivo · sua mão")).toBeVisible();
    expect(screen.getByText("DEDOS CERTOS · 2 E 3 FIRMES")).toHaveAttribute("data-tone", "ok");
    expect(screen.queryByText("AGORA")).toBeNull();
    expect(screen.queryByRole("img", { name: /câmera simulada/i })).toBeNull();
  });

  it("says which finger to fix, for the chord currently on the song", () => {
    const { rerender } = render(<HandCoach chord="Em" camera={{ ...ready, pressed: [2] }} />);
    expect(screen.getByText("FALTA O DEDO 3")).toHaveAttribute("data-tone", "fix");
    rerender(<HandCoach chord="G" camera={{ ...ready, pressed: [2, 3] }} />);
    expect(screen.getByText("FALTA O DEDO 1")).toBeVisible();
  });

  it("asks to show the hand, and says when the model is still loading", () => {
    const { rerender } = render(<HandCoach chord="Em" camera={{ ...ready, present: false, pressed: [] }} />);
    expect(screen.getByText("MOSTRE A MÃO DO BRAÇO À CÂMERA")).toBeVisible();
    rerender(<HandCoach chord="Em" camera={{ ...ready, status: "loading" }} />);
    expect(screen.getByText("CARREGANDO O MODELO DA MÃO…")).toBeVisible();
    expect(screen.getByText("Câmera ao vivo · iniciando")).toBeVisible();
  });

  it("keeps the simulated photo and static correction while the camera is off", () => {
    render(<HandCoach chord="Em" />);
    expect(screen.getByText("DEDO 3 · MAIS PERTO DO TRASTE")).toBeVisible();
    expect(screen.getByText("Câmera simulada · posição observada")).toBeVisible();
  });
});

describe("camera in the app", () => {
  it("turns the camera on from settings and shows the live feed with real hand detection", async () => {
    stubCamera();
    mp.result = handResult([2, 3]);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: /Câmera: acompanhar os dedos/ }));
    await waitFor(() => expect(screen.getByText("Câmera ao vivo · sua mão")).toBeVisible());
    const video = screen.getByLabelText(/Imagem ao vivo da câmera/);
    Object.defineProperty(video, "readyState", { value: 4, configurable: true });
    video.currentTime = 1;
    act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((cb) => cb()); });
    await waitFor(() => expect(screen.getByText("DEDOS CERTOS · 2 E 3 FIRMES")).toBeVisible());
    expect(screen.getByText("Mão 97%")).toBeVisible();
  });

  it("explains a blocked camera and keeps the simulated photo", async () => {
    stubCamera({ rejectWith: "NotAllowedError" });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: /Câmera: acompanhar os dedos/ }));
    await waitFor(() => expect(screen.getByText(/Câmera bloqueada/)).toBeVisible());
    expect(screen.getByRole("checkbox", { name: /Câmera: acompanhar os dedos/ })).not.toBeChecked();
    expect(screen.getByText("Câmera simulada · posição observada")).toBeVisible();
  });
});
