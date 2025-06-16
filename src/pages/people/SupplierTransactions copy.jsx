import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../firebase/firebase.config";
import { ref, get, push } from "firebase/database";
import { FaSearch } from "react-icons/fa";

const SupplierPaymentPage = () => {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    method: "cash",
    reference: "",
    date: "",
    bill_number: "",
  });

  useEffect(() => {
    const fetchSupplier = async () => {
      const supplierRef = ref(db, `supplier_list/${id}`);
      const snapshot = await get(supplierRef);
      if (snapshot.exists()) {
        setSupplier({ id, ...snapshot.val() });
      }
    };

    const fetchTransactions = async () => {
      const transactionRef = ref(db, `supplier_transactions/${id}`);
      const snapshot = await get(transactionRef);
      if (snapshot.exists()) {
        setTransactions(Object.values(snapshot.val()));
      } else {
        setTransactions([]);
      }
    };

    if (id) {
      fetchSupplier();
      fetchTransactions();
    }
  }, [id]);

  useEffect(() => {
    const fetchProducts = async () => {
      const productsRef = ref(db, "products");
      const snapshot = await get(productsRef);
      if (snapshot.exists()) {
        const allProducts = Object.values(snapshot.val());
        const supplierProducts = allProducts.filter(
          (product) => String(product.supplier_id) === String(supplier?.id)
        );
        setProducts(supplierProducts);
        setFilteredResults(supplierProducts);
      }
    };

    if (supplier?.id) fetchProducts();
  }, [supplier?.id]);

  const handleSearch = () => {
    const filtered = products.filter((p) =>
      p.bill_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredResults(filtered);
  };

  const handlePaymentChange = (e) => {
    setPaymentData({ ...paymentData, [e.target.name]: e.target.value });
  };

const billSummaries = useMemo(() => {
  const seen = new Set();
  const summaries = [];

  products.forEach((product) => {
    const bill = product.bill_number || "N/A";
    if (seen.has(bill)) return;
    seen.add(bill);

    // Get the first matching product as representative (deal_amount stored once)
    const dealProduct = products.find((p) => p.bill_number === bill);
    const dealAmount = Number(dealProduct?.deal_amount) || 0;

    // Sum all payments from transactions for this bill
    const billPayments = transactions
      .filter((tx) => tx.bill_number === bill)
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const remain = dealAmount - billPayments;

    summaries.push({
      bill,
      deal: dealAmount,
      paid: billPayments,
      remain,
    });
  });

  return summaries;
}, [products, transactions]);

const totalDeal = billSummaries.reduce((sum, b) => sum + b.deal, 0);
const totalPaid = billSummaries.reduce((sum, b) => sum + b.paid, 0);
const totalRemain = totalDeal - totalPaid;

  const getStatus = () => {
    if (totalRemain === 0) return "Completed";
    if (totalRemain > 0) return "Pending";
    return "Exceed";
  };

  const handlePaymentSubmit = async () => {
    if (!paymentData.bill_number) {
      alert("Please select a bill number");
      return;
    }

    const billSummary = billSummaries.find(
      (b) => b.bill === paymentData.bill_number
    );

    if (!billSummary) {
      alert("Selected bill number not found");
      return;
    }

    const paidSoFar = billSummary.paid || 0;
    const dealAmount = billSummary.deal || 0;

    const paymentAmount = Number(paymentData.amount) || 0;

    const newRemain = dealAmount - (paidSoFar + paymentAmount);

    const paymentEntry = {
      ...paymentData,
      remain: newRemain >= 0 ? newRemain : 0,
    };

    const transactionRef = ref(db, `supplier_transactions/${id}`);
    await push(transactionRef, paymentEntry);

    setShowModal(false);
    setPaymentData({
      amount: "",
      method: "cash",
      reference: "",
      date: "",
      bill_number: "",
    });

    const snapshot = await get(transactionRef);
    if (snapshot.exists()) {
      setTransactions(Object.values(snapshot.val()));
    }
  };

  if (!supplier) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">
        Payment for {supplier.supplier_name}
      </h1>

      {/* Summary */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex justify-between text-lg">
          <div>Total Bill: <span className="font-semibold">৳{totalDeal.toLocaleString()}</span></div>
          <div>Paid: <span className="font-semibold">৳{totalPaid.toLocaleString()}</span></div>
          <div>Remain: <span className="font-semibold">৳{totalRemain.toLocaleString()}</span></div>
        </div>
        <div className="mt-2 text-right text-sm">
          <span className={`inline-block px-3 py-1 rounded ${getStatus() === "Completed" ? "bg-green-100 text-green-800" : getStatus() === "Pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
            {getStatus()}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md">
        <input
          type="text"
          placeholder="Search by bill number..."
          className="w-full border border-gray-300 rounded-md py-2 pl-10 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <FaSearch
          className="absolute left-3 top-3 text-gray-400 cursor-pointer"
          onClick={handleSearch}
        />
      </div>

      {/* Bill Table */}
      {filteredResults.length > 0 ? (
        <table className="min-w-full bg-white shadow rounded mb-8">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="text-left py-2 px-4">Bill Number</th>
              <th className="text-right py-2 px-4">Deal Amount</th>
              <th className="text-right py-2 px-4">Paid Amount</th>
              <th className="text-right py-2 px-4">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((product, idx) => {
              const deal = Number(product.deal_amount) || 0;
              const paid = Number(product.paid_amount) || 0;
              const remaining = deal - paid;
              return (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{product.bill_number}</td>
                  <td className="py-2 px-4 text-right">৳{deal.toLocaleString()}</td>
                  <td className="py-2 px-4 text-right">৳{paid.toLocaleString()}</td>
                  <td className="py-2 px-4 text-right">৳{remaining.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-600 mt-6">No matching bill found.</p>
      )}

      {/* Pay Button */}
      <div className="flex justify-end mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => setShowModal(true)}
        >
          Pay
        </button>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded shadow overflow-x-auto mb-12">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left">Date</th>
              <th className="py-2 px-4 text-right">Amount</th>
              <th className="py-2 px-4 text-left">Method</th>
              <th className="py-2 px-4 text-left">Reference</th>
              <th className="py-2 px-4 text-left">Bill Number</th>
              <th className="py-2 px-4 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{tx.date}</td>
                <td className="py-2 px-4 text-right">৳{tx.amount}</td>
                <td className="py-2 px-4">{tx.method}</td>
                <td className="py-2 px-4">{tx.reference}</td>
                <td className="py-2 px-4">{tx.bill_number}</td>
                <td className="py-2 px-4 text-right">৳{tx.remain?.toLocaleString() || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Make Payment</h2>
            <div className="space-y-4">
              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={paymentData.amount}
                onChange={handlePaymentChange}
                className="w-full border px-3 py-2 rounded"
              />
              <select
                name="method"
                value={paymentData.method}
                onChange={handlePaymentChange}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="MFS">MFS</option>
              </select>
              <input
                type="text"
                name="reference"
                placeholder="Reference"
                value={paymentData.reference}
                onChange={handlePaymentChange}
                className="w-full border px-3 py-2 rounded"
              />
              <input
                type="date"
                name="date"
                value={paymentData.date}
                onChange={handlePaymentChange}
                className="w-full border px-3 py-2 rounded"
              />
              <select
                name="bill_number"
                value={paymentData.bill_number}
                onChange={handlePaymentChange}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">Select Bill Number</option>
                {billSummaries.map((b, idx) => (
  <option key={idx} value={b.bill}>
    {b.bill} - Remaining ৳{b.remain.toLocaleString()}
  </option>
))}
              </select>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentPage;