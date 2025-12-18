"use client";

import type React from "react";
import { AdminProvider } from "@/src/contexts/AdminContext";
import { AdminSidebar } from "@/src/components/admin/AdminSidebar";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthGuard("admin");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show nothing until client is mounted
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // or redirect handled in useAuthGuard
  }

  return (
    <AdminProvider>
      <div className="flex h-screen bg-white overflow-hidden">
        {/* Sidebar - Fixed on desktop, off-canvas on mobile */}
        <div className="fixed lg:static z-40">
          <AdminSidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:pl-64 w-full">
          {/* Mobile top padding for fixed header */}
          <div className="lg:hidden h-16 shrink-0" />

          {/* Page Content */}
          <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}
