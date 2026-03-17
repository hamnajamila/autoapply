import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { api } from "./api";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        try {
          const res = await api.post("/api/auth/login", { email, password });
          const token = String(res.data?.token ?? "");
          const user = res.data?.user;
          if (!token || !user?.id) return null;
          return { id: String(user.id), email: String(user.email), name: user.name ?? null, token } as any;
        } catch {
          return null;
        }
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = (user as any).id;
        (token as any).apiToken = (user as any).token;
        token.email = (user as any).email;
        token.name = (user as any).name;
      }
      return token;
    },
    session: async ({ session, token }) => {
      (session as any).apiToken = (token as any).apiToken;
      (session.user as any).id = token.sub;
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
});

