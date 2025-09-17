// src/services/evaluation-service.ts
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import type { Evaluation } from "@/lib/types";

type SaveEvaluationInput = Partial<Pick<Evaluation, "id">> & Omit<Evaluation, "id">;

const COLLECTION = "evaluations";

/**
 * Upsert daily evaluation:
 *  - UPDATE with `updateDoc` when id is present (hard overwrite of provided fields)
 *  - CREATE with `addDoc` when id is missing
 * Returns the normalized saved document.
 */
export async function saveEvaluation(input: SaveEvaluationInput): Promise<Evaluation> {
  const { id, ...rest } = input;

  // Prepare Firestore payload
  const forFirestore = {
    ...rest,
    type: "daily" as const,
    date: Timestamp.fromMillis(rest.date),
    updatedAt: serverTimestamp(),
  };

  if (id) {
    // Hard update only the fields we pass (no stale merge)
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, forFirestore as any);
    const snap = await getDoc(ref);
    const data = snap.data()!;
    return {
      id: ref.id,
      ...(data as Omit<Evaluation, "id">),
      date: (data.date as Timestamp).toMillis(),
    };
  }

  // Create new
  const ref = await addDoc(collection(db, COLLECTION), {
    ...forFirestore,
    createdAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  const data = snap.data()!;
  return {
    id: ref.id,
    ...(data as Omit<Evaluation, "id">),
    date: (data.date as Timestamp).toMillis(),
  };
}

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    ...(data as Omit<Evaluation, "id">),
    date: (data.date as Timestamp).toMillis(),
  };
}

export async function getEvaluationsForStudent(studentId: string): Promise<Evaluation[]> {
  const col = collection(db, COLLECTION);
  const q = query(col, where("studentId", "==", studentId));
  const qs = await getDocs(q);

  const list: Evaluation[] = qs.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...(data as Omit<Evaluation, "id">),
      date: (data.date as Timestamp).toMillis(),
    };
  });

  return list.sort((a, b) => b.date - a.date);
}

export async function deleteEvaluation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
