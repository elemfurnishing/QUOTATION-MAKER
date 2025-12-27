"use client"

import Link from "next/link"
import { useAuth } from "@/src/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()


  useEffect(() => {
    console.log("🔄 Home page - useEffect triggered:", { isAuthenticated, user: user?.role })
    if (isAuthenticated && user) {
      console.log("🚀 Redirecting to:", user.role === "admin" ? "/admin" : user.role === "employee" ? "/staff" : "/customer")
      if (user.role === "admin") {
        router.push("/admin/customers")
      } else if (user.role === "employee") {
        router.push("/staff/customers")
      } else if (user.role === "customer") {
        router.push("/customer")
      }
    } else if (!isLoading && !isAuthenticated) {
      console.log("🔐 Home page - Not authenticated, redirecting to login")
      router.push('/login')
    }
  }, [isAuthenticated, user, router, isLoading])

  // This should not be reached due to redirect, but just in case
  console.log("⚠️ Home page - Unexpected state")
  return null
}
