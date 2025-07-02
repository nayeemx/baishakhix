import React, { useState } from 'react';
import { doc, updateDoc, getDocs, collection, query, where } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SupplierAdjustmentEdit = ({ adjustment = {}, onClose }) => {
  const [form, setForm] = useState({
    supplier_name: adjustment.supplier_name || "",
    bill_number: adjustment.bill_number || "",
    barcode: adjustment.barcode || "",
    product: adjustment.product || "",
    quantity: adjustment.quantity || "",
    unit_price: adjustment.unit_price || "",
    total_price: adjustment.total_price || "",
    type: adjustment.type || "",
    note: adjustment.note || "",
    supplier_id: adjustment.supplier_id || "",
    created_at: adjustment.created_at || "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!adjustment.id) {
      toast.error("No adjustment ID found.");
      return;
    }
    setSaving(true);
    try {
      // 1. Update the adjustment record itself
      const docRef = doc(firestore, "supplier_adjustment", adjustment.id);
      await updateDoc(docRef, {
        product: form.product,
        quantity: form.quantity,
        unit_price: form.unit_price,
        total_price: form.total_price,
        type: form.type,
        note: form.note,
      });

      // 2. If bill_reduction, update product quantity and deal_amounts
      if (form.type === "bill_reduction") {
        // a) Find the product with the selected barcode and bill_number
        const productsCol = collection(firestore, "products");
        const q = query(
          productsCol,
          where("bill_number", "==", form.bill_number),
          where("barcode", "==", form.barcode)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          toast.error("No product found for this barcode and bill number.");
          setSaving(false);
          return;
        }
        const prodDoc = snap.docs[0];
        const prodData = prodDoc.data();
        const productDocRef = doc(firestore, "products", prodDoc.id);

        // Parse numbers
        const originalProductQty = Number(prodData.quantity) || 0;
        const oldAdjustmentQty = Number(adjustment.quantity) || 0;
        const newAdjustmentQty = Number(form.quantity) || 0;
        const unitPrice = Number(form.unit_price) || 0;

        // Calculate the difference
        const diff = newAdjustmentQty - oldAdjustmentQty;

        // Prevent increasing adjustment quantity beyond available in products table
        if (diff > 0 && diff > originalProductQty) {
          toast.error(
            `Cannot increase adjustment quantity by ${diff}. Only ${originalProductQty} available in products table.`
          );
          setSaving(false);
          return;
        }

        // If diff < 0, user reduced adjustment quantity, so increase product quantity and deal_amount
        // If diff > 0, user increased adjustment quantity, so decrease product quantity and deal_amount
        let updatedProductQty;
        if (diff > 0) {
          // Reduce product quantity
          updatedProductQty = originalProductQty - diff;
        } else {
          // Increase product quantity, but not above original stock (optional: you can set a max limit)
          updatedProductQty = originalProductQty - diff;
        }
        if (updatedProductQty < 0) updatedProductQty = 0;

        await updateDoc(productDocRef, { quantity: String(updatedProductQty) });

        // Update deal_amount for all products with this bill_number
        const allBillProductsQ = query(
          productsCol,
          where("bill_number", "==", form.bill_number)
        );
        const allBillSnap = await getDocs(allBillProductsQ);

        const dealAmountDiff = unitPrice * diff;

        for (const docSnap of allBillSnap.docs) {
          const prod = docSnap.data();
          const currentDealAmount = Number(prod.deal_amount) || 0;
          const newDealAmount = currentDealAmount - dealAmountDiff;
          await updateDoc(doc(firestore, "products", docSnap.id), {
            deal_amount: String(newDealAmount)
          });
        }
      }

      toast.success("Adjustment updated successfully!");
      if (onClose) onClose();
    } catch (err) {
      toast.error("Failed to update adjustment: " + err.message);
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-bold mb-2">Edit Supplier Adjustment</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Supplier Name</label>
          <input
            type="text"
            name="supplier_name"
            className="border rounded p-2 w-full"
            value={form.supplier_name}
            onChange={handleChange}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bill Number</label>
          <input
            type="text"
            name="bill_number"
            className="border rounded p-2 w-full"
            value={form.bill_number}
            onChange={handleChange}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Barcode</label>
          <input
            type="text"
            name="barcode"
            className="border rounded p-2 w-full"
            value={form.barcode}
            onChange={handleChange}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Product</label>
          <input
            type="text"
            name="product"
            className="border rounded p-2 w-full"
            value={form.product}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="number"
            name="quantity"
            className="border rounded p-2 w-full"
            value={form.quantity}
            onChange={handleChange}
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unit Price</label>
          <input
            type="text"
            name="unit_price"
            className="border rounded p-2 w-full"
            value={form.unit_price}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Total Price</label>
          <input
            type="text"
            name="total_price"
            className="border rounded p-2 w-full"
            value={form.total_price}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            name="type"
            className="border rounded p-2 w-full"
            value={form.type}
            onChange={handleChange}
          >
            <option value="return_replacement">Return with Replacement</option>
            <option value="bill_reduction">Return with Bill Reduction</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Note</label>
          <input
            type="text"
            name="note"
            className="border rounded p-2 w-full"
            value={form.note}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Supplier ID</label>
          <input
            type="text"
            name="supplier_id"
            className="border rounded p-2 w-full"
            value={form.supplier_id}
            onChange={handleChange}
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Created At</label>
          <input
            type="text"
            name="created_at"
            className="border rounded p-2 w-full"
            value={form.created_at}
            onChange={handleChange}
            disabled
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-100"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default SupplierAdjustmentEdit;