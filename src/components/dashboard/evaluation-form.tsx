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

import { BrainCircuit, Briefcase, LockKeyhole, UserCheck, Save, Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import type { Student, Evaluation } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLoading } from "@/context/loading-context";
import { saveEvaluation } from "@/services/evaluation-service";

/* ---------------- Types & props ---------------- */
export type EvaluationFormProps = {
  student: Student;
  mode?: "create" | "edit";
  initialData?: Evaluation;
  disableRedirect?: boolean;
  onSaved?: (updated: Evaluation) => void | Promise<void>;
};

/* ---------------- Schema ---------------- */
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

/* ---------------- Criteria lists ---------------- */
const section1 = [
  { id: "professionalCommitment", name: "الالتزام المهني", desc: "الالتزام الكامل بالمواعيد والتعليمات والمعايير التنظيمية" },
  { id: "behavioralMaturity", name: "النضج السلوكي", desc: "إظهار سلوك مهني، وتقبل الملاحظات، والتعامل الإيجابي مع المواقف" },
  { id: "communicationSkills", name: "مهارات التواصل", desc: "القدرة على التعبير بوضوح وفعالية، شفهيًا وكتابيًا" },
  { id: "initiativeAndResponsibility", name: "المبادرة والمسؤولية", desc: "التفاعل الاستباقي وتحمل مسؤولية التعلم الذاتي" },
] as const;

const section2 = [
  { id: "participationQuality", name: "جودة المشاركة", desc: "المساهمة الفاعلة في الحوارات التقنية والتحليل الجماعي" },
  { id: "dialogueManagement", name: "إدارة الحوار", desc: "استخدام مهارات التفكير النقدي أثناء المناقشة" },
  { id: "teamwork", name: "التعاون ضمن الفريق", desc: "التفاعل بإيجابية ضمن أنشطة الفرق وأداء المهام المشتركة" },
  { id: "cyberRulesCommitment", name: "الالتزام بقواعد الصف السيبراني", desc: "احترام قواعد الخصوصية والضبط الإلكتروني أثناء الأنشطة" },
] as const;

const section3 = [
  { id: "contentComprehension", name: "استيعاب محتوى الدرس", desc: "فهم المعلومات التي تم شرحها خلال المحاضرة" },
  { id: "focusAndAttention", name: "التركيز والانتباه", desc: "متابعة الشرح والمشاركة في النقاشات" },
  { id: "activityParticipation", name: "المشاركة في الأنشطة", desc: "التفاعل مع الأسئلة أو التمارين أثناء المحاضرة" },
  { id: "askingQuestions", name: "طرح الأسئلة", desc: "إبداء الاهتمام وطرح أسئلة تدل على الفهم" },
  { id: "summarizationAbility", name: "القدرة على التلخيص", desc: "التعبير عن الفهم من خلال تلخيص النقاط الأساسية" },
  { id: "deviceUsage", name: "استخدام الجهاز", desc: "استخدام الحاسوب أو المنصة الإلكترونية بشكل جيد أثناء التدريب" },
] as const;

const overallRatings = ["Excellent", "Very Good", "Good", "Acceptable", "Needs Improvement"] as const;
const overallRatingsArabic: Record<(typeof overallRatings)[number], string> = {
  Excellent: "ممتاز",
  "Very Good": "جيد جدًا",
  Good: "جيد",
  Acceptable: "مقبول",
  "Needs Improvement": "يحتاج إلى تحسين",
};

/* ---------------- Helpers ---------------- */
type AnyKey = typeof section1[number]["id"] | typeof section2[number]["id"] | typeof section3[number]["id"];
const personalKeys = section1.map((c) => c.id) as readonly AnyKey[];
const classroomKeys = section2.map((c) => c.id) as readonly AnyKey[];
const technicalKeys = section3.map((c) => c.id) as readonly AnyKey[];

function isOneOf<T extends readonly string[]>(arr: T, v: string): v is T[number] {
  return (arr as readonly string[]).includes(v);
}

function toPath(id: string): Path<EvaluationFormData> | null {
  const [section, key] = id.split(".") as [string, string];
  if (section === "personalSkills" && isOneOf(personalKeys, key)) return `personalSkills.${key}.notes` as Path<EvaluationFormData>;
  if (section === "classroomSkills" && isOneOf(classroomKeys, key)) return `classroomSkills.${key}.notes` as Path<EvaluationFormData>;
  if (section === "technicalSkills" && isOneOf(technicalKeys, key)) return `technicalSkills.${key}.notes` as Path<EvaluationFormData>;
  return null;
}

type GenerateNotesAPIResponse = {
  ok: boolean;
  result?: { notes: { id: string; note: string }[] };
  error?: string;
};

/* ---------------- Row ---------------- */
function CriterionRow({
  control,
  core,
  label,
  desc,
  onUserNoteChange,
}: {
  control: Control<EvaluationFormData>;
  core: `personalSkills.${typeof section1[number]["id"]}` | `classroomSkills.${typeof section2[number]["id"]}` | `technicalSkills.${typeof section3[number]["id"]}`;
  label: string;
  desc: string;
  onUserNoteChange?: (notesPath: string, value: string) => void;
}) {
  const scoreName = `${core}.score` as Path<EvaluationFormData>;
  const notesName = `${core}.notes` as Path<EvaluationFormData>;
  return (
    <div className="grid grid-cols-12 gap-4 items-start py-4 border-b">
      <div className="col-span-3">
        <h4 className="font-semibold">{label}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="col-span-4">
        <Controller
          control={control}
          name={scoreName}
          render={({ field }) => (
            <RadioGroup dir="ltr" className="flex justify-around" value={String(field.value ?? 3)} onValueChange={(v) => field.onChange(Number(v))}>
              {[1, 2, 3, 4, 5].map((v) => (
                <div key={v} className="flex flex-col items-center space-y-1">
                  <RadioGroupItem value={String(v)} id={`${core}-score-${v}`} />
                  <Label htmlFor={`${core}-score-${v}`}>{v}</Label>
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
export function EvaluationForm({ student, mode = "create", initialData, disableRedirect, onSaved }: EvaluationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setIsLoading } = useLoading();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // default values (normalize nullable notes)
  const defaults: EvaluationFormData = useMemo(() => {
    const norm = (c?: { score?: number | null; notes?: string | null }) => ({ score: Number(c?.score ?? 3), notes: c?.notes ?? "" });
    if (initialData) {
      return {
        date: new Date(initialData.date),
        trainingTopic: initialData.trainingTopic ?? "",
        personalSkills: {
          professionalCommitment: norm(initialData.personalSkills?.professionalCommitment),
          behavioralMaturity: norm(initialData.personalSkills?.behavioralMaturity),
          communicationSkills: norm(initialData.personalSkills?.communicationSkills),
          initiativeAndResponsibility: norm(initialData.personalSkills?.initiativeAndResponsibility),
        },
        classroomSkills: {
          participationQuality: norm(initialData.classroomSkills?.participationQuality),
          dialogueManagement: norm(initialData.classroomSkills?.dialogueManagement),
          teamwork: norm(initialData.classroomSkills?.teamwork),
          cyberRulesCommitment: norm(initialData.classroomSkills?.cyberRulesCommitment),
        },
        technicalSkills: {
          contentComprehension: norm(initialData.technicalSkills?.contentComprehension),
          focusAndAttention: norm(initialData.technicalSkills?.focusAndAttention),
          activityParticipation: norm(initialData.technicalSkills?.activityParticipation),
          askingQuestions: norm(initialData.technicalSkills?.askingQuestions),
          summarizationAbility: norm(initialData.technicalSkills?.summarizationAbility),
          deviceUsage: norm(initialData.technicalSkills?.deviceUsage),
        },
        overallRating: initialData.overallRating,
      };
    }
    return {
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
    };
  }, [initialData]);

  const { control, handleSubmit, setValue, getValues, reset, formState: { errors } } = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: defaults,
  });

  // reset when initialData/defaults change
  useEffect(() => { reset(defaults); }, [defaults, reset]);

  // AI notes ownership
  const userEditedNotes = useRef<Set<string>>(new Set());
  const aiOwnedNotes = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const SCORE_PATHS = [
    ...section1.map((k) => `personalSkills.${k.id}.score` as const),
    ...section2.map((k) => `classroomSkills.${k.id}.score` as const),
    ...section3.map((k) => `technicalSkills.${k.id}.score` as const),
  ] as const;
  const watchedScores = useWatch({ control, name: SCORE_PATHS });
  const watchedOverall = useWatch({ control, name: "overallRating" });

  async function runGenerateNotes() {
    setIsGeneratingNotes(true);
    try {
      const current = getValues();
      const forAI = [
        ...section1.map((c) => ({ id: `personalSkills.${c.id}`, name: c.name, score: Number(current.personalSkills[c.id].score) })),
        ...section2.map((c) => ({ id: `classroomSkills.${c.id}`, name: c.name, score: Number(current.classroomSkills[c.id].score) })),
        ...section3.map((c) => ({ id: `technicalSkills.${c.id}`, name: c.name, score: Number(current.technicalSkills[c.id].score) })),
      ];
      const res = await fetch("/api/ai/generate-evaluation-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ criteria: forAI }),
      });
      const data: GenerateNotesAPIResponse = await res.json();
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
    } catch (e: any) {
      console.error("generate notes failed:", e);
      toast({ title: "Error", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setIsGeneratingNotes(false);
    }
  }

  function scheduleGenerateNotes() {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(runGenerateNotes, 500);
  }

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    scheduleGenerateNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedScores), watchedOverall]);

  const handleUserNoteChange = (path: string, val: string) => {
    if (val.trim() === "") userEditedNotes.current.delete(path);
    else {
      userEditedNotes.current.add(path);
      aiOwnedNotes.current.delete(path);
    }
  };

  async function onSaveSubmit(form: EvaluationFormData) {
    setIsSubmitting(true);
    try {
      const payload: Partial<Pick<Evaluation, "id">> & Omit<Evaluation, "id"> = {
        ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
        type: "daily",
        studentId: student.uid,
        studentName: student.name,
        date: form.date.getTime(),
        trainingTopic: form.trainingTopic,
        personalSkills: form.personalSkills,
        classroomSkills: form.classroomSkills,
        technicalSkills: form.technicalSkills,
        overallRating: form.overallRating,
      };

      const saved = await saveEvaluation(payload as any);
      toast({ title: "Evaluation Saved", description: "تم حفظ التقييم بنجاح." });

      await onSaved?.(saved);

      if (!disableRedirect) {
        setIsLoading?.(true);
        router.push(`/dashboard/students/${student.uid}/evaluations`);
      }
    } catch (e) {
      console.error("save evaluation failed:", e);
      toast({ title: "Error", description: "تعذر الحفظ.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

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
                        variant="outline"
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
            <Label htmlFor="training-topic" className="font-semibold text-base">المحور التدريبي لليوم:</Label>
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
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><BrainCircuit /> القسم الأول: المهارات الشخصية والسلوكية</h3>
            <p className="text-sm text-muted-foreground mb-4">يقيس هذا القسم مستوى الانضباط المهني والسمات السلوكية ذات الصلة بالبيئة التدريبية المتقدمة.</p>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section1.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                core={`personalSkills.${c.id}`}
                label={c.name}
                desc={c.desc}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Briefcase /> القسم الثاني: مهارات التفاعل داخل البيئة الصفية</h3>
            <p className="text-sm text-muted-foreground mb-4">يركز على التفاعل المعرفي والسلوكي ضمن المحيط التعليمي.</p>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section2.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                core={`classroomSkills.${c.id}`}
                label={c.name}
                desc={c.desc}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><LockKeyhole /> القسم الثالث: المهارات العلمية والتقنية (Cybersecurity)</h3>
            <div className="grid grid-cols-12 gap-4 text-sm font-bold bg-secondary p-2 rounded-t-md">
              <div className="col-span-3">المعيار</div>
              <div className="col-span-4 text-center">الدرجة من (5)</div>
              <div className="col-span-5">الملاحظات</div>
            </div>
            {section3.map((c) => (
              <CriterionRow
                key={c.id}
                control={control}
                core={`technicalSkills.${c.id}`}
                label={c.name}
                desc={c.desc}
                onUserNoteChange={handleUserNoteChange}
              />
            ))}
          </section>

          <Separator />

          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><UserCheck /> تقدير اليوم (حسب التقدير الأكاديمي)</h3>
            <Controller
              control={control}
              name="overallRating"
              render={({ field }) => (
                <RadioGroup className="flex flex-wrap gap-x-6 gap-y-2" value={field.value} onValueChange={field.onChange}>
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
