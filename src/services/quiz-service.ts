
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
  where
} from "firebase/firestore";
import type { Quiz, QuizResult } from "@/lib/types";

const quizzesCollection = collection(db, "quizzes");

// For Admins: create a new quiz in the main pool
export async function createQuiz(quizData: Omit<Quiz, 'id'>): Promise<string> {
    const docRef = await addDoc(quizzesCollection, quizData);
    return docRef.id;
}

// For Admins: update an existing quiz
export async function updateQuiz(id: string, quizData: Omit<Quiz, 'id'>): Promise<void> {
    const docRef = doc(db, "quizzes", id);
    await setDoc(docRef, quizData); // setDoc overwrites the document with new data
}

// For Admins: delete a quiz
export async function deleteQuiz(id: string): Promise<void> {
    const docRef = doc(db, "quizzes", id);
    await deleteDoc(docRef);
    // Note: This does not delete subcollections (user results). 
    // For a production app, a Firebase Function would be needed to clean up results.
}


// For Admins: get all master quizzes
export async function getQuizzes(): Promise<Quiz[]> {
    const snapshot = await getDocs(quizzesCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
}

// For Search: get all master quizzes without user-specific data
export async function getQuizzesForSearch(): Promise<Quiz[]> {
    return getQuizzes();
}


// For anyone: get a single master quiz
export async function getQuiz(id: string): Promise<Quiz | null> {
    const docRef = doc(db, "quizzes", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Quiz : null;
}

/**
 * Retrieves the user-specific version of a quiz.
 * It merges the master quiz data with the user's specific data (status, results).
 */
export async function getQuizForUser(quizId: string, userId: string): Promise<Quiz> {
    const masterQuiz = await getQuiz(quizId);
    if (!masterQuiz) {
        throw new Error("Quiz not found");
    }

    const userQuizDocRef = doc(db, `users/${userId}/quizzes/${quizId}`);
    const userQuizSnap = await getDoc(userQuizDocRef);

    if (!userQuizSnap.exists()) {
        // The document will be created on first result submission,
        // so if it doesn't exist, the user hasn't started it yet.
        return { 
            ...masterQuiz, 
            id: quizId, 
            status: 'Not Started',
            results: [],
        };
    } else {
        const userQuizData = userQuizSnap.data();
        return { 
            ...masterQuiz,
            id: quizId, 
            status: userQuizData.status,
            results: userQuizData.results || [],
        };
    }
}


/**
 * Retrieves all quizzes for a specific user, merging their progress (status, results)
 * with the master list of quizzes.
 */
export async function getQuizzesForUser(userId: string): Promise<Quiz[]> {
    const masterQuizzes = await getQuizzes();
    if (masterQuizzes.length === 0) return [];
    
    const userQuizzesSubcollectionRef = collection(db, `users/${userId}/quizzes`);
    const userQuizStatesSnapshot = await getDocs(userQuizzesSubcollectionRef);
    
    const userQuizMap = new Map<string, { status: 'Completed' | 'Not Started' | 'In Progress', results: QuizResult[] }>();
    userQuizStatesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        userQuizMap.set(doc.id, { status: data.status, results: data.results || [] });
    });

    return masterQuizzes.map(masterQuiz => {
        const userVersion = userQuizMap.get(masterQuiz.id);
        const hasResults = userVersion?.results && userVersion.results.length > 0;
        
        return {
            ...masterQuiz,
            status: hasResults ? 'Completed' : (userVersion?.status || 'Not Started'),
            results: userVersion?.results || []
        };
    });
}


/**
 * Submits a student's quiz result. It ensures a user-specific quiz record exists
 * before adding the new result to it.
 */
export async function submitQuizResult(quizId: string, userId: string, result: QuizResult) {
    const userQuizDocRef = doc(db, `users/${userId}/quizzes/${quizId}`);
    const docSnap = await getDoc(userQuizDocRef);

    if (!docSnap.exists()) {
        await setDoc(userQuizDocRef, {
            status: 'Completed',
            results: [result]
        });
    } else {
        await updateDoc(userQuizDocRef, {
            status: 'Completed',
            results: arrayUnion(result)
        });
    }
}

/**
 * Retrieves all results for a specific quiz across all users.
 * This is used for calculating aggregate analytics.
 */
export async function getAllResultsForQuiz(quizId: string): Promise<QuizResult[]> {
    const userQuizzesQuery = query(collectionGroup(db, 'quizzes'));

    const snapshot = await getDocs(userQuizzesQuery);
    const allResults: QuizResult[] = [];

    snapshot.forEach(doc => {
        // We only care about documents from the subcollection that match the quizId
        if (doc.ref.parent.parent && doc.ref.parent.parent.path.startsWith('users/') && doc.id === quizId) {
            const data = doc.data();
            if (data.results && Array.isArray(data.results)) {
                allResults.push(...data.results);
            }
        }
    });
    
    return allResults;
}
