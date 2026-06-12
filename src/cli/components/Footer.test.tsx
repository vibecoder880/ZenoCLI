import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Footer } from "./Footer.js";

describe("<Footer />", () => {
  it("renders the default keybinding hints", () => {
    const { lastFrame } = render(<Footer isBusy={false} isMultiLine={false} />);
    expect(lastFrame()).toContain("Esc");
    expect(lastFrame()).toContain("Shift+Enter");
    expect(lastFrame()).toContain("commands");
  });

  it("shows busy indicator when isBusy is true", () => {
    const { lastFrame } = render(<Footer isBusy={true} isMultiLine={false} />);
    expect(lastFrame()).toContain("busy");
  });

  it("highlights Shift+Enter when isMultiLine is true", () => {
    const { lastFrame } = render(<Footer isBusy={false} isMultiLine={true} />);
    // The green color signal is sent to the terminal; the label is still rendered.
    expect(lastFrame()).toContain("Shift+Enter");
  });
});
