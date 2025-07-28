import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MockAuthProvider } from '@/lib/auth/mock-auth';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workflow Automation Platform",
  description: "AI-powered workflow automation made simple",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <MockAuthProvider>
          {children}
        </MockAuthProvider>
      </body>
    </html>
  );
}
