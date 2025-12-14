// FILE: src/app/dashboard/quizzes/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

import { BatchGradesDashboard } from "@/components/dashboard/batch-grades-dashboard";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  PlusCircle,
  ArrowRight,
  History,
  BarChart,
  Percent,
  Edit,
  Loader2,
  GripVertical,
  Shield,
  Cpu,
  MoreVertical,
  EyeOff,
  Eye,
  Trash2,
  RefreshCcw,
  KeyRound,
  Archive,
  ArchiveRestore,
} from "lucide-react";

import dynamicImport from "next/dynamic";
import type { DropResult } from "@hello-pangea/dnd";

import type { Quiz } from "@/lib/types";
import {
  getQuizzesForUser,
  getQuizzes,
  getAllResultsForQuiz,
  saveQuizOrder,
  updateQuizFields,
  deleteQuiz,
} from "@/services/quiz-service";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { groupByCourseTag as groupByCourseSafe, normalizeQuizCourse } from "@/utils/quizzes";

/* DnD lazy imports */
const DragDropContext = dynamicImport(() => import("@hello-pangea/dnd").then((m) => m.DragDropContext), { ssr: false });
const Droppable = dynamicImport(() => import("@hello-pangea/dnd").then((m) => m.Droppable), { ssr: false });
const Draggable = dynamicImport(() => import("@hello-pangea/dnd").then((m) => m.Draggable), { ssr: false });

/* ────────────────────────────────────────────────────────────────
   Types / constants
──────────────────────────────────────────────────────────────── */
type CourseTag = "security+" | "a+" | "unassigned";
type StudentCourseTag = "security+" | "a+";
type AdminFilter = "all" | "security+" | "a+" | "hidden";

type APlusCore = "core1" | "core2" | "unassigned";
const CORE_ORDER: APlusCore[] = ["core1", "core2", "unassigned"];

const COURSE_PASSWORDS: Record<StudentCourseTag, string> = {
  "security+": "sy0-701",
  "a+": "202-1201",
};

const ADMIN_OVERRIDE_CODE = "353535";
const AVG_CONCURRENCY = 6;

/* ────────────────────────────────────────────────────────────────
   Utils
──────────────────────────────────────────────────────────────── */
function normalizeStudentCourseTag(x: any): StudentCourseTag | null {
  const v = (x ?? "").toString().trim().toLowerCase();
  return v === "security+" || v === "a+" ? (v as StudentCourseTag) : null;
}

function getBadgeVariant(status: string) {
  switch (status) {
    case "Completed":
      return "default";
    case "Not Submitted":
      return "secondary";
    case "Archived":
      return "outline";
    default:
      return "outline";
  }
}

const isArchived = (q: any) => {
  if (q?.archived === true) return true;
  const s = (q?.status ?? q?.state ?? q?.lifecycle ?? "")
    .toString()
    .trim()
    .toLowerCase();
  return s === "archived" || s === "archive" || q?.isArchived === true || q?.deleted === true;
};
const isHidden = (q: any) => q?.hidden === true;

const courseOf = (q: any): CourseTag => (q?.course as CourseTag) ?? "unassigned";
const coreOf = (q: any): APlusCore => (q?.core as APlusCore) ?? "unassigned";

function computeAverage(results: any[]) {
  if (!results?.length) return null;
  const avg = results.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / results.length;
  return Math.round(avg);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return out;
}

/* ────────────────────────────────────────────────────────────────
   Skeletons & layout helpers
──────────────────────────────────────────────────────────────── */
function QuizCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Wrapper
──────────────────────────────────────────────────────────────── */
export default function QuizzesClient() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 w-40 bg-muted rounded" />
              <div className="mt-2 h-4 w-64 bg-muted rounded" />
            </div>
            <div className="h-10 w-40 bg-muted rounded" />
          </div>
          <Grid>
            {[...Array(3)].map((_, i) => (
              <QuizCardSkeleton key={i} />
            ))}
          </Grid>
        </div>
      }
    >
      <QuizzesPageInner />
    </Suspense>
  );
}

/* ────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────── */
function QuizzesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ IMPORTANT: depend on primitive value, NOT the params object
  const choose = searchParams.get("choose") === "1";

  const { role, user } = useAuth();
  const roleIsAdmin = role === "admin";
  const roleReady = role === "admin" || role === "student";
  const userId = user?.uid ?? null;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // averages (admin) computed in background
  const [averageScores, setAverageScores] = useState<Record<string, number | null>>({});
  const [adminAveragesLoading, setAdminAveragesLoading] = useState(false);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [beforeDnD, setBeforeDnD] = useState<Quiz[] | null>(null);

  // STUDENT: state
  const [studentCourse, setStudentCourse] = useState<StudentCourseTag | null>(null);

  // Initial choose
  const [showInitialChooser, setShowInitialChooser] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<StudentCourseTag | null>(null);
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [initialSubmitting, setInitialSubmitting] = useState(false);

  // Re-assign
  const [showReassignPanel, setShowReassignPanel] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [reassignCourse, setReassignCourse] = useState<StudentCourseTag | null>(null);
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // ADMIN filter
  const [adminFilter, setAdminFilter] = useState<AdminFilter>("all");

  // STUDENT A+ filter
  type StudentAPlusFilter = "all" | "core1" | "core2";
  const [studentAPlusFilter, setStudentAPlusFilter] = useState<StudentAPlusFilter>("all");

  // cancel token for background jobs
  const avgJobId = useRef(0);

  // ✅ only reacts to boolean choose (not params object)
  useEffect(() => {
    if (choose) setShowInitialChooser(true);
  }, [choose]);

  useEffect(() => {
    if (!roleReady || !userId) return;

    const run = async () => {
      setLoading(true);
      try {
        const fetched = roleIsAdmin ? await getQuizzes() : await getQuizzesForUser(userId);
        const normalized = (fetched ?? []).map(normalizeQuizCourse);
        setQuizzes(normalized);

        if (roleIsAdmin) {
          // background averages
          const myJob = ++avgJobId.current;
          setAdminAveragesLoading(true);

          void (async () => {
            try {
              const list = normalized; // compute for all (or you can filter to visible only)
              const pairs = await mapWithConcurrency(
                list,
                AVG_CONCURRENCY,
                async (q) => {
                  const results = await getAllResultsForQuiz(q.id);
                  return { id: q.id, avg: computeAverage(results) as number | null };
                },
              );

              if (avgJobId.current !== myJob) return;

              const next: Record<string, number | null> = {};
              for (const p of pairs) next[p.id] = p.avg;
              setAverageScores(next);
            } catch (e) {
              console.error("Failed to compute averages:", e);
            } finally {
              if (avgJobId.current === myJob) setAdminAveragesLoading(false);
            }
          })();
        } else {
          // student course
          const snap = await getDoc(doc(db, "users", userId));
          const data: any = snap.exists() ? snap.data() : {};
          const current = normalizeStudentCourseTag(data.courseTag);
          const locked = !!data.courseLocked;

          if (current) {
            setStudentCourse(current);
            setShowInitialChooser(false);
          } else {
            setStudentCourse(null);
            setShowInitialChooser(true);
          }

          // if forced choose, only matters when no course set
          if (!current && choose) setShowInitialChooser(true);

          if (locked && current) setShowInitialChooser(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    run();

    // cancel background averages when rerun/unmount
    return () => {
      avgJobId.current += 1;
    };
  }, [roleReady, roleIsAdmin, userId, choose]);

  /* ── Filters ─────────────────────────────────────────────── */

  const adminQuizzes = useMemo(() => {
    if (adminFilter === "hidden") return quizzes.filter((q) => isHidden(q));
    const base = quizzes.filter((q) => !isHidden(q));
    if (adminFilter === "all") return base;
    return base.filter((q) => courseOf(q) === (adminFilter as CourseTag));
  }, [quizzes, adminFilter]);

  const studentQuizzes = useMemo(() => {
    const base = quizzes.filter((q) => !isArchived(q) && !isHidden(q));
    let filtered: Quiz[];

    if (!studentCourse) {
      filtered = base.filter((q) => courseOf(q) === "unassigned");
    } else {
      filtered = base.filter((q) => {
        const c: CourseTag = courseOf(q);
        return c === "unassigned" || c === studentCourse;
      });
    }

    return sortQuizzes(filtered);
  }, [quizzes, studentCourse]);

  /* ── Sorting & Grouping ───────────────────────────────────── */

  function sortQuizzes(arr: Quiz[]): Quiz[] {
    return [...arr].sort((a: any, b: any) => {
      const ao = typeof a?.order === "number" ? a.order : -1;
      const bo = typeof b?.order === "number" ? b.order : -1;
      if (ao !== bo) return ao - bo;
      return (a.title || "").localeCompare(b.title || "");
    });
  }

  function groupByCourseTagSafeWrapper(arr: Quiz[]): Record<CourseTag, Quiz[]> {
    const grouped = groupByCourseSafe(arr);
    return {
      "security+": sortQuizzes(grouped["security+"]),
      "a+": sortQuizzes(grouped["a+"]),
      unassigned: sortQuizzes(grouped["unassigned"]),
    };
  }

  function groupAPlusByCore(arr: Quiz[]): Record<APlusCore, Quiz[]> {
    const groups: Record<APlusCore, Quiz[]> = { core1: [], core2: [], unassigned: [] };
    for (const q of arr) groups[coreOf(q)].push(q);
    for (const key of CORE_ORDER) groups[key] = sortQuizzes(groups[key]);
    return groups;
  }

  /* ── DnD (admin) ─────────────────────────────────────────── */

  function buildAdminDroppableMap(list: Quiz[]): Record<string, Quiz[]> {
    const byCourse = groupByCourseTagSafeWrapper(list);
    return {
      "security+": byCourse["security+"],
      "a+": byCourse["a+"],
      unassigned: byCourse["unassigned"],
    };
  }

  function droppableOrderForAdmin(): string[] {
    if (adminFilter === "security+") return ["security+"];
    if (adminFilter === "a+") return ["a+"];
    if (adminFilter === "hidden") return ["security+", "a+", "unassigned"];
    return ["security+", "a+", "unassigned"];
  }

  function labelForDroppable(id: string): string {
    if (id === "security+") return "SECURITY+";
    if (id === "a+") return "A+";
    if (id === "unassigned") return "UNASSIGNED COURSE";
    return id.toUpperCase();
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) return;

    const map = buildAdminDroppableMap(adminQuizzes);
    const srcId = source.droppableId;

    const list = [...(map[srcId] ?? [])];
    const [moved] = list.splice(source.index, 1);
    list.splice(destination.index, 0, moved);
    map[srcId] = list;

    const order = droppableOrderForAdmin();
    const visibleCombined = order.flatMap((id) => map[id] ?? []);
    const visibleIds = new Set(visibleCombined.map((q) => q.id));
    const others = quizzes.filter((q) => !visibleIds.has(q.id));
    const next = [...visibleCombined, ...others];

    setBeforeDnD(quizzes);
    setQuizzes(next);

    const pairs = next.map((q, i) => ({ id: q.id, order: (i + 1) * 1000 }));
    try {
      setSavingOrder(true);
      await saveQuizOrder(pairs);
      setQuizzes((prev) =>
        prev.map((q) => {
          const p = pairs.find((x) => x.id === q.id);
          return p ? ({ ...q, order: p.order } as Quiz) : q;
        }),
      );
    } catch (e) {
      console.error("Failed to save order:", e);
      if (beforeDnD) setQuizzes(beforeDnD);
    } finally {
      setSavingOrder(false);
      setBeforeDnD(null);
    }
  }

  /* ── Course flows ─────────────────────────────────────────── */

  async function confirmInitialCourse() {
    if (!pendingCourse || !userId) return;
    setInitialSubmitting(true);
    try {
      const expected = COURSE_PASSWORDS[pendingCourse].toLowerCase().trim();
      const given = courseCodeInput.toLowerCase().trim();
      if (expected !== given) {
        setInitialSubmitting(false);
        return alert("Invalid course code.");
      }

      await setDoc(
        doc(db, "users", userId),
        {
          courseTag: pendingCourse,
          courseLocked: true,
          courseSetAt: serverTimestamp(),
        },
        { merge: true },
      );

      setStudentCourse(pendingCourse);
      setShowInitialChooser(false);
      setPendingCourse(null);
      setCourseCodeInput("");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to set course. Please try again.");
    } finally {
      setInitialSubmitting(false);
    }
  }

  async function confirmReassignCourse() {
    if (!userId || !reassignCourse) return;
    setReassignSubmitting(true);
    try {
      if (adminCodeInput.trim() !== ADMIN_OVERRIDE_CODE) {
        setReassignSubmitting(false);
        return alert("Admin code is incorrect.");
      }

      await setDoc(
        doc(db, "users", userId),
        {
          courseTag: reassignCourse,
          courseLocked: true,
          courseReassignedAt: serverTimestamp(),
          courseOverride: true,
        },
        { merge: true },
      );

      setStudentCourse(reassignCourse);
      setShowReassignPanel(false);
      setReassignCourse(null);
      setAdminCodeInput("");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to re-assign course.");
    } finally {
      setReassignSubmitting(false);
    }
  }

  function openReassignPanel() {
    setShowReassignPanel(true);
    setReassignCourse(null);
    setAdminCodeInput("");
  }

  /* ── Actions ──────────────────────────────────────────────── */

  function StatusBadge({ quiz }: { quiz: Quiz }) {
    const status =
      (quiz as any)?.archived === true
        ? "Archived"
        : quiz.results && quiz.results.length > 0
        ? "Completed"
        : (quiz as any).status === "Not Started"
        ? "Not Submitted"
        : (quiz as any).status;

    return (
      <Badge variant={getBadgeVariant(status)} className="whitespace-nowrap shrink-0">
        {status}
      </Badge>
    );
  }

  async function handleHide(quizId: string) {
    try {
      setLoadingAction(`hide-${quizId}`);
      await updateQuizFields(quizId, { hidden: true });
    } finally {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quizId ? (normalizeQuizCourse({ ...q, hidden: true } as any) as any) : q,
        ),
      );
      setLoadingAction(null);
    }
  }

  async function handleUnhide(quizId: string) {
    try {
      setLoadingAction(`unhide-${quizId}`);
      await updateQuizFields(quizId, { hidden: false });
    } finally {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quizId ? (normalizeQuizCourse({ ...q, hidden: false } as any) as any) : q,
        ),
      );
      setLoadingAction(null);
    }
  }

  async function handleDelete(quizId: string) {
    try {
      setLoadingAction(`delete-${quizId}`);
      await deleteQuiz(quizId);
    } finally {
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      setLoadingAction(null);
    }
  }

  async function handleArchive(quizId: string) {
    try {
      setLoadingAction(`archive-${quizId}`);
      await updateQuizFields(quizId, { status: "Archived", archived: true } as any);
    } finally {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quizId
            ? (normalizeQuizCourse({ ...q, status: "Archived", archived: true } as any) as any)
            : q,
        ),
      );
      setLoadingAction(null);
    }
  }

  async function handleUnarchive(quizId: string) {
    try {
      setLoadingAction(`unarchive-${quizId}`);
      await updateQuizFields(quizId, { status: "Not Started", archived: false } as any);
    } finally {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quizId
            ? (normalizeQuizCourse({ ...q, status: "Not Started", archived: false } as any) as any)
            : q,
        ),
      );
      setLoadingAction(null);
    }
  }

  function AdminQuizCard({ quiz, average }: { quiz: Quiz; average: number | null | undefined }) {
    const isActionLoading = (action: string) => loadingAction === `${action}-${quiz.id}`;
    const archived = isArchived(quiz);

    return (
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <span className="mr-2">{quiz.title}</span>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                {(quiz as any).course && (quiz as any).course !== "unassigned" && (
                  <Badge variant="outline" className="whitespace-nowrap">
                    {String((quiz as any).course).toUpperCase()}
                  </Badge>
                )}
                {archived && (
                  <Badge variant={getBadgeVariant("Archived")} className="whitespace-nowrap">
                    Archived
                  </Badge>
                )}
                {isHidden(quiz) && (
                  <Badge variant="destructive" className="whitespace-nowrap">
                    Hidden
                  </Badge>
                )}
              </span>
            </CardTitle>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                  aria-label="More actions"
                  title="More actions"
                >
                  {loadingAction?.endsWith(quiz.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                {archived ? (
                  <DropdownMenuItem onClick={() => handleUnarchive(quiz.id)} className="cursor-pointer">
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Unarchive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleArchive(quiz.id)} className="cursor-pointer">
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}

                {isHidden(quiz) ? (
                  <DropdownMenuItem onClick={() => handleUnhide(quiz.id)} className="cursor-pointer">
                    <Eye className="mr-2 h-4 w-4" />
                    Unhide
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleHide(quiz.id)} className="cursor-pointer">
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => {
                    if (confirm("Delete this quiz? This will permanently remove it and all results. This cannot be undone.")) {
                      handleDelete(quiz.id);
                    }
                  }}
                  className="cursor-pointer text-red-600 focus:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CardDescription>{quiz.description}</CardDescription>
        </CardHeader>

        <CardContent className="flex-grow">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{quiz.questions.length} Questions</span>

            {average !== null && average !== undefined ? (
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Percent className="h-4 w-4" />
                {average}% Avg. Score
              </span>
            ) : adminAveragesLoading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating…
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No attempts yet</span>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-2">
          <Button
            onClick={() => {
              setLoadingAction(`analytics-${quiz.id}`);
              router.push(`/dashboard/quizzes/${quiz.id}/analytics`);
            }}
            variant="outline"
            disabled={isActionLoading("analytics")}
          >
            {isActionLoading("analytics") ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BarChart className="mr-2 h-4 w-4" />
            )}
            View Analytics
          </Button>

          <Button
            onClick={() => {
              setLoadingAction(`edit-${quiz.id}`);
              router.push(`/dashboard/quizzes/${quiz.id}/edit`);
            }}
            disabled={isActionLoading("edit")}
          >
            {isActionLoading("edit") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
            Edit Quiz
          </Button>
        </CardFooter>
      </Card>
    );
  }

  function StudentQuizCard({ quiz }: { quiz: Quiz }) {
    const hasAttempts = quiz.results && quiz.results.length > 0;
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="mr-2">{quiz.title}</span>
            </CardTitle>
            <StatusBadge quiz={quiz} />
          </div>
          <CardDescription>{quiz.description}</CardDescription>
        </CardHeader>

        <CardContent className="flex-grow">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{quiz.questions.length} Questions</span>
            {hasAttempts ? (
              <span className="flex items-center gap-1">
                <History className="h-4 w-4" />
                {quiz.results?.length} attempt{quiz.results?.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-2">
          {hasAttempts ? (
            <>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/quiz/${quiz.id}/results`}>
                  <BarChart className="mr-2 h-4 w-4" />
                  View Results
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href={`/quiz/${quiz.id}/start`}>
                  Retake Quiz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link href={`/quiz/${quiz.id}/start`}>
                Start Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {roleIsAdmin && <BatchGradesDashboard />}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Quizzes</h1>
          <p className="text-muted-foreground">
            {roleIsAdmin ? "Manage your quizzes here." : "Your course quizzes"}
          </p>
        </div>

        {roleIsAdmin ? (
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/dashboard/quizzes/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Quiz
            </Link>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Current course:&nbsp;
              <span className="font-semibold">
                {studentCourse ? studentCourse.toUpperCase() : "UNASSIGNED"}
              </span>
            </Badge>

            <Button variant="outline" size="sm" onClick={openReassignPanel}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Re-assign
            </Button>
          </div>
        )}
      </div>

      {roleIsAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={adminFilter === "all" ? "default" : "outline"} onClick={() => setAdminFilter("all")}>
            All
          </Button>
          <Button variant={adminFilter === "security+" ? "default" : "outline"} onClick={() => setAdminFilter("security+")}>
            <Shield className="mr-2 h-4 w-4" />
            Security+
          </Button>
          <Button variant={adminFilter === "a+" ? "default" : "outline"} onClick={() => setAdminFilter("a+")}>
            <Cpu className="mr-2 h-4 w-4" />
            A+
          </Button>
          <Button variant={adminFilter === "hidden" ? "default" : "outline"} onClick={() => setAdminFilter("hidden")}>
            Hidden
          </Button>
        </div>
      )}

      {!roleIsAdmin && showInitialChooser && (
        <Card>
          <CardHeader>
            <CardTitle>Choose your course</CardTitle>
            <CardDescription>Select your track and enter the course code to lock it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={pendingCourse === "security+" ? "default" : "outline"} onClick={() => setPendingCourse("security+")}>
                Security+
              </Button>
              <Button variant={pendingCourse === "a+" ? "default" : "outline"} onClick={() => setPendingCourse("a+")}>
                A+
              </Button>
            </div>

            {pendingCourse && (
              <div className="flex items-center gap-2">
                <input
                  value={courseCodeInput}
                  onChange={(e) => setCourseCodeInput(e.target.value)}
                  placeholder="Enter course code"
                  className="w-full rounded-md border px-3 py-2"
                />
                <Button onClick={confirmInitialCourse} disabled={initialSubmitting || !courseCodeInput.trim()}>
                  {initialSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!roleIsAdmin && showReassignPanel && (
        <Card>
          <CardHeader>
            <CardTitle>Re-assign Course</CardTitle>
            <CardDescription>Admin authorization required. Enter the admin code, then choose the new course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <input
                value={adminCodeInput}
                onChange={(e) => setAdminCodeInput(e.target.value)}
                placeholder="Admin code"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={reassignCourse === "security+" ? "default" : "outline"} onClick={() => setReassignCourse("security+")}>
                Security+
              </Button>
              <Button variant={reassignCourse === "a+" ? "default" : "outline"} onClick={() => setReassignCourse("a+")}>
                A+
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex items-center gap-2">
            <Button onClick={confirmReassignCourse} disabled={reassignSubmitting || !reassignCourse || !adminCodeInput.trim()}>
              {reassignSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
            <Button variant="outline" onClick={() => setShowReassignPanel(false)}>
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      {loading ? (
        <Grid>
          {[...Array(3)].map((_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </Grid>
      ) : roleIsAdmin ? (
        <DragDropContext onDragEnd={onDragEnd}>
          {(() => {
            const map = buildAdminDroppableMap(adminQuizzes);
            const order = droppableOrderForAdmin();

            return (
              <div className="space-y-2">
                {order.map((dropId) => {
                  const list = map[dropId] ?? [];
                  if (list.length === 0) return null;

                  return (
                    <div key={dropId} className="w-full">
                      <SectionDivider label={labelForDroppable(dropId)} />
                      <Droppable droppableId={dropId} direction="vertical">
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                          >
                            {list.map((quiz, index) => (
                              <Draggable key={quiz.id} draggableId={quiz.id} index={index} isDragDisabled={savingOrder}>
                                {(drag) => (
                                  <div ref={drag.innerRef} {...drag.draggableProps} className="relative">
                                    <button
                                      {...drag.dragHandleProps}
                                      className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                                      aria-label="Drag to reorder"
                                      title="Drag to reorder"
                                      disabled={savingOrder}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>
                                    <AdminQuizCard quiz={quiz} average={averageScores[quiz.id]} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DragDropContext>
      ) : !showInitialChooser && studentQuizzes.length > 0 ? (
        (() => {
          if (studentCourse === "a+") {
            const allAPlus = studentQuizzes.filter((q) => courseOf(q) === "a+");
            const grouped = groupAPlusByCore(allAPlus);

            const core1List = grouped.core1;
            const core2List = grouped.core2;
            const coreUnassigned = grouped.unassigned;

            return (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant={studentAPlusFilter === "all" ? "default" : "outline"} onClick={() => setStudentAPlusFilter("all")}>
                    All quizzes
                  </Button>
                  <Button variant={studentAPlusFilter === "core1" ? "default" : "outline"} onClick={() => setStudentAPlusFilter("core1")}>
                    Core 1
                  </Button>
                  <Button variant={studentAPlusFilter === "core2" ? "default" : "outline"} onClick={() => setStudentAPlusFilter("core2")}>
                    Core 2
                  </Button>
                </div>

                {studentAPlusFilter === "all" && (
                  <div className="space-y-8">
                    <SectionDivider label="A+ — ALL CORES" />

                    {core1List.length > 0 && (
                      <>
                        <SectionDivider label="CORE 1" />
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          {core1List.map((quiz) => (
                            <StudentQuizCard key={quiz.id} quiz={quiz} />
                          ))}
                        </div>
                      </>
                    )}

                    {core2List.length > 0 && (
                      <>
                        <SectionDivider label="CORE 2" />
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          {core2List.map((quiz) => (
                            <StudentQuizCard key={quiz.id} quiz={quiz} />
                          ))}
                        </div>
                      </>
                    )}

                    {coreUnassigned.length > 0 && (
                      <>
                        <SectionDivider label="UNASSIGNED CORE" />
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                          {coreUnassigned.map((quiz) => (
                            <StudentQuizCard key={quiz.id} quiz={quiz} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {studentAPlusFilter === "core1" && (
                  <div>
                    <SectionDivider label="A+ — CORE 1" />
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {core1List.length ? core1List.map((q) => <StudentQuizCard key={q.id} quiz={q} />) : (
                        <Card className="md:col-span-2 xl:col-span-3">
                          <CardHeader><CardTitle>No Core 1 quizzes yet</CardTitle></CardHeader>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {studentAPlusFilter === "core2" && (
                  <div>
                    <SectionDivider label="A+ — CORE 2" />
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {core2List.length ? core2List.map((q) => <StudentQuizCard key={q.id} quiz={q} />) : (
                        <Card className="md:col-span-2 xl:col-span-3">
                          <CardHeader><CardTitle>No Core 2 quizzes yet</CardTitle></CardHeader>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {studentQuizzes.map((quiz) => (
                <StudentQuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          );
        })()
      ) : (
        !roleIsAdmin &&
        !showInitialChooser && (
          <Card>
            <CardHeader>
              <CardTitle>No Quizzes Available</CardTitle>
              <CardDescription>There are no quizzes for your course yet. Please check back later.</CardDescription>
            </CardHeader>
          </Card>
        )
      )}
    </div>
  );
}
