// src/services/evaluation-service.ts
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
import type { Evaluation } from "@/lib/types";

/**
 * Save a new daily evaluation for a student and return its ID.
 * Caller does NOT need to pass `type`; it is enforced as 'daily' here.
 */
export async function saveEvaluation(
  evaluationData: Omit<Evaluation, "id" | "type">
): Promise<string> {
  const evaluationsCollection = collection(db, "evaluations");

  // Ensure we write Firestore-compatible fields
  const firestoreDoc = {
    ...evaluationData,
    type: "daily" as const,
    date: Timestamp.fromMillis(evaluationData.date),
  };

  const docRef = await addDoc(evaluationsCollection, firestoreDoc);
  return docRef.id;
}

/** Get a single evaluation by its ID */
export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const docRef = doc(db, "evaluations", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    console.warn(`Evaluation with ID ${id} not found.`);
    return null;
  }
  const data = snap.data();

  return {
    id: snap.id,
    ...data,
    // Convert Firestore Timestamp -> number (ms)
    date: (data.date as Timestamp).toMillis(),
  } as Evaluation;
}

/** Get all evaluations for a specific student (sorted newest first) */
export async function getEvaluationsForStudent(
  studentId: string
): Promise<Evaluation[]> {
  const evaluationsCollection = collection(db, "evaluations");
  const q = query(evaluationsCollection, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);

  const evaluations: Evaluation[] = [];
  querySnapshot.forEach((d) => {
    const data = d.data();
    evaluations.push({
      id: d.id,
      ...data,
      date: (data.date as Timestamp).toMillis(),
    } as Evaluation);
  });

  // Sort client-side to avoid composite index requirement
  return evaluations.sort((a, b) => b.date - a.date);
}

/** Delete an evaluation by its ID */
export async function deleteEvaluation(id: string): Promise<void> {
  const ref = doc(db, "evaluations", id);
  await deleteDoc(ref);
}
