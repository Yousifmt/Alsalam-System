// src/services/evaluation-service.ts
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  Timestamp,
  query,
  where,
  serverTimestamp,
  // ⬇️ نستخدم نسخ السيرفر لتفادي الكاش
  getDocFromServer,
  getDocsFromServer,
} from "firebase/firestore";
import type { Evaluation } from "@/lib/types";

/* ---------------- Types ---------------- */
type SaveEvaluationInput =
  Partial<Pick<Evaluation, "id">> & Omit<Evaluation, "id">;

const COLLECTION = "evaluations";

/* ---------------- Helpers ---------------- */

// -> يحوّل من Evaluation (millis) إلى payload لـ Firestore
function toFirestorePayload(rest: Omit<SaveEvaluationInput, "id">) {
  return {
    ...rest,
    type: "daily" as const,
    date: Timestamp.fromMillis(Number(rest.date)),
    updatedAt: serverTimestamp(),
  };
}

// <- يحوّل من Firestore إلى Evaluation (millis)
function fromDoc(id: string, data: Record<string, unknown>): Evaluation {
  const date = (data.date as Timestamp).toMillis();
  return {
    id,
    ...(data as Omit<Evaluation, "id" | "date">),
    date,
  } as Evaluation;
}

/* ---------------- Upsert ---------------- */
/**
 * - مع id: UPDATE (merge=true) يحدّث الحقول الممرّرة فقط.
 * - بدون id: CREATE.
 * يرجّع المستند بعد التطبيع (millis).
 */
export async function saveEvaluation(input: SaveEvaluationInput): Promise<Evaluation> {
  const { id, ...rest } = input;

  if (rest.date == null) {
    throw new Error("Missing required field: date");
  }

  const payload = toFirestorePayload(rest);

  if (id) {
    const ref = doc(db, COLLECTION, id);
    await setDoc(ref, payload, { merge: true });
    // قراءة مباشرة من السيرفر لضمان أحدث بيانات
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
  // قراءة مباشرة من السيرفر لضمان أحدث بيانات
  const snap = await getDocFromServer(ref);
  const data = snap.data();
  if (!data) throw new Error("Document created but no data returned.");
  return fromDoc(ref.id, data as Record<string, unknown>);
}

/* ---------------- Get one ---------------- */
export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDocFromServer(ref); // نتجنب الكاش
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data() as Record<string, unknown>);
}

/* -------------- List for student -------------- */
export async function getEvaluationsForStudent(studentId: string): Promise<Evaluation[]> {
  const col = collection(db, COLLECTION);
  const qy = query(col, where("studentId", "==", studentId));
  const qs = await getDocsFromServer(qy); // نتجنب الكاش

  const list = qs.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));
  // فرز محلي: الأحدث أولاً (بدون الحاجة لفهرس مركّب)
  return list.sort((a, b) => b.date - a.date);
}

/* ---------------- Delete ---------------- */
export async function deleteEvaluation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
