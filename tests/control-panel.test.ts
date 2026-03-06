import { describe, expect, it } from "vitest";

import { formatScopedKey, getPageMeta } from "../src/shared/control-panel";

describe("formatScopedKey", () => {
  it("splits the page and fragment for scoped keys", () => {
    expect(
      formatScopedKey(
        "comment:https://github.com/owner/repo/issues/1#issuecomment-42",
        "comment:",
      ),
    ).toEqual({
      title: "issuecomment-42",
      subtitle: "https://github.com/owner/repo/issues/1",
    });
  });
});

describe("getPageMeta", () => {
  it("normalizes page bounds and returns the visible slice", () => {
    expect(getPageMeta(0, 80)).toEqual({
      page: 1,
      totalPages: 4,
      start: 0,
      end: 25,
    });

    expect(getPageMeta(10, 80)).toEqual({
      page: 4,
      totalPages: 4,
      start: 75,
      end: 100,
    });
  });
});
