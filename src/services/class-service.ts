// Al-Salam system/src/services/class-service.ts
"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ClassItem = {
  id: string;
  name: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
};

type AssignOpts = {
  /** Override the users collection path if different from "users" */
  usersCollection?: string;
};

const CLASSES = "classes";
const DEFAULT_USERS = "users";

/** Utility: resolve a user doc ref either by doc-id === uid OR by querying where("uid","==", uid) */
async function resolveUserDocRef(
  uid: string,
  usersCollection: string = DEFAULT_USERS
): Promise<DocumentReference> {
  // 1) Try direct doc id === uid
  const directRef = doc(db, usersCollection, uid);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) return directRef;

  // 2) Fallback: find by field "uid"
  const q = query(
    collection(db, usersCollection),
    where("uid", "==", uid),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].ref;

  throw new Error(
    `[class-service] User doc not found by id or uid field for uid="${uid}" in collection "${usersCollection}".`
  );
}

/* ===================== CLASSES ===================== */

export async function getClasses(): Promise<ClassItem[]> {
  const q = query(collection(db, CLASSES), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function createClass(name: string, uid?: string): Promise<string> {
  const ref = await addDoc(collection(db, CLASSES), {
    name,
    createdBy: uid || null,
    updatedBy: uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameClass(id: string, newName: string, uid?: string): Promise<void> {
  await updateDoc(doc(db, CLASSES, id), {
    name: newName,
    updatedBy: uid || null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClass(id: string): Promise<void> {
  // Note: Students remain assigned (their classId/className) unless you unassign them elsewhere.
  await deleteDoc(doc(db, CLASSES, id));
}

/* =============== ASSIGNMENT (robust) =============== */

/** Assign a single student to a class (or unassign with null).
 *  - Resolves the user document robustly (doc-id match or uid field).
 *  - Supports custom users collection via opts.usersCollection.
 */
export async function assignStudentToClass(
  studentUid: string,
  classId: string | null,
  className: string | null,
  opts?: AssignOpts
) {
  const usersCol = opts?.usersCollection ?? DEFAULT_USERS;
  const userRef = await resolveUserDocRef(studentUid, usersCol);
  await updateDoc(userRef, {
    classId: classId ?? null,
    className: className ?? null,
  });
}

/** Bulk assign many students to one class (or unassign with null).
 *  - Resolves each user doc robustly before batching updates.
 *  - For very large lists, consider chunking or a backend job/Cloud Function.
 */
export async function bulkAssignStudentsToClass(
  studentUids: string[],
  classId: string | null,
  className: string | null,
  opts?: AssignOpts
) {
  const usersCol = opts?.usersCollection ?? DEFAULT_USERS;
  const batch = writeBatch(db);

  // Resolve refs sequentially to keep it simple & reliable.
  // (You can parallelize with Promise.allSettled if you expect many.)
  for (const uid of studentUids) {
    const ref = await resolveUserDocRef(uid, usersCol);
    batch.update(ref, {
      classId: classId ?? null,
      className: className ?? null,
    });
  }
  await batch.commit();
}
