"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { useEmployee } from "@/src/contexts/EmployeeContext";
import { useAdmin } from "@/src/contexts/AdminContext";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Quotation, QuotationItem } from "@/src/types/index";
import Image from "next/image";
import { Camera, Upload, Trash2, Plus, X, Check, AlertCircle } from "lucide-react"; // Assuming lucide-react for icons; install if needed

export default function CreateQuotationPage() {
  const { createQuotation } = useEmployee();
  const { products, customers } = useAdmin(); // Fixed: Fetch customers from useAdmin for consistency
  const { user } = useAuth();

  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxVMOglX1D5V_Vbno5gx1E1Zw0jd2YjWQqDbdRpQA-l2Z_UzLaaTZxHyPu0ZLKQVxBu/exec";
  const DRIVE_FOLDER_ID = "1OjDF5Jr2O5KtRTmxRcSa-ApFuFtyCOxe";
  const QUOTATION_SHEET_NAME = "Quotation";
  const QUOTATION_LOG_SHEET_NAME = "Quotation";
  const INVENTORY_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr8QBIGE3jlMqm3w4r3f-jvRKTJdUKP0Tc4jDITpadSJqQbL8JOC_E6TLXr0xxBJKknA/exec";
  const INVENTORY_SPREADSHEET_ID = "1rKr7wOCQdDRunIvSdBFnGVy1VQGgQvcwXeFqVD9wuFM";
  const INVENTORY_SHEET_NAME = "Inventory";

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [tax, setTax] = useState(0);
  const [showCamera, setShowCamera] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // New Fields State
  const [employeeCode, setEmployeeCode] = useState("");
  const [architectCode, setArchitectCode] = useState("");
  const [architectName, setArchitectName] = useState("");
  const [architectNumber, setArchitectNumber] = useState("");
  const [showArchitectFields, setShowArchitectFields] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000); // Auto remove after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch Inventory on Mount
  useEffect(() => {
    const fetchInventory = async () => {
      setLoadingInventory(true);
      try {
        const url = `${INVENTORY_SCRIPT_URL}?spreadsheetId=${INVENTORY_SPREADSHEET_ID}&sheet=${INVENTORY_SHEET_NAME}`;
        console.log("Fetching Inventory:", url);
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Assume Row 1 is header (1-based in sheet, 0-based in array? usually API returns 2D array including header)
          const rows = json.data.slice(1);
          if (rows.length > 0) {
            console.log("Sample Inventory Row 0:", rows[0]);
          }
          const products = rows.map((r: any[]) => {
            const rawPrice = r[9]; // Col J (Amount) is index 9
            const parsedPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || "0").replace(/[^0-9.-]+/g, ""));
            return {
              code: String(r[4] || "").trim(), // Col E (Index 4)
              name: String(r[3] || "").trim(), // Col D (Index 3)
              price: isNaN(parsedPrice) ? 0 : parsedPrice, // Col J (Index 9)
              image: String(r[2] || "").trim(), // Col C (Index 2)
            };
          }).filter((p: any) => p.code);

          if (products.length > 0) {
            console.log("Sample Parsed Product:", products[0]);
          }
          setInventory(products);
          console.log("Inventory Loaded:", products.length, "items");
        }
      } catch (e) {
        console.error("Failed to fetch inventory:", e);
      } finally {
        setLoadingInventory(false);
      }
    };
    fetchInventory();
  }, []);

  const handleProductCodeSearch = (itemId: string, code: string) => {
    // console.log(`🔍 Search triggered! Code: "${code}"`);
    if (!code) return;
    const searchCode = code.trim().toLowerCase();
    console.log("Searching for code:", searchCode);
    console.log("Inventory size:", inventory.length);
    console.log("Current Inventory (first 3):", inventory.slice(0, 3));

    if (inventory.length === 0) {
      setToast({ message: "⚠️ Inventory not loaded yet! Please wait.", type: "warning" });
      return;
    }

    const match = inventory.find((p) => p.code.toLowerCase() === searchCode);
    console.log("Match found:", match);

    if (match) {
      console.log("Updating item with:", match);
      // alert(`✅ Found: ${match.name}\nPrice: ₹${match.price}\nImage: ${match.image ? 'Yes' : 'No'}`);
      updateItem(itemId, {
        customTitle: match.name,
        price: Number(match.price),
        customPhoto: match.image || undefined
      });
      setToast({ message: `✅ Found: ${match.name}`, type: "success" });
    } else {
      setToast({ message: "❌ Product code not found in inventory.", type: "error" });
    }
  };

  const parseDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
      return null;
    }
    return { mimeType: match[1], base64Data: match[2] };
  };

  const getDisplayableImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;

    try {
      // 1. Match /file/d/ID
      const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (directMatch && directMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w400`;
      }

      // 2. Match ?id=ID or &id=ID
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucMatch && ucMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w400`;
      }

      // 3. Match open?id=ID
      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
      if (openMatch && openMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w400`;
      }

      // 4. Already a thumbnail link
      if (url.includes("thumbnail?id=")) {
        return url;
      }

      // 5. Fallback: match any long ID-like string
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

  const appendQuotationLogRow = async (rowData: any[]) => {
    console.log("=== APPEND QUOTATION LOG ROW STARTED ===");
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

    console.log("📡 Quotation insert response:", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    });

    const responseText = await res.text();
    console.log("📄 Raw quotation insert response:", responseText);

    let json: any = null;
    try {
      json = JSON.parse(responseText);
      console.log("📋 Parsed quotation insert response:", json);
    } catch {
      // Apps Script sometimes returns HTML (e.g. auth / deployment errors)
      throw new Error(
        `Quotation insert returned non-JSON response (HTTP ${res.status
        }). Check Apps Script deployment/access. Raw: ${responseText.slice(
          0,
          200
        )}`
      );
    }

    if (!json?.success) {
      throw new Error(json?.error || "Failed to insert quotation log row");
    }

    console.log("✅ APPEND QUOTATION LOG ROW FINISHED");
  };

  const uploadImageToDrive = async (dataUrl: string, fileName: string) => {
    console.log("=== UPLOAD IMAGE TO DRIVE STARTED ===");
    console.log("uploadImageToDrive called with:", {
      dataUrl: dataUrl.substring(0, 100) + "...",
      fileName,
      dataUrlLength: dataUrl.length,
    });

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      console.error("❌ Failed to parse data URL");
      throw new Error("Invalid image data");
    }

    console.log("✅ Parsed data URL successfully:", {
      mimeType: parsed.mimeType,
      base64Length: parsed.base64Data.length,
    });

    const params = new URLSearchParams();
    params.append("action", "uploadFile");
    params.append("base64Data", parsed.base64Data);
    params.append("fileName", fileName);
    params.append("mimeType", parsed.mimeType);
    params.append("folderId", DRIVE_FOLDER_ID);

    console.log("📤 Request params constructed:", {
      action: "uploadFile",
      fileName,
      mimeType: parsed.mimeType,
      folderId: DRIVE_FOLDER_ID,
      base64DataLength: parsed.base64Data.length,
    });

    try {
      console.log("🌐 Sending request to:", SCRIPT_URL);
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      console.log("📡 Response received:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      const responseText = await res.text();
      console.log("📄 Raw response:", responseText);

      const json = JSON.parse(responseText);
      console.log("📋 Parsed response:", json);

      if (!json?.success || !json?.fileUrl) {
        console.error("❌ Upload failed:", json);
        throw new Error(json?.error || "Image upload failed");
      }

      console.log("✅ Upload successful! File URL:", json.fileUrl);
      return String(json.fileUrl);
    } catch (err) {
      console.error("❌ Upload error:", err);
      throw err;
    }
  };

  const getCustomerRowIndexInSheet = async (customerId: string) => {
    console.log("=== GET CUSTOMER ROW INDEX STARTED ===", { customerId });
    const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(
      QUOTATION_SHEET_NAME
    )}`;

    const res = await fetch(url);
    const json = await res.json().catch(() => null);
    console.log("📋 Sheet fetch response:", json);

    if (!json?.success || !Array.isArray(json?.data)) {
      throw new Error(json?.error || "Failed to fetch sheet data");
    }

    // Sheet rows are 1-indexed. Row 1 is header.
    // Customer ID is expected in column B (index 1).
    const rows: any[][] = json.data;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowCustomerId = row?.[1]?.toString()?.trim();
      if (rowCustomerId && rowCustomerId === customerId) {
        const rowIndex = i + 1;
        console.log("✅ Found customer row:", { rowIndex, rowCustomerId });
        return rowIndex;
      }
    }

    console.error("❌ Customer ID not found in sheet:", customerId);
    return null;
  };

  const updateCells = async (
    rowIndex: number,
    startColumnIndex: number,
    values: any[]
  ) => {
    console.log("=== UPDATE CELLS STARTED ===", {
      rowIndex,
      startColumnIndex,
      values,
    });

    for (let i = 0; i < values.length; i++) {
      const columnIndex = startColumnIndex + i;
      const value = values[i];

      const params = new URLSearchParams();
      params.append("action", "updateCell");
      params.append("sheetName", QUOTATION_SHEET_NAME);
      params.append("rowIndex", String(rowIndex));
      params.append("columnIndex", String(columnIndex));
      params.append("value", value == null ? "" : String(value));

      console.log("📤 Updating cell:", { rowIndex, columnIndex, value });

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const responseText = await res.text();
      console.log("📄 Raw updateCell response:", responseText);
      const json = JSON.parse(responseText);
      if (!json?.success) {
        throw new Error(
          json?.error || `Failed to update cell R${rowIndex}C${columnIndex}`
        );
      }
    }

    console.log("✅ UPDATE CELLS FINISHED");
  };

  const appendQuotationRowStartingAtG = async (valuesFromG: any[]) => {
    console.log("=== APPEND QUOTATION ROW STARTED ===");
    // Pad A–F with empty values so that our data begins at Column G
    const rowData = ["", "", "", "", "", "", ...valuesFromG];

    console.log("📊 Row data prepared:", {
      totalColumns: rowData.length,
      dataFromColumnG: valuesFromG,
      fullRowData: rowData,
    });

    const params = new URLSearchParams();
    params.append("action", "insert");
    params.append("sheetName", QUOTATION_SHEET_NAME);
    params.append("rowData", JSON.stringify(rowData));

    console.log("📤 Request params for sheet insert:", {
      action: "insert",
      sheetName: QUOTATION_SHEET_NAME,
      rowDataLength: rowData.length,
      rowDataPreview: rowData.slice(0, 3).concat(["..."]),
    });

    try {
      console.log("🌐 Sending sheet insert request to:", SCRIPT_URL);
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      console.log("📡 Sheet insert response received:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      const responseText = await res.text();
      console.log("📄 Raw sheet response:", responseText);

      const json = JSON.parse(responseText);
      console.log("📋 Parsed sheet response:", json);

      if (!json?.success) {
        console.error("❌ Sheet insert failed:", json);
        throw new Error(json?.error || "Failed to insert quotation row");
      }

      console.log("✅ Sheet insert successful!");
    } catch (err) {
      console.error("❌ Sheet insert error:", err);
      throw err;
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
    setShowCamera(productId);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const capturePhoto = (productId: string) => {
    if (videoRef.current && canvasRef.current) {
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
    }
  };

  const closeCamera = () => {
    setShowCamera(null);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const handleFileUpload = (
    productId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        updateItem(productId, { customPhoto: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity - item.discount,
    0
  );
  const taxAmount = Math.round((subtotal * tax) / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async () => {
    console.log("=== HANDLE SUBMIT STARTED ===");
    console.log("📋 Form data:", {
      selectedCustomer,
      itemsCount: items.length,
      items: items.map((i) => ({
        productId: i.productId,
        hasCustomPhoto: !!i.customPhoto,
        customPhotoLength: i.customPhoto?.length,
        quantity: i.quantity,
        price: i.price,
      })),
    });

    if (!selectedCustomer || items.length === 0) {
      console.error("❌ Validation failed: missing customer or items");
      alert("Please select a customer and add items");
      return;
    }

    if (saving) {
      console.log("⏸️ Already saving, skipping...");
      return;
    }
    setSaving(true);
    setLoadingMessage("Initializing...");

    try {
      // Generate Serial Number
      setLoadingMessage("Generating serial number...");
      const generateSerialNo = async (): Promise<string> => {
        try {
          const SPREADSHEET_ID = "11G2LjQ4k-44_vnbgb1LREfrOqbr2RQ7HJ3ANw8d3clc";
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
        customerId: selectedCustomer,
        employeeId: user?.id || "emp-1",
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

      console.log("📄 Quotation object created:", {
        id: quotation.id,
        customerId: quotation.customerId,
        total: quotation.total,
        itemsCount: quotation.items.length,
        serialNo: quotation.serialNo,
      });

      console.log("🔄 Starting to process items...");
      const rowIndex = await getCustomerRowIndexInSheet(selectedCustomer);
      if (!rowIndex) {
        alert(
          "Customer ID not found in sheet. Please ensure the customer exists in Google Sheet."
        );
        return;
      }

      const START_COLUMN_G = 7;

      const productNames: string[] = [];
      const productImages: string[] = [];
      const qtyList: string[] = [];
      const priceList: string[] = [];
      const discountList: string[] = [];
      const subtotalList: string[] = [];

      for (let index = 0; index < items.length; index++) {
        setLoadingMessage(`Processing item ${index + 1} of ${items.length}...`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        console.log(`\n📦 Processing item ${index + 1}/${items.length}...`);
        const item = items[index];
        const product = products.find((p) => p.id === item.productId);

        const productName =
          (product?.title || item.customTitle || "").toString().trim() ||
          `Item ${index + 1}`;
        const itemSubtotal = item.quantity * item.price - (item.discount || 0);

        let productImageUrl = "";
        if (item.customPhoto) {
          if (item.customPhoto.startsWith("data:")) {
            setLoadingMessage(`Uploading image for item ${index + 1}...`);
            console.log("📸 Uploading image for item:", item.productId);
            try {
              productImageUrl = await uploadImageToDrive(
                item.customPhoto,
                `${quotation.id}-${index + 1}.jpg`
              );
              console.log("✅ Uploaded image URL:", productImageUrl);
            } catch (uploadErr: any) {
              console.error(
                "❌ Upload failed for item:",
                item.productId,
                uploadErr
              );
              alert(`Failed to upload image for item ${index + 1}. Proceeding without it.`);
            }
          } else {
            productImageUrl = item.customPhoto;
            console.log("Using existing image URL:", productImageUrl);
          }
        }

        productNames.push(productName);
        productImages.push(productImageUrl);
        qtyList.push(String(item.quantity));
        priceList.push(String(item.price));
        discountList.push(String(item.discount || 0));
        subtotalList.push(String(itemSubtotal));
      }

      const valuesFromG = [
        productNames.join("\n"),
        productImages.join("\n"),
        qtyList.join("\n"),
        priceList.join("\n"),
        discountList.join("\n"),
        subtotalList.join("\n"),
        tax,
      ];

      setLoadingMessage("Updating Google Sheet...");
      await updateCells(rowIndex, START_COLUMN_G, valuesFromG);
      console.log("✅ Updated customer row with concatenated item values:", {
        rowIndex,
      });

      const customer = customers.find((c) => c.id === selectedCustomer);
      const timestamp = new Date().toISOString();
      
      // Include Serial No at index 14 (Column O)
      const logRow = [
        timestamp,                    // 0: Timestamp
        selectedCustomer,             // 1: Customer ID
        customer?.name || "",         // 2: Customer Name
        customer?.phone || "",        // 3: Phone
        customer?.whatsapp || "",     // 4: WhatsApp
        customer?.email || "",        // 5: Email
        valuesFromG[0],               // 6: Product Name
        valuesFromG[1],               // 7: Product Image
        valuesFromG[2],               // 8: Qty
        valuesFromG[3],               // 9: Price
        valuesFromG[4],               // 10: Discount
        valuesFromG[5],               // 11: Subtotal
        valuesFromG[6],               // 12: Tax%
        "",                           // 13: Quotation Link (filled later)
        serialNo,                     // 14: Serial No (Column O)
        employeeCode || "",           // 15: Employee Code (Column P)
        architectCode || "",          // 16: Architect Code (Column Q)
        architectName || "",          // 17: Architect Name (Column R)
        architectNumber || "",        // 18: Architect Number (Column S)
      ];

      setLoadingMessage("Logging quotation...");
      await appendQuotationLogRow(logRow);
      console.log("✅ Appended quotation log row with Serial No:", serialNo);

      console.log("🎉 All items processed, creating quotation...");
      createQuotation(quotation);
      alert(`Quotation ${serialNo} created successfully!`);
      setItems([]);
      setSelectedCustomer("");
    } catch (err: any) {
      console.error("❌ Save failed:", err);
      if (
        !err.message ||
        (!err.message.includes("Failed to upload") &&
          !err.message.includes("Failed to save"))
      ) {
        alert("Failed to save quotation to Google Sheet");
      }
    } finally {
      console.log("🏁 Handle submit finished");
      setSaving(false);
      setLoadingMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 lg:p-8 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-bounce-in
          ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
            'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
          {toast.type === 'error' && <X className="w-5 h-5 text-red-600" />}
          {toast.type === 'success' && <Check className="w-5 h-5 text-green-600" />} 
          {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Create Quotation
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Custom Item Management */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Select Customer
              </h2>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
              >
                <option value="">Choose a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* Employee & Architect Details */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg space-y-4">
              <h2 className="text-xl font-semibold mb-2 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Additional Details
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Enter Employee Code"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/50"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchitectFields(!showArchitectFields)}
                  className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:underline"
                >
                  {showArchitectFields ? "- Hide Architect Details" : "+ Add Architect Details"}
                </button>
              </div>

              {showArchitectFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Architect Code</label>
                    <input
                      type="text"
                      value={architectCode}
                      onChange={(e) => setArchitectCode(e.target.value)}
                      placeholder="e.g. ARC-001"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Architect Name</label>
                    <input
                      type="text"
                      value={architectName}
                      onChange={(e) => setArchitectName(e.target.value)}
                      placeholder="Architect Name"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Architect Number</label>
                    <input
                      type="text"
                      value={architectNumber}
                      onChange={(e) => setArchitectNumber(e.target.value)}
                      placeholder="Contact Number"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={addCustomItem}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Item
            </button>

            {/* Selected Items */}
            {items.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Selected Items ({items.length})
                </h2>
                <div className="space-y-4">
                  {items.map((item) => {
                    const product = products.find(
                      (p) => p.id === item.productId
                    );
                    return (
                      <div
                        key={item.productId}
                        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 mr-2">
                            {product ? (
                              <h3 className="font-semibold text-gray-800 text-lg">
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
                                placeholder="Enter item title"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 bg-white font-semibold text-gray-800"
                              />
                            )}


                            {/* Product Code Search */}
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                placeholder="Search Product Code (e.g. 123S)"
                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                                onKeyDown={(e) => {
                                  console.log("Key pressed:", e.key);
                                  if (e.key === 'Enter') {
                                    console.log("Enter key detected!");
                                    const value = (e.target as HTMLInputElement).value;
                                    console.log("Input value:", value);
                                    handleProductCodeSearch(item.productId, value);
                                  }
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  console.log("Search button clicked!");
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  console.log("Input element:", input);
                                  console.log("Input value:", input.value);
                                  handleProductCodeSearch(item.productId, input.value);
                                }}
                                className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black transition-colors"
                              >
                                Search
                              </button>
                            </div>

                            <p className="text-sm text-gray-500 mt-1">
                              ₹{item.price.toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-red-500 hover:text-red-700 transition-colors duration-200 p-2 rounded-lg hover:bg-red-50"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Camera Modal */}
                        {showCamera === item.productId && (
                          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                            <div className="bg-white p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl">
                              <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-blue-500" />
                                Take Photo
                              </h3>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-64 object-cover rounded-xl mb-4 bg-gray-200"
                              />
                              <canvas ref={canvasRef} className="hidden" />
                              <div className="flex gap-3 justify-center">
                                <button
                                  onClick={() => capturePhoto(item.productId)}
                                  className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-all duration-200 font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
                                >
                                  <Camera className="w-4 h-4" />
                                  Capture
                                </button>
                                <button
                                  onClick={closeCamera}
                                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-400 transition-all duration-200 font-semibold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-5 pb-5 border-b border-gray-100">
                          <label className="text-xs text-gray-500 block mb-3 font-medium">
                            Custom Photo (Visible to Customer)
                          </label>
                          <div className="flex gap-4 items-start">
                            {item.customPhoto ? (
                              <div className="relative w-16 h-16 bg-gray-100 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
                                {(() => {
                                  const original = item.customPhoto || "";
                                  if (!original) return null;

                                  if (original.startsWith("data:image/") || original.startsWith("blob:")) {
                                    return (
                                      <img
                                        src={original}
                                        alt="Custom photo"
                                        className="w-full h-full object-cover"
                                      />
                                    );
                                  }

                                  const displayUrl = getDisplayableImageUrl(original) || original;

                                  return (
                                    <img
                                      src={displayUrl}
                                      alt="Custom photo"
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                      loading="lazy"
                                      onError={(e) => {
                                        // If thumbnail fails and it's different from original, try original
                                        if (displayUrl !== original && (e.target as HTMLImageElement).src !== original) {
                                          (e.target as HTMLImageElement).src = original;
                                        }
                                      }}
                                    />
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="w-16 h-16 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                                No photo
                              </div>
                            )}
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openCamera(item.productId)}
                                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all duration-200 text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md"
                                >
                                  <Camera className="w-4 h-4" />
                                  Take Photo
                                </button>
                                <label className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium cursor-pointer flex items-center gap-2 shadow-sm hover:shadow-md">
                                  <Upload className="w-4 h-4" />
                                  Upload Photo
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
                                  className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors duration-200 flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Remove Photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 block mb-2 font-medium">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(item.productId, {
                                  quantity:
                                    Number.parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-2 font-medium">
                              Price (Editable Rate)
                            </label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) =>
                                updateItem(item.productId, {
                                  price: Number.parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-2 font-medium">
                              Discount
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.discount}
                              onChange={(e) =>
                                updateItem(item.productId, {
                                  discount:
                                    Number.parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 sticky top-8 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Summary
              </h2>

              <div className="space-y-4 mb-8 pb-8 border-b border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900 font-semibold">
                    ₹{subtotal.toLocaleString()}
                  </span>
                </div>

              </div>

              <div className="flex justify-between mb-8 text-lg">
                <span className="font-bold text-gray-800">Total</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  ₹{total.toLocaleString()}
                </span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className={`w-full ${saving
                    ? "bg-gray-500 cursor-wait animate-pulse"
                    : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:shadow-xl hover:-translate-y-0.5"
                    } text-white px-6 py-4 rounded-xl transition-all duration-200 font-semibold shadow-lg flex items-center justify-center gap-3`}
                >
                  {saving ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/80 border-t-white rounded-full animate-spin" />
                      <span className="text-lg font-bold">
                        {loadingMessage || "Saving Draft..."}
                      </span>
                    </>
                  ) : (
                    "Save as Draft"
                  )}
                </button>
                <button className="w-full bg-gray-100 text-gray-700 px-6 py-4 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
