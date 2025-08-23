import { QuizDisplay } from "@/components/quiz/quiz-display";
import { getQuiz } from "@/services/quiz-service";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function getUserRole() {
  try {
    const cookieStore = await cookies(); // in newer Next versions: async
    const session = cookieStore.get("session")?.value || "";
    if (!session) return null;
    const decodedClaims = await auth.verifySessionCookie(session, true);
    const userDoc = await getDoc(doc(db, "users", decodedClaims.uid));
    if (userDoc.exists()) {
      return (userDoc.data() as any).role ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  // 👇 both are Promises in your version
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;              // ✅ await params
  const sp = await searchParams;            // ✅ await searchParams
  const modeParam = Array.isArray(sp.mode) ? sp.mode[0] : sp.mode;
  const isPractice = modeParam === "practice";

  const quiz = await getQuiz(id);
  const role = await getUserRole();

  if (!quiz) {
    notFound();
  }

  if (role === "admin") {
    redirect(`/dashboard/quizzes/${id}/edit`);
  }

  return <QuizDisplay quiz={quiz} isPractice={isPractice} />;
}
