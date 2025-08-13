// app/quiz/[id]/page.tsx (server component)
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { QuizDisplay } from "@/components/quiz/quiz-display";
import { getQuiz } from "@/services/quiz-service";

// If your admin helper exports these:
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

async function getUserRole(): Promise<string | null> {
  try {
    // ✅ cookies() is async now
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;

    // Admin SDK
    const auth = getAdminAuth();
    const { uid } = await auth.verifySessionCookie(session, true);

    const db = getAdminDb();
    const snap = await db.collection("users").doc(uid).get();
    return snap.exists ? (snap.data()?.role as string | undefined) ?? null : null;
  } catch {
    return null;
  }
}

export default async function QuizPage({ params }: { params: { id: string } }) {
  const quiz = await getQuiz(params.id);
  const role = await getUserRole();

  if (!quiz) notFound();
  if (role === "admin") redirect(`/dashboard/quizzes/${params.id}/edit`);

  return <QuizDisplay quiz={quiz} />;
}
