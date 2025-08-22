
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQuiz } from "@/services/quiz-service";
import type { Quiz } from "@/lib/types";
import { Loader2, ArrowLeft, ShieldCheck, Beaker, ArrowRight, BookOpen } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function StartQuizPage() {
    const params = useParams();
    const router = useRouter();
    const { user, role, loading: authLoading } = useAuth();
    const id = params.id as string;
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (role === 'admin') {
            router.replace(`/dashboard/quizzes/${id}/edit`);
            return;
        }

        if (id) {
            getQuiz(id)
                .then(setQuiz)
                .finally(() => setLoading(false));
        }
    }, [id, authLoading, role, router]);

    if (loading || authLoading) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
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
                            <Link href={`/quiz/${id}?mode=normal`} className="group">
                                <div className="p-6 border rounded-lg h-full flex flex-col items-center text-center hover:border-primary hover:bg-primary/5 transition-all">
                                    <ShieldCheck className="h-12 w-12 text-primary mb-4"/>
                                    <h3 className="text-lg font-semibold">Normal Mode</h3>
                                    <p className="text-muted-foreground text-sm mt-1">Your score will be recorded and will count towards your grade.</p>
                                    <Button className="mt-auto w-full group-hover:bg-primary group-hover:text-primary-foreground" variant="outline">
                                        Start Official Attempt <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                </div>
                            </Link>
                             <Link href={`/quiz/${id}?mode=practice`} className="group">
                                <div className="p-6 border rounded-lg h-full flex flex-col items-center text-center hover:border-accent hover:bg-accent/5 transition-all">
                                    <Beaker className="h-12 w-12 text-accent mb-4"/>
                                    <h3 className="text-lg font-semibold">Practice Mode</h3>
                                    <p className="text-muted-foreground text-sm mt-1">Take the quiz for practice. Your results will not affect your grade.</p>
                                    <Button className="mt-auto w-full bg-accent/10 text-accent border-accent/20 group-hover:bg-accent group-hover:text-accent-foreground" variant="outline">
                                        Start Practice <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-start border-t pt-6">
                       <Button variant="outline" asChild>
                           <Link href="/dashboard/quizzes"><ArrowLeft className="mr-2"/> Back to Quizzes</Link>
                       </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
