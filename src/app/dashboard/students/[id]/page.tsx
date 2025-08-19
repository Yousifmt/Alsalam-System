// viewing answer functionality
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getStudent, type Student } from "@/services/user-service";
import { getQuizzesForUser } from "@/services/quiz-service";
import type { Question, Quiz } from "@/lib/types";
import { Loader2, ArrowLeft, BarChart, History, CheckCircle, XCircle } from "lucide-react";
import { StudentStats } from "@/components/dashboard/student-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLoading } from "@/context/loading-context";
import { getQuiz } from "@/services/quiz-service";

const AnswerOption = ({
  option,
  isUserAnswer,
  isCorrectAnswer,
}: {
  option: string;
  isUserAnswer: boolean;
  isCorrectAnswer: boolean;
}) => {
  const isCorrectSelection = isUserAnswer && isCorrectAnswer;
  const isWrongSelection = isUserAnswer && !isCorrectAnswer;

  return (
    <div className="flex items-center text-sm ml-6">
      {isCorrectSelection ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
      ) : isWrongSelection ? (
        <XCircle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
      ) : isCorrectAnswer ? (
        <CheckCircle className="h-4 w-4 mr-2 text-green-500/50 flex-shrink-0" />
      ) : (
        <div className="h-4 w-4 mr-2" /> // Placeholder for alignment
      )}
      <span
        className={`${
          isUserAnswer ? "font-semibold" : ""
        } ${isCorrectAnswer ? "text-green-700 dark:text-green-400" : ""}`}
      >
        {option}
      </span>
    </div>
  );
};

export default function StudentDetailPage() {
    const params = useParams();
    const id = params.id as string;
    
    const [student, setStudent] = useState<Student | null>(null);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [masterQuizzes, setMasterQuizzes] = useState<Record<string, Quiz>>({});
    const [loading, setLoading] = useState(true);
    const { setIsLoading } = useLoading();
    const router = useRouter();


    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [studentData, quizzesData] = await Promise.all([
                    getStudent(id),
                    getQuizzesForUser(id)
                ]);
                setStudent(studentData);
                const attemptedQuizzes = quizzesData.filter(q => q.results && q.results.length > 0);
                setQuizzes(attemptedQuizzes);

                // Fetch master quiz data for all attempted quizzes to get all options
                const masterQuizData: Record<string, Quiz> = {};
                for (const quiz of attemptedQuizzes) {
                    const master = await getQuiz(quiz.id);
                    if (master) {
                        masterQuizData[quiz.id] = master;
                    }
                }
                setMasterQuizzes(masterQuizData);

            } catch (error) {
                console.error("Failed to fetch student details:", error);
                setStudent(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleBackClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsLoading(true);
        router.push('/dashboard');
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }

    if (!student) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-bold">Student Not Found</h1>
                <p>The requested student could not be found.</p>
                 <Button asChild variant="link" className="mt-4" onClick={handleBackClick}>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
        );
    }
    
    const findOriginalQuestion = (quizId: string, questionText: string): Question | undefined => {
        const masterQuiz = masterQuizzes[quizId];
        return masterQuiz?.questions.find(q => q.question === questionText);
    }

    return (
        <div className="space-y-8">
            <div>
                <Button asChild variant="outline" size="sm" className="mb-4">
                     <Link href="/dashboard" onClick={handleBackClick}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Students
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{student.name}</h1>
                <p className="text-muted-foreground">{student.email}</p>
            </div>

            <StudentStats userId={id} />
            
            <div>
                <h2 className="text-2xl font-bold font-headline mb-4">Quiz History</h2>
                {quizzes.length > 0 ? (
                    <div className="space-y-4">
                        {quizzes.map(quiz => (
                            <Card key={quiz.id}>
                                <CardHeader>
                                    <CardTitle>{quiz.title}</CardTitle>
                                    <CardDescription>{quiz.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value="item-1">
                                            <AccordionTrigger>
                                                <div className="flex items-center gap-2">
                                                    <History className="h-5 w-5 text-accent" />
                                                    {quiz.results?.length} Attempt{quiz.results?.length === 1 ? '' : 's'}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-2">
                                                 <Accordion type="multiple" className="w-full space-y-2">
                                                    {[...(quiz.results || [])].sort((a,b) => b.date - a.date).map((result, index) => (
                                                        <AccordionItem value={`attempt-${index}`} key={result.date} className="bg-secondary rounded-lg px-4 border-b-0">
                                                            <AccordionTrigger className="py-3 hover:no-underline">
                                                                <div className="flex justify-between items-center w-full">
                                                                    <div className="font-medium">
                                                                        Attempt {quiz.results!.length - index} 
                                                                        <span className="ml-2 text-sm text-muted-foreground">({new Date(result.date).toLocaleString()})</span>
                                                                    </div>
                                                                    <Badge>{Math.round((result.score / result.total) * 100)}%</Badge>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <AccordionContent className="pt-2 pb-4 space-y-4">
                                                                {result.answeredQuestions.map((item, qIndex) => {
                                                                    const originalQuestion = findOriginalQuestion(quiz.id, item.question);
                                                                    if (!originalQuestion) return null;
                                                                    
                                                                    const userAnswerArray = Array.isArray(item.userAnswer) ? item.userAnswer : [item.userAnswer];
                                                                    const correctAnswerArray = Array.isArray(originalQuestion.answer) ? originalQuestion.answer : [originalQuestion.answer];

                                                                    return (
                                                                        <div key={qIndex} className={`p-3 rounded-lg border-l-4 ${item.isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                                                            <div className="flex items-start justify-between">
                                                                                <p className="font-semibold">{qIndex + 1}. {item.question}</p>
                                                                                {item.isCorrect 
                                                                                    ? <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" /> 
                                                                                    : <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                                                                                }
                                                                            </div>
                                                                            <div className="mt-2 text-sm space-y-1">
                                                                                <p className="font-medium">Options:</p>
                                                                                {originalQuestion.options.map(opt => (
                                                                                    <AnswerOption 
                                                                                        key={opt}
                                                                                        option={opt}
                                                                                        isUserAnswer={userAnswerArray.includes(opt)}
                                                                                        isCorrectAnswer={correctAnswerArray.includes(opt)}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                 </Accordion>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            <BarChart className="h-12 w-12 mx-auto mb-4"/>
                            <p>This student has not attempted any quizzes yet.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
// viewing answer functionality
