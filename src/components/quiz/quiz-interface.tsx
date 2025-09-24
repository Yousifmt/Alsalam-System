// src/components/QuizInterface.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../ui/alert-dialog";
import type { Question, Quiz, QuizResult } from "@/lib/types";
import Image from "next/image";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { useAuth } from "@/context/auth-context";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Beaker, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function QuizInterface({
  quizData,
  onTimeUpdate,
  isPractice,
  initialAnswersByQuestionId,
  initialIndex = 0,
  initialTimeLeft = null,
  questionOrder,
  onAnswerChange,                      // (answers, currentIndex)
  onSubmitFinalize,                    // called on manual submit or time-up auto-submit
}: {
  quizData: Quiz;
  onTimeUpdate?: (time: number) => void;
  isPractice: boolean;
  initialAnswersByQuestionId?: Record<string, string | string[]>;
  initialIndex?: number;
  initialTimeLeft?: number | null;
  questionOrder?: string[];
  onAnswerChange?: (answers: Record<string, string | string[]>, currentIndex: number) => void;
  onSubmitFinalize?: (result: QuizResult) => Promise<void> | void;
}) {
  const { role } = useAuth();

  // Build questions in stable order from session (or fallback)
  const [processedQuestions] = useState(() => {
    let list = [...quizData.questions];

    if (questionOrder && questionOrder.length === list.length) {
      const map = new Map(list.map(q => [q.id, q]));
      list = questionOrder.map(id => map.get(id)!).filter(Boolean);
    } else if (quizData.shuffleQuestions) {
      list = shuffle(list);
    }

    if (quizData.shuffleAnswers) {
      list = list.map(q => ({
        ...q,
        options: q.type !== "short-answer" ? shuffle(q.options) : [],
      }));
    }
    return list;
  });

  // Refs for navigator
  const navWrapRef = useRef<HTMLDivElement>(null);
  const navItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Remember/restore vertical scroll to prevent page jump
  const lastScrollYRef = useRef<number | null>(null);
  const rememberScrollY = () => { lastScrollYRef.current = window.scrollY; };

  // Resume index & answers
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialAnswersByQuestionId ?? {});
  const hydratedRef = useRef(false);

  // Keep your auto-focus and scrollIntoView (horizontal centering)
  useEffect(() => {
    const el = navItemRefs.current[currentQuestionIndex];
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentQuestionIndex]);

  // Restore prior vertical scroll AFTER the above effect runs
  useEffect(() => {
    if (lastScrollYRef.current !== null) {
      window.scrollTo({ top: lastScrollYRef.current, behavior: "auto" });
      lastScrollYRef.current = null;
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (!hydratedRef.current && initialAnswersByQuestionId) {
      setAnswers(prev => ({ ...prev, ...initialAnswersByQuestionId }));
      setCurrentQuestionIndex(initialIndex);
      hydratedRef.current = true;
      onAnswerChange?.({ ...initialAnswersByQuestionId }, initialIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnswersByQuestionId, initialIndex]);

  // Timer (resumed from parent calculation)
  const [timeLeft, setTimeLeft] = useState<number | null>(() => {
    if (initialTimeLeft !== null) return initialTimeLeft;
    return quizData.timeLimit && !isPractice ? quizData.timeLimit * 60 : null;
  });
  useEffect(() => {
    if (initialTimeLeft !== null) setTimeLeft(initialTimeLeft);
  }, [initialTimeLeft]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  // practice grading state
  const [isGraded, setIsGraded] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  const originalById = useMemo(() => {
    const m = new Map<string, Question>();
    quizData.questions.forEach(q => m.set(q.id, q));
    return m;
  }, [quizData.questions]);

  // wrong indices (after grade)
  const wrongAnswerIndices = useMemo(() => {
    if (!isGraded) return [] as number[];
    return processedQuestions
      .map((q, idx) => {
        const orig = originalById.get(q.id);
        if (!orig) return { idx, ok: true };
        const ua = answers[q.id];
        let ok = false;
        if (orig.type === "checkbox") {
          const c = (orig.answer as string[]).slice().sort();
          const s = ((ua as string[]) || []).slice().sort();
          ok = c.length === s.length && c.every((v, i) => v === s[i]);
        } else {
          ok = ua === orig.answer;
        }
        return { idx, ok };
      })
      .filter(x => !x.ok)
      .map(x => x.idx);
  }, [answers, isGraded, processedQuestions, originalById]);

  const isAtFirst = currentQuestionIndex === 0;
  const isAtLast = currentQuestionIndex === processedQuestions.length - 1;
  const prevWrongDisabled = isAtFirst || !wrongAnswerIndices.some(i => i < currentQuestionIndex);
  const nextWrongDisabled = isAtLast || !wrongAnswerIndices.some(i => i > currentQuestionIndex);

  // Countdown (normal mode only). On time-up, auto-submit once.
  useEffect(() => {
    if (timeLeft === null || role === "admin" || isPractice) return;

    if (timeLeft <= 0) {
      if (!autoSubmittedRef.current && onSubmitFinalize) {
        autoSubmittedRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        const result = computeResult();
        onSubmitFinalize(result);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, role, isPractice]);

  // bubble time up to header
  useEffect(() => {
    if (onTimeUpdate && timeLeft !== null) onTimeUpdate(timeLeft);
  }, [timeLeft, onTimeUpdate]);

  // progress
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const answered = processedQuestions.reduce((acc, q) => {
      const a = answers[q.id];
      const has = Array.isArray(a) ? a.length > 0 : !!a;
      return acc + (has ? 1 : 0);
    }, 0);
    setProgress((answered / processedQuestions.length) * 100);
  }, [answers, processedQuestions]);

  // practice re-grade live
  useEffect(() => {
    if (isPractice && isGraded) handleGrade();
  }, [answers, isPractice, isGraded]);

  const emitChange = (nextAnswers: Record<string, string | string[]>, idx: number) => {
    onAnswerChange?.(nextAnswers, idx);
  };

  const handleAnswerSelect = (answer: string) => {
    const q = processedQuestions[currentQuestionIndex];
    const qid = q.id;

    if (q.type === "checkbox") {
      const curr = ((answers[qid] as string[]) || []);
      const updated = curr.includes(answer) ? curr.filter(a => a !== answer) : [...curr, answer];
      setAnswers(prev => {
        const next = { ...prev, [qid]: updated };
        emitChange(next, currentQuestionIndex);
        return next;
      });
    } else {
      setAnswers(prev => {
        const next = { ...prev, [qid]: answer };
        emitChange(next, currentQuestionIndex);
        return next;
      });
    }
  };

  const handleNext = () => {
    if (isAtLast) return;
    rememberScrollY();
    setCurrentQuestionIndex(prev => {
      const idx = prev + 1;
      emitChange(answers, idx);
      return idx;
    });
  };

  const handlePrev = () => {
    if (isAtFirst) return;
    rememberScrollY();
    setCurrentQuestionIndex(prev => {
      const idx = prev - 1;
      emitChange(answers, idx);
      return idx;
    });
  };

  const handleGrade = () => {
    let correct = 0;
    processedQuestions.forEach(q => {
      const orig = originalById.get(q.id);
      if (!orig) return;
      const ua = answers[q.id];
      let ok = false;
      if (orig.type === "checkbox") {
        const c = (orig.answer as string[]).slice().sort();
        const s = ((ua as string[]) || []).slice().sort();
        ok = c.length === s.length && c.every((v, i) => v === s[i]);
      } else {
        ok = ua === orig.answer;
      }
      if (ok) correct++;
    });
    setScore({ correct, total: processedQuestions.length });
    if (!isGraded) setIsGraded(true);
  };

  // Toggle "Show answers" / "Hide answers" (practice only)
  const toggleAnswers = () => {
    if (!isPractice) return;
    if (!isGraded) {
      handleGrade(); // same behavior as Grade
    } else {
      setIsGraded(false); // hide highlights
      setScore(null);     // hide score banner
    }
  };

  const navigateWrongAnswers = (direction: "next" | "prev") => {
    if (!wrongAnswerIndices.length) return;
    if (direction === "prev") {
      const prevWrong = [...wrongAnswerIndices].filter(i => i < currentQuestionIndex).pop();
      if (prevWrong !== undefined) {
        rememberScrollY();
        setCurrentQuestionIndex(prevWrong);
        emitChange(answers, prevWrong);
      }
      return;
    }
    const nextWrong = wrongAnswerIndices.find(i => i > currentQuestionIndex);
    if (nextWrong !== undefined) {
      rememberScrollY();
      setCurrentQuestionIndex(nextWrong);
      emitChange(answers, nextWrong);
    }
  };

  const computeResult = (): QuizResult => {
    let correct = 0;
    const answeredQuestions = processedQuestions.map(q => {
      const orig = originalById.get(q.id)!;
      const ua = answers[q.id];
      let ok = false;
      if (orig.type === "checkbox") {
        const c = (orig.answer as string[]).slice().sort();
        const s = ((ua as string[]) || []).slice().sort();
        ok = c.length === s.length && c.every((v, i) => v === s[i]);
      } else {
        ok = ua === orig.answer;
      }
      if (ok) correct++;
      return {
        question: q.question,
        userAnswer: ua || "No answer",
        correctAnswer: orig.answer,
        isCorrect: ok,
      };
    });

    return {
      date: Date.now(),
      score: correct,
      total: processedQuestions.length,
      answeredQuestions,
      isPractice,
    };
  };

  const handleManualSubmit = async () => {
    if (!onSubmitFinalize) return;
    const result = computeResult();
    await onSubmitFinalize(result);
  };

  const currentQuestion = processedQuestions[currentQuestionIndex];
  if (!currentQuestion) return <p>Loading question...</p>;

  const inputsDisabled = useMemo(() => {
    return role === "admin" || (!isPractice && isGraded);
  }, [role, isPractice, isGraded]);

  // ------- Navigator helpers -------
  const getQuestionStatus = (q: Question): "correct" | "wrong" | "unanswered" => {
    const orig = originalById.get(q.id);
    const ua = answers[q.id];
    const hasAnswer = Array.isArray(ua) ? (ua as string[]).length > 0 : !!ua;
    if (!hasAnswer || !orig) return "unanswered";
    if (Array.isArray(orig.answer)) {
      const c = (orig.answer as string[]).slice().sort();
      const s = ((ua as string[]) || []).slice().sort();
      return c.length === s.length && c.every((v, i) => v === s[i]) ? "correct" : "wrong";
    }
    return ua === orig.answer ? "correct" : "wrong";
  };

  const renderAnswerOptions = () => {
    const orig = originalById.get(currentQuestion.id);
    if (!orig) return null;

    const ua = answers[currentQuestion.id];

    const getOptionClass = (opt: string, isCheckbox = false) => {
  if (!isGraded) return "";
  const correct = orig.answer;
  const isCorrect = Array.isArray(correct)
    ? (correct as string[]).includes(opt)
    : correct === opt;

  if (isCorrect) {
    return "bg-green-100 dark:bg-green-900/30 border-green-500 dark:text-white";
  }

  const selected = isCheckbox ? (ua as string[])?.includes(opt) : ua === opt;
  if (selected && !isCorrect) {
    return "bg-red-100 dark:bg-red-900/30 border-red-500 dark:text-white";
  }
  return "";
};


    switch (currentQuestion.type) {
      case "multiple-choice":
        return (
          <RadioGroup
            value={(ua as string) || ""}
            onValueChange={handleAnswerSelect}
            className="space-y-3"
            disabled={inputsDisabled}
          >
            {currentQuestion.options.map((option, idx) => (
              <Label
                key={idx}
                htmlFor={`option-${idx}`}
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors",
                  getOptionClass(option)
                )}
              >
                <RadioGroupItem value={option} id={`option-${idx}`} disabled={inputsDisabled} />
                {isGraded && (
                  orig.answer === option ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (ua === option) ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <div className="h-5 w-5" />
                  )
                )}
                <span className="whitespace-pre-wrap break-words">{option}</span>
              </Label>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const checked = ((ua as string[]) || []).includes(option);
              return (
                <Label
                  key={idx}
                  htmlFor={`option-${idx}`}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors",
                    getOptionClass(option, true)
                  )}
                >
                  <Checkbox
                    id={`option-${idx}`}
                    onCheckedChange={() => handleAnswerSelect(option)}
                    checked={checked}
                    disabled={inputsDisabled}
                  />
                  {isGraded && (
                    (orig.answer as string[]).includes(option) ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : checked ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <div className="h-5 w-5" />
                    )
                  )}
                  <span className="whitespace-pre-wrap break-words">{option}</span>
                </Label>
              );
            })}
          </div>
        );

      case "short-answer":
        return (
          <Input
            placeholder="Type your answer here..."
            value={(ua as string) || ""}
            onChange={(e) => handleAnswerSelect(e.target.value)}
            disabled={inputsDisabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl shadow-2xl">
      <CardHeader>
        {/* Single-line navigator (more vertical space + auto-select/scroll) */}
        <div ref={navWrapRef} className="mb-3 -mt-1 overflow-x-auto">
          <div className="inline-flex items-center gap-2 whitespace-nowrap py-3 px-1">
            {processedQuestions.map((q, i) => {
              const isActive = i === currentQuestionIndex;
              const status = isGraded ? getQuestionStatus(q) : null;

              const base =
                "relative inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 mx-1 my-0.5 rounded-full border text-xs sm:text-sm font-semibold";

              const neutral =
  "bg-white dark:bg-white/5 border-[rgba(32,43,96,0.25)] text-foreground dark:text-white";
              const activeBlue =
                "bg-[rgba(32,43,96,1)] text-white border-[rgba(32,43,96,1)]";
              const correct = "bg-green-500 text-white border-green-500";
              const wrong   = "bg-red-500 text-white border-red-500";
              const blank   = "bg-gray-400 text-white border-gray-400";

              const colorClass = !isGraded
                ? (isActive ? activeBlue : neutral)
                : (status === "correct" ? correct : status === "wrong" ? wrong : blank);

              const activeRing = isActive ? "ring-2 ring-[rgba(32,43,96,1)]" : "";

              return (
                <button
                  key={q.id}
                  type="button"
                  ref={(el) => { navItemRefs.current[i] = el; }}
                  onClick={() => {
                    rememberScrollY();
                    setCurrentQuestionIndex(i);
                    onAnswerChange?.(answers, i);
                  }}
                  className={`${base} ${colorClass} ${activeRing} focus:outline-none`}
                  aria-label={`Question ${i + 1}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {isPractice && !isGraded && (
          <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <Beaker className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">
              Practice Mode
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              Your results will not be saved. Click &quot;Grade&quot; to see your score.
            </AlertDescription>
          </Alert>
        )}

        {isGraded && score && (
          <Alert className="mb-4 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800">
            <AlertTitle className="text-indigo-800 dark:text-indigo-300 text-lg font-bold text-center">
              Your Score: {Math.round((score.correct / score.total) * 100)}% ({score.correct}/{score.total})
            </AlertTitle>
            <AlertDescription className="text-indigo-700 dark:text-indigo-400 text-center">
              You can continue editing your answers in Practice Mode — highlights and score update as you change.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <CardDescription>
            Question {currentQuestionIndex + 1} of {processedQuestions.length}
          </CardDescription>
        </div>

        {/* Always-visible toggle (practice only) */}
        {isPractice && (
          <div className="mt-2 mb-1 flex justify-end">
            <Button
              onClick={toggleAnswers}
              disabled={role === "admin"}
              className={cn(
                "transition-colors",
                isGraded
                  ? "bg-white text-[rgba(32,43,96,1)] border border-[rgba(32,43,96,0.3)] hover:bg-accent/10"
                  : "bg-accent text-accent-foreground hover:bg-accent/90"
              )}
              variant={isGraded ? "outline" : undefined}
            >
              {isGraded ? "Hide answers" : "Show answers"}
            </Button>
          </div>
        )}

        <CardTitle className="pt-2 text-2xl font-headline whitespace-pre-wrap break-words">
          {currentQuestion.question}
        </CardTitle>

        {currentQuestion.imageUrl && (
          <div className="relative mt-4 h-64 w-full">
            <Image
              src={currentQuestion.imageUrl}
              alt={`Question ${currentQuestionIndex + 1}`}
              fill
              style={{ objectFit: "contain" }}
              className="rounded-md"
            />
          </div>
        )}
      </CardHeader>

      <CardContent>{renderAnswerOptions()}</CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
            Previous
          </Button>
          {isGraded && wrongAnswerIndices.length > 0 && (
            <Button
              variant="outline"
              onClick={() => navigateWrongAnswers("prev")}
              disabled={prevWrongDisabled}
            >
              Prev Wrong
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentQuestionIndex === processedQuestions.length - 1 && !isGraded ? (
            isPractice ? (
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleGrade}
                disabled={role === "admin"}
              >
                Grade
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={role === "admin"}>
                    Submit Quiz
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to submit?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. You will not be able to change your answers after submitting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleManualSubmit}>Confirm & Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          ) : (
            <>
              {isGraded && wrongAnswerIndices.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => navigateWrongAnswers("next")}
                  disabled={nextWrongDisabled}
                >
                  Next Wrong
                </Button>
              )}
              <Button onClick={handleNext} disabled={currentQuestionIndex === processedQuestions.length - 1}>
                Next
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
