import React, { useState } from "react";
import placeholder from "../../assets/placeholder.jpg";

const ViewOldProductModal = ({ open, setOpen, product, suppliersList = [] }) => {
  if (!open || !product) return null;

  // Map Firestore product fields to UI fields
  const prod = {
    ...product,
    product_name: product.product || product.product_name,
  };

  const supplier =
    suppliersList.find((s) => s.id === prod.supplier_id) || {};

  // Parse image field to array (support comma-separated string or array)
  const imageArr = prod.image
    ? Array.isArray(prod.image)
      ? prod.image
      : typeof prod.image === "string"
        ? prod.image.split(",").map((i) => i.trim()).filter(Boolean)
        : []
    : [];
  const images = imageArr.length > 0 ? imageArr : [placeholder];
  const [mainImage, setMainImage] = useState(images[0]);

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = placeholder;
  };

  // Custom segment grouping
  const segments = [
    {
      title: "Basic Information",
      fields: [
        { label: "Product Name", value: prod.product_name },
        { label: "Barcode", value: prod.barcode },
        { label: "Old Barcode", value: prod.old_barcode },
        { label: "Bill Number", value: prod.bill_number },
        { label: "Supplier", value: supplier.supplier_name || prod.supplier_id },
        { label: "SKU", value: prod.sku },
        { label: "Old SKU", value: prod.old_sku },
      ],
    },
    {
      title: "Pricing & Quantity",
      fields: [
        { label: "Bill Amount", value: prod.deal_amount && `BDT ${prod.deal_amount}` },
        { label: "Paid Amount", value: prod.paid_amount && `BDT ${prod.paid_amount}` },
        { label: "Quantity", value: prod.quantity },
        { label: "Original Quantity", value: prod.original_qty },
        { label: "Retail Price", value: prod.retail_price && `BDT ${prod.retail_price}` },
        { label: "Unit Price", value: prod.unit_price && `BDT ${prod.unit_price}` },
        { label: "Total Price", value: prod.total_price && `BDT ${prod.total_price}` },
        { label: "Percentage", value: prod.percentage && `${prod.percentage}%` },
      ],
    },
    {
      title: "Design & Classification",
      fields: [
        { label: "Design", value: prod.design },
        { label: "Category", value: prod.product_category },
        { label: "Brand", value: prod.brand },
        { label: "Color", value: prod.color },
        { label: "Size", value: prod.size },
        { label: "Style", value: prod.style },
        { label: "Season", value: prod.season },
        { label: "Supplier Type", value: prod.murukhho },
        { label: "Is Labeled", value: prod.is_labeled },
      ],
    },
    {
      title: "Dates & Origin",
      fields: [
        { label: "Manufacture Date", value: prod.manufacture_date },
        { label: "Expiry Date", value: prod.expiry_date },
        { label: "Origin", value: prod.origin },
      ],
    },
    {
      title: "Audit Trail",
      fields: [
        { label: "Created At", value: prod.created_at },
        { label: "Created By", value: prod.created_by },
        { label: "Updated At", value: prod.updated_at },
        { label: "Updated By", value: prod.updated_by },
        { label: "Deleted At", value: prod.deleted_at },
        { label: "Deleted By", value: prod.deleted_by },
      ],
    },
    {
      title: "Additional Details",
      fields: [
        {
          label: "Description",
          value: prod.description
            ? (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: prod.description }}
                />
              )
            : <i>No description</i>,
        },
      ],
    },
  ];

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
            {prod.product_name || "Product Details"}
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
  );
};

export default ViewOldProductModal;