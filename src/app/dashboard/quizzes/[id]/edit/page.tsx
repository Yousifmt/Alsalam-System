"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";

import { QuizBuilderForm } from "@/components/dashboard/quiz-builder-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getQuiz } from "@/services/quiz-service";
import type { Quiz, CourseTag } from "@/lib/types";

export default function EditQuizPage() {
  const params = useParams();
  const id = params.id as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!id) return;

      setLoading(true);
      try {
        const data = await getQuiz(id);
        if (!alive) return;

        if (!data) {
          setError("Quiz not found.");
          return;
        }

        // ✅ Ensure `course` is always present so the builder hydrates correctly
        const withCourse: Quiz = {
          ...data,
          course: ((data as any).course ?? "unassigned") as CourseTag,
        };

        setQuiz(withCourse);
      } catch {
        if (alive) setError("Failed to load the quiz.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
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
              <CardDescription>
                Make changes and click &quot;Save Changes&quot; when you are done.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* key={quiz.id} forces a clean mount so internal state picks up the loaded course */}
              {quiz && <QuizBuilderForm key={quiz.id} quiz={quiz} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
