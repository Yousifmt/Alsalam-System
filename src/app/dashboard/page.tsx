// FILE: app/(dashboard)/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Award, BarChart2, Sparkles, PlusCircle, FileText } from "lucide-react";

import { StudentStats } from "@/components/dashboard/student-stats";
import { StudentList } from "@/components/dashboard/student-list";
import { getQuizzesForUser } from "@/services/quiz-service";

type LatestAttempt = {
  date: number;
  score: number;
  total: number;
  quizTitle: string;
  quizId: string;
};

const adminActions = [
  {
    title: "Create New Quiz",
    description: "Build a quiz from scratch with various question types.",
    href: "/dashboard/quizzes/new",
    icon: PlusCircle,
    cta: "Create Quiz",
  },
  {
    title: "AI Quiz Generator",
    description: "Automatically generate a quiz from a PDF document.",
    href: "/dashboard/ai-quiz-generator",
    icon: Sparkles,
    cta: "Generate with AI",
  },
  {
    title: "Upload a File",
    description: "Share documents with students and manage access.",
    href: "/dashboard/files",
    icon: FileText,
    cta: "Upload File",
  },
];

export default function DashboardPage() {
  const { role, user, loading: authLoading, profile } = useAuth();

  // Student KPIs
  const [latestAttempt, setLatestAttempt] = useState<LatestAttempt | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [attemptsCount, setAttemptsCount] = useState<number>(0);

  const [loadingBlock, setLoadingBlock] = useState(true);

  // Greeting from DB name -> displayName -> email local-part
  const fallbackName =
    user?.displayName?.trim() || (user?.email ? user.email.split("@")[0] : "") || "User";
  const displayName = (profile?.name && String(profile.name)) || fallbackName;

  const welcomeMessage = role === "admin" ? "Welcome, Administrator!" : `Welcome, ${displayName}!`;

  useEffect(() => {
    if (authLoading) return;

    const loadStudentKpis = async () => {
      setLoadingBlock(true);
      try {
        if (!user) {
          setLatestAttempt(null);
          setAvgScore(null);
          setAttemptsCount(0);
          return;
        }

        // Fetch this student's quizzes + results
        const quizzes = await getQuizzesForUser(user.uid);

        // Collect all OFFICIAL (non-practice) attempts
        type R = { score: number; total: number; date: number; quizTitle: string; quizId: string };
        const official: R[] = [];

        for (const q of quizzes) {
          const officialResults = (q.results || []).filter((r) => !r.isPractice);
          for (const r of officialResults) {
            official.push({
              score: r.score,
              total: r.total,
              date: r.date,
              quizTitle: q.title,
              quizId: q.id,
            });
          }
        }

        // Latest attempt
        let mostRecent: LatestAttempt | null = null;
        for (const r of official) {
          if (!mostRecent || r.date > mostRecent.date) {
            mostRecent = {
              date: r.date,
              score: r.score,
              total: r.total,
              quizTitle: r.quizTitle,
              quizId: r.quizId,
            };
          }
        }
        setLatestAttempt(mostRecent);

        // Average score across all official attempts
        setAttemptsCount(official.length);
        if (official.length > 0) {
          const avg =
            (official.reduce((acc, r) => acc + r.score / r.total, 0) / official.length) * 100;
          setAvgScore(avg);
        } else {
          setAvgScore(null);
        }
      } catch (e) {
        console.error("Failed to load student KPIs:", e);
        setLatestAttempt(null);
        setAvgScore(null);
        setAttemptsCount(0);
      } finally {
        setLoadingBlock(false);
      }
    };

    if (role === "student") {
      loadStudentKpis();
    } else {
      setLoadingBlock(false);
    }
  }, [authLoading, role, user]);

  if (authLoading || loadingBlock) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">{welcomeMessage}</h1>
        <p className="text-muted-foreground">Here&apos;s a quick overview of your learning hub.</p>
      </div>

      {/* ---------- Student view: compact KPI boxes on the LEFT ---------- */}
      {/* ---------- Student view: compact KPI boxes, same size, left-aligned ---------- */}
{role === "student" && user && (
  <>
    <div className="flex flex-wrap gap-6 items-stretch">
      {/* Latest Attempt */}
      <div className="w-full sm:w-[22rem]">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="text-accent" /> Your Latest Attempt
            </CardTitle>
            <CardDescription>Most recent official quiz submission.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {latestAttempt ? (
              <>
                <p className="text-5xl font-bold text-primary">
                  {Math.round((latestAttempt.score / latestAttempt.total) * 100)}%
                </p>
                <p className="text-lg font-semibold mt-2">{latestAttempt.quizTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(latestAttempt.date).toLocaleString()}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground py-8">
                No official quiz attempts recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Average Score */}
      <div className="w-full sm:w-[22rem]">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="text-accent" /> Average Score
            </CardTitle>
            <CardDescription>Across your official attempts.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {avgScore !== null ? (
              <>
                <p className="text-5xl font-bold text-primary">{Math.round(avgScore)}%</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Based on {attemptsCount} attempt{attemptsCount === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground py-8">
                No attempts yet to compute an average.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    <div className="mt-6">
      <h2 className="text-2xl font-bold font-headline mb-4">Your Progress</h2>
      <StudentStats userId={user.uid} />
    </div>
  </>
)}


      {/* ---------- Admin view (unchanged) ---------- */}
      {role === "admin" && (
        <>
          <div>
            <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2">
              <Users /> Student Overview
            </h2>
            <StudentList />
          </div>

          <div>
            <h2 className="text-2xl font-bold font-headline mb-4">Quick Actions</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {adminActions.map((action) => (
                <Card key={action.title} className="flex flex-col">
                  <CardHeader className="flex-1">
                    <div className="flex items-start gap-4">
                      <action.icon className="h-8 w-8 text-accent" />
                      <div className="flex-1">
                        <CardTitle>{action.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {action.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Link href={action.href}>{action.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
