
"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ClipboardList, ArrowRight, SearchX } from 'lucide-react';
import { getQuizzesForSearch } from '@/services/quiz-service';
import { getFiles } from '@/services/file-service';
import type { Quiz, ManagedFile } from '@/lib/types';
import { useAuth } from '@/context/auth-context';

export default function SearchPage() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');
    const { role } = useAuth();

    const [loading, setLoading] = useState(true);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [files, setFiles] = useState<ManagedFile[]>([]);
    
    useEffect(() => {
        if (!query) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [allQuizzes, allFiles] = await Promise.all([
                    getQuizzesForSearch(),
                    getFiles(),
                ]);

                const lowerCaseQuery = query.toLowerCase();

                const filteredQuizzes = allQuizzes.filter(quiz => 
                    quiz.title.toLowerCase().includes(lowerCaseQuery) ||
                    (quiz.description && quiz.description.toLowerCase().includes(lowerCaseQuery))
                );

                const filteredFiles = allFiles.filter(file => 
                    file.name.toLowerCase().includes(lowerCaseQuery)
                );

                setQuizzes(filteredQuizzes);
                setFiles(filteredFiles);

            } catch (error) {
                console.error("Failed to fetch search results:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [query]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Search Results</h1>
                <p className="text-muted-foreground">Showing results for: <span className="font-semibold text-primary">&quot;{query}&quot;</span></p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin"/>
                    <p className="ml-4">Searching...</p>
                </div>
            ) : (
                <>
                    {quizzes.length === 0 && files.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                             <SearchX className="mx-auto h-12 w-12" />
                            <h2 className="mt-4 text-xl font-semibold">No Results Found</h2>
                            <p>We couldn&apos;t find any quizzes or files matching your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {quizzes.length > 0 && (
                                <section>
                                    <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2">
                                        <ClipboardList className="text-accent" /> Quizzes
                                    </h2>
                                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                        {quizzes.map(quiz => (
                                            <Card key={quiz.id} className="flex flex-col">
                                                <CardHeader>
                                                    <CardTitle>{quiz.title}</CardTitle>
                                                    <CardDescription>{quiz.description}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="flex-grow">
                                                    <Badge variant="outline">{quiz.questions.length} Questions</Badge>
                                                </CardContent>
                                                <CardFooter>
                                                    <Button asChild className="w-full">
                                                        <Link href={role === 'admin' ? `/quiz/${quiz.id}` : `/dashboard/quizzes`}>
                                                            {role === 'admin' ? "View Quiz" : "Go to Quizzes"}
                                                            <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {files.length > 0 && (
                                <section>
                                     <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2">
                                        <FileText className="text-accent" /> Files
                                    </h2>
                                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                                        {files.map(file => (
                                            <Card key={file.path}>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-3">
                                                         <FileText className="h-5 w-5 text-muted-foreground" />
                                                         <span>{file.name}</span>
                                                    </CardTitle>
                                                     <CardDescription>{file.size}</CardDescription>
                                                </CardHeader>
                                                <CardFooter>
                                                     <Button asChild className="w-full">
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                                                            Download File
                                                            <ArrowRight className="ml-2 h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
