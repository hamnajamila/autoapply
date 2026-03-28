"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const Schema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

type FormValues = z.infer<typeof Schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
  });
  const password = form.watch("password");
  const confirmPassword = form.watch("confirmPassword");

  useEffect(() => {
    const existing = localStorage.getItem("autoapply_token");
    if (existing) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post("/api/auth/register", { name: values.name, email: values.email, password: values.password });
      const token = String(res.data?.token ?? "");
      if (!token) throw new Error("Missing token");
      localStorage.setItem("autoapply_token", token);
      toast({ title: "Registered", description: "Welcome! Let's set up your profile." });
      router.replace("/onboarding");
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? err?.message ?? "Registration failed";
      if (status === 409) {
        form.setError("email", { message: "Email already in use. Try signing in instead." });
      }
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    }
  };

  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Contains a letter", valid: /[A-Za-z]/.test(password) },
    { label: "Contains a number", valid: /\d/.test(password) },
    { label: "Passwords match", valid: password.length > 0 && password === confirmPassword }
  ];

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <p className="text-sm text-white/60">Create your AutoApply workspace and start automating your job search.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Name</div>
              <Input className="bg-white/5 border-white/10" autoComplete="name" {...form.register("name")} />
              {form.formState.errors.name?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.name.message}</div>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Email</div>
              <Input className="bg-white/5 border-white/10" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.email.message}</div>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Password</div>
              <Input className="bg-white/5 border-white/10" autoComplete="new-password" type="password" {...form.register("password")} />
              {form.formState.errors.password?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.password.message}</div>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Confirm password</div>
              <Input
                className="bg-white/5 border-white/10"
                autoComplete="new-password"
                type="password"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.confirmPassword.message}</div>
              ) : null}
            </div>
            {password ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                <div className="mb-2 font-medium text-white/80">Password checks</div>
                <div className="space-y-1">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className={check.valid ? "text-emerald-300" : "text-white/60"}>
                      {check.valid ? "✓" : "•"} {check.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create account"}
            </Button>
            {!form.formState.isValid && form.formState.isSubmitted ? (
              <div className="text-xs text-rose-300 text-center">Please fix errors above</div>
            ) : null}
          </form>

          <div className="text-sm text-white/70">
            Already have an account?{" "}
            <Link className="text-indigo-300 hover:underline" href="/login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

