import { createStorageApi } from "../shared/storage-core";
import { STORAGE_KEY } from "../shared/types";
import type { PersistedState } from "../shared/types";

const USERSCRIPT_STORAGE_KEY = `${STORAGE_KEY}_userscript`;
const USERSCRIPT_EVENT = "lgtmute:userscript-state";

function readStoredState(): Partial<PersistedState> | undefined {
  const raw = localStorage.getItem(USERSCRIPT_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    localStorage.removeItem(USERSCRIPT_STORAGE_KEY);
    return undefined;
  }
}

function emitStateChange(state: PersistedState): void {
  window.dispatchEvent(
    new CustomEvent<PersistedState>(USERSCRIPT_EVENT, {
      detail: state,
    }),
  );
}

export const userscriptStorage = createStorageApi({
  async read() {
    return readStoredState();
  },
  async write(state) {
    localStorage.setItem(USERSCRIPT_STORAGE_KEY, JSON.stringify(state));
    emitStateChange(state);
  },
  subscribe(listener) {
    const handleCustomState = (event: Event) => {
      listener((event as CustomEvent<PersistedState>).detail);
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        event.key !== USERSCRIPT_STORAGE_KEY
      ) {
        return;
      }

      listener(readStoredState());
    };

    window.addEventListener(USERSCRIPT_EVENT, handleCustomState);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(USERSCRIPT_EVENT, handleCustomState);
      window.removeEventListener("storage", handleStorage);
    };
  },
});
