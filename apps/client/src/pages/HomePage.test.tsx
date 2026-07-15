import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn() }),
}));

vi.mock("../context/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "home.subtitle": "Typing Practice",
        "home.categoryTimed": "Timed",
        "home.categoryPassage": "Passage",
        "home.zenMode": "∞ Zen Mode",
        "home.quoteMode": "Random Quote",
        "home.language": "Language",
        "home.start": "Press Enter to Start",
        "home.footerTimed": "timed",
        "home.footerPassage": "passage",
        "mode.time": "Timed",
        "mode.zen": "Zen",
        "mode.words": "Words",
        "mode.quote": "Quote",
        "lang.en": "EN",
        "lang.zh": "ZH",
        "lang.code": "Code",
        "general.seconds": "s",
        "general.words": "w",
        "general.quote": "quote",
      };
      return dict[key] ?? key;
    },
  }),
}));

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders title and subtitle", () => {
    renderHomePage();
    expect(screen.getByText("NLType")).toBeTruthy();
    expect(screen.getByText("Typing Practice")).toBeTruthy();
  });

  it("shows both category buttons", () => {
    renderHomePage();
    const timed = screen.getAllByText("Timed");
    expect(timed.length).toBe(2); // category toggle + mode tab
    expect(screen.getByText("Passage")).toBeTruthy();
  });

  it("shows timed modes by default", () => {
    renderHomePage();
    const timed = screen.getAllByText("Timed");
    expect(timed.length).toBe(2);
    expect(screen.getByText("Zen")).toBeTruthy();
  });

  it("switches to passage modes on category click", async () => {
    renderHomePage();
    fireEvent.click(screen.getByText("Passage"));
    await waitFor(() => {
      expect(screen.getByText("Words")).toBeTruthy();
      expect(screen.getByText("Quote")).toBeTruthy();
    });
  });

  it("shows time options in timed mode", () => {
    renderHomePage();
    expect(screen.getByText("15s")).toBeTruthy();
    expect(screen.getByText("30s")).toBeTruthy();
    expect(screen.getByText("60s")).toBeTruthy();
    expect(screen.getByText("120s")).toBeTruthy();
  });

  it("shows word count options in words mode", () => {
    renderHomePage();
    fireEvent.click(screen.getByText("Passage"));
    fireEvent.click(screen.getByText("Words"));
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("shows language selector", () => {
    renderHomePage();
    expect(screen.getByText("EN")).toBeTruthy();
    expect(screen.getByText("ZH")).toBeTruthy();
    expect(screen.getByText("Code")).toBeTruthy();
  });

  it("renders start button", () => {
    renderHomePage();
    expect(screen.getByText("Press Enter to Start")).toBeTruthy();
  });

  it("navigates to /game on start button click", () => {
    renderHomePage();
    fireEvent.click(screen.getByText("Press Enter to Start"));
    expect(mockNavigate).toHaveBeenCalledWith("/game", expect.any(Object));
  });

  it("navigates to /game on Enter key", () => {
    renderHomePage();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/game", expect.any(Object));
  });
});
