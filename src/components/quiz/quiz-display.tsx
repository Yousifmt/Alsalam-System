// src/components/quiz/quiz-display.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quiz, QuizSession } from "@/lib/types";
import { QuizInterface } from "@/components/quiz/quiz-interface";
import { Clock, Loader2, Beaker, ShieldAlert, MonitorUp } from "lucide-react";
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

  /** ================================
   * Anti-cheat (Normal mode only)
   * ================================ */
  const antiCheatActive = !isPractice && role !== "admin";

  // Fullscreen + locks
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const LOCK_SECONDS = 10;

  // 🚩 جديد: إيقاف الحمايات مؤقتًا أثناء التحميل/الخروج/الإنهاء
  const [suppressGuards, setSuppressGuards] = useState<boolean>(false);
  const antiCheatLive = antiCheatActive && !suppressGuards;

  const isTimedLock = lockedUntil !== null && lockedUntil > nowTs;
  const remainingLock = isTimedLock ? Math.max(0, Math.ceil((lockedUntil - nowTs) / 1000)) : 0;

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  };
  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
  };

  // قفل بلا مدة: يظهر فقط عند الخروج من Fullscreen
  const lockIndefinitely = () => {
    if (!antiCheatLive) return; // لو مطفّي الحمايات لا نقفل
    setLockedUntil(null);
    if (user && quiz) {
      saveQuizProgress(quiz.id, user.uid, latestAnswersRef.current, latestIndexRef.current).catch(() => {});
    }
  };
  // قفل 10 ثوانٍ: عند تبديل التبويب/تصغير النافذة
  const lockForTenSeconds = () => {
    if (!antiCheatLive) return; // لو مطفّي الحمايات لا نقفل
    setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
    if (user && quiz) {
      saveQuizProgress(quiz.id, user.uid, latestAnswersRef.current, latestIndexRef.current).catch(() => {});
    }
  };

  // الدخول إلى الامتحان: حاول Fullscreen أوتوماتيكياً + fallback بأول نقرة
  useEffect(() => {
    if (!antiCheatActive) return;
    requestFullscreen();
  }, [antiCheatActive]);
  useEffect(() => {
    if (!antiCheatActive) return;
    const onFirstPointer = async () => {
      if (!document.fullscreenElement) await requestFullscreen();
      window.removeEventListener("pointerdown", onFirstPointer, true);
    };
    window.addEventListener("pointerdown", onFirstPointer, true);
    return () => window.removeEventListener("pointerdown", onFirstPointer, true);
  }, [antiCheatActive]);

  // راقب الخروج من Fullscreen ⇒ قفل غير محدود (إلا إذا كنا موقّفين الحمايات)
  useEffect(() => {
    if (!antiCheatActive) return;
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) lockIndefinitely();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [antiCheatActive, antiCheatLive]); // antiCheatLive للتأكد من احترام الإيقاف المؤقت

  // تبديل تبويب/تصغير نافذة ⇒ قفل 10 ثواني (إلا إذا كنا موقّفين الحمايات)
  useEffect(() => {
    if (!antiCheatActive) return;
    const onVisibility = () => {
      if (document.hidden) lockForTenSeconds();
    };
    const onBlur = () => {
      lockForTenSeconds();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [antiCheatActive, antiCheatLive]);

  // تحديث مؤقت القفل
  useEffect(() => {
    if (!antiCheatActive) return;
    const id = setInterval(() => setNowTs(Date.now()), 300);
    return () => clearInterval(id);
  }, [antiCheatActive]);

  // منع التظليل + الرايت كلك + النسخ/القص/اللصق (بدون اعتراض اختصارات)
  useEffect(() => {
    if (!antiCheatActive) return;
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", stop);
    document.addEventListener("copy", stop as EventListener);
    document.addEventListener("cut", stop as EventListener);
    document.addEventListener("paste", stop as EventListener);
    return () => {
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("copy", stop as EventListener);
      document.removeEventListener("cut", stop as EventListener);
      document.removeEventListener("paste", stop as EventListener);
    };
  }, [antiCheatActive]);

  // ====== تحميل بيانات الكويز ======
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

  // ====== Helpers ======
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

  // Submit/Exit: أخرج من Fullscreen ثم عطّل الحمايات حتى الاكتمال
  const finalizeWithNoGuards = async (fn: () => Promise<void>) => {
    setSuppressGuards(true);      // 🔕 أوقف الحمايات
    await exitFullscreen();       // اخرج من الفول سكرين (لن يسبب قفل الآن)
    await fn();                   // نفّذ العملية (submit/route)
  };

  // ====== UI ======
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

  return (
    <div className={cn("flex min-h-screen flex-col bg-secondary", antiCheatActive && "select-none")}>
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
              <Link
                href="/dashboard"
                onClick={async (e) => {
                  e.preventDefault();
                  await finalizeWithNoGuards(async () => {
                    router.push("/dashboard");
                  });
                }}
              >
                Exit Quiz
              </Link>
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

      <main className={cn("flex flex-1 items-center justify-center p-4", antiCheatLive && isTimedLock && "pointer-events-none blur-sm")}>
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
            await finalizeWithNoGuards(async () => {
              await submitQuizResult(quiz.id, user.uid, result);
              if (!isPractice) await finalizeQuizAttempt(quiz.id, user.uid);
              router.replace(`/quiz/${quiz.id}/results?practice=${isPractice}`);
            });
          }}
        />
      </main>

      {/* أوفرلاي: قفل غير محدود (عند الخروج من Fullscreen) */}
      {antiCheatLive && !isFullscreen && !isTimedLock && (
        <div className="fixed inset-0 z-30 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorUp className="h-5 w-5" />
                Focus mode required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The exam is paused because you left <span className="font-semibold">Full Screen</span>. Please return to continue.
              </p>
              <Button onClick={requestFullscreen} className="w-full">Back to full screen mode</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* أوفرلاي: قفل زمني 10 ثواني (tab/window switch) */}
      {antiCheatLive && isTimedLock && (
        <div className="fixed inset-0 z-30 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <CardTitle>Exam locked</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You left the exam (tab/window switch). The exam is locked for{" "}
                <span className="font-semibold">{remainingLock}s</span>.
              </p>
              <Button
                disabled={remainingLock > 0}
                onClick={requestFullscreen}
                className="w-full"
              >
                {remainingLock > 0 ? `Please wait ${remainingLock}s` : "Back to full screen mode"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
