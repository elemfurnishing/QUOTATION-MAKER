"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import type { Quotation, Customer } from "@/src/types/index";
import { DUMMY_CUSTOMERS } from "@/src/utils/dummy-data";

interface EmployeeContextType {
  quotations: Quotation[];
  customers: Customer[];
  loadingCustomers: boolean;
  loadingQuotations: boolean;
  createQuotation: (quotation: Quotation) => void;
  updateQuotation: (id: string, quotation: Partial<Quotation>) => void;
  addCustomer: (customer: Customer) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(
  undefined
);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Google Sheet Integration
    const fetchCustomers = async () => {
      try {
        const SCRIPT_URL =
          "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
        const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";

        const response = await fetch(
          `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=Customers`
        );
        const json = await response.json();

        if (
          json.success &&
          json.data &&
          Array.isArray(json.data) &&
          json.data.length > 0
        ) {
          const rows = json.data.slice(1);
          if (rows.length > 0) {
            const sheetCustomers: Customer[] = rows.map((row: any[]) => ({
              id: row[1]?.toString() || `cust-${Math.random()}`,
              name: row[2]?.toString() || "Unknown",
              phone: row[3]?.toString() || "",
              whatsapp: row[4]?.toString() || "",
              email: row[5]?.toString() || "",
              tags: ["sheet"],
              assignedEmployeeId: "emp-1",
              createdAt: row[0]?.toString() || new Date().toISOString(),
              address: "",
              city: "",
              notes: "",
            }));
            setCustomers(sheetCustomers);
            setLoadingCustomers(false);
            return;
          }
        }
      } catch (err) {
        console.error(
          "Google Sheet fetch failed (EmployeeContext), falling back to empty",
          err
        );
      }

      // FALLBACK: if Google Sheet fails, set empty (no localStorage)
      setCustomers([]);
      setLoadingCustomers(false);
    };

    const fetchQuotations = async () => {
      try {
        const SCRIPT_URL =
          "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
        const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";

        const response = await fetch(
          `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=Quotation`
        );
        const json = await response.json();

        if (json.success && Array.isArray(json.data)) {
          const rows = json.data.slice(1); // Skip header

          // 1. Parse rows into raw Quotation objects
          const rawQuotations: Quotation[] = rows
            .map((row: any[], index: number) => {
              try {
                // Row structure:
                // 0: Timestamp, 1: CustomerID, ..., 6: ItemNames, 7: Images, 8: Qty, 9: Price, 10: Discount, 11: Subtotal, 12: Tax
                const timestamp = row[0] || new Date().toISOString();
                const customerId = row[1] || `unknown-${index}`;

                const itemNames = (row[6] || "").toString().split("\n"); // Col G
                const itemImages = (row[7] || "").toString().split("\n"); // Col H
                const quantities = (row[8] || "").toString().split("\n"); // Col I
                const prices = (row[9] || "").toString().split("\n"); // Col J
                const discounts = (row[10] || "").toString().split("\n"); // Col K
                // Col L (11) is Subtotal, Col M (12) is Tax%

                // Generate items with unique IDs across rows
                const items: any[] = itemNames.map((name: string, i: number) => ({
                  productId: `prod-${index}-${i}`,
                  customTitle: name,
                  quantity: Number(quantities[i]) || 1,
                  price: Number(prices[i]) || 0,
                  discount: Number(discounts[i]) || 0,
                  customPhoto: itemImages[i] || undefined,
                }));

                const subtotal = items.reduce(
                  (sum: number, item: any) => sum + item.price * item.quantity - item.discount,
                  0
                );
                const taxRate = Number(row[12]) || 18;
                const tax = Math.round((subtotal * taxRate) / 100);
                const total = subtotal + tax;

                return {
                  id: customerId, // Grouping Key
                  customerId: customerId,
                  employeeId: "emp-1",
                  items,
                  subtotal,
                  tax,
                  discount: 0,
                  total,
                  status: "sent",
                  versions: [],
                  createdAt: timestamp,
                  updatedAt: timestamp,
                } as Quotation;
              } catch (e) {
                console.error("Error parsing quotation row:", index, e);
                return null;
              }
            })
            .filter((q: Quotation | null): q is Quotation => q !== null);

          // 2. Aggregate quotations by ID
          const aggregatedMap = new Map<string, Quotation>();

          for (const q of rawQuotations) {
            if (aggregatedMap.has(q.id)) {
              const existing = aggregatedMap.get(q.id)!;

              // Merge items
              existing.items = [...existing.items, ...q.items];

              // Sum amounts
              existing.subtotal += q.subtotal;
              existing.tax += q.tax;
              existing.total += q.total;

              // Update status/timestamp if needed (taking latest)
              if (new Date(q.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                existing.updatedAt = q.updatedAt;
              }
            } else {
              aggregatedMap.set(q.id, { ...q });
            }
          }

          setQuotations(Array.from(aggregatedMap.values()));
        }
      } finally {
        setLoadingQuotations(false);
      }
    };

    fetchCustomers();
    fetchQuotations();

    setLoaded(true);
  }, []);

  const createQuotation = (quotation: Quotation) => {
    // Don't store quotations in state - they're handled by Google Sheets
    console.log("Quotation created but not stored in state:", quotation.id);
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    // Don't store quotations in state - they're handled by Google Sheets
    console.log("Quotation update ignored for:", id);
  };

  const addCustomer = async (customer: Customer) => {
    // Generate timestamp and sequential Customer ID on frontend
    const timestamp = new Date().toISOString();
    const lastId = customers.length
      ? customers.reduce((max: number, c: Customer) => {
        const match = String(c.id).match(/(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0)
      : 0;
    const nextNum = lastId + 1;
    const customerId = `CUST-${String(nextNum).padStart(4, "0")}`;

    // 1. Update Local with generated values
    const enriched = { ...customer, id: customerId, createdAt: timestamp };
    setCustomers((prev: Customer[]) => [...prev, enriched]);

    // 2. Send to Google Sheet (include timestamp + customerId in rowData)
    try {
      const SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
      const params = new URLSearchParams();
      params.append("action", "insert");
      params.append("sheetName", "Customers");
      params.append(
        "rowData",
        JSON.stringify([
          timestamp,
          customerId,
          customer.name,
          customer.phone,
          customer.whatsapp || "",
          customer.email || "",
        ])
      );

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const json = await response.json().catch(() => null);
      console.log("Customer sent to Google Sheet (Employee)", json);
    } catch (err) {
      console.error("Failed to save to Google Sheet (Employee)", err);
    }
  };

  return (
    <EmployeeContext.Provider
      value={{
        quotations,
        customers,
        loadingCustomers,
        loadingQuotations,
        createQuotation,
        updateQuotation,
        addCustomer,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error("useEmployee must be used within EmployeeProvider");
  }
  return context;
}
