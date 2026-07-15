import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RadioGroup } from "./RadioGroup";

type V = "a" | "b" | "c";

function Harness({ initial = "a" as V }) {
  const [value, setValue] = useState<V>(initial);
  return (
    <RadioGroup<V>
      label="Choice"
      value={value}
      onChange={setValue}
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ]}
      renderOption={(o) => o.label}
    />
  );
}

function radios() {
  return screen.getAllByRole("radio");
}

describe("RadioGroup roving tabindex", () => {
  it("makes only the selected option a tab stop", () => {
    render(<Harness />);
    const [a, b, c] = radios();
    expect(a).toHaveAttribute("tabindex", "0");
    expect(b).toHaveAttribute("tabindex", "-1");
    expect(c).toHaveAttribute("tabindex", "-1");
    expect(a).toHaveAttribute("aria-checked", "true");
  });

  it("is reachable with a single Tab and lands on the selected option", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(radios()[0]).toHaveFocus();
  });

  it("moves selection and focus with ArrowDown/ArrowRight", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    const [a, b] = radios();
    expect(b).toHaveFocus();
    expect(b).toHaveAttribute("aria-checked", "true");
    expect(a).toHaveAttribute("aria-checked", "false");
    expect(b).toHaveAttribute("tabindex", "0");
  });

  it("wraps from last to first with ArrowDown", async () => {
    const user = userEvent.setup();
    render(<Harness initial="c" />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(radios()[0]).toHaveFocus();
    expect(radios()[0]).toHaveAttribute("aria-checked", "true");
  });

  it("moves backward with ArrowUp/ArrowLeft and supports Home/End", async () => {
    const user = userEvent.setup();
    render(<Harness initial="b" />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(radios()[0]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{End}");
    expect(radios()[2]).toHaveFocus();
    expect(radios()[2]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Home}");
    expect(radios()[0]).toHaveFocus();
  });
});
