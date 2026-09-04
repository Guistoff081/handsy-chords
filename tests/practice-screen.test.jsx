import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App.jsx";

afterEach(cleanup);

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
