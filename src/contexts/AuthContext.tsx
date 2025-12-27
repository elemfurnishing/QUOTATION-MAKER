"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { User, AuthContextType } from "@/src/types/index";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Sync user state changes to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user));
    } else {
      // Only remove if authenticated state is explicitly false or null
      // But we handle logout separately. This hook runs on mount too.
      // We should be careful not to wipe it on initial empty state.
    }
  }, [user]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Fetch users from the "Login" sheet
      const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";
      const response = await fetch(`${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=Login`);
      const json = await response.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("Failed to fetch user directory");
      }

      // Sheet columns based on user image:
      // Row[0]: User Name (Display Name)
      // Row[1]: User ID
      // Row[2]: Password
      // Row[3]: Role
      // Row[4]: Page (Allowed Pages)

      const rows: any[][] = json.data.slice(1); // Skip header
      console.log(`Sheet returned ${rows.length} users.`);

      console.log("Attempting login for:", username);
      let usernameFound = false;

      const matchedRow = rows.find((row) => {
        const rowAny = row as any;
        const sheetUserID = String(rowAny[1] || "").trim(); // Col B: User ID

        // Match against User ID (Col B)
        const isUserIDMatch = sheetUserID.toLowerCase() === username.toLowerCase().trim();

        if (isUserIDMatch) {
          usernameFound = true;
          // Strict password check against Col C
          const sheetPassword = String(rowAny[2] || "").trim();
          const isPasswordMatch = sheetPassword === password.trim();
          
          if (!isPasswordMatch) {
            console.warn(`❌ Password mismatch for user [${sheetUserID}]`);
          }
          return isPasswordMatch;
        }
        return false;
      });

      if (matchedRow) {
        const rowAny = matchedRow as any;
        const name = String(rowAny[0] || "User"); // Col A: User Name
        const roleStr = String(rowAny[3] || "employee").toLowerCase(); // Col D: Role
        const pagesRaw = String(rowAny[4] || ""); // Col E: Page

        console.log("Raw Pages Cell Content:", pagesRaw);
        
        // Parse pages: split by comma, pipe, or newline
        const pages = pagesRaw
          .split(/[,|\n]+/)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        console.log("Parsed Allowed Pages:", pages);

        // Normalize role to "admin" | "employee" | "customer"
        let role: "admin" | "employee" | "customer" = "employee";
        if (roleStr.includes("admin")) role = "admin";
        else if (roleStr.includes("customer")) role = "customer";
        else role = "employee"; 

        const validUser: User = {
          id: `user-${username}`,
          name: name,
          email: `${username}@furniture.com`,
          phone: "",
          role: role,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          createdAt: new Date().toISOString(),
          pages: pages
        };

        setUser(validUser);
        setIsAuthenticated(true);
        localStorage.setItem("currentUser", JSON.stringify(validUser));
        console.log("✅ Login successful via Sheet:", validUser);
      } else {
        if (usernameFound) {
          console.warn("❌ Login failed: Password incorrect for", username);
          throw new Error("Password incorrect");
        } else {
          console.warn("❌ Login failed: Username not found for", username);
          throw new Error("Username not found");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("currentUser");
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
