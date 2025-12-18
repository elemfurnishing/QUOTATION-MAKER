"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Customer, Product } from "@/src/types/index";
import { DUMMY_CUSTOMERS, DUMMY_PRODUCTS } from "@/src/utils/dummy-data";

interface AdminContextType {
  customers: Customer[];
  products: Product[];
  employees: any[];
  loadingCustomers: boolean;
  loadingProducts: boolean;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const employees = [
    {
      id: "emp-1",
      name: "John Sales",
      email: "employee@furniture.com",
      role: "Sales Staff",
      status: "active",
      quotations: 12,
      conversionRate: 65,
    },
    {
      id: "emp-2",
      name: "Sarah Manager",
      email: "sarah@furniture.com",
      role: "Manager",
      status: "active",
      quotations: 28,
      conversionRate: 78,
    },
  ];

  /* ==================== Load from localStorage on mount ==================== */
  useEffect(() => {
    const loadData = () => {
      try {
        // Customers: Try fetching from Google Sheet
        const fetchCustomers = async () => {
          try {
            const SCRIPT_URL =
              "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
            const SPREADSHEET_ID =
              "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";

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
              "Google Sheet fetch failed, falling back to local storage",
              err
            );
          }

          // FALLBACK: if Google Sheet fails, set empty (no localStorage)
          setCustomers([]);
          setLoadingCustomers(false);
        };

        fetchCustomers();

        // Products: if Google Sheet fetch fails, use empty (no localStorage)
        const fetchProducts = async () => {
          setProducts([]);
          setLoadingProducts(false);
        };
        fetchProducts();
      } catch (error) {
        console.error("Failed to load data:", error);
        setCustomers([]);
        setProducts([]);
        setLoadingCustomers(false);
        setLoadingProducts(false);
      }
    };

    loadData();
    setLoaded(true);
  }, []);

  /* ==================== CRUD: Customers ==================== */
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

    // 1. Optimistic UI update with generated values
    const enriched = { ...customer, id: customerId, createdAt: timestamp };
    setCustomers((prev) => [...prev, enriched]);

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
      console.log("Customer sent to Google Sheet (Admin)", json);
    } catch (err) {
      console.error("Failed to save to Google Sheet", err);
    }
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  /* ==================== CRUD: Products ==================== */
  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <AdminContext.Provider
      value={{
        customers,
        products,
        employees,
        loadingCustomers,
        loadingProducts,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addProduct,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}
