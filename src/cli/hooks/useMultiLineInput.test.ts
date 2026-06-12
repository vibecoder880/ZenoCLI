import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useMultiLineInput } from "./useMultiLineInput.js";

// Capture the useInput handler from inside a child component
// to avoid depending on @testing-library/react.
let capturedHandler: ((input: string, key: Record<string, boolean | string>) => void) | null = null;
let lastValue: string = "";

function Harness({ onSubmit, disabled, onValueChange }: { onSubmit: (value: string) => void; disabled?: boolean; onValueChange?: (v: string) => void }) {
  const input = useMultiLineInput({ onSubmit, disabled });
  lastValue = input.value;
  onValueChange?.(input.value);
  return React.createElement(Text, null, input.value);
}

function setup(onSubmit: (value: string) => void, disabled = false) {
  capturedHandler = null;
  lastValue = "";
  const valueRef: { current: string } = { current: "" };
  const utils = render(
    React.createElement(Harness, {
      onSubmit,
      disabled,
      onValueChange: (v) => {
        valueRef.current = v;
      }
    })
  );
  return {
    ...utils,
    fire(input: string, key: Record<string, boolean | string> = {}) {
      if (!capturedHandler) throw new Error("useInput not registered yet");
      capturedHandler(input, key);
    },
    getValue: () => valueRef.current
  };
}

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return {
    ...actual,
    useInput: (handler: typeof capturedHandler) => {
      capturedHandler = handler as never;
    }
  };
});

describe("useMultiLineInput", () => {
  it("submits single line on Enter", () => {
    const onSubmit = vi.fn();
    const { fire } = setup(onSubmit);

    fire("h", {});
    fire("i", {});
    fire("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("hi");
  });

  it("inserts newline on Shift+Enter", () => {
    const onSubmit = vi.fn();
    const { fire, rerender } = setup(onSubmit);

    fire("a", {});
    fire("", { return: true, shift: true });
    fire("b", {});

    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("a\nb");

    fire("", { return: true });
    expect(onSubmit).toHaveBeenCalledWith("a\nb");
  });

  it("supports Ctrl+Enter as newline fallback", () => {
    const onSubmit = vi.fn();
    const { fire, rerender } = setup(onSubmit);

    fire("x", {});
    fire("", { return: true, ctrl: true });
    fire("y", {});

    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("x\ny");
  });

  it("backspace at start of current merges with previous line", () => {
    const onSubmit = vi.fn();
    const { fire, rerender } = setup(onSubmit);

    fire("a", {});
    // Push line "a" to history
    fire("", { return: true, shift: true });
    // current is now empty; type "b"
    fire("b", {});

    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("a\nb");

    // Delete "b"
    fire("", { backspace: true });
    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    // current is now empty
    expect(lastValue).toBe("a\n");

    // Backspace at start of current should merge "a" back into current
    fire("", { backspace: true });
    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("a");
  });

  it("respects disabled flag", () => {
    const onSubmit = vi.fn();
    const { fire } = setup(onSubmit, true);

    fire("a", {});
    fire("", { return: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits then clears buffer", () => {
    const onSubmit = vi.fn();
    const { fire, rerender } = setup(onSubmit);

    fire("hello", {});
    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("hello");

    fire("", { return: true });
    expect(onSubmit).toHaveBeenCalledWith("hello");
    rerender(React.createElement(Harness, { onSubmit, onValueChange: () => {} }));
    expect(lastValue).toBe("");
  });
});
