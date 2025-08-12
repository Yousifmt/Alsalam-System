"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, PlusCircle, Image as ImageIcon, Trash2, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import type { Question, Quiz } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { createQuiz, updateQuiz, deleteQuiz } from "@/services/quiz-service";
import { uploadQuizImage } from "@/services/storage-service";

/* ============================= Parser Utilities ============================ */

// Accepts A-Z or 1..999 prefixes, and bullets like "-" or "•"
// Require a real delimiter after the label, so normal sentences won't match.
// Supports "(A) ", "A) ", "A.", "A:", "A-", "A–", "A—", with or without space after.
// Also supports bullets "-" and "•".
const OPTION_PREFIX =
  /^\s*(?:[-•]\s+|\(?\s*([A-Za-z]|\d{1,3})\s*\)?[.)\:–—-]\s*)/;


// Extracts e.g. "Answer: A,C" / "Answers: 1,3"
function extractExplicitAnswers(raw: string): Set<string> {
  const out = new Set<string>();
  const re = /^\s*answers?\s*:\s*([A-Za-z0-9 ,]+)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const payload = m[1].replace(/[,\s]+/g, "");
    for (const ch of payload) {
      if (/[A-Za-z]/.test(ch)) out.add(ch.toUpperCase());
      else if (/\d/.test(ch)) out.add(ch);
    }
  }
  return out;
}



type ParsedOption = { label?: string; text: string; correct?: boolean };
type ParsedResult = { question: string; options: ParsedOption[] };

/** Parse pasted block into question + options, supporting multi-correct. */
function parsePastedBlock(rawText: string): ParsedResult | null {
  const raw = (rawText ?? "").replace(/\r/g, "").trim();
  if (!raw) return null;

  const explicit = extractExplicitAnswers(raw);

  // split lines and remove "Answer(s):" lines
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length && !/^\s*answers?\s*:/i.test(l));

  if (!lines.length) return null;

  // First non-option line is the question; if none found, use the first line
  let qIndex = lines.findIndex((l) => !OPTION_PREFIX.test(l));
  if (qIndex < 0) qIndex = 0;

  const question = lines[qIndex];
  const options: ParsedOption[] = [];

  const alphaToNum = (lab: string) => {
    const c = lab.toUpperCase().charCodeAt(0);
    return c >= 65 && c <= 90 ? String(c - 64) : null; // A->1, B->2...
  };

  for (let i = qIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!OPTION_PREFIX.test(line)) continue;

    const [, labelRaw] = line.match(/^\(?\s*([A-Za-z]|\d{1,3})/) ?? [];
    const label = labelRaw?.toString().toUpperCase();

    let textOnly = line.replace(OPTION_PREFIX, "").trim();

    // Inline correctness markers: trailing "*" or "(correct)"
    let correct = /\*\s*$/.test(textOnly) || /\(correct\)$/i.test(textOnly);
    textOnly = textOnly.replace(/\*\s*$|\(correct\)$/i, "").trim();

    // Respect explicit answers by label or number
    if (!correct && label && explicit.size) {
      if (explicit.has(label)) correct = true;
      const num = alphaToNum(label);
      if (!correct && num && explicit.has(num)) correct = true; // A->1 mapping
    }

    options.push({ label, text: textOnly, correct });
  }

  if (!options.length) return null;
  return { question, options };
}

/* ============================== Component Types ============================ */

type QuestionType = "multiple-choice" | "checkbox" | "short-answer";

interface FormQuestion extends Omit<Question, "id" | "imageUrl"> {
  id: number | string; // temp UI id
  imageFile?: File | null;
  imageUrl?: string | null;
}

/* ================================ Main Form ================================ */

export function QuizBuilderForm({ quiz }: { quiz?: Quiz }) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [timeLimit, setTimeLimit] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditMode = !!quiz;

  useEffect(() => {
    if (!isEditMode) return;
    setTitle(quiz.title);
    setDescription(quiz.description || "");
    setQuestions(quiz.questions.map((q) => ({ ...q, imageFile: null })));
    setTimeLimit(quiz.timeLimit || 0);
    setShuffleQuestions(quiz.shuffleQuestions);
    setShuffleAnswers(quiz.shuffleAnswers);
  }, [quiz, isEditMode]);

  /* ------------------------------ Question CRUD ----------------------------- */

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: Date.now(),
        question: "",
        type: "multiple-choice",
        options: ["", "", "", ""], // default 4, parser can expand
        answer: "",
        imageFile: null,
        imageUrl: null,
      },
    ]);
  };

  const removeQuestion = (id: number | string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleQuestionChange = (id: number | string, value: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question: value } : q)));
  };

  const handleQuestionTypeChange = (id: number | string, type: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              type,
              options: type !== "short-answer" ? (q.options.length ? q.options : ["", "", "", ""]) : [],
              answer: type === "checkbox" ? [] : "",
            }
          : q
      )
    );
  };

  const handleOptionChange = (qId: number | string, oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;

        const newOptions = q.options.map((opt, i) => (i === oIndex ? value : opt));

        // Keep selected answers in sync if the edited option was selected
        let newAnswer: Question["answer"] = q.answer;
        if (q.type === "multiple-choice" && q.answer === q.options[oIndex]) {
          newAnswer = value;
        } else if (q.type === "checkbox" && Array.isArray(q.answer)) {
          newAnswer = q.answer.map((ans) => (ans === q.options[oIndex] ? value : ans));
        }

        return { ...q, options: newOptions, answer: newAnswer };
      })
    );
  };

  const addOption = (qId: number | string) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, options: [...q.options, ""] } : q)));
  };

  const removeOption = (qId: number | string, oIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const removed = q.options[oIndex];
        const newOptions = q.options.filter((_, i) => i !== oIndex);

        let newAnswer: Question["answer"] = q.answer;
        if (q.type === "multiple-choice" && q.answer === removed) {
          newAnswer = "";
        } else if (q.type === "checkbox" && Array.isArray(q.answer)) {
          newAnswer = q.answer.filter((ans) => ans !== removed);
        }

        return { ...q, options: newOptions, answer: newAnswer };
      })
    );
  };

  const handleCorrectAnswerChange = (qId: number | string, _oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;

        if (q.type === "multiple-choice") {
          return { ...q, answer: value };
        }

        if (q.type === "checkbox") {
          const curr = Array.isArray(q.answer) ? q.answer : [];
          const exists = curr.includes(value);
          const next = exists ? curr.filter((a) => a !== value) : [...curr, value];
          return { ...q, answer: next };
        }

        return q;
      })
    );
  };

  /* ----------------------------- Image Handlers ----------------------------- */

  const handleImageUpload = (qId: number | string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, imageFile: file, imageUrl: reader.result as string } : q))
      );
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (qId: number | string) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, imageFile: null, imageUrl: null } : q)));
  };

  /* ------------------------------ Paste Parsing ----------------------------- */

  const handleQuestionPaste = (
  qId: number | string,
  e: React.ClipboardEvent<HTMLTextAreaElement>
) => {
  const raw = e.clipboardData.getData("text/plain");
  if (!raw?.trim()) return; // let normal paste happen

  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim());

  if (!lines.length) return;

  // Remove Answer/Answers lines for parsing (we still use `raw` for explicit answers)
  const contentLines = lines.filter((l) => l.length && !/^\s*answers?\s*:/i.test(l));

  // Build full question from consecutive non-option lines at the top
  const questionLines: string[] = [];
  let i = 0;
  while (i < contentLines.length && !OPTION_PREFIX.test(contentLines[i])) {
    questionLines.push(contentLines[i]);
    i++;
  }
  const fullQuestion = questionLines.join(" ").replace(/\s+/g, " ").trim();

  // Parse options
  const explicit = extractExplicitAnswers(raw);
  const alphaToNum = (lab: string) => {
    const c = lab.toUpperCase().charCodeAt(0);
    return c >= 65 && c <= 90 ? String(c - 64) : null; // A->1
  };

  const options: { text: string; correct?: boolean }[] = [];
  for (; i < contentLines.length; i++) {
    const line = contentLines[i];
    if (!OPTION_PREFIX.test(line)) continue;

    const [, labelRaw] = line.match(/^\(?\s*([A-Za-z]|\d{1,3})/) ?? [];
    const label = labelRaw?.toString().toUpperCase();

    let text = line.replace(OPTION_PREFIX, "").trim();

    // Inline correctness markers
    let correct = /\*\s*$/.test(text) || /\(correct\)$/i.test(text);
    text = text.replace(/\*\s*$|\(correct\)$/i, "").trim();

    // Respect "Answer(s):" hints
    if (!correct && label && explicit.size) {
      if (explicit.has(label)) correct = true;
      const num = alphaToNum(label);
      if (!correct && num && explicit.has(num)) correct = true;
    }

    options.push({ text, correct });
  }

  // If we couldn’t parse anything useful, let the browser paste normally
  if (!fullQuestion && options.length === 0) return;

  // We are going to fill fields, block default paste now
  e.preventDefault();

  // If only a question was found, still set it
  if (fullQuestion && options.length === 0) {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, question: fullQuestion } : q)));
    return;
  }

  // Build answers + type
  const optionTexts = options.map((o) => o.text);
const correctIdxs = options.map((o, idx) => (o.correct ? idx : -1)).filter((n) => n >= 0);

// Force checkbox if "Choose" phrase is in the question or multiple correct answers
let nextType: "multiple-choice" | "checkbox" =
  correctIdxs.length > 1 || /\(choose\s*\d+\)/i.test(fullQuestion)
    ? "checkbox"
    : "multiple-choice";

let nextAnswer: Question["answer"] = "";
if (nextType === "multiple-choice") {
  nextAnswer = correctIdxs.length === 1 ? optionTexts[correctIdxs[0]] : "";
} else {
  nextAnswer = correctIdxs.map((ci) => optionTexts[ci]); // array for checkbox
}

setQuestions((prev) =>
  prev.map((q) =>
    q.id === qId
      ? {
          ...q,
          question: fullQuestion || q.question,
          options: optionTexts, // handles >4 automatically
          type: nextType,
          answer: nextAnswer,
        }
      : q
  )
);
};


  /* --------------------------------- Submit -------------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const finalQuestions: Question[] = await Promise.all(
        questions.map(async (q, index) => {
          let finalImageUrl: string | null = q.imageUrl || null;
          if (q.imageFile) {
            finalImageUrl = await uploadQuizImage(q.imageFile, `${Date.now()}-${q.imageFile.name}`);
          }
          return {
            id: typeof q.id === "string" ? q.id : `${Date.now()}-${index}`,
            question: q.question,
            type: q.type,
            options: q.options,
            answer: q.answer,
            imageUrl: finalImageUrl,
          };
        })
      );

      const quizData: Omit<Quiz, "id"> = {
        title,
        description,
        questions: finalQuestions,
        status: "Not Started",
        timeLimit: timeLimit > 0 ? timeLimit : undefined,
        shuffleQuestions,
        shuffleAnswers,
        results: quiz?.results || [],
      };

      if (isEditMode) {
        await updateQuiz(quiz!.id, quizData);
        toast({ title: "Quiz Updated!", description: "Your quiz has been successfully updated." });
      } else {
        await createQuiz(quizData);
        toast({ title: "Quiz Saved!", description: "Your new quiz has been successfully saved." });
      }

      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (error) {
      console.error("Failed to save quiz:", error);
      toast({
        title: "Error",
        description: "Failed to save the quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!quiz) return;
    setIsDeleting(true);
    try {
      await deleteQuiz(quiz.id);
      toast({ title: "Quiz Deleted", description: "The quiz has been permanently deleted." });
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete quiz:", error);
      toast({
        title: "Error",
        description: "Failed to delete the quiz. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  /* ---------------------------- Render Answers UI --------------------------- */

  const renderAnswerInput = (q: FormQuestion) => {
    switch (q.type) {
      case "multiple-choice":
        return (
          <RadioGroup
            onValueChange={(value) => handleCorrectAnswerChange(q.id, q.options.indexOf(value), value)}
            value={q.answer as string}
            className="space-y-2"
          >
            {q.options.map((opt, oIndex) => (
              <div key={oIndex} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${q.id}-${oIndex}`} />
                <Input
                  value={opt}
                  onChange={(e) => handleOptionChange(q.id, oIndex, e.target.value)}
                  placeholder={`Option ${oIndex + 1}`}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(q.id, oIndex)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => addOption(q.id)}>
              Add Option
            </Button>
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {q.options.map((opt, oIndex) => {
              const checked = Array.isArray(q.answer) ? q.answer.includes(opt) : false;
              return (
                <div key={oIndex} className="flex items-center gap-2">
                  <Checkbox
                    id={`${q.id}-${oIndex}`}
                    onCheckedChange={() => handleCorrectAnswerChange(q.id, oIndex, opt)}
                    checked={checked}
                  />
                  <Input
                    value={opt}
                    onChange={(e) => handleOptionChange(q.id, oIndex, e.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(q.id, oIndex)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="ghost" size="sm" onClick={() => addOption(q.id)}>
              Add Option
            </Button>
          </div>
        );

      case "short-answer":
        return <Input disabled placeholder="User will type their answer here" />;

      default:
        return null;
    }
  };

  /* ---------------------------------- JSX ---------------------------------- */

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="quiz-title">Quiz Title</Label>
        <Input
          id="quiz-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., European History Midterm"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quiz-description">Quiz Description</Label>
        <Input
          id="quiz-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief summary of the quiz content"
        />
      </div>

      <Separator />

      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-lg font-medium">Quiz Settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="time-limit">Time Limit (minutes)</Label>
            <Input
              id="time-limit"
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              placeholder="e.g., 30"
            />
            <p className="text-xs text-muted-foreground">Set to 0 for no time limit.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch id="shuffle-questions" checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
              <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="shuffle-answers" checked={shuffleAnswers} onCheckedChange={setShuffleAnswers} />
              <Label htmlFor="shuffle-answers">Shuffle Answer Options</Label>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {questions.map((q, qIndex) => (
        <div key={q.id} className="space-y-4 rounded-lg border p-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-grow space-y-2">
              <Label htmlFor={`question-${q.id}`}>Question {qIndex + 1}</Label>
              <Textarea
                id={`question-${q.id}`}
                value={q.question}
                onChange={(e) => handleQuestionChange(q.id, e.target.value)}
                onPaste={(e) => handleQuestionPaste(q.id, e)}
                placeholder={`Paste the whole question`}
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                Tip: Use “a) … / A. … / 1- …”. Mark correct with “*”, “(correct)” or “Answer: A,C”.
                Multiple correct → switches to Checkboxes automatically. Any number of options is supported.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={q.type} onValueChange={(value: QuestionType) => handleQuestionTypeChange(q.id, value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                  <SelectItem value="checkbox">Checkboxes</SelectItem>
                  <SelectItem value="short-answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" variant="ghost" size="icon" className="mt-8" onClick={() => removeQuestion(q.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {q.imageUrl ? (
            <div className="relative h-48 w-full">
              <Image
                src={q.imageUrl}
                alt={`Question ${qIndex + 1} image`}
                fill
                style={{ objectFit: "contain" }}
                className="rounded-md border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => removeImage(q.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`image-upload-${q.id}`} className="cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
                  <ImageIcon className="h-4 w-4" />
                  <span>Add Image (Optional)</span>
                </div>
              </Label>
              <Input
                id={`image-upload-${q.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(q.id, e)}
              />
            </div>
          )}

          <div className="pl-2">
            <Label className="text-sm text-muted-foreground">Answer Options & Correct Answer</Label>
            <div className="mt-2">{renderAnswerInput(q)}</div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Question
      </Button>

      <div className="flex justify-between gap-2">
        {isEditMode && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="flex-1" disabled={isSaving || isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Quiz
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the quiz and all associated student results.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button type="submit" className="flex-1" disabled={isSaving || isDeleting}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Save Quiz"}
        </Button>
      </div>
    </form>
  );
}
