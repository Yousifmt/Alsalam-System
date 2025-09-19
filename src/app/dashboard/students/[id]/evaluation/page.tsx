"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

import { EvaluationForm } from "@/components/dashboard/evaluation-form";
import { getStudent, type Student } from "@/services/user-service";

export default function NewEvaluationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const s = await getStudent(id);
        if (!mounted) return;
        setStudent(s);
      } catch (err) {
        console.error("Failed to fetch student", err);
        // تجنّب setState بعد التنقّل
        router.push("/dashboard");
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm" className="mb-2">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Link>
        </Button>
        <p className="text-destructive">Student not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/students/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Student Detail
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">New Daily Evaluation</h1>
        <p className="text-muted-foreground">
          Fill out the form below to create a new daily evaluation for{" "}
          <span className="font-bold">{student.name}</span>.
        </p>
      </div>

      {/* EvaluationForm سيقوم بالحفظ ثم إعادة التوجيه تلقائيًا إلى:
          /dashboard/students/[id]/evaluations */}
      <EvaluationForm student={student} />
    </div>
  );
}
