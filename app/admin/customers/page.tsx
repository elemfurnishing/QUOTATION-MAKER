"use client";

import type React from "react";
import { useAdmin } from "@/src/contexts/AdminContext";
import { useEmployee } from "@/src/contexts/EmployeeContext";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEffect, useState, useMemo, useRef } from "react";
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
  Camera,
  Upload,
} from "lucide-react";
import type { Quotation, QuotationItem } from "@/src/types/index";

/* --------------------------------------------------------------------- */
/*                           CONSTANTS & HELPERS                         */
/* --------------------------------------------------------------------- */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
const QUOTATION_SHEET_NAME = "Customers";
const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc"; 
const QUOTATION_LOG_SHEET_NAME = "Quotation";
const INVENTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyr8QBIGE3jlMqm3w4r3f-jvRKTJdUKP0Tc4jDITpadSJqQbL8JOC_E6TLXr0xxBJKknA/exec";
const INVENTORY_SPREADSHEET_ID = "1rKr7wOCQdDRunIvSdBFnGVy1VQGgQvcwXeFqVD9wuFM";
const INVENTORY_SHEET_NAME = "Inventory";
const DRIVE_FOLDER_ID = "1OjDF5Jr2O5KtRTmxRcSa-ApFuFtyCOxe";

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
};

const getDisplayableImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (directMatch && directMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w400`;
    }
    const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (ucMatch && ucMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w400`;
    }
    const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w400`;
    }
    if (url.includes("thumbnail?id=")) return url;
    const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
    if (anyIdMatch && anyIdMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w400`;
    }
    return url;
  } catch (e) {
    console.error("Error processing image URL:", url, e);
    return url;
  }
};

const uploadImageToDrive = async (dataUrl: string, fileName: string) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("Invalid image data");

  const params = new URLSearchParams();
  params.append("action", "uploadFile");
  params.append("base64Data", parsed.base64Data);
  params.append("fileName", fileName);
  params.append("mimeType", parsed.mimeType);
  params.append("folderId", DRIVE_FOLDER_ID);

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const responseText = await res.text();
  const json = JSON.parse(responseText);
  if (!json?.success || !json?.fileUrl) {
    throw new Error(json?.error || "Image upload failed");
  }
  return String(json.fileUrl);
};

const appendQuotationLogRow = async (rowData: any[]) => {
  console.log("=== APPEND QUOTATION LOG ROW STARTED (Admin Portal) ===");
  const params = new URLSearchParams();
  params.append("action", "insert");
  params.append("sheetName", QUOTATION_LOG_SHEET_NAME);
  params.append("rowData", JSON.stringify(rowData));
  // Note: For insert/append, script usually needs to know which spreadsheet if it acts on bound one.
  // If it's a standalone script accessing by ID, we might need spreadsheetId even for POST.
  // But usually standalone scripts hardcode it OR take it as param. 
  // Given AdminContext reading requires it, let's play safe and check if we can pass it, 
  // but existing upload logic didn't use it. If upload works, maybe insert works too if script defaults.
  // However, for SAFETY, let's leave this as is if quotas work, but FIX the fetch calls below.

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const responseText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error(`Quotation insert returned non-JSON response: ${responseText.slice(0, 200)}`);
  }
  if (!json?.success) {
    throw new Error(json?.error || "Failed to insert quotation log row");
  }
};

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
  const { createQuotation } = useEmployee();
  const { user } = useAuth();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState<string | null>(null);

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
    let result = customers;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = customers.filter((c) => {
        return (
          c.id.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          c.phone.includes(query) ||
          (c.whatsapp && c.whatsapp.includes(query))
        );
      });
    }
    // Sort by ID descending (most recent first)
    return [...result].sort((a, b) => b.id.localeCompare(a.id));
  }, [customers, searchQuery]);

  /* ------------------- Form handling ------------------- */
  const resetForm = () => {
    setFormData({ name: "", phone: "", whatsapp: "", email: "" });
    setShowAddForm(false);
    setEditingCustomer(null);
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
          // FIXED: Added spreadsheetId
          const res = await fetch(
            `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${encodeURIComponent(QUOTATION_SHEET_NAME)}`
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
          body.append("sheetName", QUOTATION_SHEET_NAME);
          body.append("rowIndex", String(rowIndex));
          body.append("columnIndex", String(columnIndex));
          body.append("value", value);
          // Assuming script might want spreadsheetId in body or just handles active sheet.
          // Since get request worked with ID, let's keep body standard.

          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || "Failed to update Customers sheet");
          }
        };

        const rowIndex = await findCustomerRowIndex(editingCustomer.id);
        if (!rowIndex) {
          throw new Error(`Customer ${editingCustomer.id} not found in Customers sheet`);
        }

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
      // Add Customer
      const newCust = {
        id: `cust-${Date.now()}`,
        ...formData,
        tags: ["new"],
        assignedEmployeeId: user?.id ?? "emp-1",
        createdAt: new Date().toISOString(),
      };
      // Context's addCustomer handles the POST to sheet.
      addCustomer(newCust);
      alert("Customer added!");
      resetForm();
    }
  };

  const confirmDelete = (c: any) => {
    const run = async () => {
      if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
      try {
        const findCustomerRowIndex = async (customerId: string) => {
           // FIXED: Added spreadsheetId
          const res = await fetch(
            `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${encodeURIComponent(QUOTATION_SHEET_NAME)}`
          );
          const json = await res.json().catch(() => null);
          if (!json?.success || !Array.isArray(json?.data)) {
            throw new Error(json?.error || "Failed to fetch Customers sheet");
          }
          const rows: any[][] = json.data;
          const dataRows = rows.slice(1);
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i] || [];
            if (String(row?.[1] ?? "").trim() === String(customerId).trim()) {
              return i + 2;
            }
          }
          return null;
        };

        const deleteSheetRow = async (rowIndex: number) => {
          const body = new URLSearchParams();
          body.append("action", "delete");
          body.append("sheetName", QUOTATION_SHEET_NAME);
          body.append("rowIndex", String(rowIndex));
          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            throw new Error(json?.error || "Failed to delete row in Customers sheet");
          }
        };

        const rowIndex = await findCustomerRowIndex(c.id);
        if (!rowIndex) {
          throw new Error(`Customer ${c.id} not found in Customers sheet`);
        }
        await deleteSheetRow(rowIndex);
        deleteCustomer(c.id);
        alert("Customer deleted");
      } catch (err: any) {
        console.error("Failed to delete customer", err);
        alert(err?.message || "Failed to delete customer");
      }
    };
    run();
  };

  const openQuotation = (customerId: string) => setShowQuotationModal(customerId);
  const closeQuotation = () => setShowQuotationModal(null);

  /* ----------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
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

        {(showAddForm || editingCustomer) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                  {editingCustomer ? "Edit Customer" : "New Customer"}
                </h2>
                <button onClick={resetForm} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <InputField
                  label="Name *"
                  type="text"
                  placeholder="Customer name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <InputField
                  label="Phone *"
                  type="tel"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
                <InputField
                  label="WhatsApp"
                  type="tel"
                  placeholder="WhatsApp number"
                  value={formData.whatsapp}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, whatsapp: e.target.value })}
                />
                <InputField
                  label="Email"
                  type="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? "Saving..." : "Save"}
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
                    <p className="text-sm text-gray-500">ID: {viewingCustomer.id}</p>
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
                    onClick={() => {
                        openQuotation(viewingCustomer.id);
                        setViewingCustomer(null);
                    }}
                    className="flex-1 bg-indigo-100 text-indigo-700 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Quote
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

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-green-500" />
              Customer List ({filteredCustomers.length})
            </h2>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["ID", "Name", "Email", "Phone", "WhatsApp", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!loadingCustomers && filteredCustomers.map((c, i) => (
                  <CustomerRow
                    key={c.id}
                    customer={c}
                    index={i}
                    openView={(cust: any) => setViewingCustomer(cust)}
                    openEdit={openEdit}
                    deleteCustomer={() => confirmDelete(c)}
                    openQuotation={openQuotation}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showQuotationModal && (
          <QuotationModal
            customerId={showQuotationModal}
            onClose={closeQuotation}
            createQuotation={createQuotation}
            user={user}
          />
        )}
      </div>
    </div>
  );
}

function InputField({ label, type, placeholder, value, onChange, required }: any) {
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

function CustomerRow({ customer, index, openView, openEdit, deleteCustomer, openQuotation }: any) {
  return (
    <tr className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors duration-200`}>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
        #{customer.id}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-4">
             <div className="text-sm font-medium text-gray-900">{customer.name}</div>
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
          <button onClick={() => openView(customer)} className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition" title="View">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => openEdit(customer)} className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition" title="Edit">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => openQuotation(customer.id)} className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition" title="Add Quotation">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={deleteCustomer} className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function QuotationModal({
  customerId,
  onClose,
  createQuotation,
  user,
}: {
  customerId: string;
  onClose: () => void;
  createQuotation: (q: Quotation) => void;
  user: any;
}) {
  const { products, customers } = useAdmin();

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [tax] = useState(0);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [availableQtyMap, setAvailableQtyMap] = useState<Record<string, number>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // New Fields
  const [employeeCode, setEmployeeCode] = useState("");
  const [architectCode, setArchitectCode] = useState("");
  const [architectName, setArchitectName] = useState("");
  const [architectNumber, setArchitectNumber] = useState("");
  const [showArchitectFields, setShowArchitectFields] = useState(false);

  const fetchInventory = async () => {
    try {
      const url = `${INVENTORY_SCRIPT_URL}?spreadsheetId=${INVENTORY_SPREADSHEET_ID}&sheet=${INVENTORY_SHEET_NAME}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(1);
        const products = rows
          .map((r: any[]) => {
             const rawPrice = r[9];
             const parsedPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice || "0").replace(/[^0-9.-]+/g, ""));
            return {
              code: String(r[4] || "").trim(),
              name: String(r[3] || "").trim(),
              serialNo: String(r[1] || "").trim(),
              price: isNaN(parsedPrice) ? 0 : parsedPrice,
              image: String(r[2] || "").trim(),
              availableQty: parseInt(String(r[14] || "0").replace(/[^0-9]/g, "")) || 0, // Column O (index 14)
            };
          })
          .filter((p: any) => p.code);
        setInventory(products);
      }
    } catch (e) {
      console.error("Failed to fetch inventory:", e);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleUniversalSearch = (itemId: string, searchValue: string) => {
      if (!searchValue.trim()) {
        alert("⚠️ Please enter a search term!");
        return;
      }
      if (inventory.length === 0) {
        alert("⚠️ Inventory not loaded yet! Please wait.");
        return;
      }
      const searchTerm = searchValue.trim().toLowerCase();
      let match = inventory.find((p) => p.code?.toLowerCase() === searchTerm);
      if (!match) {
        match = inventory.find((p) => p.serialNo?.toLowerCase() === searchTerm);
      }
      if (!match) {
        match = inventory.find((p) => p.name?.toLowerCase().includes(searchTerm));
      }

      if (match) {
        alert(`✅ Found: ${match.name}\nPrice: ₹${match.price}\nAvailable Qty: ${match.availableQty}\nImage: ${match.image ? 'Yes' : 'No'}`);
        updateItem(itemId, {
          customTitle: match.name,
          price: Number(match.price) || 0,
          customPhoto: match.image || undefined,
        });
        setAvailableQtyMap(prev => ({ ...prev, [itemId]: match.availableQty || 0 }));
      } else {
        alert("❌ Product not found in inventory. Try another search term.");
      }
    };

  const addCustomItem = () => {
    const id = `custom-${Date.now()}`;
    setItems((prev) => [
      ...prev,
      { productId: id, quantity: 1, price: 0, discount: 0, customTitle: "" },
    ]);
  };

  const updateItem = (productId: string, updates: Partial<QuotationItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, ...updates } : i))
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const openCamera = async (productId: string) => {
      try {
        if (!window.isSecureContext) {
          alert("Camera access requires a secure context");
          return;
        }
        const permissionResult = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (permissionResult.state === "denied") {
          alert("Camera permission denied.");
          return;
        }
        setShowCamera(productId);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }});
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.error);
          }
        } catch (error) {
           console.error("Error accessing camera:", error);
           setShowCamera(null);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
         setShowCamera(null);
      }
    };

    const capturePhoto = (productId: string) => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        updateItem(productId, { customPhoto: base64 });
        closeCamera();
      }
    };

    const closeCamera = () => {
      setShowCamera(null);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };

   const handleFileUpload = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => updateItem(productId, { customPhoto: ev.target?.result as string });
      reader.readAsDataURL(file);
    };

  // Function to append quotation log row to Google Sheet
  const appendQuotationLogRow = async (rowData: any[]) => {
    console.log("=== APPEND QUOTATION LOG ROW STARTED (Admin) ===");
    console.log("📤 Quotation log rowData:", rowData);

    const params = new URLSearchParams();
    params.append("action", "insert");
    params.append("sheetName", QUOTATION_LOG_SHEET_NAME);
    params.append("rowData", JSON.stringify(rowData));

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const responseText = await res.text();

    let json: any = null;
    try {
      json = JSON.parse(responseText);
      console.log("📋 Parsed quotation insert response:", json);
    } catch {
      throw new Error(
        `Quotation insert returned non-JSON response (HTTP ${
          res.status
        }). Raw: ${responseText.slice(0, 200)}`
      );
    }

    if (!json?.success) {
      throw new Error(json?.error || "Failed to insert quotation log row");
    }
  };

  const subtotal = items.reduce(
    (s, i) => s + i.price * i.quantity - i.discount,
    0
  );
  const taxAmount = Math.round((subtotal * tax) / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert("Add at least one item");
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      // Generate Serial Number
      const generateSerialNo = async (): Promise<string> => {
        try {
          const url = `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${encodeURIComponent(QUOTATION_LOG_SHEET_NAME)}`;
          const res = await fetch(url);
          const json = await res.json().catch(() => null);
          
          if (!json?.success || !Array.isArray(json?.data)) {
            return `SN-${Date.now().toString().slice(-6)}`;
          }
          
          const rows = json.data.slice(1);
          let maxNum = 0;
          
          for (const row of rows) {
            const serialNo = row?.[14]?.toString() || "";
            const match = serialNo.match(/SN-(\d+)/);
            if (match && match[1]) {
              const num = parseInt(match[1]);
              if (num > maxNum) maxNum = num;
            }
          }
          
          const nextNum = maxNum + 1;
          return `SN-${nextNum.toString().padStart(4, '0')}`;
        } catch (err) {
          console.error("Failed to generate serial number:", err);
          return `SN-${Date.now().toString().slice(-6)}`;
        }
      };

      const serialNo = await generateSerialNo();
      console.log("📝 Generated Serial No:", serialNo);

      const quotation: Quotation = {
        id: `quot-${Date.now()}`,
        customerId,
        employeeId: user?.id || "admin",
        items,
        subtotal,
        tax: taxAmount,
        discount: 0,
        total,
        status: "draft",
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        serialNo: serialNo,
        employeeCode,
        architectCode,
        architectName,
        architectNumber,
      };

      const customer = customers.find((c) => c.id === customerId);
      const timestamp = new Date().toISOString();

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const product = products.find((p) => p.id === item.productId);
        const productName = (product?.title || item.customTitle || "").toString().trim() || `Item ${index + 1}`;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discount) || 0;
        const itemSubtotal = qty * price - discount;

        let productImageUrl = "";
        if (item.customPhoto) {
          if (item.customPhoto.startsWith("data:")) {
             productImageUrl = await uploadImageToDrive(item.customPhoto, `${quotation.id}-${index + 1}.jpg`);
          } else {
            productImageUrl = item.customPhoto;
          }
        }

        // Include Serial No at index 14 (Column O) + New Fields (P-S)
        const logRow = [
          timestamp,           // 0: Timestamp
          customerId,          // 1: Customer ID
          customer?.name || "",// 2: Customer Name
          customer?.phone || "",// 3: Phone
          customer?.whatsapp || "",// 4: WhatsApp
          customer?.email || "",// 5: Email
          productName,         // 6: Product Name
          productImageUrl,     // 7: Product Image
          qty,                 // 8: Qty
          price,               // 9: Price
          discount,            // 10: Discount
          itemSubtotal,        // 11: Subtotal
          tax,                 // 12: Tax%
          "",                  // 13: Quotation Link (filled later)
          serialNo,            // 14: Serial No (Column O)
          employeeCode || "",  // 15: Employee Code
          architectCode || "", // 16: Architect Code
          architectName || "", // 17: Architect Name
          architectNumber || ""// 18: Architect Number
        ];
        await appendQuotationLogRow(logRow);
      }

      createQuotation(quotation);
      await fetchInventory(); // Refresh inventory data
      alert(`Quotation ${serialNo} saved and uploaded!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  const customer = customers.find((c: any) => c.id === customerId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-800">Create Quotation</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 gap-6">
           <div className="space-y-6">
             <div className="bg-gray-50 rounded-xl p-4">
               <h3 className="font-medium text-gray-800 mb-2">Customer</h3>
               <p className="text-sm">{customer?.name} - {customer?.phone}</p>
             </div>

             {/* Additional Details */}
             <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="font-semibold text-gray-700">Additional Details</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
                    <input
                      type="text"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="Enter Employee Code"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowArchitectFields(!showArchitectFields)}
                     className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      {showArchitectFields ? "- Hide Architect Details" : "+ Add Architect Details"}
                    </button>
                  </div>
                  
                  {showArchitectFields && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Architect Code</label>
                        <input
                          type="text"
                          value={architectCode}
                          onChange={(e) => setArchitectCode(e.target.value)}
                          placeholder="Code"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Architect Name</label>
                        <input
                          type="text"
                          value={architectName}
                          onChange={(e) => setArchitectName(e.target.value)}
                          placeholder="Name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Architect Number</label>
                        <input
                          type="text"
                          value={architectNumber}
                          onChange={(e) => setArchitectNumber(e.target.value)}
                          placeholder="Phone Number"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                  )}
             </div>

             <button onClick={addCustomItem} className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
               <Plus className="w-5 h-5" /> Add Item
             </button>
             {items.map((item) => (
               <div key={item.productId} className="bg-white border rounded-xl p-4 shadow-sm">
                 <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Item title"
                        value={item.customTitle || ""}
                        onChange={(e) => updateItem(item.productId, { customTitle: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                      <div className="mt-2">
                        <label className="text-xs text-gray-500 block mb-1">Search Item by Code/Name</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter code, serial or name..."
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                            onKeyDown={(e) => { if(e.key === "Enter") handleUniversalSearch(item.productId, (e.target as HTMLInputElement).value); }}
                            id={`search-${item.productId}`}
                          />
                          <button onClick={() => {
                               const el = document.getElementById(`search-${item.productId}`) as HTMLInputElement;
                               handleUniversalSearch(item.productId, el.value);
                          }} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium">Search</button>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.productId)} className="text-red-500 p-2"><X className="w-4 h-4"/></button>
                 </div>
                 {showCamera === item.productId && (
                    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                       <div className="bg-white p-4 rounded-xl w-full max-w-sm">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-56 bg-gray-200 rounded"/>
                          <canvas ref={canvasRef} className="hidden"/>
                          <div className="flex gap-2 mt-4">
                             <button onClick={() => capturePhoto(item.productId)} className="flex-1 bg-blue-500 text-white py-2 rounded">Capture</button>
                             <button onClick={closeCamera} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
                          </div>
                       </div>
                    </div>
                 )}
                 <div className="mb-4">
                    <label className="text-xs block mb-2">Photo</label>
                    <div className="flex gap-2">
                       {item.customPhoto ? (
                          (() => {
                            const original = item.customPhoto || "";
                            let displayUrl = original;
                            if (!original.startsWith("data:") && !original.startsWith("blob:")) {
                               displayUrl = getDisplayableImageUrl(original) || original;
                            }
                            return <img src={displayUrl} className="w-16 h-16 object-cover rounded" onError={(e) => {
                                // Fallback or retry logic if needed, but usually getDisplayableImageUrl handles it
                                console.warn("Image load failed:", displayUrl);
                            }}/>
                          })()
                       ) : null}
                       <button onClick={() => openCamera(item.productId)} className="bg-green-500 text-white px-3 py-1 rounded text-xs">Camera</button>
                       <label className="bg-blue-500 text-white px-3 py-1 rounded text-xs cursor-pointer">
                          Upload <input type="file" accept="image/*" onChange={(e) => handleFileUpload(item.productId, e)} className="hidden"/>
                       </label>
                    </div>
                 </div>
                 <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs block mb-1">Qty</label>
                      <input type="number" value={item.quantity || ""} onChange={(e) => updateItem(item.productId, { quantity: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm"/>
                      {availableQtyMap[item.productId] !== undefined && (
                        <span className="text-xs text-green-600 mt-1 block">Stock: {availableQtyMap[item.productId]}</span>
                      )}
                    </div>
                    <div>
                      <label className="text-xs block mb-1">Price</label>
                      <input type="number" value={item.price || ""} onChange={(e) => updateItem(item.productId, { price: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm"/>
                    </div>
                    <div>
                      <label className="text-xs block mb-1">Discount</label>
                      <input type="number" value={item.discount || ""} onChange={(e) => updateItem(item.productId, { discount: Number(e.target.value) })} className="w-full px-2 py-1 border rounded text-sm"/>
                    </div>
                 </div>
               </div>
             ))}
             <div className="bg-gray-50 p-4 rounded-xl">
                <div className="flex justify-between mb-2"><span className="text-sm">Subtotal</span><span className="font-medium">₹{subtotal}</span></div>
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-blue-600">₹{total}</span></div>
                <div className="flex gap-2 mt-4">
                   <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">{saving ? "Saving..." : "Save Draft"}</button>
                   <button onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded-lg">Cancel</button>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
