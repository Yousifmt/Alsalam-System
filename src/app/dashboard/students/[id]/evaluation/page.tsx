
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudent, type Student } from '@/services/user-service';
import { EvaluationForm } from '@/components/dashboard/evaluation-form';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NewEvaluationPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            getStudent(id)
                .then(setStudent)
                .catch(err => {
                    console.error("Failed to fetch student", err);
                    router.push('/dashboard');
                })
                .finally(() => setLoading(false));
        }
    }, [id, router]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }

    if (!student) {
        return (
            <div className="text-center">
                <p>Student not found.</p>
                <Button asChild variant="link">
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
            </div>
        )
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
                <p className="text-muted-foreground">Fill out the form below to create a new daily evaluation for <span className="font-bold">{student.name}</span>.</p>
            </div>
            
            <EvaluationForm student={student} />
        </div>
    );
}
