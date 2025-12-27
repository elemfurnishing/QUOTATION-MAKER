"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAdmin } from "@/src/contexts/AdminContext";
import { useEmployee } from "@/src/contexts/EmployeeContext";
import type { Quotation, QuotationItem, Customer } from "@/src/types/index";
import {
  generateQuotationPDF,
  generatePDFBlob,
  generateAndUploadQuotationPDF,
} from "@/src/utils/pdfGenerator";
import {
  Eye,
  X,
  Package,
  DollarSign,
  Calendar,
  User,
  Camera,
  Upload,
  FileText,
  Search,
  Edit3,
  Send,
  MessageCircle,
  Mail,
  Trash2,
  Plus,
  History,
  Clock,
  Check,
  AlertCircle,
} from "lucide-react";

export default function QuotationsPage() {
  const { customers, products } = useAdmin();
  const { updateQuotation } = useEmployee();
  
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
  const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";
  const QUOTATION_LOG_SHEET_NAME = "Quotation";
  const QUOTATION_PDF_FOLDER_ID = "1QKe0M9eQQ1kY7xWUqodcwLFAQfGuEY7F";
  const DRIVE_FOLDER_ID = "1OjDF5Jr2O5KtRTmxRcSa-ApFuFtyCOxe";
  const QUOTATION_LINK_COLUMN_INDEX = 14;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);
  const [quotationFetchError, setQuotationFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // View Modal State
  const [viewingQuotation, setViewingQuotation] = useState<Quotation | null>(null);
  
  // Edit Modal State
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [architectCode, setArchitectCode] = useState("");
  const [architectName, setArchitectName] = useState("");
  const [architectNumber, setArchitectNumber] = useState("");
  const [showArchitectFields, setShowArchitectFields] = useState(false);
  
  // Send Modal State
  const [sendingQuotation, setSendingQuotation] = useState<Quotation | null>(null);
  const [sendMethod, setSendMethod] = useState<"whatsapp" | "email">("whatsapp");
  
  // Camera State
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // PDF State
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Inventory State for item search
  const INVENTORY_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr8QBIGE3jlMqm3w4r3f-jvRKTJdUKP0Tc4jDITpadSJqQbL8JOC_E6TLXr0xxBJKknA/exec";
  const INVENTORY_SPREADSHEET_ID = "1rKr7wOCQdDRunIvSdBFnGVy1VQGgQvcwXeFqVD9wuFM";
  const INVENTORY_SHEET_NAME = "Inventory";
  const [inventory, setInventory] = useState<any[]>([]);
  const [availableQtyMap, setAvailableQtyMap] = useState<Record<string, number>>({});

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000); // Auto remove after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Utility functions for image URLs
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

  // Fetch quotations from sheet
  // Fetch quotations from sheet
  const fetchQuotations = async () => {
    setIsLoadingQuotations(true);
    setQuotationFetchError(null);

    try {
      const url = `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${encodeURIComponent(
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
      // 0: Timestamp, 1: Customer ID, 2: Customer Name, 3: Phone Number, 4: Whatsapp Number, 5: Email,
      // 6: Product Name, 7: Product Image, 8: Qty, 9: Price, 10: Discount, 11: Subtotal, 12: Tax%
      // 13: Quotation Link, 14: Serial No
      const rows: any[][] = json.data;
      const dataRows = rows.slice(1);

      const mapped = dataRows
        .map((row: any[], idx: number): Quotation => {
          const timestamp = row?.[0]?.toString() || "";
          const customerId = row?.[1]?.toString() || "";
          const customerName = row?.[2]?.toString() || "";
          const productName = row?.[6]?.toString() || "";
          const productImageUrl = row?.[7]?.toString() || "";
          const qty = Number(row?.[8] ?? 0) || 0;
          const price = Number(row?.[9] ?? 0) || 0;
          const discountVal = Number(row?.[10] ?? 0) || 0;
          const subtotal = Number(row?.[11] ?? qty * price - discountVal) || 0;
          const serialNo = row?.[14]?.toString() || "";
          const employeeCode = row?.[15]?.toString() || "";
          const architectCode = row?.[16]?.toString() || "";
          const architectName = row?.[17]?.toString() || "";
          const architectNumber = row?.[18]?.toString() || "";
          const taxPercent = 0;
          const taxAmount = 0;
          const total = subtotal;

          const item: QuotationItem = {
            productId: `sheet-item-${idx + 1}`,
            quantity: qty,
            price,
            discount: discountVal,
            customTitle: productName,
            customPhoto: productImageUrl,
          };

          const idBase = timestamp ? Date.parse(timestamp) : Date.now();
          return {
            id: `quot-sheet-${idBase}-${idx + 1}`,
            customerId,
            customerName,
            employeeId: "",
            items: [item],
            subtotal,
            tax: taxAmount,
            discount: discountVal,
            total,
            status: "draft" as const,
            versions: [],
            createdAt: timestamp || new Date().toISOString(),
            updatedAt: timestamp || new Date().toISOString(),
            serialNo: serialNo,
            employeeCode,
            architectCode,
            architectName,
            architectNumber,
          };
        })
        .filter((q: Quotation) => Boolean(q.customerId));

      setQuotations(mapped);
    } catch (err: any) {
      console.error("Failed to fetch quotations", err);
      if (quotations.length === 0) {
        setQuotations([]);
      }
      setQuotationFetchError(err?.message || "Failed to fetch quotations");
    } finally {
      setIsLoadingQuotations(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Filter quotations based on search term
  const filteredQuotations = useMemo(() => {
    if (!searchQuery.trim()) return quotations;

    const query = searchQuery.toLowerCase().trim();
    return quotations.filter((quot) => {
      // Use customerName from quotation if available, otherwise look up in customers
      const customerName = quot.customerName?.toLowerCase() || 
                          customers.find((c) => c.id === quot.customerId)?.name?.toLowerCase() || 
                          "";
      const customerPhone = customers.find((c) => c.id === quot.customerId)?.phone || "";
      const amount = quot.total.toString();
      const date = new Date(quot.createdAt).toLocaleDateString().toLowerCase();
      const serialNo = quot.serialNo?.toLowerCase() || "";

      return (
        serialNo.includes(query) ||
        customerName.includes(query) ||
        customerPhone.includes(query) ||
        amount.includes(query) ||
        date.includes(query)
      );
    });
  }, [quotations, customers, searchQuery]);

  // Group quotations by Serial Number
  const groupedQuotations = useMemo(() => {
    const grouped = new Map<string, Quotation[]>();

    for (const q of filteredQuotations) {
      const key = q.serialNo || "unknown";
      const list = grouped.get(key);
      if (list) list.push(q);
      else grouped.set(key, [q]);
    }

    const aggregated: Quotation[] = Array.from(grouped.entries()).map(
      ([serialNo, qs]) => {
        const items = qs.flatMap((q) => q.items);
        const subtotal = qs.reduce((sum, q) => sum + (q.subtotal || 0), 0);
        const tax = 0;
        const discountVal = qs.reduce((sum, q) => sum + (q.discount || 0), 0);
        const total = subtotal;

        const latest = qs.reduce((a, b) =>
          new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime()
            ? a
            : b
        );

        return {
          id: `serial-${serialNo}`,
          customerId: latest.customerId,
          customerName: latest.customerName,
          employeeId: latest.employeeId,
          items,
          subtotal,
          tax,
          discount: discountVal,
          total,
          status: latest.status,
          versions: [],
          createdAt: latest.createdAt,
          updatedAt: latest.updatedAt || latest.createdAt,
          serialNo: serialNo,
          employeeCode: latest.employeeCode,
          architectCode: latest.architectCode,
          architectName: latest.architectName,
          architectNumber: latest.architectNumber,
        };
      }
    );

    // Sort by createdAt date (most recent first)
    aggregated.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return aggregated;
  }, [filteredQuotations]);

  // Helper functions
  const getCustomerName = (customerId: string, quotation?: Quotation) => {
    // First, try to use customerName from quotation if available
    if (quotation?.customerName) return quotation.customerName;
    
    // Otherwise, fall back to looking up in customers array
    if (!customers.length) return "Loading...";
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return `Customer ${customerId}`;
    return customer.name;
  };

  const getCustomerPhone = (id: string) => {
    return customers.find((c) => c.id === id)?.phone || "—";
  };

  const getCustomer = (customerId: string): Customer | undefined => {
    return customers.find((c) => c.id === customerId);
  };

  const getProduct = (productId: string) => {
    return products.find((p) => p.id === productId);
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

  // Modal handlers
  const openView = (quot: Quotation) => setViewingQuotation(quot);
  const closeView = () => setViewingQuotation(null);

  const openEdit = (quot: Quotation) => {
    console.log("=== OPENING EDIT ===");
    console.log("Quotation object:", quot);
    console.log("Employee Code from quotation:", quot.employeeCode);
    console.log("Architect Code from quotation:", quot.architectCode);
    console.log("Architect Name from quotation:", quot.architectName);
    console.log("Architect Number from quotation:", quot.architectNumber);
    
    setEditingQuotation(quot);
    setEmployeeCode(quot.employeeCode || "");
    setArchitectCode(quot.architectCode || "");
    setArchitectName(quot.architectName || "");
    setArchitectNumber(quot.architectNumber || "");
    setShowArchitectFields(!!quot.architectCode || !!quot.architectName || !!quot.architectNumber);
    
    console.log("Set Employee Code to:", quot.employeeCode || "");
    console.log("Set Architect Code to:", quot.architectCode || "");
  };

  const closeEdit = () => {
    setEditingQuotation(null);
    setSelectedCustomer("");
    setItems([]);
    setDiscount(0);
    closeCamera();
    setEmployeeCode("");
    setArchitectCode("");
    setArchitectName("");
    setArchitectNumber("");
    setShowArchitectFields(false);
  };

  const openSend = (quot: Quotation) => {
    setSendingQuotation(quot);
    setSelectedCustomer(quot.customerId);
    setSendMethod("whatsapp");
  };
  const closeSend = () => {
    setSendingQuotation(null);
    setSelectedCustomer("");
  };

  // Initialize edit form when editing
  useEffect(() => {
    if (editingQuotation) {
      console.log("=== USEFFECT INITIALIZING EDIT FORM ===");
      console.log("Employee Code:", editingQuotation.employeeCode);
      setSelectedCustomer(editingQuotation.customerId);
      setItems(editingQuotation.items.map((i: QuotationItem) => ({ ...i })));
      setDiscount(editingQuotation.discount || 0);
      setShowCamera(null);
      
      // Ensure employee and architect fields are set
      setEmployeeCode(editingQuotation.employeeCode || "");
      setArchitectCode(editingQuotation.architectCode || "");
      setArchitectName(editingQuotation.architectName || "");
      setArchitectNumber(editingQuotation.architectNumber || "");
      setShowArchitectFields(!!editingQuotation.architectCode || !!editingQuotation.architectName || !!editingQuotation.architectNumber);
    }
  }, [editingQuotation]);

  // Camera functions
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

  // Item management
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

  // Fetch Inventory for item search
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
              availableQty: parseInt(String(r[14] || "0").replace(/[^0-9]/g, "")) || 0,
            };
          })
          .filter((p: any) => p.code);
        setInventory(products);
      }
    } catch (e) {
      console.error("Failed to fetch inventory:", e);
    }
  };

  // Fetch inventory on component mount
  useEffect(() => {
    fetchInventory();
  }, []);

  // Universal search handler for items
  const handleUniversalSearch = (itemId: string, searchValue: string) => {
    if (!searchValue.trim()) {
      setToast({ message: "⚠️ Please enter a search term!", type: "warning" });
      return;
    }
    if (inventory.length === 0) {
      setToast({ message: "⚠️ Inventory not loaded yet! Please wait.", type: "warning" });
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
      // Found match - update item directly without popup
      updateItem(itemId, {
        customTitle: match.name,
        price: Number(match.price) || 0,
        customPhoto: match.image || undefined,
      });
      setAvailableQtyMap(prev => ({ ...prev, [itemId]: match.availableQty || 0 }));
      setToast({ message: "✅ Product found and applied!", type: "success" });
    } else {
      setToast({ message: "❌ Product not found in inventory. Try another search term.", type: "error" });
    }
  };

  // Calculate totals
  const subtotal = items.reduce(
    (s: number, i: QuotationItem) =>
      s + i.price * i.quantity - (i.discount || 0),
    0
  );
  const taxAmount = Math.round((subtotal * tax) / 100);
  const total = subtotal + taxAmount;

  // PDF functions
  const findQuotationRowIndexInSheet = async (quotation: Quotation) => {
    const url = `${SCRIPT_URL}?spreadsheetId=${SPREADSHEET_ID}&sheet=${encodeURIComponent(
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

  // Send quotation via WhatsApp
  const handleSend = async () => {
    if (!sendingQuotation || !selectedCustomer) return;
    const customer = getCustomer(selectedCustomer);
    if (!customer) return;

    const confirmed = window.confirm(
      `Send quotation ${sendingQuotation.serialNo || sendingQuotation.id} to ${customer.name} via WhatsApp?`
    );

    if (!confirmed) return;

    try {
      const pdfBlob = await generatePDFBlob(
        sendingQuotation,
        customer,
        products
      );

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${sendingQuotation.serialNo || sendingQuotation.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        const message = encodeURIComponent(
          `Hello ${customer.name}! 📋\n\n` +
          `I've prepared your quotation (${sendingQuotation.serialNo || sendingQuotation.id}):\n\n` +
          `📦 Items: ${sendingQuotation.items.length}\n` +
          `💰 Total: ₹${sendingQuotation.total.toLocaleString()}\n\n` +
          `📎 *PLEASE ATTACH THE DOWNLOADED PDF FILE ABOVE*\n` +
          `The PDF should be in your downloads folder.\n\n` +
          `Let me know if you have any questions! 🙋‍♂️`
        );

        const whatsappUrl = `https://wa.me/${customer.phone}?text=${message}`;
        window.open(whatsappUrl, "_blank");
      }, 500);

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

  // Update quotation in sheet
  const parseDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], base64Data: match[2] };
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

    const json = await res.json().catch(() => null);
    if (!json?.success || !json?.fileUrl) {
      throw new Error(json?.error || "Image upload failed");
    }
    return String(json.fileUrl);
  };

  const appendQuotationLogRow = async (rowData: any[]) => {
    const params = new URLSearchParams();
    params.append("action", "insert");
    params.append("sheetName", QUOTATION_LOG_SHEET_NAME);
    params.append("rowData", JSON.stringify(rowData));

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const json = await res.json().catch(() => null);
    if (!json?.success) {
      throw new Error(json?.error || "Failed to insert quotation log row");
    }
  };

  const deleteSheetRow = async (rowIndex: number) => {
    const body = new URLSearchParams();
    body.append("action", "delete");
    body.append("sheetName", QUOTATION_LOG_SHEET_NAME);
    body.append("rowIndex", String(rowIndex));
    
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || "Failed to delete row in Quotation sheet");
    }
  };

  const handleUpdateSubmit = async () => {
    if (!selectedCustomer || items.length === 0 || !editingQuotation) {
      alert("Please select a customer and add items");
      return;
    }

    setIsUpdating(true);
    setUpdateMessage("Starting update...");
    try {
      // Helper function to update a single cell
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
      
      // Update Existing Items
      const existingItems = items.filter((i) => i.productId.startsWith("sheet-item-"));
      if (existingItems.length > 0) {
        setUpdateMessage(`Updating ${existingItems.length} existing item(s)...`);
        
        // Update all existing items in parallel for speed
        await Promise.all(
          existingItems.map(async (item) => {
            const match = item.productId.match(/sheet-item-(\d+)/);
            if (match && match[1]) {
              const dataRowIndex = parseInt(match[1]);
              const sheetRowIndex = dataRowIndex + 1;
              const itemSubtotal = item.price * item.quantity - (item.discount || 0);

              // Update all fields in parallel
              return Promise.all([
                updateSheetCell(sheetRowIndex, 7, item.customTitle || ""),
                item.customPhoto && !item.customPhoto.startsWith("data:") 
                  ? updateSheetCell(sheetRowIndex, 8, item.customPhoto)
                  : Promise.resolve(),
                updateSheetCell(sheetRowIndex, 9, item.quantity),
                updateSheetCell(sheetRowIndex, 10, item.price),
                updateSheetCell(sheetRowIndex, 11, item.discount || 0),
                updateSheetCell(sheetRowIndex, 12, itemSubtotal),
                updateSheetCell(sheetRowIndex, 16, employeeCode || ""),
                updateSheetCell(sheetRowIndex, 17, architectCode || ""),
                updateSheetCell(sheetRowIndex, 18, architectName || ""),
                updateSheetCell(sheetRowIndex, 19, architectNumber || ""),
              ]);
            }
          })
        );
      }
      
      // Insert New Items
      setUpdateMessage("Processing new items...");
      const newItems = items.filter((i) => !i.productId.startsWith("sheet-item-"));
      if (newItems.length > 0) {
        const customer = getCustomer(selectedCustomer);
        const timestamp = editingQuotation.createdAt || new Date().toISOString(); 
        const dateStr = new Date(timestamp).toLocaleString();
        
        console.log("=== NEW ITEMS DEBUG ===");
        console.log("Employee Code:", employeeCode);
        console.log("Architect Code:", architectCode);
        console.log("Architect Name:", architectName);
        console.log("Architect Number:", architectNumber);
        
        // Upload all images in parallel first for speed
        setUpdateMessage(`Uploading ${newItems.filter(i => i.customPhoto?.startsWith("data:")).length} image(s)...`);
        const imageUploadPromises = newItems.map(async (item, index) => {
          if (item.customPhoto && item.customPhoto.startsWith("data:")) {
            console.log(`Uploading image for item ${index + 1}...`);
            return await uploadImageToDrive(item.customPhoto, `product-${Date.now()}-${index}.jpg`);
          }
          return item.customPhoto || "";
        });
        
        const uploadedImageUrls = await Promise.all(imageUploadPromises);
        
        // Now save all items with their uploaded images
        setUpdateMessage(`Saving ${newItems.length} item(s)...`);
        for (let index = 0; index < newItems.length; index++) {
            const item = newItems[index];
            console.log(`Saving item ${index + 1}/${newItems.length}`);
            
            const photoUrl = uploadedImageUrls[index];
            const itemSubtotal = (item.price * item.quantity) - (item.discount || 0);
            
            const rowData = [
                dateStr, // 0
                customer?.id || "", // 1
                customer?.name || "", // 2
                customer?.phone || "", // 3
                customer?.phone || "", // 4 (Whatsapp)
                customer?.email || "", // 5
                item.customTitle || "Custom Item", // 6
                photoUrl, // 7
                item.quantity, // 8
                item.price, // 9
                item.discount || 0, // 10
                itemSubtotal, // 11
                tax, // 12
                "", // 13 
                editingQuotation.serialNo || "", // 14
                employeeCode || "", // 15
                architectCode || "", // 16
                architectName || "", // 17
                architectNumber || "" // 18
            ];

            console.log(`Saving item ${index + 1} with Employee Code: ${employeeCode}`);
            await appendQuotationLogRow(rowData);
        }
      }

      // Delete Removed Items from Sheet (in parallel for speed)
      const currentItemIds = new Set(items.map(i => i.productId));
      const removedItems = editingQuotation.items.filter(
        i => i.productId.startsWith("sheet-item-") && !currentItemIds.has(i.productId)
      );

      if (removedItems.length > 0) {
        setUpdateMessage(`Deleting ${removedItems.length} item(s)...`);
        const removedIndices = removedItems
          .map(i => {
             const match = i.productId.match(/sheet-item-(\d+)/);
             return match ? parseInt(match[1]) : -1;
          })
          .filter(idx => idx !== -1)
          .sort((a, b) => b - a); // Sort descending to delete from bottom up

        // Delete all items in parallel for speed
        await Promise.all(
          removedIndices.map(dataRowIndex => deleteSheetRow(dataRowIndex + 1))
        );
      }

      const updatedQuotationFull: Quotation = {
        ...editingQuotation,
        customerId: selectedCustomer,
        items: [...items],
        subtotal,
        tax: taxAmount,
        discount: 0,
        total,
        updatedAt: new Date().toISOString(),
        employeeCode,
        architectCode,
        architectName,
        architectNumber,
      };

      // Optimistically update local state
      setQuotations((prev) => {
        const filtered = prev.filter(q => q.serialNo !== editingQuotation.serialNo);
        return [...filtered, updatedQuotationFull];
      });

      // Context update
      await updateQuotation(editingQuotation.id, updatedQuotationFull);

      // Close immediately for better UX
      closeEdit();
      
      // Refresh in background (non-blocking)
      fetchQuotations();
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update quotation");
    } finally {
      setIsUpdating(false);
      setUpdateMessage("");
    }
  };

  // === EDIT MODAL ===
  if (editingQuotation) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Edit {editingQuotation.serialNo || editingQuotation.id}
              </h2>
              <button
                onClick={closeEdit}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toast Notification */}
            {toast && (
              <div className={`fixed top-4 right-4 z-[60] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-bounce-in
                ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
                  toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                  'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                {toast.type === 'error' && <X className="w-5 h-5 text-red-600" />}
                {toast.type === 'success' && <Check className="w-5 h-5 text-green-600" />} 
                {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                <span className="font-medium">{toast.message}</span>
              </div>
            )}

            <div className="p-4 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  disabled
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Customer cannot be changed during edit</p>
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
                      className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Architect Name</label>
                        <input
                          type="text"
                          value={architectName}
                          onChange={(e) => setArchitectName(e.target.value)}
                          placeholder="Name"
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Architect Number</label>
                        <input
                          type="text"
                          value={architectNumber}
                          onChange={(e) => setArchitectNumber(e.target.value)}
                          placeholder="Phone Number"
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    New items added will use these details
                  </p>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-700">Items</h3>
                  <button
                    onClick={addCustomItem}
                    className="text-sm text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={item.productId}
                    className="p-4 border rounded-xl bg-gray-50 space-y-3 relative group"
                  >
                   <button
                        onClick={() => removeItem(item.productId)}
                        className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Item"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Search / Title */}
                       <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            Item Search (ID/Name/Serial)
                        </label>
                         <div className="flex gap-2">
                            <input
                            type="text"
                            placeholder="Enter Item Code / Name / Serial No"
                            className="flex-1 p-2 border rounded-lg text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                handleUniversalSearch(item.productId, (e.target as HTMLInputElement).value);
                                }
                            }}
                            onBlur={(e) => {
                                if (e.target.value) {
                                    handleUniversalSearch(item.productId, e.target.value);
                                }
                            }}
                            />
                            <button
                                className="bg-blue-600 text-white p-2 rounded-lg"
                                onClick={(e) => {
                                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                    handleUniversalSearch(item.productId, input.value);
                                }}
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                       </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Item Name
                        </label>
                        <input
                          type="text"
                          value={item.customTitle}
                          onChange={(e) =>
                            updateItem(item.productId, {
                              customTitle: e.target.value,
                            })
                          }
                          className="w-full p-2 border rounded-lg text-sm"
                          placeholder="Item Name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Price
                          </label>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) =>
                              updateItem(item.productId, {
                                price: Number(e.target.value),
                              })
                            }
                            className="w-full p-2 border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Qty
                          </label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.productId, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="w-full p-2 border rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                            Discount
                            </label>
                            <input
                            type="number"
                            value={item.discount}
                            onChange={(e) =>
                                updateItem(item.productId, {
                                discount: Number(e.target.value),
                                })
                            }
                            className="w-full p-2 border rounded-lg text-sm"
                            />
                        </div>
                         {/* Available Qty Display */}
                        {availableQtyMap[item.productId] !== undefined && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                Stock
                                </label>
                                <div className={`w-full p-2 border rounded-lg text-sm bg-gray-100 ${availableQtyMap[item.productId] < 5 ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                    {availableQtyMap[item.productId]}
                                </div>
                            </div>
                        )}
                      </div>
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Photo
                      </label>
                      <div className="flex items-center gap-2">
                        {item.customPhoto ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                            <img
                              src={
                                item.customPhoto.startsWith("data:")
                                  ? item.customPhoto
                                  : `/api/image-proxy?url=${encodeURIComponent(
                                      getDisplayableImageUrl(item.customPhoto || "", 200)
                                    )}`
                              }
                              alt="Item"
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() =>
                                updateItem(item.productId, { customPhoto: undefined })
                              }
                              className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCamera(item.productId)}
                              className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200"
                            >
                              <Camera className="w-4 h-4" /> Camera
                            </button>
                            <label className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer">
                              <Upload className="w-4 h-4" /> Upload
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileUpload(item.productId, e)
                                }
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Camera View */}
                    {showCamera === item.productId && (
                      <div className="fixed inset-0 bg-black z-50 flex flex-col">
                        <div className="absolute top-4 right-4 z-10">
                          <button onClick={closeCamera} className="bg-white/20 p-2 rounded-full text-white">
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="flex-1 object-cover"
                        />
                        <div className="p-4 bg-black flex justify-center pb-8">
                            <div 
                                onClick={() => capturePhoto(item.productId)}
                                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center cursor-pointer active:scale-90 transition"
                            >
                                <div className="w-14 h-14 bg-white rounded-full" />
                            </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-blue-600">₹{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t sticky bottom-0 z-10">
              <button
                onClick={handleUpdateSubmit}
                disabled={isUpdating}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                    <>
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    {updateMessage || "Updating..."}
                    </>
                ) : (
                    "Update Quotation"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === VIEW MODAL ===
  if (viewingQuotation) {
    const customer = getCustomer(viewingQuotation.customerId);
    const viewItems = viewingQuotation.items;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] md:max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-5 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Eye className="w-6 h-6 text-blue-600" />
                {viewingQuotation.serialNo || `Quotation`}
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
                <h3 className="font-semibold text-gray-800">Items ({viewItems.length})</h3>
                {viewItems.map((item, idx) => {
                  const product = products?.find((p) => p.id === item.productId);
                  const title = product?.title || item.customTitle || "Custom Item";

                  return (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{title}</h4>
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
                          <p className="text-xs text-gray-500 mb-2">Attached Photo</p>
                          <div className="relative w-full max-w-xs h-32 mx-auto rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={`/api/image-proxy?url=${encodeURIComponent(getDisplayableImageUrl(item.customPhoto, 800))}`}
                              alt="Item photo"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const fileId = getDriveFileId(item.customPhoto || "");
                                if (!fileId) return;
                                const img = e.currentTarget;
                                const thumbUrl = `/api/image-proxy?url=${encodeURIComponent(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`)}`;
                                if (img.src === thumbUrl) return;
                                img.src = thumbUrl;
                              }}
                            />
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
                          <p className="font-medium">₹{item.price.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total</span>
                          <p className="font-medium text-green-700">
                            ₹{(item.price * item.quantity - (item.discount || 0)).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5">
                <h3 className="font-bold text-gray-800 mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      ₹{viewingQuotation.subtotal.toLocaleString()}
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
                    Created: {new Date(viewingQuotation.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => downloadPDF(viewingQuotation)}
                  disabled={downloadingPdfId === viewingQuotation.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {downloadingPdfId === viewingQuotation.id ? "Generating..." : "Download PDF"}
                </button>
                <button
                  onClick={() => {
                    closeView();
                    openSend(viewingQuotation);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-3 rounded-xl font-semibold"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
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
                Send {sendingQuotation.serialNo || sendingQuotation.id}
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send via
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSendMethod("whatsapp")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 ${
                      sendMethod === "whatsapp"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200"
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => setSendMethod("email")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 ${
                      sendMethod === "email"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200"
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                    Email
                  </button>
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={!selectedCustomer}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Send Quotation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN PAGE ===
  return (
    <div className="p-6 md:p-8 lg:p-10 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
          <History className="w-8 h-8 text-blue-600" />
          Quotation History
        </h1>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Serial No, Name, Phone, Amount..."
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
                <span>Loading quotations...</span>
              </span>
            ) : (
              <span>
                {groupedQuotations.length} quotations (grouped by Serial No)
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
                  {["Serial No", "Customer", "Items", "Amount", "Date", "Status", "Actions"].map((h) => (
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
                    <tr key={`sk-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-4 w-40 bg-slate-200 rounded animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-4 w-12 bg-slate-200 rounded animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-4 w-20 bg-slate-200 rounded animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-4 w-28 bg-slate-200 rounded animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" /></td>
                      <td className="py-4 px-6"><div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" /></td>
                    </tr>
                  ))
                  : groupedQuotations.map((quot, i) => (
                    <tr
                      key={quot.id}
                      className={`hover:bg-slate-50 transition-all ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                    >
                      <td className="py-4 px-6 font-mono text-sm text-blue-600 font-semibold">
                        {quot.serialNo || "—"}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getCustomerName(quot.customerId, quot)[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {getCustomerName(quot.customerId, quot)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {getCustomerPhone(quot.customerId)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600">
                        {quot.items.length} items
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        ₹{quot.total.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(quot.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(quot.status)}`}>
                          {getStatusIcon(quot.status)}
                          {quot.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(quot)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openView(quot)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadPDF(quot)}
                            disabled={downloadingPdfId === quot.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                            title="Download PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openSend(quot)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="Send"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden max-h-[70vh] overflow-y-auto pr-2 space-y-4 pb-4">
          {isLoadingQuotations
            ? Array.from({ length: 4 }).map((_, i) => (
              <div key={`skm-${i}`} className="bg-white rounded-2xl shadow-lg p-5 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-20 bg-slate-200 rounded" />
              </div>
            ))
            : groupedQuotations.map((quot, i) => (
              <div
                key={quot.id}
                className={`bg-white/90 backdrop-blur-sm border border-white/30 rounded-2xl shadow-lg p-5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {getCustomerName(quot.customerId, quot)[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {getCustomerName(quot.customerId, quot)}
                      </p>
                      <p className="text-xs text-blue-600 font-mono font-semibold">
                        {quot.serialNo || "—"}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(quot.status)}`}>
                    {quot.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Items</span>
                    <span className="text-slate-900">{quot.items.length}</span>
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(quot)}
                      className="flex-1 flex items-center justify-center gap-1 text-orange-600 py-2 px-3 border border-orange-200 rounded-lg hover:bg-orange-50 text-sm font-medium"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => openView(quot)}
                      className="flex-1 flex items-center justify-center gap-1 text-blue-600 py-2 px-3 border border-blue-200 rounded-lg hover:bg-blue-50 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => downloadPDF(quot)}
                      disabled={downloadingPdfId === quot.id}
                      className="flex-1 flex items-center justify-center gap-1 text-green-600 py-2 px-3 border border-green-200 rounded-lg hover:bg-green-50 text-sm font-medium disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => openSend(quot)}
                      className="flex-1 flex items-center justify-center gap-1 text-purple-600 py-2 px-3 border border-purple-200 rounded-lg hover:bg-purple-50 text-sm font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            ))}
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

        {/* Error State */}
        {quotationFetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <p className="font-semibold">Error loading quotations</p>
            <p>{quotationFetchError}</p>
          </div>
        )}
      </div>

      {/* Hidden Camera Elements */}
      <video ref={videoRef} className="hidden" autoPlay playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
