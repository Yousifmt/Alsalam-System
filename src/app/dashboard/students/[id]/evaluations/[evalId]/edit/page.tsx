"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

import { EvaluationForm } from "@/components/dashboard/evaluation-form";
import { getEvaluation } from "@/services/evaluation-service";
import { getStudent } from "@/services/user-service";
import type { Evaluation, Student } from "@/lib/types";

export default function EditDailyEvaluationPage() {
  const { id, evalId } = useParams() as { id: string; evalId: string };
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [s, e] = await Promise.all([getStudent(id), getEvaluation(evalId)]);
        if (!mounted) return;
        setStudent(s);
        setEvaluation(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id, evalId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!student || !evaluation) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/students/${id}/evaluations`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Evaluations
          </Link>
        </Button>
        <p className="text-destructive">Evaluation or student not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/students/${id}/evaluations`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Evaluations
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Edit Daily Evaluation</h1>
        <p className="text-muted-foreground">Editing {student.name}’s daily evaluation.</p>
      </div>

      <EvaluationForm
        student={student}
        mode="edit"
        initialData={evaluation}
        disableRedirect
        onSaved={() => router.push(`/dashboard/students/${id}/evaluations`)}
      />
    </div>
  );
}
