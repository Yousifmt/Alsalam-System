
'use client'

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, FilePen, Eye, ArrowLeft, Trash2, ShieldCheck, FileText } from "lucide-react";
import { getEvaluationsForStudent } from "@/services/evaluation-service";
import { getFinalEvaluationsForStudent, deleteFinalEvaluation } from "@/services/final-evaluation-service";
import type { Evaluation, FinalEvaluation } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getStudent, type Student } from '@/services/user-service';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteEvaluationAction } from "@/lib/actions/evaluation";

type CombinedEvaluation = (Evaluation | FinalEvaluation) & { type: 'daily' | 'final' };

export default function StudentEvaluationsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [evaluations, setEvaluations] = useState<CombinedEvaluation[]>([]);
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [dailyEvals, finalEvals, studentData] = await Promise.all([
                    getEvaluationsForStudent(id),
                    getFinalEvaluationsForStudent(id),
                    getStudent(id)
                ]);

                const combined: CombinedEvaluation[] = [
                    ...dailyEvals.map(e => ({...e, type: 'daily' as const })),
                    ...finalEvals.map(e => ({...e, type: 'final' as const }))
                ];

                combined.sort((a,b) => b.date - a.date);

                setEvaluations(combined);
                setStudent(studentData);
            } catch (error) {
                console.error("Failed to fetch evaluations:", error);
                toast({
                    title: "Error",
                    description: "Could not fetch student evaluations.",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, toast]);

    const handleView = (evaluation: CombinedEvaluation) => {
        const path = evaluation.type === 'daily' 
            ? `/dashboard/evaluations/${evaluation.id}`
            : `/dashboard/final-evaluations/${evaluation.id}`;
        router.push(path);
    }

    const handleDelete = async (evaluation: CombinedEvaluation) => {
        if (!evaluation.id) return;
        setDeletingId(evaluation.id);
        try {
            if (evaluation.type === 'daily') {
   await deleteEvaluationAction(evaluation.id);
} else {
   await deleteFinalEvaluation(evaluation.id);
}

            toast({
                title: "Success",
                description: "Evaluation has been deleted."
            });
            setEvaluations(prev => prev.filter(ev => ev.id !== evaluation.id));
        } catch (error) {
            console.error("Failed to delete evaluation:", error);
            toast({
                title: "Error",
                description: "Could not delete the evaluation.",
                variant: "destructive"
            });
        } finally {
            setDeletingId(null);
        }
    };

    const getEvaluationTitle = (evaluation: CombinedEvaluation) => {
        if (evaluation.type === 'daily') {
            return (evaluation as Evaluation).trainingTopic;
        }
        return `Final Evaluation - ${(evaluation as FinalEvaluation).courseName}`;
    }

    if (loading) {
        return <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
                <h1 className="text-3xl font-bold font-headline">Evaluations for {student?.name}</h1>
                <p className="text-muted-foreground">View all submitted evaluations for this student.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Evaluation History</CardTitle>
                    <CardDescription>A list of all submitted evaluations, sorted by most recent.</CardDescription>
                </CardHeader>
                <CardContent>
                   {evaluations.length > 0 ? (
                       <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Type</TableHead>
                                   <TableHead>Title / Topic</TableHead>
                                   <TableHead>Date</TableHead>
                                   <TableHead>Overall Rating</TableHead>
                                   <TableHead className="text-right">Actions</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {evaluations.map(ev => (
                                   <TableRow key={ev.id}>
                                       <TableCell>
                                           <Badge variant={ev.type === 'daily' ? 'secondary' : 'default'}>
                                               {ev.type === 'daily' ? <FileText className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                                               {ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}
                                            </Badge>
                                       </TableCell>
                                       <TableCell className="font-medium">{getEvaluationTitle(ev)}</TableCell>
                                       <TableCell>{format(new Date(ev.date), 'PPP')}</TableCell>
                                       <TableCell>{ev.overallRating}</TableCell>
                                       <TableCell className="text-right">
                                           <Button variant="ghost" size="icon" onClick={() => handleView(ev)} className="mr-2">
                                                <Eye className="h-4 w-4" />
                                                <span className="sr-only">View</span>
                                           </Button>
                                           <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={deletingId === ev.id}>
                                                        {deletingId === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete this evaluation. This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(ev)} className="bg-destructive hover:bg-destructive/90">
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                       </TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   ) : (
                       <div className="text-center text-muted-foreground p-8">
                            <FilePen className="h-12 w-12 mx-auto mb-4" />
                            <p>No evaluations have been submitted for this student yet.</p>
                       </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
