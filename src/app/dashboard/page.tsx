
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, PlusCircle, Sparkles, ClipboardList, Loader2, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { getQuizzes } from "@/services/quiz-service";
import { getFiles } from "@/services/file-service";
import { StudentStats } from "@/components/dashboard/student-stats";
import { StudentList } from "@/components/dashboard/student-list";

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
    }
];

export default function DashboardPage() {
    const { role, user, loading: authLoading } = useAuth();
    const [quizCount, setQuizCount] = useState(0);
    const [fileCount, setFileCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);
    
    const welcomeMessage = role === 'admin' ? "Welcome, Administrator!" : "Welcome, Student!";

    useEffect(() => {
        if (authLoading) return;

        async function loadStudentDashboardData() {
            setLoadingStats(true);
            try {
                if(user) {
                    const [quizzes, files] = await Promise.all([getQuizzes(), getFiles()]);
                    setQuizCount(quizzes.length);
                    setFileCount(files.length);
                }
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoadingStats(false);
            }
        }
        
        if (role === 'student') {
            loadStudentDashboardData();
        } else {
            setLoadingStats(false);
        }

    }, [authLoading, user, role]);

    if(authLoading || loadingStats) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">{welcomeMessage}</h1>
                <p className="text-muted-foreground">Here&apos;s a quick overview of your learning hub.</p>
            </div>

            {role === 'student' && user && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ClipboardList className="text-accent" /> Quizzes Assigned</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold">{quizCount}</div>
                            <p className="text-xs text-muted-foreground">{quizCount} quizzes available.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileText className="text-accent" /> Shared Files</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold">{fileCount}</div>
                            <p className="text-xs text-muted-foreground">{fileCount} files available for download.</p>
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <h2 className="text-2xl font-bold font-headline mb-4">Your Progress</h2>
                    <StudentStats userId={user.uid} />
                </div>
              </>
            )}


            {role === 'admin' && (
              <>
                <div>
                  <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2"><Users /> Student Overview</h2>
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
                                            <CardDescription className="mt-2">{action.description}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
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
