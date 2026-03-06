import { normalizeLogin } from "./github";
import { DEFAULT_STATE, sanitizeState } from "./rules";
import type { MuteScope, PersistedState } from "./types";

export interface StorageBackend {
  read(): Promise<Partial<PersistedState> | undefined>;
  write(state: PersistedState): Promise<void>;
  subscribe(
    listener: (state: Partial<PersistedState> | undefined) => void,
  ): () => void;
}

export interface StorageApi {
  loadState(): Promise<PersistedState>;
  updateState(
    updater: (
      state: PersistedState,
    ) => PersistedState | Promise<PersistedState>,
  ): Promise<PersistedState>;
  setEnabled(enabled: boolean): Promise<PersistedState>;
  hideComment(commentKey: string): Promise<PersistedState>;
  hideThread(threadKey: string): Promise<PersistedState>;
  muteAuthor(
    author: string,
    scope: MuteScope,
    repoKey: string | null,
  ): Promise<PersistedState>;
  removeComment(commentKey: string): Promise<PersistedState>;
  removeThread(threadKey: string): Promise<PersistedState>;
  removeMutedAuthor(
    author: string,
    scope: MuteScope,
    repoKey: string | null,
  ): Promise<PersistedState>;
  clearAll(): Promise<PersistedState>;
  onStateChange(listener: (state: PersistedState) => void): () => void;
}

export function createStorageApi(backend: StorageBackend): StorageApi {
  async function readRawState(): Promise<PersistedState> {
    return sanitizeState(await backend.read());
  }

  async function writeState(state: PersistedState): Promise<PersistedState> {
    const sanitized = sanitizeState(state);
    await backend.write(sanitized);
    return sanitized;
  }

  async function loadState(): Promise<PersistedState> {
    return readRawState();
  }

  async function updateState(
    updater: (
      state: PersistedState,
    ) => PersistedState | Promise<PersistedState>,
  ): Promise<PersistedState> {
    const current = await readRawState();
    const next = sanitizeState(await updater(current));
    return writeState(next);
  }

  async function setEnabled(enabled: boolean): Promise<PersistedState> {
    return updateState((state) => ({ ...state, enabled }));
  }

  async function hideComment(commentKey: string): Promise<PersistedState> {
    return updateState((state) => ({
      ...state,
      hiddenCommentKeys: [...state.hiddenCommentKeys, commentKey],
    }));
  }

  async function hideThread(threadKey: string): Promise<PersistedState> {
    return updateState((state) => ({
      ...state,
      hiddenThreadKeys: [...state.hiddenThreadKeys, threadKey],
    }));
  }

  async function muteAuthor(
    author: string,
    scope: MuteScope,
    repoKey: string | null,
  ): Promise<PersistedState> {
    const login = normalizeLogin(author);
    if (!login) {
      return readRawState();
    }

    return updateState((state) => {
      if (scope === "site") {
        return {
          ...state,
          siteMutedAuthors: [...state.siteMutedAuthors, login],
        };
      }

      if (!repoKey) {
        return state;
      }

      return {
        ...state,
        repoMutedAuthors: {
          ...state.repoMutedAuthors,
          [repoKey]: [...(state.repoMutedAuthors[repoKey] ?? []), login],
        },
      };
    });
  }

  async function removeComment(commentKey: string): Promise<PersistedState> {
    return updateState((state) => ({
      ...state,
      hiddenCommentKeys: state.hiddenCommentKeys.filter(
        (key) => key !== commentKey,
      ),
    }));
  }

  async function removeThread(threadKey: string): Promise<PersistedState> {
    return updateState((state) => ({
      ...state,
      hiddenThreadKeys: state.hiddenThreadKeys.filter(
        (key) => key !== threadKey,
      ),
    }));
  }

  async function removeMutedAuthor(
    author: string,
    scope: MuteScope,
    repoKey: string | null,
  ): Promise<PersistedState> {
    const login = normalizeLogin(author);
    if (!login) {
      return readRawState();
    }

    return updateState((state) => {
      if (scope === "site") {
        return {
          ...state,
          siteMutedAuthors: state.siteMutedAuthors.filter(
            (entry) => entry !== login,
          ),
        };
      }

      if (!repoKey) {
        return state;
      }

      const nextAuthors = (state.repoMutedAuthors[repoKey] ?? []).filter(
        (entry) => entry !== login,
      );
      const nextRepoMutedAuthors = { ...state.repoMutedAuthors };

      if (nextAuthors.length === 0) {
        delete nextRepoMutedAuthors[repoKey];
      } else {
        nextRepoMutedAuthors[repoKey] = nextAuthors;
      }

      return {
        ...state,
        repoMutedAuthors: nextRepoMutedAuthors,
      };
    });
  }

  async function clearAll(): Promise<PersistedState> {
    return writeState(DEFAULT_STATE);
  }

  function onStateChange(
    listener: (state: PersistedState) => void,
  ): () => void {
    return backend.subscribe((state) => {
      listener(sanitizeState(state));
    });
  }

  return {
    loadState,
    updateState,
    setEnabled,
    hideComment,
    hideThread,
    muteAuthor,
    removeComment,
    removeThread,
    removeMutedAuthor,
    clearAll,
    onStateChange,
  };
}
