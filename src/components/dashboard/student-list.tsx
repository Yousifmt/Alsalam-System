// src/components/dashboard/student-list.tsx
"use client";

import React, { useEffect, useMemo, useState, Fragment } from "react";
import { getStudents, type Student, deleteStudent } from "@/services/user-service";
import {
  getClasses,
  createClass,
  renameClass,
  deleteClass,
  assignStudentToClass,
  type ClassItem,
} from "@/services/class-service";
import { AnimatePresence, motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2, User, ChevronDown, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { useAuth } from "@/context/auth-context";

type StudentRow = Student & {
  classId?: string | null;
  className?: string | null;
};

type SortKey =
  | "name-asc"
  | "name-desc"
  | "email-asc"
  | "email-desc"
  | "class-asc"
  | "class-desc"
  | "classnum-asc"
  | "classnum-desc";

function Collapse({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Session persistence:
 * - Default (new session): all groups collapsed
 * - If admin expands a group: persist "expanded group keys" in sessionStorage
 * - When returning to dashboard in same session: restore expanded groups
 */
const SESSION_KEY = "student-list:expanded-groups:v1";

function readExpandedFromSession(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeExpandedToSession(expandedKeys: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(expandedKeys));
  } catch {
    // ignore
  }
}

export function StudentList() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("class-asc");

  const [manageOpen, setManageOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [pendingDelete, setPendingDelete] = useState<{ uid: string; name: string } | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [initialCollapseApplied, setInitialCollapseApplied] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  // keep your original pattern
  const { user } = useAuth?.() ?? { user: undefined };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [stu, cls] = await Promise.all([getStudents(), getClasses()]);
        setStudents(stu as StudentRow[]);
        setClasses(cls);
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to fetch data.", variant: "destructive" });
      } finally {
        setLoading(false);
        setLoadingClasses(false);
      }
    };
    load();
  }, [toast]);

  const currentClassById = (id?: string | null) => classes.find((c) => c.id === id);

  const getEffectiveClassName = (s: StudentRow): string => {
    if (s.className) return s.className;
    const cls = currentClassById(s.classId);
    return cls?.name ?? "";
  };

  const naturalCompare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  const extractFirstNumber = (text: string): number | null => {
    const m = text?.match?.(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = students.filter((s) => {
      if (!q) return true;
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    });

    const cmpName = (a: StudentRow, b: StudentRow) => (a.name || "").localeCompare(b.name || "");
    const cmpEmail = (a: StudentRow, b: StudentRow) => (a.email || "").localeCompare(b.email || "");

    const cmpClassAZ = (a: StudentRow, b: StudentRow) => {
      const an = getEffectiveClassName(a);
      const bn = getEffectiveClassName(b);
      const aEmpty = !an;
      const bEmpty = !bn;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      return naturalCompare(an, bn);
    };

    const cmpClassNum = (a: StudentRow, b: StudentRow) => {
      const an = getEffectiveClassName(a);
      const bn = getEffectiveClassName(b);
      const ai = extractFirstNumber(an);
      const bi = extractFirstNumber(bn);

      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return cmpClassAZ(a, b);
    };

    list = list.sort((a, b) => {
      switch (sortKey) {
        case "name-asc":
          return cmpName(a, b);
        case "name-desc":
          return -cmpName(a, b);
        case "email-asc":
          return cmpEmail(a, b);
        case "email-desc":
          return -cmpEmail(a, b);
        case "class-asc":
          return cmpClassAZ(a, b);
        case "class-desc":
          return -cmpClassAZ(a, b);
        case "classnum-asc":
          return cmpClassNum(a, b);
        case "classnum-desc":
          return -cmpClassNum(a, b);
        default:
          return 0;
      }
    });

    return list;
  }, [students, query, sortKey, classes]);

  const groupedByClass = useMemo(() => {
    type Group = { key: string; title: string; items: StudentRow[] };
    const map = new Map<string, StudentRow[]>();
    const order: string[] = [];

    filteredSorted.forEach((s) => {
      const key = getEffectiveClassName(s) || "__unassigned__";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(s);
    });

    return order.map((key) => ({
      key,
      title: key === "__unassigned__" ? "Unassigned" : key,
      items: map.get(key)!,
    })) as Group[];
  }, [filteredSorted]);

  const groupKeys = groupedByClass.map((g) => g.key);

  // ✅ Apply initial collapse from session (or default collapse-all for new session)
  useEffect(() => {
    if (initialCollapseApplied) return;
    if (!groupedByClass.length) return;

    const keys = groupKeys;

    const expanded = readExpandedFromSession().filter((k) => keys.includes(k));

    // Default new session: everything collapsed
    // Same session return: restore expanded groups
    const nextCollapsed =
      expanded.length > 0 ? new Set(keys.filter((k) => !expanded.includes(k))) : new Set(keys);

    setCollapsed(nextCollapsed);
    setInitialCollapseApplied(true);
  }, [groupedByClass, groupKeys, initialCollapseApplied]);

  // ✅ Persist whenever collapsed state changes (after initial apply)
  useEffect(() => {
    if (!initialCollapseApplied) return;
    const keys = groupKeys;
    if (!keys.length) return;

    const expanded = keys.filter((k) => !collapsed.has(k));
    writeExpandedToSession(expanded);
  }, [collapsed, groupKeys, initialCollapseApplied]);

  const totalCount = filteredSorted.length;

  const handleRowClick = (uid: string) => {
    router.push(`/dashboard/students/${uid}`);
  };

  const handleAssign = async (student: StudentRow, value: string) => {
    try {
      if (value === "__create__") {
        setManageOpen(true);
        return;
      }
      setSavingUid(student.uid);
      if (value === "__unassigned__") {
        await assignStudentToClass(student.uid, null, null);
        setStudents((prev) =>
          prev.map((s) => (s.uid === student.uid ? { ...s, classId: null, className: null } : s)),
        );
        toast({ title: "Updated", description: `${student.name} is now unassigned.` });
      } else {
        const cls = classes.find((c) => c.id === value);
        await assignStudentToClass(student.uid, cls?.id ?? null, cls?.name ?? null);
        setStudents((prev) =>
          prev.map((s) =>
            s.uid === student.uid ? { ...s, classId: cls?.id ?? null, className: cls?.name ?? null } : s,
          ),
        );
        toast({ title: "Updated", description: `${student.name} assigned to ${cls?.name}.` });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to update assignment.", variant: "destructive" });
    } finally {
      setSavingUid(null);
    }
  };

  const refreshClasses = async () => {
    setLoadingClasses(true);
    try {
      const cls = await getClasses();
      setClasses(cls);
    } finally {
      setLoadingClasses(false);
    }
  };

  const addClass = async () => {
    const name = newClassName.trim();
    if (!name) return;
    try {
      await createClass(name, user?.uid);
      setNewClassName("");
      await refreshClasses();
      toast({ title: "Class created", description: `"${name}" added.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to create class.", variant: "destructive" });
    }
  };

  const startEdit = (c: ClassItem) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    try {
      await renameClass(editingId, name, user?.uid);
      setEditingId(null);
      setEditingName("");
      await refreshClasses();
      toast({ title: "Class renamed", description: "Changes saved." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to rename class.", variant: "destructive" });
    }
  };

  const removeClass = async (id: string) => {
    try {
      await deleteClass(id);
      await refreshClasses();
      toast({
        title: "Class deleted",
        description: "Note: students remain assigned until you unassign them.",
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete class.", variant: "destructive" });
    }
  };

  const openDelete = (uid: string, name: string) => {
    setPendingDelete({ uid, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { uid, name } = pendingDelete;
    setDeletingUid(uid);
    try {
      await deleteStudent(uid);
      setStudents((prev) => prev.filter((s) => s.uid !== uid));
      toast({ title: "Deleted", description: `${name} has been removed.` });
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete student.", variant: "destructive" });
    } finally {
      setDeletingUid(null);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const collapseAll = () => setCollapsed(new Set(groupKeys));
  const expandAll = () => setCollapsed(new Set());
  const allCollapsed = collapsed.size > 0 && collapsed.size === groupKeys.length;

  return (
    <Card>
      <CardContent className="p-0 overflow-x-hidden">
        {/* Toolbar */}
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
              {/* Search */}
              <div className="grid w-full md:max-w-sm gap-1.5">
                <Label htmlFor="student-search" className="text-xs md:text-sm">
                  Search
                </Label>
                <Input
                  id="student-search"
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Sort */}
              <div className="grid w-full md:w-64 gap-1.5">
                <Label htmlFor="sort-key" className="text-xs md:text-sm">
                  Sort by
                </Label>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger id="sort-key" className="w-full">
                    <SelectValue placeholder="Sort…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                    <SelectItem value="email-asc">Email (A–Z)</SelectItem>
                    <SelectItem value="email-desc">Email (Z–A)</SelectItem>
                    <SelectItem value="class-asc">Class (A–Z)</SelectItem>
                    <SelectItem value="class-desc">Class (Z–A)</SelectItem>
                    <SelectItem value="classnum-asc">Class # (1→9)</SelectItem>
                    <SelectItem value="classnum-desc">Class # (9→1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Spacer */}
              <div className="md:ml-auto" />

              {/* Manage Classes */}
              <Button
                onClick={() => setManageOpen(true)}
                className="bg-[rgba(32,43,96,1)] text-white hover:bg-[rgba(28,38,86,1)] focus-visible:ring-[rgba(32,43,96,1)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage classes
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading…" : `${totalCount} result${totalCount === 1 ? "" : "s"}`}
              </p>
              <div className="flex items-center gap-2">
                {groupedByClass.length > 1 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={collapseAll} disabled={allCollapsed}>
                      Collapse all
                    </Button>
                    <Button variant="ghost" size="sm" onClick={expandAll} disabled={collapsed.size === 0}>
                      Expand all
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="h-[2px] bg-[rgba(32,43,96,1)]" />

        {loading ? (
          <div className="flex justify-center items-center p-8 text-muted-foreground h-48">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Loading students...</p>
          </div>
        ) : groupedByClass.length > 0 ? (
          <Table className="table-fixed w-full">
            <TableHeader className="bg-[rgba(32,43,96,0.05)]"></TableHeader>
            <TableBody>
              {groupedByClass.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                return (
                  <Fragment key={`grp-${group.key}`}>
                    <TableRow className="bg-transparent hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <div className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            className="relative w-full flex items-center justify-between rounded-md border bg-card/50 hover:bg-card transition-colors px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgba(32,43,96,1)]"
                            aria-expanded={!isCollapsed}
                            aria-controls={`group-${group.key}`}
                          >
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-0 top-0 h-full w-1.5 rounded-l-md bg-[rgba(32,43,96,1)]"
                            />
                            <div className="flex items-center gap-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(32,43,96,0.12)]">
                                <Layers className="h-4 w-4 text-[rgba(32,43,96,1)]" />
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-semibold text-sm sm:text-base">{group.title}</span>
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] sm:text-xs text-muted-foreground bg-background">
                                  {group.items.length} student{group.items.length === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>

                            <ChevronDown
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                isCollapsed ? "" : "rotate-180"
                              }`}
                            />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    <TableRow className="bg-transparent hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0">
                        <Collapse show={!isCollapsed}>
                          <div className="px-3 pt-2 pb-3" id={`group-${group.key}`}>
                            <div className="rounded-lg border border-[rgba(32,43,96,0.15)] bg-white/60 dark:bg-white/5 shadow-sm overflow-hidden">
                              <div className="hidden md:grid grid-cols-[1.5fr_2fr_16rem_4rem] gap-3 px-4 py-2.5 bg-[rgba(32,43,96,0.04)] border-b border-[rgba(32,43,96,0.12)] text-[rgba(32,43,96,0.85)] text-xs font-semibold uppercase tracking-wide">
                                <div>Name</div>
                                <div>Email</div>
                                <div>Class</div>
                                <div className="text-right">Actions</div>
                              </div>

                              <div className="divide-y divide-[rgba(32,43,96,0.08)]">
                                {group.items.map((student) => {
                                  const current = currentClassById(student.classId ?? undefined);
                                  const value = student.classId ?? "__unassigned__";
                                  const saving = savingUid === student.uid;
                                  const isDeleting = deletingUid === student.uid;

                                  return (
                                    <div
                                      key={student.uid}
                                      className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr_16rem_4rem] gap-3 px-4 py-3 hover:bg-[rgba(32,43,96,0.03)] transition-colors"
                                    >
                                      <div onClick={() => handleRowClick(student.uid)} className="flex items-center gap-3 cursor-pointer">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                        <span className="leading-none">{student.name}</span>
                                      </div>

                                      <div onClick={() => handleRowClick(student.uid)} className="hidden md:flex items-center cursor-pointer">
                                        <span className="block truncate max-w-[420px] text-muted-foreground">{student.email}</span>
                                      </div>

                                      <div className="flex items-center">
                                        <div className="flex w-full items-center gap-2">
                                          <Select
                                            value={value}
                                            onValueChange={(v) => handleAssign(student, v)}
                                            disabled={saving || loadingClasses}
                                          >
                                            <SelectTrigger className="w-full border-[rgba(32,43,96,0.35)] focus:ring-[rgba(32,43,96,0.45)]">
                                              <SelectValue placeholder="Assign to class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                              {classes.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                  {c.name}
                                                </SelectItem>
                                              ))}
                                              <SelectItem value="__create__">+ Create new class…</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-end">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label="Delete student"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDelete(student.uid, student.name);
                                          }}
                                          disabled={isDeleting}
                                        >
                                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                      </div>

                                      {current?.name ? (
                                        <div className="md:hidden col-span-1 text-xs text-muted-foreground -mt-1">
                                          Assigned to: {current.name}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground p-8">
            <p>No students found.</p>
          </div>
        )}
      </CardContent>

      {/* Manage Classes Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage classes</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New class name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
              <Button onClick={addClass} disabled={!newClassName.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <Separator className="bg-[rgba(32,43,96,0.3)]" />

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {loadingClasses ? (
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
              ) : classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes yet.</p>
              ) : (
                classes.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    {editingId === c.id ? (
                      <>
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="flex-1" />
                        <Button size="sm" onClick={saveEdit} disabled={!editingName.trim()}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 px-3 py-2 rounded border bg-[rgba(32,43,96,0.05)]">{c.name}</div>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)} aria-label="Rename">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeClass(c.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{pendingDelete?.name}</strong> from the database. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingUid}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={!!deletingUid}>
              {deletingUid ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
