// FILE: src/app/dashboard/files/page.tsx mm
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
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
import { Separator } from "@/components/ui/separator";

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
   Course tagging
----------------------------------------------------------------------------- */
type CourseTag = "security+" | "a+" | "unassigned";
type StudentCourseTag = "security+" | "a+";

const COURSE_PASSWORDS: Record<StudentCourseTag, string> = {
  "security+": "sy0-701",
  "a+": "202-1201",
};

type ManagedFileWithCourse = ManagedFile & {
  course?: CourseTag;
  orders?: Partial<Record<CourseTag, number>>; // per-section order
  order?: number; // legacy
};

/* ----------------------------------------------------------------------------
   Helpers
----------------------------------------------------------------------------- */
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
      <TableCell className="w-24">
        <Skeleton className="h-8 w-16" />
      </TableCell>
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
        <Skeleton className="h-9 w-24 ml-auto" />
      </TableCell>
    </TableRow>
  );
}

function getEffectiveOrder(file: ManagedFileWithCourse, section: CourseTag): number {
  const big = 1_000_000_000;
  const fromOrders = file.orders?.[section];
  const fromLegacy = file.order;
  const fromUnassigned = file.orders?.["unassigned"];
  return (
    (typeof fromOrders === "number" ? fromOrders : undefined) ??
    (typeof fromLegacy === "number" ? fromLegacy : undefined) ??
    (typeof fromUnassigned === "number" ? fromUnassigned : undefined) ??
    big
  );
}

function sortBySectionOrder(items: ManagedFileWithCourse[], section: CourseTag) {
  return items.slice().sort(
    (a, b) =>
      getEffectiveOrder(a, section) - getEffectiveOrder(b, section) ||
      a.name.localeCompare(b.name)
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

  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [assigningPath, setAssigningPath] = useState<string | null>(null);
  const [reorderingKey, setReorderingKey] = useState<string | null>(null); // `${section}:${path}`
  const fileInputRef = useRef<HTMLInputElement>(null);

  // student chooser
  const [studentCourse, setStudentCourse] = useState<StudentCourseTag | null>(null);
  const [showChooser, setShowChooser] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<StudentCourseTag | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Fetch files + tags
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const base = await getFiles(); // [{name,size,url,path}]
      const snap = await getDocs(collection(db, "files"));
      const metaMap = new Map<
        string,
        { course: CourseTag; orders?: Partial<Record<CourseTag, number>>; order?: number }
      >();
      snap.forEach((d) => {
        const data = d.data() as any;
        const c: CourseTag =
          data?.course === "security+" || data?.course === "a+"
            ? data.course
            : "unassigned";
        const orders = data?.orders as Partial<Record<CourseTag, number>> | undefined;
        const order = typeof data?.order === "number" ? data.order : undefined;
        metaMap.set(d.id, { course: c, orders, order });
      });
      const withCourse: ManagedFileWithCourse[] = base.map((f) => {
        const meta = metaMap.get(fileDocId(f.path));
        return {
          ...f,
          course: meta?.course ?? "unassigned",
          orders: meta?.orders,
          order: meta?.order,
        };
      });
      setFiles(withCourse);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({ title: "Error", description: "Failed to fetch files.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Student saved course
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

  // Upload
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
      toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete
  const handleDeleteFile = async (filePath: string) => {
    if (!confirm("Are you sure you want to delete this file? This action cannot be undone.")) return;
    setDeletingPath(filePath);
    try {
      await deleteFile(filePath);
      toast({ title: "Success", description: "File deleted successfully." });
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" });
    } finally {
      setDeletingPath(null);
    }
  };

  // Assign course
  const assignCourse = async (file: ManagedFileWithCourse, course: CourseTag) => {
    setAssigningPath(file.path);
    try {
      await setDoc(doc(db, "files", fileDocId(file.path)), { course }, { merge: true });
      setFiles((prev) => prev.map((f) => (f.path === file.path ? { ...f, course } : f)));
      toast({
        title: "Updated",
        description:
          course === "unassigned"
            ? `Assigned "${file.name}" to All (unassigned).`
            : `Assigned "${file.name}" to ${course.toUpperCase()}.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to update file course.", variant: "destructive" });
    } finally {
      setAssigningPath(null);
    }
  };

  /* ------------------------ Submit password (FIX) -------------------------- */
  const submitPassword = async () => {
    if (!pendingCourse || !user) return;
    setPwSubmitting(true);
    try {
      const expected = COURSE_PASSWORDS[pendingCourse].toLowerCase().trim();
      const given = pwInput.toLowerCase().trim();
      if (expected !== given) {
        alert("Incorrect code. Please try again.");
        return;
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
  };

  /* ----------------------- Reorder within a section ------------------------ */
  async function reorderInSection(
    section: CourseTag,
    itemsInSection: ManagedFileWithCourse[],
    file: ManagedFileWithCourse,
    newPos: number
  ) {
    const key = `${section}:${file.path}`;
    setReorderingKey(key);
    try {
      const sorted = sortBySectionOrder(itemsInSection, section);
      const currentIdx = sorted.findIndex((x) => x.path === file.path);
      if (currentIdx < 0) return;

      const targetIdx = Math.max(0, Math.min(newPos - 1, sorted.length - 1));
      if (targetIdx === currentIdx) return; // no change

      const next = sorted.slice();
      const [moved] = next.splice(currentIdx, 1);
      next.splice(targetIdx, 0, moved);

      // write sequential 1..N for this section
      const batch = writeBatch(db);
      const updatedMap = new Map<string, Partial<Record<CourseTag, number>>>();
      next.forEach((f, idx) => {
        const newOrders = { ...(f.orders ?? {}), [section]: idx + 1 };
        updatedMap.set(f.path, newOrders);
        batch.set(doc(db, "files", fileDocId(f.path)), { orders: newOrders }, { merge: true });
      });
      await batch.commit();

      // update local state
      setFiles((prev) =>
        prev.map((f) => (updatedMap.has(f.path) ? { ...f, orders: updatedMap.get(f.path)! } : f))
      );
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to change order.", variant: "destructive" });
    } finally {
      setReorderingKey(null);
    }
  }

  // Visible list for students (sorted)
  const visibleFiles: ManagedFileWithCourse[] = isStudent
    ? files.filter((f) => {
        const c = f.course ?? "unassigned";
        return c === "unassigned" || c === studentCourse;
      })
    : files;

  const studentSorted = useMemo(() => {
    if (!isStudent) return [];
    return visibleFiles.slice().sort((a, b) => {
      const pa = a.course === studentCourse ? 0 : 1;
      const pb = b.course === studentCourse ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const secA = (a.course ?? "unassigned") as CourseTag;
      const secB = (b.course ?? "unassigned") as CourseTag;
      const oa = getEffectiveOrder(a, secA);
      const ob = getEffectiveOrder(b, secB);
      return oa - ob || a.name.localeCompare(b.name);
    });
  }, [isStudent, visibleFiles, studentCourse]);

  // Grouping for admin (sorted)
  const adminUnassigned = useMemo(
    () =>
      isAdmin
        ? sortBySectionOrder(
            files.filter((f) => (f.course ?? "unassigned") === "unassigned"),
            "unassigned"
          )
        : [],
    [isAdmin, files]
  );
  const adminSecurity = useMemo(
    () => (isAdmin ? sortBySectionOrder(files.filter((f) => f.course === "security+"), "security+") : []),
    [isAdmin, files]
  );
  const adminAPlus = useMemo(
    () => (isAdmin ? sortBySectionOrder(files.filter((f) => f.course === "a+"), "a+") : []),
    [isAdmin, files]
  );

  /* ------------------------------- Reusable UI ------------------------------ */
  const FileActions: React.FC<{ file: ManagedFileWithCourse; showDelete?: boolean }> = ({
    file,
    showDelete,
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-haspopup="true"
          size="icon"
          variant="ghost"
          className="shrink-0"
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

        {showDelete && (
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
  );

  // Get current position (index+1) of file in section
  function getCurrentPos(file: ManagedFileWithCourse, section: CourseTag, items: ManagedFileWithCourse[]) {
    const sorted = sortBySectionOrder(items, section);
    const idx = sorted.findIndex((x) => x.path === file.path);
    return idx >= 0 ? idx + 1 : 1;
  }

  const OrderSelect: React.FC<{
    section: CourseTag;
    items: ManagedFileWithCourse[];
    file: ManagedFileWithCourse;
  }> = ({ section, items, file }) => {
    const count = items.length || 1;
    const current = getCurrentPos(file, section, items);
    const disabled = reorderingKey !== null; // lock during write
    return (
      <div className="flex items-center gap-2">
        <Select
          value={String(current)}
          onValueChange={(v) => reorderInSection(section, items, file, Number(v))}
          disabled={disabled}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <SelectItem key={`${section}:${file.path}:${n}`} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reorderingKey?.startsWith(`${section}:`) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
      </div>
    );
  };

  const DesktopRowAdmin: React.FC<{
    file: ManagedFileWithCourse;
    section: CourseTag;
    items: ManagedFileWithCourse[];
  }> = ({ file, section, items }) => (
    <TableRow key={`${file.path}-${section}`}>
      {/* Order BEFORE name */}
      <TableCell className="w-24">
        <OrderSelect section={section} items={items} file={file} />
      </TableCell>

      <TableCell className="font-medium">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="truncate break-all">{file.name}</span>
        </div>
      </TableCell>

      <TableCell className="hidden md:table-cell">{file.size}</TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Select
            value={(file.course ?? "unassigned") as CourseTag}
            onValueChange={(v: CourseTag) => assignCourse(file, v)}
            disabled={assigningPath === file.path || reorderingKey !== null}
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
          {assigningPath === file.path ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <FileActions file={file} showDelete />
      </TableCell>
    </TableRow>
  );

  const DesktopRowStudent: React.FC<{ file: ManagedFileWithCourse }> = ({ file }) => (
    <TableRow key={file.path}>
      <TableCell className="w-24">{/* spacer for alignment */}</TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="truncate break-all">{file.name}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{file.size}</TableCell>
      <TableCell>
        <Badge variant={getCourseBadgeVariant(file.course)}>
          {(file.course ?? "unassigned") === "unassigned" ? "All" : String(file.course).toUpperCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <FileActions file={file} />
      </TableCell>
    </TableRow>
  );

  const MobileCard: React.FC<{
    file: ManagedFileWithCourse;
    isAdminView?: boolean;
    sectionForAdmin?: CourseTag;
    itemsForAdmin?: ManagedFileWithCourse[];
  }> = ({ file, isAdminView, sectionForAdmin, itemsForAdmin }) => (
    <div className="rounded-xl border p-3 flex items-start gap-3 w-full">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="font-medium truncate break-all">{file.name}</p>
        </div>

        <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-2">
          {file.size ? <span>{file.size}</span> : null}
          {!isAdminView && (
            <Badge variant={getCourseBadgeVariant(file.course)}>
              {(file.course ?? "unassigned") === "unassigned"
                ? "All"
                : String(file.course).toUpperCase()}
            </Badge>
          )}
        </div>

        {isAdminView && sectionForAdmin && itemsForAdmin ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* Order dropdown */}
            <OrderSelect section={sectionForAdmin} items={itemsForAdmin} file={file} />
            {/* Course selector */}
            <div>
              <Select
                value={(file.course ?? "unassigned") as CourseTag}
                onValueChange={(v: CourseTag) => assignCourse(file, v)}
                disabled={assigningPath === file.path || reorderingKey !== null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Assign course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">All (unassigned)</SelectItem>
                  <SelectItem value="security+">Security+</SelectItem>
                  <SelectItem value="a+">A+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      <FileActions file={file} showDelete={!!isAdminView} />
    </div>
  );

  const SectionDesktop: React.FC<{
    title: string;
    icon?: React.ReactNode;
    items: ManagedFileWithCourse[];
    section: CourseTag;
    admin?: boolean;
  }> = ({ title, icon, items, section, admin }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        {/* Desktop (md+) table */}
        <div className="hidden md:block">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Order</TableHead>
                <TableHead className="w-1/2">Name</TableHead>
                <TableHead className="hidden md:table-cell w-24">Size</TableHead>
                <TableHead className="w-48">{admin ? "Course" : " "}</TableHead>
                <TableHead className="w-16">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((file) =>
                admin ? (
                  <DesktopRowAdmin
                    key={`${file.path}-${section}`}
                    file={file}
                    section={section}
                    items={items}
                  />
                ) : (
                  <DesktopRowStudent key={file.path} file={file} />
                )
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden grid grid-cols-1 gap-3">
          {items.map((file) => (
            <MobileCard
              key={`${file.path}-${section}`}
              file={file}
              isAdminView={!!admin}
              sectionForAdmin={section}
              itemsForAdmin={items}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-headline truncate">
            {isStudent ? "Files" : "File Management"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isStudent
              ? "Download shared files."
              : "Upload, assign, and organize files (per-section ordering)."}
          </p>
        </div>

        {isAdmin && (
          <div className="shrink-0">
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
          </div>
        )}
      </div>

      {/* Student first-time chooser */}
      {isStudent && showChooser && (
        <Card className="w-full overflow-hidden">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle>Choose Your Course</CardTitle>
            <CardDescription>
              Select your course and enter the access code once. It will be saved to your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row px-3 sm:px-6">
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
            <DialogContent className="max-w-lg w-[95vw]">
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
                <Button onClick={submitPassword} disabled={pwSubmitting} className="w-28">
                  {pwSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Unlock
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      )}

      {/* Files */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle>All Files</CardTitle>
          <CardDescription>
            {isStudent
              ? "Files for your course are shown automatically (including any unassigned)."
              : "Assign files and choose their order per section using the number dropdown."}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-3 sm:px-6">
          {loading ? (
            <div className="p-2 sm:p-4">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Order</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Size</TableHead>
                      <TableHead>Course</TableHead>
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
              <div className="md:hidden grid grid-cols-1 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-sm" />
                      <Skeleton className="h-5 w-48" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isStudent && showChooser ? (
            <div className="text-center text-muted-foreground p-8">
              Choose your course to view files.
            </div>
          ) : isAdmin ? (
            files.length > 0 ? (
              <div className="space-y-6">
                <SectionDesktop
                  title="Unassigned (All)"
                  icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                  items={adminUnassigned}
                  section="unassigned"
                  admin
                />

                {(adminUnassigned.length > 0 &&
                  (adminSecurity.length > 0 || adminAPlus.length > 0)) && (
                  <Separator className="my-2" />
                )}

                <SectionDesktop
                  title="Security+ Files"
                  icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                  items={adminSecurity}
                  section="security+"
                  admin
                />

                {adminSecurity.length > 0 && adminAPlus.length > 0 && (
                  <Separator className="my-2" />
                )}

                <SectionDesktop
                  title="A+ Files"
                  icon={<Cpu className="h-5 w-5 text-muted-foreground" />}
                  items={adminAPlus}
                  section="a+"
                  admin
                />

                {adminUnassigned.length === 0 &&
                  adminSecurity.length === 0 &&
                  adminAPlus.length === 0 && (
                    <div className="text-center text-muted-foreground p-8">
                      <p>You haven't uploaded any files yet.</p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <p>You haven't uploaded any files yet.</p>
              </div>
            )
          ) : studentSorted.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">{/* spacer for order */}</TableHead>
                      <TableHead className="w-1/2">Name</TableHead>
                      <TableHead className="hidden md:table-cell w-24">Size</TableHead>
                      <TableHead className="w-36"> </TableHead>
                      <TableHead className="w-16">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentSorted.map((file) => (
                      <DesktopRowStudent key={file.path} file={file} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {studentSorted.map((file) => (
                  <MobileCard key={file.path} file={file} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <p>No files have been shared with you.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
