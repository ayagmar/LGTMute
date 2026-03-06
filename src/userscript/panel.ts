import {
  formatScopedKey,
  getPageMeta,
  type SectionKey,
} from "../shared/control-panel";
import { getStats } from "../shared/rules";
import type { StorageApi } from "../shared/storage-core";
import type { PersistedState } from "../shared/types";

const PANEL_OWNED = "data-lgtmute-owned";
const PANEL_ROOT_ID = "lgtmute-userscript-root";
const OVERLAY_ID = "lgtmute-userscript-overlay";

export function mountUserscriptPanel(storage: StorageApi): void {
  if (document.getElementById(PANEL_ROOT_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = PANEL_ROOT_ID;
  root.setAttribute(PANEL_OWNED, "userscript-panel");

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "lgtmute-userscript-launcher";
  launcher.setAttribute(PANEL_OWNED, "userscript-panel");
  launcher.textContent = "LGTMute";

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "lgtmute-userscript-overlay";
  overlay.hidden = true;
  overlay.setAttribute(PANEL_OWNED, "userscript-panel");

  const panel = document.createElement("div");
  panel.className = "lgtmute-userscript-panel";
  panel.setAttribute(PANEL_OWNED, "userscript-panel");

  const enabledToggleId = "lgtmute-userscript-enabled";
  panel.innerHTML = `
    <div class="lgtmute-userscript-panel__header">
      <div>
        <span class="lgtmute-userscript-panel__eyebrow">Userscript Control Panel</span>
        <h1 class="lgtmute-userscript-panel__title">LGTMute</h1>
        <p class="lgtmute-userscript-panel__copy">
          Manage muted authors, hidden comments, and hidden threads directly on the page.
        </p>
      </div>
      <button type="button" class="lgtmute-userscript-panel__close" data-action="close">
        Close
      </button>
    </div>
    <div class="lgtmute-userscript-toolbar">
      <div>
        <strong>Active on this page</strong>
        <small id="lgtmute-userscript-status">
          LGTMute is active and injecting controls on GitHub.
        </small>
      </div>
      <div class="lgtmute-userscript-toolbar__actions">
        <label class="lgtmute-userscript-toggle">
          <input id="${enabledToggleId}" type="checkbox" />
          <span class="lgtmute-userscript-toggle__track"></span>
        </label>
        <button type="button" class="lgtmute-userscript-danger" data-action="clear-all">
          Clear all
        </button>
      </div>
    </div>
    <div class="lgtmute-userscript-stats">
      <div class="lgtmute-userscript-stat">
        <strong id="lgtmute-userscript-stat-mute-rules">0</strong>
        <span>Mute rules</span>
      </div>
      <div class="lgtmute-userscript-stat">
        <strong id="lgtmute-userscript-stat-hidden-comments">0</strong>
        <span>Hidden comments</span>
      </div>
      <div class="lgtmute-userscript-stat">
        <strong id="lgtmute-userscript-stat-hidden-threads">0</strong>
        <span>Hidden threads</span>
      </div>
    </div>
    <div class="lgtmute-userscript-grid">
      ${renderSectionShell("siteAuthors", "Site-wide muted authors", "Muted across github.com")}
      ${renderSectionShell("repoAuthors", "Repo-scoped muted authors", "Muted only in the current repository")}
      ${renderSectionShell("hiddenComments", "Hidden comments", "Restorable one-comment hide rules")}
      ${renderSectionShell("hiddenThreads", "Hidden threads", "Restorable thread hide rules")}
    </div>
  `;

  overlay.append(panel);
  root.append(launcher, overlay);
  document.body.append(root);

  const enabledToggle = panel.querySelector<HTMLInputElement>(
    `#${enabledToggleId}`,
  );
  const statusText = panel.querySelector<HTMLElement>(
    "#lgtmute-userscript-status",
  );
  const statMuteRules = panel.querySelector<HTMLElement>(
    "#lgtmute-userscript-stat-mute-rules",
  );
  const statHiddenComments = panel.querySelector<HTMLElement>(
    "#lgtmute-userscript-stat-hidden-comments",
  );
  const statHiddenThreads = panel.querySelector<HTMLElement>(
    "#lgtmute-userscript-stat-hidden-threads",
  );

  const currentPages: Record<SectionKey, number> = {
    siteAuthors: 1,
    repoAuthors: 1,
    hiddenComments: 1,
    hiddenThreads: 1,
  };

  let renderedState: PersistedState | null = null;

  function openOverlay(): void {
    overlay.hidden = false;
  }

  function closeOverlay(): void {
    overlay.hidden = true;
  }

  function getSectionNodes(section: SectionKey): {
    list: HTMLElement | null;
    pagination: HTMLElement | null;
  } {
    return {
      list: panel.querySelector<HTMLElement>(
        `[data-section-list="${section}"]`,
      ),
      pagination: panel.querySelector<HTMLElement>(
        `[data-section-pagination="${section}"]`,
      ),
    };
  }

  function createEmptyState(message: string): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "lgtmute-userscript-empty";
    item.textContent = message;
    return item;
  }

  function createListRow(options: {
    title: string;
    subtitle: string;
    buttonLabel: string;
    buttonClassName?: string;
    dataset: Record<string, string>;
  }): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "lgtmute-userscript-row";

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = options.title;
    const subtitle = document.createElement("small");
    subtitle.textContent = options.subtitle;
    content.append(title, subtitle);

    const button = document.createElement("button");
    button.type = "button";
    button.className = options.buttonClassName ?? "lgtmute-userscript-chip";
    button.textContent = options.buttonLabel;

    for (const [key, value] of Object.entries(options.dataset)) {
      button.dataset[key] = value;
    }

    item.append(content, button);
    return item;
  }

  function renderPagination(
    container: HTMLElement | null,
    section: SectionKey,
    totalItems: number,
  ): void {
    if (!container) {
      return;
    }

    const { page, totalPages, start, end } = getPageMeta(
      currentPages[section],
      totalItems,
    );
    currentPages[section] = page;

    if (totalItems === 0 || totalPages === 1) {
      container.replaceChildren();
      return;
    }

    const meta = document.createElement("span");
    meta.textContent = `${start + 1}-${Math.min(end, totalItems)} of ${totalItems}`;

    const actions = document.createElement("div");
    actions.className = "lgtmute-userscript-pagination__actions";

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "lgtmute-userscript-chip";
    previous.textContent = "Previous";
    previous.dataset.action = "page-prev";
    previous.dataset.section = section;
    previous.disabled = page === 1;

    const next = document.createElement("button");
    next.type = "button";
    next.className = "lgtmute-userscript-chip";
    next.textContent = "Next";
    next.dataset.action = "page-next";
    next.dataset.section = section;
    next.disabled = page === totalPages;

    actions.append(previous, next);
    container.replaceChildren(meta, actions);
  }

  function renderSection<T>(options: {
    section: SectionKey;
    items: T[];
    emptyMessage: string;
    renderRow: (item: T) => HTMLLIElement;
  }): void {
    const nodes = getSectionNodes(options.section);
    if (!nodes.list) {
      return;
    }

    if (options.items.length === 0) {
      nodes.list.replaceChildren(createEmptyState(options.emptyMessage));
      nodes.pagination?.replaceChildren();
      return;
    }

    const { page, start, end } = getPageMeta(
      currentPages[options.section],
      options.items.length,
    );
    currentPages[options.section] = page;
    const pageItems = options.items.slice(start, end).map(options.renderRow);
    nodes.list.replaceChildren(...pageItems);
    renderPagination(nodes.pagination, options.section, options.items.length);
  }

  function renderState(state: PersistedState): void {
    renderedState = state;
    const stats = getStats(state);

    launcher.textContent = state.enabled
      ? `LGTMute ${stats.muteRules > 0 ? `· ${stats.muteRules}` : ""}`.trim()
      : "LGTMute off";

    if (enabledToggle) {
      enabledToggle.checked = state.enabled;
    }

    if (statusText) {
      statusText.textContent = state.enabled
        ? "LGTMute is active and injecting controls on GitHub."
        : "LGTMute is paused. Existing rules are kept but no controls or hides will apply until re-enabled.";
    }

    statMuteRules?.replaceChildren(String(stats.muteRules));
    statHiddenComments?.replaceChildren(String(stats.hiddenComments));
    statHiddenThreads?.replaceChildren(String(stats.hiddenThreads));

    renderSection({
      section: "siteAuthors",
      items: state.siteMutedAuthors,
      emptyMessage: "No site-wide muted authors.",
      renderRow: (author) =>
        createListRow({
          title: `@${author}`,
          subtitle: "Muted across github.com",
          buttonLabel: "Remove",
          buttonClassName: "lgtmute-userscript-danger",
          dataset: {
            action: "remove-site-author",
            author,
          },
        }),
    });

    const repoEntries = Object.entries(state.repoMutedAuthors).flatMap(
      ([repoKey, authors]) => authors.map((author) => ({ author, repoKey })),
    );

    renderSection({
      section: "repoAuthors",
      items: repoEntries,
      emptyMessage: "No repo-scoped muted authors.",
      renderRow: ({ author, repoKey }) =>
        createListRow({
          title: `@${author}`,
          subtitle: repoKey,
          buttonLabel: "Remove",
          buttonClassName: "lgtmute-userscript-danger",
          dataset: {
            action: "remove-repo-author",
            author,
            repoKey,
          },
        }),
    });

    renderSection({
      section: "hiddenComments",
      items: state.hiddenCommentKeys,
      emptyMessage: "No hidden comments.",
      renderRow: (key) => {
        const { title, subtitle } = formatScopedKey(key, "comment:");
        return createListRow({
          title,
          subtitle,
          buttonLabel: "Restore",
          dataset: {
            action: "remove-comment",
            key,
          },
        });
      },
    });

    renderSection({
      section: "hiddenThreads",
      items: state.hiddenThreadKeys,
      emptyMessage: "No hidden threads.",
      renderRow: (key) => {
        const { title, subtitle } = formatScopedKey(key, "thread:");
        return createListRow({
          title,
          subtitle,
          buttonLabel: "Restore",
          dataset: {
            action: "remove-thread",
            key,
          },
        });
      },
    });
  }

  launcher.addEventListener("click", () => {
    if (overlay.hidden) {
      openOverlay();
      return;
    }

    closeOverlay();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeOverlay();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeOverlay();
    }

    if (event.shiftKey && event.altKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      if (overlay.hidden) {
        openOverlay();
      } else {
        closeOverlay();
      }
    }
  });

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    switch (target.dataset.action) {
      case "close":
        closeOverlay();
        return;
      case "clear-all":
        if (
          window.confirm("Clear every LGTMute rule? This cannot be undone.")
        ) {
          void storage.clearAll();
        }
        return;
      case "remove-site-author":
        void storage.removeMutedAuthor(
          target.dataset.author ?? "",
          "site",
          null,
        );
        return;
      case "remove-repo-author":
        void storage.removeMutedAuthor(
          target.dataset.author ?? "",
          "repo",
          target.dataset.repoKey ?? null,
        );
        return;
      case "remove-comment":
        void storage.removeComment(target.dataset.key ?? "");
        return;
      case "remove-thread":
        void storage.removeThread(target.dataset.key ?? "");
        return;
      case "page-prev":
      case "page-next": {
        const section = target.dataset.section as SectionKey | undefined;
        if (!section || !renderedState) {
          return;
        }

        currentPages[section] += target.dataset.action === "page-prev" ? -1 : 1;
        renderState(renderedState);
      }
    }
  });

  enabledToggle?.addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLInputElement;
    void storage.setEnabled(target.checked);
  });

  storage.onStateChange(renderState);
  void storage.loadState().then(renderState);
}

function renderSectionShell(
  section: SectionKey,
  title: string,
  description: string,
): string {
  return `
    <section class="lgtmute-userscript-section">
      <h2>${title}</h2>
      <p>${description}</p>
      <ul class="lgtmute-userscript-list" data-section-list="${section}"></ul>
      <div
        class="lgtmute-userscript-pagination"
        data-section-pagination="${section}"
      ></div>
    </section>
  `;
}
