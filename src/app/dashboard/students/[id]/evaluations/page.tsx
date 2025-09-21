'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Loader2, FilePen, Eye, ArrowLeft, Trash2, ShieldCheck, FileText, Copy, Pencil,
} from 'lucide-react';

import { getEvaluationsForStudent, saveEvaluation } from '@/services/evaluation-service';
import { getFinalEvaluationsForStudent, deleteFinalEvaluation, saveFinalEvaluation } from '@/services/final-evaluation-service';

import type { Evaluation, FinalEvaluation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getStudent, type Student } from '@/services/user-service';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { deleteEvaluationAction } from '@/lib/actions/evaluation';

/* ---------------- types/helpers ---------------- */
type CombinedEvaluation = (Evaluation | FinalEvaluation) & { type: 'daily' | 'final' };

const compositeKey = (ev: CombinedEvaluation) => `${ev.type}-${ev.id}`;

/** دمج + ترتيب + إزالة أي ازدواج */
function mergeSortDedupe(dailies: Evaluation[], finals: FinalEvaluation[]): CombinedEvaluation[] {
  const map = new Map<string, CombinedEvaluation>();

  for (const d of dailies) {
    const item: CombinedEvaluation = { ...d, type: 'daily' };
    const k = compositeKey(item);
    const prev = map.get(k);
    if (!prev || item.date > prev.date) map.set(k, item);
  }

  for (const f of finals) {
    const item: CombinedEvaluation = { ...f, type: 'final' };
    const k = compositeKey(item);
    const prev = map.get(k);
    if (!prev || item.date > prev.date) map.set(k, item);
  }

  const arr = [...map.values()];
  arr.sort((a, b) => b.date - a.date);
  return arr;
}

/** مفاتيح React مضمونة التفرد داخل نفس الرندر */
function createRenderKeyFactory() {
  const seen = new Map<string, number>();
  return (ev: CombinedEvaluation) => {
    const base = compositeKey(ev);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}-${n}`;
  };
}

/* ---------------- component ---------------- */
export default function StudentEvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [evaluations, setEvaluations] = useState<CombinedEvaluation[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dailyEvals, finalEvals, studentData] = await Promise.all([
        getEvaluationsForStudent(id),
        getFinalEvaluationsForStudent(id),
        getStudent(id),
      ]);
      const unique = mergeSortDedupe(dailyEvals, finalEvals);
      setEvaluations(unique);
      setStudent(studentData);
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
      toast({ title: 'Error', description: 'Could not fetch student evaluations.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ✅ ارجع أحدث بيانات بمجرد العودة لهذه الصفحة (بعد الحفظ من صفحات التعديل)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchAll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAll]);

  const handleView = (evaluation: CombinedEvaluation) => {
    const path =
      evaluation.type === 'daily'
        ? `/dashboard/evaluations/${evaluation.id}`
        : `/dashboard/final-evaluations/${evaluation.id}`;
    router.push(path);
  };

  // 🚀 التعديل ينتقل لصفحات الـ edit التي عندك
  const handleEdit = (evaluation: CombinedEvaluation) => {
    const path =
      evaluation.type === 'daily'
        ? `/dashboard/students/${id}/evaluations/${evaluation.id}/edit`
        : `/dashboard/students/${id}/evaluation/${evaluation.id}/edit`; // مطابق لمجلدك: ...\evaluation\[finalId]\edit
    router.push(path);
  };

  const handleDelete = async (evaluation: CombinedEvaluation) => {
    if (!evaluation.id) return;
    setDeletingId(evaluation.id);
    try {
      if (evaluation.type === 'daily') {
        await deleteEvaluationAction(evaluation.id);
      } else {
        await deleteFinalEvaluation(evaluation.id);
      }
      toast({ title: 'Success', description: 'Evaluation has been deleted.' });
      setEvaluations(prev => prev.filter(ev => ev.id !== evaluation.id));
    } catch (error) {
      console.error('Failed to delete evaluation:', error);
      toast({ title: 'Error', description: 'Could not delete the evaluation.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (evaluation: CombinedEvaluation) => {
  if (!evaluation.id) return;
  setDuplicatingId(evaluation.id);
  try {
    if (evaluation.type === 'daily') {
      // remove id at runtime so a NEW doc is created
      const { id: _omit, ...rest } = evaluation as Evaluation;
      const duplicate: Omit<Evaluation, 'id'> = {
        ...rest,
        date: Date.now(),
        trainingTopic: `${rest.trainingTopic} (Copy)`,
        // keep anything else from the original daily evaluation
      };
      await saveEvaluation(duplicate as any);
    } else {
      const { id: _omit, ...rest } = evaluation as FinalEvaluation;
      const duplicate: Omit<FinalEvaluation, 'id'> = {
        ...rest,
        date: Date.now(),
        courseName: `${rest.courseName} (Copy)`,
      };
      await saveFinalEvaluation(duplicate as any);
    }
    toast({ title: 'Duplicated', description: 'Evaluation duplicated successfully.' });
    await fetchAll();
  } catch (error) {
    console.error('Failed to duplicate evaluation:', error);
    toast({ title: 'Error', description: 'Could not duplicate the evaluation.', variant: 'destructive' });
  } finally {
    setDuplicatingId(null);
  }
};


  const getEvaluationTitle = (evaluation: CombinedEvaluation) => {
    if (evaluation.type === 'daily') return (evaluation as Evaluation).trainingTopic;
    return `Final Evaluation - ${(evaluation as FinalEvaluation).courseName}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderKeyFor = createRenderKeyFactory();

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
                {evaluations.map((ev) => (
                  <TableRow key={renderKeyFor(ev)}>
                    <TableCell>
                      <Badge variant={ev.type === 'daily' ? 'secondary' : 'default'}>
                        {ev.type === 'daily'
                          ? <FileText className="h-3 w-3 mr-1" />
                          : <ShieldCheck className="h-3 w-3 mr-1" />}
                        {ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium">{getEvaluationTitle(ev)}</TableCell>

                    {/* ✅ نضمن أن التاريخ رقم قبل new Date */}
                    <TableCell>{format(new Date(Number(ev.date)), 'PPP')}</TableCell>

                    <TableCell>{ev.overallRating}</TableCell>

                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleView(ev)} className="mr-2" title="View">
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button variant="ghost" size="icon" onClick={() => handleEdit(ev)} className="mr-2" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(ev)}
                        className="mr-2"
                        disabled={duplicatingId === ev.id}
                        title="Duplicate"
                      >
                        {duplicatingId === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deletingId === ev.id} title="Delete">
                            {deletingId === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
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
