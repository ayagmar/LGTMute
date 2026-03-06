export const STORAGE_KEY = "lgtmute_state";

export type MuteScope = "repo" | "site";

export interface PersistedState {
  version: 1;
  enabled: boolean;
  siteMutedAuthors: string[];
  repoMutedAuthors: Record<string, string[]>;
  hiddenCommentKeys: string[];
  hiddenThreadKeys: string[];
}

export interface TargetDescriptor {
  author: string;
  commentKey: string;
  threadKey: string;
  repoKey: string;
  label: "post" | "reply";
}

export type HideReason =
  | { kind: "comment"; key: string }
  | { kind: "thread"; key: string }
  | { kind: "repo-author"; author: string; repoKey: string }
  | { kind: "site-author"; author: string };

export interface StorageStats {
  muteRules: number;
  hiddenComments: number;
  hiddenThreads: number;
}
