// src/services/final-evaluation-service.ts
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import type { FinalEvaluation } from "@/lib/types";

/** Save a new final evaluation and return its ID. */
export async function saveFinalEvaluation(
  evaluationData: Omit<FinalEvaluation, "id" | "type">
): Promise<string> {
  const col = collection(db, "final_evaluations");

  const firestoreDoc = {
    ...evaluationData,
    type: "final" as const,
    date: Timestamp.fromMillis(evaluationData.date),
    trainingPeriodStart: Timestamp.fromMillis(evaluationData.trainingPeriodStart),
    trainingPeriodEnd: Timestamp.fromMillis(evaluationData.trainingPeriodEnd),
  };

  const ref = await addDoc(col, firestoreDoc);
  return ref.id;
}

/** Get a single final evaluation by ID. */
export async function getFinalEvaluation(id: string): Promise<FinalEvaluation | null> {
  const ref = doc(db, "final_evaluations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    date: (data.date as Timestamp).toMillis(),
    trainingPeriodStart: (data.trainingPeriodStart as Timestamp).toMillis(),
    trainingPeriodEnd: (data.trainingPeriodEnd as Timestamp).toMillis(),
  } as FinalEvaluation;
}

/** Get all final evaluations for a student (sorted newest first). */
export async function getFinalEvaluationsForStudent(studentId: string): Promise<FinalEvaluation[]> {
  const col = collection(db, "final_evaluations");
  const q = query(col, where("studentId", "==", studentId));
  const snap = await getDocs(q);

  const list: FinalEvaluation[] = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      id: d.id,
      ...data,
      date: (data.date as Timestamp).toMillis(),
      trainingPeriodStart: (data.trainingPeriodStart as Timestamp).toMillis(),
      trainingPeriodEnd: (data.trainingPeriodEnd as Timestamp).toMillis(),
    } as FinalEvaluation);
  });

  // Sort locally to avoid composite index requirement
  return list.sort((a, b) => b.date - a.date);
}

/** Delete a final evaluation by ID. */
export async function deleteFinalEvaluation(id: string): Promise<void> {
  const ref = doc(db, "final_evaluations", id);
  await deleteDoc(ref);
}
