"use client";

import { useEmployee } from "@/src/contexts/EmployeeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Plus,
  TrendingUp,
  Users,
  Copy,
  BarChart3,
  Calendar,
  Search,
  Filter,
} from "lucide-react";

export default function StaffDashboard() {
  const { quotations, customers, loadingQuotations } = useEmployee();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter logic
  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const todayQuotations = quotations.filter(
    (q) => new Date(q.createdAt).toDateString() === new Date().toDateString()
  );
  const pendingQuotations = quotations.filter((q) => q.status === "draft");
  const sentQuotations = quotations.filter((q) => q.status === "sent");
  const approvedQuotations = quotations.filter((q) => q.status === "approved");
  const rejectedQuotations = quotations.filter((q) => q.status === "rejected");

  const totalRevenue = quotations.reduce((sum, q) => sum + q.total, 0);
  const monthlyRevenue = quotations
    .filter((q) => new Date(q.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, q) => sum + q.total, 0);

  const conversionRate =
    quotations.length > 0
      ? ((approvedQuotations.length / quotations.length) * 100).toFixed(1)
      : 0;



  const quickActions = [
    {
      label: "Create Quotation",
      icon: <Plus className="w-5 h-5" />,
      href: "/staff/create-quotation",
      color: "from-blue-500 to-purple-600",
    },
    {
      label: "View Customers",
      icon: <Users className="w-5 h-5" />,
      href: "/staff/customers",
      color: "from-green-500 to-teal-600",
    },
    {
      label: "Templates",
      icon: <Copy className="w-5 h-5" />,
      href: "/staff/templates",
      color: "from-orange-500 to-red-600",
    },
    {
      label: "Reports",
      icon: <BarChart3 className="w-5 h-5" />,
      href: "/staff/reports",
      color: "from-purple-500 to-pink-600",
    },
  ];

  if (loadingQuotations) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-white rounded-xl shadow-sm animate-pulse"
              />
            ))}
          </div>
          <div className="h-12 bg-white rounded-xl animate-pulse" />
          <div className="h-96 bg-white rounded-xl shadow-lg border border-white/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Optimized */}
        <div className="mb-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome, {user?.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              •{" "}
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Quick Stats - Mobile Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "Today",
              value: todayQuotations.length,
              icon: <Calendar className="w-4 h-4" />,
            },
            {
              label: "Total Customers",
              value: customers.length,
              icon: <Users className="w-4 h-4" />,
            },
            {
              label: "Total Items (Qty)",
              value: quotations.reduce(
                (acc, q) => acc + q.items.reduce((s, i) => s + i.quantity, 0),
                0
              ),
              icon: <FileText className="w-4 h-4" />,
            },
            {
              label: "Total Subtotal",
              value: `₹${quotations
                .reduce((acc, q) => acc + q.subtotal, 0)
                .toLocaleString()}`,
              icon: <TrendingUp className="w-4 h-4" />,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/90 backdrop-blur-sm border border-white/30 rounded-xl p-3 text-center shadow-sm"
            >
              <div className="flex items-center justify-center mb-1 text-slate-600">
                {stat.icon}
              </div>
              <p className="text-xs text-slate-600">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter - Mobile First */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by ID or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Recent Quotations */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Recent Quotations
            </h2>
            <span className="text-sm text-slate-600">
              {filteredQuotations.length} total
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["ID", "Customer", "Amount", "Date"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.slice(0, 10).map((quot, i) => {
                  // Resolve Customer
                  const customer = customers.find(c => c.id === quot.customerId);
                  return (
                    <tr
                      key={quot.id}
                      className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">
                        {quot.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {quot.customerId[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {customer?.name || `Customer ${quot.customerId}`}
                            </div>
                            <div className="text-xs text-slate-600">
                              {customer?.email || "No email"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        ₹{quot.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(quot.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Clean & Modern */}
          <div className="md:hidden p-4 space-y-3">
            {filteredQuotations.slice(0, 10).map((quot) => {
              const customer = customers.find(c => c.id === quot.customerId);
              return (
                <div
                  key={quot.id}
                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {quot.id}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {new Date(quot.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusBadge status={quot.status} />
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {quot.customerId[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">
                        {customer?.name || `Customer ${quot.customerId}`}
                      </div>
                      <div className="text-xs text-slate-600">
                        {customer?.email || "No email"}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-3">
                    <div className="font-bold text-slate-900">
                      ₹{quot.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredQuotations.length === 0 && (
            <div className="text-center py-12 px-4">
              <FileText className="mx-auto w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {quotations.length === 0
                  ? "No quotations yet"
                  : "No quotations found"}
              </h3>
              <p className="text-slate-600 mb-6">
                {quotations.length === 0
                  ? "Get started by creating your first quotation."
                  : "Try adjusting your search or filter criteria."}
              </p>
              <Link
                href="/staff/create-quotation"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-3 rounded-lg font-medium hover:scale-105 transition"
              >
                <Plus className="w-5 h-5" />
                Create Quotation
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}

      </div>
    </div>
  );
}

// Reusable Status Badge
function StatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    draft: {
      bg: "bg-amber-100",
      text: "text-amber-800",
      icon: <Clock className="w-3 h-3" />,
    },
    sent: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      icon: <Send className="w-3 h-3" />,
    },
    approved: {
      bg: "bg-green-100",
      text: "text-green-800",
      icon: <CheckCircle className="w-3 h-3" />,
    },
    rejected: {
      bg: "bg-red-100",
      text: "text-red-800",
      icon: <XCircle className="w-3 h-3" />,
    },
  };

  const s = styles[status] || styles.draft;

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.icon} {status}
    </span>
  );
}
