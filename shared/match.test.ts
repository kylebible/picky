import { describe, expect, it } from "vitest";
import { isMatch } from "./match";

describe("isMatch", () => {
  const members = ["host", "guest"];

  it("matches when both members liked the dish", () => {
    const swipes = [
      { userId: "host", dishId: "d1", liked: true },
      { userId: "guest", dishId: "d1", liked: true },
    ];
    expect(isMatch(swipes, "d1", members)).toBe(true);
  });

  it("does not match when one member passed", () => {
    const swipes = [
      { userId: "host", dishId: "d1", liked: true },
      { userId: "guest", dishId: "d1", liked: false },
    ];
    expect(isMatch(swipes, "d1", members)).toBe(false);
  });

  it("does not match before the second member swipes", () => {
    expect(isMatch([{ userId: "host", dishId: "d1", liked: true }], "d1", members)).toBe(false);
  });

  it("never matches a session with one member", () => {
    expect(isMatch([{ userId: "host", dishId: "d1", liked: true }], "d1", ["host"])).toBe(false);
  });
});
