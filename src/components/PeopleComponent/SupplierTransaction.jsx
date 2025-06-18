import React, { useState } from "react";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";

const SupplierTransaction = ({ billNumbers = [], products = [], onPaymentSuccess }) => {
  const [selectedBill, setSelectedBill] = useState(billNumbers[0] || "");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Find all products for the selected bill number (and correct supplier)
  // Only consider products that match both bill_number and supplier_id
  // Try to infer supplier_id from products (all products passed in are for the same supplier)
  const supplierId = products.length > 0 ? products[0].supplier_id : undefined;
  const billProducts = products.filter(
    p => p.bill_number === selectedBill && p.supplier_id === supplierId
  );

  // For correct calculation: get unique deal_amount and paid_amount for this bill_number and supplier
  let dealAmount = 0;
  let paidAmount = 0;
  if (billProducts.length > 0) {
    const deal = billProducts.find(p => p.deal_amount && !isNaN(Number(p.deal_amount)));
    const paid = billProducts.find(p => p.paid_amount && !isNaN(Number(p.paid_amount)));
    dealAmount = deal ? Number(deal.deal_amount) : 0;
    paidAmount = paid ? Number(paid.paid_amount) : 0;
  }
  const remaining = dealAmount - paidAmount;

  // Handle payment
  const handlePayBill = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!selectedBill) {
      setErrorMsg("Please select a bill number.");
      return;
    }
    const payAmt = Number(paymentAmount);
    if (!payAmt || payAmt <= 0) {
      setErrorMsg("Enter a valid payment amount.");
      return;
    }
    if (payAmt > remaining) {
      setErrorMsg("Payment exceeds remaining amount.");
      return;
    }
    setLoading(true);
    try {
      // 1. Update all products with this bill_number: set paid_amount to (prev + payAmt) for all
      const q = query(
        collection(firestore, "products"),
        where("bill_number", "==", selectedBill)
      );
      const snap = await getDocs(q);
      const docsToUpdate = snap.docs;

      // Update paid_amount for each product (set all to new paidAmount)
      await Promise.all(
        docsToUpdate.map(async (docSnap) => {
          await updateDoc(doc(firestore, "products", docSnap.id), {
            paid_amount: (paidAmount + payAmt).toString(),
          });
        })
      );

      // 2. Add a transaction record to supplier_transaction table
      await addDoc(collection(firestore, "supplier_transaction"), {
        bill_number: selectedBill,
        amount: payAmt,
        payment_method: paymentMethod,
        reference,
        paid_at: new Date().toISOString(),
        remaining: remaining - payAmt,
      });

      setSuccessMsg("Payment successful!");
      setPaymentAmount("");
      setReference("");
      // Call refresh in parent to reload data
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      setErrorMsg("Payment failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center w-full">
      <h2 className="text-xl font-bold mb-4">Payment History</h2>
      <div className="w-full mb-4">
        <label className="block text-sm font-medium mb-1">Select Bill Number</label>
        <select
          className="border rounded p-2 w-full"
          value={selectedBill}
          onChange={e => setSelectedBill(e.target.value)}
        >
          {billNumbers.length === 0 && <option value="">No Bill Found</option>}
          {billNumbers.map(bill => (
            <option key={bill} value={bill}>{bill}</option>
          ))}
        </select>
      </div>
      <div className="w-full mb-2 flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Total Amount</label>
          <div className="font-bold text-gray-800">${dealAmount.toFixed(2)}</div>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Paid Amount</label>
          <div className="font-bold text-green-600">${paidAmount.toFixed(2)}</div>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Remaining</label>
          <div className="font-bold text-red-600">${remaining.toFixed(2)}</div>
        </div>
      </div>
      <div className="w-full mb-4">
        <label className="block text-sm font-medium mb-1">Payment Amount</label>
        <input
          type="number"
          className="border rounded p-2 w-full"
          placeholder="Enter amount"
          value={paymentAmount}
          onChange={e => setPaymentAmount(e.target.value)}
        />
      </div>
      <div className="w-full mb-4">
        <label className="block text-sm font-medium mb-1">Payment Method</label>
        <select
          className="border rounded p-2 w-full"
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value)}
        >
          <option value="Cash">Cash</option>
          <option value="Check">Check</option>
          <option value="MFS">MFS</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Credit Card">Credit Card</option>
        </select>
      </div>
      <div className="w-full mb-4">
        <label className="block text-sm font-medium mb-1">Reference</label>
        <input
          type="text"
          className="border rounded p-2 w-full"
          placeholder="Reference (optional)"
          value={reference}
          onChange={e => setReference(e.target.value)}
        />
      </div>
      {errorMsg && <div className="text-red-600 text-sm mb-2">{errorMsg}</div>}
      {successMsg && <div className="text-green-600 text-sm mb-2">{successMsg}</div>}
      <div className="mt-6 flex justify-end w-full">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
          onClick={handlePayBill}
          disabled={loading}
        >
          <i className="fas fa-money-bill-wave mr-2"></i>
          {loading ? "Processing..." : "Pay Bill"}
        </button>
      </div>
    </div>
  );
};

export default SupplierTransaction;