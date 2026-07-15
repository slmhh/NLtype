import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WpmChart } from "./WpmChart";

describe("WpmChart", () => {
  it("renders placeholder when data has fewer than 2 points", () => {
    render(<WpmChart data={[50]} />);
    expect(screen.getByText("等待更多数据...")).toBeInTheDocument();
  });

  it("renders placeholder when data is empty", () => {
    render(<WpmChart data={[]} />);
    expect(screen.getByText("等待更多数据...")).toBeInTheDocument();
  });

  it("renders SVG when data has 2+ points", () => {
    const { container } = render(<WpmChart data={[50, 60, 70]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("displays peak WPM label", () => {
    const { container } = render(<WpmChart data={[30, 50, 40]} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.some((t) => t === "50")).toBe(true);
  });

  it("displays current WPM label when currentWpm is provided", () => {
    const { container } = render(<WpmChart data={[30, 40, 50]} currentWpm={55} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts.some((t) => t?.includes("55"))).toBe(true);
  });

  it("renders with custom width and height", () => {
    const { container } = render(<WpmChart data={[10, 20]} width={400} height={200} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toContain("400");
    expect(svg?.getAttribute("viewBox")).toContain("200");
  });
});
