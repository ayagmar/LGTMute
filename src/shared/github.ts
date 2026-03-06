const COMMENT_FRAGMENT_PATTERNS = [
  /^issue-\d+$/,
  /^issuecomment-\d+$/,
  /^discussioncomment-\d+$/,
  /^discussion_r\d+$/,
  /^pullrequestreview-\d+$/,
  /^commitcomment-\d+$/,
];

export function getRepositoryKey(
  pathname = window.location.pathname,
): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) {
    return null;
  }

  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export function getPageKey(url = window.location): string {
  return `${url.origin}${url.pathname}`;
}

export function getViewerLogin(root: ParentNode = document): string | null {
  const meta = root.querySelector<HTMLMetaElement>(
    'meta[name="user-login"],meta[name="octolytics-actor-login"]',
  );
  return normalizeLogin(meta?.content);
}

export function normalizeLogin(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.replace(/^@/, "").trim().toLowerCase();
  return trimmed || null;
}

export function extractCommentFragment(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const hash = value.includes("#")
    ? value.slice(value.indexOf("#") + 1)
    : value;
  const trimmed = hash.trim();

  if (!trimmed) {
    return null;
  }

  return COMMENT_FRAGMENT_PATTERNS.some((pattern) => pattern.test(trimmed))
    ? trimmed
    : null;
}

export function createScopedKey(
  pageKey: string,
  fragment: string,
  kind: "comment" | "thread",
): string {
  return `${kind}:${pageKey}#${fragment}`;
}
