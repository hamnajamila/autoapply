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

  const onSubmit = async (values: FormValues) => {
    console.log("Form submitted with values:", values);
    console.log("API URL:", process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001");
    try {
      const res = await api.post("/api/auth/register", { name: values.name, email: values.email, password: values.password });
      console.log("Register response:", res.data);
      const token = String(res.data?.token ?? "");
      if (!token) throw new Error("Missing token");
      localStorage.setItem("autoapply_token", token);
      toast({ title: "Registered", description: "Welcome! Let's set up your profile." });
      router.push("/onboarding");
    } catch (err: any) {
      console.error("Register error:", err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? err?.message ?? "Registration failed";
      if (status === 409) {
        form.setError("email", { message: "Email already in use. Try signing in instead." });
      }
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    }
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
              {form.formState.errors.name?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.name.message}</div>
              ) : null}
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">Email</div>
              <Input className="bg-white/5 border-white/10" {...form.register("email")} />
              {form.formState.errors.email?.message ? (
                <div className="text-xs text-rose-300">{form.formState.errors.email.message}</div>
              ) : null}
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
            {!form.formState.isValid && form.formState.isSubmitted ? (
              <div className="text-xs text-rose-300 text-center">Please fix errors above</div>
            ) : null}
            <Button 
              type="button" 
              variant="outline" 
              className="w-full text-xs" 
              onClick={async () => {
                try {
                  const res = await api.post("/api/auth/register", { 
                    name: "Test", 
                    email: "test@test.com", 
                    password: "password123" 
                  });
                  alert("Test successful: " + JSON.stringify(res.data));
                } catch (err: any) {
                  alert("Test failed: " + (err?.message || "Unknown error"));
                }
              }}
            >
              Test API Connection
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

