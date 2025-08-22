
"use client";

import { QuizBuilderForm } from "@/components/dashboard/quiz-builder-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuiz } from "@/services/quiz-service";
import type { Quiz } from "@/lib/types";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditQuizPage() {
    const params = useParams();
    const id = params.id as string;
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            getQuiz(id)
                .then(quizData => {
                    if (quizData) {
                        setQuiz(quizData);
                    } else {
                        setError("Quiz not found.");
                    }
                })
                .catch(() => setError("Failed to load the quiz."))
                .finally(() => setLoading(false));
        }
    }, [id]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }

    if (error) {
        return <div className="text-center text-destructive">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                 <Button asChild variant="outline" size="sm" className="mb-4">
                     <Link href="/dashboard/quizzes">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Quizzes
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Edit Quiz</h1>
                <p className="text-muted-foreground">Modify the details of your quiz below.</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Editing: {quiz?.title}</CardTitle>
                            <CardDescription>Make changes and click &quot;Save Changes&quot; when you are done.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {quiz && <QuizBuilderForm quiz={quiz} />}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
