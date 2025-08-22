
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

export interface Student {
    uid: string;
    name: string;
    email: string;
}

export async function getStudents(): Promise<Student[]> {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", "student"));
    const querySnapshot = await getDocs(q);
    
    const students: Student[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
            uid: doc.id,
            name: data.name,
            email: data.email,
        });
    });

    return students;
}

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
