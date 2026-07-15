import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("calls the correct callback when a key is pressed", () => {
    const fn = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: fn }, true));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not call callback when key does not match", () => {
    const fn = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: fn }, true));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not call callback when disabled", () => {
    const fn = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: fn }, false));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(fn).not.toHaveBeenCalled();
  });

  it("does not call callback when event target is an input", () => {
    const fn = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: fn }, true));

    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input, writable: false });
    window.dispatchEvent(event);
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the latest callback after re-render", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const { rerender } = renderHook(
      ({ shortcuts, enabled }) => useKeyboardShortcuts(shortcuts, enabled),
      { initialProps: { shortcuts: { Escape: fn1 }, enabled: true } },
    );

    rerender({ shortcuts: { Escape: fn2 }, enabled: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
