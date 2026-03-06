import { describe, expect, it } from "vitest";

import { getHideReason, getStats, sanitizeState } from "../src/shared/rules";
import type { TargetDescriptor } from "../src/shared/types";

const baseTarget: TargetDescriptor = {
  author: "octocat",
  commentKey: "comment:https://github.com/owner/repo/issues/1#issuecomment-1",
  threadKey: "thread:https://github.com/owner/repo/issues/1#issuecomment-1",
  repoKey: "owner/repo",
  label: "reply",
};

describe("sanitizeState", () => {
  it("normalizes and deduplicates values without reordering them", () => {
    expect(
      sanitizeState({
        enabled: true,
        siteMutedAuthors: ["@OctoCat", "octocat"],
        repoMutedAuthors: {
          "Owner/Repo": ["Bot", "bot"],
        },
        hiddenCommentKeys: ["b", "a", "a"],
        hiddenThreadKeys: ["thread-2", "thread-1", "thread-1"],
      }),
    ).toEqual({
      version: 1,
      enabled: true,
      siteMutedAuthors: ["octocat"],
      repoMutedAuthors: {
        "owner/repo": ["bot"],
      },
      hiddenCommentKeys: ["b", "a"],
      hiddenThreadKeys: ["thread-2", "thread-1"],
    });
  });
});

describe("getHideReason", () => {
  it("prefers explicit comment hides over broader rules", () => {
    const state = sanitizeState({
      hiddenCommentKeys: [baseTarget.commentKey],
      hiddenThreadKeys: [baseTarget.threadKey],
      siteMutedAuthors: [baseTarget.author],
    });

    expect(getHideReason(state, baseTarget)).toEqual({
      kind: "comment",
      key: baseTarget.commentKey,
    });
  });

  it("matches repo-scoped author mutes before site-scoped ones", () => {
    const state = sanitizeState({
      repoMutedAuthors: {
        "owner/repo": ["octocat"],
      },
      siteMutedAuthors: ["octocat"],
    });

    expect(getHideReason(state, baseTarget)).toEqual({
      kind: "repo-author",
      author: "octocat",
      repoKey: "owner/repo",
    });
  });

  it("returns null when the extension is disabled", () => {
    const state = sanitizeState({
      enabled: false,
      siteMutedAuthors: ["octocat"],
    });

    expect(getHideReason(state, baseTarget)).toBeNull();
  });
});

describe("getStats", () => {
  it("counts mute rules instead of implying unique users", () => {
    const state = sanitizeState({
      siteMutedAuthors: ["octocat"],
      repoMutedAuthors: {
        "owner/repo": ["octocat", "hubot"],
      },
      hiddenCommentKeys: ["comment-1"],
      hiddenThreadKeys: ["thread-1", "thread-2"],
    });

    expect(getStats(state)).toEqual({
      muteRules: 3,
      hiddenComments: 1,
      hiddenThreads: 2,
    });
  });
});
