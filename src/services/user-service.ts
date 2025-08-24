
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import {  deleteDoc } from "firebase/firestore";


export type Student = {
  uid: string;
  name: string;
  email: string;
  classId?: string | null;
  className?: string | null;
};

export async function getStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, "users")); // adjust collection if needed
  return snap.docs.map(d => {
    const data = d.data() as any;
    // If your doc id is uid, prefer d.id; otherwise prefer data.uid
    const uid = data.uid ?? d.id;
    return {
      uid,
      name: data.name ?? "",
      email: data.email ?? "",
      classId: data.classId ?? null,
      className: data.className ?? null,
    };
  });
}
export async function deleteStudent(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid)); // adjust collection if different
}
// Al-Salam system/src/services/user-service.ts

export async function getStudent(uid: string): Promise<Student | null> {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists() && docSnap.data().role === 'student') {
        const data = docSnap.data();
        return {
            uid: docSnap.id,
            name: data.name,
            email: data.email,
        };
    }
    return null;
}
