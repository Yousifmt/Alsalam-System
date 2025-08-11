
"use client";

import React, { useState, useEffect, useRef } from 'react';
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

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function QuizInterface({ quizData, onTimeUpdate }: { quizData: Quiz, onTimeUpdate?: (time: number) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, role } = useAuth();
  
  const [processedQuestions, setProcessedQuestions] = useState(() => {
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
  const [timeLeft, setTimeLeft] = useState(quizData.timeLimit ? quizData.timeLimit * 60 : null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeLeft === null || role === 'admin') return;
  
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
  }, [timeLeft, role]);

  useEffect(() => {
    if (onTimeUpdate && timeLeft !== null) {
        onTimeUpdate(timeLeft);
    }
  }, [timeLeft, onTimeUpdate]);


  useEffect(() => {
    const answeredCount = Object.values(answers).filter(a => (Array.isArray(a) ? a.length > 0 : a)).length;
    setProgress((answeredCount / processedQuestions.length) * 100);
  }, [answers, processedQuestions.length]);

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
  
  const handleSubmit = async (timeUp = false) => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (role === 'admin') {
      router.push('/dashboard/quizzes');
      return;
    }

    if (!user) return;

    let score = 0;
    const answeredQuestions: QuizResult['answeredQuestions'] = [];

    processedQuestions.forEach((q, index) => {
        const userAnswer = answers[index];
        let isCorrect = false;
        
        const originalQuestion = quizData.questions.find(origQ => origQ.id === q.id);
        if (!originalQuestion) return;

        if (originalQuestion.type === 'checkbox') {
            const correctAnswers = (originalQuestion.answer as string[]).sort();
            const studentAnswers = (userAnswer as string[] || []).sort();
            isCorrect = correctAnswers.length === studentAnswers.length && correctAnswers.every((val, i) => val === studentAnswers[i]);
        } else {
            isCorrect = userAnswer === originalQuestion.answer;
        }

        if (isCorrect) {
            score++;
        }

        answeredQuestions.push({
            question: q.question,
            userAnswer: userAnswer || "No answer",
            correctAnswer: originalQuestion.answer,
            isCorrect,
        });
    });

    const newResult: QuizResult = {
        date: Date.now(),
        score,
        total: processedQuestions.length,
        answeredQuestions,
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
        router.push(`/quiz/${quizData.id}/results`);
    } catch (error) {
        console.error("Failed to submit quiz results:", error);
        toast({
            title: "Error",
            description: "Could not submit your quiz results. Please try again.",
            variant: "destructive"
        });
    }
  }

  const currentQuestion = processedQuestions[currentQuestionIndex];

  if (!currentQuestion) {
    return <p>Loading question...</p>;
  }

  const renderAnswerOptions = () => {
    switch (currentQuestion.type) {
      case 'multiple-choice':
        return (
          <RadioGroup
            value={answers[currentQuestionIndex] as string || ""}
            onValueChange={handleAnswerSelect}
            className="space-y-3"
            disabled={role === 'admin'}
          >
            {currentQuestion.options.map((option, index) => (
              <Label key={index} htmlFor={`option-${index}`} className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors">
                <RadioGroupItem value={option} id={`option-${index}`} />
                <span>{option}</span>
              </Label>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <Label key={index} htmlFor={`option-${index}`} className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-secondary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:border-primary transition-colors">
                 <Checkbox 
                    id={`option-${index}`} 
                    onCheckedChange={() => handleAnswerSelect(option)}
                    checked={(answers[currentQuestionIndex] as string[] || []).includes(option)}
                    disabled={role === 'admin'}
                />
                <span>{option}</span>
              </Label>
            ))}
          </div>
        );
      case 'short-answer':
         return (
             <Input 
                placeholder="Type your answer here..."
                value={answers[currentQuestionIndex] as string || ""}
                onChange={(e) => handleAnswerSelect(e.target.value)}
                disabled={role === 'admin'}
             />
         )
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-3xl shadow-2xl">
      <CardHeader>
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
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
          Previous
        </Button>
        {currentQuestionIndex === processedQuestions.length - 1 ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={role === 'admin'}>Submit Quiz</Button>
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
        ) : (
          <Button onClick={handleNext}>
            Next
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
