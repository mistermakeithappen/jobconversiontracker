import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";

export const runtime = 'nodejs';

// Polyfill __dirname and __filename for Node.js compatibility
if (typeof global !== 'undefined' && typeof global.__dirname === 'undefined') {
  global.__dirname = process.cwd();
  global.__filename = __filename || '';
}

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
