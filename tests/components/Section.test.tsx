import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Section } from "@/app/components/ui/Section";

describe("Section", () => {
  it("renders title and children when open", () => {
    render(
      <Section title="Light" icon="◐">
        <div>Slider content</div>
      </Section>
    );
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Slider content")).toBeInTheDocument();
  });

  it("renders children in DOM even when collapsed (height-based hide)", () => {
    render(
      <Section title="Light" icon="◐" defaultOpen={false}>
        <div>Slider content</div>
      </Section>
    );
    // Children are always rendered — just hidden via height: 0
    expect(screen.getByText("Slider content")).toBeInTheDocument();
  });

  it("toggles open state on header click", () => {
    render(
      <Section title="Color" icon="◍">
        <div>Color content</div>
      </Section>
    );
    // Starts open — content in DOM
    expect(screen.getByText("Color content")).toBeInTheDocument();
    // Click to close — content stays in DOM (animated out)
    fireEvent.click(screen.getByText("Color"));
    expect(screen.getByText("Color content")).toBeInTheDocument();
    // Click to reopen — content still in DOM
    fireEvent.click(screen.getByText("Color"));
    expect(screen.getByText("Color content")).toBeInTheDocument();
  });

  it("renders icon", () => {
    render(
      <Section title="Detail" icon="◫">
        <div>content</div>
      </Section>
    );
    expect(screen.getByText("◫")).toBeInTheDocument();
  });
});
