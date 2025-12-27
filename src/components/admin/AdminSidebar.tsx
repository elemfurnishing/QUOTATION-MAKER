"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { BarChart3, Users, FileText, LogOut, Menu, X } from "lucide-react";

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  // Full list of available items
  const allNavItems = [
    { href: "/admin", label: "Dashboard", icon: BarChart3 },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/quotations", label: "Quotations", icon: FileText },
    { href: "/admin/settings", label: "Settings", icon: Users },
  ];

  // Filter based on allowed pages from Login sheet
  const navItems = allNavItems.filter((item) => {
    // If no pages array defined, show all (fallback) or hide? User requested specific pages.
    // If pages is defined, check if label is included.
    if (user?.pages && user.pages.length > 0) {
      console.log(`[Sidebar] User has pages defined:`, user.pages);
      console.log(`[Sidebar] Checking item: ${item.label}`);
      
      const hasAccess = user.pages.some(
        (page) => page.toLowerCase().trim() === item.label.toLowerCase().trim()
      );
      
      console.log(`[Sidebar] Match result for ${item.label}: ${hasAccess}`);
      return hasAccess;
    }
    
    // Fallback: If pages is explicitly empty array [] -> show nothing? 
    // Or if undefined -> show all?
    // Current logic: undefined/empty -> show all. 
    // However, if the user has NO pages assigned in Sheet, user.pages might be [].
    // Let's verify if user.pages exists.
    if (user?.pages && user.pages.length === 0) { 
        console.log(`[Sidebar] User has empty pages list. Hiding ${item.label}`);
        return false; 
    }

    // Default: Show all if no restrictions found
    return true;
  });

  const NavLinks = () => (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${isActive(href)
              ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
              : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            }`}
        >
          <Icon
            className={`w-5 h-5 mr-3 transition-transform ${isActive(href) ? "scale-110" : "group-hover:scale-110"
              }`}
          />
          {label}
        </Link>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ELEM FURNITURE
        </h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          {mobileOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 z-40
          w-64 
          bg-white/80 backdrop-blur-sm border-r border-white/20 shadow-lg
          p-6 overflow-y-auto
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
          top-16 lg:top-0
          h-[calc(100vh-4rem)] lg:h-screen
        `}
      >
        {/* Logo & Title - Desktop */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ELEM FURNITURE
          </h1>
          <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          <NavLinks />
        </nav>

        {/* Logout Button */}
        <div className="pt-4 border-t border-gray-100 mt-85 lg:mt-auto">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 gap-2"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
