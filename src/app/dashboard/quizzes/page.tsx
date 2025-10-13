// FILE: src/app/dashboard/quizzes/page.tsx
"use client";

import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/* DnD lazy imports */
const DragDropContext = dynamicImport(
  () => import("@hello-pangea/dnd").then((m) => m.DragDropContext),
  { ssr: false },
);
const Droppable = dynamicImport(
  () => import("@hello-pangea/dnd").then((m) => m.Droppable),
  { ssr: false },
);
const Draggable = dynamicImport(
  () => import("@hello-pangea/dnd").then((m) => m.Draggable),
  { ssr: false },
);

/* ────────────────────────────────────────────────────────────────
   Types / helpers
──────────────────────────────────────────────────────────────── */
type CourseTag = "security+" | "a+" | "unassigned";
type StudentCourseTag = "security+" | "a+";
type AdminFilter = "all" | "security+" | "a+" | "hidden";

// A+ core sub-tag (for quizzes whose course === "a+")
type APlusCore = "core1" | "core2" | "unassigned";
const CORE_ORDER: APlusCore[] = ["core1", "core2", "unassigned"];

const SECTION_ORDER: CourseTag[] = ["security+", "a+", "unassigned"];

const COURSE_PASSWORDS: Record<StudentCourseTag, string> = {
  "security+": "sy0-701-student-353535",
  "a+": "202-1201",
};

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
  return (
    s === "archived" ||
    s === "archive" ||
    q?.isArchived === true ||
    q?.deleted === true
  );
};
const isHidden = (q: any) => q?.hidden === true;

function courseOf(q: Quiz): CourseTag {
  return ((q as any).course ?? "unassigned") as CourseTag;
}

// Core for A+ items (stored on quiz as "core": "core1" | "core2" | "unassigned")
function coreOf(q: Quiz): APlusCore {
  return ((q as any).core ?? "unassigned") as APlusCore;
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
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
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
   Client wrapper with Suspense for useSearchParams
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
   Real page content
──────────────────────────────────────────────────────────────── */
function QuizzesPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { role, user } = useAuth();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [averageScores, setAverageScores] = useState<Record<string, number | null>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [beforeDnD, setBeforeDnD] = useState<Quiz[] | null>(null);

  // STUDENT: first-visit selection
  const [studentCourse, setStudentCourse] = useState<StudentCourseTag | null>(null);
  const [showChooser, setShowChooser] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pendingCourse, setPendingCourse] = useState<StudentCourseTag | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // ADMIN: filter
  const [adminFilter, setAdminFilter] = useState<AdminFilter>("all");

  // STUDENT (A+): core filter buttons
  type StudentAPlusFilter = "all" | "core1" | "core2";
  const [studentAPlusFilter, setStudentAPlusFilter] = useState<StudentAPlusFilter>("all");

  const roleReady = role === "admin" || role === "student";

  useEffect(() => {
    if (params.get("choose") === "1") setShowChooser(true);
  }, [params]);

  useEffect(() => {
    const run = async () => {
      if (!roleReady || !user) return;
      setLoading(true);
      try {
        const fetched = role === "admin" ? await getQuizzes() : await getQuizzesForUser(user.uid);
        setQuizzes(fetched);

        if (role === "admin") {
          const scores: Record<string, number | null> = {};
          for (const q of fetched) {
            const results = await getAllResultsForQuiz(q.id);
            scores[q.id] = results.length
              ? Math.round(
                  results.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / results.length,
                )
              : null;
          }
          setAverageScores(scores);
        } else {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data: any = snap.exists() ? snap.data() : {};
          const c = data.courseTag as StudentCourseTag | undefined;
          if (c) {
            setStudentCourse(c);
            setShowChooser(false);
          } else {
            setStudentCourse(null);
            setShowChooser(true);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [roleReady, role, user]);

  /* ── Filters: Admin + Student ───────────────────────────────────────────── */

  const adminQuizzes = useMemo(() => {
    if (adminFilter === "hidden") {
      return quizzes.filter((q) => isHidden(q));
    }
    const base = quizzes.filter((q) => !isHidden(q));
    if (adminFilter === "all") return base;
    return base.filter((q) => courseOf(q) === (adminFilter as CourseTag));
  }, [quizzes, adminFilter]);

  const studentQuizzes = useMemo(() => {
    if (!studentCourse) return [];
    return quizzes.filter((q) => {
      const c: CourseTag = courseOf(q);
      if (isArchived(q)) return false;
      if (isHidden(q)) return false;
      return c === "unassigned" || c === studentCourse;
    });
  }, [quizzes, studentCourse]);

  /* ── Sorting & Grouping ─────────────────────────────────────────────────── */

  const sortQuizzes = (arr: Quiz[]) =>
    [...arr].sort((a: any, b: any) => {
      const ao = typeof (a as any).order === "number" ? (a as any).order : 1e9;
      const bo = typeof (b as any).order === "number" ? (b as any).order : 1e9;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });

  function groupByCourseTag(arr: Quiz[]): Record<CourseTag, Quiz[]> {
    const groups: Record<CourseTag, Quiz[]> = {
      "security+": [],
      "a+": [],
      "unassigned": [],
    };
    for (const q of arr) {
      groups[courseOf(q)].push(q);
    }
    for (const key of SECTION_ORDER) groups[key] = sortQuizzes(groups[key]);
    return groups;
  }

  function groupAPlusByCore(arr: Quiz[]): Record<APlusCore, Quiz[]> {
    const groups: Record<APlusCore, Quiz[]> = {
      core1: [],
      core2: [],
      unassigned: [],
    };
    for (const q of arr) {
      groups[coreOf(q)].push(q);
    }
    for (const key of CORE_ORDER) groups[key] = sortQuizzes(groups[key]);
    return groups;
  }

  /* ── DnD (group-aware with A+ cores) ───────────────────────────────────── */

  function buildAdminDroppableMap(list: Quiz[]): Record<string, Quiz[]> {
  const byCourse = groupByCourseTag(list);
  const map: Record<string, Quiz[]> = {};

  // always keep course sections
  map["security+"] = byCourse["security+"];

  if (adminFilter === "a+") {
    // ONLY split by cores when the admin filter is A+
    const aplus = groupAPlusByCore(byCourse["a+"]);
    map["a+::core1"] = aplus.core1;
    map["a+::core2"] = aplus.core2;
    map["a+::unassigned"] = aplus.unassigned;
  } else {
    // All / Hidden / Security+ -> show A+ as a single section
    map["a+"] = byCourse["a+"];
  }

  map["unassigned"] = byCourse["unassigned"];
  return map;
}


  function droppableOrderForAdmin(): string[] {
  if (adminFilter === "a+") return ["a+::core1", "a+::core2", "a+::unassigned"];
  if (adminFilter === "security+") return ["security+"];
  if (adminFilter === "hidden") return ["security+", "a+", "unassigned"];
  // "all" (default): show only course sections
  return ["security+", "a+", "unassigned"];
}


  function labelForDroppable(id: string): string {
    switch (id) {
      case "security+":
        return "SECURITY+";
        case "a+":
  return "A+";

      case "a+::core1":
        return "A+ — CORE 1";
      case "a+::core2":
        return "A+ — CORE 2";
      case "a+::unassigned":
        return "A+ — UNASSIGNED CORE";
      case "unassigned":
        return "UNASSIGNED COURSE";
      default:
        return id.toUpperCase();
    }
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

  /* ── Student course code submit ─────────────────────────────────────────── */

  async function submitPassword() {
    if (!pendingCourse || !user) return;
    setPwSubmitting(true);
    try {
      const expected = COURSE_PASSWORDS[pendingCourse].toLowerCase().trim();
      const given = pwInput.toLowerCase().trim();
      if (expected !== given) {
        setPwSubmitting(false);
        return alert("Incorrect code. Please try again.");
      }
      await updateDoc(doc(db, "users", user.uid), {
        courseTag: pendingCourse,
      });
      setStudentCourse(pendingCourse);
      setShowChooser(false);
      setPwDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save your course. Please try again.");
    } finally {
      setPwSubmitting(false);
    }
  }

  /* ── Badges & role ─────────────────────────────────────────────────────── */

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

  const roleIsAdmin = role === "admin";

  /* ── Admin card actions (3 dots) ───────────────────────────────────────── */

  async function handleHide(quizId: string) {
    try {
      setLoadingAction(`hide-${quizId}`);
      await updateQuizFields(quizId, { hidden: true });
    } finally {
      setQuizzes((prev) => prev.map((q) => (q.id === quizId ? ({ ...q, hidden: true } as Quiz) : q)));
      setLoadingAction(null);
    }
  }

  async function handleUnhide(quizId: string) {
    try {
      setLoadingAction(`unhide-${quizId}`);
      await updateQuizFields(quizId, { hidden: false });
    } finally {
      setQuizzes((prev) => prev.map((q) => (q.id === quizId ? ({ ...q, hidden: false } as Quiz) : q)));
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

  /* ── Render Helpers ────────────────────────────────────────────────────── */

  function AdminQuizCard({ quiz, average }: { quiz: Quiz; average: number | null | undefined }) {
    const isActionLoading = (action: string) => loadingAction === `${action}-${quiz.id}`;
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
  <span className="mr-2">{quiz.title}</span>

  {/* badges group */}
  <span className="inline-flex items-center gap-2 whitespace-nowrap">
    {(quiz as any).course && (quiz as any).course !== "unassigned" && (
      <Badge variant="outline" className="whitespace-nowrap">
        {String((quiz as any).course).toUpperCase()}
      </Badge>
    )}
    {courseOf(quiz) === "a+" && (
      <Badge variant="outline" className="whitespace-nowrap">
        {String(coreOf(quiz)).replace("core", "Core ").toUpperCase()}
      </Badge>
    )}
    {isArchived(quiz) && (
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


            <div className="flex items-center gap-1">
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
                  {isHidden(quiz) ? (
                    <>
                      <DropdownMenuItem onClick={() => handleUnhide(quiz.id)} className="cursor-pointer">
                        <Eye className="mr-2 h-4 w-4" />
                        Unhide
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Delete this hidden quiz? This cannot be undone.")) {
                            handleDelete(quiz.id);
                          }
                        }}
                        className="cursor-pointer text-red-600 focus:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => handleHide(quiz.id)} className="cursor-pointer">
                      <EyeOff className="mr-2 h-4 w-4" />
                      Hide
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            ) : (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">No attempts yet</span>
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
            {isActionLoading("edit") ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Edit className="mr-2 h-4 w-4" />
            )}
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

  {/* badges group */}
  <span className="inline-flex items-center gap-2 whitespace-nowrap">
    {(quiz as any).course && (quiz as any).course !== "unassigned" && (
      <Badge variant="outline" className="whitespace-nowrap">
        {String((quiz as any).course).toUpperCase()}
      </Badge>
    )}
    {courseOf(quiz) === "a+" && (
      <Badge variant="outline" className="whitespace-nowrap">
        {String(coreOf(quiz)).replace("core", "Core ").toUpperCase()}
      </Badge>
    )}
    {isArchived(quiz) && (
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

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ======== Batch dashboard ABOVE the header (and Create New Quiz) ======== */}
      {roleIsAdmin && <BatchGradesDashboard />}
      {/* ======================================================================= */}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Quizzes</h1>
          <p className="text-muted-foreground">
            {roleIsAdmin ? "Manage your quizzes here." : "Your course quizzes"}
          </p>
        </div>
        {roleIsAdmin && (
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/dashboard/quizzes/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Quiz
            </Link>
          </Button>
        )}
      </div>

      {/* ADMIN filter */}
      {roleIsAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={adminFilter === "all" ? "default" : "outline"} onClick={() => setAdminFilter("all")}>
            All
          </Button>
          <Button
            variant={adminFilter === "security+" ? "default" : "outline"}
            onClick={() => setAdminFilter("security+")}
          >
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

      {/* Content */}
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
      ) : showChooser ? null : studentQuizzes.length > 0 ? (
        (() => {
          if (studentCourse === "a+") {
            // Buttons like admin, but for A+ cores
            const allAPlus = studentQuizzes.filter((q) => courseOf(q) === "a+");
            const grouped = groupAPlusByCore(allAPlus);
            const core1List = grouped.core1;
            const core2List = grouped.core2;
            const coreUnassigned = grouped.unassigned;

            return (
              <div className="space-y-6">
                {/* Student A+ filter buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={studentAPlusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStudentAPlusFilter("all")}
                  >
                    All quizzes
                  </Button>
                  <Button
                    variant={studentAPlusFilter === "core1" ? "default" : "outline"}
                    onClick={() => setStudentAPlusFilter("core1")}
                  >
                    Core 1
                  </Button>
                  <Button
                    variant={studentAPlusFilter === "core2" ? "default" : "outline"}
                    onClick={() => setStudentAPlusFilter("core2")}
                  >
                    Core 2
                  </Button>
                </div>

                {/* Panels */}
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

          // Non A+ student: default grid as before
          return (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {studentQuizzes.map((quiz) => (
                <StudentQuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          );
        })()
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Quizzes Available</CardTitle>
            <CardDescription>
              There are no quizzes for your course yet. Please check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
