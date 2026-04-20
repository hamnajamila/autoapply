"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

type FormValues = z.infer<typeof Schema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="cinematic-auth-shell px-4 py-10">
      <Card className="cinematic-panel mx-auto w-full max-w-lg">
        <CardContent className="p-8 text-center text-sm text-slate-300/80">Loading password reset form...</CardContent>
      </Card>
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { password: "", confirmPassword: "" }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post("/api/auth/reset-password", {
        token,
        password: values.password
      });
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      form.reset();
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error?.response?.data?.error ?? error?.message ?? "The reset link is invalid or expired.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="cinematic-auth-shell px-4 py-10">
      <Card className="cinematic-panel mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Set a new password</CardTitle>
          <p className="text-sm text-slate-300/85">Choose a new password for your AutoApply account.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">This reset link is missing a token.</div> : null}
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Input className="border-white/15 bg-white/5" type="password" placeholder="New password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password?.message ? <div className="text-xs text-rose-300">{form.formState.errors.password.message}</div> : null}
            <Input className="border-white/15 bg-white/5" type="password" placeholder="Confirm password" autoComplete="new-password" {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword?.message ? <div className="text-xs text-rose-300">{form.formState.errors.confirmPassword.message}</div> : null}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
              disabled={form.formState.isSubmitting || !token}
            >
              {form.formState.isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
          <div className="text-sm text-slate-300">
            Return to{" "}
            <Link className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline" href="/login">
              sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
