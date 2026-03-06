import {
  createScopedKey,
  extractCommentFragment,
  getPageKey,
  getRepositoryKey,
  normalizeLogin,
} from "../shared/github";
import type { TargetDescriptor } from "../shared/types";

const LEGACY_ROOT_SELECTORS = [
  ".js-comment-container",
  'div[id^="issuecomment-"]',
  'div[id^="discussioncomment-"]',
  'div[id^="discussion_r"]',
].join(",");

const MODERN_CANDIDATE_SELECTORS = [
  '[data-testid="issue-body"]',
  '[data-testid$="author"]',
  '[data-testid$="-link"]',
  '[data-testid="markdown-body"]',
].join(",");

const HEURISTIC_CANDIDATE_SELECTORS = [
  'a[href*="#issuecomment-"]',
  'a[href*="#discussioncomment-"]',
  'a[href*="#discussion_r"]',
  '[data-testid$="author"]',
  ".author",
  'button[aria-haspopup="true"]',
  'button[aria-haspopup="menu"]',
].join(",");

const AUTHOR_SELECTORS = [
  '[data-testid$="author"]',
  "a.author",
  ".author.Link--primary",
  'a[data-hovercard-type="user"][href^="/"]',
  '.timeline-comment-header-text a[href^="/"]',
  '.timeline-comment-header a[href^="/"]',
].join(",");

const ACTIONS_SELECTORS = [
  ".timeline-comment-actions",
  '[class*="actionsSection"]',
  '[class*="actionsWrapper"]',
  '[data-testid="comment-actions"]',
].join(",");

const THREAD_WRAPPER_SELECTORS = [
  ".js-resolvable-thread-timeline-thread-container",
  ".js-resolvable-timeline-thread-container",
  ".review-thread",
  ".timeline-comment-group",
].join(",");

const THREAD_FALLBACK_SELECTORS = [".js-comment-container"].join(",");

const COMMENT_LINK_SELECTORS = [
  'a[href*="#issue-"]',
  'a[href*="#issuecomment-"]',
  'a[href*="#discussioncomment-"]',
  'a[href*="#discussion_r"]',
  'a[href*="#pullrequestreview-"]',
  'a[href*="#commitcomment-"]',
  '[data-testid$="header-link"]',
].join(",");

const COMMENT_BODY_SELECTORS = [
  '[data-testid="markdown-body"]',
  ".markdown-body",
  ".comment-body",
  ".js-comment-body",
  "#issue-body-viewer",
  '[data-testid$="body-viewer"]',
  ".react-issue-body",
  "td.comment-body",
].join(",");

const SPECIFIC_OBSERVATION_ROOT_SELECTORS = [
  '[data-testid="issue-viewer-container"]',
  "#discussion_bucket",
  ".js-discussion",
].join(",");

const FALLBACK_OBSERVATION_ROOT_SELECTORS = ["main", '[role="main"]'].join(",");

export interface GitHubTarget {
  descriptor: TargetDescriptor;
  mountPoint: HTMLElement;
  root: HTMLElement;
  threadRoot: HTMLElement;
}

interface DetectionStrategy {
  candidates: string;
  resolveRoot(candidate: Element): HTMLElement | null;
}

let cachedEmbeddedAuthorPageKey: string | null = null;
let cachedEmbeddedAuthors = new Map<string, string>();

function getDepth(element: HTMLElement): number {
  let depth = 0;
  let current: HTMLElement | null = element;

  while (current) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function dedupeTopLevel(elements: Iterable<HTMLElement>): HTMLElement[] {
  const unique = Array.from(new Set(elements));
  unique.sort((left, right) => getDepth(left) - getDepth(right));

  const roots: HTMLElement[] = [];
  for (const candidate of unique) {
    if (roots.some((root) => root.contains(candidate))) {
      continue;
    }

    roots.push(candidate);
  }

  return roots;
}

function extractLoginFromLink(anchor: HTMLAnchorElement): string | null {
  try {
    const url = new URL(anchor.href, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) {
      return normalizeLogin(anchor.textContent);
    }

    return normalizeLogin(segments[0]);
  } catch {
    return normalizeLogin(anchor.textContent);
  }
}

function findAuthor(root: HTMLElement): string | null {
  const authorLink = root.querySelector(AUTHOR_SELECTORS);
  if (authorLink instanceof HTMLAnchorElement) {
    return extractLoginFromLink(authorLink);
  }

  const fragment = findFragment(root);
  if (fragment) {
    return getEmbeddedAuthorMap().get(fragment) ?? null;
  }

  return null;
}

function collectEmbeddedAuthors(
  value: unknown,
  authors: Map<string, string>,
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEmbeddedAuthors(item, authors);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : null;
  const author =
    record.author && typeof record.author === "object"
      ? (record.author as Record<string, unknown>)
      : null;
  const login =
    author && typeof author.login === "string"
      ? normalizeLogin(author.login)
      : null;
  const fragment = extractCommentFragment(url);

  if (fragment && login && !authors.has(fragment)) {
    authors.set(fragment, login);
  }

  for (const child of Object.values(record)) {
    collectEmbeddedAuthors(child, authors);
  }
}

function getEmbeddedAuthorMap(): Map<string, string> {
  const pageKey = getPageKey();
  if (cachedEmbeddedAuthorPageKey === pageKey) {
    return cachedEmbeddedAuthors;
  }

  cachedEmbeddedAuthorPageKey = pageKey;
  cachedEmbeddedAuthors = new Map<string, string>();

  const script = document.querySelector<HTMLScriptElement>(
    'script[data-target="react-app.embeddedData"]',
  );
  if (!script?.textContent) {
    return cachedEmbeddedAuthors;
  }

  try {
    collectEmbeddedAuthors(
      JSON.parse(script.textContent),
      cachedEmbeddedAuthors,
    );
  } catch {
    cachedEmbeddedAuthors = new Map<string, string>();
  }

  return cachedEmbeddedAuthors;
}

function findMountPoint(root: HTMLElement): HTMLElement | null {
  const directMatch = root.querySelector(ACTIONS_SELECTORS);
  if (directMatch instanceof HTMLElement) {
    return directMatch;
  }

  const menuButton = root.querySelector('button[aria-haspopup="true"]');
  if (menuButton?.parentElement instanceof HTMLElement) {
    return menuButton.parentElement;
  }

  return null;
}

function findFragment(root: HTMLElement): string | null {
  const directId = extractCommentFragment(root.id);
  if (directId) {
    return directId;
  }

  for (const anchor of root.querySelectorAll(COMMENT_LINK_SELECTORS)) {
    if (!(anchor instanceof HTMLAnchorElement)) {
      continue;
    }

    const fragment = extractCommentFragment(anchor.href);
    if (fragment) {
      return fragment;
    }
  }

  return null;
}

function findCommentBody(root: HTMLElement): HTMLElement | null {
  const body = root.querySelector(COMMENT_BODY_SELECTORS);
  return body instanceof HTMLElement ? body : null;
}

function hasCommentSignature(root: HTMLElement): boolean {
  return Boolean(
    findAuthor(root) &&
    findFragment(root) &&
    findMountPoint(root) &&
    findCommentBody(root),
  );
}

function isModernContainer(root: HTMLElement): boolean {
  if (root.matches('[data-testid="issue-body"]')) {
    return true;
  }

  if (root.hasAttribute("data-testid")) {
    return true;
  }

  return /IssueBody|Comment/i.test(root.className);
}

function findLegacyRoot(candidate: Element): HTMLElement | null {
  const root =
    candidate instanceof HTMLElement && candidate.matches(LEGACY_ROOT_SELECTORS)
      ? candidate
      : candidate.closest(LEGACY_ROOT_SELECTORS);

  return root instanceof HTMLElement ? root : null;
}

function walkAncestorTree(
  candidate: Element,
  matcher: (root: HTMLElement) => boolean,
): HTMLElement | null {
  let current: HTMLElement | null =
    candidate instanceof HTMLElement ? candidate : candidate.parentElement;

  while (current && current !== document.body) {
    if (matcher(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findModernRoot(candidate: Element): HTMLElement | null {
  const issueBody =
    candidate instanceof HTMLElement &&
    candidate.matches('[data-testid="issue-body"]')
      ? candidate
      : candidate.closest('[data-testid="issue-body"]');

  if (issueBody instanceof HTMLElement) {
    return issueBody;
  }

  return walkAncestorTree(
    candidate,
    (root) => isModernContainer(root) && hasCommentSignature(root),
  );
}

function findHeuristicRoot(candidate: Element): HTMLElement | null {
  return walkAncestorTree(candidate, hasCommentSignature);
}

function findThreadRoot(root: HTMLElement): HTMLElement {
  const wrapper = root.parentElement?.closest(THREAD_WRAPPER_SELECTORS);
  if (wrapper instanceof HTMLElement) {
    return wrapper;
  }

  return (
    (root.closest(THREAD_FALLBACK_SELECTORS) as HTMLElement | null) ?? root
  );
}

function inferLabel(root: HTMLElement): "post" | "reply" {
  return root.matches('[data-testid="issue-body"]') ? "post" : "reply";
}

function buildTarget(root: HTMLElement): GitHubTarget | null {
  const author = findAuthor(root);
  const commentFragment = findFragment(root);
  const mountPoint = findMountPoint(root);
  const commentBody = findCommentBody(root);
  const repoKey = getRepositoryKey();

  if (!author || !commentFragment || !mountPoint || !commentBody || !repoKey) {
    return null;
  }

  const pageKey = getPageKey();
  const threadRoot = findThreadRoot(root);
  const threadFragment = findFragment(threadRoot) ?? commentFragment;

  return {
    descriptor: {
      author,
      commentKey: createScopedKey(pageKey, commentFragment, "comment"),
      threadKey: createScopedKey(pageKey, threadFragment, "thread"),
      repoKey,
      label: inferLabel(root),
    },
    mountPoint,
    root,
    threadRoot,
  };
}

const DETECTION_STRATEGIES: DetectionStrategy[] = [
  {
    candidates: MODERN_CANDIDATE_SELECTORS,
    resolveRoot: findModernRoot,
  },
  {
    candidates: LEGACY_ROOT_SELECTORS,
    resolveRoot: findLegacyRoot,
  },
  {
    candidates: HEURISTIC_CANDIDATE_SELECTORS,
    resolveRoot: findHeuristicRoot,
  },
];

export function findObservationRoots(
  root: ParentNode = document,
): HTMLElement[] {
  const specificRoots = Array.from(
    root.querySelectorAll<HTMLElement>(SPECIFIC_OBSERVATION_ROOT_SELECTORS),
  );
  if (specificRoots.length > 0) {
    return dedupeTopLevel(specificRoots);
  }

  const fallbackRoots = Array.from(
    root.querySelectorAll<HTMLElement>(FALLBACK_OBSERVATION_ROOT_SELECTORS),
  );
  if (fallbackRoots.length > 0) {
    return dedupeTopLevel(fallbackRoots);
  }

  if (root instanceof HTMLElement) {
    return [root];
  }

  if (document.body instanceof HTMLElement) {
    return [document.body];
  }

  return document.documentElement instanceof HTMLElement
    ? [document.documentElement]
    : [];
}

export function findObserverRoots(root: ParentNode = document): HTMLElement[] {
  const observationRoots = findObservationRoots(root);
  const fallbackRoots = Array.from(
    root.querySelectorAll<HTMLElement>(FALLBACK_OBSERVATION_ROOT_SELECTORS),
  );

  if (fallbackRoots.length === 0) {
    return observationRoots;
  }

  return dedupeTopLevel([...observationRoots, ...fallbackRoots]);
}

export function findTargets(root: ParentNode = document): GitHubTarget[] {
  const seenRoots = new Set<HTMLElement>();
  const seenCommentKeys = new Set<string>();
  const targets: GitHubTarget[] = [];

  for (const strategy of DETECTION_STRATEGIES) {
    root.querySelectorAll(strategy.candidates).forEach((candidate) => {
      const resolvedRoot = strategy.resolveRoot(candidate);
      if (!resolvedRoot || seenRoots.has(resolvedRoot)) {
        return;
      }

      const target = buildTarget(resolvedRoot);
      if (!target) {
        return;
      }

      if (seenCommentKeys.has(target.descriptor.commentKey)) {
        return;
      }

      seenRoots.add(resolvedRoot);
      seenCommentKeys.add(target.descriptor.commentKey);
      targets.push(target);
    });
  }

  return targets;
}
