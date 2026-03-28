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
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
type FormValues = z.infer<typeof Schema>;

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    const tokenFromOAuth = new URLSearchParams(window.location.search).get("token");
    if (tokenFromOAuth) {
      localStorage.setItem("autoapply_token", tokenFromOAuth);
      window.history.replaceState({}, "", "/login");
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const existing = localStorage.getItem("autoapply_token");
    if (existing) router.replace("/dashboard");
  }, [router]);

  const form = useForm<FormValues>({ resolver: zodResolver(Schema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post("/api/auth/login", values);
      const token = String(res.data?.token ?? "");
      if (!token) throw new Error("Missing token");
      localStorage.setItem("autoapply_token", token);
      toast({ title: "Signed in", description: "Welcome back." });
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Sign in failed";
      form.setError("password", { message: msg });
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full bg-[#6366f1] hover:bg-[#5558e6]"
            onClick={() =>
              (window.location.href = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/auth/linkedin`)
            }
          >
            Sign in with LinkedIn
          </Button>
          <div className="flex items-center gap-3">
            <Separator className="flex-1 bg-white/10" />
            <div className="text-xs text-white/60">or</div>
            <Separator className="flex-1 bg-white/10" />
          </div>

          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
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
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-sm text-white/70">
            Don&apos;t have an account?{" "}
            <Link className="text-indigo-300 hover:underline" href="/register">
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

