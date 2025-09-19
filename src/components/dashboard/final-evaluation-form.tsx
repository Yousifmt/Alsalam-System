// src/components/dashboard/final-evaluation-form.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller, useWatch, type Control, type Path } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  LockKeyhole,
  Brain,
  User,
  MessageSquare,
  Save,
  Loader2,
  CalendarIcon,
  Award,
  Check,
} from "lucide-react";

import type { Student, FinalEvaluation } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/context/loading-context";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { saveFinalEvaluation } from "@/services/final-evaluation-service";

/* ---------------- Public props ---------------- */
export type FinalEvaluationFormProps = {
  student: Student;
  mode?: "create" | "edit";
  initialData?: FinalEvaluation;
  disableRedirect?: boolean;
  onSaved?: (updated: FinalEvaluation) => void | Promise<void>;
};

/* ---------------- Schema ---------------- */
const evaluationCriterionSchema = z.object({
  score: z.coerce.number().min(1).max(5),
  notes: z.string().optional(),
});

const finalEvaluationSchema = z.object({
  courseName: z.string().min(1, "Course name is required"),
  trainerName: z.string().min(1, "Trainer name is required"),
  trainingPeriodStart: z.date(),
  trainingPeriodEnd: z.date(),
  technicalSkills: z.object({
    cybersecurityPrinciples: evaluationCriterionSchema,
    threatTypes: evaluationCriterionSchema,
    protectionTools: evaluationCriterionSchema,
    vulnerabilityAnalysis: evaluationCriterionSchema,
    incidentResponse: evaluationCriterionSchema,
    networkProtocols: evaluationCriterionSchema,
    policyImplementation: evaluationCriterionSchema,
    forensics: evaluationCriterionSchema,
  }),
  analyticalSkills: z.object({
    analyticalThinking: evaluationCriterionSchema,
    problemSolving: evaluationCriterionSchema,
    attentionToDetail: evaluationCriterionSchema,
    decisionMaking: evaluationCriterionSchema,
  }),
  behavioralSkills: z.object({
    discipline: evaluationCriterionSchema,
    respectForRules: evaluationCriterionSchema,
    interaction: evaluationCriterionSchema,
    teamwork: evaluationCriterionSchema,
  }),
  communicationSkills: z.object({
    speakingAndExplanation: evaluationCriterionSchema,
    clarity: evaluationCriterionSchema,
  }),
  trainerNotes: z.string().optional(),
  overallRating: z.enum(["Excellent", "Very Good", "Good", "Acceptable", "Needs Improvement"]),
  finalRecommendation: z.enum([
    "Ready for Security+ exam",
    "Needs review before exam",
    "Re-study recommended",
  ]),
});

type FinalEvaluationFormData = z.infer<typeof finalEvaluationSchema>;

/* ---------------- Criteria ---------------- */
const section1Criteria = [
  { id: "cybersecurityPrinciples", name: "فهم مبادئ الأمن السيبراني" },
  { id: "threatTypes", name: "التعرف على أنواع التهديدات السيبرانية" },
  { id: "protectionTools", name: "التعامل مع أدوات الحماية" },
  { id: "vulnerabilityAnalysis", name: "تحليل الثغرات وتقييم المخاطر" },
  { id: "incidentResponse", name: "استجابة الحوادث وإجراءات الطوارئ" },
  { id: "networkProtocols", name: "فهم الشبكات والبروتوكولات الآمنة" },
  { id: "policyImplementation", name: "تطبيق السياسات الأمنية داخل النظام" },
  { id: "forensics", name: "استخدام أدوات التحقيق والتحليل الجنائي الرقمي" },
] as const;

const section2Criteria = [
  { id: "analyticalThinking", name: "التفكير التحليلي" },
  { id: "problemSolving", name: "حل المشكلات بطريقة منطقية" },
  { id: "attentionToDetail", name: "دقة الملاحظة والانتباه للتفاصيل" },
  { id: "decisionMaking", name: "اتخاذ القرار في مواقف أمنية افتراضية" },
] as const;

const section3Criteria = [
  { id: "discipline", name: "الانضباط والالتزام بالحضور" },
  { id: "respectForRules", name: "احترام القواعد وسلوكيات التدريب" },
  { id: "interaction", name: "التفاعل مع المدرب والزملاء" },
  { id: "teamwork", name: "العمل الجماعي وتحمل المسؤولية" },
] as const;

const section4Criteria = [
  { id: "speakingAndExplanation", name: "مهارات التحدث والشرح أثناء التمارين" },
  { id: "clarity", name: "توصيل المعلومة بوضوح" },
] as const;

const allCriteria = {
  technicalSkills: section1Criteria,
  analyticalSkills: section2Criteria,
  behavioralSkills: section3Criteria,
  communicationSkills: section4Criteria,
} as const;

type TechnicalId = (typeof section1Criteria)[number]["id"];
type AnalyticalId = (typeof section2Criteria)[number]["id"];
type BehavioralId = (typeof section3Criteria)[number]["id"];
type CommunicationId = (typeof section4Criteria)[number]["id"];

type CriterionCorePath =
  | `technicalSkills.${TechnicalId}`
  | `analyticalSkills.${AnalyticalId}`
  | `behavioralSkills.${BehavioralId}`
  | `communicationSkills.${CommunicationId}`;

/* ---------------- Helpers ---------------- */
function isOneOf<T extends readonly string[]>(arr: T, v: string): v is T[number] {
  return (arr as readonly string[]).includes(v);
}

function toPath(id: string): Path<FinalEvaluationFormData> | null {
  const [section, key] = id.split(".") as [string, string];
  if (section === "technicalSkills" && isOneOf(section1Criteria.map(c => c.id) as unknown as readonly string[], key))
    return `technicalSkills.${key}.notes` as Path<FinalEvaluationFormData>;
  if (section === "analyticalSkills" && isOneOf(section2Criteria.map(c => c.id) as unknown as readonly string[], key))
    return `analyticalSkills.${key}.notes` as Path<FinalEvaluationFormData>;
  if (section === "behavioralSkills" && isOneOf(section3Criteria.map(c => c.id) as unknown as readonly string[], key))
    return `behavioralSkills.${key}.notes` as Path<FinalEvaluationFormData>;
  if (section === "communicationSkills" && isOneOf(section4Criteria.map(c => c.id) as unknown as readonly string[], key))
    return `communicationSkills.${key}.notes` as Path<FinalEvaluationFormData>;
  return null;
}

function coerceNote<T extends { score?: number | null; notes?: string | null }>(c: T | undefined) {
  return { score: Number(c?.score ?? 3), notes: c?.notes ?? "" };
}

function normalizeInitialData(d: FinalEvaluation): FinalEvaluationFormData {
  return {
    courseName: d.courseName ?? "Cybersecurity+",
    trainerName: d.trainerName ?? "",
    trainingPeriodStart: new Date(d.trainingPeriodStart),
    trainingPeriodEnd: new Date(d.trainingPeriodEnd),
    technicalSkills: {
      cybersecurityPrinciples: coerceNote(d.technicalSkills?.cybersecurityPrinciples),
      threatTypes: coerceNote(d.technicalSkills?.threatTypes),
      protectionTools: coerceNote(d.technicalSkills?.protectionTools),
      vulnerabilityAnalysis: coerceNote(d.technicalSkills?.vulnerabilityAnalysis),
      incidentResponse: coerceNote(d.technicalSkills?.incidentResponse),
      networkProtocols: coerceNote(d.technicalSkills?.networkProtocols),
      policyImplementation: coerceNote(d.technicalSkills?.policyImplementation),
      forensics: coerceNote(d.technicalSkills?.forensics),
    },
    analyticalSkills: {
      analyticalThinking: coerceNote(d.analyticalSkills?.analyticalThinking),
      problemSolving: coerceNote(d.analyticalSkills?.problemSolving),
      attentionToDetail: coerceNote(d.analyticalSkills?.attentionToDetail),
      decisionMaking: coerceNote(d.analyticalSkills?.decisionMaking),
    },
    behavioralSkills: {
      discipline: coerceNote(d.behavioralSkills?.discipline),
      respectForRules: coerceNote(d.behavioralSkills?.respectForRules),
      interaction: coerceNote(d.behavioralSkills?.interaction),
      teamwork: coerceNote(d.behavioralSkills?.teamwork),
    },
    communicationSkills: {
      speakingAndExplanation: coerceNote(d.communicationSkills?.speakingAndExplanation),
      clarity: coerceNote(d.communicationSkills?.clarity),
    },
    trainerNotes: d.trainerNotes ?? "",
    overallRating: d.overallRating,
    finalRecommendation: d.finalRecommendation,
  };
}

/* ---------------- Arabic labels ---------------- */
const RATINGS = ["Excellent", "Very Good", "Good", "Acceptable", "Needs Improvement"] as const;
type Rating = (typeof RATINGS)[number];
const overallRatingsArabic: Record<Rating, string> = {
  Excellent: "ممتاز",
  "Very Good": "جيد جدًا",
  Good: "جيد",
  Acceptable: "مقبول",
  "Needs Improvement": "يحتاج إلى تحسين",
};

const RECS = ["Ready for Security+ exam", "Needs review before exam", "Re-study recommended"] as const;
type Rec = (typeof RECS)[number];
const finalRecommendationsArabic: Record<Rec, string> = {
  "Ready for Security+ exam": "المتدرب جاهز لتقديم الإمتحان",
  "Needs review before exam": "يحتاج إلى مراجعة قبل دخول الإمتحان",
  "Re-study recommended": "يُنصح بإعادة بعض الأجزاء لتعزيز الفهم",
};

/* ---------------- UI row ---------------- */
function CriterionRow({
  control,
  corePath,
  label,
  onUserNoteChange,
}: {
  control: Control<FinalEvaluationFormData>;
  corePath: CriterionCorePath;
  label: string;
  onUserNoteChange?: (notesPath: string, value: string) => void;
}) {
  const scoreName = `${corePath}.score` as Path<FinalEvaluationFormData>;
  const notesName = `${corePath}.notes` as Path<FinalEvaluationFormData>;

  return (
    <div className="grid grid-cols-12 gap-4 items-start py-4 border-b">
      <div className="col-span-2">
        <h4 className="font-semibold">{label}</h4>
      </div>
      <div className="col-span-5 text-center">
        <Controller
          control={control}
          name={scoreName}
          render={({ field }) => (
            <RadioGroup
              dir="ltr"
              className="flex justify-around"
              value={String(field.value ?? 3)}
              onValueChange={(v) => field.onChange(Number(v))}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <div key={value} className="flex flex-col items-center space-y-1">
                  <RadioGroupItem value={String(value)} id={`${corePath}-score-${value}`} />
                  <Label htmlFor={`${corePath}-score-${value}`}>{value}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </div>
      <div className="col-span-5">
        <Controller
          control={control}
          name={notesName}
          render={({ field }) => (
            <Textarea
              placeholder="الملاحظات..."
              className="h-20"
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(e) => {
                field.onChange(e.target.value);
                onUserNoteChange?.(notesName, e.target.value);
              }}
            />
          )}
        />
      </div>
    </div>
  );
}

/* ---------------- Component ---------------- */
export function FinalEvaluationForm({
  student,
  mode = "create",
  initialData,
  disableRedirect,
  onSaved,
}: FinalEvaluationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setIsLoading } = useLoading();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Defaults (memoized)
  const defaultValues: FinalEvaluationFormData = useMemo(
    () =>
      initialData
        ? normalizeInitialData(initialData)
        : {
            courseName: "Cybersecurity+",
            trainerName: "",
            trainingPeriodStart: new Date(),
            trainingPeriodEnd: new Date(),
            technicalSkills: section1Criteria.reduce(
              (acc, c) => ({ ...acc, [c.id]: { score: 3, notes: "" } }),
              {} as FinalEvaluationFormData["technicalSkills"]
            ),
            analyticalSkills: section2Criteria.reduce(
              (acc, c) => ({ ...acc, [c.id]: { score: 3, notes: "" } }),
              {} as FinalEvaluationFormData["analyticalSkills"]
            ),
            behavioralSkills: section3Criteria.reduce(
              (acc, c) => ({ ...acc, [c.id]: { score: 3, notes: "" } }),
              {} as FinalEvaluationFormData["behavioralSkills"]
            ),
            communicationSkills: section4Criteria.reduce(
              (acc, c) => ({ ...acc, [c.id]: { score: 3, notes: "" } }),
              {} as FinalEvaluationFormData["communicationSkills"]
            ),
            trainerNotes: "",
            overallRating: "Good",
            finalRecommendation: "Needs review before exam",
          },
    [initialData]
  );

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FinalEvaluationFormData>({
    resolver: zodResolver(finalEvaluationSchema),
    defaultValues,
  });

  // reset when defaults change (يحل مشكلة تحديث الحقول عند فتح تعديل جديد)
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Ownership trackers
  const userEditedNotes = useRef<Set<string>>(new Set());
  const aiOwnedNotes = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<number | null>(null);
  const mountedRef = useRef(false);

  // Watch scores + overall to trigger AI
  const SCORE_PATHS = [
    ...section1Criteria.map((c) => `technicalSkills.${c.id}.score` as const),
    ...section2Criteria.map((c) => `analyticalSkills.${c.id}.score` as const),
    ...section3Criteria.map((c) => `behavioralSkills.${c.id}.score` as const),
    ...section4Criteria.map((c) => `communicationSkills.${c.id}.score` as const),
  ] as const;

  const watchedScores = useWatch({ control, name: SCORE_PATHS });
  const watchedOverall = useWatch({ control, name: "overallRating" });

  // Generate (or refresh) notes via API
  const runGenerateNotes = async () => {
    setIsGeneratingNotes(true);
    try {
      const current = getValues();
      const criteriaForAI = (Object.entries(allCriteria) as Array<
        [keyof typeof allCriteria, readonly { id: string; name: string }[]]
      >).flatMap(([sectionKey, criteria]) =>
        criteria.map((criterion) => ({
          id: `${sectionKey}.${criterion.id}`,
          name: criterion.name,
          // @ts-expect-error schema-indexed access
          score: Number(current[sectionKey][criterion.id].score),
        }))
      );

      const res = await fetch("/api/ai/generate-evaluation-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ criteria: criteriaForAI }),
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Unexpected response (${res.status} ${res.statusText}). Body: ${text.slice(0, 300)}`);
      }

      const data: { ok: boolean; result?: { notes: { id: string; note: string }[] }; error?: string } =
        await res.json();

      if (!res.ok || !data.ok || !data.result?.notes) throw new Error(data?.error || `HTTP ${res.status}`);

      data.result.notes.forEach(({ id, note }) => {
        const path = toPath(id);
        if (!path) return;
        if (userEditedNotes.current.has(path)) return;

        const prev = (getValues(path) as string | undefined) ?? "";
        if (aiOwnedNotes.current.has(path) || prev.trim() === "") {
          if (prev !== note) setValue(path, note, { shouldDirty: true });
          aiOwnedNotes.current.add(path);
        }
      });
    } catch (error: any) {
      console.error("Failed to generate notes:", error);
      toast({ title: "Error", description: String(error?.message ?? error), variant: "destructive" });
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const scheduleGenerateNotes = () => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(runGenerateNotes, 500);
  };

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    scheduleGenerateNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedScores), watchedOverall]);

  const handleUserNoteChange = (path: string, val: string) => {
    if (val.trim() === "") {
      userEditedNotes.current.delete(path);
    } else {
      userEditedNotes.current.add(path);
      aiOwnedNotes.current.delete(path);
    }
  };

  // ---- Save ----
  const onSaveSubmit = async (data: FinalEvaluationFormData) => {
    setIsSubmitting(true);

    const { trainingPeriodStart, trainingPeriodEnd, ...rest } = data;

    const evaluationData = {
      ...rest,
      type: "final" as const,
      studentId: student.uid,
      studentName: student.name,
      date: mode === "edit" && initialData?.date ? initialData.date : Date.now(),
      trainingPeriodStart: trainingPeriodStart.getTime(),
      trainingPeriodEnd: trainingPeriodEnd.getTime(),
    };

    try {
      const saved = await saveFinalEvaluation(
        mode === "edit" && initialData?.id
          ? ({ id: initialData.id, ...evaluationData } as any)
          : (evaluationData as any)
      );

      toast({
        title: "Evaluation Saved",
        description:
          mode === "edit"
            ? `تم تحديث التقييم النهائي لـ ${student.name} بنجاح.`
            : `The final evaluation for ${student.name} has been saved successfully.`,
      });

      await onSaved?.(saved);

      if (!disableRedirect) {
        setIsLoading?.(true);
        router.push(`/dashboard/students/${student.uid}/evaluations`);
      }
    } catch (error) {
      console.error("Failed to save final evaluation:", error);
      toast({
        title: "Error",
        description: "Failed to save the final evaluation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSaveSubmit)} dir="rtl">
      <Card>
        <CardHeader>
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold font-headline text-primary">
              🛡️ نموذج تقييم نهائي للمتدربين – برنامج الأمن السيبراني
              {isGeneratingNotes && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground" />}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 items-center text-sm border-t border-b py-4">
            <div>
              <Label className="font-semibold">اسم الدورة:</Label>
              <Controller name="courseName" control={control} render={({ field }) => <Input {...field} />} />
              {errors.courseName && <p className="text-red-500 text-xs">{errors.courseName.message}</p>}
            </div>
            <div>
              <Label className="font-semibold">اسم المدرب:</Label>
              <Controller name="trainerName" control={control} render={({ field }) => <Input {...field} />} />
              {errors.trainerName && <p className="text-red-500 text-xs">{errors.trainerName.message}</p>}
            </div>
            <div>
              <Label className="font-semibold">اسم المتدرب:</Label>
              <p>{student.name}</p>
            </div>
            <div>
              <Label className="font-semibold">الفترة التدريبية:</Label>
              <div className="flex items-center gap-2">
                <Controller
                  name="trainingPeriodStart"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>من</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                <span>-</span>
                <Controller
                  name="trainingPeriodEnd"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>الى</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <LockKeyhole /> أولًا: المهارات الفنية
            </h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-2">المحور</div>
              <div className="col-span-5 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section1Criteria.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                corePath={`technicalSkills.${c.id}`}
                label={c.name}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Brain /> ثانيًا: المهارات الذهنية والتحليلية
            </h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-2">المحور</div>
              <div className="col-span-5 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section2Criteria.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                corePath={`analyticalSkills.${c.id}`}
                label={c.name}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <User /> ثالثًا: المهارات السلوكية
            </h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-2">المحور</div>
              <div className="col-span-5 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section3Criteria.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                corePath={`behavioralSkills.${c.id}`}
                label={c.name}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <MessageSquare /> رابعًا: المهارات التواصلية والعرض
            </h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-2">المحور</div>
              <div className="col-span-5 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section4Criteria.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                corePath={`communicationSkills.${c.id}`}
                label={c.name}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold">💬 ملاحظات المدرب:</h3>
            <Controller
              name="trainerNotes"
              control={control}
              render={({ field }) => (
                <Textarea
                  className="h-32"
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Award /> التقدير العام:
            </h3>
            <Controller
              control={control}
              name="overallRating"
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-x-6 gap-y-2">
                  {RATINGS.map((rating) => (
                    <div key={rating} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={rating} id={`rating-${rating}`} />
                      <Label htmlFor={`rating-${rating}`} className="pr-2">
                        {overallRatingsArabic[rating]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Check /> رأي المدرب النهائي:
            </h3>
            <Controller
              control={control}
              name="finalRecommendation"
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                  {RECS.map((rec) => (
                    <div key={rec} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={rec} id={`rec-${rec}`} />
                      <Label htmlFor={`rec-${rec}`} className="pr-2">
                        {finalRecommendationsArabic[rec]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </section>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={isSubmitting || isGeneratingNotes}
            className="w-full"
            aria-busy={isSubmitting || isGeneratingNotes}
          >
            {(isSubmitting || isGeneratingNotes) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSubmitting
              ? "جاري الحفظ..."
              : isGeneratingNotes
              ? "جاري توليد الملاحظات..."
              : mode === "edit"
              ? "تحديث التقييم النهائي"
              : "حفظ التقييم النهائي"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
