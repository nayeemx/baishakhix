import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import SupplierTransaction from "./suppliertransaction";
import SupplierAdjustment from "./SupplierAdjustment";
import { FaMoneyBillWave, FaSearch, FaInfoCircle, FaHistory, FaSlidersH, FaTimes } from "react-icons/fa";
import Loader from "../Loader";

const ViewSupplier = ({ supplier }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    supplier_name: supplier?.supplier_name || "",
    address: supplier?.address || "",
    phone: supplier?.phone || "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  const handleTransactionRefresh = () => {
    setRefreshFlag((f) => f + 1);
  };

  useEffect(() => {
    if (!supplier) return;
    setLoading(true);
    getDocs(
      query(
        collection(firestore, "products"),
        where("supplier_id", "==", supplier.id)
      )
    ).then((snap) => {
      const prods = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(prods);
      setLoading(false);

      const billNumbersArr = Array.from(
        new Set(prods.map((p) => p.bill_number).filter(Boolean))
      );
      if (billNumbersArr.length > 0) {
        getDocs(
          query(
            collection(firestore, "supplier_transaction"),
            where("bill_number", "in", billNumbersArr)
          )
        )
          .then((snap) => {
            setTransactions(
              snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }))
            );
          })
          .catch(() => setTransactions([]));
      } else {
        setTransactions([]);
      }
    });
  }, [supplier, refreshFlag]);

  const filteredProducts = !search.trim()
    ? products
    : products.filter((p) =>
        (p.bill_number || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );

  const billNumbers = Array.from(
    new Set(filteredProducts.map((p) => p.bill_number || ""))
  ).filter((b) => b);

  const billSummaries = billNumbers.map((bill_number) => {
    const billProducts = filteredProducts.filter(
      (p) => p.bill_number === bill_number
    );
    // Debug: Log paid_amount fields in products
    billProducts.forEach((p) => {
      if (p.paid_amount) {
        console.log('Product paid_amount in Firestore:', p.id, p.paid_amount);
      }
    });
    const dealAmount = billProducts.find(
      (p) => p.deal_amount && !isNaN(Number(p.deal_amount))
    );
    // Always sum paid_amount from products and transactions
    let paidAmountFromProduct = 0;
    const paidProduct = billProducts.find(
      (p) => p.paid_amount && !isNaN(Number(p.paid_amount))
    );
    if (paidProduct) {
      paidAmountFromProduct = Number(paidProduct.paid_amount);
    }
    const paidFromTransactions = transactions
      .filter((t) => t.bill_number === bill_number)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return {
      bill_number,
      deal_amount: dealAmount ? Number(dealAmount.deal_amount) : 0,
      paid_amount: paidAmountFromProduct + paidFromTransactions,
    };
  });

  const totalDealAmount = billSummaries.reduce(
    (sum, b) => sum + b.deal_amount,
    0
  );
  const totalPaidAmount = billSummaries.reduce(
    (sum, b) => sum + b.paid_amount,
    0
  );
  const remainingAmount = totalDealAmount - totalPaidAmount;

  let status = "N/A";
  let statusColor = "bg-gray-200 text-gray-700";
  if (billNumbers.length > 0) {
    if (totalDealAmount > totalPaidAmount) {
      status = "Pending";
      statusColor = "bg-red-100 text-red-800";
    } else if (totalDealAmount === totalPaidAmount && totalDealAmount > 0) {
      status = "Paid";
      statusColor = "bg-green-100 text-green-800";
    }
  }

  let showBillNumber = "";
  let showDealAmount = totalDealAmount;
  let showPaidAmount = totalPaidAmount;
  let showRemaining = remainingAmount;
  let showStatus = status;
  let showStatusColor = statusColor;

  if (search.trim() && billNumbers.length === 1) {
    showBillNumber = billNumbers[0];
    showDealAmount = billSummaries[0]?.deal_amount || 0;
    showPaidAmount = billSummaries[0]?.paid_amount || 0;
    showRemaining = showDealAmount - showPaidAmount;
    if (showDealAmount > showPaidAmount) {
      showStatus = "Pending";
      showStatusColor = "bg-red-100 text-red-800";
    } else if (showDealAmount === showPaidAmount && showDealAmount > 0) {
      showStatus = "Paid";
      showStatusColor = "bg-green-100 text-green-800";
    } else {
      showStatus = "N/A";
      showStatusColor = "bg-gray-200 text-gray-700";
    }
  }

  const sumQuantity = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0
  );
  const sumUnitPrice = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.unit_price) || 0),
    0
  );
  const sumTotalPrice = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.total_price) || 0),
    0
  );

  const uniqueBillNumbers = Array.from(
    new Set(filteredProducts.map((p) => p.bill_number || ""))
  ).filter((b) => b);
  const billNumberCount = uniqueBillNumbers.length;

  const billNumbersForTransaction = Array.from(
    new Set(products.map((p) => p.bill_number).filter(Boolean))
  );

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await updateDoc(doc(firestore, "supplier_list", supplier.id), {
        supplier_name: editForm.supplier_name,
        address: editForm.address,
        phone: editForm.phone,
      });
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  if (!supplier) return null;
  return (
    <>
      <div className="flex justify-between gap-4">
        <div className="w-[80%]">
          <h2 className="text-xl font-bold mb-4">Supplier Details</h2>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-6 border border-blue-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {supplier.supplier_name}
                </h2>
                {showBillNumber && (
                  <p className="text-gray-600">Bill #: {showBillNumber}</p>
                )}
              </div>
              <div className="mt-4 md:mt-0">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${showStatusColor}`}
                >
                  {showStatus}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-xl font-bold text-gray-800">
                  ${showDealAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Paid Amount</p>
                <p className="text-xl font-bold text-green-600">
                  ${showPaidAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Remaining</p>
                <p className="text-xl font-bold text-red-600">
                  ${showRemaining.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">
              Products for this Supplier
            </h3>
            {loading ? (
              <Loader />
            ) : (
              <>
                <div className="h-[30vh] overflow-y-auto">
                  <table className="w-full overflow-auto border text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1">Barcode</th>
                        <th className="border px-2 py-1">Product</th>
                        <th className="border px-2 py-1">Category</th>
                        <th className="border px-2 py-1">Size</th>
                        <th className="border px-2 py-1">Color</th>
                        <th className="border px-2 py-1">Quantity</th>
                        <th className="border px-2 py-1">Unit Price</th>
                        <th className="border px-2 py-1">Total Price</th>
                        <th className="border px-2 py-1">Bill Number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="text-center py-4 text-gray-500"
                          >
                            No products found.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="border px-2 py-1">{p.barcode}</td>
                            <td className="border px-2 py-1">{p.product}</td>
                            <td className="border px-2 py-1">
                              {p.product_category}
                            </td>
                            <td className="border px-2 py-1">{p.size}</td>
                            <td className="border px-2 py-1">{p.color}</td>
                            <td className="border px-2 py-1">{p.quantity}</td>
                            <td className="border px-2 py-1">{p.unit_price}</td>
                            <td className="border px-2 py-1">{p.total_price}</td>
                            <td className="border px-2 py-1">{p.bill_number}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredProducts.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-bold">
                          <td className="border px-2 py-1 text-right" colSpan={5}>
                            Total
                          </td>
                          <td className="border px-2 py-1">{sumQuantity}</td>
                          <td className="border px-2 py-1">{sumUnitPrice}</td>
                          <td className="border px-2 py-1">{sumTotalPrice}</td>
                          <td className="border px-2 py-1">{billNumberCount}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Payment History
                    </h3>
                    <div className="flex gap-6">
                      <button
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded flex items-center"
                        onClick={() => setShowAdjustmentModal(true)}
                        title="Adjustment"
                      >
                        <FaSlidersH className="mr-2" />
                        Adjustment
                      </button>
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center"
                        onClick={() => setShowTransactionModal(true)}
                      >
                        <FaMoneyBillWave className="mr-2" />
                        Pay Bill
                      </button>
                    </div>
                  </div>
                  <table className="min-w-full border text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-4 py-2 text-left">Date</th>
                        <th className="border px-4 py-2 text-left">Amount</th>
                        <th className="border px-4 py-2 text-left">Method</th>
                        <th className="border px-4 py-2 text-left">Reference</th>
                        <th className="border px-4 py-2 text-left">
                          Bill Number
                        </th>
                        <th className="border px-4 py-2 text-left">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center py-6 text-gray-400"
                          >
                            No payment records found for this bill.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t) => (
                          <tr key={t.id}>
                            <td className="border px-4 py-2">
                              {t.paid_at
                                ? new Date(t.paid_at).toLocaleString()
                                : ""}
                            </td>
                            <td className="border px-4 py-2">
                              ${Number(t.amount).toFixed(2)}
                            </td>
                            <td className="border px-4 py-2">
                              {t.payment_method}
                            </td>
                            <td className="border px-4 py-2">{t.reference}</td>
                            <td className="border px-4 py-2">{t.bill_number}</td>
                            <td className="border px-4 py-2">
                              ${Number(t.remaining).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {showTransactionModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
                      <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
                        onClick={() => setShowTransactionModal(false)}
                        title="Close"
                      >
                        &times;
                      </button>
                      <SupplierTransaction
                        billNumbers={billNumbersForTransaction}
                        products={products}
                        onPaymentSuccess={handleTransactionRefresh}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {editOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
                  onClick={() => setEditOpen(false)}
                  title="Close"
                >
                  &times;
                </button>
                <h2 className="text-lg font-bold mb-4">Edit Supplier</h2>
                <form onSubmit={handleEditSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editForm.supplier_name}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          supplier_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editForm.address}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, address: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="border rounded p-2 w-full"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-300 rounded mr-2"
                      onClick={() => setEditOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded"
                      disabled={editSaving}
                    >
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
        <div className="mt-11 w-4/12">
          <div className="relative border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Search Bill</h3>
            <p className="text-sm text-gray-500 mb-3">bill number</p>
            <div className="relative drop-shadow-lg">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 mb-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white text-gray-700 text-base leading-tight"
                placeholder="Search by Bill Number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 -mt-[3.5vh] flex items-center pointer-events-none">
                <FaSearch className="text-gray-400 w-5 h-5" />
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 -mt-[4vh] flex items-center text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <span className="text-xl font-medium">×</span>
                </button>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg p-6 text-white shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Quick Tips</h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <FaInfoCircle className="mt-1 flex-shrink-0" />
                  <span>Search by bill number to view all associated products and payment history.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <FaMoneyBillWave className="mt-1 flex-shrink-0" />
                  <span>Use the "Pay Bill" button to record new payments against outstanding bills.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <FaHistory className="mt-1 flex-shrink-0" />
                  <span>All payment transactions are recorded with date, amount and reference number.</span>
                </li>
              </ul>
              <div className="mt-6 pt-4 border-t border-blue-400/30">
                <p className="text-sm text-blue-100">
                  Today is: {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} | {new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
        {showAdjustmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
                onClick={() => setShowAdjustmentModal(false)}
                title="Close"
              >
                <FaTimes />
              </button>
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <FaSlidersH className="mr-2" /> Adjustment
              </h2>
              <div className="text-gray-700">
                <SupplierAdjustment
                  supplier={supplier}
                  products={products}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ViewSupplier;