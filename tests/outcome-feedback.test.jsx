import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import { createPracticeState, practiceReducer } from "../src/practice/model.js";
import { playOutcomeSound } from "../src/audio/outcomeSounds.js";
import { prepareLightningSound } from "../src/audio/lightningSound.js";

vi.mock("../src/audio/lightningSound.js", () => ({
  playLightningSound: vi.fn(() => Promise.resolve(true)),
  prepareLightningSound: vi.fn(() => Promise.resolve(true)),
  runningAudioContext: vi.fn(() => null),
}));
vi.mock("../src/audio/outcomeSounds.js", () => ({ playOutcomeSound: vi.fn(() => true) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("outcome state", () => {
  it("gives every verdict a new id and a kind", () => {
    let state = createPracticeState();
    expect(state.outcome).toEqual({ id: 0, kind: null });
    state = practiceReducer(state, { type: "practice/hit", payload: { timingMs: 10 } });
    expect(state.outcome).toEqual({ id: 1, kind: "hit" });
    state = practiceReducer(state, { type: "practice/late", payload: { timingMs: 200 } });
    expect(state.outcome).toEqual({ id: 2, kind: "late" });
    state = practiceReducer(state, { type: "practice/miss", payload: { feedback: "FALTOU O Em" } });
    expect(state.outcome).toEqual({ id: 3, kind: "miss" });
    state = practiceReducer(state, { type: "practice/miss", payload: { feedback: "OUVI G · TOQUE Em" } });
    expect(state.outcome).toEqual({ id: 4, kind: "wrong" });
  });

  it("starts with the verdict sounds off", () => {
    expect(createPracticeState().effects).toMatchObject({ outcomeSound: false, boo: false });
  });
});

describe("outcome sounds in the app", () => {
  async function inChallenge(user) {
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Desafio" }));
  }

  it("plays nothing until the person turns the sounds on, then unlocks audio on that click", async () => {
    const user = userEvent.setup();
    await inChallenge(user);
    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));
    expect(playOutcomeSound).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: "Sons de acerto e erro" }));
    expect(prepareLightningSound).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));
    expect(playOutcomeSound).toHaveBeenCalledWith("hit", { boo: false });
  });

  it("passes the boo preference along and unlocks audio for it as well", async () => {
    const user = userEvent.setup();
    await inChallenge(user);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: "Sons de acerto e erro" }));
    await user.click(screen.getByRole("checkbox", { name: "Vaia nos erros" }));
    prepareLightningSound.mockClear();
    await user.click(screen.getByRole("checkbox", { name: "Vaia nos erros" }));
    await user.click(screen.getByRole("checkbox", { name: "Vaia nos erros" }));
    expect(prepareLightningSound).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));
    expect(playOutcomeSound).toHaveBeenLastCalledWith("hit", { boo: true });
  });

  it("stays quiet in Aprendizado, where no verdict is on screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /configurações/i }));
    await user.click(screen.getByRole("checkbox", { name: "Sons de acerto e erro" }));
    await user.click(screen.getByRole("button", { name: "Reproduzir" }));
    expect(playOutcomeSound).not.toHaveBeenCalled();
  });
});
