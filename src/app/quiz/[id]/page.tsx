

import { QuizDisplay } from "@/components/quiz/quiz-display";
import { getQuiz } from "@/services/quiz-service";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function getUserRole() {
    try {
        const session = cookies().get('session')?.value || '';
        if (!session) return null;
        const decodedClaims = await auth.verifySessionCookie(session, true);
        const userDoc = await getDoc(doc(db, "users", decodedClaims.uid));
        if (userDoc.exists()) {
            return userDoc.data().role;
        }
    } catch (error) {
       return null;
    }
    return null;
}

export default async function QuizPage({ params }: { params: { id: string } }) {
  const quiz = await getQuiz(params.id);
  const role = await getUserRole();

  if (!quiz) {
    notFound();
  }
  
  if(role === 'admin') {
      redirect(`/dashboard/quizzes/${params.id}/edit`);
  }

  return <QuizDisplay quiz={quiz} />;
}
