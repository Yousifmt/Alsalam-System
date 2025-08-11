
"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, BarChart } from "lucide-react";
import { getQuizzesForUser } from "@/services/quiz-service";
import type { Quiz } from "@/lib/types";
import { ChartTooltipContent } from "@/components/ui/chart";

interface ChartData {
    date: string;
    score: number;
    quizTitle: string;
}

export function StudentStats({ userId }: { userId: string }) {
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const quizzes = await getQuizzesForUser(userId);
                const allResults = quizzes
                    .flatMap(quiz => 
                        (quiz.results || []).map(result => ({
                            ...result,
                            quizTitle: quiz.title,
                        }))
                    )
                    .sort((a, b) => a.date - b.date); // Sort by date ascending

                const formattedData = allResults.map(result => ({
                    date: new Date(result.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    score: Math.round((result.score / result.total) * 100),
                    quizTitle: result.quizTitle,
                }));
                
                setChartData(formattedData);
            } catch (error) {
                console.error("Failed to fetch student stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [userId]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="text-accent"/> Quiz Performance Over Time</CardTitle>
                <CardDescription>Your grades on quiz attempts.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin"/>
                        <p className="ml-4">Loading stats...</p>
                    </div>
                ) : chartData.length > 0 ? (
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                />
                                <YAxis 
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <Tooltip
                                  content={({ active, payload, label }) => {
                                      if (active && payload && payload.length) {
                                          return (
                                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                  <div className="grid grid-cols-2 gap-2">
                                                      <div className="flex flex-col space-y-1">
                                                          <span className="text-muted-foreground text-sm">{label}</span>
                                                          <span className="font-bold">{payload[0].payload.quizTitle}</span>
                                                      </div>
                                                      <div className="flex flex-col space-y-1 text-right">
                                                          <span className="text-muted-foreground text-sm">Score</span>
                                                          <span className="font-bold text-primary">{`${payload[0].value}%`}</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      }
                                      return null;
                                  }}
                                  cursor={{ fill: "hsl(var(--muted))" }}
                                />
                                <Legend wrapperStyle={{fontSize: "14px"}}/>
                                <Line 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="hsl(var(--primary))" 
                                    strokeWidth={2}
                                    name="Score (%)"
                                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 8, stroke: "hsl(var(--background))" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8 h-64 flex flex-col justify-center items-center">
                        <BarChart className="h-12 w-12 mb-4"/>
                        <p>No quiz attempts found yet.</p>
                        <p className="text-sm">Complete a quiz to see your progress here.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
