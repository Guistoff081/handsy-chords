import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLightningSound() {
  vi.resetModules();
  return import("../src/audio/lightningSound.js");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("playLightningSound", () => {
  it("reports unavailable when Web Audio is absent", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);

    const { playLightningSound } = await loadLightningSound();

    await expect(playLightningSound()).resolves.toBe(false);
  });

  it("does not construct audio while an effect is waiting for opt-in preparation", async () => {
    const constructed = vi.fn();
    class AudioContextMock {
      constructor() { constructed(); }
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    const { playLightningSound } = await loadLightningSound();

    await expect(playLightningSound()).resolves.toBe(false);
    expect(constructed).not.toHaveBeenCalled();
  });

  it("schedules the filtered 650 ms lightning effect", async () => {
    const source = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const highPass = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
    };
    const lowPass = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    const gain = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    class AudioContextMock {
      currentTime = 4;
      sampleRate = 1_000;
      state = "running";
      destination = {};
      createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(650) }));
      createBufferSource = vi.fn(() => source);
      createBiquadFilter = vi.fn()
        .mockReturnValueOnce(highPass)
        .mockReturnValueOnce(lowPass);
      createGain = vi.fn(() => gain);
    }
    vi.stubGlobal("AudioContext", AudioContextMock);

    const { playLightningSound, prepareLightningSound } = await loadLightningSound();
    await expect(prepareLightningSound()).resolves.toBe(true);
    await expect(playLightningSound()).resolves.toBe(true);

    expect(highPass.frequency.setValueAtTime).toHaveBeenCalledWith(900, 4);
    expect(lowPass.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(700, 4.65);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 4.65);
    expect(source.stop).toHaveBeenCalledWith(4.65);
    source.onended();
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(highPass.disconnect).toHaveBeenCalledTimes(1);
    expect(lowPass.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });
});
