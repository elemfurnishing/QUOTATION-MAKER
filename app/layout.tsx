import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { EmployeeProvider } from "@/src/contexts/EmployeeContext";
import Footer from "@/components/layout/Footer";

const geistSans = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Furniture Quotation System",
  description: "Dynamic furniture business management system",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.className} bg-background text-foreground flex flex-col min-h-screen`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <EmployeeProvider>
            <div className="flex-1 pb-16">{children}</div>
            <Footer />
          </EmployeeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
