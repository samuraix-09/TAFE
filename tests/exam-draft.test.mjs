import test from "node:test";
import assert from "node:assert/strict";
import {
  hasExamAnswer,
  readActiveExam,
  rememberActiveExam,
  readExamDraft,
  sameExamAnswer,
  storeExamDraft,
} from "../src/exam-draft.ts";

const storage = new Map();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    setItem: (key, value) => storage.set(key, value),
    getItem: (key) => storage.get(key),
    removeItem: (key) => storage.delete(key),
  },
});

test("restores only changes for the same attempt and module", () => {
  storeExamDraft("attempt-a", 1, { one: "A" }, { one: "B", two: "C" });
  assert.deepEqual(readExamDraft("attempt-a", 1, { one: "A" }, ["one"]), {
    one: "B",
  });
  assert.deepEqual(readExamDraft("attempt-a", 2, {}, ["one", "two"]), {});
  assert.deepEqual(readExamDraft("attempt-b", 1, {}, ["one", "two"]), {});
});

test("preserves a newer server answer and clears acknowledged drafts", () => {
  storeExamDraft("attempt-c", null, { one: "A" }, { one: "B" });
  assert.deepEqual(readExamDraft("attempt-c", null, { one: "C" }, ["one"]), {});
  storeExamDraft("attempt-c", null, { one: "B" }, { one: "B" });
  assert.deepEqual(readExamDraft("attempt-c", null, {}, ["one"]), {});
});

test("compares grouped answers with unordered keys and keeps false or zero answers", () => {
  assert.equal(
    sameExamAnswer({ x: "A", y: ["B"] }, { y: ["B"], x: "A" }),
    true,
  );
  assert.equal(sameExamAnswer(["A", "B"], ["B", "A"]), false);
  assert.equal(hasExamAnswer({ x: " ", y: [] }), false);
  assert.equal(hasExamAnswer(false), true);
  assert.equal(hasExamAnswer(0), true);
});

test("recovers only the current learner’s existing attempt and clears the pointer on completion", () => {
  const attempt = {
    id: "c3000000-0000-4000-8000-000000000002",
    category: "SAT",
    section: "Math",
  };
  rememberActiveExam("one", attempt);
  assert.deepEqual(readActiveExam("one"), attempt);
  assert.equal(readActiveExam("two"), null);
  rememberActiveExam("one", { ...attempt, id: "invalid" });
  assert.equal(readActiveExam("one"), null);
  rememberActiveExam("one", attempt);
  rememberActiveExam("one", null);
  assert.equal(readActiveExam("one"), null);
});
