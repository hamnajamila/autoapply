"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { signIn } from "next-auth/react";

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

  const onSubmit = async (values: FormValues) => {
    await api.post("/api/auth/register", { name: values.name, email: values.email, password: values.password });
    const res = await signIn("credentials", { email: values.email, password: values.password, redirect: false });
    if (res?.ok) router.push("/onboarding");
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Name</div>
              <Input className="bg-white/5 border-white/10" {...form.register("name")} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Email</div>
              <Input className="bg-white/5 border-white/10" {...form.register("email")} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Password</div>
              <Input className="bg-white/5 border-white/10" type="password" {...form.register("password")} />
              {form.formState.errors.password?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.password.message}</div>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Confirm password</div>
              <Input className="bg-white/5 border-white/10" type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.confirmPassword.message}</div>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create account"}
            </Button>
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

