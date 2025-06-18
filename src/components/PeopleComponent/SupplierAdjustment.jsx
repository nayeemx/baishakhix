import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SupplierAdjustment = ({ supplier, products = [], onSubmit }) => {
  const [type, setType] = useState("return_replacement");
  const [selectedBill, setSelectedBill] = useState("");
  const [selectedBarcode, setSelectedBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  // Only show bill numbers for this supplier
  const billNumbers = useMemo(
    () =>
      [
        ...new Set(
          products
            .filter((p) => String(p.supplier_id) === String(supplier.id))
            .map((p) => p.bill_number)
        ),
      ].filter((b) => b && b !== ""),
    [products, supplier.id]
  );

  // Only show products for selected bill and this supplier
  const billProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          String(p.supplier_id) === String(supplier.id) &&
          p.bill_number === selectedBill
      ),
    [products, supplier.id, selectedBill]
  );

  const selectedProduct = billProducts.find((p) => p.barcode === selectedBarcode);
  const maxQty = selectedProduct ? Number(selectedProduct.quantity) : 1;

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBill || !selectedBarcode || !quantity) return;

    if (type === "return_replacement") {
      const adjustment = {
        supplier_id: supplier.id,
        supplier_name: supplier.supplier_name,
        bill_number: selectedBill,
        barcode: selectedBarcode,
        product: selectedProduct?.product,
        quantity: Number(quantity),
        unit_price: selectedProduct?.unit_price,
        total_price: Number(selectedProduct?.unit_price) * Number(quantity),
        note,
        type,
        created_at: new Date().toISOString(),
      };

      try {
        if (onSubmit) {
          onSubmit(adjustment, type);
        } else {
          const { getFirestore, collection, addDoc } = await import("firebase/firestore");
          const { firestore } = await import("../../firebase/firebase.config");
          await addDoc(collection(firestore, "supplier_adjustment"), adjustment);
        }
        toast.success("Adjustment saved successfully!");
        setSelectedBill("");
        setSelectedBarcode("");
        setQuantity(1);
        setNote("");
      } catch (err) {
        toast.error("Failed to save adjustment: " + err.message);
      }
    } else if (type === "bill_reduction") {
      // Bill Reduction: store adjustment and update product quantity and deal_amount
      const adjustment = {
        supplier_id: supplier.id,
        supplier_name: supplier.supplier_name,
        bill_number: selectedBill,
        barcode: selectedBarcode,
        product: selectedProduct?.product,
        quantity: Number(quantity),
        unit_price: selectedProduct?.unit_price,
        total_price: Number(selectedProduct?.unit_price) * Number(quantity),
        note,
        type,
        created_at: new Date().toISOString(),
      };

      try {
        const { getFirestore, collection, addDoc, doc, updateDoc, getDocs, query, where } = await import("firebase/firestore");
        const { firestore } = await import("../../firebase/firebase.config");
        // 1. Store adjustment record
        const adjDocRef = await addDoc(collection(firestore, "supplier_adjustment"), adjustment);
        console.log("Adjustment doc written:", adjDocRef.id, adjustment);

        // 2. Update product quantity (reduce by selected quantity) for selected barcode only
        if (!selectedProduct?.id) {
          toast.error("Product ID missing, cannot update quantity.");
          return;
        }
        // Double-check that the product exists in Firestore before updating
        // Your Firestore document IDs are NOT the same as your product "id" field.
        // You must find the Firestore doc by barcode (or id field), not by selectedProduct.id.

        // Find all products with the same bill_number (regardless of barcode)
        const q = query(
          collection(firestore, "products"),
          where("bill_number", "==", selectedBill)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          console.error("No products found in Firestore for bill_number:", selectedBill);
          toast.error(`No products found for bill ${selectedBill}`);
          return;
        }
        const reduction = Number(selectedProduct.unit_price) * Number(quantity);

        // Reduce quantity for the selected barcode only
        let quantityUpdated = false;
        for (const docSnap of snap.docs) {
          const prod = docSnap.data();
          // Update quantity only for the selected barcode
          if (prod.barcode === selectedProduct.barcode && !quantityUpdated) {
            const currentQty = Number(prod.quantity) || 0;
            const newQty = Math.max(0, currentQty - Number(quantity));
            await updateDoc(doc(firestore, "products", docSnap.id), { quantity: String(newQty) });
            console.log("Quantity updated for product", prod.barcode, "from", currentQty, "to", newQty);
            quantityUpdated = true;
          }
          // Update deal_amount for all products with this bill_number
          const currentDealAmount = Number(prod.deal_amount) || 0;
          const newDealAmount = Math.max(0, currentDealAmount - reduction);
          await updateDoc(doc(firestore, "products", docSnap.id), {
            deal_amount: String(newDealAmount)
          });
          console.log(
            "Deal amount updated for product",
            prod.barcode,
            "from",
            prod.deal_amount,
            "to",
            newDealAmount,
            "| reduction:",
            reduction
          );
        }

        toast.success("Bill reduction adjustment saved and product/deal amount updated!");
        setSelectedBill("");
        setSelectedBarcode("");
        setQuantity(1);
        setNote("");
      } catch (err) {
        console.error("Adjustment error:", err);
        toast.error("Failed to save bill reduction: " + err.message);
      }
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-xl font-bold mb-2">Bill Adjustment</h2>
        {/* Adjustment Type */}
        <div className="flex gap-4 mb-4">
          <button
            type="button"
            className={`flex-1 border rounded-lg p-4 flex flex-col items-start ${
              type === "return_replacement"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
            onClick={() => setType("return_replacement")}
          >
            <span className="font-semibold text-blue-700 mb-1">
              Return with Replacement
            </span>
            <span className="text-xs text-gray-500">
              Product returned and replaced by supplier (No bill change)
            </span>
          </button>
          <button
            type="button"
            className={`flex-1 border rounded-lg p-4 flex flex-col items-start ${
              type === "bill_reduction"
                ? "border-green-500 bg-green-50"
                : "border-gray-200"
            }`}
            onClick={() => setType("bill_reduction")}
          >
            <span className="font-semibold text-green-700 mb-1">
              Return with Bill Reduction
            </span>
            <span className="text-xs text-gray-500">
              Product returned, reduce from bill amount
            </span>
          </button>
        </div>
        {/* Bill Number */}
        <div>
          <label className="block text-sm font-medium mb-1">Bill Number</label>
          <select
            className="w-full border rounded p-2"
            value={selectedBill}
            onChange={(e) => {
              setSelectedBill(e.target.value);
              setSelectedBarcode("");
              setQuantity(1);
            }}
          >
            <option value="">Select Bill Number</option>
            {/* Ensure unique keys by combining bill number and index */}
            {billNumbers.map((bn, idx) => (
              <option key={bn + "-" + idx} value={bn}>
                {bn}
              </option>
            ))}
          </select>
        </div>
        {/* Barcode/Product */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Product (Barcode)
          </label>
          <select
            className="w-full border rounded p-2"
            value={selectedBarcode}
            onChange={(e) => {
              setSelectedBarcode(e.target.value);
              setQuantity(1);
            }}
            disabled={!selectedBill}
          >
            <option value="">Select Product</option>
            {/* Ensure unique keys by combining barcode and index */}
            {billProducts.map((p, idx) => (
              <option key={p.barcode + "-" + idx} value={p.barcode}>
                {p.product} ({p.barcode})
              </option>
            ))}
          </select>
        </div>
        {/* Quantity and Unit Price */}
        {selectedProduct && (
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(1, Math.min(maxQty, Number(e.target.value)))
                  )
                }
                className="border rounded p-2 w-24"
              />
              <span className="ml-2 text-xs text-gray-400">
                / {maxQty} available
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit Price</label>
              <div className="p-2 border rounded bg-gray-50">
                {selectedProduct.unit_price}
              </div>
            </div>
          </div>
        )}
        {/* Note */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Adjustment Note
          </label>
          <textarea
            className="w-full border rounded p-2"
            placeholder="Enter reason for adjustment..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100"
            onClick={() => onSubmit && onSubmit(null)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            disabled={!selectedBill || !selectedBarcode || !quantity}
          >
            Confirm Adjustment
          </button>
        </div>
      </form>
    </>
  );
};

export default SupplierAdjustment;