// FILE: src/app/dashboard/files/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { deleteFile, getFiles, uploadFile } from "@/services/file-service";
import type { ManagedFile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Upload,
  MoreHorizontal,
  FileText,
  Download,
  Trash2,
  Loader2,
  Shield,
  Cpu,
} from "lucide-react";

/* ----------------------------------------------------------------------------
   Course tagging (aligned with quizzes)
----------------------------------------------------------------------------- */

type CourseTag = "security+" | "a+" | "unassigned";
type StudentCourseTag = "security+" | "a+";

const COURSE_PASSWORDS: Record<StudentCourseTag, string> = {
  "security+": "sy0-701",
  "a+": "202-1201",
};

type ManagedFileWithCourse = ManagedFile & { course?: CourseTag };

/* ----------------------------------------------------------------------------
   Helpers
----------------------------------------------------------------------------- */

// Firestore document IDs cannot include "/" (it becomes path segments).
// Use a stable sanitizer for Storage paths -> Firestore doc ids.
const fileDocId = (p: string) => encodeURIComponent(p);

function getCourseBadgeVariant(course: CourseTag | undefined) {
  switch (course) {
    case "security+":
      return "default";
    case "a+":
      return "secondary";
    default:
      return "outline";
  }
}

function FileRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-5 w-40" />
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-9 w-24 ml-auto" />
      </TableCell>
    </TableRow>
  );
}

/* ----------------------------------------------------------------------------
   Page
----------------------------------------------------------------------------- */

export default function FilesPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const isStudent = role === "student";
  const { toast } = useToast();

  const [files, setFiles] = useState<ManagedFileWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  // upload/delete
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [assigningPath, setAssigningPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // student first-visit chooser (same flow as quizzes)
  const [studentCourse, setStudentCourse] = useState<StudentCourseTag | null>(null);
  const [showChooser, setShowChooser] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<StudentCourseTag | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch files + per-file course tags (from Firestore "files" collection)
  // Uses sanitized document IDs derived from Storage path.
  // --------------------------------------------------------------------------
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const base = await getFiles(); // [{name,size,url,path}]

      // load course tags from Firestore
      const snap = await getDocs(collection(db, "files"));
      const courseMap = new Map<string, CourseTag>();
      snap.forEach((d) => {
        const data = d.data() as any;
        const c: CourseTag =
          data?.course === "security+" || data?.course === "a+"
            ? data.course
            : "unassigned";
        courseMap.set(d.id, c); // d.id is sanitized
      });

      const withCourse: ManagedFileWithCourse[] = base.map((f) => ({
        ...f,
        course: courseMap.get(fileDocId(f.path)) ?? "unassigned",
      }));

      setFiles(withCourse);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // --------------------------------------------------------------------------
  // Student: determine saved course (same as quizzes)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const run = async () => {
      if (!isStudent || !user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as any) : {};
        const c = data.courseTag as StudentCourseTag | undefined;
        if (c === "security+" || c === "a+") {
          setStudentCourse(c);
          setShowChooser(false);
        } else {
          setStudentCourse(null);
          setShowChooser(true);
        }
      } catch {
        setStudentCourse(null);
        setShowChooser(true);
      }
    };
    run();
  }, [isStudent, user]);

  // --------------------------------------------------------------------------
  // Upload
  // --------------------------------------------------------------------------
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadFile(file);
      toast({ title: "Success", description: "File uploaded successfully." });
      await fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------
  const handleDeleteFile = async (filePath: string) => {
    if (!confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
      return;
    }
    setDeletingPath(filePath);
    try {
      await deleteFile(filePath);
      toast({ title: "Success", description: "File deleted successfully." });
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file.",
        variant: "destructive",
      });
    } finally {
      setDeletingPath(null);
    }
  };

  // --------------------------------------------------------------------------
  // Assign course (Admin): store under sanitized doc id based on Storage path
  // --------------------------------------------------------------------------
  const assignCourse = async (file: ManagedFileWithCourse, course: CourseTag) => {
    setAssigningPath(file.path);
    try {
      await setDoc(
        doc(db, "files", fileDocId(file.path)), // <-- sanitized ID fixes "even number of segments" error
        { course },
        { merge: true }
      );
      setFiles((prev) =>
        prev.map((f) => (f.path === file.path ? { ...f, course } : f))
      );
      toast({
        title: "Updated",
        description:
          course === "unassigned"
            ? `Assigned "${file.name}" to All (unassigned).`
            : `Assigned "${file.name}" to ${course.toUpperCase()}.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to update file course.",
        variant: "destructive",
      });
    } finally {
      setAssigningPath(null);
    }
  };

  // --------------------------------------------------------------------------
  // Student first-time password flow (same as quizzes page)
  // --------------------------------------------------------------------------
  async function submitPassword() {
    if (!pendingCourse || !user) return;
    setPwSubmitting(true);
    try {
      const expected = COURSE_PASSWORDS[pendingCourse].toLowerCase().trim();
      const given = pwInput.toLowerCase().trim();
      if (expected !== given) {
        setPwSubmitting(false);
        return alert("Incorrect code. Please try again.");
      }
      await updateDoc(doc(db, "users", user.uid), { courseTag: pendingCourse });
      setStudentCourse(pendingCourse);
      setShowChooser(false);
      setPwDialogOpen(false);
      toast({ title: "Unlocked", description: "Your course has been saved." });
    } catch (e) {
      console.error(e);
      alert("Failed to save your course. Please try again.");
    } finally {
      setPwSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // Visible list for students: show their course files + unassigned
  // --------------------------------------------------------------------------
  const visibleFiles: ManagedFileWithCourse[] = isStudent
    ? files.filter((f) => {
        const c = f.course ?? "unassigned";
        return c === "unassigned" || c === studentCourse;
      })
    : files;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">
            {isStudent ? "Files" : "File Management"}
          </h1>
          <p className="text-muted-foreground">
            {isStudent
              ? "Download shared files."
              : "Upload, assign, and manage shared files."}
          </p>
        </div>

        {isAdmin && (
          <>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
          </>
        )}
      </div>

      {/* Student first-time chooser (same UX as quizzes) */}
      {isStudent && showChooser && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Course</CardTitle>
            <CardDescription>
              Select your course and enter the access code once. It will be saved to your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => {
                setPendingCourse("security+");
                setPwInput("");
                setPwDialogOpen(true);
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              Security+
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setPendingCourse("a+");
                setPwInput("");
                setPwDialogOpen(true);
              }}
            >
              <Cpu className="mr-2 h-4 w-4" />
              A+
            </Button>
          </CardContent>

          <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Enter Access Code ({pendingCourse === "a+" ? "A+" : "Security+"})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="course-code">Code (case-insensitive)</Label>
                <Input
                  id="course-code"
                  placeholder={pendingCourse === "a+" ? "202-1201" : "sy0-701"}
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPwDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitPassword} disabled={pwSubmitting}>
                  {pwSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Unlock
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      )}

      {/* Files table */}
      <Card>
        <CardHeader>
          <CardTitle>All Files</CardTitle>
          <CardDescription>
            {isStudent
              ? "Files for your course are shown automatically (including any unassigned)."
              : "Assign files to Security+ or A+ so students only see relevant files."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead>{isAdmin ? "Course" : " "}</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(4)].map((_, i) => (
                    <FileRowSkeleton key={i} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : isStudent && showChooser ? (
            <div className="text-center text-muted-foreground p-8">
              Choose your course to view files.
            </div>
          ) : visibleFiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Size</TableHead>
                  <TableHead>{isAdmin ? "Course" : " "}</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFiles.map((file) => (
                  <TableRow key={file.path}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span>{file.name}</span>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">{file.size}</TableCell>

                    <TableCell>
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={(file.course ?? "unassigned") as CourseTag}
                            onValueChange={(v: CourseTag) => assignCourse(file, v)}
                            disabled={assigningPath === file.path}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Assign course" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">All (unassigned)</SelectItem>
                              <SelectItem value="security+">Security+</SelectItem>
                              <SelectItem value="a+">A+</SelectItem>
                            </SelectContent>
                          </Select>
                          {assigningPath === file.path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                        </div>
                      ) : (
                        <Badge variant={getCourseBadgeVariant(file.course)}>
                          {(file.course ?? "unassigned") === "unassigned"
                            ? "All"
                            : String(file.course).toUpperCase()}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                            disabled={deletingPath === file.path}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </a>
                          </DropdownMenuItem>

                          {isAdmin && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteFile(file.path)}
                              className="flex items-center gap-2 text-red-500 hover:text-red-500 focus:text-red-500"
                              disabled={deletingPath === file.path}
                            >
                              {deletingPath === file.path ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {deletingPath === file.path ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <p>
                {isAdmin
                  ? "You haven't uploaded any files yet."
                  : "No files have been shared with you."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
