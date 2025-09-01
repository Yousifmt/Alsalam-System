import { auth, db } from "@/lib/firebase-admin";

/**
 * Deletes a user from Firebase Authentication and their corresponding document
 * in the 'users' collection in Firestore.
 * IMPORTANT: This is a server-only function.
 * @param uid The UID of the user to delete.
 */
export async function deleteStudent(uid: string): Promise<void> {
  try {
    // Delete from Firebase Authentication
    await auth.deleteUser(uid);

    // Delete from Firestore 'users' collection
    await db.collection("users").doc(uid).delete();

    // Note: This doesn't clean up subcollections like user's quiz results.
    // For production, use a Cloud Function trigger on user delete
  } catch (error) {
    console.error(`Error deleting student with UID: ${uid}`, error);
    throw error;
  }
}
