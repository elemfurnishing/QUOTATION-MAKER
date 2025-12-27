"use client"

import type React from "react"
import { CustomerProvider } from "@/src/contexts/CustomerContext"
import { AdminProvider } from "@/src/contexts/AdminContext"
import { EmployeeProvider } from "@/src/contexts/EmployeeContext"
import { useAuthGuard } from "@/src/hooks/useAuthGuard"
import { useEffect, useState } from "react"
import { CustomerSidebar } from "@/src/components/customer/CustomerSidebar"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthGuard("customer")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isAuthenticated) {
    return null
  }

  return (
    <AdminProvider>
      <CustomerProvider>
        <EmployeeProvider>
          <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <CustomerSidebar />

            {/* Main Content */}
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </EmployeeProvider>
      </CustomerProvider>
    </AdminProvider>
  )
}
