
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark-blue p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BookOpenCheck className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold font-headline">
            <span className="text-accent">Al-Salam</span> <span className="text-white">Training Center</span>
          </h1>
          <p className="text-muted-foreground">
            Create an account to start learning.
          </p>
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Enter your details to create your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/"
            className="font-medium text-accent hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
