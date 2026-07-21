import { useEffect, useRef, useState } from "react";
import { type CharResult } from "../hooks/useTypingEngine";

interface TypingDisplayProps {
  chars: CharResult[];
  currentIndex: number;
  isFinished: boolean;
}

function buildLines(chars: CharResult[], currentIndex: number, isFinished: boolean, maxWidth: number, charWidth: number) {
  const charsPerLine = Math.max(20, Math.floor(maxWidth / charWidth));
  const lines: { start: number; end: number; chars: CharResult[] }[] = [];
  let start = 0;

  while (start < chars.length) {
    let end = Math.min(start + charsPerLine, chars.length);
    if (end < chars.length && chars[end]?.char !== " ") {
      let breakAt = start + charsPerLine;
      for (let i = end; i > start + 15; i--) {
        if (chars[i]?.char === " ") { breakAt = i; break; }
      }
      end = breakAt;
    }
    lines.push({ start, end: Math.min(end, chars.length), chars: chars.slice(start, Math.min(end, chars.length)) });
    start = end;
  }

  let typedLineIdx = 0;
  let typedPos = 0;
  let remaining = currentIndex;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].end - lines[i].start;
    if (remaining < len) { typedLineIdx = i; typedPos = remaining; break; }
    remaining -= len;
  }
  if (typedLineIdx < lines.length) {
    typedPos = Math.min(isFinished ? lines[typedLineIdx].chars.length : typedPos, lines[typedLineIdx].chars.length - 1);
    if (typedPos < 0) typedPos = 0;
  }

  return { lines, typedLineIdx, typedPos };
}

export function TypingDisplay({ chars, currentIndex, isFinished }: TypingDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [charWidth, setCharWidth] = useState(15.6);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setWidth(w);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const cs = getComputedStyle(el);
      ctx.font = cs.fontSize + " " + cs.fontFamily;
      setCharWidth(ctx.measureText("a").width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { lines, typedLineIdx, typedPos } = buildLines(chars, currentIndex, isFinished, width, charWidth);

  return (
    <div ref={containerRef} className="font-mono text-xl leading-relaxed select-none">
      {lines.map((line, li) => {
        const isCurrentLine = li === typedLineIdx && !isFinished;
        const lineStart = line.start;
        const localPos = li === typedLineIdx ? typedPos : line.chars.length;

        return (
          <div key={li} className="mb-1 last:mb-0">
            {/* Expected text line */}
            <div className="whitespace-pre-wrap break-all">
              {line.chars.map((c, i) => {
                const globalI = lineStart + i;
                if (globalI < currentIndex || isFinished) {
                  return <span key={i} className="text-[var(--text-tertiary)]">{c.char}</span>;
                }
                if (globalI === currentIndex && isCurrentLine) {
                  return (
                    <span key={i} className="relative">
                      <span className="invisible">{c.char}</span>
                      <span className="absolute inset-0 flex items-center justify-center text-[var(--bg-card)] bg-[var(--char-cursor)] rounded-sm">
                        {c.char}
                      </span>
                    </span>
                  );
                }
                return <span key={i} className="text-[var(--text-secondary)]">{c.char}</span>;
              })}
            </div>

            {/* Typed text line */}
            <div className="whitespace-pre-wrap break-all min-h-[1.2em]">
              {Array.from({ length: isFinished ? line.chars.length : localPos }, (_, i) => {
                const c = line.chars[i];
                const match = c.typed === c.char;
                return (
                  <span key={i} className={`transition-colors duration-75 ${
                    match ? "text-[var(--accent-green)]" : "text-[var(--char-incorrect)] bg-[var(--char-incorrect)]/10 underline decoration-wavy"
                  }`}>
                    {c.typed === " " ? "\u00B7" : c.typed}
                  </span>
                );
              })}
              {isCurrentLine && (
                <span className="inline-block w-[2px] h-[1.2em] bg-[var(--char-cursor)] animate-pulse align-text-bottom ml-[1px]" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
