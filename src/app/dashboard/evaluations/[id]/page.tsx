

'use client'

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getEvaluation } from "@/services/evaluation-service";
import type { Evaluation, EvaluationCriterion } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer, BrainCircuit, Briefcase, LockKeyhole, UserCheck, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

const overallRatingsArabic = {
    'Excellent': 'ممتاز',
    'Very Good': 'جيد جدًا',
    'Good': 'جيد',
    'Acceptable': 'مقبول',
    'Needs Improvement': 'يحتاج إلى تحسين'
};

const section1Criteria = [
  { id: 'professionalCommitment', name: 'الالتزام المهني', desc: 'الالتزام الكامل بالمواعيد والتعليمات والمعايير التنظيمية' },
  { id: 'behavioralMaturity', name: 'النضج السلوكي', desc: 'إظهار سلوك مهني، وتقبل الملاحظات، والتعامل الإيجابي مع المواقف' },
  { id: 'communicationSkills', name: 'مهارات التواصل', desc: 'القدرة على التعبير بوضوح وفعالية، شفهيًا وكتابيًا' },
  { id: 'initiativeAndResponsibility', name: 'المبادرة والمسؤولية', desc: 'التفاعل الاستباقي وتحمل مسؤولية التعلم الذاتي' },
];

const section2Criteria = [
  { id: 'participationQuality', name: 'جودة المشاركة', desc: 'المساهمة الفاعلة في الحوارات التقنية والتحليل الجماعي' },
  { id: 'dialogueManagement', name: 'إدارة الحوار', desc: 'استخدام مهارات التفكير النقدي أثناء المناقشة' },
  { id: 'teamwork', name: 'التعاون ضمن الفريق', desc: 'التفاعل بإيجابية ضمن أنشطة الفرق وأداء المهام المشتركة' },
  { id: 'cyberRulesCommitment', name: 'الالتزام بقواعد الصف السيبراني', desc: 'احترام قواعد الخصوصية والضبط الإلكتروني أثناء الأنشطة' },
];

const section3Criteria = [
  { id: 'contentComprehension', name: 'استيعاب محتوى الدرس', desc: 'فهم المعلومات التي تم شرحها خلال المحاضرة' },
  { id: 'focusAndAttention', name: 'التركيز والانتباه', desc: 'متابعة الشرح والمشاركة في النقاشات' },
  { id: 'activityParticipation', name: 'المشاركة في الأنشطة', desc: 'التفاعل مع الأسئلة أو التمارين أثناء المحاضرة' },
  { id: 'askingQuestions', name: 'طرح الأسئلة', desc: 'إبداء الاهتمام وطرح أسئلة تدل على الفهم' },
  { id: 'summarizationAbility', name: 'القدرة على التلخيص', desc: 'التعبير عن الفهم من خلال تلخيص النقاط الأساسية' },
  { id: 'deviceUsage', name: 'استخدام الجهاز', desc: 'استخدام الحاسوب أو المنصة الإلكترونية بشكل جيد أثناء التدريب' },
];


const CriterionRow = ({ label, description, data }: { label: string, description: string, data: EvaluationCriterion}) => {
    return (
        <div className="py-3 border-b grid grid-cols-12 gap-4 items-center print:grid-cols-12">
            <div className="col-span-12 md:col-span-4 print:col-span-4">
                <h4 className="font-semibold">{label}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="col-span-6 md:col-span-3 print:col-span-3 flex items-center justify-end md:justify-center">
                <span className="ml-4 font-bold text-lg">{data.score}</span>
                <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-5 w-5 ${i < data.score ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                    ))}
                </div>
            </div>
            <div className="col-span-6 md:col-span-5 print:col-span-5">
                <p className="text-sm font-normal">{data.notes || "No notes."}</p>
            </div>
        </div>
    )
}

export default function ViewEvaluationPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        getEvaluation(id)
            .then(data => {
                if (!data) router.push('/dashboard/students'); // Fallback to student list
                setEvaluation(data);
            })
            .catch(err => {
                console.error("Failed to fetch evaluation:", err);
                router.push('/dashboard/students');
            })
            .finally(() => setLoading(false));
    }, [id, router]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!evaluation) {
        return (
            <div className="text-center">
                <p>Evaluation not found.</p>
                <Button asChild variant="link"><Link href="/dashboard">Return to Dashboard</Link></Button>
            </div>
        );
    }
    
    return (
        <div className="space-y-6" dir="rtl">
             <div>
                 <Button asChild variant="outline" size="sm" className="mb-4 print:hidden">
                     <Link href={`/dashboard/students/${evaluation.studentId}/evaluations`}>
                        <ArrowLeft className="ml-2 h-4 w-4" />
                        العودة إلى كل التقييمات
                    </Link>
                </Button>
            </div>
            <Card className="print:shadow-none print:border-none">
                <CardHeader>
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-bold font-headline text-primary">🛡️ نموذج تقييم يومي للمتدربين – برنامج الأمن السيبراني</h2>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-sm border-t border-b py-2">
                        <span><span className="font-semibold">اسم المتدرب:</span> {evaluation.studentName}</span>
                        <span><span className="font-semibold">التاريخ:</span> {format(new Date(evaluation.date), 'PPP')}</span>
                    </div>
                    <div className="space-y-1 mt-4">
                        <p className="font-semibold text-base">المحور التدريبي لليوم:</p>
                        <p className="text-muted-foreground">{evaluation.trainingTopic}</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                     <section>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><BrainCircuit /> القسم الأول: المهارات الشخصية والسلوكية</h3>
                        <p className="text-sm text-muted-foreground mb-4">يقيس هذا القسم مستوى الانضباط المهني والسمات السلوكية ذات الصلة بالبيئة التدريبية المتقدمة.</p>
                         {section1Criteria.map(c => <CriterionRow key={c.id} label={c.name} description={c.desc} data={evaluation.personalSkills[c.id as keyof typeof evaluation.personalSkills]} />)}
                    </section>
                    
                    <Separator className="print:hidden"/>

                    <section>
                         <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Briefcase /> القسم الثاني: مهارات التفاعل داخل البيئة الصفية</h3>
                         <p className="text-sm text-muted-foreground mb-4">يركز على التفاعل المعرفي والسلوكي ضمن المحيط التعليمي.</p>
                         {section2Criteria.map(c => <CriterionRow key={c.id} label={c.name} description={c.desc} data={evaluation.classroomSkills[c.id as keyof typeof evaluation.classroomSkills]} />)}
                    </section>
                    
                    <Separator className="print:hidden"/>
                    
                    <section>
                         <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><LockKeyhole /> القسم الثالث: المهارات العلمية والتقنية (Cybersecurity)</h3>
                         <p className="text-sm text-muted-foreground mb-4">يقيم هذا القسم مدى استيعاب وتطبيق المتدرب للمفاهيم والمهارات التقنية المتخصصة في مجال الأمن السيبراني.</p>
                         {section3Criteria.map(c => <CriterionRow key={c.id} label={c.name} description={c.desc} data={evaluation.technicalSkills[c.id as keyof typeof evaluation.technicalSkills]} />)}
                    </section>
                    
                    <Separator className="print:hidden"/>

                    <section>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><UserCheck /> تقدير اليوم (حسب التقدير الأكاديمي)</h3>
                        <p className="text-2xl font-bold text-primary">{overallRatingsArabic[evaluation.overallRating]}</p>
                    </section>
                </CardContent>
                <CardFooter className="print:hidden">
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print or Save as PDF
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
