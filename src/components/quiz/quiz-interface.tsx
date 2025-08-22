"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { useRouter } from 'next/navigation';
import type { Question, Quiz, QuizResult } from '@/lib/types';
import Image from 'next/image';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { useAuth } from '@/context/auth-context';
import { submitQuizResult } from '@/services/quiz-service';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Beaker, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function QuizInterface({ quizData, onTimeUpdate, isPractice }: { quizData: Quiz, onTimeUpdate?: (time: number) => void, isPractice: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, role } = useAuth();
  
  const [processedQuestions] = useState(() => {
    let questions = quizData.questions;
    if (quizData.shuffleQuestions) {
      questions = shuffleArray(questions);
    }
    if (quizData.shuffleAnswers) {
      questions = questions.map(q => ({
        ...q,
        options: q.type !== 'short-answer' ? shuffleArray(q.options) : [],
      }));
    }
    return questions;
  });
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quizData.timeLimit && !isPractice ? quizData.timeLimit * 60 : null);
  
  // Practice mode specific state
  const [isGraded, setIsGraded] = useState(false);
  const [score, setScore] = useState<{ correct: number, total: number } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const originalQuestionsMap = useMemo(() => {
    const map = new Map<string, Question>();
    quizData.questions.forEach(q => map.set(q.id, q));
    return map;
  }, [quizData.questions]);

  const { wrongAnswerIndices, currentWrongIndex } = useMemo(() => {
    if (!isGraded) return { wrongAnswerIndices: [], currentWrongIndex: -1 };
    
    const indices = processedQuestions
      .map((q, index) => {
        const originalQuestion = originalQuestionsMap.get(q.id);
        if (!originalQuestion) return { index, isCorrect: true };

        const userAnswer = answers[index];
        let isCorrect = false;
        if (originalQuestion.type === 'checkbox') {
          const correctAnswers = (originalQuestion.answer as string[]).sort();
          const studentAnswers = (userAnswer as string[] || []).sort();
          isCorrect = correctAnswers.length === studentAnswers.length && correctAnswers.every((val, i) => val === studentAnswers[i]);
        } else {
          isCorrect = userAnswer === originalQuestion.answer;
        }
        return { index, isCorrect };
      })
      .filter(item => !item.isCorrect)
      .map(item => item.index);
    
    const wrongIndex = indices.indexOf(currentQuestionIndex);

    return { wrongAnswerIndices: indices, currentWrongIndex: wrongIndex };
  }, [answers, isGraded, processedQuestions, originalQuestionsMap, currentQuestionIndex]);

  useEffect(() => {
    if (timeLeft === null || role === 'admin' || isPractice) return;
    if (timeLeft <= 0) {
      handleSubmit(true); // Force submit when time is up
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, role, isPractice]);

  useEffect(() => {
    if (onTimeUpdate && timeLeft !== null) {
      onTimeUpdate(timeLeft);
    }
  }, [timeLeft, onTimeUpdate]);

  useEffect(() => {
    const answeredCount = Object.values(answers).filter(a => (Array.isArray(a) ? a.length > 0 : a)).length;
    setProgress((answeredCount / processedQuestions.length) * 100);
  }, [answers, processedQuestions.length]);

  // Live re-grade in Practice Mode after first grading
  useEffect(() => {
    if (isPractice && isGraded) {
      handleGrade();
    }
  }, [answers, isPractice, isGraded]);

  const handleAnswerSelect = (answer: string) => {
    const currentQuestion = processedQuestions[currentQuestionIndex];
    if (currentQuestion.type === 'checkbox') {
      const currentAnswers = (answers[currentQuestionIndex] as string[] || []);
      const newAnswers = currentAnswers.includes(answer) 
        ? currentAnswers.filter(a => a !== answer)
        : [...currentAnswers, answer];
      setAnswers(prev => ({ ...prev, [currentQuestionIndex]: newAnswers }));
    } else {
      setAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < processedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };
  
  const handleGrade = () => {
    let correctCount = 0;
    processedQuestions.forEach((q, index) => {
      const originalQuestion = originalQuestionsMap.get(q.id);
      if (!originalQuestion) return;
      const userAnswer = answers[index];
      let isCorrect = false;

      if (originalQuestion.type === 'checkbox') {
        const correctAnswers = (originalQuestion.answer as string[]).sort();
        const studentAnswers = (userAnswer as string[] || []).sort();
        isCorrect = correctAnswers.length === studentAnswers.length && correctAnswers.every((val, i) => val === studentAnswers[i]);
      } else {
        isCorrect = userAnswer === originalQuestion.answer;
      }
      if (isCorrect) correctCount++;
    });
    setScore({ correct: correctCount, total: processedQuestions.length });
    if (!isGraded) setIsGraded(true);
  };

  const navigateWrongAnswers = (direction: 'next' | 'prev') => {
    if (wrongAnswerIndices.length === 0) return;
    if (direction === 'next') {
      const nextIndex = currentWrongIndex + 1 < wrongAnswerIndices.length ? wrongAnswerIndices[currentWrongIndex + 1] : undefined;
      if (nextIndex !== undefined) setCurrentQuestionIndex(nextIndex);
    } else {
      const prevIndex = currentWrongIndex - 1 >= 0 ? wrongAnswerIndices[currentWrongIndex - 1] : undefined;
      if (prevIndex !== undefined) setCurrentQuestionIndex(prevIndex);
    }
  };

  const handleSubmit = async (timeUp = false) => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (role === 'admin' || !user) {
      router.push('/dashboard/quizzes');
      return;
    }

    let scoreCount = 0;
    const answeredQuestions: QuizResult['answeredQuestions'] = [];

    processedQuestions.forEach((q, index) => {
      const userAnswer = answers[index];
      let isCorrect = false;
      const originalQuestion = originalQuestionsMap.get(q.id);
      if (!originalQuestion) return;

      if (originalQuestion.type === 'checkbox') {
        const correctAnswers = (originalQuestion.answer as string[]).sort();
        const studentAnswers = (userAnswer as string[] || []).sort();
        isCorrect = correctAnswers.length === studentAnswers.length && correctAnswers.every((val, i) => val === studentAnswers[i]);
      } else {
        isCorrect = userAnswer === originalQuestion.answer;
      }

      if (isCorrect) scoreCount++;

      answeredQuestions.push({
        question: q.question,
        userAnswer: userAnswer || "No answer",
        correctAnswer: originalQuestion.answer,
        isCorrect,
      });
    });

    const newResult: QuizResult = {
      date: Date.now(),
      score: scoreCount,
      total: processedQuestions.length,
      answeredQuestions,
      isPractice: isPractice,
    };
    
    try {
      await submitQuizResult(quizData.id, user.uid, newResult);
      if (timeUp) {
        toast({
          title: "Time's up!",
          description: "Your quiz has been submitted automatically.",
          variant: "destructive"
        });
      }
      router.push(`/quiz/${quizData.id}/results?practice=${isPractice}`);
    } catch (error) {
      console.error("Failed to submit quiz results:", error);
      toast({
        title: "Error",
        description: "Could not submit your quiz results. Please try again.",
        variant: "destructive"
      });
    }
  };

  const currentQuestion = processedQuestions[currentQuestionIndex];
  if (!currentQuestion) return <p>Loading question...</p>;

  // NEW: helper so inputs stay enabled in practice after grading
  const inputsDisabled = useMemo(() => {
    // Disable for admins, and for graded state ONLY in real quizzes
    return role === 'admin' || (!isPractice && isGraded);
  }, [role, isPractice, isGraded]);

  const renderAnswerOptions = () => {
    const originalQuestion = originalQuestionsMap.get(currentQuestion.id);
    if (!originalQuestion) return null;

    const getOptionClass = (option: string, isCheckbox: boolean = false) => {
      if (!isGraded) return '';
      const correctAnswer = originalQuestion.answer;
      const userAnswer = answers[currentQuestionIndex];
      const isCorrect = Array.isArray(correctAnswer) ? (correctAnswer as string[]).includes(option) : correctAnswer === option;

      if (isCorrect) return 'bg-green-100 dark:bg-green-900/30 border-green-500';

      const isSelected = isCheckbox ? (userAnswer as string[])?.includes(option) : userAnswer === option;
      if (isSelected && !isCorrect) return 'bg-red-100 dark:bg-red-900/30 border-red-500';
      return '';
    };

    switch (currentQuestion.type) {
      case 'multiple-choice':
        return (
          <RadioGroup
            value={(answers[currentQuestionIndex] as string) || ""}
            onValueChange={handleAnswerSelect}
            className="space-y-3"
            disabled={inputsDisabled}
          >
            {currentQuestion.options.map((option, index) => (
              <Label
                key={index}
                htmlFor={`option-${index}`}
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors",
                  getOptionClass(option)
                )}
              >
                <RadioGroupItem value={option} id={`option-${index}`} disabled={inputsDisabled}/>
                {isGraded && (
                  originalQuestion.answer === option
                    ? <CheckCircle className="h-5 w-5 text-green-600"/>
                    : ((answers[currentQuestionIndex] === option)
                        ? <XCircle className="h-5 w-5 text-red-600"/>
                        : <div className="h-5 w-5"/>)
                )}
                <span>{option}</span>
              </Label>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <Label
                key={index}
                htmlFor={`option-${index}`}
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors",
                  getOptionClass(option, true)
                )}
              >
                <Checkbox
                  id={`option-${index}`}
                  onCheckedChange={() => handleAnswerSelect(option)}
                  checked={(answers[currentQuestionIndex] as string[] || []).includes(option)}
                  disabled={inputsDisabled}
                />
                {isGraded && (
                  (originalQuestion.answer as string[]).includes(option)
                    ? <CheckCircle className="h-5 w-5 text-green-600"/>
                    : ((answers[currentQuestionIndex] as string[])?.includes(option)
                        ? <XCircle className="h-5 w-5 text-red-600"/>
                        : <div className="h-5 w-5"/>)
                )}
                <span>{option}</span>
              </Label>
            ))}
          </div>
        );
      case 'short-answer':
        return (
          <Input
            placeholder="Type your answer here..."
            value={(answers[currentQuestionIndex] as string) || ""}
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
        {isPractice && !isGraded && (
          <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <Beaker className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">Practice Mode</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              Your results will not be saved. Click &quot;Grade&quot; to see your score.
            </AlertDescription>
          </Alert>
        )}
        {isGraded && score && (
          <Alert variant="default" className="mb-4 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800">
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
        <CardTitle className="pt-4 text-2xl font-headline">
          {currentQuestion.question}
        </CardTitle>
        {currentQuestion.imageUrl && (
          <div className="relative mt-4 h-64 w-full">
            <Image src={currentQuestion.imageUrl} alt={`Question ${currentQuestionIndex + 1}`} fill style={{objectFit: "contain"}} className="rounded-md"/>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {renderAnswerOptions()}
      </CardContent>

      <CardFooter className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
            Previous
          </Button>
          {isGraded && wrongAnswerIndices.length > 0 && (
            <Button
              variant="outline"
              onClick={() => navigateWrongAnswers('prev')}
              disabled={currentWrongIndex <= 0}
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
                disabled={role === 'admin'}
              >
                Grade
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={role === 'admin'}>
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
                    <AlertDialogAction onClick={() => handleSubmit(false)}>Confirm & Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          ) : (
            <>
              {isGraded && wrongAnswerIndices.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => navigateWrongAnswers('next')}
                  disabled={currentWrongIndex >= wrongAnswerIndices.length - 1}
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
