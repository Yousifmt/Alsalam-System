
"use client";

import { useEffect, useState } from "react";
import type { Quiz } from "@/lib/types";
import { QuizInterface } from "@/components/quiz/quiz-interface";
import { Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getQuizForUser, getQuiz } from "@/services/quiz-service";

export function QuizDisplay({ quiz: initialQuiz }: { quiz: Quiz }) {
  const { user, role } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadQuiz = async () => {
      setLoading(true);
      try {
        const quizData = role === 'admin' 
          ? await getQuiz(initialQuiz.id) 
          : await getQuizForUser(initialQuiz.id, user.uid);
        
        setQuiz(quizData);
        if (quizData?.timeLimit) {
          setTimeLeft(quizData.timeLimit * 60);
        }
      } catch (error) {
        console.error("Failed to load quiz:", error);
        setQuiz(null); // Set quiz to null on error
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [initialQuiz.id, user, role]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timePercentage = quiz?.timeLimit ? ((timeLeft ?? 0) / (quiz.timeLimit * 60)) * 100 : 0;
  const isTimeLow = timeLeft !== null && quiz?.timeLimit ? timeLeft < (quiz.timeLimit * 60 * 0.1) : false;

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
    <div className="flex min-h-screen flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex h-20 flex-col justify-center border-b bg-background px-4 md:px-6">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold font-headline text-primary">{quiz.title}</h1>
            <div className="flex items-center gap-4">
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
                indicatorClassName={cn(
                    "bg-orange-400 transition-all",
                    isTimeLow && "bg-destructive"
                )}
            />
        )}
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <QuizInterface quizData={quiz} onTimeUpdate={setTimeLeft} />
      </main>
    </div>
  );
}
