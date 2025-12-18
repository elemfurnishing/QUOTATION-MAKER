"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { User, AuthContextType } from "@/src/types/index";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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
      const response = await fetch(`${SCRIPT_URL}?sheet=Login`);
      const json = await response.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("Failed to fetch user directory");
      }

      // Sheet columns based on user image:
      // Row[0]: Name
      // Row[1]: User Name
      // Row[2]: Passwords
      // Row[3]: Role

      const rows: any[][] = json.data.slice(1); // Skip header
      console.log(`Sheet returned ${rows.length} users.`);
      if (rows.length > 0) {
        console.log("First row sample:", rows[0]);
      }
      console.log("Attempting login for:", username);
      let usernameFound = false;

      const matchedRow = rows.find((row) => {
        const rowAny = row as any;
        // Check both Name (Col 0) and User Name (Col 1)
        const sheetName = String(rowAny[0] || rowAny["Name"] || "").trim();
        const sheetUsername = String(rowAny[1] || rowAny["User Name"] || "").trim();

        // Try multiple variations of the password column header
        const sheetPassword = String(
          rowAny[2] ||
          rowAny["Passwords"] ||
          rowAny["Password"] ||
          rowAny["password"] ||
          ""
        ).trim();

        const inputLower = username.toLowerCase().trim();

        // Match against Name (Col A) OR User Name (Col B)
        const isNameMatch = sheetName.toLowerCase() === inputLower;
        const isUsernameMatch = sheetUsername.toLowerCase() === inputLower;

        if (isNameMatch || isUsernameMatch) {
          usernameFound = true;
          // Strict password check
          const isPasswordMatch = sheetPassword === password.trim();
          if (!isPasswordMatch) {
            console.warn(`❌ Password mismatch for user [${sheetUsername}]. Input [${password}] != Sheet [${sheetPassword}]`);
            console.warn("Row data for debug:", JSON.stringify(rowAny));
          }
          return isPasswordMatch;
        }
        return false;
      });

      if (matchedRow) {
        const rowAny = matchedRow as any;
        const name = String(rowAny[0] || rowAny["Name"] || "User");
        const roleStr = String(rowAny[3] || rowAny["Role"] || "employee").toLowerCase();

        console.log("Found user row:", rowAny);
        console.log("Extracted Name:", name);
        console.log("Extracted Role String:", roleStr);

        // Normalize role to "admin" | "employee" | "customer"
        let role: "admin" | "employee" | "customer" = "employee";
        if (roleStr.includes("admin")) role = "admin";
        else if (roleStr.includes("customer")) role = "customer";
        else role = "employee"; // "user" falls back to employee

        const validUser: User = {
          id: `user-${username}`,
          name: name,
          email: `${username}@furniture.com`,
          phone: "",
          role: role,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          createdAt: new Date().toISOString(),
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
