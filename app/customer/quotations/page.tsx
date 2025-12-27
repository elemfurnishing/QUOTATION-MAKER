"use client"

import { useCustomer } from "@/src/contexts/CustomerContext"
import { useAdmin } from "@/src/contexts/AdminContext"
import { useState } from "react"
import Image from "next/image"

export default function CustomerQuotationsPage() {
  const { quotations, updateQuotationStatus } = useCustomer()
  const { products } = useAdmin()
  const [selectedQuotation, setSelectedQuotation] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const selectedQuot = quotations.find((q) => q.id === selectedQuotation)

  const handleApprove = (id: string) => {
    updateQuotationStatus(id, "approved")
    alert("Quotation approved! The seller will be notified.")
  }

  const handleReject = (id: string) => {
    updateQuotationStatus(id, "rejected")
    alert("Quotation rejected.")
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8 text-foreground">My Quotations</h1>

      {quotations.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">No quotations yet</p>
          <p className="text-sm text-muted-foreground">Contact the seller to request a quotation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quotations.map((quot) => (
            <div
              key={quot.id}
              className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Quotation ID</p>
                    <p className="font-mono text-sm text-foreground">{quot.id}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      quot.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : quot.status === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : quot.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {quot.status}
                  </span>
                </div>

                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-sm text-muted-foreground mb-1">Items</p>
                  <p className="text-lg font-semibold text-foreground">{quot.items.length} items</p>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-primary">₹{quot.total.toLocaleString()}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedQuotation(quot.id)
                      setShowModal(true)
                    }}
                    className="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium"
                  >
                    View Details
                  </button>
                  {quot.status === "sent" && (
                    <>
                      <button
                        onClick={() => handleApprove(quot.id)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(quot.id)}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedQuot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <h2 className="text-2xl font-bold text-foreground">Quotation Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Quotation ID</p>
                  <p className="font-mono text-foreground">{selectedQuot.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-foreground">{new Date(selectedQuot.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      selectedQuot.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : selectedQuot.status === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {selectedQuot.status}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Items</h3>
                <div className="space-y-4">
                  {selectedQuot.items.map((item) => {
                    const product = products.find((p) => p.id === item.productId)
                    return (
                      <div key={item.productId} className="border border-border rounded-lg p-4">
                        <div className="flex gap-4">
                          <div className="relative w-20 h-20 bg-muted rounded flex-shrink-0">
                            <Image
                              src={item.customPhoto || product?.images[0] || "/placeholder.svg"}
                              alt={product?.title || "Item"}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{product?.title}</h4>
                            <p className="text-sm text-muted-foreground mb-2">₹{item.price.toLocaleString()}</p>
                            <div className="flex gap-4 text-sm">
                              <span>Qty: {item.quantity}</span>
                              <span>Subtotal: ₹{(item.price * item.quantity - item.discount).toLocaleString()}</span>
                            </div>
                            {item.customPhoto && <p className="text-xs text-blue-600 mt-2">✓ Custom photo provided</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">₹{selectedQuot.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="text-foreground">₹{selectedQuot.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-foreground">-₹{selectedQuot.discount.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary text-lg">₹{selectedQuot.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedQuot.status === "sent" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleApprove(selectedQuot.id)
                      setShowModal(false)
                    }}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:opacity-90 transition font-semibold"
                  >
                    Approve Quotation
                  </button>
                  <button
                    onClick={() => {
                      handleReject(selectedQuot.id)
                      setShowModal(false)
                    }}
                    className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:opacity-90 transition font-semibold"
                  >
                    Reject Quotation
                  </button>
                </div>
              )}

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  Have questions? Contact the seller via WhatsApp or email for modifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
