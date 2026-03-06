import { getStats } from "../shared/rules";
import {
  clearAll,
  loadState,
  onStateChange,
  removeComment,
  removeMutedAuthor,
  removeThread,
  setEnabled,
} from "../shared/storage";
import type { PersistedState } from "../shared/types";

const PAGE_SIZE = 25;

type SectionKey =
  | "siteAuthors"
  | "repoAuthors"
  | "hiddenComments"
  | "hiddenThreads";

const enabledToggle =
  document.querySelector<HTMLInputElement>("#enabled-toggle");
const statMuteRules = document.querySelector<HTMLElement>("#stat-mute-rules");
const statHiddenComments = document.querySelector<HTMLElement>(
  "#stat-hidden-comments",
);
const statHiddenThreads = document.querySelector<HTMLElement>(
  "#stat-hidden-threads",
);
const siteAuthorsList =
  document.querySelector<HTMLElement>("#site-authors-list");
const siteAuthorsPagination = document.querySelector<HTMLElement>(
  "#site-authors-pagination",
);
const repoAuthorsList =
  document.querySelector<HTMLElement>("#repo-authors-list");
const repoAuthorsPagination = document.querySelector<HTMLElement>(
  "#repo-authors-pagination",
);
const hiddenCommentsList = document.querySelector<HTMLElement>(
  "#hidden-comments-list",
);
const hiddenCommentsPagination = document.querySelector<HTMLElement>(
  "#hidden-comments-pagination",
);
const hiddenThreadsList = document.querySelector<HTMLElement>(
  "#hidden-threads-list",
);
const hiddenThreadsPagination = document.querySelector<HTMLElement>(
  "#hidden-threads-pagination",
);
const clearAllButton = document.querySelector<HTMLButtonElement>("#clear-all");

let renderedState: PersistedState | null = null;

const currentPages: Record<SectionKey, number> = {
  siteAuthors: 1,
  repoAuthors: 1,
  hiddenComments: 1,
  hiddenThreads: 1,
};

function createEmptyState(message: string): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "empty-state";
  item.textContent = message;
  return item;
}

function renderEmptyState(container: HTMLElement, message: string): void {
  container.replaceChildren(createEmptyState(message));
}

function createListRow(options: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonClassName?: string;
  dataset: Record<string, string>;
}): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "list-row";

  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = options.title;
  const subtitle = document.createElement("small");
  subtitle.textContent = options.subtitle;
  content.append(title, subtitle);

  const button = document.createElement("button");
  button.type = "button";
  button.className = options.buttonClassName ?? "chip";
  button.textContent = options.buttonLabel;

  for (const [key, value] of Object.entries(options.dataset)) {
    button.dataset[key] = value;
  }

  item.append(content, button);
  return item;
}

function formatScopedKey(
  key: string,
  prefix: "comment:" | "thread:",
): { title: string; subtitle: string } {
  const normalizedKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  const [page, fragment] = normalizedKey.split("#");

  return {
    title: fragment ?? normalizedKey,
    subtitle: page ?? normalizedKey,
  };
}

function getPageMeta(
  section: SectionKey,
  totalItems: number,
): {
  page: number;
  totalPages: number;
  start: number;
  end: number;
} {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  currentPages[section] = Math.min(currentPages[section], totalPages);
  currentPages[section] = Math.max(currentPages[section], 1);
  const page = currentPages[section];
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return { page, totalPages, start, end };
}

function renderPagination(
  container: HTMLElement | null,
  section: SectionKey,
  totalItems: number,
): void {
  if (!container) {
    return;
  }

  const { page, totalPages, start, end } = getPageMeta(section, totalItems);
  if (totalItems === 0 || totalPages === 1) {
    container.replaceChildren();
    return;
  }

  const meta = document.createElement("span");
  meta.className = "pagination__meta";
  meta.textContent = `${start + 1}-${Math.min(end, totalItems)} of ${totalItems}`;

  const actions = document.createElement("div");
  actions.className = "pagination__actions";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "chip";
  previous.textContent = "Previous";
  previous.dataset.action = "page-prev";
  previous.dataset.section = section;
  previous.disabled = page === 1;

  const next = document.createElement("button");
  next.type = "button";
  next.className = "chip";
  next.textContent = "Next";
  next.dataset.action = "page-next";
  next.dataset.section = section;
  next.disabled = page === totalPages;

  actions.append(previous, next);
  container.replaceChildren(meta, actions);
}

function renderSection<T>(options: {
  section: SectionKey;
  container: HTMLElement | null;
  pagination: HTMLElement | null;
  items: T[];
  emptyMessage: string;
  renderRow: (item: T) => HTMLLIElement;
}): void {
  if (!options.container) {
    return;
  }

  if (options.items.length === 0) {
    renderEmptyState(options.container, options.emptyMessage);
    options.pagination?.replaceChildren();
    return;
  }

  const { start, end } = getPageMeta(options.section, options.items.length);
  const pageItems = options.items.slice(start, end).map(options.renderRow);
  options.container.replaceChildren(...pageItems);
  renderPagination(options.pagination, options.section, options.items.length);
}

function renderState(state: PersistedState): void {
  renderedState = state;
  const stats = getStats(state);
  if (enabledToggle) {
    enabledToggle.checked = state.enabled;
  }

  if (statMuteRules) {
    statMuteRules.textContent = String(stats.muteRules);
  }

  if (statHiddenComments) {
    statHiddenComments.textContent = String(stats.hiddenComments);
  }

  if (statHiddenThreads) {
    statHiddenThreads.textContent = String(stats.hiddenThreads);
  }

  renderSection({
    section: "siteAuthors",
    container: siteAuthorsList,
    pagination: siteAuthorsPagination,
    items: state.siteMutedAuthors,
    emptyMessage: "No site-wide muted authors.",
    renderRow: (author) =>
      createListRow({
        title: `@${author}`,
        subtitle: "Muted across github.com",
        buttonLabel: "Remove",
        buttonClassName: "chip chip--danger",
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
    container: repoAuthorsList,
    pagination: repoAuthorsPagination,
    items: repoEntries,
    emptyMessage: "No repo-scoped muted authors.",
    renderRow: ({ author, repoKey }) =>
      createListRow({
        title: `@${author}`,
        subtitle: repoKey,
        buttonLabel: "Remove",
        buttonClassName: "chip chip--danger",
        dataset: {
          action: "remove-repo-author",
          author,
          repoKey,
        },
      }),
  });

  renderSection({
    section: "hiddenComments",
    container: hiddenCommentsList,
    pagination: hiddenCommentsPagination,
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
    container: hiddenThreadsList,
    pagination: hiddenThreadsPagination,
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

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  switch (target.dataset.action) {
    case "remove-site-author":
      void removeMutedAuthor(target.dataset.author ?? "", "site", null);
      break;
    case "remove-repo-author":
      void removeMutedAuthor(
        target.dataset.author ?? "",
        "repo",
        target.dataset.repoKey ?? null,
      );
      break;
    case "remove-comment":
      void removeComment(target.dataset.key ?? "");
      break;
    case "remove-thread":
      void removeThread(target.dataset.key ?? "");
      break;
    case "page-prev":
    case "page-next": {
      const section = target.dataset.section as SectionKey | undefined;
      if (!section || !renderedState) {
        break;
      }

      currentPages[section] += target.dataset.action === "page-prev" ? -1 : 1;
      renderState(renderedState);
      break;
    }
    default:
      break;
  }
});

enabledToggle?.addEventListener("change", (event) => {
  const target = event.currentTarget as HTMLInputElement;
  void setEnabled(target.checked);
});

clearAllButton?.addEventListener("click", () => {
  if (!window.confirm("Clear every LGTMute rule? This cannot be undone.")) {
    return;
  }

  void clearAll();
});

onStateChange(renderState);
void loadState().then(renderState);
