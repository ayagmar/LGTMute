export const PAGE_SIZE = 25;

export type SectionKey =
  | "siteAuthors"
  | "repoAuthors"
  | "hiddenComments"
  | "hiddenThreads";

export function formatScopedKey(
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

export function getPageMeta(
  page: number,
  totalItems: number,
): {
  page: number;
  totalPages: number;
  start: number;
  end: number;
} {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  return {
    page: normalizedPage,
    totalPages,
    start,
    end,
  };
}
