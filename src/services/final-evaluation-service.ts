// src/services/final-evaluation-service.ts
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  // ✅ استخدم نسخ السيرفر لتفادي الكاش بعد الحفظ/التحديث
  getDocFromServer,
  getDocsFromServer,
} from "firebase/firestore";
import type { FinalEvaluation } from "@/lib/types";

const COLLECTION = "final_evaluations";

type SaveFinalEvaluationInput =
  Partial<Pick<FinalEvaluation, "id">> & Omit<FinalEvaluation, "id">;

/* ------------ Helpers: serialize/deserialize ------------ */

// -> يحول من FinalEvaluation (millis) إلى Firestore payload
function toFirestorePayload(rest: Omit<SaveFinalEvaluationInput, "id">) {
  return {
    ...rest,
    type: "final" as const,
    date: Timestamp.fromMillis(Number(rest.date)),
    trainingPeriodStart: Timestamp.fromMillis(Number(rest.trainingPeriodStart)),
    trainingPeriodEnd: Timestamp.fromMillis(Number(rest.trainingPeriodEnd)),
    updatedAt: serverTimestamp(),
  };
}

// <- يحول من Firestore إلى FinalEvaluation (millis)
function fromDoc(id: string, data: Record<string, unknown>): FinalEvaluation {
  const date = (data.date as Timestamp).toMillis();
  const trainingPeriodStart = (data.trainingPeriodStart as Timestamp).toMillis();
  const trainingPeriodEnd = (data.trainingPeriodEnd as Timestamp).toMillis();

  return {
    id,
    ...(data as Omit<
      FinalEvaluation,
      "id" | "date" | "trainingPeriodStart" | "trainingPeriodEnd"
    >),
    date,
    trainingPeriodStart,
    trainingPeriodEnd,
  } as FinalEvaluation;
}

/* -------------------- Upsert -------------------- */
/**
 * - مع id: UPDATE (merge = true)
 * - بدون id: CREATE
 * يرجّع المستند مُطَبَّع (millis) مع قراءة مباشرة من السيرفر لتفادي الكاش
 */
export async function saveFinalEvaluation(
  input: SaveFinalEvaluationInput
): Promise<FinalEvaluation> {
  const { id, ...rest } = input;

  if (!rest.date || !rest.trainingPeriodStart || !rest.trainingPeriodEnd) {
    throw new Error("Missing required date fields for final evaluation.");
  }

  const payload = toFirestorePayload(rest);

  if (id) {
    const ref = doc(db, COLLECTION, id);
    await setDoc(ref, payload, { merge: true });
    const snap = await getDocFromServer(ref);
    const data = snap.data();
    if (!data) throw new Error("Document updated but no data returned.");
    return fromDoc(ref.id, data as Record<string, unknown>);
  }

  // CREATE
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  const snap = await getDocFromServer(ref);
  const data = snap.data();
  if (!data) throw new Error("Document created but no data returned.");
  return fromDoc(ref.id, data as Record<string, unknown>);
}

/* -------------------- Get one -------------------- */
export async function getFinalEvaluation(
  id: string
): Promise<FinalEvaluation | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDocFromServer(ref); // ✅ سيرفر مباشرة
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data() as Record<string, unknown>);
}

/* -------------------- List for student -------------------- */
export async function getFinalEvaluationsForStudent(
  studentId: string
): Promise<FinalEvaluation[]> {
  const col = collection(db, COLLECTION);
  const q = query(col, where("studentId", "==", studentId));
  const snap = await getDocsFromServer(q); // ✅ سيرفر مباشرة

  const list = snap.docs.map((d) =>
    fromDoc(d.id, d.data() as Record<string, unknown>)
  );

  // ترتيب محلي بالأحدث أولاً لتجنّب فهرس مركّب
  return list.sort((a, b) => b.date - a.date);
}

/* -------------------- Delete -------------------- */
export async function deleteFinalEvaluation(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}
