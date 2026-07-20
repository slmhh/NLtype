import { useCallback, useEffect, useRef, useState } from "react";

export interface CharResult {
  char: string;       // The expected character
  typed: string;      // What the user actually typed
  status: "pending" | "correct" | "incorrect";
}

export interface TypingEvent {
  charIndex: number;
  expectedChar: string;
  typedChar: string;
  latencyMs: number;
  elapsedMs: number;
}

export interface TypingState {
  chars: CharResult[];
  currentIndex: number;
  correctCount: number;
  incorrectCount: number;
  wpm: number;
  cpm: number;
  accuracy: number;
  rawWpm: number;
  elapsedMs: number;
  isFinished: boolean;
  wpmHistory: number[];
  events: TypingEvent[];
}

interface UseTypingEngineOptions {
  text: string;
  language: "en" | "zh" | "code";
  isActive: boolean;
  onFinish: () => void;
}

function initState(text: string): TypingState {
  return {
    chars: text.split("").map((c) => ({ char: c, typed: "", status: "pending" as const })),
    currentIndex: 0,
    correctCount: 0,
    incorrectCount: 0,
    wpm: 0,
    cpm: 0,
    accuracy: 100,
    rawWpm: 0,
    elapsedMs: 0,
    isFinished: false,
    wpmHistory: [],
    events: [],
  };
}

function calcWPM(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.round((chars / 5) / (elapsedMs / 60000));
}

function calcCPM(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.round(chars / (elapsedMs / 60000));
}

export function useTypingEngine({
  text,
  language,
  isActive,
  onFinish,
}: UseTypingEngineOptions) {
  const [state, setState] = useState<TypingState>(() => initState(text));
  const stateRef = useRef(state);
  stateRef.current = state;
  const langRef = useRef(language);
  langRef.current = language;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const isComposingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const lastKeyTimeRef = useRef<number | null>(null);
  const hasChineseRef = useRef(false);
  hasChineseRef.current = language === "zh" || /[\u4e00-\u9fff]/.test(text);

  const getElapsed = useCallback(() => {
    return startTimeRef.current === null ? 0 : Date.now() - startTimeRef.current;
  }, []);

  const deriveStats = useCallback(
    (correct: number, incorrect: number, elapsed: number) => {
      const total = correct + incorrect;
      const wpm = calcWPM(correct, elapsed);
      const cpm = calcCPM(correct, elapsed);
      const rawWpm = calcWPM(total, elapsed);
      const accuracy = total > 0 ? Math.round((correct / total) * 10000) / 100 : 100;
      return { wpm, cpm, rawWpm, accuracy };
    },
    []
  );

  /** Always advance one position; stores both expected and typed char */
  const advance = useCallback(
    (charTyped: string, expected: string) => {
      const now = Date.now();
      const keyLatency = lastKeyTimeRef.current === null ? 0 : now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;
      setState((prev) => {
        if (prev.isFinished) return prev;
        const isCorrect = charTyped === expected;
        const idx = prev.currentIndex;
        const newChars = prev.chars.map((c, i) =>
          i === idx
            ? {
                ...c,
                typed: charTyped,
                status: (isCorrect ? "correct" : "incorrect" as "correct" | "incorrect"),
              }
            : c
        );
        const nxt = idx + 1;
        const finished = nxt >= prev.chars.length;
        const elapsed = getElapsed();
        const newCorrect = prev.correctCount + (isCorrect ? 1 : 0);
        const newIncorrect = prev.incorrectCount + (isCorrect ? 0 : 1);
        const stats = deriveStats(newCorrect, newIncorrect, elapsed);
        const event: TypingEvent = {
          charIndex: idx,
          expectedChar: expected,
          typedChar: charTyped,
          latencyMs: keyLatency,
          elapsedMs: elapsed,
        };
        return {
          ...prev,
          chars: newChars,
          currentIndex: finished ? idx : nxt,
          correctCount: newCorrect,
          incorrectCount: newIncorrect,
          elapsedMs: elapsed,
          ...stats,
          wpmHistory: [...prev.wpmHistory, stats.wpm],
          isFinished: finished,
          events: [...prev.events, event],
        };
      });
    },
    [getElapsed, deriveStats]
  );

  useEffect(() => {
    if (!isActive) return;
    setState(initState(text));
    startTimeRef.current = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComposingRef.current || e.isComposing) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const cur = stateRef.current;
      if (cur.isFinished) return;

      if (startTimeRef.current === null) startTimeRef.current = Date.now();

      // Backspace �?only move index back, reset the character
      if (e.key === "Backspace") {
        e.preventDefault();
        if (cur.currentIndex <= 0) return;
        const idx = cur.currentIndex - 1;
        setState((prev) => ({
          ...prev,
          chars: prev.chars.map((c, i) =>
            i === idx ? { char: c.char, typed: "", status: "pending" as const } : c
          ),
          currentIndex: idx,
        }));
        return;
      }

      // English mode �?any printable char advances. Space is no longer special.
      if ((langRef.current === "en" || langRef.current === "code") && (e.key.length === 1 || e.key === "Enter")) {
        e.preventDefault();
        const expected = cur.chars[cur.currentIndex]?.char;
        if (expected) {
          advance(e.key === "Enter" ? "\n" : e.key, expected);
        }
      }
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
      if (startTimeRef.current === null) startTimeRef.current = Date.now();
    };

    const handleCompositionEnd = (e: CompositionEvent) => {
      isComposingRef.current = false;
      if (langRef.current !== "zh" || !hasChineseRef.current) return;
      const cur = stateRef.current;
      if (cur.isFinished) return;
      if (startTimeRef.current === null) startTimeRef.current = Date.now();
      const composed = e.data;
      if (!composed) return;
      // Pre-compute expected chars to avoid stale ref in loop
      const baseIdx = cur.currentIndex;
      for (let i = 0; i < composed.length; i++) {
        const idx = baseIdx + i;
        if (idx >= cur.chars.length) break;
        const expected = cur.chars[idx]?.char;
        if (expected !== undefined) advance(composed[i], expected);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("compositionstart", handleCompositionStart);
    window.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("compositionstart", handleCompositionStart);
      window.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [isActive, text, advance, getElapsed, deriveStats]);

  // Live stats tick
  useEffect(() => {
    if (!isActive || state.isFinished) return;
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.isFinished) return prev;
        const elapsed = getElapsed();
        const stats = deriveStats(prev.correctCount, prev.incorrectCount, elapsed);
        return { ...prev, elapsedMs: elapsed, ...stats, wpmHistory: [...prev.wpmHistory, stats.wpm] };
      });
    }, 250);
    return () => clearInterval(id);
  }, [isActive, state.isFinished, getElapsed, deriveStats]);

  useEffect(() => {
    if (state.isFinished && isActive) onFinishRef.current();
  }, [state.isFinished, isActive]);


  const reset = useCallback((newText: string) => {
    setState(initState(newText));
    startTimeRef.current = null;
    isComposingRef.current = false;
  }, []);

  return { state, reset };
}


