import { normalizeLogin } from "./github";
import type {
  HideReason,
  PersistedState,
  StorageStats,
  TargetDescriptor,
} from "./types";

export const DEFAULT_STATE: PersistedState = {
  version: 1,
  enabled: true,
  siteMutedAuthors: [],
  repoMutedAuthors: {},
  hiddenCommentKeys: [],
  hiddenThreadKeys: [],
};

function uniqueValues(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

export function sanitizeState(
  input: Partial<PersistedState> | undefined,
): PersistedState {
  const repoMutedAuthors = Object.fromEntries(
    Object.entries(input?.repoMutedAuthors ?? {}).map(([repoKey, authors]) => [
      repoKey.toLowerCase(),
      uniqueValues(
        (authors ?? [])
          .map((author) => normalizeLogin(author))
          .filter(Boolean) as string[],
      ),
    ]),
  );

  return {
    version: 1,
    enabled: input?.enabled ?? DEFAULT_STATE.enabled,
    siteMutedAuthors: uniqueValues(
      (input?.siteMutedAuthors ?? [])
        .map((author) => normalizeLogin(author))
        .filter(Boolean) as string[],
    ),
    repoMutedAuthors,
    hiddenCommentKeys: uniqueValues(input?.hiddenCommentKeys ?? []),
    hiddenThreadKeys: uniqueValues(input?.hiddenThreadKeys ?? []),
  };
}

export function getHideReason(
  state: PersistedState,
  target: TargetDescriptor,
): HideReason | null {
  if (!state.enabled) {
    return null;
  }

  if (state.hiddenCommentKeys.includes(target.commentKey)) {
    return { kind: "comment", key: target.commentKey };
  }

  if (state.hiddenThreadKeys.includes(target.threadKey)) {
    return { kind: "thread", key: target.threadKey };
  }

  const repoAuthors = state.repoMutedAuthors[target.repoKey] ?? [];
  if (repoAuthors.includes(target.author)) {
    return {
      kind: "repo-author",
      author: target.author,
      repoKey: target.repoKey,
    };
  }

  if (state.siteMutedAuthors.includes(target.author)) {
    return { kind: "site-author", author: target.author };
  }

  return null;
}

export function getStats(state: PersistedState): StorageStats {
  const repoMuteRules = Object.values(state.repoMutedAuthors).reduce(
    (count, authors) => count + authors.length,
    0,
  );

  return {
    muteRules: state.siteMutedAuthors.length + repoMuteRules,
    hiddenComments: state.hiddenCommentKeys.length,
    hiddenThreads: state.hiddenThreadKeys.length,
  };
}
