"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const auth = getAuth(app);

// Simple email regex + helper to remove invisible bidi chars
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const stripBidi = (s: string) =>
  s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Sanitize inputs
    const emailClean = stripBidi(email).trim().toLowerCase();
    const passwordClean = password.trim();

    // Validate before hitting Firebase (prevents auth/invalid-email)
    if (!EMAIL_RE.test(emailClean)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (!passwordClean) {
      setError("Password cannot be empty.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, emailClean, passwordClean);
      router.push("/dashboard");
    } catch (err: any) {
      const code = err?.code ?? "auth/unknown";
      const map: Record<string, string> = {
        "auth/invalid-email": "Invalid email address.",
        "auth/invalid-credential": "Invalid email or password.",
        "auth/user-disabled": "This account has been disabled.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Wrong password.",
      };
      setError(map[code] ?? `Sign-in failed: ${code}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isEmailValid = EMAIL_RE.test(stripBidi(email).trim().toLowerCase());

  return (
    <form onSubmit={handleLogin} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          dir="ltr"
          lang="en"
          pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(stripBidi(e.target.value))}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        disabled={loading || !isEmailValid}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
      </Button>
    </form>
  );
}
