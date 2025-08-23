"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz, QuizResult, QuizSession } from "@/lib/types";
import { QuizInterface } from "@/components/quiz/quiz-interface";
import { Clock, Loader2, Beaker } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getQuizForUser, getQuiz, submitQuizResult } from "@/services/quiz-service";
import { Badge } from "@/components/ui/badge";
import {
  startOrResumeActiveSession,
  saveQuizProgress,
  finalizeQuizAttempt,
} from "@/services/quiz-service";

export function QuizDisplay({ quiz: initialQuiz, isPractice }: { quiz: Quiz; isPractice: boolean }) {
  const router = useRouter();
  const { user, role } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [initialTimeLeft, setInitialTimeLeft] = useState<number | null>(null);
  const [restoredAnswers, setRestoredAnswers] = useState<Record<string, string | string[]> | null>(null);
  const [questionOrder, setQuestionOrder] = useState<string[] | null>(null);
  const [initialIndex, setInitialIndex] = useState<number>(0);

  // keep latest for autosave
  const latestAnswersRef = useRef<Record<string, string | string[]>>({});
  const latestIndexRef = useRef<number>(0);

  // Debounced autosave
  const pendingRef = useRef<{ answersByQuestionId: Record<string, string | string[]>; currentIndex: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 500;

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const quizData = role === "admin" ? await getQuiz(initialQuiz.id) : await getQuizForUser(initialQuiz.id, user.uid);
        setQuiz(quizData);
        if (!quizData) {
          setInitialTimeLeft(null);
          setTimeLeft(null);
          setRestoredAnswers(null);
          setQuestionOrder(null);
          setInitialIndex(0);
          return;
        }

        const allIds = quizData.questions.map(q => q.id);

        if (quizData.timeLimit && !isPractice && role !== "admin") {
          // Resume or create; if previous was submitted, this overwrites with a NEW attempt
          const session: QuizSession = await startOrResumeActiveSession(
            quizData.id,
            user.uid,
            allIds,
            !!quizData.shuffleQuestions
          );

          setRestoredAnswers(session.answersByQuestionId || {});
          setQuestionOrder(session.order ?? allIds);
          setInitialIndex(session.currentIndex ?? 0);

          latestAnswersRef.current = session.answersByQuestionId || {};
          latestIndexRef.current = session.currentIndex ?? 0;

          const total = quizData.timeLimit * 60;
          const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
          const remaining = Math.max(total - elapsed, 0);
          setInitialTimeLeft(remaining);
          setTimeLeft(remaining);
        } else {
          // Practice/Admin: fresh or none
          const fresh = quizData.timeLimit ? quizData.timeLimit * 60 : null;
          setInitialTimeLeft(fresh);
          setTimeLeft(fresh);
          setRestoredAnswers(null);
          setQuestionOrder(allIds);
          setInitialIndex(0);
        }
      } catch (e) {
        console.error("Failed to load quiz:", e);
        setQuiz(null);
        setInitialTimeLeft(null);
        setTimeLeft(null);
        setRestoredAnswers(null);
        setQuestionOrder(null);
        setInitialIndex(0);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuiz.id, user, role, isPractice]);

  // UI helpers
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const timePercentage = useMemo(() => {
    if (!quiz?.timeLimit || timeLeft === null) return 0;
    return (timeLeft / (quiz.timeLimit * 60)) * 100;
  }, [quiz?.timeLimit, timeLeft]);

  const isTimeLow = timeLeft !== null && quiz?.timeLimit ? timeLeft < quiz.timeLimit * 60 * 0.1 : false;

  // Debounced autosave (normal mode only)
  const queueSave = (answersByQuestionId: Record<string, string | string[]>, currentIndex: number) => {
    latestAnswersRef.current = answersByQuestionId;
    latestIndexRef.current = currentIndex;

    if (isPractice || role === "admin" || !user || !quiz) return;

    pendingRef.current = { answersByQuestionId, currentIndex };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const payload = pendingRef.current;
      saveTimerRef.current = null;
      if (!payload) return;
      try {
        await saveQuizProgress(quiz.id, user.uid, payload.answersByQuestionId, payload.currentIndex);
      } catch (e) {
        console.warn("saveQuizProgress failed:", e);
      }
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading Quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Quiz Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The quiz you are looking for does not exist or has been removed.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/quizzes">Return to Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active attempt
  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex h-20 flex-col justify-center border-b bg-background px-4 md:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-headline text-primary">{quiz.title}</h1>
          <div className="flex items-center gap-4">
            {isPractice && (
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                <Beaker className="mr-2 h-4 w-4" />
                Practice Mode
              </Badge>
            )}
            {timeLeft !== null && (
              <div className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}
            <Button asChild variant="outline">
              <Link href="/dashboard">Exit Quiz</Link>
            </Button>
          </div>
        </div>
        {quiz.timeLimit && timeLeft !== null && (
          <Progress
            value={timePercentage}
            className="w-full mt-2 h-2"
            indicatorClassName={cn("bg-orange-400 transition-all", isTimeLow && "bg-destructive")}
          />
        )}
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <QuizInterface
          quizData={quiz}
          isPractice={isPractice}
          initialTimeLeft={initialTimeLeft}
          initialAnswersByQuestionId={restoredAnswers ?? {}}
          initialIndex={initialIndex}
          questionOrder={questionOrder ?? quiz.questions.map(q => q.id)}
          onTimeUpdate={setTimeLeft}
          onAnswerChange={queueSave}
          onSubmitFinalize={async (result) => {
            if (!user) return;
            await submitQuizResult(quiz.id, user.uid, result);
            if (!isPractice) await finalizeQuizAttempt(quiz.id, user.uid);
            router.replace(`/quiz/${quiz.id}/results?practice=${isPractice}`);
          }}
        />
      </main>
    </div>
  );
}
