import React, { useState } from "react"
import placeholder from "../../assets/placeholder.jpg"

const ViewProductsModal = ({ open, setOpen, data, suppliersList }) => {
  if (!open || !data) return null

  // Map Firestore product fields to UI fields
  const product = {
    ...data,
    product_name: data.product || data.product_name,
  }

  const supplier =
    suppliersList?.find((s) => s.id === product.supplier_id) || {}

  // Parse image field to array (support comma-separated string or array)
  const imageArr = product.image
    ? Array.isArray(product.image)
      ? product.image
      : typeof product.image === "string"
        ? product.image.split(",").map((i) => i.trim()).filter(Boolean)
        : []
    : []
  const images = imageArr.length > 0 ? imageArr : [placeholder]
  const [mainImage, setMainImage] = useState(images[0])

  const handleImageError = (e) => {
    e.target.onerror = null
    e.target.src = placeholder
  }

  // Custom segment grouping
  const segments = [
    {
      title: "Basic Information",
      fields: [
        { label: "Product Name", value: product.product_name },
        { label: "Barcode", value: product.barcode },
        { label: "Old Barcode", value: product.old_barcode },
        { label: "Bill Number", value: product.bill_number },
        { label: "Supplier", value: supplier.supplier_name || product.supplier_id },
        { label: "SKU", value: product.sku },
        { label: "Old SKU", value: product.old_sku },
      ],
    },
    {
      title: "Pricing & Quantity",
      fields: [
        { label: "Bill Amount", value: product.deal_amount && `BDT ${product.deal_amount}` },
        { label: "Paid Amount", value: product.paid_amount && `BDT ${product.paid_amount}` },
        { label: "Quantity", value: product.quantity },
        { label: "Original Quantity", value: product.original_qty },
        { label: "Retail Price", value: product.retail_price && `BDT ${product.retail_price}` },
        { label: "Unit Price", value: product.unit_price && `BDT ${product.unit_price}` },
        { label: "Total Price", value: product.total_price && `BDT ${product.total_price}` },
        { label: "Percentage", value: product.percentage && `${product.percentage}%` },
      ],
    },
    {
      title: "Design & Classification",
      fields: [
        { label: "Design", value: product.design },
        { label: "Category", value: product.product_category },
        { label: "Brand", value: product.brand },
        { label: "Color", value: product.color },
        { label: "Size", value: product.size },
        { label: "Style", value: product.style },
        { label: "Season", value: product.season },
        { label: "Supplier Type", value: product.murukhho },
        { label: "Is Labeled", value: product.is_labeled },
      ],
    },
    {
      title: "Dates & Origin",
      fields: [
        { label: "Manufacture Date", value: product.manufacture_date },
        { label: "Expiry Date", value: product.expiry_date },
        { label: "Origin", value: product.origin },
      ],
    },
    {
      title: "Audit Trail",
      fields: [
        { label: "Created At", value: product.created_at },
        { label: "Created By", value: product.created_by },
        { label: "Updated At", value: product.updated_at },
        { label: "Updated By", value: product.updated_by },
        { label: "Deleted At", value: product.deleted_at },
        { label: "Deleted By", value: product.deleted_by },
      ],
    },
    {
      title: "Additional Details",
      fields: [
        {
          label: "Description",
          value: product.description
            ? (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )
            : <i>No description</i>,
        },
      ],
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="relative flex min-w-[80vw] max-h-[80vh] m-5 shadow-lg rounded-lg bg-white overflow-hidden font-sans">
        {/* Close button */}
        <button
          className="absolute top-2 right-2 z-10 px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-gray-700"
          onClick={() => setOpen(false)}
        >
          X
        </button>
        {/* Left Side - Images */}
        <div className="flex flex-col items-center min-w-[450px] bg-gray-100 p-5 border-r border-gray-200">
          <img
            src={mainImage}
            alt="Product"
            onError={handleImageError}
            className="w-[300px] h-[300px] object-contain mb-4 rounded-lg shadow"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {images.map((thumb, i) => (
              <img
                key={i}
                src={thumb}
                alt={`Thumbnail ${i + 1}`}
                onClick={() => setMainImage(thumb)}
                onError={handleImageError}
                className={`w-14 h-14 object-contain rounded-md cursor-pointer border ${
                  thumb === mainImage
                    ? "border-blue-500 shadow-[0_0_8px_#3b82f6]"
                    : "border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
        {/* Right Side - Info */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-2xl font-semibold mb-5">
            {product.product_name || "Product Details"}
          </h2>
          <div className="space-y-6">
            {segments.map((segment, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-600 mb-4">
                  {segment.title}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {segment.fields.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex gap-4 space-y-1 bg-white p-3 rounded border border-gray-100 shadow-sm"
                    >
                      <span className="text-sm font-medium text-gray-600">
                        {label}
                      </span>
                      <span className="text-gray-900 text-sm">
                        {value || (
                          <span className="italic text-gray-400">
                            Not available
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewProductsModal
