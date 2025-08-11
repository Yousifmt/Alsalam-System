import { AiQuizGeneratorForm } from "@/components/dashboard/ai-quiz-generator-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export default function AiQuizGeneratorPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">AI Quiz Generator</h1>
                <p className="text-muted-foreground">Upload a PDF document and let AI create a quiz for you.</p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Generate New Quiz</CardTitle>
                            <CardDescription>Fill in the details below to start the generation process.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <AiQuizGeneratorForm />
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-4">
                    <Card className="bg-secondary">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Lightbulb className="text-accent"/> How it works</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p><strong>1. Upload:</strong> Select a PDF document from your device.</p>
                            <p><strong>2. Configure:</strong> Specify the quiz topic and the number of questions you need.</p>
                            <p><strong>3. Generate:</strong> Our AI will read the document and generate relevant multiple-choice questions and answers.</p>
                            <p><strong>4. Review &amp; Save:</strong> You can then review, edit, and save the generated quiz to make it available for students.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
