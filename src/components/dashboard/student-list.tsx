
"use client";

import { useEffect, useState } from "react";
import { getStudents, type Student } from "@/services/user-service";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, User, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function StudentList() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            try {
                const studentList = await getStudents();
                setStudents(studentList);
            } catch (error) {
                console.error("Error fetching students:", error);
                toast({ title: "Error", description: "Failed to fetch student list.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, [toast]);
    
    const handleRowClick = (uid: string) => {
        router.push(`/dashboard/students/${uid}`);
    }

    return (
        <Card>
            <CardContent className="p-0">
                {loading ? (
                    <div className="flex justify-center items-center p-8 text-muted-foreground h-48">
                        <Loader2 className="h-8 w-8 animate-spin"/>
                        <p className="ml-4">Loading students...</p>
                    </div>
                ) : students.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead><span className="sr-only">View</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map((student) => (
                                <TableRow key={student.uid} onClick={() => handleRowClick(student.uid)} className="cursor-pointer">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                            <span>{student.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{student.email}</TableCell>
                                    <TableCell className="text-right">
                                        <ChevronRight className="h-5 w-5 text-muted-foreground"/>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        <p>No students have registered yet.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
