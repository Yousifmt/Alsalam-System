
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuiz, getAllResultsForQuiz } from "@/services/quiz-service";
import type { Quiz, QuizResult } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BarChart2, Users, Target, CheckCircle, Percent } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

interface QuestionStat {
    question: string;
    correctAttempts: number;
    totalAttempts: number;
    correctPercentage: number;
}

export default function QuizAnalyticsPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [results, setResults] = useState<QuizResult[]>([]);
    const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
    const [averageScore, setAverageScore] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(id),
                    getAllResultsForQuiz(id),
                ]);

                if (!quizData) {
                    throw new Error("Quiz not found");
                }

                setQuiz(quizData);
                setResults(resultsData);

                if (resultsData.length > 0) {
                    // Calculate average score
                    const totalScore = resultsData.reduce((acc, result) => acc + (result.score / result.total) * 100, 0);
                    setAverageScore(Math.round(totalScore / resultsData.length));
                    
                    // Calculate question stats
                    const stats: Record<string, { correct: number, total: number }> = {};

                    quizData.questions.forEach(q => {
                        stats[q.question] = { correct: 0, total: 0 };
                    });

                    resultsData.forEach(result => {
                        result.answeredQuestions.forEach(aq => {
                            if (stats[aq.question]) {
                                stats[aq.question].total++;
                                if (aq.isCorrect) {
                                    stats[aq.question].correct++;
                                }
                            }
                        });
                    });

                    const formattedStats = Object.entries(stats).map(([question, data]) => ({
                        question,
                        correctAttempts: data.correct,
                        totalAttempts: data.total,
                        correctPercentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
                    }));
                    setQuestionStats(formattedStats);
                }

            } catch (error) {
                console.error("Failed to fetch quiz analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }

    if (!quiz) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-bold">Quiz Not Found</h1>
                <p>The requested quiz could not be found.</p>
                 <Button asChild variant="link" className="mt-4">
                    <Link href="/dashboard/quizzes">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Quizzes
                    </Link>
                </Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div>
                 <Button asChild variant="outline" size="sm" className="mb-4">
                     <Link href="/dashboard/quizzes">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Quizzes
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{quiz.title} - Analytics</h1>
                <p className="text-muted-foreground">{quiz.description}</p>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart2 className="text-accent" /> Overall Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    {results.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-3">
                            <div className="flex flex-col items-center justify-center p-4 bg-secondary rounded-lg">
                                <Users className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-3xl font-bold">{results.length}</p>
                                <p className="text-sm text-muted-foreground">Total Attempts</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 bg-secondary rounded-lg">
                                <Target className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-3xl font-bold">{averageScore}%</p>
                                <p className="text-sm text-muted-foreground">Average Score</p>
                            </div>
                        </div>
                    ) : (
                         <div className="text-center text-muted-foreground p-8">
                            <p>No one has attempted this quiz yet. Check back once there are results.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {results.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Question Breakdown</CardTitle>
                        <CardDescription>Performance statistics for each question in the quiz.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {questionStats.map((stat, index) => (
                            <div key={index} className="space-y-2">
                                <p className="font-semibold">{index + 1}. {stat.question}</p>
                                <div className="flex items-center gap-4">
                                    <Progress value={stat.correctPercentage} className="h-3 flex-1" />
                                    <div className="flex items-center font-mono text-sm font-semibold w-28">
                                         <CheckCircle className="h-4 w-4 mr-2 text-green-500"/>
                                         <span className="w-12">{stat.correctPercentage}%</span>
                                         <span className="text-xs text-muted-foreground ml-1">({stat.correctAttempts}/{stat.totalAttempts})</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
