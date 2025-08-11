
"use client";

import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { generateQuizAction, saveGeneratedQuizAction, type QuizGenerationState } from "@/lib/actions/quiz";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { File, Loader2, Sparkles, Terminal, Save, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

const initialState: QuizGenerationState = {
  state: 'idle'
};

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Quiz
        </>
      )}
    </Button>
  );
}

export function AiQuizGeneratorForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [state, formAction] = useFormState(generateQuizAction, initialState);
  const [fileName, setFileName] = useState("");
  const formRef = React.useRef<HTMLFormElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveQuiz = async () => {
    if (!state.quiz) return;
    setIsSaving(true);
    try {
        const result = await saveGeneratedQuizAction(state.quiz);
        if (result.error) {
            toast({ title: "Error saving quiz", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Quiz Saved!", description: "The AI-generated quiz has been saved." });
            router.push('/dashboard/quizzes');
        }
    } catch (error) {
        toast({ title: "Error", description: "An unexpected error occurred while saving.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  }

  const handleDiscard = () => {
    formRef.current?.reset();
    setFileName("");
    // A bit of a hack to reset the form state
    formAction(new FormData());
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Quiz Topic / Title</Label>
          <Input id="topic" name="topic" placeholder="e.g., The French Revolution" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="numQuestions">Number of Questions</Label>
          <Input id="numQuestions" name="numQuestions" type="number" min="1" max="10" placeholder="e.g., 5" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdfFile">PDF Document</Label>
          <div className="relative">
            <Input 
              id="pdfFile" 
              name="pdfFile" 
              type="file" 
              accept="application/pdf" 
              required
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            />
            <div className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-md border-input bg-background/50">
              <div className="text-center text-muted-foreground">
                <File className="mx-auto h-8 w-8" />
                <p>{fileName || "Click to upload a PDF"}</p>
              </div>
            </div>
          </div>
        </div>
        <GenerateButton />
      </form>
      
      {state.state === 'error' && state.message && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.state === 'generated' && state.quiz && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>{state.quiz.title}</CardTitle>
                <CardDescription>Review the AI-generated quiz below. You can save it to make it available or discard it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {state.quiz.questions.map((q, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                        <p className="font-semibold">{index + 1}. {q.question}</p>
                        <RadioGroup className="mt-2 space-y-1" value={q.answer as string}>
                            {q.options.map((opt, i) => (
                                <div key={i} className={`flex items-center space-x-2 p-2 rounded-md ${opt === q.answer ? 'bg-green-100 dark:bg-green-900/30' : ''}`}>
                                    <RadioGroupItem value={opt} id={`q${index}-opt${i}`} disabled/>
                                    <Label htmlFor={`q${index}-opt${i}`}>{opt}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                ))}
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleDiscard} disabled={isSaving}>
                        <XCircle className="mr-2 h-4 w-4" /> Discard
                    </Button>
                    <Button onClick={handleSaveQuiz} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? "Saving..." : "Save Quiz"}
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
