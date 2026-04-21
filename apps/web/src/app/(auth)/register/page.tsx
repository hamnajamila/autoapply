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
import { getUsableStoredAuthToken, setStoredAuthToken } from "@/lib/auth-client";
import { toast } from "@/hooks/use-toast";

const Schema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

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
    const existing = getUsableStoredAuthToken();
    if (existing) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post("/api/auth/register", {
        name: values.name,
        email: values.email,
        password: values.password
      });
      const token = String(res.data?.token ?? "");
      if (!token) throw new Error("Missing token");
      setStoredAuthToken(token);
      toast({ title: "Registered", description: "Welcome. Let's set up your profile." });
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

  const checks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Contains a letter", valid: /[A-Za-z]/.test(password) },
    { label: "Contains a number", valid: /\d/.test(password) },
    { label: "Passwords match", valid: password.length > 0 && password === confirmPassword }
  ];

  return (
    <div className="cinematic-auth-shell px-4 py-10">
      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="cinematic-panel hidden lg:flex lg:flex-col lg:justify-between">
          <CardHeader>
            <CardTitle className="text-3xl font-semibold leading-tight">Build Your AutoApply Command Deck</CardTitle>
            <p className="mt-2 text-sm text-slate-300/90">
              One account gives you profile parsing, portal orchestration, and status visibility across every run.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300/90">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              Secure credential encryption and controlled automation from day one.
            </div>
            <div className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-4">
              Match scoring and form fill decisions stay field-agnostic across every profession.
            </div>
          </CardContent>
        </Card>

        <Card className="cinematic-panel">
          <CardHeader>
            <CardTitle className="text-3xl">Create account</CardTitle>
            <p className="text-sm text-slate-300/85">Set up your workspace and continue to onboarding.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Name</div>
                <Input className="border-white/15 bg-white/5" autoComplete="name" {...form.register("name")} />
                {form.formState.errors.name?.message ? <div className="text-xs text-rose-300">{form.formState.errors.name.message}</div> : null}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Email</div>
                <Input className="border-white/15 bg-white/5" autoComplete="email" {...form.register("email")} />
                {form.formState.errors.email?.message ? <div className="text-xs text-rose-300">{form.formState.errors.email.message}</div> : null}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Password</div>
                <Input className="border-white/15 bg-white/5" autoComplete="new-password" type="password" {...form.register("password")} />
                {form.formState.errors.password?.message ? (
                  <div className="text-xs text-rose-300">{form.formState.errors.password.message}</div>
                ) : null}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Confirm password</div>
                <Input className="border-white/15 bg-white/5" autoComplete="new-password" type="password" {...form.register("confirmPassword")} />
                {form.formState.errors.confirmPassword?.message ? (
                  <div className="text-xs text-rose-300">{form.formState.errors.confirmPassword.message}</div>
                ) : null}
              </div>

              {password ? (
                <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                  <div className="mb-2 font-medium text-slate-100">Password checks</div>
                  <div className="space-y-1">
                    {checks.map((check) => (
                      <div key={check.label} className={check.valid ? "text-emerald-300" : "text-slate-300/85"}>
                        [{check.valid ? "OK" : "  "}] {check.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Creating..." : "Create account"}
              </Button>
              {!form.formState.isValid && form.formState.isSubmitted ? (
                <div className="text-center text-xs text-rose-300">Please fix the highlighted fields.</div>
              ) : null}
            </form>

            <div className="text-sm text-slate-300">
              Already have an account?{" "}
              <Link className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline" href="/login">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
