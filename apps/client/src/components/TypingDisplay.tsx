import { useCallback, useEffect, useRef, useState } from "react";
import { type CharResult } from "../hooks/useTypingEngine";

interface TypingDisplayProps {
  chars: CharResult[];
  currentIndex: number;
  isFinished: boolean;
}

/** Split chars into lines at word boundaries based on container width */
function buildLines(
  chars: CharResult[],
  currentIndex: number,
  isFinished: boolean,
  maxWidth: number,
  charWidth: number
) {
  const charsPerLine = Math.max(20, Math.floor(maxWidth / charWidth));
  const lines: { start: number; end: number; chars: CharResult[] }[] = [];
  let start = 0;

  while (start < chars.length) {
    let end = Math.min(start + charsPerLine, chars.length);

    // Try to break at a space (word boundary), but don't break shorter than 15
    if (end < chars.length && chars[end]?.char !== " ") {
      let breakAt = start + charsPerLine;
      for (let i = end; i > start + 15; i--) {
        if (chars[i]?.char === " ") {
          breakAt = i;
          break;
        }
      }
      end = breakAt;
    }

    lines.push({
      start,
      end: Math.min(end, chars.length),
      chars: chars.slice(start, Math.min(end, chars.length)),
    });
    start = end;
  }

  // Compute "typed end" line index and position within that line
  let typedLineIdx = 0;
  let typedPos = 0;
  let remaining = currentIndex;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].end - lines[i].start;
    if (remaining < len) {
      typedLineIdx = i;
      typedPos = remaining;
      break;
    }
    remaining -= len;
  }
  // Clamp typedPos to line length (handles isFinished edge case)
  if (typedLineIdx < lines.length) {
    typedPos = Math.min(isFinished ? lines[typedLineIdx].chars.length : typedPos, lines[typedLineIdx].chars.length - 1);
    if (typedPos < 0) typedPos = 0;
  }

  return { lines, typedLineIdx, typedPos };
}

export function TypingDisplay({ chars, currentIndex, isFinished }: TypingDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [charWidth, setCharWidth] = useState(9.6);
  const [width, setWidth] = useState(700);

  // Measure character width and container width on mount + resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setWidth(w);
      // Measure "a" width with monospace font
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      ctx.font = '18px "JetBrains Mono", "Fira Code", monospace';
      setCharWidth(ctx.measureText("a").width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { lines, typedLineIdx, typedPos } = buildLines(
    chars,
    currentIndex,
    isFinished,
    width,
    charWidth
  );

  return (
    <div ref={containerRef} className="font-mono text-lg leading-relaxed">
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
                  return (
                    <span key={i} className="text-text-muted/30">{c.char}</span>
                  );
                }
                if (globalI === currentIndex && isCurrentLine) {
                  return (
                    <span key={i} className="text-accent border-b-2 border-accent bg-accent/15">
                      {c.char}
                    </span>
                  );
                }
                return (
                  <span key={i} className="text-text-muted">{c.char}</span>
                );
              })}
            </div>

            {/* Typed text line 鈥?only for current line or completed lines */}
            <div className="whitespace-pre-wrap break-all min-h-[1.2em]">
              {Array.from({ length: isFinished ? line.chars.length : localPos }, (_, i) => {
                const c = line.chars[i];
                const match = c.typed === c.char;
                return (
                  <span
                    key={i}
                    className={
                      match
                        ? "text-accent-green"
                        : "text-accent-red bg-accent-red/10 underline decoration-wavy"
                    }
                  >
                    {c.typed === " " ? "\u00B7" : c.typed}
                  </span>
                );
              })}
              {isCurrentLine && (
                <span className="inline-block w-[2px] h-[1.2em] bg-accent animate-pulse align-text-bottom" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

