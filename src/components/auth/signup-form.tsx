
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const auth = getAuth(app);
const ADMIN_CODE = "123456";

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (role === 'admin' && adminCode !== ADMIN_CODE) {
        setError("Invalid admin code.");
        setLoading(false);
        return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create a document in Firestore for the new user to store their role
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        name: name,
        role: role,
      });

      toast({ title: "Account Created!", description: "You have been successfully signed up." });
      router.push("/dashboard");

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            setError("This email address is already in use. Please use a different email or log in.");
        } else {
            setError(error.message);
        }
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <div className="space-y-2">
        <Label>Role</Label>
        <RadioGroup value={role} onValueChange={(value) => setRole(value as "student" | "admin")} className="flex gap-4">
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

      {role === 'admin' && (
        <div className="space-y-2">
            <Label htmlFor="admin-code">Admin Code</Label>
            <Input 
                id="admin-code" 
                type="password"
                placeholder="Enter admin code" 
                required 
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
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
          >
            {showRepeatPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

       {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 'Create Account'}
      </Button>
    </form>
  );
}
