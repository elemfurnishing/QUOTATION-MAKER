"use client";

import type React from "react";
import { EmployeeProvider } from "@/src/contexts/EmployeeContext";
import { AdminProvider } from "@/src/contexts/AdminContext";
import { EmployeeSidebar } from "@/src/components/employee/EmployeeSidebar";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { useEffect, useState } from "react";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthGuard("employee");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div style={{ color: "#6b7280", fontSize: "1.125rem" }}>Loading...</div>
      </div>
    );
  }

  return (
    <AdminProvider>
      <EmployeeProvider>
        <div className="flex min-h-screen w-full relative">
          {/* Fixed Sidebar */}
          <div className="fixed inset-y-0 left-0 z-30">
            <EmployeeSidebar />
          </div>

          {/* Scrollable Content */}
          <main className="flex-1 min-h-screen overflow-y-auto bg-white p-4 md:p-6 ml-0 md:ml-[14rem] pt-16 md:pt-6">
            <div className="max-w-7xl mx-auto w-full">{children}</div>
          </main>
        </div>
      </EmployeeProvider>
    </AdminProvider>
  );
}
