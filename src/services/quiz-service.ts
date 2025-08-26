import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  collectionGroup,
  query,
  where,
  serverTimestamp,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import type { Quiz, QuizResult, QuizSession, ScoringConfig } from "@/lib/types";

const quizzesCollection = collection(db, "quizzes");

/* Only two scoring choices: 100% or 900 pts */
const DEFAULT_SCORING: ScoringConfig = { mode: "percent" };

/** Attach Firestore doc id without double 'id' */
function withDocId<T extends object>(docId: string, data: T): T & { id: string } {
  const { id: _drop, ...rest } = (data as any) ?? {};
  return { ...(rest as T), id: docId };
}

/** Normalize quiz when reading */
function toQuiz(docId: string, data: any): Quiz {
  const base = withDocId<Quiz>(docId, data as Quiz);
  return {
    ...base,
    results: Array.isArray((data as any)?.results) ? (data as any).results : [],
    shuffleQuestions: !!(data as any)?.shuffleQuestions,
    shuffleAnswers: !!(data as any)?.shuffleAnswers,
    archived: typeof (data as any)?.archived === "boolean" ? (data as any).archived : false,
    scoring: (data as any)?.scoring ?? DEFAULT_SCORING,
  };
}

// ====================== Admin ======================

export async function createQuiz(quizData: Omit<Quiz, "id">): Promise<string> {
  const payload = {
    ...quizData,
    scoring: quizData.scoring ?? DEFAULT_SCORING,
    archived: (quizData as any)?.archived ?? false,
    // ⬇️ default order so new quizzes fall to the end
    order: typeof (quizData as any)?.order === "number" ? (quizData as any).order : Date.now(),
  };
  const ref = await addDoc(quizzesCollection, payload);
  return ref.id;
}


export async function updateQuiz(id: string, quizData: Omit<Quiz, "id">): Promise<void> {
  const ref = doc(db, "quizzes", id);
  const payload = {
    ...quizData,
    scoring: quizData.scoring ?? DEFAULT_SCORING,
  };
  await setDoc(ref, payload, { merge: true });
}

export async function deleteQuiz(id: string): Promise<void> {
  const ref = doc(db, "quizzes", id);
  await deleteDoc(ref);
}

// ==================== Reads ====================

export async function getQuizzes(): Promise<Quiz[]> {
  const snap = await getDocs(quizzesCollection); // no orderBy here
  const list = snap.docs.map((d) => toQuiz(d.id, d.data()));
  // Same sort you already use in the page
  return list.sort((a: any, b: any) => {
    const ao = typeof a.order === "number" ? a.order : 1e9;
    const bo = typeof b.order === "number" ? b.order : 1e9;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}



export async function getQuizzesForSearch(): Promise<Quiz[]> {
  return getQuizzes();
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  const ref = doc(db, "quizzes", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toQuiz(snap.id, snap.data());
}

export async function getQuizForUser(quizId: string, userId: string): Promise<Quiz> {
  const master = await getQuiz(quizId);
  if (!master) throw new Error("Quiz not found");

  const userRef = doc(db, `users/${userId}/quizzes/${quizId}`);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return { ...master, status: "Not Started", results: [] };
  }
  const u = userSnap.data() as { status: Quiz["status"]; results?: QuizResult[] };
  return { ...master, status: u.status, results: u.results || [] };
}

export async function getQuizzesForUser(userId: string): Promise<Quiz[]> {
  const master = await getQuizzes();
  if (!master.length) return [];

  const userRef = collection(db, `users/${userId}/quizzes`);
  const userSnap = await getDocs(userRef);

  const state = new Map<string, { status: Quiz["status"]; results: QuizResult[] }>();
  userSnap.docs.forEach((d) => {
    const data = d.data() as { status: Quiz["status"]; results?: QuizResult[] };
    state.set(d.id, { status: data.status, results: data.results || [] });
  });

  return master.map((m) => {
    const u = state.get(m.id);
    const hasResults = !!u?.results?.length;
    return { ...m, status: hasResults ? "Completed" : u?.status || "Not Started", results: u?.results || [] };
  });
}
export async function saveQuizOrder(pairs: Array<{ id: string; order: number }>) {
  const batch = writeBatch(db);
  for (const { id, order } of pairs) {
    batch.update(doc(db, "quizzes", id), { order });
  }
  await batch.commit();
}

// =================== Results ===================

export async function submitQuizResult(quizId: string, userId: string, result: QuizResult) {
  if (result.isPractice) {
    const ref = collection(db, `users/${userId}/practiceAttempts`);
    await addDoc(ref, { quizId, ...result });
    return;
  }
  const userRef = doc(db, `users/${userId}/quizzes/${quizId}`);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { status: "Completed", results: [result] });
  } else {
    await updateDoc(userRef, { status: "Completed", results: arrayUnion(result) });
  }
}

export async function getAllResultsForQuiz(quizId: string): Promise<QuizResult[]> {
  const cg = query(collectionGroup(db, "quizzes"));
  const snap = await getDocs(cg);
  const out: QuizResult[] = [];
  snap.forEach((d) => {
    if (d.id !== quizId) return;
    const data = d.data() as { results?: QuizResult[] };
    if (Array.isArray(data.results)) out.push(...data.results.filter((r) => !r.isPractice));
  });
  return out;
}

export async function getLatestPracticeAttempt(quizId: string, userId: string): Promise<QuizResult | null> {
  const ref = collection(db, `users/${userId}/practiceAttempts`);
  const qy = query(ref, where("quizId", "==", quizId));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const attempts = snap.docs.map((d) => d.data() as QuizResult);
  attempts.sort((a, b) => b.date - a.date);
  return attempts[0];
}

// =================== Sessions ===================

function fyShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Resume an in-progress attempt; if the existing session is submitted, start a NEW attempt.
 * Session doc is at: quizzes/{quizId}/sessions/{uid}
 * We overwrite the same doc to start a new attempt.
 */
export async function startOrResumeActiveSession(
  quizId: string,
  uid: string,
  questionIds: string[],
  shuffleQuestions: boolean
): Promise<QuizSession> {
  const ref = doc(db, "quizzes", quizId, "sessions", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as QuizSession;

    // If previous attempt was submitted -> start a NEW attempt (overwrite doc)
    if (data.submittedAt) {
      const order = shuffleQuestions ? fyShuffle(questionIds) : [...questionIds];
      const fresh: QuizSession = {
        startedAt: Date.now(),
        order,
        answersByQuestionId: {},
        lastSavedAt: Date.now(),
        currentIndex: 0,
      };
      await setDoc(ref, { ...fresh, _createdAt: serverTimestamp() });
      return fresh;
    }

    // Still in progress: ensure stable order
    let order =
      data.order && data.order.length === questionIds.length
        ? data.order
        : shuffleQuestions
        ? fyShuffle(questionIds)
        : [...questionIds];
    if (!data.order || data.order.length !== questionIds.length) {
      await updateDoc(ref, { order });
    }

    return {
      startedAt: data.startedAt,
      order,
      answersByQuestionId: data.answersByQuestionId ?? {},
      lastSavedAt: data.lastSavedAt ?? Date.now(),
      currentIndex: data.currentIndex ?? 0,
      submittedAt: undefined,
    };
  }

  // No session -> create new
  const order = shuffleQuestions ? fyShuffle(questionIds) : [...questionIds];
  const fresh: QuizSession = {
    startedAt: Date.now(),
    order,
    answersByQuestionId: {},
    lastSavedAt: Date.now(),
    currentIndex: 0,
  };
  await setDoc(ref, { ...fresh, _createdAt: serverTimestamp() });
  return fresh;
}

export async function saveQuizProgress(
  quizId: string,
  uid: string,
  answersByQuestionId: Record<string, string | string[]>,
  currentIndex: number
): Promise<void> {
  const ref = doc(db, "quizzes", quizId, "sessions", uid);
  await updateDoc(ref, { answersByQuestionId, currentIndex, lastSavedAt: Date.now() });
}

export async function finalizeQuizAttempt(quizId: string, uid: string): Promise<void> {
  const ref = doc(db, "quizzes", quizId, "sessions", uid);
  await updateDoc(ref, { submittedAt: Date.now(), lastSavedAt: Date.now() });
}
