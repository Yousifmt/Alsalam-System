// viewing answer functionality
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import type { Quiz, QuizResult, Question } from "@/lib/types";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { getQuizForUser, getQuiz } from "@/services/quiz-service";

const AnswerOption = ({
  option,
  isUserAnswer,
  isCorrectAnswer,
}: {
  option: string;
  isUserAnswer: boolean;
  isCorrectAnswer: boolean;
}) => {
  const isCorrectSelection = isUserAnswer && isCorrectAnswer;
  const isWrongSelection = isUserAnswer && !isCorrectAnswer;

  return (
    <div className="flex items-center text-sm ml-6">
      {isCorrectSelection ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
      ) : isWrongSelection ? (
        <XCircle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
      ) : isCorrectAnswer ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500/50 flex-shrink-0" />
      ) : (
        <div className="h-4 w-4 mr-2" /> // Placeholder for alignment
      )}
      <span
        className={`${
          isUserAnswer ? "font-semibold" : ""
        } ${isCorrectAnswer ? "text-green-700 dark:text-green-400" : ""}`}
      >
        {option}
      </span>
    </div>
  );
};


export default function ResultsPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const id = params.id as string;
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [masterQuiz, setMasterQuiz] = useState<Quiz | null>(null);
    const [latestResult, setLatestResult] = useState<QuizResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState<string | null>(null);

    useEffect(() => {
        if (id && user) {
            Promise.all([
                getQuizForUser(id, user.uid),
                getQuiz(id) // fetch the master quiz for all options
            ])
            .then(([currentQuiz, masterQuizData]) => {
                if (currentQuiz) {
                    setQuiz(currentQuiz);
                    setMasterQuiz(masterQuizData);
                    if (currentQuiz.results && currentQuiz.results.length > 0) {
                        const sortedResults = [...currentQuiz.results].sort((a, b) => b.date - a.date);
                        setLatestResult(sortedResults[0]);
                    }
                }
            })
            .catch(err => console.error("Failed to load quiz results", err))
            .finally(() => setLoading(false));
        } else {
             setLoading(false);
        }
    }, [id, user]);

    const handleNavigation = (path: string, type: 'retake' | 'back') => {
        setIsNavigating(type);
        router.push(path);
    }
    
    const findOriginalQuestion = (questionText: string): Question | undefined => {
        return masterQuiz?.questions.find(q => q.question === questionText);
    }

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading results...</p></div>;
    }

    if (!quiz || !latestResult || !masterQuiz) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-secondary">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>Result Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>The result for this quiz could not be found. It might not have been completed yet.</p>
                        <Button asChild className="mt-4">
                            <Link href="/dashboard/quizzes">Return to Quizzes</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { title, results } = quiz;
    const percentage = Math.round((latestResult.score / latestResult.total) * 100);
    const allResultsSorted = results ? [...results].sort((a, b) => b.date - a.date) : [];

    return (
        <div className="min-h-screen bg-secondary p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Card className="shadow-2xl">
                    <CardHeader className="text-center border-b">
                        <p className="text-sm text-muted-foreground">Results for</p>
                        <CardTitle className="text-3xl font-bold font-headline">{title}</CardTitle>
                        <CardDescription>Great job on completing the quiz!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                        <div>
                            <h2 className="text-xl font-bold mb-4 font-headline text-center">Latest Attempt Score</h2>
                            <div className="text-center p-8 bg-primary/10 rounded-lg">
                                <p className="text-6xl font-bold text-primary">{percentage}%</p>
                                <p className="text-muted-foreground">You answered {latestResult.score} out of {latestResult.total} questions correctly.</p>
                            </div>
                        </div>
                        
                        <Accordion type="single" collapsible className="w-full" defaultValue="attempt-0">
                            <AccordionItem value="attempt-history">
                                <AccordionTrigger className="text-xl font-bold font-headline">Review Attempts</AccordionTrigger>
                                <AccordionContent className="pt-4 space-y-2">
                                    <Accordion type="multiple" className="w-full space-y-2">
                                        {allResultsSorted.map((result, index) => (
                                            <AccordionItem value={`attempt-${index}`} key={result.date} className="bg-background/50 rounded-lg px-4 border">
                                                <AccordionTrigger className="py-3 hover:no-underline">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div className="font-medium">
                                                            Attempt {allResultsSorted.length - index} 
                                                            <span className="ml-2 text-sm text-muted-foreground">({new Date(result.date).toLocaleString()})</span>
                                                        </div>
                                                        <Badge>{Math.round((result.score / result.total) * 100)}%</Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pt-2 pb-4 space-y-4">
                                                    {result.answeredQuestions.map((item, qIndex) => {
                                                        const originalQuestion = findOriginalQuestion(item.question);
                                                        if (!originalQuestion) return null;
                                                        
                                                        const userAnswerArray = Array.isArray(item.userAnswer) ? item.userAnswer : [item.userAnswer];
                                                        const correctAnswerArray = Array.isArray(originalQuestion.answer) ? originalQuestion.answer : [originalQuestion.answer];

                                                        return (
                                                             <div key={qIndex} className={`p-3 rounded-lg border-l-4 ${item.isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                                                <div className="flex items-start justify-between">
                                                                    <p className="font-semibold">{qIndex + 1}. {item.question}</p>
                                                                    {item.isCorrect 
                                                                        ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" /> 
                                                                        : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                                                                    }
                                                                </div>
                                                                <div className="mt-2 text-sm space-y-1">
                                                                     <p className="font-medium">Options:</p>
                                                                     {originalQuestion.options.map(opt => (
                                                                         <AnswerOption 
                                                                            key={opt}
                                                                            option={opt}
                                                                            isUserAnswer={userAnswerArray.includes(opt)}
                                                                            isCorrectAnswer={correctAnswerArray.includes(opt)}
                                                                         />
                                                                     ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-6">
                       <Button variant="outline" onClick={() => handleNavigation('/dashboard/quizzes', 'back')} disabled={!!isNavigating}>
                           {isNavigating === 'back' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowLeft className="mr-2"/>} Back to Quizzes
                       </Button>
                       <Button onClick={() => handleNavigation(`/quiz/${id}`, 'retake')} disabled={!!isNavigating}>
                            {isNavigating === 'retake' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2"/>} Retake Quiz
                       </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
// viewing answer functionality
