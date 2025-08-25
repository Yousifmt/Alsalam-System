"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  X,
  PlusCircle,
  Plus,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Save,
  Archive,
  ArchiveRestore,
  GripVertical,
} from "lucide-react";

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

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Question, Quiz } from "@/lib/types";
import type { ScoringConfig, ScoreMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { createQuiz, updateQuiz, deleteQuiz } from "@/services/quiz-service";
import { uploadQuizImage } from "@/services/storage-service";

/* ============================= Parser Utilities ============================ */

const LBL_OPTION_PREFIX = /^\s*\(?\s*([A-Za-z]|\d{1,3})\s*\)?[.)\:–—-]\s*/;

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

function parsePastedBlock(rawText: string): ParsedResult | null {
  const raw = (rawText ?? "").replace(/\r/g, "").trim();
  if (!raw) return null;

  const explicit = extractExplicitAnswers(raw);

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length && !/^\s*answers?\s*:/i.test(l) && !/^question\s*:\s*\d+/i.test(l));

  if (!lines.length) return null;

  const questionLines: string[] = [];
  let i = 0;
  while (i < lines.length && !LBL_OPTION_PREFIX.test(lines[i])) {
    questionLines.push(lines[i]);
    i++;
  }
  const question = questionLines.join(" ").replace(/\s+/g, " ").trim();
  if (!question) return null;

  const options: ParsedOption[] = [];
  const alphaToNum = (lab: string) => {
    const c = lab.toUpperCase().charCodeAt(0);
    return c >= 65 && c <= 90 ? String(c - 64) : null; // A->1
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!LBL_OPTION_PREFIX.test(line)) continue;

    const [, labelRaw] = line.match(/^\(?\s*([A-Za-z]|\d{1,3})/) ?? [];
    const label = labelRaw?.toString().toUpperCase();

    let textOnly = line.replace(LBL_OPTION_PREFIX, "").trim();

    let correct = /\*\s*$/.test(textOnly) || /\(correct\)$/i.test(textOnly);
    textOnly = textOnly.replace(/\*\s*$|\(correct\)$/i, "").trim();

    if (!correct && label && explicit.size) {
      if (explicit.has(label)) correct = true;
      const num = alphaToNum(label);
      if (!correct && num && explicit.has(num)) correct = true;
    }

    options.push({ label, text: textOnly, correct });
  }

  if (!options.length) return null;
  return { question, options };
}

/* Two-option scoring only: 100% or 900 pts */
const DEFAULT_SCORING: ScoringConfig = { mode: "percent" };

function splitIntoBlocks(raw: string): string[] {
  const lines = raw.replace(/\r/g, "").split("\n").map((l) => l.trim());

  const blocks: string[] = [];
  let buf: string[] = [];
  let sawOption = false;

  for (const line of lines) {
    if (!line) continue;
    if (/^question\s*:\s*\d+/i.test(line)) continue;

    buf.push(line);
    if (LBL_OPTION_PREFIX.test(line)) sawOption = true;

    if (/^\s*answers?\s*:/i.test(line)) {
      if (sawOption) blocks.push(buf.join("\n"));
      buf = [];
      sawOption = false;
    }
  }

  if (buf.length && buf.some((l) => LBL_OPTION_PREFIX.test(l))) {
    blocks.push(buf.join("\n"));
  }

  return blocks;
}

/* ============================== Component Types ============================ */

type QuestionType = "multiple-choice" | "checkbox" | "short-answer";

interface FormQuestion extends Omit<Question, "id" | "imageUrl"> {
  id: number | string;
  imageFile?: File | null;
  imageUrl?: string | null;
}

/* ============================ Sortable Question ============================ */

function SortableQuestionCard({
  q,
  qIndex,
  children,
}: {
  q: FormQuestion;
  qIndex: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,.12)" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center justify-between -mb-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing text-xs"
          aria-label={`Drag question ${qIndex + 1}`}
        >
          <GripVertical className="h-4 w-4" />
          Drag
        </button>
        <span className="text-xs text-muted-foreground">#{qIndex + 1}</span>
      </div>
      {children}
    </div>
  );
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
  const [isImporting, setIsImporting] = useState(false);

  // Only two choices: "percent" or "points900"
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);

  // autosave-to-draft state
  const [draftId, setDraftId] = useState<string | null>(
    quiz && (quiz as any).status === "Draft" ? quiz.id : null
  );
  const [autosavePending, setAutosavePending] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // archive state
  const [isArchiving, setIsArchiving] = useState(false);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isEditMode = !!quiz;

  useEffect(() => {
    if (!isEditMode) return;
    setTitle(quiz.title);
    setDescription(quiz.description || "");
    setQuestions(quiz.questions.map((q) => ({ ...q, imageFile: null })));
    setTimeLimit(quiz.timeLimit || 0);
    setShuffleQuestions(quiz.shuffleQuestions);
    setShuffleAnswers(quiz.shuffleAnswers);
    // hydrate scoring (default if missing)
    setScoring(quiz.scoring ?? DEFAULT_SCORING);
  }, [quiz, isEditMode]);

  /* ------------------------------ Question CRUD ----------------------------- */

  const newBlankQuestion = (): FormQuestion => ({
    id: Date.now() + Math.random(),
    question: "",
    type: "multiple-choice",
    options: ["", "", "", ""],
    answer: "",
    imageFile: null,
    imageUrl: null,
  });

  const addQuestion = () => setQuestions((prev) => [...prev, newBlankQuestion()]);

  const insertQuestionAt = (index: number) =>
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(index, 0, newBlankQuestion());
      return next;
    });

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

        let newAnswer: Question["answer"] = q.answer;
        if (q.type === "multiple-choice" && q.answer === q.options[oIndex]) {
          newAnswer = value;
        } else if (q.type === "checkbox" && Array.isArray(q.answer)) {
          newAnswer = (q.answer as string[]).map((ans) => (ans === q.options[oIndex] ? value : ans));
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
        if (q.type === "multiple-choice" && q.answer === removed) newAnswer = "";
        else if (q.type === "checkbox" && Array.isArray(q.answer)) newAnswer = (q.answer as string[]).filter((a) => a !== removed);

        return { ...q, options: newOptions, answer: newAnswer };
      })
    );
  };

  const handleCorrectAnswerChange = (qId: number | string, _oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        if (q.type === "multiple-choice") return { ...q, answer: value };
        if (q.type === "checkbox") {
          const curr = Array.isArray(q.answer) ? (q.answer as string[]) : [];
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

  /* ----------------------- Single-Question Paste Parsing -------------------- */

  const handleQuestionPaste = (qId: number | string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!raw?.trim()) return;

    setIsImporting(true);
    setTimeout(() => {
      try {
        const parsed = parsePastedBlock(raw);
        if (!parsed) return;

        e.preventDefault();

        const optionTexts = parsed.options.map((o) => o.text);
        const correctIdxs = parsed.options.map((o, idx) => (o.correct ? idx : -1)).filter((n) => n >= 0);

        const forceCheckbox = /\(choose\s*\d+\)/i.test(parsed.question);
        const nextType: QuestionType = forceCheckbox || correctIdxs.length > 1 ? "checkbox" : "multiple-choice";

        let nextAnswer: Question["answer"] = "";
        if (nextType === "multiple-choice") nextAnswer = correctIdxs.length === 1 ? optionTexts[correctIdxs[0]] : "";
        else nextAnswer = correctIdxs.map((ci) => optionTexts[ci]);

        setQuestions((prev) =>
          prev.map((q) =>
            q.id === qId ? { ...q, question: parsed.question, options: optionTexts, type: nextType, answer: nextAnswer } : q
          )
        );
      } finally {
        setIsImporting(false);
      }
    }, 0);
  };

  /* ----------------------------- BULK Paste Handler ------------------------- */

  const beginBulkImport = (raw: string) => {
    setIsImporting(true);
    setTimeout(() => {
      try {
        const blocks = splitIntoBlocks(raw);
        const created: FormQuestion[] = [];

        blocks.forEach((block, idx) => {
          const parsed = parsePastedBlock(block);
          if (!parsed) return;

          const optionTexts = parsed.options.map((o) => o.text);
          const correctIdxs = parsed.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);

          const forceCheckbox = /\(choose\s*\d+\)/i.test(parsed.question);
          const type: QuestionType = forceCheckbox || correctIdxs.length > 1 ? "checkbox" : "multiple-choice";

          const answer: Question["answer"] =
            type === "multiple-choice" ? (correctIdxs.length === 1 ? optionTexts[correctIdxs[0]] : "") : correctIdxs.map((ci) => optionTexts[ci]);

          created.push({
            id: `${Date.now()}-${idx}-${Math.random()}`,
            question: parsed.question,
            type,
            options: optionTexts,
            answer,
            imageFile: null,
            imageUrl: null,
          });
        });

        if (created.length) {
          setQuestions((prev) => [...prev, ...created]);
          toast({ title: `Imported ${created.length} question${created.length > 1 ? "s" : ""}`, description: "Bulk paste parsed successfully." });
        } else {
          toast({
            title: "No questions detected",
            description: "Ensure each question has options and an Answer line (e.g., Answer: D).",
            variant: "destructive",
          });
        }
      } finally {
        setIsImporting(false);
      }
    }, 0);
  };

  const handleBulkPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!raw?.trim()) return;
    e.preventDefault();
    beginBulkImport(raw);
  };

  /* ---------------------- Normalize / Payload builders ---------------------- */

  const validateAndNormalize = (qs: Question[]) => {
    const normalized: Question[] = [];
    let skipped = 0;

    for (const q of qs) {
      const question = (q.question || "").trim();
      const options = (q.options || []).map((o) => (o || "").trim()).filter(Boolean);
      if (!question) {
        skipped++;
        continue;
      }

      let answer: Question["answer"] = q.answer;
      if (q.type === "multiple-choice") {
        if (Array.isArray(answer)) answer = answer[0] ?? "";
        if (typeof answer !== "string" || !options.includes(answer)) answer = "";
      } else if (q.type === "checkbox") {
        if (!Array.isArray(answer)) answer = typeof answer === "string" && answer ? [answer] : [];
        answer = (answer as string[]).filter((a) => options.includes(a));
      } else if (q.type === "short-answer") {
        answer = "";
      }

      normalized.push({ ...q, question, options, answer });
    }

    return { normalized, skipped };
  };

  // Build payload from CURRENT STATE (uploads new images) with the desired status
  const buildFinalPayload = async (status: any) => {
    const finalQuestionsRaw: Question[] = await Promise.all(
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

    const { normalized, skipped } = validateAndNormalize(finalQuestionsRaw);

    const payload: Omit<Quiz, "id"> & { archived?: boolean } = {
      title: (title || "").trim() || "Untitled Quiz",
      description: (description || "").trim(),
      questions: normalized,
      status,
      archived: String(status).toLowerCase() === "archived",
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      shuffleQuestions,
      shuffleAnswers,
      results: quiz?.results || [],
      scoring, // <-- save the 100/900 choice
    };

    return { payload, skipped };
  };

  /* ------------------------- Autosave to Draft ------------------------ */

  const hasContent = () => {
    const nonEmptyQs = questions.some(
      (q) => (q.question && q.question.trim()) || (q.options || []).some((o) => o && o.trim())
    );
    return (title && title.trim()) || (description && description.trim()) || nonEmptyQs;
  };

  const buildDraftPayload = () => {
    const draftQuestions: Question[] = questions.map((q, index) => ({
      id: typeof q.id === "string" ? q.id : `${Date.now()}-${index}`,
      question: q.question,
      type: q.type,
      options: q.options,
      answer: q.answer,
      imageUrl: q.imageUrl && !q.imageUrl.startsWith("data:") ? q.imageUrl : null,
    }));

    const { normalized } = validateAndNormalize(draftQuestions);

    const payload: Omit<Quiz, "id"> & { archived?: boolean } = {
      title: (title || "").trim() || "Untitled Quiz",
      description: (description || "").trim(),
      questions: normalized,
      status: "Draft" as any,
      archived: false,
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      shuffleQuestions,
      shuffleAnswers,
      results: quiz?.results || [],
      scoring, // <-- keep in draft too
    };

    return payload;
  };

  const autoSaveDraft = async () => {
    try {
      if (!hasContent()) return;
      if (isSaving || isArchiving || isDeleting) return;
      if (isEditMode && (quiz as any)?.status !== "Draft") return;

      setAutosavePending(true);
      const payload = buildDraftPayload();

      if (draftId) {
        await updateQuiz(draftId, payload);
      } else {
        const res: any = await createQuiz(payload);
        const newId = res?.id || (typeof res === "string" ? res : undefined);
        if (newId) setDraftId(newId);
      }
      setLastSavedAt(new Date());
    } catch {
      // silent
    } finally {
      setAutosavePending(false);
    }
  };

  useEffect(() => {
    if (isSaving || isArchiving || isDeleting) return;
    const t = setTimeout(() => {
      autoSaveDraft();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    questions,
    timeLimit,
    shuffleQuestions,
    shuffleAnswers,
    scoring, // autosave when scale changes
    isSaving,
    isArchiving,
    isDeleting,
  ]);

  /* ------------------------------ Archive / Unarchive ------------------------------ */

  const handleArchive = async () => {
    if (!isEditMode && !draftId) {
      // allow archiving a brand-new form
    }
    setIsArchiving(true);
    try {
      const id = isEditMode ? quiz.id : draftId || undefined;

      const { payload, skipped } = await buildFinalPayload("Archived");
      if (skipped) {
        toast({ title: "Some questions skipped", description: `${skipped} invalid question(s) were removed.` });
      }

      if (id) {
        await updateQuiz(id, payload);
      } else {
        const res: any = await createQuiz(payload);
        setDraftId(res?.id || (typeof res === "string" ? res : null));
      }

      toast({ title: "Archived", description: "Quiz archived with your latest changes." });
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to archive quiz.", variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    setIsArchiving(true);
    try {
      const id = isEditMode ? quiz.id : draftId || undefined;

      const { payload, skipped } = await buildFinalPayload("Not Started");
      if (skipped) {
        toast({ title: "Some questions skipped", description: `${skipped} invalid question(s) were removed.` });
      }

      if (id) {
        await updateQuiz(id, payload);
      } else {
        const res: any = await createQuiz(payload);
        setDraftId(res?.id || (typeof res === "string" ? res : null));
      }

      toast({ title: "Unarchived", description: "Quiz is now visible (per your filters)." });
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to unarchive quiz.", variant: "destructive" });
    } finally {
      setIsArchiving(false);
    }
  };

  /* --------------------------------- Save ---------------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const nextStatus: any =
        draftId ? "Not Started" : isEditMode ? (quiz as any).status : "Not Started";

      const { payload, skipped } = await buildFinalPayload(nextStatus);

      if (!payload.questions.length) {
        toast({ title: "Nothing to save", description: "All questions were empty or invalid.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
      if (skipped) {
        toast({ title: "Some questions skipped", description: `${skipped} invalid question(s) were removed before saving.` });
      }

      if (draftId) {
        await updateQuiz(draftId, payload);
      } else if (isEditMode) {
        await updateQuiz(quiz!.id, payload);
      } else {
        await createQuiz(payload);
      }

      toast({ title: "Quiz Saved!", description: "Your quiz has been successfully saved." });
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (error: any) {
      console.error("Failed to save quiz:", error);
      const message = error?.message || (typeof error === "string" ? error : "Unknown error occurred.");
      toast({ title: "Error", description: `Failed to save the quiz: ${message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!quiz && !draftId) return;
    setIsDeleting(true);
    try {
      const id = isEditMode ? quiz.id : draftId!;
      await deleteQuiz(id);
      toast({ title: "Quiz Deleted", description: "The quiz has been permanently deleted." });
      router.push("/dashboard/quizzes");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete quiz:", error);
      toast({ title: "Error", description: "Failed to delete the quiz. Please try again.", variant: "destructive" });
      setIsDeleting(false);
    }
  };

  /* ---------------------------- Drag & Drop handlers ------------------------ */

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions((prev) => {
      const oldIndex = prev.findIndex((q) => q.id === active.id);
      const newIndex = prev.findIndex((q) => q.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
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
                <Input value={opt} onChange={(e) => handleOptionChange(q.id, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} />
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
              const checked = Array.isArray(q.answer) ? (q.answer as string[]).includes(opt) : false;
              return (
                <div key={oIndex} className="flex items-center gap-2">
                  <Checkbox id={`${q.id}-${oIndex}`} onCheckedChange={() => handleCorrectAnswerChange(q.id, oIndex, opt)} checked={checked} />
                  <Input value={opt} onChange={(e) => handleOptionChange(q.id, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} />
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

  const isArchived = (quiz as any)?.status === "Archived";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title / Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="quiz-title">Quiz Title</Label>
          {isEditMode && isArchived && (
            <span className="text-xs px-2 py-0.5 rounded-full border text-amber-700 border-amber-300 bg-amber-50">
              Archived
            </span>
          )}
        </div>
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
        <Input id="quiz-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief summary of the quiz content" />
      </div>

      {/* Autosave indicator */}
      <div className="flex justify-end text-xs text-muted-foreground">
        {autosavePending ? (
          <span className="inline-flex items-center">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving draft…
          </span>
        ) : lastSavedAt ? (
          <span>Draft saved at {lastSavedAt.toLocaleTimeString()}</span>
        ) : null}
      </div>

      <Separator />

      {/* Settings */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="text-lg font-medium">Quiz Settings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="time-limit">Time Limit (minutes)</Label>
            <Input id="time-limit" type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} placeholder="e.g., 30" />
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

        {/* Grade scale (only 100% or 900 pts) */}
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="grade-scale">Grade Scale</Label>
          <Select
            value={scoring.mode}
            onValueChange={(v) => setScoring({ mode: v as ScoreMode })}
          >
            <SelectTrigger id="grade-scale">
              <SelectValue placeholder="Choose grade scale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">100% (standard)</SelectItem>
              <SelectItem value="points900">900 points (CompTIA)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose how final scores are displayed: as a percentage out of 100, or as points out of 900 (CompTIA-style).
          </p>
        </div>
      </div>

      <Separator />

      {/* Bulk paste */}
      <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label htmlFor="bulk-paste">Bulk Paste Questions</Label>
          {isImporting && (
            <span className="inline-flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Parsing…
            </span>
          )}
        </div>
        <Textarea id="bulk-paste" placeholder="Paste multiple questions (each ending with Answer: ...)." rows={4} onPaste={handleBulkPaste} disabled={isImporting} />
        <p className="text-xs text-muted-foreground">
          Use A./B./C. or 1./2./3. labels. Mark multiple correct with glued letters (CD) or commas (A,C). “(Choose N)” forces checkboxes.
        </p>
      </div>

      <Separator />

      {/* Questions (drag & drop) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {questions.map((q, qIndex) => (
            <SortableQuestionCard key={q.id} q={q} qIndex={qIndex}>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-grow space-y-2">
                    <Label htmlFor={`question-${q.id}`}>Question {qIndex + 1}</Label>
                    <Textarea
                      id={`question-${q.id}`}
                      value={q.question}
                      onChange={(e) => handleQuestionChange(q.id, e.target.value)}
                      onPaste={(e) => handleQuestionPaste(q.id, e)}
                      placeholder={`Paste a single question block here (question + options + Answer: ...)`}
                      rows={3}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Use “A) … / A. … / 1) …”. Mark correct with “*”, “(correct)” or “Answer: A,C”. “(Choose N)” forces checkboxes. Unlimited options supported.
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

                  <div className="flex items-start gap-1 mt-8">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {q.imageUrl ? (
                  <div className="relative h-48 w-full">
                    <Image src={q.imageUrl} alt={`Question ${qIndex + 1} image`} fill style={{ objectFit: "contain" }} className="rounded-md border" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => removeImage(q.id)}>
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
                    <Input id={`image-upload-${q.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(q.id, e)} />
                  </div>
                )}

                <div className="pl-2">
                  <Label className="text-sm text-muted-foreground">Answer Options & Correct Answer</Label>
                  <div className="mt-2">{renderAnswerInput(q)}</div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => insertQuestionAt(qIndex + 1)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Question Below
                  </Button>
                </div>
              </div>
            </SortableQuestionCard>
          ))}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Question
      </Button>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          {(isEditMode || draftId) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="flex-1" disabled={isSaving || isDeleting || isArchiving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. This will permanently delete the quiz and all associated student results.</AlertDialogDescription>
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

          {(isEditMode || draftId) &&
            ((isArchived && (
              <Button type="button" variant="outline" className="flex-1" disabled={isSaving || isDeleting || isArchiving} onClick={handleUnarchive}>
                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
                Unarchive
              </Button>
            )) || (
              <Button type="button" variant="secondary" className="flex-1" disabled={isSaving || isDeleting || isArchiving} onClick={handleArchive}>
                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                Archive
              </Button>
            ))}
        </div>

        <Button type="submit" className="flex-1 sm:flex-initial" disabled={isSaving || isDeleting || isArchiving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Saving..." : isEditMode || draftId ? "Save Changes" : "Save Quiz"}
        </Button>
      </div>
    </form>
  );
}
