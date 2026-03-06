import { describe, expect, it } from "vitest";

import { shouldShowHideThreadAction } from "../src/content/menu-policy";

describe("shouldShowHideThreadAction", () => {
  it("hides the thread action when it matches the current comment exactly", () => {
    expect(
      shouldShowHideThreadAction({
        commentKey:
          "comment:https://github.com/owner/repo/issues/1#issuecomment-1",
        threadKey:
          "comment:https://github.com/owner/repo/issues/1#issuecomment-1",
      }),
    ).toBe(false);
  });

  it("keeps the thread action when the thread scope is broader than the comment", () => {
    expect(
      shouldShowHideThreadAction({
        commentKey:
          "comment:https://github.com/owner/repo/pull/1#issuecomment-2",
        threadKey: "thread:https://github.com/owner/repo/pull/1#issuecomment-1",
      }),
    ).toBe(true);
  });
});
