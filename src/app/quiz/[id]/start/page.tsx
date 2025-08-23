"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQuiz } from "@/services/quiz-service";
import type { Quiz, QuizSession } from "@/lib/types";
import {
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Beaker,
  ArrowRight,
  BookOpen,
  RotateCcw,
  Play,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

// Firestore (used only to peek/reset the session from the start page)
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// small util
const formatMMSS = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
const fyShuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function StartQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const id = params.id as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  // session peek (only for Normal mode decision UI)
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasInProgress, setHasInProgress] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Load quiz
  useEffect(() => {
    if (authLoading) return;
    if (role === "admin") {
      router.replace(`/dashboard/quizzes/${id}/edit`);
      return;
    }
    if (id) {
      getQuiz(id)
        .then(setQuiz)
        .finally(() => setLoading(false));
    }
  }, [id, authLoading, role, router]);

  // Peek existing session (only for normal mode card logic)
  useEffect(() => {
    const run = async () => {
      if (!user || !quiz) {
        setCheckingSession(false);
        return;
      }
      try {
        const ref = doc(db, "quizzes", quiz.id, "sessions", user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setHasInProgress(false);
          setTimeLeft(null);
          setExpired(false);
          return;
        }
        const data = snap.data() as QuizSession;

        // If already submitted: treat as no in-progress
        if ((data as any).submittedAt) {
          setHasInProgress(false);
          setTimeLeft(null);
          setExpired(false);
          return;
        }

        if (quiz.timeLimit) {
          const total = quiz.timeLimit * 60;
          const elapsed = Math.floor((Date.now() - data.startedAt) / 1000);
          const remaining = Math.max(total - elapsed, 0);
          setTimeLeft(remaining);
          setExpired(remaining <= 0);
        } else {
          setTimeLeft(null);
          setExpired(false);
        }

        setHasInProgress(true);
      } catch {
        setHasInProgress(false);
        setTimeLeft(null);
        setExpired(false);
      } finally {
        setCheckingSession(false);
      }
    };
    run();
  }, [user, quiz]);

  // Retake: reset the session doc (clear answers, new startedAt, new order if shuffle)
  const handleRetake = async () => {
    if (!user || !quiz) return;
    setResetting(true);
    try {
      const order = quiz.shuffleQuestions
        ? fyShuffle(quiz.questions.map((q) => q.id))
        : quiz.questions.map((q) => q.id);

      const fresh: QuizSession = {
        startedAt: Date.now(),
        order,
        answersByQuestionId: {},
        lastSavedAt: Date.now(),
        currentIndex: 0,
      };

      const ref = doc(db, "quizzes", quiz.id, "sessions", user.uid);
      await setDoc(ref, { ...fresh, _createdAt: serverTimestamp() });
      router.push(`/quiz/${quiz.id}?mode=normal`);
    } finally {
      setResetting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
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
            <p>The quiz you are looking for does not exist.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/quizzes">Return to Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal mode card actions based on session peek
  const normalModeButtons = () => {
    if (checkingSession) {
      return (
        <Button className="mt-auto w-full" variant="outline" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking attempt…
        </Button>
      );
    }

    if (hasInProgress && !expired) {
      return (
        <div className="mt-auto w-full grid grid-cols-1 gap-2">
          {timeLeft !== null && (
            <div className="text-xs text-muted-foreground mb-1">
              Time remaining: <span className="font-medium">{formatMMSS(timeLeft)}</span>
            </div>
          )}
          {/* CONTINUE: hover → white bg + blue text */}
          <Button
            className="w-full hover:bg-white hover:text-primary"
            variant="default"
            onClick={() => router.push(`/quiz/${quiz.id}?mode=normal`)}
          >
            <Play className="mr-2 h-4 w-4" />
            Continue last attempt
          </Button>

          {/* RETAKE: default white/bg with blue text; hover blue/bg with white text */}
          <Button
            className="w-full bg-white text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground"
            variant="outline"
            onClick={handleRetake}
            disabled={resetting}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {resetting ? "Resetting…" : "Retake exam"}
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-auto w-full grid grid-cols-1 gap-2">
        {expired && (
          <div className="text-xs text-destructive">
            Your previous attempt expired. You can start a new attempt.
          </div>
        )}
        {/* START: hover → blue bg + white text */}
        <Button
          className="w-full hover:bg-primary hover:text-primary-foreground"
          variant="outline"
          onClick={() => router.push(`/quiz/${quiz.id}?mode=normal`)}
        >
          Start Official Attempt <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {expired && (
          // RETAKE here gets the same styling rule you asked for
          <Button
            className="w-full bg-white text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground"
            variant="outline"
            onClick={handleRetake}
            disabled={resetting}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {resetting ? "Resetting…" : "Retake exam"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-secondary p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full mx-auto">
        <Card className="shadow-2xl">
          <CardHeader className="text-center border-b pb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <BookOpen className="h-8 w-8" />
            </div>
            <CardTitle className="text-3xl font-bold font-headline">{quiz.title}</CardTitle>
            <CardDescription className="max-w-prose mx-auto">{quiz.description}</CardDescription>
            <div className="flex justify-center gap-8 pt-4 text-sm text-muted-foreground">
              <span>{quiz.questions.length} Questions</span>
              {quiz.timeLimit && <span>{quiz.timeLimit} Minute Time Limit</span>}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-center mb-6 font-headline">Choose Your Mode</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Normal Mode Card */}
              <div className="group">
                <div className="p-6 border rounded-lg h-full flex flex-col items-center text-center hover:border-primary hover:bg-primary/5 transition-all">
                  <ShieldCheck className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-lg font-semibold">Normal Mode</h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">
                    Your score will be recorded and will count towards your grade.
                  </p>
                  {normalModeButtons()}
                </div>
              </div>

              {/* Practice Mode Card */}
              <Link href={`/quiz/${id}?mode=practice`} className="group">
                <div className="p-6 border rounded-lg h-full flex flex-col items-center text-center hover:border-accent hover:bg-accent/5 transition-all">
                  <Beaker className="h-12 w-12 text-accent mb-4" />
                  <h3 className="text-lg font-semibold">Practice Mode</h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">
                    Take the quiz for practice. Your results will not affect your grade.
                  </p>
                  <Button className="mt-auto w-full bg-accent/10 text-accent border-accent/20 group-hover:bg-accent group-hover:text-accent-foreground" variant="outline">
                    Start Practice <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </Link>
            </div>
          </CardContent>

          <CardFooter className="flex justify-start border-t pt-6">
            <Button variant="outline" asChild>
              <Link href="/dashboard/quizzes">
                <ArrowLeft className="mr-2" /> Back to Quizzes
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
