
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import type { Quiz, QuizResult } from "@/lib/types";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { getQuizForUser } from "@/services/quiz-service";

export default function ResultsPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const id = params.id as string;
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [latestResult, setLatestResult] = useState<QuizResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState<string | null>(null);

    useEffect(() => {
        if (id && user) {
            getQuizForUser(id, user.uid)
                .then(currentQuiz => {
                    if (currentQuiz) {
                        setQuiz(currentQuiz);
                        if (currentQuiz.results && currentQuiz.results.length > 0) {
                            // Sort results by date to find the latest one
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

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading results...</p></div>;
    }

    if (!quiz || !latestResult) {
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
                            <h2 className="text-xl font-bold mb-4 font-headline text-center">Latest Attempt</h2>
                            <div className="text-center p-8 bg-primary/10 rounded-lg">
                                <p className="text-lg text-muted-foreground">Your Score</p>
                                <p className="text-6xl font-bold text-primary">{percentage}%</p>
                                <p className="text-muted-foreground">You answered {latestResult.score} out of {latestResult.total} questions correctly.</p>
                            </div>
                        </div>
                        
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="review-answers">
                                <AccordionTrigger className="text-xl font-bold font-headline">Review Your Answers (Latest Attempt)</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                    {latestResult.answeredQuestions.map((item, index) => (
                                        <div key={index} className={`p-4 rounded-lg border-l-4 ${item.isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                            <div className="flex items-start justify-between">
                                                <p className="font-semibold">{index + 1}. {item.question}</p>
                                                {item.isCorrect 
                                                    ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> 
                                                    : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                                }
                                            </div>
                                            <div className="mt-2 text-sm space-y-1">
                                                <p><strong>Your answer:</strong> {Array.isArray(item.userAnswer) ? item.userAnswer.join(', ') : item.userAnswer}</p>
                                                {!item.isCorrect && (
                                                    <p><strong>Correct answer:</strong> {Array.isArray(item.correctAnswer) ? item.correctAnswer.join(', ') : item.correctAnswer}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                             {allResultsSorted && allResultsSorted.length > 1 && (
                                <AccordionItem value="attempt-history">
                                     <AccordionTrigger className="text-xl font-bold font-headline">Attempt History</AccordionTrigger>
                                     <AccordionContent className="space-y-2 pt-4">
                                        {allResultsSorted.map((result, index) => (
                                            <div key={result.date} className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                                                <div className="font-medium">
                                                    Attempt {allResultsSorted.length - index} 
                                                    <span className="ml-2 text-sm text-muted-foreground">({new Date(result.date).toLocaleString()})</span>
                                                </div>
                                                <Badge>{Math.round((result.score / result.total) * 100)}%</Badge>
                                            </div>
                                        ))}
                                     </AccordionContent>
                                </AccordionItem>
                            )}
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
