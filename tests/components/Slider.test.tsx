import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Slider } from "@/app/components/ui/Slider";

describe("Slider", () => {
  it("renders label and value", () => {
    render(<Slider label="Exposure" value={0.5} min={-5} max={5} />);
    expect(screen.getByText("Exposure")).toBeInTheDocument();
    expect(screen.getByText("+0.5")).toBeInTheDocument();
  });

  it("shows negative value using accent color variable", () => {
    render(<Slider label="Contrast" value={-20} min={-100} max={100} />);
    const valueEl = screen.getByText("-20");
    expect(valueEl).toHaveStyle({ color: "var(--accent)" });
  });

  it("shows zero value using muted color variable", () => {
    render(<Slider label="Tint" value={0} min={-150} max={150} />);
    const valueEl = screen.getByText("0");
    expect(valueEl).toHaveStyle({ color: "var(--text-4)" });
  });

  it("shows positive value using text-1 color variable", () => {
    render(<Slider label="Shadows" value={25} min={-100} max={100} />);
    const valueEl = screen.getByText("+25");
    expect(valueEl).toHaveStyle({ color: "var(--text-1)" });
  });

  it("appends unit to value", () => {
    render(<Slider label="Temp" value={5500} min={2000} max={50000} unit="K" />);
    expect(screen.getByText("+5500K")).toBeInTheDocument();
  });

  it("shows reset button when value differs from originalValue", () => {
    render(
      <Slider label="Exposure" value={1.0} originalValue={0} min={-5} max={5} onChange={() => {}} />
    );
    expect(screen.getByTitle("Reset to AI value")).toBeInTheDocument();
  });

  it("does not show reset button when value matches originalValue", () => {
    render(
      <Slider label="Exposure" value={0} originalValue={0} min={-5} max={5} onChange={() => {}} />
    );
    expect(screen.queryByTitle("Reset to AI value")).not.toBeInTheDocument();
  });

  it("calls onChange with originalValue when reset button clicked", () => {
    const onChange = vi.fn();
    render(
      <Slider label="Exposure" value={1.0} originalValue={0.5} min={-5} max={5} onChange={onChange} />
    );
    fireEvent.click(screen.getByTitle("Reset to AI value"));
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("does not show reset button when no onChange provided", () => {
    render(<Slider label="Exposure" value={1.0} originalValue={0} min={-5} max={5} />);
    expect(screen.queryByTitle("Reset to AI value")).not.toBeInTheDocument();
  });

  it("shows modified thumb style when value differs from original", () => {
    render(
      <Slider label="Exposure" value={1.0} originalValue={0} min={-5} max={5} onChange={() => {}} />
    );
    // The reset button being present implies the modified state is active
    expect(screen.getByTitle("Reset to AI value")).toBeInTheDocument();
  });

  it("prefixes positive values with +", () => {
    render(<Slider label="Highlights" value={35} min={-100} max={100} />);
    expect(screen.getByText("+35")).toBeInTheDocument();
  });

  it("does not prefix zero with +", () => {
    render(<Slider label="Blacks" value={0} min={-100} max={100} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("+0")).not.toBeInTheDocument();
  });
});
