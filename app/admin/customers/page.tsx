"use client";

import type React from "react";
import { useAdmin } from "@/src/contexts/AdminContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  User,
  Mail,
  Phone,
  MessageCircle,
  Eye,
  Edit3,
  X,
  Save,
  Trash2,
  Search,
} from "lucide-react";

/* --------------------------------------------------------------------- */
/*                           MAIN PAGE COMPONENT                         */
/* --------------------------------------------------------------------- */
export default function AdminCustomersPage() {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadingCustomers,
  } = useAdmin();
  const { user } = useAuth();

  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
  const CUSTOMERS_SHEET_NAME = "Customers";

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Fallback persist
  useEffect(() => {
    try {
      localStorage.setItem("admin-customers", JSON.stringify(customers));
    } catch {}
  }, [customers]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
  });

  /* ------------------- Filtered Customers ------------------- */
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;

    const query = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      return (
        c.id.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        c.phone.includes(query) ||
        (c.whatsapp && c.whatsapp.includes(query))
      );
    });
  }, [customers, searchQuery]);

  /* ------------------- Form handling ------------------- */
  const resetForm = () => {
    setFormData({ name: "", phone: "", whatsapp: "", email: "" });
    setShowAddForm(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Name and Phone are required");
      return;
    }

    if (editingCustomer) {
      setIsSubmitting(true);
      try {
        const findCustomerRowIndex = async (customerId: string) => {
          const res = await fetch(
            `${SCRIPT_URL}?sheet=${encodeURIComponent(CUSTOMERS_SHEET_NAME)}`
          );
          const json = await res.json().catch(() => null);
          if (!json?.success || !Array.isArray(json?.data)) {
            throw new Error(json?.error || "Failed to fetch Customers sheet");
          }

          const rows: any[][] = json.data;
          const dataRows = rows.slice(1);
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] || [];
            const rowCustomerId = String(row?.[1] ?? "").trim();
            if (rowCustomerId === String(customerId).trim()) {
              return i + 2;
            }
          }

          return null;
        };

        const updateSheetCell = async (
          rowIndex: number,
          columnIndex: number,
          value: string
        ) => {
          const body = new URLSearchParams();
          body.append("action", "updateCell");
          body.append("sheetName", CUSTOMERS_SHEET_NAME);
          body.append("rowIndex", String(rowIndex));
          body.append("columnIndex", String(columnIndex));
          body.append("value", value);

          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });

          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || "Failed to update Customers sheet");
          }
        };

        const rowIndex = await findCustomerRowIndex(editingCustomer.id);
        if (!rowIndex) {
          throw new Error(
            `Customer ${editingCustomer.id} not found in Customers sheet`
          );
        }

        // Columns in Customers sheet (1-based):
        // A Timestamp, B Customer ID, C Customer Name, D Phone, E Whatsapp, F Email
        await updateSheetCell(rowIndex, 3, formData.name);
        await updateSheetCell(rowIndex, 4, formData.phone);
        await updateSheetCell(rowIndex, 5, formData.whatsapp || "");
        await updateSheetCell(rowIndex, 6, formData.email || "");

        updateCustomer(editingCustomer.id, formData);
        alert("Customer updated!");
        resetForm();
      } catch (err: any) {
        console.error("Failed to update Customers sheet", err);
        alert(err?.message || "Failed to update Customers sheet");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const newCust = {
        id: `cust-${Date.now()}`,
        ...formData,
        tags: ["new"],
        assignedEmployeeId: user?.id ?? "emp-1",
        createdAt: new Date().toISOString(),
      };
      addCustomer(newCust);
      alert("Customer added!");
      resetForm();
    }
  };

  const openEdit = (c: any) => {
    setFormData({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone,
      whatsapp: c.whatsapp ?? "",
    });
    setEditingCustomer(c);
  };

  const confirmDelete = (c: any) => {
    const run = async () => {
      if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;

      try {
        const findCustomerRowIndex = async (customerId: string) => {
          const res = await fetch(
            `${SCRIPT_URL}?sheet=${encodeURIComponent(CUSTOMERS_SHEET_NAME)}`
          );
          const json = await res.json().catch(() => null);
          if (!json?.success || !Array.isArray(json?.data)) {
            throw new Error(json?.error || "Failed to fetch Customers sheet");
          }

          const rows: any[][] = json.data;
          const dataRows = rows.slice(1);
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] || [];
            const rowCustomerId = String(row?.[1] ?? "").trim();
            if (rowCustomerId === String(customerId).trim()) {
              return i + 2;
            }
          }

          return null;
        };

        const deleteSheetRow = async (rowIndex: number) => {
          const body = new URLSearchParams();
          body.append("action", "delete");
          body.append("sheetName", CUSTOMERS_SHEET_NAME);
          body.append("rowIndex", String(rowIndex));

          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });

          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(
              json?.error || "Failed to delete row in Customers sheet"
            );
          }
        };

        const rowIndex = await findCustomerRowIndex(c.id);
        if (!rowIndex) {
          throw new Error(`Customer ${c.id} not found in Customers sheet`);
        }

        await deleteSheetRow(rowIndex);

        deleteCustomer(c.id);
        try {
          const next = customers.filter((x) => x.id !== c.id);
          localStorage.setItem("admin-customers", JSON.stringify(next));
        } catch {}
        alert("Customer deleted");
      } catch (err: any) {
        console.error("Failed to delete customer from Customers sheet", err);
        alert(err?.message || "Failed to delete customer from Customers sheet");
      }
    };

    run();
  };

  /* ----------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* ---------- HEADER ---------- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="hidden sm:flex text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent items-center gap-2">
            <User className="w-7 h-7 md:w-8 md:h-8" />
            My Customers
          </h1>

          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white px-5 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>

        {/* ---------- SEARCH BAR ---------- */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, Name, Email, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-gray-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Search className="w-3 h-3" />
            {filteredCustomers.length} of {customers.length} customers
          </p>
        </div>

        {/* ---------- ADD / EDIT MODAL ---------- */}
        {(showAddForm || editingCustomer) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                  {editingCustomer ? "Edit Customer" : "New Customer"}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <InputField
                  label="Name *"
                  type="text"
                  placeholder="Customer name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <InputField
                  label="Phone *"
                  type="tel"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
                <InputField
                  label="WhatsApp"
                  type="tel"
                  placeholder="WhatsApp number"
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                />
                <InputField
                  label="Email"
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSubmitting
                      ? editingCustomer
                        ? "Updating..."
                        : "Saving..."
                      : editingCustomer
                      ? "Update"
                      : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------- VIEW MODAL ---------- */}
        {viewingCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                  Customer Details
                </h2>
                <button
                  onClick={() => setViewingCustomer(null)}
                  className="p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {viewingCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {viewingCustomer.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ID: {viewingCustomer.id}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{viewingCustomer.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{viewingCustomer.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <MessageCircle className="w-4 h-4" />
                    <span>{viewingCustomer.whatsapp || "—"}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      openEdit(viewingCustomer);
                      setViewingCustomer(null);
                    }}
                    className="flex-1 bg-green-100 text-green-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDelete(viewingCustomer)}
                    className="flex-1 bg-red-100 text-red-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- LIST ---------- */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-green-500" />
              Customer List ({filteredCustomers.length})
            </h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Name", "Email", "Phone", "WhatsApp", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingCustomers
                  ? // Skeleton rows
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  : filteredCustomers.map((c, i) => (
                      <CustomerRow
                        key={c.id}
                        customer={c}
                        index={i}
                        openView={(cust) => setViewingCustomer(cust)}
                        openEdit={openEdit}
                        deleteCustomer={() => confirmDelete(c)}
                      />
                    ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden p-4 space-y-4">
            {loadingCustomers
              ? // Skeleton cards
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border bg-white shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="h-7 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-7 bg-gray-200 rounded animate-pulse"></div>
                      <div className="h-7 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))
              : filteredCustomers.map((c, i) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border ${
                      i % 2 === 0
                        ? "bg-white border-gray-100"
                        : "bg-gray-50 border-transparent"
                    } shadow-sm hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {c.name}
                        </h3>
                        <p className="text-xs text-gray-500">{c.id}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{c.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                        <MessageCircle className="w-4 h-4" />
                        <span>{c.whatsapp || "—"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <button
                        onClick={() => setViewingCustomer(c)}
                        className="flex items-center justify-center gap-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="flex items-center justify-center gap-1 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(c)}
                        className="flex items-center justify-center gap-1 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
          </div>

          {/* Empty state */}
          {!loadingCustomers && filteredCustomers.length === 0 && (
            <div className="text-center py-12 px-4">
              {searchQuery ? (
                <>
                  <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No customers found
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Try adjusting your search.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No customers yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Get started by adding your first customer.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-semibold shadow-md hover:shadow-lg"
                  >
                    Add Customer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*                         REUSABLE INPUT FIELD                           */
/* --------------------------------------------------------------------- */
function InputField({
  label,
  type,
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 text-sm"
      />
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*                         DESKTOP TABLE ROW                              */
/* --------------------------------------------------------------------- */
function CustomerRow({
  customer,
  index,
  openView,
  openEdit,
  deleteCustomer,
}: {
  customer: any;
  index: number;
  openView: (c: any) => void;
  openEdit: (c: any) => void;
  deleteCustomer: () => void;
}) {
  return (
    <tr
      className={`${
        index % 2 === 0 ? "bg-white" : "bg-gray-50"
      } hover:bg-gray-100 transition-colors duration-200`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {customer.name}
            </div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        <div className="flex items-center">
          <Mail className="w-4 h-4 text-gray-400 mr-2" />
          {customer.email || "—"}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        <div className="flex items-center">
          <Phone className="w-4 h-4 text-gray-400 mr-2" />
          {customer.phone}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        <div className="flex items-center">
          <MessageCircle className="w-4 h-4 text-green-500 mr-2" />
          {customer.whatsapp || "—"}
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <button
            onClick={() => openView(customer)}
            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => openEdit(customer)}
            className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          <button
            onClick={deleteCustomer}
            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
