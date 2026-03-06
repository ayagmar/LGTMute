import { createStorageApi } from "./storage-core";
import { STORAGE_KEY } from "./types";
import type { PersistedState } from "./types";
const storage = createStorageApi({
  async read() {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return result[STORAGE_KEY] as Partial<PersistedState> | undefined;
  },
  async write(state) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: state });
  },
  subscribe(listener) {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "sync" || !(STORAGE_KEY in changes)) {
        return;
      }

      listener(
        changes[STORAGE_KEY].newValue as Partial<PersistedState> | undefined,
      );
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  },
});

export const {
  clearAll,
  hideComment,
  hideThread,
  loadState,
  muteAuthor,
  onStateChange,
  removeComment,
  removeMutedAuthor,
  removeThread,
  setEnabled,
  updateState,
} = storage;
