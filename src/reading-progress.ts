export type ReadingProgress = { bookId: string; path: string; page: number };

export function readReadingProgress(userId?: string): ReadingProgress | null {
  if (!userId) return null;
  try {
    const value = JSON.parse(
      localStorage.getItem("tafe-last-reading:" + userId) || "null",
    );
    return value &&
      typeof value.bookId === "string" &&
      typeof value.path === "string" &&
      Number.isSafeInteger(value.page) &&
      value.page > 0
      ? value
      : null;
  } catch {
    return null;
  }
}
