"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  ArrowRight,
  History,
  BarChart,
  Percent,
  Edit,
  Loader2,
  GripVertical,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useEffect, useMemo, useState } from "react";
import type { Quiz } from "@/lib/types";
import {
  getQuizzesForUser,
  getQuizzes,
  getAllResultsForQuiz,
  updateQuizOrder,
} from "@/services/quiz-service";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

// drag & drop
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

const getBadgeVariant = (status: string) => {
  switch (status) {
    case "Completed":
      return "default";
    case "Not Submitted":
      return "secondary";
    default:
      return "outline";
  }
};

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

export default function QuizzesPage() {
  const { role, user } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [averageScores, setAverageScores] = useState<
    Record<string, number | null>
  >({});

  // sort helper by "order" field (optional), then fallback to title
  const sortQuizzes = (arr: Quiz[]) =>
    [...arr].sort((a: any, b: any) => {
      const ao = typeof (a as any).order === "number" ? (a as any).order : 1e9;
      const bo = typeof (b as any).order === "number" ? (b as any).order : 1e9;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });

  useEffect(() => {
    if (!user) return;

    const fetchQuizzes = async () => {
      setLoading(true);
      try {
        // Load pool for admin, or merged user view for students
        const fetchedQuizzes =
          role === "admin" ? await getQuizzes() : await getQuizzesForUser(user.uid);

        // Students: hide Draft & Archived
        const visible =
          role === "admin"
            ? fetchedQuizzes
            : fetchedQuizzes.filter(
                (q) => q.status !== "Draft" && q.status !== "Archived"
              );

        setQuizzes(sortQuizzes(visible));

        if (role === "admin") {
          const scores: Record<string, number | null> = {};
          for (const quiz of visible) {
            const results = await getAllResultsForQuiz(quiz.id);
            if (results.length > 0) {
              const totalScore = results.reduce(
                (acc, result) => acc + (result.score / result.total) * 100,
                0
              );
              scores[quiz.id] = Math.round(totalScore / results.length);
            } else {
              scores[quiz.id] = null;
            }
          }
          setAverageScores(scores);
        }
      } catch (error) {
        console.error("Failed to fetch quizzes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user, role]);

  const getQuizStatus = (quiz: Quiz) => {
    if (quiz.results && quiz.results.length > 0) {
      return "Completed";
    }
    if (quiz.status === "Not Started") return "Not Submitted";
    return quiz.status;
  };

  const handleNavigate = (path: string, action: string) => {
    setLoadingAction(action);
    router.push(path);
  };

  // ---------- DND handlers (admin only) ----------
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    // re-order locally
    const items = Array.from(quizzes);
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);
    setQuizzes(items);

    // persist order only for admins
    if (role === "admin") {
      try {
        // assign order = index for all visible quizzes
        await Promise.all(items.map((q, idx) => updateQuizOrder(q.id, idx)));
      } catch (e) {
        console.error("Failed to persist quiz order", e);
      }
    }
  };

  const Grid = useMemo(
    () => ({ children }: { children: React.ReactNode }) => (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    ),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Quizzes</h1>
          <p className="text-muted-foreground">
            {role === "admin"
              ? "Manage your quizzes here."
              : "View and take your quizzes here."}
          </p>
        </div>
        {role === "admin" && (
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/dashboard/quizzes/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Quiz
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <Grid>
          {[...Array(3)].map((_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </Grid>
      ) : quizzes.length > 0 ? (
        role === "admin" ? (
          // Admin view: draggable list
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="quiz-grid" direction="vertical">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                >
                  {quizzes.map((quiz, index) => {
                    const status = getQuizStatus(quiz);
                    const hasAttempts = quiz.results && quiz.results.length > 0;
                    const averageScore = averageScores[quiz.id];
                    const isActionLoading = (action: string) =>
                      loadingAction === `${action}-${quiz.id}`;

                    return (
                      <Draggable key={quiz.id} draggableId={quiz.id} index={index}>
                        {(drag) => (
                          <Card
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className="flex flex-col relative"
                          >
                            {/* drag handle */}
                            <button
                              {...drag.dragHandleProps}
                              className="absolute top-3 right-3 opacity-60 hover:opacity-100 transition"
                              aria-label="Drag to reorder"
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>

                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                  {quiz.title}
                                  {(quiz as any).status &&
                                    ((quiz as any).status === "Draft" ||
                                      (quiz as any).status === "Archived") && (
                                      <Badge variant="outline">
                                        {(quiz as any).status}
                                      </Badge>
                                    )}
                                </CardTitle>
                                {/* no status badge for admin */}
                              </div>
                              <CardDescription>{quiz.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-grow">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{quiz.questions.length} Questions</span>
                                {averageScore !== null &&
                                averageScore !== undefined ? (
                                  <span className="flex items-center gap-1 font-semibold text-primary">
                                    <Percent className="h-4 w-4" />
                                    {averageScore}% Avg. Score
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    No attempts yet
                                  </span>
                                )}
                              </div>
                            </CardContent>

                            <CardFooter className="flex flex-col items-stretch gap-2">
                              <Button
                                onClick={() =>
                                  handleNavigate(
                                    `/dashboard/quizzes/${quiz.id}/analytics`,
                                    `analytics-${quiz.id}`
                                  )
                                }
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
                                onClick={() =>
                                  handleNavigate(
                                    `/dashboard/quizzes/${quiz.id}/edit`,
                                    `edit-${quiz.id}`
                                  )
                                }
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
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          // Student view: no drag, but same order as admin (sorted by `order`)
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz) => {
              const status = getQuizStatus(quiz);
              const hasAttempts = quiz.results && quiz.results.length > 0;
              const averageScore = averageScores[quiz.id];

              return (
                <Card key={quiz.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {quiz.title}
                      </CardTitle>
                      <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                    </div>
                    <CardDescription>{quiz.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{quiz.questions.length} Questions</span>
                      {hasAttempts ? (
                        <span className="flex items-center gap-1">
                          <History className="h-4 w-4" />
                          {quiz.results?.length} attempt
                          {quiz.results?.length === 1 ? "" : "s"}
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
                          <Link href={`/quiz/${quiz.id}`}>
                            Retake Quiz
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button asChild className="w-full">
                        <Link href={`/quiz/${quiz.id}`}>
                          Start Quiz
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Quizzes Available</CardTitle>
            <CardDescription>
              {role === "admin"
                ? "You haven't created any quizzes yet. Get started by creating a new one."
                : "There are no quizzes assigned to you at the moment. Please check back later."}
            </CardDescription>
          </CardHeader>
          {role === "admin" && (
            <CardContent>
              <Button
                onClick={() => handleNavigate("/dashboard/quizzes/new", "create")}
                disabled={loadingAction === "create"}
              >
                {loadingAction === "create" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Create Your First Quiz
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
