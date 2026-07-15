import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TypingDisplay } from "./TypingDisplay";
import type { CharResult } from "../hooks/useTypingEngine";

beforeEach(() => {
  const mockCtx = { font: "", measureText: () => ({ width: 15.6 }) };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D);
});

function makeChars(text: string, typed: string): CharResult[] {
  return text.split("").map((ch, i) => ({
    char: ch,
    typed: typed[i] || "",
    status: typed[i] === undefined ? "pending" : ch === typed[i] ? "correct" : "incorrect",
  }));
}

describe("TypingDisplay", () => {
  it("renders expected characters", () => {
    const chars = makeChars("hello world", "");
    const { container } = render(<TypingDisplay chars={chars} currentIndex={0} isFinished={false} />);
    const spans = container.querySelectorAll("span");
    const textContents = Array.from(spans).map((s) => s.textContent).filter(Boolean);
    expect(textContents).toContain("h");
  });

  it("shows typed characters", () => {
    const chars = makeChars("hello", "he");
    const { container } = render(<TypingDisplay chars={chars} currentIndex={2} isFinished={false} />);
    const spans = container.querySelectorAll("span");
    const textContents = Array.from(spans).map((s) => s.textContent).filter(Boolean);
    expect(textContents).toContain("h");
    expect(textContents).toContain("e");
  });

  it("renders cursor when not finished", () => {
    const chars = makeChars("hello", "hel");
    const { container } = render(<TypingDisplay chars={chars} currentIndex={3} isFinished={false} />);
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("does not render cursor when finished", () => {
    const chars = makeChars("hello", "hello");
    const { container } = render(<TypingDisplay chars={chars} currentIndex={5} isFinished={true} />);
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).not.toBeInTheDocument();
  });

  it("handles empty chars array", () => {
    const { container } = render(<TypingDisplay chars={[]} currentIndex={0} isFinished={false} />);
    expect(container.textContent).toBe("");
  });
});
