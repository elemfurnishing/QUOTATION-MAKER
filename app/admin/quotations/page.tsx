"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/src/contexts/AdminContext";
import type { Quotation, QuotationItem } from "@/src/types/index";
import { generateQuotationPDF } from "@/src/utils/pdfGenerator";
import {
  Eye,
  X,
  Package,
  DollarSign,
  Percent,
  Calendar,
  User,
  Camera,
  Upload,
  FileText,
  Search,
} from "lucide-react";
import Image from "next/image";

export default function QuotationsPage() {
  const { customers, products } = useAdmin();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(
    null
  );
  const [isModalClosing, setIsModalClosing] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";

  useEffect(() => {
    const fetchQuotations = async () => {
      setIsLoadingQuotations(true);
      try {
        const response = await fetch(`${SCRIPT_URL}?sheet=Quotation`);
        const json = await response.json();

        if (json.success && Array.isArray(json.data)) {
          // Skip header row (index 0)
          const rows = json.data.slice(1);

          const parsedQuotations: Quotation[] = rows
            .map((row: any[], index: number) => {
              // Parse newline-separated fields
              const parseList = (cell: any) =>
                (cell?.toString() || "").split("\n");

              const names = parseList(row[6]);
              const images = parseList(row[7]);
              const qtys = parseList(row[8]);
              const prices = parseList(row[9]);
              const discounts = parseList(row[10]);

              // Construct items
              const items: QuotationItem[] = names
                .map((name: string, i: number) => ({
                  productId: `gen-${index}-${i}`, // fallback ID
                  customTitle: name, // Store name as custom title since we don't have product ID
                  customPhoto: images[i] || undefined,
                  quantity: Number(qtys[i]) || 0,
                  price: Number(prices[i]) || 0,
                  discount: Number(discounts[i]) || 0,
                }))
                .filter((item: QuotationItem) => item.customTitle); // Filter out empty lines if any

              const taxRate = Number(row[12]) || 0;
              const subtotal = items.reduce(
                (sum, item) =>
                  sum + item.price * item.quantity - (item.discount || 0),
                0
              );
              const taxAmount = Math.round(subtotal * (taxRate / 100));
              const total = subtotal + taxAmount;

              // Try to construct a valid date, fallback to now
              let createdAt = new Date().toISOString();
              if (row[0]) {
                const date = new Date(row[0]);
                if (!isNaN(date.getTime())) {
                  createdAt = date.toISOString();
                }
              }

              return {
                id: `quot-${index + 1}`, // Generate a consistent ID based on row index
                customerId: row[1]?.toString() || "unknown",
                employeeId: "emp-1", // Default/Unknown
                items,
                subtotal,
                tax: taxAmount,
                discount: items.reduce((sum, i) => sum + (i.discount || 0), 0),
                total,
                status: "sent", // Default status
                versions: [],
                createdAt,
                updatedAt: createdAt,
              };
            })
            .reverse(); // Show newest first? Or preserve sheet order? usually sheet appends to bottom, so reverse is good for "newest first"

          setQuotations(parsedQuotations);

          // Optionally cache to local storage
          localStorage.setItem(
            "employee-quotations",
            JSON.stringify(parsedQuotations)
          );
        }
      } catch (error) {
        console.error("Failed to fetch quotations from sheet:", error);
        // Fallback to local storage if fetch fails
        try {
          const saved = localStorage.getItem("employee-quotations");
          if (saved) setQuotations(JSON.parse(saved));
        } catch {
          setQuotations([]);
        }
      } finally {
        setIsLoadingQuotations(false);
      }
    };

    fetchQuotations();
  }, []);

  /* ────────────────────── Filtered Quotations ────────────────────── */
  const filteredQuotations = useMemo(() => {
    if (!searchQuery.trim()) return quotations;

    const query = searchQuery.toLowerCase().trim();
    return quotations.filter((quot) => {
      // Find customer in context OR use the data from the quotation itself if we had it
      // Since context customers might be limited, we should also check the quotation object if we enhanced it.
      // But currently Quotation type implies reference to customerId.
      const customer = customers.find((c) => c.id === quot.customerId);
      const customerName = customer?.name?.toLowerCase() || "";
      const customerPhone = customer?.phone || "";
      const amount = quot.total.toString();
      const date = new Date(quot.createdAt).toLocaleDateString().toLowerCase();
      const id = quot.id.toLowerCase();

      return (
        id.includes(query) ||
        customerName.includes(query) ||
        customerPhone.includes(query) ||
        amount.includes(query) ||
        date.includes(query)
      );
    });
  }, [quotations, customers, searchQuery]);

  const groupedQuotations = useMemo(() => {
    const grouped = new Map<string, Quotation[]>();

    for (const q of filteredQuotations) {
      const key = q.customerId || "unknown";
      const list = grouped.get(key);
      if (list) list.push(q);
      else grouped.set(key, [q]);
    }

    const aggregated: Quotation[] = Array.from(grouped.entries()).map(
      ([customerId, qs]) => {
        const items = qs.flatMap((q) => q.items);
        const subtotal = qs.reduce((sum, q) => sum + (q.subtotal || 0), 0);
        const tax = qs.reduce((sum, q) => sum + (q.tax || 0), 0);
        const discount = qs.reduce((sum, q) => sum + (q.discount || 0), 0);
        const total = qs.reduce((sum, q) => sum + (q.total || 0), 0);

        const latest = qs.reduce((a, b) =>
          new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime()
            ? a
            : b
        );

        return {
          id: `cust-${customerId}`,
          customerId,
          employeeId: latest.employeeId,
          items,
          subtotal,
          tax,
          discount,
          total,
          status: latest.status,
          versions: [],
          createdAt: latest.createdAt,
          updatedAt: latest.updatedAt || latest.createdAt,
        };
      }
    );

    aggregated.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return aggregated;
  }, [filteredQuotations]);

  const getCustomerName = (id: string) => {
    // Fallback: If not found in customers list, maybe we can find it in the quotation data if we stored it?
    // But Quotation interface doesn't store name.
    // We could try to grab it from the sheet data if we stored it in the quotation object (would require type change).
    // For now, rely on context.
    return customers.find((c) => c.id === id)?.name || `Customer ${id}`;
  };

  const getCustomerPhone = (id: string) => {
    return customers.find((c) => c.id === id)?.phone || "—";
  };

  const getProduct = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  const getDisplayableImageUrl = (
    url: string | null | undefined
  ): string | null => {
    if (!url) return null;

    try {
      // 1. Direct sharing link: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
      const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (directMatch && directMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w400`;
      }

      // 2. Link with ?id= parameter (common in some sharing formats)
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucMatch && ucMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w400`;
      }

      // 3. Open link format: https://drive.google.com/open?id=FILE_ID
      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
      if (openMatch && openMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w400`;
      }

      // 4. If it's already a thumbnail URL, return as-is
      if (url.includes("thumbnail?id=")) {
        return url;
      }

      // 5. Fallback: extract any long alphanumeric string that looks like a File ID
      const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
      if (anyIdMatch && anyIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w400`;
      }

      // 6. If nothing matches, return original URL with cache buster (forces reload)
      const cacheBuster = Date.now();
      return url.includes("?")
        ? `${url}&cb=${cacheBuster}`
        : `${url}?cb=${cacheBuster}`;
    } catch (e) {
      console.error("Error processing image URL:", url, e);
      return url; // Return original as last fallback
    }
  };

  const closeModal = () => setSelectedQuotation(null);

  const generatePDF = async (quotation: Quotation) => {
    try {
      const customer = customers.find((c) => c.id === quotation.customerId);
      await generateQuotationPDF(quotation, customer, products);
    } catch (error) {
      console.error("Error generating PDF:", error);
      const printContent = `
        Quotation #${quotation.id}
        Customer: ${getCustomerName(quotation.customerId)}
        Phone: ${getCustomerPhone(quotation.customerId)}
        Date: ${new Date(quotation.createdAt).toLocaleDateString()}
        Status: ${quotation.status.toUpperCase()}

        Items:
        ${quotation.items
          .map((item) => {
            const product = getProduct(item.productId);
            return `${
              product?.title || item.customTitle || "Custom Item"
            } - Qty: ${item.quantity} - Price: ₹${item.price} - Total: ₹${(
              item.price * item.quantity -
              (item.discount || 0)
            ).toLocaleString()}`;
          })
          .join("\n")}

        Subtotal: ₹${quotation.subtotal.toLocaleString()}
        Tax (18%): ₹${quotation.tax.toLocaleString()}
        ${
          quotation.discount > 0
            ? `Discount: -₹${quotation.discount.toLocaleString()}`
            : ""
        }
        Total: ₹${quotation.total.toLocaleString()}
      `;

      const blob = new Blob([printContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${quotation.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          All Quotations
        </h1>

        {/* ───── SEARCH BAR ───── */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, Name, Phone, Amount, Date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-slate-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Search className="w-3 h-3" />
            {isLoadingQuotations ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                <span>of {quotations.length} quotations</span>
              </span>
            ) : (
              <span>
                {groupedQuotations.length} of {quotations.length} quotations
              </span>
            )}
          </p>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  {["ID", "Customer", "Amount", "Date", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-6 font-semibold text-slate-700 text-sm uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingQuotations
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr
                        key={`sk-${i}`}
                        className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      >
                        <td className="py-4 px-6">
                          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-200 rounded-full animate-pulse" />
                            <div className="space-y-2">
                              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                        </td>
                        <td className="py-4 px-6">
                          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                        </td>
                        <td className="py-4 px-6">
                          <div className="h-8 w-20 bg-slate-200 rounded-lg animate-pulse" />
                        </td>
                      </tr>
                    ))
                  : groupedQuotations.map((quot, i) => (
                      <tr
                        key={quot.id}
                        className={`hover:bg-slate-50 transition-all ${
                          i % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}
                      >
                        <td className="py-4 px-6 font-mono text-sm text-slate-900">
                          {quot.customerId}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className=":w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {getCustomerName(quot.customerId)[0]}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {getCustomerName(quot.customerId)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {getCustomerPhone(quot.customerId)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          ₹{quot.total.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(quot.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => setSelectedQuotation(quot)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm transition"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden max-h-[70vh] overflow-y-auto pr-2 smooth-scroll-container">
          <div className="space-y-4 pb-4">
            {isLoadingQuotations
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`skm-${i}`}
                    className={`bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl shadow-lg p-5 transition-all ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                      <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
                    </div>
                  </div>
                ))
              : groupedQuotations.map((quot, i) => (
                  <div
                    key={quot.id}
                    className={`bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl shadow-lg p-5 transition-all ${
                      i % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {getCustomerName(quot.customerId)[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {getCustomerName(quot.customerId)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {getCustomerPhone(quot.customerId)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          quot.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : quot.status === "sent"
                            ? "bg-blue-100 text-blue-800"
                            : quot.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {quot.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">ID</span>
                        <span className="font-mono text-slate-900">
                          {quot.customerId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          Amount
                        </span>
                        <span className="font-semibold text-slate-900">
                          ₹{quot.total.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Date
                        </span>
                        <span className="text-slate-700">
                          {new Date(quot.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedQuotation(quot)}
                          className="flex-1 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition py-2 px-4 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        <button
                          onClick={() => generatePDF(quot)}
                          className="flex-1 flex items-center justify-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm transition py-2 px-4 border border-green-200 rounded-lg hover:bg-green-50"
                        >
                          <FileText className="w-4 h-4" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Empty State */}
        {!isLoadingQuotations && groupedQuotations.length === 0 && (
          <div className="text-center py-16">
            {searchQuery ? (
              <>
                <Search className="mx-auto w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  No quotations found
                </h3>
                <p className="text-slate-500 mb-4">
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
                <Package className="mx-auto w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  No Quotations Yet
                </h3>
                <p className="text-slate-500">
                  Create your first quotation to see it here.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* === MODAL === */}
      {(selectedQuotation || isModalClosing) && selectedQuotation && (
        <div
          className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 ${
            isModalClosing
              ? "bg-black/30 animate-out fade-out duration-300"
              : "bg-black/50 sm:bg-black/60 animate-in fade-in duration-300"
          }`}
          onClick={closeModal}
        >
          <div
            className={`bg-white/95 backdrop-blur-lg rounded-xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] sm:max-h-[85vh] md:max-h-[90vh] overflow-y-auto ${
              isModalClosing
                ? "animate-out zoom-out-95 duration-300"
                : "animate-in zoom-in-95 duration-300"
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: isModalClosing
                ? "modalFadeOut 0.3s ease-in forwards"
                : "modalZoomIn 0.3s ease-out forwards",
            }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
                  Customer {selectedQuotation.customerId}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Created on{" "}
                  {new Date(selectedQuotation.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <button
                  onClick={() => generatePDF(selectedQuotation)}
                  className="flex items-center gap-1 sm:gap-2 text-green-600 hover:text-green-700 font-medium text-xs sm:text-sm transition px-3 sm:px-4 py-2 border border-green-200 rounded-lg hover:bg-green-50"
                >
                  <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Download PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
              {/* Customer Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-blue-100">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Customer Details
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:gap-4 text-sm">
                  <div>
                    <p className="text-slate-600 text-xs sm:text-sm">Name</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      {getCustomerName(selectedQuotation.customerId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs sm:text-sm">Phone</p>
                    <p className="font-medium text-slate-900 text-sm sm:text-base">
                      {getCustomerPhone(selectedQuotation.customerId)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items with Photos */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Items ({selectedQuotation.items.length})
                </h3>
                <div className="space-y-4">
                  {selectedQuotation.items.map((item: QuotationItem, idx) => {
                    const product = getProduct(item.productId);
                    const rawSrc = item.customPhoto || product?.images?.[0];
                    const photoSrc = getDisplayableImageUrl(rawSrc);

                    const proxiedPhotoSrc = photoSrc
                      ? `/api/image-proxy?url=${encodeURIComponent(photoSrc)}`
                      : null;
                    const driveIdMatch = rawSrc
                      ? rawSrc.match(/([a-zA-Z0-9_-]{25,})/)
                      : null;
                    const driveThumb = driveIdMatch?.[1]
                      ? `/api/image-proxy?url=${encodeURIComponent(
                          `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w800`
                        )}`
                      : null;

                    return (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
                      >
                        <div className="flex gap-5">
                          {/* Photo */}
                          <div className="w-28 h-28 bg-slate-100 rounded-xl overflow-hidden border flex-shrink-0">
                            {proxiedPhotoSrc ? (
                              <img
                                src={proxiedPhotoSrc}
                                alt={
                                  product?.title || item.customTitle || "Item"
                                }
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  if (!driveThumb) return;
                                  const img = e.currentTarget;
                                  if (img.src === driveThumb) return;
                                  img.src = driveThumb;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                {item.customTitle ? (
                                  <Camera className="w-10 h-10" />
                                ) : (
                                  <Package className="w-10 h-10" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 space-y-2">
                            <h4 className="font-semibold text-slate-900">
                              {product?.title ||
                                item.customTitle ||
                                "Custom Item"}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-slate-500">Qty</p>
                                <p className="font-medium">{item.quantity}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Price</p>
                                <p className="font-medium">
                                  ₹{item.price.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500">Discount</p>
                                <p className="font-medium text-red-600">
                                  {item.discount ? `-₹${item.discount}` : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500">Total</p>
                                <p className="font-semibold text-slate-900">
                                  ₹
                                  {(
                                    item.price * item.quantity -
                                    (item.discount || 0)
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Summary
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium">
                      ₹{selectedQuotation.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax (18%)</span>
                    <span className="font-medium">
                      ₹{selectedQuotation.tax.toLocaleString()}
                    </span>
                  </div>
                  {selectedQuotation.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span>
                        -₹{selectedQuotation.discount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-300">
                    <span className="text-lg font-bold text-slate-900">
                      Total
                    </span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
                      ₹{selectedQuotation.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold ${
                    selectedQuotation.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : selectedQuotation.status === "sent"
                      ? "bg-blue-100 text-blue-800"
                      : selectedQuotation.status === "rejected"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedQuotation.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom smooth scrolling styles */}
      <style jsx global>{`
        .smooth-scroll-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(99, 102, 241, 0.4) rgba(0, 0, 0, 0.03);
        }

        .smooth-scroll-container::-webkit-scrollbar {
          width: 6px;
        }

        .smooth-scroll-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.03);
          border-radius: 10px;
        }

        .smooth-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.4);
          border-radius: 10px;
          transition: background 0.3s ease;
        }

        .smooth-scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.6);
        }

        .smooth-scroll-container {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        .smooth-scroll-container > div > div {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .smooth-scroll-container > div > div:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        @keyframes modalZoomIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes modalFadeOut {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
        }

        @media (max-width: 640px) {
          .modal-content {
            margin: 8px;
            max-height: calc(100vh - 16px);
          }
        }

        @media (hover: none) and (pointer: coarse) {
          .smooth-scroll-container > div > div:hover {
            transform: none;
          }

          .smooth-scroll-container > div > div:active {
            transform: scale(0.98);
            transition: transform 0.1s ease;
          }
        }
      `}</style>
    </div>
  );
}
