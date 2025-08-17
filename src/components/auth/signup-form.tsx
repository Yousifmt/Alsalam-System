"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const auth = getAuth(app);

// Keep your existing admin code logic
const ADMIN_pass = "sy0-701-admin";

// Student code (case-insensitive). You can also set NEXT_PUBLIC_STUDENT_CODE to override.
const STUDENT_CODE =
  (process.env.NEXT_PUBLIC_STUDENT_CODE as string | undefined) ?? "sy0-701";

const normalize = (s: string) => s.trim().toLowerCase();

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();

  // form state
  const [role, setRole] = useState<"student" | "admin">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [studentCode, setStudentCode] = useState("");
  const [adminCode, setAdminCode] = useState("");

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  // ui state
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }

    // ---- Access-code checks BEFORE creating the user ----
    if (role === "admin") {
      if (adminCode !== ADMIN_pass) {
        setError("Invalid admin code.");
        return;
      }
    } else {
      // role === "student" -> case-insensitive check for sy0-701
      if (normalize(studentCode) !== normalize(STUDENT_CODE)) {
        setError("Invalid student access code.");
        return;
      }
    }

    setLoading(true);
    try {
      // Create the Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // Save user profile with chosen role
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          name,
          role, // "student" or "admin"
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: "Account Created!",
        description: "Welcome to Al-Salam Training Center.",
      });
      router.push("/dashboard");
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setError("This email address is already in use. Please use a different email or log in.");
      } else {
        setError(err?.message ?? "Failed to sign up.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Role toggle (kept as before) */}
      <div className="space-y-2">
        <Label>Role</Label>
        <RadioGroup
          value={role}
          onValueChange={(value) => setRole(value as "student" | "admin")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="student" id="r1" />
            <Label htmlFor="r1">Student</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="admin" id="r2" />
            <Label htmlFor="r2">Admin</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Admin Code (shown only if Admin) */}
      {role === "admin" && (
        <div className="space-y-2">
          <Label htmlFor="admin-code">Admin Code</Label>
          <Input
            id="admin-pass"
            type="password"
            placeholder="Enter admin password"
            required
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />
        </div>
      )}

      {/* Student Access Code (shown only if Student) */}
      {role === "student" && (
        <div className="space-y-2">
          <Label htmlFor="student-code">Student Access Code</Label>
          <Input
            id="student-code"
            type="password"
            placeholder="Enter code (e.g. SY0-701)"
            required
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repeat-password">Repeat Password</Label>
        <div className="relative">
          <Input
            id="repeat-password"
            type={showRepeatPassword ? "text" : "password"}
            required
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowRepeatPassword(!showRepeatPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            aria-label={showRepeatPassword ? "Hide repeated password" : "Show repeated password"}
          >
            {showRepeatPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
      </Button>
    </form>
  );
}
