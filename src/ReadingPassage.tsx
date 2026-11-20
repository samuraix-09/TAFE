import { useEffect, useRef, useState } from "react";
import { Eraser, Highlighter } from "lucide-react";
import { t } from "./i18n";
import {
  normalizeReadingMarks,
  readingSelection,
  removeReadingMark,
  type MarkRange,
} from "./reading-highlights";

export function ReadingPassage({
  attemptId,
  text,
  activePart,
}: {
  attemptId: string;
  text: string;
  activePart?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<MarkRange | null>(null);
  const [notice, setNotice] = useState("");
  const key = "tafe-reading-marks-" + attemptId;
  const [marks, setMarks] = useState<MarkRange[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      return saved?.text === text
        ? normalizeReadingMarks(saved.marks, text.length)
        : [];
    } catch {
      return [];
    }
  });
  const headings = Array.from(
    text.matchAll(/^([A-Z])[.)]\s+[^\n]{1,105}$/gm),
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
      part: match[1],
    }),
  );

  useEffect(() => {
    const read = () => {
      if (!body.current) return;
      const selected = readingSelection(body.current, document.getSelection());
      if (selected || !tools.current?.contains(document.activeElement))
        setSelection(selected);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);

  useEffect(() => {
    if (!activePart || !/^[A-Z]$/.test(activePart)) return;
    body.current
      ?.querySelector(`[data-passage-part="${activePart}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [activePart]);

  function changeMark(remove: boolean) {
    if (!selection) return;
    const updated = remove
      ? removeReadingMark(marks, selection)
      : normalizeReadingMarks([...marks, selection], text.length);
    setMarks(updated);
    try {
      localStorage.setItem(key, JSON.stringify({ text, marks: updated }));
    } catch {
      /* Marks remain visible in this attempt. */
    }
    document.getSelection()?.removeAllRanges();
    setSelection(null);
    setNotice(t(remove ? "Belgi olib tashlandi" : "Matn belgilandi"));
  }

  function renderRange(start: number, end: number) {
    let cursor = start;
    const parts = [];
    for (const mark of marks) {
      if (mark.end <= start || mark.start >= end) continue;
      const left = Math.max(start, mark.start);
      const right = Math.min(end, mark.end);
      parts.push(
        text.slice(cursor, left),
        <mark key={left}>{text.slice(left, right)}</mark>,
      );
      cursor = right;
    }
    return [...parts, text.slice(cursor, end)];
  }

  const blocks = [];
  let cursor = 0;
  for (const heading of headings) {
    blocks.push(...renderRange(cursor, heading.start));
    blocks.push(
      <strong
        className="ielts-reading-heading"
        key={heading.start}
        data-passage-part={heading.part}
      >
        {renderRange(heading.start, heading.end)}
      </strong>,
    );
    cursor = heading.end;
  }
  blocks.push(...renderRange(cursor, text.length));
  const markedSelection =
    selection &&
    marks.some(
      (mark) => mark.start < selection.end && mark.end > selection.start,
    );
  return (
    <>
      <div className="ielts-reading-tools" ref={tools}>
        <button
          type="button"
          disabled={!selection}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeMark(false)}
        >
          <Highlighter size={16} aria-hidden="true" /> {t("Matnni belgilash")}
        </button>
        <button
          type="button"
          disabled={!markedSelection}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeMark(true)}
        >
          <Eraser size={16} aria-hidden="true" /> {t("Belgini olib tashlash")}
        </button>
        <span className="ielts-reading-notice" role="status">
          {notice}
        </span>
      </div>
      <div className="ielts-reading-text" ref={body}>
        {blocks}
      </div>
    </>
  );
}
