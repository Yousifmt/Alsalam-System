// src/utils/quizzes.ts
import type { Quiz, CourseTag } from "@/lib/types";

export type SafeCourseTag = "unassigned" | "security+" | "a+";

const VALID: SafeCourseTag[] = ["unassigned", "security+", "a+"];

export function asCourseTag(v: any): SafeCourseTag {
  return VALID.includes(v) ? (v as SafeCourseTag) : "unassigned";
}

/** Normalize a quiz's course/core locally (no writes). */
export function normalizeQuizCourse(q: Quiz): Quiz & { course: SafeCourseTag } {
  const course = asCourseTag((q as any).course);
  // keep core only for A+; otherwise remove it from the object we render with
  const core =
    course === "a+"
      ? (["core1", "core2", "unassigned"].includes((q as any).core)
          ? (q as any).core
          : "unassigned")
      : undefined;

  const clone: any = { ...q, course };
  if (course === "a+") clone.core = core;
  else delete clone.core;
  return clone;
}

/** Always returns a fully-initialized bucket object. */
export function groupByCourseTag(
  quizzes: Quiz[] | undefined | null
): Record<SafeCourseTag, Quiz[]> {
  const buckets: Record<SafeCourseTag, Quiz[]> = {
    unassigned: [],
    "security+": [],
    "a+": [],
  };

  for (const raw of quizzes ?? []) {
    const q = normalizeQuizCourse(raw);
    // q.course is guaranteed to be "unassigned" | "security+" | "a+"
    buckets[q.course].push(q);
  }
  return buckets;
}
