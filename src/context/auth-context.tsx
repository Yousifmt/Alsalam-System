"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

type Role = "admin" | "student" | null;

// ---- NEW: shape for user profile pulled from Firestore
type UserProfile = {
  name?: string;
  email?: string;
  courseTag?: string;
} | null;

interface AuthContextType {
  user: User | null;
  role: Role;
  loading: boolean;
  logout: () => void;
  // ---- NEW: expose profile so pages can read DB fields (like `name`)
  profile: UserProfile;
}

const auth = getAuth(app);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profile, setProfile] = useState<UserProfile>(null); // NEW
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setUser(user);
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setRole((data?.role as Role) ?? "student");
            // ---- NEW: save DB profile fields
            setProfile({
              name: data?.name ?? undefined,
              email: data?.email ?? undefined,
              courseTag: data?.courseTag ?? undefined,
            });
          } else {
            setRole("student");
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user role/profile:", error);
          setRole("student");
          setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setRole(null);
        setProfile(null); // NEW
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = () => {
    signOut(auth).then(() => {
      router.push("/");
    });
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout, profile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
