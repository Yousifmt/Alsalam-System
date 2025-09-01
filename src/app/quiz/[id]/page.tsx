// FILE: src/app/quiz/[id]/page.tsx
// Purpose: Make the quiz runner page *simple and stable* so it never bounces back.
// - No role checks or client Firestore calls on the server.
// - Just load the quiz and render the runner. Practice/normal decided by ?mode.
// - Mark as dynamic and no-store to avoid any caching weirdness.

import { notFound } from "next/navigation";
import { QuizDisplay } from "@/components/quiz/quiz-display";
import { getQuiz } from "@/services/quiz-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const modeParam = Array.isArray(sp.mode) ? sp.mode[0] : sp.mode;
  const isPractice = modeParam === "practice";

  const quiz = await getQuiz(id);
  if (!quiz) notFound();

  return <QuizDisplay quiz={quiz} isPractice={isPractice} />;
}
