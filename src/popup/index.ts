import { getStats } from "../shared/rules";
import { loadState, onStateChange, setEnabled } from "../shared/storage";

const enabledToggle =
  document.querySelector<HTMLInputElement>("#enabled-toggle");
const statusText = document.querySelector<HTMLElement>("#status-text");
const statsGrid = document.querySelector<HTMLElement>("#stats-grid");
const openOptionsButton =
  document.querySelector<HTMLButtonElement>("#open-options");

function renderStats(
  muteRules: number,
  hiddenComments: number,
  hiddenThreads: number,
): void {
  if (!statsGrid) {
    return;
  }

  const items = [
    ["Mute rules", muteRules],
    ["Hidden comments", hiddenComments],
    ["Hidden threads", hiddenThreads],
  ];

  statsGrid.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="stat">
          <span class="stat__value">${value}</span>
          <span class="stat__label">${label}</span>
        </div>
      `,
    )
    .join("");
}

async function render(): Promise<void> {
  const state = await loadState();
  const stats = getStats(state);

  if (enabledToggle) {
    enabledToggle.checked = state.enabled;
  }

  if (statusText) {
    statusText.textContent = state.enabled
      ? "LGTMute is active on GitHub."
      : "LGTMute is paused. It will not inject controls or hide anything until you re-enable it.";
  }

  renderStats(stats.muteRules, stats.hiddenComments, stats.hiddenThreads);
}

enabledToggle?.addEventListener("change", (event) => {
  const target = event.currentTarget as HTMLInputElement;
  void setEnabled(target.checked);
});

openOptionsButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

onStateChange(() => void render());
void render();
