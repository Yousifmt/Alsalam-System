"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { useForm, Controller, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrainCircuit, Briefcase, LockKeyhole, UserCheck, Save, Loader2, CalendarIcon } from "lucide-react";
import type { Student, Evaluation } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { saveEvaluation } from "@/services/evaluation-service";
import { useLoading } from "@/context/loading-context";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import { Calendar } from "../ui/calendar";

/* ---------- Public props ---------- */
export type EvaluationFormProps = {
  student: Student;
  mode?: "create" | "edit";
  initialData?: Evaluation;
  disableRedirect?: boolean;
  onSaved?: (updated: Evaluation) => void | Promise<void>;
};


/* ---------- Keys ---------- */
const personalKeys = [
  "professionalCommitment",
  "behavioralMaturity",
  "communicationSkills",
  "initiativeAndResponsibility",
] as const;

const classroomKeys = ["participationQuality", "dialogueManagement", "teamwork", "cyberRulesCommitment"] as const;

const technicalKeys = [
  "contentComprehension",
  "focusAndAttention",
  "activityParticipation",
  "askingQuestions",
  "summarizationAbility",
  "deviceUsage",
] as const;

function isOneOf<T extends readonly string[]>(arr: T, v: string): v is T[number] {
  return (arr as readonly string[]).includes(v);
}

/* ---------- Schema ---------- */
const evaluationCriterionSchema = z.object({
  score: z.coerce.number().min(1).max(5),
  notes: z.string().optional(),
});

const evaluationSchema = z.object({
  date: z.date(),
  trainingTopic: z.string().min(1, "Training topic is required"),
  personalSkills: z.object({
    professionalCommitment: evaluationCriterionSchema,
    behavioralMaturity: evaluationCriterionSchema,
    communicationSkills: evaluationCriterionSchema,
    initiativeAndResponsibility: evaluationCriterionSchema,
  }),
  classroomSkills: z.object({
    participationQuality: evaluationCriterionSchema,
    dialogueManagement: evaluationCriterionSchema,
    teamwork: evaluationCriterionSchema,
    cyberRulesCommitment: evaluationCriterionSchema,
  }),
  technicalSkills: z.object({
    contentComprehension: evaluationCriterionSchema,
    focusAndAttention: evaluationCriterionSchema,
    activityParticipation: evaluationCriterionSchema,
    askingQuestions: evaluationCriterionSchema,
    summarizationAbility: evaluationCriterionSchema,
    deviceUsage: evaluationCriterionSchema,
  }),
  overallRating: z.enum(["Excellent", "Very Good", "Good", "Acceptable", "Needs Improvement"]),
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

/* ---------- Criteria lists ---------- */
const section1Criteria = [
  {
    id: "professionalCommitment",
    name: "الالتزام المهني",
    desc: "الالتزام الكامل بالمواعيد والتعليمات والمعايير التنظيمية",
  },
  {
    id: "behavioralMaturity",
    name: "النضج السلوكي",
    desc: "إظهار سلوك مهني، وتقبل الملاحظات، والتعامل الإيجابي مع المواقف",
  },
  { id: "communicationSkills", name: "مهارات التواصل", desc: "القدرة على التعبير بوضوح وفعالية، شفهيًا وكتابيًا" },
  { id: "initiativeAndResponsibility", name: "المبادرة والمسؤولية", desc: "التفاعل الاستباقي وتحمل مسؤولية التعلم الذاتي" },
];

const section2Criteria = [
  { id: "participationQuality", name: "جودة المشاركة", desc: "المساهمة الفاعلة في الحوارات التقنية والتحليل الجماعي" },
  { id: "dialogueManagement", name: "إدارة الحوار", desc: "استخدام مهارات التفكير النقدي أثناء المناقشة" },
  { id: "teamwork", name: "التعاون ضمن الفريق", desc: "التفاعل بإيجابية ضمن أنشطة الفرق وأداء المهام المشتركة" },
  {
    id: "cyberRulesCommitment",
    name: "الالتزام بقواعد الصف السيبراني",
    desc: "احترام قواعد الخصوصية والضبط الإلكتروني أثناء الأنشطة",
  },
];

const section3Criteria = [
  { id: "contentComprehension", name: "استيعاب محتوى الدرس", desc: "فهم المعلومات التي تم شرحها خلال المحاضرة" },
  { id: "focusAndAttention", name: "التركيز والانتباه", desc: "متابعة الشرح والمشاركة في النقاشات" },
  { id: "activityParticipation", name: "المشاركة في الأنشطة", desc: "التفاعل مع الأسئلة أو التمارين أثناء المحاضرة" },
  { id: "askingQuestions", name: "طرح الأسئلة", desc: "إبداء الاهتمام وطرح أسئلة تدل على الفهم" },
  { id: "summarizationAbility", name: "القدرة على التلخيص", desc: "التعبير عن الفهم من خلال تلخيص النقاط الأساسية" },
  { id: "deviceUsage", name: "استخدام الجهاز", desc: "استخدام الحاسوب أو المنصة الإلكترونية بشكل جيد أثناء التدريب" },
];

const allCriteria = {
  personalSkills: section1Criteria,
  classroomSkills: section2Criteria,
  technicalSkills: section3Criteria,
} as const;

const overallRatings: Evaluation["overallRating"][] = [
  "Excellent",
  "Very Good",
  "Good",
  "Acceptable",
  "Needs Improvement",
];

const overallRatingsArabic: Record<Evaluation["overallRating"], string> = {
  Excellent: "ممتاز",
  "Very Good": "جيد جدًا",
  Good: "جيد",
  Acceptable: "مقبول",
  "Needs Improvement": "يحتاج إلى تحسين",
};

/* ---------- Helpers ---------- */
function toPath(id: string): Path<EvaluationFormData> | null {
  const [section, key] = id.split(".") as [string, string];
  if (section === "personalSkills" && isOneOf(personalKeys, key)) return `personalSkills.${key}.notes` as any;
  if (section === "classroomSkills" && isOneOf(classroomKeys, key)) return `classroomSkills.${key}.notes` as any;
  if (section === "technicalSkills" && isOneOf(technicalKeys, key)) return `technicalSkills.${key}.notes` as any;
  return null;
}
type GenerateNotesAPIResponse = {
  ok: boolean;
  result?: { notes: { id: string; note: string }[] };
  error?: string;
};

const CriterionRow = ({
  control,
  name,
  label,
  description,
  onUserNoteChange,
}: {
  control: any;
  name: string;
  label: string;
  description: string;
  onUserNoteChange?: (notesPath: string, value: string) => void;
}) => (
  <div className="grid grid-cols-12 gap-4 items-start py-4 border-b">
    <div className="col-span-3">
      <h4 className="font-semibold">{label}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="col-span-4">
      <Controller
        control={control}
        name={`${name}.score`}
        render={({ field }) => (
          <RadioGroup
            onValueChange={(v) => field.onChange(Number(v))}
            value={String(field.value ?? 3)}
            className="flex justify-around"
            dir="ltr"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <div key={value} className="flex flex-col items-center space-y-1">
                <RadioGroupItem value={String(value)} id={`${name}-score-${value}`} />
                <Label htmlFor={`${name}-score-${value}`}>{value}</Label>
              </div>
            ))}
          </RadioGroup>
        )}
      />
    </div>
    <div className="col-span-5">
      <Controller
        control={control}
        name={`${name}.notes`}
        render={({ field }) => (
          <Textarea
            placeholder="الملاحظات..."
            className="h-20"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(e) => {
              field.onChange(e.target.value);
              const path = `${name}.notes`;
              if (onUserNoteChange) onUserNoteChange(path, e.target.value);
            }}
          />
        )}
      />
    </div>
  </div>
);

/* ---------- Main ---------- */
export function EvaluationForm({
  student,
  mode = "create",
  initialData,
  disableRedirect,
  onSaved,
}: EvaluationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setIsLoading } = useLoading();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // normalize helper (avoid null notes)
  const normCrit = (c?: { score?: number; notes?: string | null }) => ({
    score: c?.score ?? 3,
    notes: c?.notes ?? "",
  });

  const defaults: EvaluationFormData = useMemo(
    () =>
      initialData
        ? {
            date: new Date(initialData.date),
            trainingTopic: initialData.trainingTopic ?? "",
            personalSkills: {
              professionalCommitment: normCrit(initialData.personalSkills?.professionalCommitment),
              behavioralMaturity: normCrit(initialData.personalSkills?.behavioralMaturity),
              communicationSkills: normCrit(initialData.personalSkills?.communicationSkills),
              initiativeAndResponsibility: normCrit(initialData.personalSkills?.initiativeAndResponsibility),
            },
            classroomSkills: {
              participationQuality: normCrit(initialData.classroomSkills?.participationQuality),
              dialogueManagement: normCrit(initialData.classroomSkills?.dialogueManagement),
              teamwork: normCrit(initialData.classroomSkills?.teamwork),
              cyberRulesCommitment: normCrit(initialData.classroomSkills?.cyberRulesCommitment),
            },
            technicalSkills: {
              contentComprehension: normCrit(initialData.technicalSkills?.contentComprehension),
              focusAndAttention: normCrit(initialData.technicalSkills?.focusAndAttention),
              activityParticipation: normCrit(initialData.technicalSkills?.activityParticipation),
              askingQuestions: normCrit(initialData.technicalSkills?.askingQuestions),
              summarizationAbility: normCrit(initialData.technicalSkills?.summarizationAbility),
              deviceUsage: normCrit(initialData.technicalSkills?.deviceUsage),
            },
            overallRating: initialData.overallRating,
          }
        : {
            date: new Date(),
            trainingTopic: "",
            personalSkills: {
              professionalCommitment: { score: 3, notes: "" },
              behavioralMaturity: { score: 3, notes: "" },
              communicationSkills: { score: 3, notes: "" },
              initiativeAndResponsibility: { score: 3, notes: "" },
            },
            classroomSkills: {
              participationQuality: { score: 3, notes: "" },
              dialogueManagement: { score: 3, notes: "" },
              teamwork: { score: 3, notes: "" },
              cyberRulesCommitment: { score: 3, notes: "" },
            },
            technicalSkills: {
              contentComprehension: { score: 3, notes: "" },
              focusAndAttention: { score: 3, notes: "" },
              activityParticipation: { score: 3, notes: "" },
              askingQuestions: { score: 3, notes: "" },
              summarizationAbility: { score: 3, notes: "" },
              deviceUsage: { score: 3, notes: "" },
            },
            overallRating: "Good",
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
  } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: defaults,
  });

  // reset when initialData changes (important for Title/Topic)
  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  // Track ownership/edits
  const userEditedNotes = useRef<Set<string>>(new Set());
  const aiOwnedNotes = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<number | null>(null);
  const mountedRef = useRef(false);

  // Watch scores + overall to trigger AI
  const SCORE_PATHS = [
    ...personalKeys.map((k) => `personalSkills.${k}.score` as const),
    ...classroomKeys.map((k) => `classroomSkills.${k}.score` as const),
    ...technicalKeys.map((k) => `technicalSkills.${k}.score` as const),
  ] as const;
  const watchedScores = useWatch({ control, name: SCORE_PATHS });
  const watchedOverall = useWatch({ control, name: "overallRating" });

  const runGenerateNotes = async () => {
    setIsGeneratingNotes(true);
    try {
      const current = getValues();
      const criteriaForAI = Object.entries(allCriteria).flatMap(([sectionKey, criteria]) =>
        criteria.map((criterion) => ({
          id: `${sectionKey}.${criterion.id}`,
          name: criterion.name,
          // @ts-ignore index-safe at runtime
          score: Number(current[sectionKey][criterion.id].score),
        }))
      );

      const res = await fetch("/api/ai/generate-evaluation-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ criteria: criteriaForAI }),
      });

      const data: GenerateNotesAPIResponse = await res.json();
      if (!res.ok || !data.ok || !data.result?.notes) throw new Error(data?.error || `HTTP ${res.status}`);

      data.result.notes.forEach(({ id, note }) => {
        const notesPath = toPath(id);
        if (!notesPath) return;
        if (userEditedNotes.current.has(notesPath)) return;

        const prev = (getValues(notesPath) as string | undefined) ?? "";
        if (aiOwnedNotes.current.has(notesPath) || prev.trim() === "") {
          if (prev !== note) setValue(notesPath, note, { shouldDirty: true });
          aiOwnedNotes.current.add(notesPath);
        }
      });
    } catch (err: any) {
      console.error("Failed to generate notes:", err);
      toast({ title: "Error", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const scheduleGenerateNotes = () => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      runGenerateNotes();
    }, 500);
  };

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
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

  const onSaveSubmit = async (data: EvaluationFormData) => {
  setIsSubmitting(true);
  try {
    const payload: Partial<Pick<Evaluation, "id">> & Omit<Evaluation, "id"> = {
      ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
      type: "daily",
      studentId: student.uid,
      studentName: student.name,
      date: data.date.getTime(),
      trainingTopic: data.trainingTopic,
      personalSkills: data.personalSkills,
      classroomSkills: data.classroomSkills,
      technicalSkills: data.technicalSkills,
      overallRating: data.overallRating,
    };

    const saved = await saveEvaluation(payload as any); // returns the saved doc (with id)
    toast({ title: "Evaluation Saved", description: "تم حفظ التقييم بنجاح." });

    // notify parent (dialog case)
    await onSaved?.(saved);

    // ✅ navigate back to the student's evaluations list (unless disabled in dialog mode)
    if (!disableRedirect) {
      // Optional: show global loader while navigating
      setIsLoading?.(true);
      router.push(`/dashboard/students/${student.uid}/evaluations`);
    }
  } catch (e) {
    toast({ title: "Error", description: "تعذر الحفظ.", variant: "destructive" });
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
              🛡️ نموذج تقييم يومي للمتدربين – برنامج الأمن السيبراني
              {isGeneratingNotes && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground" />}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 items-center text-sm">
            <span>
              <span className="font-semibold">اسم المتدرب:</span> {student.name}
            </span>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">التاريخ:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-[240px] justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            />
          </div>
          <div className="space-y-1 mt-4">
            <Label htmlFor="training-topic" className="font-semibold text-base">
              المحور التدريبي لليوم:
            </Label>
            <Controller
              name="trainingTopic"
              control={control}
              render={({ field }) => (
                <Input id="training-topic" {...field} value={field.value ?? ""} placeholder="e.g., Comparing Threat Types" className="text-base" />
              )}
            />
            {errors.trainingTopic && <p className="text-red-500 text-xs">{errors.trainingTopic.message}</p>}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <BrainCircuit /> القسم الأول: المهارات الشخصية والسلوكية
            </h3>
            <p className="text-sm text-muted-foreground mb-4">يقيس هذا القسم مستوى الانضباط المهني والسمات السلوكية ذات الصلة بالبيئة التدريبية المتقدمة.</p>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section1Criteria.map((c) => (
              <CriterionRow key={c.id} control={control} name={`personalSkills.${c.id}`} label={c.name} description={c.desc} onUserNoteChange={handleUserNoteChange} />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Briefcase /> القسم الثاني: مهارات التفاعل داخل البيئة الصفية
            </h3>
            <p className="text-sm text-muted-foreground mb-4">يركز على التفاعل المعرفي والسلوكي ضمن المحيط التعليمي.</p>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section2Criteria.map((c) => (
              <CriterionRow key={c.id} control={control} name={`classroomSkills.${c.id}`} label={c.name} description={c.desc} onUserNoteChange={handleUserNoteChange} />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <LockKeyhole /> القسم الثالث: المهارات العلمية والتقنية (Cybersecurity)
            </h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section3Criteria.map((c) => (
              <CriterionRow key={c.id} control={control} name={`technicalSkills.${c.id}`} label={c.name} description={c.desc} onUserNoteChange={handleUserNoteChange} />
            ))}
          </section>

          <Separator />
          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <UserCheck /> تقدير اليوم (حسب التقدير الأكاديمي)
            </h3>
            <Controller
              control={control}
              name="overallRating"
              render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-x-6 gap-y-2">
                  {overallRatings.map((rating) => (
                    <div key={rating} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={rating} id={`rating-${rating}`} />
                      <Label htmlFor={`rating-${rating}`}>{overallRatingsArabic[rating]}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </section>
        </CardContent>

        <CardFooter className="flex-col gap-2 items-stretch">
          <Button type="submit" disabled={isSubmitting || isGeneratingNotes} className="w-full" aria-busy={isSubmitting || isGeneratingNotes}>
            {(isSubmitting || isGeneratingNotes) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSubmitting ? "جاري الحفظ..." : isGeneratingNotes ? "جاري توليد الملاحظات..." : mode === "edit" ? "تحديث التقييم" : "حفظ التقييم"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
