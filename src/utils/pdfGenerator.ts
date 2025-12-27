import jsPDF from "jspdf";

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
    if (!u.hostname.includes("drive.google.com")) return "";
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

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
};

const dataUrlToBase64Payload = (
  dataUrl: string
): { mimeType: string; base64: string } | null => {
  const match = (dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const reencodeImageDataUrl = async (params: {
  dataUrl: string;
  maxDimension: number;
  quality: number;
}): Promise<{ dataUrl: string; format: "JPEG" } | null> => {
  const img = new Image();
  img.decoding = "async";
  img.src = params.dataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () =>
      reject(new Error("Failed to load image for re-encoding"));
  });

  const srcW = Math.max(1, img.naturalWidth || img.width || 1);
  const srcH = Math.max(1, img.naturalHeight || img.height || 1);
  const maxDim = Math.max(1, params.maxDimension);
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(img, 0, 0, outW, outH);

  const jpegDataUrl = canvas.toDataURL(
    "image/jpeg",
    Math.min(1, Math.max(0.1, params.quality))
  );

  return { dataUrl: jpegDataUrl, format: "JPEG" };
};

const encodeSameOriginPath = (path: string) => {
  if (!path) return path;
  const hasLeadingSlash = path.startsWith("/");
  const parts = path.split("/").filter((p) => p.length > 0);
  const encoded = parts.map((p) => encodeURIComponent(p)).join("/");
  return hasLeadingSlash ? `/${encoded}` : encoded;
};

export async function uploadPdfBlobToDrive(params: {
  scriptUrl: string;
  folderId: string;
  fileName: string;
  pdfBlob: Blob;
}): Promise<{ fileUrl: string }> {
  const base64DataUrl = await blobToDataUrl(params.pdfBlob);
  const parsed = dataUrlToBase64Payload(base64DataUrl);
  if (!parsed?.base64) {
    throw new Error("Failed to encode PDF");
  }

  const body = new URLSearchParams();
  body.append("action", "uploadFile");
  body.append("base64Data", parsed.base64);
  body.append("fileName", params.fileName);
  body.append("mimeType", parsed.mimeType || "application/pdf");
  body.append("folderId", params.folderId);

  const res = await fetch(params.scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json?.fileUrl) {
    throw new Error(json?.error || "Failed to upload PDF");
  }

  return { fileUrl: String(json.fileUrl) };
}

const inferFormatFromUrl = (url: string): "PNG" | "JPEG" => {
  const lower = (url || "").toLowerCase();
  if (lower.endsWith(".png")) return "PNG";
  return "JPEG";
};

const tryFetchImageForPdf = async (
  url: string
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> => {
  const original = (url || "").trim();
  if (!original) return null;
  if (original.startsWith("data:image/png")) {
    return { dataUrl: original, format: "PNG" };
  }
  if (original.startsWith("data:image/")) {
    return { dataUrl: original, format: "JPEG" };
  }

  const normalized = normalizeImageUrl(original);
  const driveId = getDriveFileId(original);
  const candidates = [normalized].filter(Boolean);
  if (driveId) {
    candidates.push(
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`,
      `https://drive.google.com/uc?export=download&id=${driveId}`
    );
  }

  for (const candidate of candidates) {
    try {
      const isSameOriginPath =
        candidate.startsWith("/") && !candidate.startsWith("//");
      const fetchUrl = isSameOriginPath
        ? encodeSameOriginPath(candidate)
        : `/api/image-proxy?url=${encodeURIComponent(candidate)}`;

      const res = await fetch(fetchUrl);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob || blob.size === 0) continue;

      const type = (blob.type || "").toLowerCase();
      const isImage = type.startsWith("image/") || type === "";
      if (!isImage) continue;

      const dataUrl = await blobToDataUrl(blob);
      const lowerDataUrl = dataUrl.toLowerCase();

      const baseFormat: "PNG" | "JPEG" = lowerDataUrl.startsWith(
        "data:image/png"
      )
        ? "PNG"
        : lowerDataUrl.startsWith("data:image/jpeg") ||
          lowerDataUrl.startsWith("data:image/jpg")
          ? "JPEG"
          : type.includes("png")
            ? "PNG"
            : type.includes("jpeg") || type.includes("jpg")
              ? "JPEG"
              : inferFormatFromUrl(candidate);

      const shouldReencode =
        blob.size > 250_000 || baseFormat === "PNG" || !type || type === "";

      if (shouldReencode) {
        try {
          const reencoded = await reencodeImageDataUrl({
            dataUrl,
            maxDimension: 1000,
            quality: 0.72,
          });
          if (reencoded) return reencoded;
        } catch {
          // fall back to original
        }
      }

      return { dataUrl, format: baseFormat };
    } catch {
      // try next candidate
    }
  }

  return null;
};

// ===== Interfaces =====
export interface Quotation {
  id: string;
  customerId: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  createdAt: string;
  status: string;
  quoteNumber?: string;
  expirationDate?: string;
  preparedBy?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  employeeCode?: string;
  architectCode?: string;
  architectName?: string;
  architectNumber?: string;
}

export interface QuotationItem {
  productId: string;
  quantity: number;
  price: number;
  discount: number;
  customTitle?: string;
  customPhoto?: string;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone: string;
  email?: string;
}

export interface Product {
  id: string;
  title: string;
}

// ===== Public API =====
export async function generateQuotationPDF(
  quotation: Quotation,
  customer: Customer | undefined,
  products: Product[] | undefined
) {
  const blob = await generatePDFBlob(quotation, customer, products);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quotation-${quotation.quoteNumber || quotation.id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function generateAndUploadQuotationPDF(params: {
  quotation: Quotation;
  customer: Customer | undefined;
  products: Product[] | undefined;
  scriptUrl: string;
  folderId: string;
}): Promise<{ fileUrl: string; pdfBlob: Blob; fileName: string }> {
  const pdfBlob = await generatePDFBlob(
    params.quotation,
    params.customer,
    params.products
  );
  const fileName = `quotation-${params.quotation.quoteNumber || params.quotation.id
    }.pdf`;

  const { fileUrl } = await uploadPdfBlobToDrive({
    scriptUrl: params.scriptUrl,
    folderId: params.folderId,
    fileName,
    pdfBlob,
  });

  return { fileUrl, pdfBlob, fileName };
}

// ===== PDF Generator =====
export function generatePDFBlob(
  quotation: Quotation,
  customer: Customer | undefined,
  products: Product[] | undefined
): Promise<Blob> {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 20;

    (async () => {
      try {
        // ---- Background Header Section - Light Beige ----
        doc.setFillColor(240, 235, 230);
        doc.rect(0, 0, pageWidth, 60, "F");

        // ---- Header Section ----
        // Company Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(48);
        doc.setTextColor(80, 80, 80);
        doc.text("ELEM", margin, y + 5);

        // LOGO Image (right side)
        const logoUrl = "/ELEM updated logo (with BG).png";

        const logoImg = await tryFetchImageForPdf(logoUrl);
        if (logoImg) {
          // Adjust width/height (w=50, h=25) and position as needed
          doc.addImage(
            logoImg.dataUrl,
            logoImg.format,
            pageWidth - margin - 50,
            y - 5,
            50,
            25
          );
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(36);
          doc.setTextColor(80, 80, 80);
          doc.text("LOGO", pageWidth - margin - 25, y + 12);
        }

        y += 22;

        // QUOTATION
        doc.setFont("helvetica", "normal");
        doc.setFontSize(24);
        doc.setTextColor(120, 120, 120);
        doc.text("CRAFTED FOR ELEGANCE", margin, y);

        y = 70;

        // ---- BILL TO Section with Light Beige Background ----
        doc.setFillColor(240, 235, 230);
        doc.rect(margin - 5, y - 8, pageWidth - 2 * margin + 10, 38, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text("BILL TO:", margin, y);

        y += 8;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);

        if (customer) {
          doc.text(`Name :- ${customer.name}`, margin, y);
          y += 7;
          doc.text(`Phone No.:- ${customer.phone}`, margin, y);
          y += 7;
          if (customer.email) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Email :- ${customer.email}`, margin, y);
            y += 7;
          }
          const addressParts = [];
          if (customer.addressLine1) addressParts.push(customer.addressLine1);
          if (customer.city) addressParts.push(customer.city);
          if (customer.state) addressParts.push(customer.state);
          if (customer.zip) addressParts.push(customer.zip);

          if (addressParts.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Address:- ${addressParts.join(", ")}`, margin, y);
          }
        } else {
          doc.text("Name :- Pratap Verma", margin, y);
          y += 7;
          doc.text("Phone No.:- 7000041821", margin, y);
          y += 7;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text("Email :- hello@reallygreatsite.com", margin, y);
          y += 7;
          doc.text("Address:- 123 Anywhere St., Any City, ST 12345", margin, y);
        }

        // Date and Invoice NO on right side of background
        const rightX = pageWidth - margin - 60;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);

        const quoteDate = quotation.createdAt
          ? new Date(quotation.createdAt).toLocaleDateString("en-GB")
          : "15/08/2028";
        doc.text(`Date: ${quoteDate}`, rightX, 78);
        doc.text(
          `Invoice NO. ${quotation.quoteNumber || "2000-15"}`,
          rightX,
          88
        );

        y = 110;

        // ---- FROM Section ----
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text("FROM:", margin, y);

        y += 8;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);

        y += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);

        doc.text("Fruit Market, Ahead Lalpur, beside Bharat Petroleum,", margin, y);
        y += 5;
        doc.text("Pachpedi Naka, Raipur, Chhattisgarh 492015", margin, y);

        y = 140;

        // ---- Items Table Header with Light Beige Background ----
        doc.setFillColor(240, 235, 230);
        doc.rect(margin - 5, y - 7, pageWidth - 2 * margin + 10, 10, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);

        const colImage = margin;
        const colDescription = margin + 20;
        const colQty = pageWidth - margin - 65;
        const colPrice = pageWidth - margin - 40;
        const colTotal = pageWidth - margin - 10;

        doc.text("(WITH IMAGE)DESCRIPTION", colDescription, y);
        doc.text("QTY", colQty, y);
        doc.text("PRICE", colPrice, y);
        doc.text("TOTAL", colTotal, y);

        y += 12;

        // Map actual items or use sample data
        const itemsToDisplay =
          quotation.items.length > 0
            ? quotation.items.map((item, index) => {
              const product = products?.find((p) => p.id === item.productId);
              const itemTotal = item.quantity * item.price - item.discount;
              return {
                description:
                  item.customTitle || product?.title || `Item ${index + 1}`,
                qty: item.quantity,
                price: item.price,
                total: itemTotal,
                imageUrl: item.customPhoto || "",
              };
            })
            : [
              {
                description: "Graphic design consultation",
                qty: 2,
                price: 100.0,
                total: 200.0,
                imageUrl: "",
              },
              {
                description: "Logo design",
                qty: 1,
                price: 700.0,
                total: 700.0,
                imageUrl: "",
              },
              {
                description: "Social media templates",
                qty: 1,
                price: 600.0,
                total: 600.0,
                imageUrl: "",
              },
              {
                description: "Revision",
                qty: 2,
                price: 300.0,
                total: 600.0,
                imageUrl: "",
              },
            ];

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);

        for (let index = 0; index < itemsToDisplay.length; index++) {
          const item = itemsToDisplay[index];

          // Page break if needed
          if (y > pageHeight - 45) {
            doc.addPage();
            y = 20;
          }

          // Image placeholder box
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(colImage, y - 5, 14, 12, "S");

          // Try to embed image (best-effort)
          if (item.imageUrl) {
            const img = await tryFetchImageForPdf(item.imageUrl);
            if (img) {
              try {
                doc.addImage(
                  img.dataUrl,
                  img.format,
                  colImage + 1,
                  y - 4,
                  12,
                  10
                );
              } catch {
                // ignore image add failures
              }
            }
          }

          // Item details
          doc.text(item.description, colDescription, y);
          doc.text(item.qty.toString(), colQty + 3, y);
          doc.text(Number(item.price).toFixed(2), colPrice - 2, y);
          doc.text(Number(item.total).toFixed(2), colTotal - 10, y);

          y += 10;

          if (index < itemsToDisplay.length - 1) {
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.line(margin, y - 2, pageWidth - margin, y - 2);
            y += 2;
          }
        }

        // Check if there is enough space for Total + Terms + Footer margin
        // Total (~10mm) + Spacing (20mm) + Title (10mm) + 4 terms * 6mm (~24mm) + buffer
        if (y > pageHeight - 100) {
          doc.addPage();
          y = 20;
        }

        y += 10;

        // ---- Total Amount with Light Beige Background ----
        doc.setFillColor(240, 235, 230);
        doc.rect(margin - 5, y - 6, pageWidth - 2 * margin + 10, 10, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text("Total amount", colTotal - 50, y);
        doc.text(Number(quotation.total).toFixed(2), colTotal - 10, y);

        y += 10;

        // ---- Terms & Conditions ----
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text("TERMS & CONDITION", margin, y);

        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        const terms = [
          "GST WILL BE ADDITIONAL",
          "TRANSPORTATION & PACKING CHARGES WILL BE ADDITIONAL AS PER ACTUALS",
          "ONCE ORDER PLACED WILL NOT BE CANCELLED",
          "GOODS WILL NOT BE RETURNED ONCE DELIVERED",
        ];

        terms.forEach((term) => {
          doc.text("• " + term, margin + 2, y);
          y += 6;
        });

        y += 4;

        // Check space for Payment & Bank Details (approx 40mm needed)
        if (y > pageHeight - 60) {
          doc.addPage();
          y = 20;
        }

        // ---- Payment & Bank Details ----
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);

        doc.text("PAYMENT TERMS :", margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(
          " 50% AT THE TIME OF BOOKING AND BALANCE AGAINST DELIVERY",
          margin + 32,
          y
        );

        y += 8;

        doc.setFont("helvetica", "bold");
        doc.text("BANK DETAILS :", margin, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.text("HDFC BANK", margin + 5, y);
        y += 5;
        doc.text("AC NAME : VP ENTERPRISES", margin + 5, y);
        y += 5;
        doc.text("AC NO : 50200087610168", margin + 5, y);
        y += 5;
        doc.text(
          "IFSC : HDFC0001280 , PACHPEDINAKA BRANCH RAIPUR",
          margin + 5,
          y
        );

        // ---- Architect Details (Right side, aligned with FROM) ----
        if (quotation.architectName || quotation.architectCode) {
          let arcY = 110; // Aligned with FROM
          const rightX = pageWidth - margin - 60;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(50, 50, 50);
          doc.text("ARCHITECT:", rightX, arcY);

          arcY += 6;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);

          if (quotation.architectName) {
            doc.text(quotation.architectName, rightX, arcY);
            arcY += 5;
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);

          if (quotation.architectCode) {
            doc.text(`Code: ${quotation.architectCode}`, rightX, arcY);
            arcY += 5;
          }
          if (quotation.architectNumber) {
            doc.text(`Ph: ${quotation.architectNumber}`, rightX, arcY);
          }
        }

        // ---- Footer Section - Light Beige ----
        doc.setFillColor(240, 235, 230);
        doc.rect(0, pageHeight - 25, pageWidth, 25, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(22);
        doc.setTextColor(120, 120, 120);
        doc.text("Thank you!", pageWidth / 2, pageHeight - 13, {
          align: "center",
        });

        // Employee Code in Footer (Left)
        if (quotation.employeeCode) {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text(`Emp Code: ${quotation.employeeCode}`, margin, pageHeight - 10);
        }

        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text("Powered By Botivate", pageWidth / 2, pageHeight - 6, {
          align: "center",
        });

        // ---- Output ----
        const pdfBlob = doc.output("blob");
        resolve(pdfBlob);
      } catch {
        const pdfBlob = doc.output("blob");
        resolve(pdfBlob);
      }
    })();
  });
}
