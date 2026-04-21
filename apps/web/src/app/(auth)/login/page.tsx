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
import { api, getApiBaseUrl } from "@/lib/api";
import { getUsableStoredAuthToken, setStoredAuthToken } from "@/lib/auth-client";
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
      setStoredAuthToken(tokenFromOAuth);
      window.history.replaceState({}, "", "/login");
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    const existing = getUsableStoredAuthToken();
    if (existing) router.replace("/dashboard");
  }, [router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post("/api/auth/login", values);
      const token = String(res.data?.token ?? "");
      if (!token) throw new Error("Missing token");
      setStoredAuthToken(token);
      toast({ title: "Signed in", description: "Welcome back." });
      router.replace("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Sign in failed";
      form.setError("password", { message: msg });
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="cinematic-auth-shell px-4 py-10">
      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="cinematic-panel hidden h-full lg:flex lg:flex-col lg:justify-between">
          <CardHeader>
            <CardTitle className="text-3xl font-semibold leading-tight">AutoApply Mission Control</CardTitle>
            <p className="mt-2 text-sm text-slate-300/90">
              Monitor portals, trigger autonomous runs, and catch instant opportunities before everyone else.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300/90">
            <div className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-4">
              Live signal: portal checks, match scoring, and apply pipelines in one control surface.
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4">
              Every action is logged, auditable, and recoverable for real-world production reliability.
            </div>
          </CardContent>
        </Card>

        <Card className="cinematic-panel">
          <CardHeader>
            <CardTitle className="text-3xl">Sign in</CardTitle>
            <p className="text-sm text-slate-300/85">Enter your credentials to launch your automation workspace.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full border border-indigo-300/30 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-900/40 hover:from-indigo-400 hover:to-violet-400"
              onClick={() => (window.location.href = `${getApiBaseUrl().replace(/\/$/, "")}/api/auth/linkedin`)}
            >
              Continue with LinkedIn
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1 bg-white/10" />
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">or</div>
              <Separator className="flex-1 bg-white/10" />
            </div>

            <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Email</div>
                <Input className="border-white/15 bg-white/5" autoComplete="email" {...form.register("email")} />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-slate-300">Password</div>
                <Input className="border-white/15 bg-white/5" autoComplete="current-password" type="password" {...form.register("password")} />
                {form.formState.errors.password?.message ? (
                  <div className="text-xs text-rose-300">{form.formState.errors.password.message}</div>
                ) : null}
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="text-sm text-slate-300">
              Don&apos;t have an account?{" "}
              <Link className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline" href="/register">
                Create one
              </Link>
            </div>
            <div className="text-sm text-slate-300">
              Forgot your password?{" "}
              <Link className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline" href="/forgot-password">
                Reset it here
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
