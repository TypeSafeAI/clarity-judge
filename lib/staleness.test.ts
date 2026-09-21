import { describe, expect, it } from "vitest";
import { describeStaleness, isStale } from "./staleness";

const none = { textChanged: false, checksChanged: false, modeChanged: false };

describe("isStale", () => {
  it("is false only when nothing changed", () => {
    expect(isStale(none)).toBe(false);
    expect(isStale({ ...none, textChanged: true })).toBe(true);
    expect(isStale({ ...none, checksChanged: true })).toBe(true);
    expect(isStale({ ...none, modeChanged: true })).toBe(true);
  });
});

describe("describeStaleness", () => {
  it("names what changed", () => {
    expect(describeStaleness({ ...none, textChanged: true }, true, null)).toBe("The text changed. These verdicts reflect the previous run. Run again to refresh them.");
    expect(describeStaleness({ ...none, checksChanged: true }, false, null)).toBe("The checks changed. These verdicts reflect the previous run. Run again to refresh them.");
    expect(describeStaleness({ ...none, textChanged: true, checksChanged: true }, true, null)).toContain("The text and checks changed.");
  });

  it("keeps simulated verdicts honest once a key is in use", () => {
    expect(describeStaleness({ ...none, modeChanged: true }, true, null)).toBe(
      "You switched to live mode. These verdicts are still simulated. Run again for real verdicts from Jev.",
    );
    expect(describeStaleness({ ...none, modeChanged: true, textChanged: true }, true, null)).toContain("You switched to live mode and the text changed. These verdicts are still simulated.");
  });

  it("warns that a demo re-run replaces live verdicts with simulated ones", () => {
    expect(describeStaleness({ ...none, modeChanged: true }, false, null)).toBe(
      "You switched back to demo mode. These verdicts came from Jev. Running again will simulate results.",
    );
  });

  it("replaces the call to action with the blocker when a run cannot start", () => {
    const message = describeStaleness({ ...none, textChanged: true }, true, "Run again once there's some text.");
    expect(message).toBe("The text changed. These verdicts reflect the previous run. Run again once there's some text.");
    expect(message).not.toContain("refresh");
  });
});
