
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, ArrowRight, History, BarChart, Percent, Edit, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import type { Quiz } from "@/lib/types";
import { getQuizzesForUser, getQuizzes, getAllResultsForQuiz } from "@/services/quiz-service";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

const getBadgeVariant = (status: string) => {
    switch (status) {
        case "Completed": return "default";
        case "Not Submitted": return "secondary";
        default: return "outline";
    }
}

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
    )
}

export default function QuizzesPage() {
    const { role, user } = useAuth();
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [averageScores, setAverageScores] = useState<Record<string, number | null>>({});

    useEffect(() => {
        if (!user) return;

        const fetchQuizzes = async () => {
            setLoading(true);
            try {
                const fetchedQuizzes = role === 'admin' 
                    ? await getQuizzes() 
                    : await getQuizzesForUser(user.uid);
                
                setQuizzes(fetchedQuizzes);

                if (role === 'admin') {
                    const scores: Record<string, number | null> = {};
                    for (const quiz of fetchedQuizzes) {
                        const results = await getAllResultsForQuiz(quiz.id);
                        if (results.length > 0) {
                            const totalScore = results.reduce((acc, result) => acc + (result.score / result.total) * 100, 0);
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
        if(quiz.status === 'Not Started') return 'Not Submitted';
        return quiz.status;
    };

    const handleNavigate = (path: string, action: string) => {
        setLoadingAction(action);
        router.push(path);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Quizzes</h1>
                    <p className="text-muted-foreground">
                        {role === 'admin' ? "Manage your quizzes here." : "View and take your quizzes here."}
                    </p>
                </div>
                {role === 'admin' && (
                    <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Link href="/dashboard/quizzes/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Quiz
                        </Link>
                    </Button>
                )}
            </div>
            
            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {[...Array(3)].map((_, i) => <QuizCardSkeleton key={i} />)}
                </div>
            ) : quizzes.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {quizzes.map(quiz => {
                        const status = getQuizStatus(quiz);
                        const hasAttempts = quiz.results && quiz.results.length > 0;
                        const averageScore = averageScores[quiz.id];
                        const isActionLoading = (action: string) => loadingAction === `${action}-${quiz.id}`;
                        
                        return (
                            <Card key={quiz.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{quiz.title}</CardTitle>
                                        {role === 'student' && <Badge variant={getBadgeVariant(status)}>{status}</Badge>}
                                    </div>
                                    <CardDescription>{quiz.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>{quiz.questions.length} Questions</span>
                                        {role === 'admin' && averageScore !== null && averageScore !== undefined ? (
                                            <span className="flex items-center gap-1 font-semibold text-primary">
                                                <Percent className="h-4 w-4" />
                                                {averageScore}% Avg. Score
                                            </span>
                                        ) : role === 'admin' ? (
                                             <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                                No attempts yet
                                            </span>
                                        ) : hasAttempts ? (
                                            <span className="flex items-center gap-1">
                                                <History className="h-4 w-4" />
                                                {quiz.results?.length} attempt{quiz.results?.length === 1 ? '' : 's'}
                                            </span>
                                        ) : null}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col items-stretch gap-2">
                                     {role === 'admin' ? (
                                        <>
                                            <Button 
                                                onClick={() => handleNavigate(`/dashboard/quizzes/${quiz.id}/analytics`, 'analytics')}
                                                variant="outline"
                                                disabled={isActionLoading('analytics')}
                                            >
                                                {isActionLoading('analytics') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart className="mr-2 h-4 w-4" />}
                                                View Analytics
                                            </Button>
                                            <Button 
                                                onClick={() => handleNavigate(`/dashboard/quizzes/${quiz.id}/edit`, 'edit')}
                                                disabled={isActionLoading('edit')}
                                            >
                                                {isActionLoading('edit') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
                                                Edit Quiz
                                            </Button>
                                        </>
                                     ) : hasAttempts ? (
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
                        )
                    })}
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>No Quizzes Available</CardTitle>
                        <CardDescription>
                            {role === 'admin' 
                                ? "You haven't created any quizzes yet. Get started by creating a new one." 
                                : "There are no quizzes assigned to you at the moment. Please check back later."}
                        </CardDescription>
                    </CardHeader>
                    {role === 'admin' && (
                        <CardContent>
                             <Button onClick={() => handleNavigate('/dashboard/quizzes/new', 'create')} disabled={loadingAction === 'create'}>
                                {loadingAction === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Create Your First Quiz
                            </Button>
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    );
}
