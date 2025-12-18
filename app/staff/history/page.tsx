// src/app/staff/history/page.tsx
"use client";

import type {
  Quotation,
  QuotationItem,
  Customer,
  Product,
} from "@/src/types/index";
import { useEmployee } from "@/src/contexts/EmployeeContext";
import { useAdmin } from "@/src/contexts/AdminContext";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  History,
  Filter,
  Edit3,
  Eye,
  Clock,
  DollarSign,
  User,
  Plus,
  Camera,
  Upload,
  Trash2,
  X,
  Send,
  MessageCircle,
  Mail,
  FileText,
  Search,
} from "lucide-react";
import jsPDF from "jspdf";
import {
  generateQuotationPDF,
  generatePDFBlob,
  generateAndUploadQuotationPDF,
} from "@/src/utils/pdfGenerator";

export default function HistoryPage() {
  const { updateQuotation } = useEmployee();
  const { customers, products } = useAdmin();

  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
  const QUOTATION_LOG_SHEET_NAME = "Quotation";
  const QUOTATION_PDF_FOLDER_ID = "1QKe0M9eQQ1kY7xWUqodcwLFAQfGuEY7F";

  const QUOTATION_LINK_COLUMN_INDEX = 14;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [quotationFetchError, setQuotationFetchError] = useState<string | null>(
    null
  );

  const normalizeImageUrl = (url: string) => {
    const value = (url || "").trim();
    if (!value) return "";
    if (value.startsWith("data:image/")) return value;

    try {
      const u = new URL(value);
      if (u.hostname.includes("drive.google.com")) {
        const idFromOpen = u.searchParams.get("id");
        if (idFromOpen) {
          return `https://drive.google.com/uc?export=view&id=${idFromOpen}`;
        }
        const m = u.pathname.match(/\/file\/d\/([^/]+)/);
        if (m?.[1]) {
          return `https://drive.google.com/uc?export=view&id=${m[1]}`;
        }
      }
    } catch {
      return value;
    }

    return value;
  };

  const getDriveFileId = (url: string) => {
    const value = (url || "").trim();
    if (!value) return "";
    try {
      const u = new URL(value);
      const idFromOpen = u.searchParams.get("id");
      if (idFromOpen) return idFromOpen;
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m?.[1]) return m[1];
      const m2 = u.pathname.match(/\/uc$/);
      if (m2) {
        const idFromUc = u.searchParams.get("id");
        if (idFromUc) return idFromUc;
      }
    } catch {
      return "";
    }
    return "";
  };

  const getDisplayableImageUrl = (
    url: string | null | undefined,
    size: number = 400
  ): string => {
    if (!url) return "https://via.placeholder.com/400?text=No+Image";

    try {
      const fileId =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ||
        url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ||
        url.match(/open\?id=([a-zA-Z0-9_-]+)/)?.[1] ||
        url.match(/([a-zA-Z0-9_-]{25,})/)?.[1] ||
        "";

      if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
      }

      const cacheBuster = Date.now();
      return url.includes("?")
        ? `${url}&cb=${cacheBuster}`
        : `${url}?cb=${cacheBuster}`;
    } catch {
      return "https://via.placeholder.com/400?text=Error+Loading+Image";
    }
  };

  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchQuotations = async () => {
      setLoadingQuotations(true);
      setQuotationFetchError(null);

      try {
        const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(
          QUOTATION_LOG_SHEET_NAME
        )}`;
        const res = await fetch(url);
        const json = await res.json().catch(() => null);

        if (!json?.success || !Array.isArray(json?.data)) {
          throw new Error(
            json?.error || "Failed to fetch quotations from sheet"
          );
        }

        // Expected columns in Quotation sheet:
        // Timestamp, Customer ID, Customer Name, Phone Number, Whatsapp Number, Email,
        // Product Name, Product Image, Qty, Price, Discount, Subtotal, Tax%
        const rows: any[][] = json.data;
        const dataRows = rows.slice(1);

        const mapped = dataRows
          .map((row: any[], idx: number): Quotation => {
            const timestamp = row?.[0]?.toString() || "";
            const customerId = row?.[1]?.toString() || "";
            const productName = row?.[6]?.toString() || "";
            const productImageUrl = row?.[7]?.toString() || "";
            const qty = Number(row?.[8] ?? 0) || 0;
            const price = Number(row?.[9] ?? 0) || 0;
            const discount = Number(row?.[10] ?? 0) || 0;
            const subtotal = Number(row?.[11] ?? qty * price - discount) || 0;
            const taxPercent = Number(row?.[12] ?? 0) || 0;
            const taxAmount = Math.round((subtotal * taxPercent) / 100);
            const total = subtotal + taxAmount;

            const item: QuotationItem = {
              productId: `sheet-item-${idx + 1}`,
              quantity: qty,
              price,
              discount,
              customTitle: productName,
              customPhoto: productImageUrl,
            };

            const idBase = timestamp ? Date.parse(timestamp) : Date.now();
            return {
              id: `quot-sheet-${idBase}-${idx + 1}`,
              customerId,
              employeeId: "",
              items: [item],
              subtotal,
              tax: taxAmount,
              discount,
              total,
              status: "draft" as const,
              versions: [],
              createdAt: timestamp || new Date().toISOString(),
              updatedAt: timestamp || new Date().toISOString(),
            };
          })
          .filter((q: Quotation) => Boolean(q.customerId));

        setQuotations(mapped);
      } catch (err: any) {
        console.error("Failed to fetch quotations (History)", err);
        setQuotations([]);
        setQuotationFetchError(err?.message || "Failed to fetch quotations");
      } finally {
        setLoadingQuotations(false);
      }
    };

    fetchQuotations();
  }, []);

  useEffect(() => {
    setIsLoading(Boolean(loadingQuotations));
  }, [loadingQuotations]);

  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(
    null
  );
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(
    null
  ); // View Modal
  const [sendingQuotation, setSendingQuotation] = useState<Quotation | null>(
    null
  );
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [sendMethod, setSendMethod] = useState<"whatsapp" | "email">(
    "whatsapp"
  );
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax] = useState(18);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get customer name by ID
  const getCustomerName = (customerId: string) => {
    if (!customers.length) return "Loading...";
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      console.warn(`Customer with ID ${customerId} not found`);
      return `Customer ${customerId}`;
    }
    return customer.name;
  };

  // Filter quotations based on search term
  const filtered = quotations.filter((quot) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const matchesId = quot.customerId.toLowerCase().includes(searchLower);
    const customerName = getCustomerName(quot.customerId).toLowerCase();
    const matchesName = customerName.includes(searchLower);

    return matchesId || matchesName;
  });

  const groupedQuotations = useMemo(() => {
    const grouped = new Map<string, Quotation[]>();

    for (const q of filtered) {
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
  }, [filtered]);

  useEffect(() => {
    if (editingQuotation) {
      setSelectedCustomer(editingQuotation.customerId);
      setItems(editingQuotation.items.map((i: QuotationItem) => ({ ...i })));
      setDiscount(editingQuotation.discount || 0);
      setShowCamera(null);
    }
  }, [editingQuotation]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <DollarSign className="w-3 h-3 text-green-600 mr-1" />;
      case "sent":
        return <Eye className="w-3 h-3 text-blue-600 mr-1" />;
      case "rejected":
        return <Clock className="w-3 h-3 text-red-600 mr-1" />;
      default:
        return <Clock className="w-3 h-3 text-yellow-600 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getCustomer = (customerId: string): Customer | undefined => {
    return customers.find((c) => c.id === customerId);
  };

  const openEdit = (quot: Quotation) => setEditingQuotation(quot);
  const closeEdit = () => {
    setEditingQuotation(null);
    setSelectedCustomer("");
    setItems([]);
    setDiscount(0);
    closeCamera();
  };

  const openView = (quot: Quotation) => setViewingQuotation(quot); // View Modal
  const closeView = () => setViewingQuotation(null);

  const openSend = (quot: Quotation) => {
    setSendingQuotation(quot);
    setSelectedCustomer(quot.customerId);
    setSendMethod("whatsapp");
  };
  const closeSend = () => {
    setSendingQuotation(null);
    setSelectedCustomer("");
  };

  const findQuotationRowIndexInSheet = async (quotation: Quotation) => {
    const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(
      QUOTATION_LOG_SHEET_NAME
    )}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => null);
    if (!json?.success || !Array.isArray(json?.data)) {
      throw new Error(json?.error || "Failed to fetch quotation sheet");
    }

    const rows: any[][] = json.data;
    const dataRows = rows.slice(1);

    const qTimestamp = String(quotation.createdAt || "").trim();
    const qCustomerId = String(quotation.customerId || "").trim();
    const qProductName = String(quotation.items?.[0]?.customTitle || "")
      .trim()
      .toLowerCase();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const rowTimestamp = String(row?.[0] ?? "").trim();
      const rowCustomerId = String(row?.[1] ?? "").trim();
      const rowProductName = String(row?.[6] ?? "")
        .trim()
        .toLowerCase();

      const timestampMatch = rowTimestamp === qTimestamp;
      const customerMatch = rowCustomerId === qCustomerId;
      const productMatch = !qProductName || rowProductName === qProductName;

      if (timestampMatch && customerMatch && productMatch) {
        return i + 2;
      }
    }

    return null;
  };

  const updateQuotationLinkInSheet = async (
    rowIndex: number,
    fileUrl: string
  ) => {
    const body = new URLSearchParams();
    body.append("action", "updateCell");
    body.append("sheetName", QUOTATION_LOG_SHEET_NAME);
    body.append("rowIndex", String(rowIndex));
    body.append("columnIndex", String(QUOTATION_LINK_COLUMN_INDEX));
    body.append("value", fileUrl);

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || "Failed to update quotation link");
    }
  };

  const downloadPDF = async (quotation: Quotation) => {
    if (downloadingPdfId) return;
    setDownloadingPdfId(quotation.id);
    const customer = getCustomer(quotation.customerId);
    try {
      const { fileUrl, pdfBlob, fileName } =
        await generateAndUploadQuotationPDF({
          quotation,
          customer,
          products,
          scriptUrl: SCRIPT_URL,
          folderId: QUOTATION_PDF_FOLDER_ID,
        });

      try {
        const rowIndex = await findQuotationRowIndexInSheet(quotation);
        if (rowIndex) {
          await updateQuotationLinkInSheet(rowIndex, fileUrl);
        }
      } catch (e) {
        console.error("Failed to write Quotation Link to sheet", e);
      }

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.open(fileUrl, "_blank");
    } catch (error) {
      console.error("PDF upload failed, downloading locally", error);
      generateQuotationPDF(quotation, customer, products);
      alert("PDF downloaded locally. Drive upload failed.");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleSend = async () => {
    if (!sendingQuotation || !selectedCustomer) return;
    const customer = getCustomer(selectedCustomer);
    if (!customer) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Send quotation ${sendingQuotation.id} to ${customer.name} via WhatsApp?`
    );

    if (!confirmed) return;

    try {
      // Generate PDF as blob for sharing
      const pdfBlob = await generatePDFBlob(
        sendingQuotation,
        customer,
        products
      );
      const pdfFile = new File(
        [pdfBlob],
        `quotation-${sendingQuotation.id}.pdf`,
        {
          type: "application/pdf",
        }
      );

      // Always use the reliable approach: Download PDF + WhatsApp with clear instructions
      // Create download link and trigger download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${sendingQuotation.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Small delay to ensure download starts, then open WhatsApp
      setTimeout(() => {
        const message = encodeURIComponent(
          `Hello ${customer.name}! 📋\n\n` +
          `I've prepared your quotation (${sendingQuotation.id}):\n\n` +
          `📦 Items: ${sendingQuotation.items.length}\n` +
          `💰 Total: ₹${sendingQuotation.total.toLocaleString()}\n\n` +
          `📎 *PLEASE ATTACH THE DOWNLOADED PDF FILE ABOVE*\n` +
          `The PDF should be in your downloads folder as: quotation-${sendingQuotation.id}.pdf\n\n` +
          `Let me know if you have any questions! 🙋‍♂️`
        );

        const whatsappUrl = `https://wa.me/${customer.phone}?text=${message}`;
        window.open(whatsappUrl, "_blank");
      }, 500);

      // Update quotation status
      const updated = { ...sendingQuotation, status: "sent" as const };
      updateQuotation(updated.id, updated);

      alert(
        `PDF downloaded! WhatsApp will open - please attach the downloaded PDF to your message.`
      );
      closeSend();
    } catch (error) {
      console.error("Error sending quotation:", error);
      alert("Error sending quotation. Please try again.");
    }
  };

  const addCustomItem = () => {
    const customId = `custom-${Date.now()}`;
    setItems([
      ...items,
      {
        productId: customId,
        quantity: 1,
        price: 0,
        discount: 0,
        customTitle: "",
      },
    ]);
  };

  const updateItem = (productId: string, updates: Partial<QuotationItem>) => {
    setItems(
      items.map((i) => (i.productId === productId ? { ...i, ...updates } : i))
    );
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const openCamera = async (productId: string) => {
    try {
      setShowCamera(productId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied");
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
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
    }
  };

  const handleFileUpload = (
    productId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      updateItem(productId, { customPhoto: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  const subtotal = items.reduce(
    (s: number, i: QuotationItem) =>
      s + i.price * i.quantity - (i.discount || 0),
    0
  );
  const taxAmount = Math.round((subtotal * tax) / 100);
  const total = subtotal + taxAmount;

  const handleUpdateSubmit = async () => {
    if (!selectedCustomer || items.length === 0 || !editingQuotation) {
      alert("Please select a customer and add items");
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Update Google Sheet
      const updateSheetCell = async (rowIndex: number, colIndex: number, value: any) => {
        const body = new URLSearchParams();
        body.append("action", "updateCell");
        body.append("sheetName", QUOTATION_LOG_SHEET_NAME);
        body.append("rowIndex", String(rowIndex));
        body.append("columnIndex", String(colIndex));
        body.append("value", String(value));

        await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
      };

      // Process items
      for (const item of items) {
        // Only update existing items linked to a sheet row
        if (item.productId.startsWith("sheet-item-")) {
          // Extract row index from ID (sheet-item-1 -> Row 2)
          // ID format: sheet-item-{idx+1} where idx is 0-based index from data array.
          // data array starts at Row 2. So idx=0 is Row 2.
          // ID=sheet-item-1 => idx=0 => Row 2.
          // Row Index = parseInt(ID.split('-')[2]) + 1
          const match = item.productId.match(/sheet-item-(\d+)/);
          if (match && match[1]) {
            const dataRowIndex = parseInt(match[1]);
            const sheetRowIndex = dataRowIndex + 1;

            const itemSubtotal = item.price * item.quantity - (item.discount || 0);

            // Update Columns G(6) to M(12)
            // Name (6)
            await updateSheetCell(sheetRowIndex, 7, item.customTitle || "");

            // Image (7) - Only update if it's a URL or empty, skip base64 to avoid huge payload if not handled
            if (item.customPhoto && !item.customPhoto.startsWith("data:")) {
              await updateSheetCell(sheetRowIndex, 8, item.customPhoto);
            }

            // Qty (8)
            await updateSheetCell(sheetRowIndex, 9, item.quantity);
            // Price (9) - This corresponds to Column J if we consider 0-index. 
            // Wait, Column A=0, B=1, ... G=6, H=7, I=8, J=9. Correct.
            await updateSheetCell(sheetRowIndex, 10, item.price);
            // Discount (10) - Column K
            await updateSheetCell(sheetRowIndex, 11, item.discount || 0);
            // Subtotal (11) - Column L
            await updateSheetCell(sheetRowIndex, 12, itemSubtotal);
            // Tax% (12) - Column M
            await updateSheetCell(sheetRowIndex, 13, tax);
          }
        }
      }

      const updatedQuotation = {
        ...editingQuotation,
        customerId: selectedCustomer,
        items: [...items],
        subtotal,
        tax: taxAmount,
        discount: 0,
        total,
        updatedAt: new Date().toISOString(),
      };

      // Update the quotation in the context
      await updateQuotation(editingQuotation.id, updatedQuotation);

      // Artificial delay to ensure user sees the feedback if operation is too fast
      await new Promise(resolve => setTimeout(resolve, 800));

      // Close the edit modal and reset form
      closeEdit();
      alert("Quotation updated successfully in Sheet!");
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update quotation");
    } finally {
      setIsUpdating(false);
    }
  };

  // === VIEW MODAL ===
  if (viewingQuotation) {
    const customer = getCustomer(viewingQuotation.customerId);
    const items = viewingQuotation.items;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] md:max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-5 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-600" />
                Customer {viewingQuotation.customerId}
              </h2>
              <button
                onClick={closeView}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Customer Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Customer</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {customer?.name[0] || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {customer?.name || "Unknown"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {customer?.phone || "No phone"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">Items</h3>
                {items.map((item, idx) => {
                  const product = products?.find(
                    (p) => p.id === item.productId
                  );
                  const title =
                    product?.title || item.customTitle || "Custom Item";

                  return (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">
                            {title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            ₹{item.price.toLocaleString()} × {item.quantity}
                          </p>
                          {item.discount > 0 && (
                            <p className="text-xs text-green-600">
                              Discount: ₹{item.discount}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Custom Photo */}
                      {item.customPhoto && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-2">
                            Attached Photo
                          </p>
                          <div className="relative w-full max-w-xs h-32 mx-auto rounded-lg overflow-hidden border border-gray-200">
                            {(() => {
                              const original = item.customPhoto;
                              const fileId = getDriveFileId(original);
                              const directUrl = getDisplayableImageUrl(
                                original,
                                800
                              );
                              const thumbUrl = fileId
                                ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
                                : "";

                              const proxiedDirectUrl = `/api/image-proxy?url=${encodeURIComponent(
                                directUrl
                              )}`;
                              const proxiedThumbUrl = thumbUrl
                                ? `/api/image-proxy?url=${encodeURIComponent(
                                  thumbUrl
                                )}`
                                : "";

                              return (
                                <img
                                  src={proxiedDirectUrl}
                                  alt="Item photo"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    if (!proxiedThumbUrl) return;
                                    const img = e.currentTarget;
                                    if (img.src === proxiedThumbUrl) return;
                                    img.src = proxiedThumbUrl;
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <div className="mt-2 text-center">
                            <a
                              href={normalizeImageUrl(item.customPhoto)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open Image
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Pricing */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Qty</span>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Price</span>
                          <p className="font-medium">
                            ₹{item.price.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total</span>
                          <p className="font-medium text-green-700">
                            ₹
                            {(
                              item.price * item.quantity -
                              (item.discount || 0)
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 mt-6 max-h-64 overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      ₹{viewingQuotation.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18%)</span>
                    <span className="font-medium">
                      ₹{viewingQuotation.tax.toLocaleString()}
                    </span>
                  </div>

                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-300">
                  <span className="font-bold text-gray-800">Total Amount</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    ₹{viewingQuotation.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2 text-xs text-gray-500 mt-3">
                  <span>
                    Created:{" "}
                    {new Date(viewingQuotation.createdAt).toLocaleString()}
                  </span>
                  {viewingQuotation.updatedAt &&
                    viewingQuotation.updatedAt !==
                    viewingQuotation.createdAt && (
                      <span>
                        • Updated:{" "}
                        {new Date(viewingQuotation.updatedAt).toLocaleString()}
                      </span>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === SEND MODAL ===
  if (sendingQuotation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                Send Quotation {sendingQuotation.id}
              </h2>
              <button
                onClick={closeSend}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send Via
                </label>
                <div className="flex justify-center">
                  <button
                    onClick={() => setSendMethod("whatsapp")}
                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all w-full max-w-xs ${sendMethod === "whatsapp"
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "border-gray-200"
                      }`}
                  >
                    <MessageCircle className="w-6 h-6" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSend}
                  disabled={!selectedCustomer}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send
                </button>
                <button
                  onClick={closeSend}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === EDIT MODAL ===
  if (editingQuotation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] md:max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-5 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                Edit Quotation {editingQuotation.id}
              </h2>
              <button
                onClick={closeEdit}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Customer */}
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Item */}
              <button
                onClick={addCustomItem}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Item
              </button>

              {/* Items */}
              {items.length > 0 && (
                <div className="space-y-4">
                  {items.map((item) => {
                    const product = products?.find(
                      (p) => p.id === item.productId
                    );
                    return (
                      <div
                        key={item.productId}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            {product ? (
                              <h3 className="font-semibold text-gray-800">
                                {product.title}
                              </h3>
                            ) : (
                              <input
                                type="text"
                                value={item.customTitle || ""}
                                onChange={(e) =>
                                  updateItem(item.productId, {
                                    customTitle: e.target.value,
                                  })
                                }
                                placeholder="Item title"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                              />
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              ₹{item.price.toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-red-500 p-2 rounded-lg hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Camera Modal */}
                        {showCamera === item.productId && (
                          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-5 rounded-2xl w-full max-w-sm">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">Take Photo</h4>
                                <button
                                  onClick={closeCamera}
                                  className="p-1 rounded hover:bg-gray-100"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-56 rounded-lg bg-gray-200"
                              />
                              <canvas ref={canvasRef} className="hidden" />
                              <div className="flex gap-3 mt-4">
                                <button
                                  onClick={() => capturePhoto(item.productId)}
                                  className="flex-1 bg-blue-500 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-1"
                                >
                                  <Camera className="w-4 h-4" />
                                  Capture
                                </button>
                                <button
                                  onClick={closeCamera}
                                  className="flex-1 bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Photo Upload */}
                        <div className="mb-4 pb-4 border-b border-gray-100">
                          <label className="text-xs text-gray-500 block mb-2">
                            Custom Photo
                          </label>
                          <div className="flex gap-3 items-start">
                            {item.customPhoto ? (
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden border">
                                {(() => {
                                  const original = item.customPhoto || "";
                                  if (original.startsWith("data:image/")) {
                                    return (
                                      <img
                                        src={original}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    );
                                  }

                                  const fileId = getDriveFileId(original);
                                  const directUrl = getDisplayableImageUrl(
                                    original,
                                    800
                                  );
                                  const thumbUrl = fileId
                                    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
                                    : "";

                                  const proxiedDirectUrl = `/api/image-proxy?url=${encodeURIComponent(
                                    directUrl
                                  )}`;
                                  const proxiedThumbUrl = thumbUrl
                                    ? `/api/image-proxy?url=${encodeURIComponent(
                                      thumbUrl
                                    )}`
                                    : "";

                                  return (
                                    <img
                                      src={proxiedDirectUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        if (!proxiedThumbUrl) return;
                                        const img = e.currentTarget;
                                        if (img.src === proxiedThumbUrl) return;
                                        img.src = proxiedThumbUrl;
                                      }}
                                    />
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                                No photo
                              </div>
                            )}
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openCamera(item.productId)}
                                  className="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                >
                                  <Camera className="w-4 h-4" />
                                  Camera
                                </button>
                                <label className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-center gap-1 w-2">
                                  <Upload className="w-4 h-4" />
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleFileUpload(item.productId, e)
                                    }
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              {item.customPhoto && (
                                <button
                                  onClick={() =>
                                    updateItem(item.productId, {
                                      customPhoto: undefined,
                                    })
                                  }
                                  className="text-red-500 text-xs flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inputs */}
                        <div className="grid grid-cols-3 gap-3">
                          {["Qty", "Price", "Discount"].map((label, i) => {
                            const key = ["quantity", "price", "discount"][
                              i
                            ] as keyof QuotationItem;
                            return (
                              <div key={label}>
                                <label className="text-xs text-gray-500 block mb-1">
                                  {label}
                                </label>
                                <input
                                  type="number"
                                  min={i === 0 ? "1" : "0"}
                                  value={item[key] as number}
                                  onChange={(e) =>
                                    updateItem(item.productId, {
                                      [key]: parseInt(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mt-6">
                <h3 className="font-semibold mb-3 text-gray-800">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      ₹{subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18%)</span>
                    <span className="font-medium">
                      ₹{taxAmount.toLocaleString()}
                    </span>
                  </div>

                  Summary
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                    ₹{total.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleUpdateSubmit}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Updating...
                      </div>
                    ) : (
                      "Update"
                    )}
                  </button>
                  <button
                    onClick={closeEdit}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN LIST VIEW ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <History className="w-7 h-7 md:w-8 md:h-8" />
            Quotation History
          </h1>
          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-green-500" />
              Quotations ({groupedQuotations.length})
            </h2>
          </div>

          {quotationFetchError && (
            <div className="px-6 py-3 border-b border-gray-100 text-sm text-red-700 bg-red-50">
              {quotationFetchError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["ID", "Customer", "Items", "Amount", "Date", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingQuotations
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={`sk-${i}`}
                      className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-6 py-4">
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                  : groupedQuotations.map((quot, i) => (
                    <tr
                      key={quot.id}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"
                        } hover:bg-gray-100 transition`}
                    >
                      <td className="px-6 py-4 font-mono text-sm text-gray-900">
                        {quot.customerId}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getCustomerName(quot.customerId)[0]}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {getCustomerName(quot.customerId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {quot.items.length} items
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        ₹{quot.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(quot.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(quot)}
                            className="text-green-600 hover:text-green-800 p-1.5 rounded hover:bg-green-50"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openSend(quot)}
                            className="text-orange-600 hover:text-orange-800 p-1.5 rounded hover:bg-orange-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadPDF(quot)}
                            className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50"
                            title="Download PDF"
                            disabled={!!downloadingPdfId}
                          >
                            {downloadingPdfId === quot.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openView(quot)}
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {quotationFetchError && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-100">
              {quotationFetchError}
            </div>
          )}

          {loadingQuotations
            ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skm-${i}`}
                className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-8 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))
            : groupedQuotations.map((quot) => (
              <div
                key={quot.id}
                className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-mono text-sm font-semibold text-gray-900">
                    {quot.customerId}
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      quot.status
                    )} flex items-center gap-1`}
                  >
                    {getStatusIcon(quot.status)}
                    {quot.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getCustomerName(quot.customerId)[0]}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {getCustomerName(quot.customerId)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(quot.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-600">
                    {quot.items.length} items
                  </span>
                  <span className="font-semibold text-gray-900">
                    ₹{quot.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(quot)}
                    className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => openSend(quot)}
                    className="flex-1 bg-orange-100 text-orange-700 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={() => downloadPDF(quot)}
                    disabled={!!downloadingPdfId}
                    className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1"
                  >
                    {downloadingPdfId === quot.id ? (
                      <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => openView(quot)}
                    className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-lg font-medium text-xs flex items-center justify-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
        </div>

        {groupedQuotations.length === 0 && (
          <div className="text-center py-16">
            <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No quotations yet
            </h3>
            <p className="text-gray-500">Your history will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
