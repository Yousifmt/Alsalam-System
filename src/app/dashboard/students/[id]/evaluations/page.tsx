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

import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Forms (no SSR so they behave inside dialogs/popovers)
const EvaluationForm = dynamic(
  () => import('@/components/dashboard/evaluation-form').then(m => m.EvaluationForm),
  { ssr: false }
);
const FinalEvaluationForm = dynamic(
  () => import('@/components/dashboard/final-evaluation-form').then(m => m.FinalEvaluationForm),
  { ssr: false }
);

type CombinedEvaluation = (Evaluation | FinalEvaluation) & { type: 'daily' | 'final' };

// ---------- helpers ----------
const compositeKey = (ev: CombinedEvaluation) => `${ev.type}-${ev.id}`;

/** Dedupe by composite key; if we see the key twice, keep the *most recent* by date */
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

/** Ensure React keys are unique even if backend sends dupes again in a single render */
function createRenderKeyFactory() {
  const seen = new Map<string, number>();
  return (ev: CombinedEvaluation) => {
    const base = compositeKey(ev);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}-${n}`;
  };
}

export default function StudentEvaluationsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [evaluations, setEvaluations] = useState<CombinedEvaluation[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editEval, setEditEval] = useState<CombinedEvaluation | null>(null);

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

  const handleView = (evaluation: CombinedEvaluation) => {
    const path = evaluation.type === 'daily'
      ? `/dashboard/evaluations/${evaluation.id}`
      : `/dashboard/final-evaluations/${evaluation.id}`;
    router.push(path);
  };

  const handleEdit = (evaluation: CombinedEvaluation) => {
    setEditEval(evaluation);
    setEditOpen(true);
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
        const src = evaluation as Evaluation;
        const duplicate: Omit<Evaluation, 'id'> = {
          ...src,
          date: Date.now(),
          trainingTopic: `${src.trainingTopic} (Copy)`,
          type: 'daily',
        };
        delete (duplicate as any).id;
        await saveEvaluation(duplicate);
      } else {
        const src = evaluation as FinalEvaluation;
        const duplicate: Omit<FinalEvaluation, 'id'> = {
          ...src,
          date: Date.now(),
          courseName: `${src.courseName} (Copy)`,
          type: 'final',
        };
        delete (duplicate as any).id;
        await saveFinalEvaluation(duplicate);
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

  // Build a render-key factory *per render* to guarantee unique keys in the table
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
                    <TableCell>{format(new Date(ev.date), 'PPP')}</TableCell>
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

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditEval(null);
        }}
      >
        <DialogContent
          className="max-w-5xl max-h-[85vh] overflow-y-auto p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>تعديل التقييم</DialogTitle>
          </DialogHeader>

          <div className="p-6 pt-2">
            {editEval && student ? (
              editEval.type === 'daily' ? (
                <EvaluationForm
                  // no "key by date" — rely on reset in the form
                  student={student}
                  mode="edit"
                  initialData={editEval as Evaluation}
                  disableRedirect
                  onSaved={async (updated) => {
                    // ✅ Optimistic patch
                    setEvaluations((prev) => {
                      const next = prev.map((ev) =>
                        ev.id === updated.id && ev.type === 'daily'
                          ? ({ ...ev, ...updated } as CombinedEvaluation)
                          : ev
                      );
                      // keep list sorted by date desc
                      next.sort((a, b) => b.date - a.date);
                      return next;
                    });
                    setEditOpen(false);
                    setEditEval(null);
                    // optional: also refetch to reconcile server state
                    // await fetchAll();
                  }}
                />
              ) : (
                <FinalEvaluationForm
                  student={student}
                  mode="edit"
                  initialData={editEval as FinalEvaluation}
                  disableRedirect
                  onSaved={async (updated) => {
  setEvaluations(prev => {
    const next = prev.map(ev => (ev.id === updated.id && ev.type === 'daily' ? { ...ev, ...updated } : ev));
    next.sort((a,b)=>b.date-a.date);
    return next;
  });
  setEditOpen(false);
  setEditEval(null);
  await fetchAll(); // <— ensure we see the server’s version when we revisit the page
}}

                />
              )
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
