import { useCallback, useState } from "react";
import { useInput } from "ink";

export interface MultiLineInputState {
  /** Combined value: joined lines + current line. */
  value: string;
  /** Submit a single line (Enter when not multi-line). */
  submit: () => void;
  /** Reset state. */
  reset: () => void;
  /** Inject a value from outside (e.g. initial prompt). */
  setValue: (next: string) => void;
}

export interface UseMultiLineInputOptions {
  initialValue?: string;
  disabled?: boolean;
  onSubmit: (value: string) => void;
}

/**
 * Multi-line prompt input: Enter submits, Shift+Enter inserts newline.
 * Maintains internal buffer of completed lines plus the live line.
 */
export function useMultiLineInput(options: UseMultiLineInputOptions): MultiLineInputState {
  const { initialValue = "", disabled = false, onSubmit } = options;
  const [lines, setLines] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>(initialValue);

  const combined = lines.length === 0 ? current : [...lines, current].join("\n");

  const handleSubmit = useCallback(() => {
    const value = lines.length === 0 ? current : [...lines, current].join("\n");
    onSubmit(value);
    setLines([]);
    setCurrent("");
  }, [current, lines, onSubmit]);

  const handleReset = useCallback(() => {
    setLines([]);
    setCurrent("");
  }, []);

  useInput((inputChar: string, key) => {
    if (disabled) return;

    // Shift+Enter (or Ctrl+Enter fallback) → newline
    if (key.return && key.shift) {
      setLines((prev) => [...prev, current]);
      setCurrent("");
      return;
    }

    // Ctrl+Enter as fallback for terminals that don't surface shift+enter
    if (key.return && key.ctrl) {
      setLines((prev) => [...prev, current]);
      setCurrent("");
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    // Backspace at start of current line: merge with previous line
    if (key.backspace && current.length === 0 && lines.length > 0) {
      const previousLine = lines[lines.length - 1] ?? "";
      setLines(lines.slice(0, -1));
      setCurrent(previousLine);
      return;
    }

    if (key.backspace) {
      setCurrent((prev) => prev.slice(0, -1));
      return;
    }

    if (inputChar) {
      setCurrent((prev) => prev + inputChar);
    }
  });

  return {
    value: combined,
    submit: handleSubmit,
    reset: handleReset,
    setValue: setCurrent
  };
}
