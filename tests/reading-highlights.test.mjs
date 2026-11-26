import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReadingMarks,
  removeReadingMark,
} from "../src/reading-highlights.ts";

test("combines overlapping marks and rejects invalid or old ranges", () => {
  assert.deepEqual(
    normalizeReadingMarks(
      [
        { start: 7, end: 10 },
        { start: 2, end: 8 },
        { start: 10, end: 11 },
        null,
        { start: -1, end: 4 },
        { start: 15, end: 40 },
        { start: 12, end: 12 },
      ],
      20,
    ),
    [{ start: 2, end: 11 }],
  );
});

test("removes only the highlighted part under the selection", () => {
  assert.deepEqual(
    removeReadingMark(
      [
        { start: 2, end: 11 },
        { start: 14, end: 19 },
      ],
      { start: 5, end: 8 },
    ),
    [
      { start: 2, end: 5 },
      { start: 8, end: 11 },
      { start: 14, end: 19 },
    ],
  );
  assert.deepEqual(
    removeReadingMark([{ start: 2, end: 5 }], { start: 0, end: 7 }),
    [],
  );
});
