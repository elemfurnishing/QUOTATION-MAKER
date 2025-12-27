"use client"

import { useAuth } from "@/src/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function useAuthGuard(requiredRole?: string) {
  const { isAuthenticated, user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return // Don't redirect while loading

    if (isAuthenticated === false) {
      router.push("/login")
      return
    }

    if (requiredRole && user?.role !== requiredRole) {
      router.push("/")
    }
  }, [isAuthenticated, user, requiredRole, router, isLoading])

  return { isAuthenticated, user }
}
