import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, updateDoc, doc, onSnapshot, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";

const SupplierTransaction = ({ billNumbers = [], products = [], onPaymentSuccess }) => {
  const [selectedBill, setSelectedBill] = useState(billNumbers[0] || "");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, transaction: null });

  const supplierId = products.length > 0 ? products[0].supplier_id : undefined;
  const billProducts = products.filter(
    p => p.bill_number === selectedBill && p.supplier_id === supplierId
  );

  useEffect(() => {
    if (!selectedBill) {
      setTransactions([]);
      return;
    }
    const q = query(
      collection(firestore, "supplier_transaction"),
      where("bill_number", "==", selectedBill)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [selectedBill, onPaymentSuccess]);
  let dealAmount = 0;
  let basePaidAmount = 0;
  if (billProducts.length > 0) {
    const deal = billProducts.find(p => p.deal_amount && !isNaN(Number(p.deal_amount)));
    dealAmount = deal ? Number(deal.deal_amount) : 0;
    
    // Get the initial paid amount from products
    const paidProduct = billProducts.find(
      (p) => p.paid_amount && !isNaN(Number(p.paid_amount))
    );
    if (paidProduct) {
      basePaidAmount = Number(paidProduct.paid_amount) || 0;
      console.log('Base paid amount from products:', basePaidAmount);
    }
  }
  
  // Sum all transaction amounts
  const transactionSum = transactions.reduce((sum, t) => {
    const amount = Number(t.amount) || 0;
    console.log('Transaction amount:', amount);
    return sum + amount;
  }, 0);
  console.log('Total transaction sum:', transactionSum);
  
  // Total paid is the original base amount plus transactions
  const paidAmount = basePaidAmount + transactionSum;
  console.log('Final paid amount:', paidAmount);
  const remaining = dealAmount - paidAmount;

  const handleEditTransaction = (transaction) => {
    setEditModal({ open: true, transaction: { ...transaction } });
  };
  const handleSaveEdit = async () => {
    if (!editModal.transaction) return;
    
    try {
      setLoading(true);
      setErrorMsg("");
      
      // Just update the transaction amount, don't touch the products table
      await updateDoc(doc(firestore, "supplier_transaction", editModal.transaction.id), {
        amount: Number(editModal.transaction.amount),
        payment_method: editModal.transaction.payment_method,
        reference: editModal.transaction.reference,
      });

      setSuccessMsg("Payment updated successfully!");
      if (onPaymentSuccess) onPaymentSuccess();
      setEditModal({ open: false, transaction: null });
    } catch (error) {
      setErrorMsg("Failed to update payment: " + error.message);
    } finally {
      setLoading(false);
    }
  };
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
      // Only add to supplier_transaction, don't modify products.paid_amount
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
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      setErrorMsg("Payment failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!selectedBill) return;
    setLoading(true);
    try {
      const q = query(
        collection(firestore, "supplier_transaction"),
        where("bill_number", "==", selectedBill)
      );
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map(docSnap =>
          docSnap.ref.delete()
        )
      );
      const prodQ = query(
        collection(firestore, "products"),
        where("bill_number", "==", selectedBill)
      );
      const prodSnap = await getDocs(prodQ);
      await Promise.all(
        prodSnap.docs.map(docSnap =>
          updateDoc(doc(firestore, "products", docSnap.id), { paid_amount: "0" })
        )
      );
      setSuccessMsg("All transactions deleted and paid amount reset.");
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      setErrorMsg("Failed to delete transactions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center w-full">
      <h2 className="text-xl font-bold mb-4">Payment History</h2>
      {/* Payment History Table */}
      <div className="w-full mb-6">
        <table className="min-w-full border text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Date</th>
              <th className="border px-2 py-1">Amount</th>
              <th className="border px-2 py-1">Method</th>
              <th className="border px-2 py-1">Reference</th>
              <th className="border px-2 py-1">Bill Number</th>
              <th className="border px-2 py-1">Remaining</th>
              <th className="border px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-2">No payment records found for this bill.</td>
              </tr>
            ) : 
              transactions.map((t) => (
                <tr key={t.id}>
                  <td className="border px-2 py-1">{t.paid_at ? new Date(t.paid_at).toLocaleString() : ''}</td>
                  <td className="border px-2 py-1">{t.amount}</td>
                  <td className="border px-2 py-1">{t.payment_method}</td>
                  <td className="border px-2 py-1">{t.reference}</td>
                  <td className="border px-2 py-1">{t.bill_number}</td>
                  <td className="border px-2 py-1">{t.remaining}</td>
                  <td className="border px-2 py-1">
                    <button className="text-blue-600 hover:underline" onClick={() => handleEditTransaction(t)}>Edit</button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
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
      {/* Payment Form */}
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
      <div className="mt-6 flex justify-between w-full">
        <button
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center"
          onClick={handleDeleteAllTransactions}
          disabled={loading}
        >
          Delete All Transactions
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
          onClick={handlePayBill}
          disabled={loading}
        >
          <i className="fas fa-money-bill-wave mr-2"></i>
          {loading ? "Processing..." : "Pay Bill"}
        </button>
      </div>
      {editModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[300px]">
            <h3 className="font-bold mb-2">Edit Payment</h3>
            <label className="block text-xs mb-1">Amount</label>
            <input
              type="number"
              className="border rounded p-2 w-full mb-2"
              value={editModal.transaction.amount}
              onChange={e => setEditModal({
                ...editModal,
                transaction: { ...editModal.transaction, amount: e.target.value }
              })}
            />
            <label className="block text-xs mb-1">Method</label>
            <input
              type="text"
              className="border rounded p-2 w-full mb-2"
              value={editModal.transaction.payment_method}
              onChange={e => setEditModal({
                ...editModal,
                transaction: { ...editModal.transaction, payment_method: e.target.value }
              })}
            />
            <label className="block text-xs mb-1">Reference</label>
            <input
              type="text"
              className="border rounded p-2 w-full mb-2"
              value={editModal.transaction.reference}
              onChange={e => setEditModal({
                ...editModal,
                transaction: { ...editModal.transaction, reference: e.target.value }
              })}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditModal({ open: false, transaction: null })}>Cancel</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleSaveEdit} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierTransaction;