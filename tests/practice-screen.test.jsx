import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";

vi.mock("../src/audio/lightningSound.js", () => ({
  playLightningSound: vi.fn(() => Promise.resolve(true)),
  prepareLightningSound: vi.fn(() => Promise.resolve(true)),
}));
import { playLightningSound, prepareLightningSound } from "../src/audio/lightningSound.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("practice screen", () => {
  it("starts paused and toggles playback", async () => {
    const user = userEvent.setup();
    render(<App />);

    const play = screen.getByRole("button", { name: "Reproduzir" });
    await user.click(play);

    expect(screen.getByRole("button", { name: "Pausar" })).toBeVisible();
  });

  it("toggles lyrics without removing the other guidance", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Letra" }));

    expect(screen.queryByText("Come as you are, as you were")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mão" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens settings and toggles reduced motion", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Configurações" }));
    await user.click(screen.getByRole("checkbox", { name: "Reduzir movimento" }));

    expect(screen.getByRole("checkbox", { name: "Reduzir movimento" })).toBeChecked();
  });

  it("exposes the independent effect settings with sound disabled", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Configurações" }));

    expect(screen.getByRole("checkbox", { name: "Fumaça" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Efeito elétrico" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Som elétrico" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Reduzir movimento" })).not.toBeChecked();
  });

  it("runs the score demonstration without enabling sound automatically", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));

    expect(screen.getByText(/24 ACERTOS/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Configurações" }));
    expect(screen.getByRole("checkbox", { name: "Som elétrico" })).not.toBeChecked();
    expect(playLightningSound).not.toHaveBeenCalled();
  });

  it("keeps sound opt-in independent from the visual lightning setting", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Configurações" }));
    await user.click(screen.getByRole("checkbox", { name: "Efeito elétrico" }));
    await user.click(screen.getByRole("checkbox", { name: "Som elétrico" }));
    expect(prepareLightningSound).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));

    await waitFor(() => expect(playLightningSound).toHaveBeenCalledTimes(1));
  });

  it("shows an audio availability message without stopping the score demonstration", async () => {
    vi.mocked(playLightningSound).mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Configurações" }));
    await user.click(screen.getByRole("checkbox", { name: "Som elétrico" }));
    await user.click(screen.getByRole("button", { name: "Demonstrar multiplicador" }));

    expect(await screen.findByText("Som indisponível")).toBeVisible();
    expect(screen.getByText(/24 ACERTOS/)).toBeVisible();
  });

  it("keeps the hand coach synchronized with the active G cue during playback", () => {
    vi.useFakeTimers();
    let animationFrame;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    act(() => animationFrame(0));
    for (let timestamp = 250; timestamp <= 4_000; timestamp += 250) {
      act(() => animationFrame(timestamp));
    }

    expect(screen.getByRole("region", { name: "Posição alvo de G" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "G" })).toBeVisible();
  });

  it("toggles playback with Space outside interactive controls", () => {
    render(<App />);

    fireEvent.keyDown(window, { code: "Space" });

    expect(screen.getByRole("button", { name: "Pausar" })).toBeVisible();
  });

  it("ignores repeated Space presses and Space on buttons", () => {
    render(<App />);
    const play = screen.getByRole("button", { name: "Reproduzir" });

    fireEvent.keyDown(window, { code: "Space", repeat: true });
    fireEvent.keyDown(play, { code: "Space" });

    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  });

  it("ignores Space from editable content", () => {
    render(<App />);
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "plaintext-only");
    document.body.append(editable);

    fireEvent.keyDown(editable, { code: "Space" });
    editable.remove();

    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  });
});
