// FILE: app/dashboard/questions-analyzer/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Cpu } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   Animations
──────────────────────────────────────────────────────────────────────────── */
const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { type: "tween", staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: "tween", duration: 0.45, ease: [0.22, 0.61, 0.36, 1] } },
};

/* ────────────────────────────────────────────────────────────────────────────
   Course + password setup (same codes used elsewhere)
──────────────────────────────────────────────────────────────────────────── */
type StudentCourseTag = "security+" | "a+";
const COURSE_PASSWORDS: Record<StudentCourseTag, string> = {
  "security+": "sy0-701",
  "a+": "202-1201",
};

export default function QuestionsAnalyzerPage() {
  const { role, user } = useAuth();

  const [courseTag, setCourseTag] = useState<StudentCourseTag | null>(null);
  const [loading, setLoading] = useState(true);

  // first-time chooser
  const [showChooser, setShowChooser] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<StudentCourseTag | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Load student's saved course tag (Security+ or A+). If none → show chooser.
  useEffect(() => {
    const run = async () => {
      try {
        if (role === "student" && user) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists() ? (snap.data() as any) : {};
          const tag = data?.courseTag;
          if (tag === "security+" || tag === "a+") {
            setCourseTag(tag);
            setShowChooser(false);
          } else {
            setCourseTag(null);
            setShowChooser(true); // ← show chooser if not chosen yet
          }
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [role, user]);

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
      setCourseTag(pendingCourse);
      setShowChooser(false);
      setPwDialogOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save your course. Please try again.");
    } finally {
      setPwSubmitting(false);
    }
  }

  const isSecurityStudent = role === "student" && courseTag === "security+";
  const isAPlusStudent = role === "student" && courseTag === "a+";

  return (
    <motion.div
      className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-10"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 className="font-headline text-4xl sm:text-5xl font-extrabold" variants={itemUp}>
        <span className="text-accent">Al-Salam</span>{" "}
        <span className="font-normal text-black dark:text-white">Questions Analyser</span>
      </motion.h1>

      {/* If the student hasn't chosen a course yet, show the SAME chooser UX used elsewhere */}
      {role === "student" && !loading && showChooser ? (
        <motion.div className="w-full max-w-2xl" variants={itemUp}>
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
          </Card>

          {/* Password dialog */}
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
        </motion.div>
      ) : (
        // Otherwise, show the analyzer button accordingly
        <motion.div variants={itemUp}>
  {role === "admin" ? (
    // ADMIN: show BOTH buttons with staggered animation
    <motion.div variants={container} className="flex flex-col items-center gap-3">
      <motion.div variants={itemUp}>
        <Button
          asChild
          className="bg-blue-900 text-white px-6 py-4 text-base rounded-md shadow-md hover:bg-blue-800 hover:shadow-lg transition-all duration-200"
        >
          <Link
            href="https://al-salam-questions-analyzer.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Security+ Analyser
          </Link>
        </Button>
      </motion.div>

      <motion.div variants={itemUp}>
        <Button
          asChild
          className="bg-blue-900 text-white px-6 py-4 text-base rounded-md shadow-md hover:bg-blue-800 hover:shadow-lg transition-all duration-200"
        >
          <Link
            href="https://al-salam-questions-analyzer-a.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            A+ Analyser
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  ) : (
    // STUDENTS: keep existing behavior, but ensure each button keeps its animation
    <>
      {isSecurityStudent && (
        <motion.div variants={itemUp}>
          <Button
            asChild
            className="bg-blue-900 text-white px-6 py-4 text-base rounded-md shadow-md hover:bg-blue-800 hover:shadow-lg transition-all duration-200"
          >
            <Link
              href="https://al-salam-questions-analyzer.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Security+ Analyser
            </Link>
          </Button>
        </motion.div>
      )}

      {isAPlusStudent && (
        <motion.div variants={itemUp}>
          <Button
            asChild
            className="bg-blue-900 text-white px-6 py-4 text-base rounded-md shadow-md hover:bg-blue-800 hover:shadow-lg transition-all duration-200"
          >
            <Link
              href="https://al-salam-questions-analyzer-a.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              A+ Analyser
            </Link>
          </Button>
        </motion.div>
      )}
    </>
  )}
</motion.div>
      )}
    </motion.div>
  );
}
