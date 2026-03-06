import { getViewerLogin } from "../shared/github";
import { getHideReason } from "../shared/rules";
import type { StorageApi } from "../shared/storage-core";
import type { HideReason, PersistedState } from "../shared/types";
import { pickControlRoots } from "./control-policy";
import { shouldScheduleScan } from "./mutation-policy";
import {
  findObserverRoots,
  findObservationRoots,
  findTargets,
  type GitHubTarget,
} from "./targets";

const BUTTON_CLASS = "lgtmute-button";
const MENU_CLASS = "lgtmute-menu";
const PLACEHOLDER_CLASS = "lgtmute-placeholder";
const OWNED_ATTRIBUTE = "data-lgtmute-owned";

interface ControlElements {
  button: HTMLButtonElement;
  menu: HTMLDivElement;
}

export async function bootstrapContent(storage: StorageApi): Promise<void> {
  let state: PersistedState | null = null;
  let scanScheduled = false;
  let openMenu: HTMLDivElement | null = null;
  let observer: MutationObserver | null = null;
  let observedRoots: HTMLElement[] = [];
  let controlId = 0;

  const controls = new Map<HTMLElement, ControlElements>();
  const placeholders = new Map<HTMLElement, HTMLDivElement>();

  function closeMenu(menu = openMenu): void {
    if (!menu) {
      return;
    }

    menu.hidden = true;
    const button = document.getElementById(menu.dataset.buttonId ?? "");
    button?.setAttribute("aria-expanded", "false");
    if (openMenu === menu) {
      openMenu = null;
    }
  }

  function closeAllMenusExcept(menu: HTMLDivElement): void {
    if (openMenu && openMenu !== menu) {
      closeMenu(openMenu);
    }
  }

  function positionMenu(button: HTMLButtonElement, menu: HTMLDivElement): void {
    const rect = button.getBoundingClientRect();
    const menuWidth = menu.offsetWidth || 230;
    const menuHeight = menu.offsetHeight || 0;
    const viewportPadding = 12;
    const left = Math.max(
      viewportPadding,
      Math.min(
        rect.right - menuWidth,
        window.innerWidth - menuWidth - viewportPadding,
      ),
    );
    const top = Math.max(
      viewportPadding,
      Math.min(
        rect.bottom + 10,
        window.innerHeight - menuHeight - viewportPadding,
      ),
    );

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function openControlMenu(
    button: HTMLButtonElement,
    menu: HTMLDivElement,
  ): void {
    closeAllMenusExcept(menu);
    menu.hidden = false;
    menu.style.visibility = "hidden";
    positionMenu(button, menu);
    menu.style.visibility = "";
    button.setAttribute("aria-expanded", "true");
    openMenu = menu;
  }

  function createMenuAction(
    label: string,
    onClick: () => Promise<unknown> | void,
  ): HTMLButtonElement {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "lgtmute-menu__item";
    action.textContent = label;
    action.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      await onClick();
    });
    return action;
  }

  function createControl(target: GitHubTarget): ControlElements {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.id = `lgtmute-button-${(controlId += 1)}`;
    button.title = `LGTMute actions for @${target.descriptor.author}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute(OWNED_ATTRIBUTE, "button");

    const mark = document.createElement("span");
    mark.className = "lgtmute-button__mark";
    mark.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "lgtmute-button__label";
    label.textContent = "LGTMute";
    const caret = document.createElement("span");
    caret.className = "lgtmute-button__caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "▾";
    button.append(mark, label, caret);

    const menu = document.createElement("div");
    menu.className = MENU_CLASS;
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.dataset.buttonId = button.id;
    menu.setAttribute(OWNED_ATTRIBUTE, "menu");
    document.body.append(menu);
    menu.append(
      createMenuAction(`Hide ${target.descriptor.label}`, () =>
        storage.hideComment(target.descriptor.commentKey),
      ),
      createMenuAction("Hide thread", () =>
        storage.hideThread(target.descriptor.threadKey),
      ),
      createMenuAction(`Mute @${target.descriptor.author} in this repo`, () =>
        storage.muteAuthor(
          target.descriptor.author,
          "repo",
          target.descriptor.repoKey,
        ),
      ),
      createMenuAction(`Mute @${target.descriptor.author} on GitHub`, () =>
        storage.muteAuthor(
          target.descriptor.author,
          "site",
          target.descriptor.repoKey,
        ),
      ),
    );

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (menu.hidden) {
        openControlMenu(button, menu);
        return;
      }

      closeMenu(menu);
    });

    return { button, menu };
  }

  function ensureControl(target: GitHubTarget): ControlElements {
    const existing = controls.get(target.root);
    target.mountPoint.classList.add("lgtmute-actions-anchor");
    if (existing) {
      if (!target.mountPoint.contains(existing.button)) {
        target.mountPoint.prepend(existing.button);
      }

      if (!document.body.contains(existing.menu)) {
        document.body.append(existing.menu);
      }

      return existing;
    }

    const control = createControl(target);
    target.mountPoint.prepend(control.button);
    controls.set(target.root, control);
    return control;
  }

  function removeControl(root: HTMLElement): void {
    const existing = controls.get(root);
    if (!existing) {
      return;
    }

    if (openMenu === existing.menu) {
      closeMenu(existing.menu);
    }

    existing.button.remove();
    existing.menu.remove();
    controls.delete(root);
  }

  function removePlaceholder(container: HTMLElement): void {
    const placeholder = placeholders.get(container);
    if (placeholder) {
      placeholder.remove();
      placeholders.delete(container);
    }
  }

  async function undoReason(reason: HideReason): Promise<void> {
    switch (reason.kind) {
      case "comment":
        await storage.removeComment(reason.key);
        return;
      case "thread":
        await storage.removeThread(reason.key);
        return;
      case "repo-author":
        await storage.removeMutedAuthor(reason.author, "repo", reason.repoKey);
        return;
      case "site-author":
        await storage.removeMutedAuthor(reason.author, "site", null);
        return;
    }
  }

  function placeholderActionLabel(reason: HideReason): string {
    switch (reason.kind) {
      case "comment":
      case "thread":
        return "Show again";
      case "repo-author":
        return "Unmute in repo";
      case "site-author":
        return "Unmute author";
    }
  }

  function placeholderMessage(
    reason: HideReason,
    target: GitHubTarget,
  ): string {
    switch (reason.kind) {
      case "comment":
        return `Hidden ${target.descriptor.label} by LGTMute`;
      case "thread":
        return "Hidden thread by LGTMute";
      case "repo-author":
        return `Muted @${reason.author} in ${reason.repoKey}`;
      case "site-author":
        return `Muted @${reason.author} across GitHub`;
    }
  }

  function ensurePlaceholder(
    container: HTMLElement,
    reason: HideReason,
    target: GitHubTarget,
  ): void {
    let placeholder = placeholders.get(container);
    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.className = PLACEHOLDER_CLASS;
      placeholder.setAttribute(OWNED_ATTRIBUTE, "placeholder");
      const title = document.createElement("div");
      title.className = "lgtmute-placeholder__title";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lgtmute-placeholder__action";
      placeholder.append(title, button);
      container.before(placeholder);
      placeholders.set(container, placeholder);
    }

    const [title, button] = placeholder.children as unknown as [
      HTMLDivElement,
      HTMLButtonElement,
    ];
    title.textContent = placeholderMessage(reason, target);
    button.textContent = placeholderActionLabel(reason);
    button.onclick = () => void undoReason(reason);
  }

  function applyVisibility(
    target: GitHubTarget,
    reason: HideReason | null,
  ): void {
    const threadContainer = target.threadRoot;

    if (!reason) {
      target.root.classList.remove("lgtmute-hidden");
      threadContainer.classList.remove("lgtmute-hidden");
      removePlaceholder(target.root);
      if (threadContainer !== target.root) {
        removePlaceholder(threadContainer);
      }
      return;
    }

    if (reason.kind === "thread") {
      target.root.classList.remove("lgtmute-hidden");
      if (target.root !== threadContainer) {
        removePlaceholder(target.root);
      }

      threadContainer.classList.add("lgtmute-hidden");
      ensurePlaceholder(threadContainer, reason, target);
      return;
    }

    threadContainer.classList.remove("lgtmute-hidden");
    if (threadContainer !== target.root) {
      removePlaceholder(threadContainer);
    }

    target.root.classList.add("lgtmute-hidden");
    ensurePlaceholder(target.root, reason, target);
  }

  function pruneStaleUi(targets: GitHubTarget[]): void {
    const activeRoots = new Set(targets.map((target) => target.root));
    const activePlaceholderContainers = new Set<HTMLElement>();

    for (const target of targets) {
      activePlaceholderContainers.add(target.root);
      activePlaceholderContainers.add(target.threadRoot);
    }

    for (const root of controls.keys()) {
      if (!activeRoots.has(root) || !document.contains(root)) {
        removeControl(root);
      }
    }

    for (const container of placeholders.keys()) {
      if (
        !activePlaceholderContainers.has(container) ||
        !document.contains(container)
      ) {
        removePlaceholder(container);
      }
    }
  }

  function collectTargets(): GitHubTarget[] {
    const targets: GitHubTarget[] = [];
    const seenRoots = new Set<HTMLElement>();

    for (const root of findObservationRoots()) {
      for (const target of findTargets(root)) {
        if (seenRoots.has(target.root)) {
          continue;
        }

        seenRoots.add(target.root);
        targets.push(target);
      }
    }

    return targets;
  }

  function sameObservedRoots(nextRoots: HTMLElement[]): boolean {
    return (
      nextRoots.length === observedRoots.length &&
      nextRoots.every((root, index) => observedRoots[index] === root)
    );
  }

  function dedupeObservedRoots(
    candidates: Iterable<HTMLElement>,
    observationRoots: HTMLElement[],
    observerRoots: HTMLElement[],
  ): HTMLElement[] {
    const nextRoots = [...observerRoots];

    for (const candidate of candidates) {
      const root =
        observationRoots.find((observationRoot) =>
          observationRoot.contains(candidate),
        ) ?? candidate;

      if (nextRoots.includes(root)) {
        continue;
      }

      nextRoots.push(root);
    }

    if (nextRoots.length > 0) {
      return nextRoots;
    }

    return observerRoots;
  }

  function syncObservedRoots(candidates: Iterable<HTMLElement>): void {
    if (!observer) {
      return;
    }

    const observationRoots = findObservationRoots();
    const observerRoots = findObserverRoots();
    const nextRoots = dedupeObservedRoots(
      candidates,
      observationRoots,
      observerRoots,
    );
    if (sameObservedRoots(nextRoots)) {
      return;
    }

    observer.disconnect();
    for (const root of nextRoots) {
      observer.observe(root, {
        childList: true,
        subtree: true,
      });
    }

    observedRoots = nextRoots;
  }

  function reconcileTargets(): void {
    if (!state) {
      return;
    }

    const targets = collectTargets();
    pruneStaleUi(targets);
    const controlRoots = pickControlRoots(targets, getViewerLogin());
    syncObservedRoots(targets.map((target) => target.threadRoot));

    for (const target of targets) {
      if (!state.enabled) {
        removeControl(target.root);
        applyVisibility(target, null);
        continue;
      }

      if (controlRoots.has(target.root)) {
        ensureControl(target);
      } else {
        removeControl(target.root);
      }
      applyVisibility(target, getHideReason(state, target.descriptor));
    }
  }

  function scheduleScan(): void {
    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      reconcileTargets();
    });
  }

  function attachGlobalListeners(): void {
    observer = new MutationObserver((records) => {
      if (shouldScheduleScan(records)) {
        scheduleScan();
      }
    });
    syncObservedRoots([]);

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Node && openMenu && !openMenu.contains(target)) {
        closeMenu(openMenu);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu(openMenu);
      }
    });

    window.addEventListener("resize", () => closeMenu(openMenu));
    document.addEventListener("scroll", () => closeMenu(openMenu), true);

    window.addEventListener("popstate", scheduleScan);
    document.addEventListener("pjax:end", scheduleScan);
    document.addEventListener("turbo:render", scheduleScan);
  }

  state = await storage.loadState();
  attachGlobalListeners();
  storage.onStateChange((nextState) => {
    state = nextState;
    scheduleScan();
  });
  scheduleScan();
}
