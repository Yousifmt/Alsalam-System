
'use client'

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getFinalEvaluation } from "@/services/final-evaluation-service";
import type { FinalEvaluation, EvaluationCriterion } from "@/lib/types";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer, Star, LockKeyhole, Brain, User, MessageSquare, Award, Check } from "lucide-react";
import { format } from "date-fns";

const overallRatingsArabic = {
    'Excellent': 'ممتاز',
    'Very Good': 'جيد جدًا',
    'Good': 'جيد',
    'Acceptable': 'مقبول',
    'Needs Improvement': 'يحتاج إلى تحسين'
};

const finalRecommendationsArabic = {
    'Ready for Security+ exam': 'المتدرب جاهز لتقديم الإمتحان',
    'Needs review before exam': 'يحتاج إلى مراجعة قبل دخول الإمتحان',
    'Re-study recommended': 'يُنصح بإعادة بعض الأجزاء لتعزيز الفهم'
};

const section1Criteria = [
  { id: 'cybersecurityPrinciples', name: 'فهم مبادئ الأمن السيبراني' },
  { id: 'threatTypes', name: 'التعرف على أنواع التهديدات السيبرانية' },
  { id: 'protectionTools', name: 'التعامل مع أدوات الحماية' },
  { id: 'vulnerabilityAnalysis', name: 'تحليل الثغرات وتقييم المخاطر' },
  { id: 'incidentResponse', name: 'استجابة الحوادث وإجراءات الطوارئ' },
  { id: 'networkProtocols', name: 'فهم الشبكات والبروتوكولات الآمنة' },
  { id: 'policyImplementation', name: 'تطبيق السياسات الأمنية داخل النظام' },
  { id: 'forensics', name: 'استخدام أدوات التحقيق والتحليل الجنائي الرقمي' },
];

const section2Criteria = [
  { id: 'analyticalThinking', name: 'التفكير التحليلي' },
  { id: 'problemSolving', name: 'حل المشكلات بطريقة منطقية' },
  { id: 'attentionToDetail', name: 'دقة الملاحظة والانتباه للتفاصيل' },
  { id: 'decisionMaking', name: 'اتخاذ القرار في مواقف أمنية افتراضية' },
];

const section3Criteria = [
  { id: 'discipline', name: 'الانضباط والالتزام بالحضور' },
  { id: 'respectForRules', name: 'احترام القواعد وسلوكيات التدريب' },
  { id: 'interaction', name: 'التفاعل مع المدرب والزملاء' },
  { id: 'teamwork', name: 'العمل الجماعي وتحمل المسؤولية' },
];

const section4Criteria = [
  { id: 'speakingAndExplanation', name: 'مهارات التحدث والشرح أثناء التمارين' },
  { id: 'clarity', name: 'توصيل المعلومة بوضوح' },
];


const CriterionRow = ({ label, data }: { label: string, data: EvaluationCriterion }) => {
    return (
        <div className="py-3 border-b grid grid-cols-12 gap-4 items-center print:grid-cols-12">
            <div className="col-span-12 md:col-span-5 print:col-span-5">
                <h4 className="font-semibold">{label}</h4>
            </div>
            <div className="col-span-6 md:col-span-3 print:col-span-3 flex items-center justify-end md:justify-center">
                <span className="ml-4 font-bold text-lg">{data.score}</span>
                <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-5 w-5 ${i < data.score ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                    ))}
                </div>
            </div>
            <div className="col-span-6 md:col-span-4 print:col-span-4">
                <p className="text-sm font-normal">{data.notes || "لا يوجد ملاحظات."}</p>
            </div>
        </div>
    )
}

export default function ViewFinalEvaluationPage() {
    const params = useParams();
    const id = params.id as string;

    const [evaluation, setEvaluation] = useState<FinalEvaluation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        getFinalEvaluation(id)
            .then(setEvaluation)
            .catch(err => console.error("Failed to fetch final evaluation:", err))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!evaluation) {
        return (
            <div className="text-center">
                <p>Final evaluation not found.</p>
                <Button asChild variant="link"><Link href="/dashboard">Return to dashboard</Link></Button>
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
                        <h2 className="text-xl font-bold font-headline text-primary">🛡️ نموذج تقييم نهائي للمتدربين – برنامج الأمن السيبراني</h2>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-sm border-t border-b py-2">
                        <span><span className="font-semibold">اسم الدورة:</span> {evaluation.courseName}</span>
                        <span><span className="font-semibold">اسم المتدرب:</span> {evaluation.studentName}</span>
                        <span><span className="font-semibold">اسم المدرب:</span> {evaluation.trainerName}</span>
                        <span><span className="font-semibold">الفترة التدريبية:</span> {format(new Date(evaluation.trainingPeriodStart), 'PPP')} - {format(new Date(evaluation.trainingPeriodEnd), 'PPP')}</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                     <section id="final-evaluation-section-1">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><LockKeyhole /> أولًا: المهارات الفنية</h3>
                         {section1Criteria.map(c => <CriterionRow key={c.id} label={c.name} data={evaluation.technicalSkills[c.id as keyof typeof evaluation.technicalSkills]} />)}
                    </section>
                    
                    <section id="final-evaluation-section-2">
                         <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Brain /> ثانيًا: المهارات الذهنية والتحليلية</h3>
                         {section2Criteria.map(c => <CriterionRow key={c.id} label={c.name} data={evaluation.analyticalSkills[c.id as keyof typeof evaluation.analyticalSkills]} />)}
                    </section>
                    
                     <section id="final-evaluation-section-3">
                         <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><User /> ثالثًا: المهارات السلوكية</h3>
                         {section3Criteria.map(c => <CriterionRow key={c.id} label={c.name} data={evaluation.behavioralSkills[c.id as keyof typeof evaluation.behavioralSkills]} />)}
                    </section>

                     <section id="final-evaluation-section-4">
                         <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><MessageSquare /> رابعًا: المهارات التواصلية والعرض</h3>
                         {section4Criteria.map(c => <CriterionRow key={c.id} label={c.name} data={evaluation.communicationSkills[c.id as keyof typeof evaluation.communicationSkills]} />)}
                    </section>

                    <section id="final-evaluation-section-5">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2">💬 ملاحظات المدرب:</h3>
                        <p className="p-4 bg-secondary rounded-md min-h-[100px]">{evaluation.trainerNotes || "لا يوجد ملاحظات."}</p>
                    </section>

                    <section id="final-evaluation-section-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Award /> التقدير العام:</h3>
                        <p className="text-2xl font-bold text-primary">{overallRatingsArabic[evaluation.overallRating]}</p>
                    </section>
                    
                     <section id="final-evaluation-section-7">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><Check /> رأي المدرب النهائي:</h3>
                        <p className="text-lg font-semibold text-primary">{finalRecommendationsArabic[evaluation.finalRecommendation]}</p>
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
