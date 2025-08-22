import { QuizBuilderForm } from "@/components/dashboard/quiz-builder-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function NewQuizPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Quiz Builder</h1>
                <p className="text-muted-foreground">Manually create a new quiz with custom questions.</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Quiz</CardTitle>
                            <CardDescription>Add a title, description, and your questions below.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <QuizBuilderForm />
                        </CardContent>
                    </Card>
                </div>
                 <div className="space-y-4">
                    <Card className="bg-secondary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><HelpCircle className="text-accent"/> Instructions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p>Use this form to build your quiz from scratch.</p>
                            <p><strong>1. Details:</strong> Add a quiz title and description.</p>
                            <p><strong>2. Questions:</strong> Click &quot;Add Question&quot; to create a new question.</p>
                            <p><strong>3. Options:</strong> For each question, provide multiple answer options.</p>
                             <p><strong>4. Correct Answer:</strong> Select the correct answer for each question using the radio button or checkbox.</p>
                            <p><strong>5. Save:</strong> Once finished, click &quot;Save Quiz&quot;.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
