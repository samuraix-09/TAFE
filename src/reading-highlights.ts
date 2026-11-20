export type MarkRange = { start: number; end: number; color?: string };

export function normalizeReadingMarks(
  value: unknown,
  length: number,
): MarkRange[] {
  if (!Array.isArray(value)) return [];
  const result: MarkRange[] = [];
  const ranges = value
    .filter(
      (range): range is MarkRange =>
        range &&
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        range.start >= 0 &&
        range.end <= length &&
        range.end > range.start,
    )
    .sort((a, b) => a.start - b.start);
  for (const range of ranges) {
    const last = result.at(-1);
    if (last && range.start <= last.end && last.color === range.color)
      last.end = Math.max(last.end, range.end);
    else result.push({ ...range });
  }
  return result;
}

export function removeReadingMark(
  marks: MarkRange[],
  selected: MarkRange,
): MarkRange[] {
  return marks.flatMap((mark) => {
    if (mark.end <= selected.start || mark.start >= selected.end) return [mark];
    const next: MarkRange[] = [];
    if (mark.start < selected.start)
      next.push({ ...mark, end: selected.start });
    if (mark.end > selected.end) next.push({ ...mark, start: selected.end });
    return next;
  });
}

export function readingSelection(
  root: HTMLElement,
  selection: Selection | null,
): MarkRange | null {
  if (
    !selection?.rangeCount ||
    selection.isCollapsed ||
    !selection.toString().trim()
  )
    return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const preceding = root.ownerDocument.createRange();
  preceding.selectNodeContents(root);
  preceding.setEnd(range.startContainer, range.startOffset);
  const start = preceding.toString().length;
  preceding.setEnd(range.endContainer, range.endOffset);
  return { start, end: preceding.toString().length };
}
