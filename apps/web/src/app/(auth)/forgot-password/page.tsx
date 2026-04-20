"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const Schema = z.object({
  email: z.string().email()
});

type FormValues = z.infer<typeof Schema>;

export default function ForgotPasswordPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "" }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await api.post("/api/auth/forgot-password", values);
      toast({
        title: "Reset link requested",
        description: response.data?.message ?? "If an account exists, a reset link has been sent."
      });
      form.reset();
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error?.response?.data?.error ?? error?.message ?? "Could not request a reset link.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="cinematic-auth-shell px-4 py-10">
      <Card className="cinematic-panel mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Forgot password</CardTitle>
          <p className="text-sm text-slate-300/85">Enter the email you use with AutoApply and we&apos;ll send a reset link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Input className="border-white/15 bg-white/5" placeholder="Email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email?.message ? <div className="text-xs text-rose-300">{form.formState.errors.email.message}</div> : null}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Sending link..." : "Send reset link"}
            </Button>
          </form>
          <div className="text-sm text-slate-300">
            Remembered it?{" "}
            <Link className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline" href="/login">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
