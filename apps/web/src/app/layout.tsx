import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { QueryProvider } from "../components/providers/QueryProvider";
import { AuthProvider } from "../components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "AutoApply",
  description: "Autonomous AI job application agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={GeistSans.className}>
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

