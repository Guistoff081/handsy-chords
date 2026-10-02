import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import { LiveStatus } from "../src/components/LiveStatus.jsx";
import { useLiveInput } from "../src/audio/useLiveInput.js";

vi.mock("../src/audio/lightningSound.js", () => ({
  playLightningSound: vi.fn(() => Promise.resolve(true)),
  prepareLightningSound: vi.fn(() => Promise.resolve(true)),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function stubMicrophone({ rejectWith } = {}) {
  const track = { stop: vi.fn(), onended: null };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const getUserMedia = vi.fn(() => (rejectWith ? Promise.reject(Object.assign(new Error("x"), { name: rejectWith })) : Promise.resolve(stream)));
  const analyser = { fftSize: 0, frequencyBinCount: 8_192, smoothingTimeConstant: 0, getFloatTimeDomainData: (b) => b.fill(0), getFloatFrequencyData: (b) => b.fill(-140) };
  const close = vi.fn(() => Promise.resolve());
  class FakeAudioContext {
    sampleRate = 44_100;
    resume() { return Promise.resolve(); }
    createAnalyser() { return analyser; }
    createMediaStreamSource() { return { connect: vi.fn() }; }
    close = close;
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  return { getUserMedia, track, close, analyser };
}

describe("live input hook", () => {
  it("asks for a raw microphone, reports listening, and releases everything on disable", async () => {
    const mic = stubMicrophone();
    const onStatus = vi.fn();
    const { rerender, unmount } = renderHook(({ enabled }) => useLiveInput({ enabled, onStrum: vi.fn(), onStatus, onLevel: vi.fn() }), { initialProps: { enabled: true } });
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("listening"));
    expect(mic.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    expect(mic.analyser.fftSize).toBe(16_384);
    rerender({ enabled: false });
    expect(mic.track.stop).toHaveBeenCalled();
    expect(mic.close).toHaveBeenCalled();
    unmount();
  });

  it.each([["NotAllowedError", "denied"], ["NotFoundError", "nodevice"], ["AbortError", "error"]])("maps %s to %s", async (name, status) => {
    stubMicrophone({ rejectWith: name });
    const onStatus = vi.fn();
    renderHook(() => useLiveInput({ enabled: true, onStrum: vi.fn(), onStatus, onLevel: vi.fn() }));
    await waitFor(() => expect(onStatus).toHaveBeenLastCalledWith(status));
  });

  it("reports unsupported when the browser has no capture API", () => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    const onStatus = vi.fn();
    renderHook(() => useLiveInput({ enabled: true, onStrum: vi.fn(), onStatus, onLevel: vi.fn() }));
    expect(onStatus).toHaveBeenCalledWith("unsupported");
  });

  it("does nothing while disabled", () => {
    const mic = stubMicrophone();
    renderHook(() => useLiveInput({ enabled: false, onStrum: vi.fn(), onStatus: vi.fn(), onLevel: vi.fn() }));
    expect(mic.getUserMedia).not.toHaveBeenCalled();
  });
});

describe("live status", () => {
  const base = { enabled: true, status: "listening", level: 0.1, heard: null };

  it("renders nothing while live input is off", () => {
    const { container } = render(<LiveStatus input={{ ...base, enabled: false, status: "off" }} expectedChord="Em" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("invites the person to play, then confirms or corrects the chord they played", () => {
    const { rerender } = render(<LiveStatus input={base} expectedChord="Em" />);
    expect(screen.getByText("Ouvindo. Toque o acorde.")).toBeVisible();
    rerender(<LiveStatus input={{ ...base, heard: { chord: "Em", confidence: 0.92 } }} expectedChord="Em" />);
    expect(screen.getByText("Ouvi Em · 92%")).toBeVisible();
    expect(screen.getByText("Certo")).toBeVisible();
    rerender(<LiveStatus input={{ ...base, heard: { chord: "G", confidence: 0.8 } }} expectedChord="Em" />);
    expect(screen.getByText("Toque Em")).toBeVisible();
  });

  it("explains how to recover from a blocked microphone", () => {
    render(<LiveStatus input={{ ...base, enabled: false, status: "denied" }} expectedChord="Em" />);
    expect(screen.getByRole("status")).toHaveTextContent(/Microfone bloqueado.*permissões do site/);
  });
});

describe("live input in the app", () => {
  it("turns the microphone on from settings and shows that the app is listening", async () => {
    stubMicrophone();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: /Microfone: reconhecer o acorde/ }));
    await waitFor(() => expect(screen.getByText("Ouvindo. Toque o acorde.")).toBeVisible());
    expect(screen.getByText("TRECHO EM LOOP · AO VIVO")).toBeVisible();
  });

  it("falls back to the simulation and explains when the permission is refused", async () => {
    stubMicrophone({ rejectWith: "NotAllowedError" });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: /Microfone: reconhecer o acorde/ }));
    await waitFor(() => expect(screen.getAllByText(/Microfone bloqueado/).length).toBeGreaterThan(0));
    expect(screen.getByRole("checkbox", { name: /Microfone: reconhecer o acorde/ })).not.toBeChecked();
    expect(screen.getByText(/TRECHO EM LOOP · SIMULAÇÃO/)).toBeVisible();
  });
});
