
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

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      setError(error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input 
              id="password" 
              type={showPassword ? "text" : "password"}
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="pr-10"
          />
           <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button 
        type='submit' 
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : 'Login'}
      </Button>
    </form>
  );
}
