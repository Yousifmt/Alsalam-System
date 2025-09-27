// Al-Salam system\src\components\dashboard\batch-grades-dashboard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query as fsQuery,
  where,
} from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCcw,
  Users,
  BarChart3,
  AlertTriangle,
} from "lucide-react";

import type { QuizResult } from "@/lib/types";

/**
 * BatchGradesDashboard
 * ------------------------------------------------------------
 * Admin-only dashboard block to sit ABOVE the quizzes list.
 * Detects the most recently active quiz in the last N hours
 * for a selected class (batch), shows who took it + who missed it,
 * and renders a clean, copy-friendly table with scores.
 */
export function BatchGradesDashboard() {
  const { toast } = useToast();

  // ---------- Types / State ----------
  type ClassItem = { id: string; name: string };

  type Row = {
    uid: string;
    name: string;
    email: string;
    attempts: number; // kept in data, not shown
    lastAttemptAt?: number;
    scorePercent?: number; // latest attempt
    status: "Taken" | "Not Attempted";
  };

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState<string>("");

  const [hours, setHours] = useState<number>(6);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState<Row[]>([]);

  const cutoffMs = useMemo(() => Date.now() - hours * 3600 * 1000, [hours]);

  // ---------- Data helpers ----------
  const fetchClasses = async () => {
    const snap = await getDocs(collection(db, "classes"));
    const list: ClassItem[] = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
          sensitivity: "base",
        })
      );

    setClasses(list);
    if (!classId && list.length) setClassId(list[0].id);
  };

  const fetchRoster = async (cid: string) => {
    const q = fsQuery(collection(db, "users"), where("classId", "==", cid));
    const snap = await getDocs(q);
    const students: Row[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        uid: d.id,
        name: data.name ?? "",
        email: data.email ?? "",
        attempts: 0,
        status: "Not Attempted",
      } as Row;
    });
    setRoster(students);
    return students;
  };

  const readLatestFromResults = (
    results?: QuizResult[]
  ): { when?: number; percent?: number } => {
    if (!Array.isArray(results) || results.length === 0) return {};
    const sorted = [...results].sort(
      (a: any, b: any) => (b?.date ?? 0) - (a?.date ?? 0)
    );
    const latest = sorted[0] as any;
    const when = typeof latest?.date === "number" ? latest.date : undefined;
    const percent =
      typeof latest?.score === "number" &&
      typeof latest?.total === "number" &&
      latest.total > 0
        ? Math.round((latest.score / latest.total) * 100)
        : undefined;
    return { when, percent };
  };

  const detectMostRecentQuizInWindow = async (students: Row[]) => {
    type Seen = { latestWhen: number; quizId: string };
    const seenByQuiz = new Map<string, number>();

    await Promise.all(
      students.map(async (s) => {
        const subSnap = await getDocs(collection(db, `users/${s.uid}/quizzes`));
        subSnap.forEach((qd) => {
          const data = qd.data() as { results?: QuizResult[] };
          const { when } = readLatestFromResults(data?.results);
          if (when && when >= cutoffMs) {
            const prev = seenByQuiz.get(qd.id) ?? 0;
            if (when > prev) seenByQuiz.set(qd.id, when);
          }
        });
      })
    );

    if (seenByQuiz.size === 0)
      return { id: null as string | null, title: "" };

    let best: Seen = { latestWhen: -1, quizId: "" };
    for (const [id, when] of seenByQuiz) {
      if (when > best.latestWhen) best = { quizId: id, latestWhen: when };
    }

    const qRef = doc(db, "quizzes", best.quizId);
    const qSnap = await getDoc(qRef);
    const title = qSnap.exists()
      ? String((qSnap.data() as any)?.title ?? best.quizId)
      : best.quizId;

    return { id: best.quizId, title };
  };

  const buildRowsForQuiz = async (students: Row[], qid: string) => {
    const rows: Row[] = [];
    let sum = 0;
    let scored = 0;

    await Promise.all(
      students.map(async (s) => {
        const snap = await getDoc(doc(db, `users/${s.uid}/quizzes/${qid}`));
        if (!snap.exists()) {
          rows.push({ ...s, status: "Not Attempted", attempts: 0 });
          return;
        }
        const data = snap.data() as { results?: QuizResult[] };
        const results = Array.isArray(data?.results) ? data.results : [];
        const { when, percent } = readLatestFromResults(results);
        const row: Row = {
          ...s,
          attempts: results.length, // not shown, retained
          lastAttemptAt: when,
          scorePercent: percent,
          status: results.length > 0 ? "Taken" : "Not Attempted",
        };
        rows.push(row);
        if (typeof percent === "number") {
          sum += percent;
          scored += 1;
        }
      })
    );

    rows.sort((a, b) => {
      const sa = a.status === "Taken" ? 0 : 1;
      const sb = b.status === "Taken" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (b.scorePercent ?? -1) - (a.scorePercent ?? -1);
    });

    const attemptedCount = rows.filter((r) => r.status === "Taken").length;
    const notAttemptedCount = rows.length - attemptedCount;
    const avg = scored ? Math.round(sum / scored) : null;

    return { rows, attemptedCount, notAttemptedCount, avg };
  };

  const load = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const students = await fetchRoster(classId);
      if (students.length === 0) {
        setQuizId(null);
        setQuizTitle("");
        setRoster([]);
        return;
      }
      const detected = await detectMostRecentQuizInWindow(students);
      setQuizId(detected.id);
      setQuizTitle(detected.title);

      if (!detected.id) {
        setRoster(
          students.map((s) => ({ ...s, attempts: 0, status: "Not Attempted" }))
        );
        return;
      }

      const { rows } = await buildRowsForQuiz(students, detected.id);
      setRoster(rows);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Failed to load batch grades",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Effects ----------
  useEffect(() => {
    fetchClasses().catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (classId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, hours]);

  // ---------- Derived ----------
  const attemptedCount = useMemo(
    () => roster.filter((r) => r.status === "Taken").length,
    [roster]
  );
  const notAttemptedCount = useMemo(
    () => roster.length - attemptedCount,
    [roster, attemptedCount]
  );
  const avgScore = useMemo(() => {
    const s = roster.filter((r) => typeof r.scorePercent === "number");
    if (!s.length) return null as number | null;
    const sum = s.reduce((acc, r) => acc + (r.scorePercent as number), 0);
    return Math.round(sum / s.length);
  }, [roster]);

  // ---------- CSV ----------
  const exportCsv = () => {
    const lines = [
      ["Name", "Email", "Status", "Score %", "Quiz"].join(","),
      ...roster.map((r) =>
        [
          safeCsv(r.name),
          safeCsv(r.email),
          r.status,
          r.scorePercent ?? "",
          safeCsv(quizTitle || ""),
        ].join(",")
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-${classId}-${quizId ?? "no-quiz"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const safeCsv = (s?: string) =>
    (s ?? "").includes(",") || (s ?? "").includes("\n")
      ? `"${(s ?? "").replace(/"/g, '""')}"`
      : s ?? "";

  const totalCols = useMemo(() => (quizId ? 6 : 5), [quizId]);

  // New: background color chip (text remains default)
  const scoreBgClass = (val: number) =>
  val >= 80
    ? "bg-green-300 dark:bg-green-700 border border-green-400 dark:border-green-600"
    : val >= 60
    ? "bg-yellow-300 dark:bg-yellow-700 border border-yellow-400 dark:border-yellow-600"
    : "bg-red-300 dark:bg-red-700 border border-red-400 dark:border-red-600";


  // ---------- UI ----------
  return (
    <Card className="border-2 border-[rgba(32,43,96,0.15)]">
      <CardHeader className="pb-2">
        {/* Title + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-2xl flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Batch activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!roster.length}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Controls row: Class | Hours | Detected quiz */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.6fr)] gap-2 md:gap-3 items-end">
          {/* Class select */}
          <div className="grid gap-1">
            <Label className="text-xs md:text-sm">Select batch (class)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose class…" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hours (narrow) */}
          <div className="grid gap-1">
            <Label className="text-xs md:text-sm">Last (hours)</Label>
            <Input
              className="w-20 md:w-24 text-center"
              type="number"
              min={1}
              max={72}
              value={hours}
              onChange={(e) =>
                setHours(Math.max(1, Math.min(72, Number(e.target.value) || 1)))
              }
            />
          </div>

          {/* Detected quiz (compact) */}
          <div className="grid gap-1">
            <Label className="text-xs md:text-sm">Detected quiz</Label>
            {quizId ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  {quizTitle}
                </Badge>
                <Button asChild variant="ghost" size="sm" className="px-2 shrink-0">
                  <Link href={`/dashboard/quizzes/${quizId}/analytics`}>
                    Open analytics
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  in the last {hours}h
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle className="h-4 w-4" />
                No quiz activity detected in the last {hours}h
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile
            label="Students"
            value={roster.length}
            icon={<Users className="h-4 w-4" />}
          />
          <SummaryTile label="Attempted" value={attemptedCount} />
          <SummaryTile label="Missing" value={notAttemptedCount} />
          <SummaryTile
            label="Average"
            value={avgScore != null ? `${avgScore}%` : "—"}
          />
        </div>

        <Separator className="my-4" />

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Student</th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">
                  Email
                </th>
                <th className="text-left px-3 py-2 font-semibold">Quiz</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Score</th>
                {quizId ? (
                  <th className="text-left px-3 py-2 font-semibold">Details</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="p-6 text-center text-muted-foreground"
                  >
                    <Loader2 className="inline h-5 w-5 animate-spin mr-2" />{" "}
                    Loading…
                  </td>
                </tr>
              ) : roster.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No students in this class.
                  </td>
                </tr>
              ) : (
                roster.map((r) => (
                  <tr
                    key={r.uid}
className="
  group border-t last:border-b border-border
  hover:border-t-2 hover:border-b-2 last:hover:border-b-2
  hover:border-foreground/60 dark:hover:border-foreground/50
  transition-[border-width,border-color] duration-150
"

                  >
                    <td className="px-3 py-2">
                      <span className="group-hover:font-semibold">{r.name}</span>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                      <span className="block max-w-[360px] truncate group-hover:font-semibold">
                        {r.email}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="group-hover:font-semibold">
                        {quizTitle || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={r.status === "Taken" ? "default" : "secondary"}
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {typeof r.scorePercent === "number" ? (
                        <span
                          className={`inline-flex items-center justify-center h-7 w-10 md:w-12 rounded-md ${scoreBgClass(
                            r.scorePercent
                          )} group-hover:font-semibold`}
                        >
                          {r.scorePercent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground group-hover:font-semibold">
                          —
                        </span>
                      )}
                    </td>
                    {quizId ? (
                      <td className="px-3 py-2">
                        {r.status === "Taken" ? (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="px-2"
                          >
                            <Link href={`/dashboard/students/${r.uid}`}>View</Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground group-hover:font-semibold">
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Small helper -------------------- */
function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card/60 p-3 text-center">
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
        {icon ?? null}
        <span className="leading-none">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
