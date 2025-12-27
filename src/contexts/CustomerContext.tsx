"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Quotation } from "@/src/types/index"


interface CustomerContextType {
  quotations: Quotation[]
  updateQuotationStatus: (id: string, status: "approved" | "rejected") => void
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [quotations, setQuotations] = useState<Quotation[]>([])

  useEffect(() => {
    setQuotations([])
  }, [])

  const updateQuotationStatus = (id: string, status: "approved" | "rejected") => {
    const updated = quotations.map((q) => (q.id === id ? { ...q, status } : q))
    setQuotations(updated)
    localStorage.setItem("customer-quotations", JSON.stringify(updated))
  }

  return <CustomerContext.Provider value={{ quotations, updateQuotationStatus }}>{children}</CustomerContext.Provider>
}

export function useCustomer() {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error("useCustomer must be used within CustomerProvider")
  }
  return context
}
