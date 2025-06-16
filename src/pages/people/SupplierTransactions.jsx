import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../firebase/firebase.config";
import { ref, get, push, update } from "firebase/database";
import { FaSearch } from "react-icons/fa";

const SupplierPaymentPage = () => {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [productDetails, setProductDetails] = useState(null);
  const [selectedBill, setSelectedBill] = useState("");
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

  const fetchAndUpdateProducts = async () => {
    const productsRef = ref(db, "products");
    const productsSnapshot = await get(productsRef);
    if (productsSnapshot.exists()) {
      const allProducts = Object.values(productsSnapshot.val());
      const supplierProducts = allProducts.filter(
        (product) => String(product.supplier_id) === String(supplier?.id)
      );
      setProducts(supplierProducts);
      setFilteredResults(supplierProducts);
    }
  };

  useEffect(() => {
    if (supplier?.id) fetchAndUpdateProducts();
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

  const billNumbers = useMemo(() => {
    const set = new Set();
    products.forEach(p => p.bill_number && set.add(p.bill_number));
    return Array.from(set);
  }, [products]);

  const barcodesForSelectedBill = useMemo(() => {
    if (!selectedBill) return [];
    return products
      .filter((p) => p.bill_number === selectedBill)
      .map((p) => ({ barcode: p.barcode, name: p.product }));
  }, [selectedBill, products]);

  const billSummaries = useMemo(() => {
    const seen = new Set();
    const summaries = [];
    products.forEach((product) => {
      const bill = product.bill_number || "N/A";
      if (seen.has(bill)) return;
      seen.add(bill);
      const dealProduct = products.find((p) => p.bill_number === bill);
      const dealAmount = Number(dealProduct?.deal_amount) || 0;
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
    const txSnapshot = await get(transactionRef);
    if (txSnapshot.exists()) {
      setTransactions(Object.values(txSnapshot.val()));
    }
  };

  const handleBillChange = (e) => {
    setSelectedBill(e.target.value);
    setBarcodeInput("");
    setProductDetails(null);
  };

  const handleBarcodeSubmit = () => {
    const product = products.find(
      (p) =>
        p.barcode === barcodeInput &&
        p.bill_number === selectedBill
    );
    if (!product) {
      alert("Product not found!");
      return;
    }
    setProductDetails({
      id: product.id,
      name: product.product,
      barcode: product.barcode,
      qty: product.quantity,
      size: product.size || "",
      color: product.color || "",
      unit_price: product.unit_price,
      bill_number: product.bill_number,
      deal_amount: product.deal_amount,
      reduceQty: 1,
    });
  };

  // Confirm Replacement: Only log adjustment
  const handleConfirmReplacement = async () => {
    if (
      !adjustmentReason.trim() ||
      !productDetails?.reduceQty ||
      productDetails.reduceQty < 1
    ) {
      alert("Please enter a reason and quantity to reduce");
      return;
    }

    const adjustmentRef = ref(db, `supplier_adjustment/${id}`);
    await push(adjustmentRef, {
      type: "product replacement",
      productId: productDetails.id,
      barcode: productDetails.barcode,
      bill_number: productDetails.bill_number,
      amountReduced: 0,
      reason: adjustmentReason,
      reduceQty: productDetails.reduceQty,
      timestamp: Date.now(),
    });

    alert("Replacement adjustment recorded (no product/deal_amount changed)!");
    setShowAdjustmentModal(false);
    setBarcodeInput("");
    setProductDetails(null);
    setAdjustmentReason("");
    setSelectedBill("");
  };

  // Cancel Deal: Set deal_amount to 0 if no transaction for barcode
  const handleConfirmCancel = async () => {
    if (!adjustmentReason.trim()) {
      alert("Please enter a reason");
      return;
    }

    const txRef = ref(db, `supplier_transactions/${id}`);
    const txSnapshot = await get(txRef);
    const transactionsList = txSnapshot.exists()
      ? Object.values(txSnapshot.val())
      : [];
    const hasTransaction = transactionsList.some(
      (tx) => tx.barcode === productDetails.barcode
    );
    if (hasTransaction) {
      alert("Cannot cancel: Transaction already exists for this product");
      return;
    }
    const productRef = ref(db, `products/${productDetails.id}`);
    await update(productRef, { deal_amount: 0 });
    const adjustmentRef = ref(db, `supplier_adjustment/${id}`);
    await push(adjustmentRef, {
      type: "cancel",
      productId: productDetails.id,
      barcode: productDetails.barcode,
      reason: adjustmentReason,
      bill_number: productDetails.bill_number,
      timestamp: Date.now(),
    });
    alert("Deal canceled and deal_amount set to 0");
    setShowAdjustmentModal(false);
    setBarcodeInput("");
    setProductDetails(null);
    setAdjustmentReason("");
    setSelectedBill("");
    await fetchAndUpdateProducts();
  };

  // Reduce Bill: Reduce quantity and deal_amount of selected product only
  const handleConfirmBillReduction = async () => {
    if (
      !adjustmentReason.trim() ||
      !productDetails?.reduceQty ||
      productDetails.reduceQty < 1
    ) {
      alert("Please enter a reason and quantity to reduce");
      return;
    }

    const amountToReduce = productDetails.reduceQty * productDetails.unit_price;
    const newQty = Math.max(0, productDetails.qty - productDetails.reduceQty);
    const newDealAmount = Math.max(0, (productDetails.deal_amount || 0) - amountToReduce);

    // Update only the selected product (barcode)
    const productRef = ref(db, `products/${productDetails.id}`);
    await update(productRef, {
      quantity: newQty,
      deal_amount: newDealAmount,
    });

    // Store adjustment record
    const adjustmentRef = ref(db, `supplier_adjustment/${id}`);
    await push(adjustmentRef, {
      type: "bill_reduction",
      productId: productDetails.id,
      barcode: productDetails.barcode,
      oldQty: productDetails.qty,
      newQty,
      amountReduced: amountToReduce,
      reason: adjustmentReason,
      bill_number: productDetails.bill_number,
      timestamp: Date.now(),
    });

    alert("Bill reduction applied to selected product!");
    setShowAdjustmentModal(false);
    setBarcodeInput("");
    setProductDetails(null);
    setAdjustmentReason("");
    setSelectedBill("");
    await fetchAndUpdateProducts();
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

      {/* Pay and Adjustment Buttons */}
      <div className="flex justify-end gap-4 mb-4">
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          onClick={() => {
            setShowAdjustmentModal(true);
            setSelectedBill("");
            setBarcodeInput("");
            setProductDetails(null);
            setAdjustmentReason("");
          }}
        >
          Adjustment
        </button>
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

      {/* Payment Modal */}
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
                <option value="">Select Bill</option>
                {billNumbers.map(bill => (
                  <option key={bill} value={bill}>{bill}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={handlePaymentSubmit}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-full max-w-md shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => {
                setShowAdjustmentModal(false);
                setBarcodeInput("");
                setProductDetails(null);
                setAdjustmentReason("");
                setSelectedBill("");
              }}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Product Adjustment</h2>

            {/* Bill Number Selector */}
            <div className="mb-4">
              <label className="block mb-1 font-medium">Bill Number</label>
              <select
                value={selectedBill}
                onChange={handleBillChange}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">Select Bill</option>
                {billNumbers.map(bill => (
                  <option key={bill} value={bill}>{bill}</option>
                ))}
              </select>
            </div>

            {/* Barcode Input or Dropdown */}
            {selectedBill && !productDetails && (
              <div className="space-y-4">
                {barcodesForSelectedBill.length > 0 ? (
                  <select
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    className="w-full border px-3 py-2 rounded"
                  >
                    <option value="">Select Barcode</option>
                    {barcodesForSelectedBill.map(b => (
                      <option key={b.barcode} value={b.barcode}>
                        {b.barcode} - {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter product barcode"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    className="w-full border px-3 py-2 rounded"
                  />
                )}
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                  onClick={handleBarcodeSubmit}
                  disabled={!barcodeInput}
                >
                  Search Product
                </button>
              </div>
            )}

            {/* Product Details & Adjustment Inputs */}
            {productDetails && (
              <div className="space-y-4">
                <div className="bg-gray-100 p-3 rounded">
                  <div>
                    <span className="font-semibold">Product:</span> {productDetails.name}
                  </div>
                  <div>
                    <span className="font-semibold">Barcode:</span> {productDetails.barcode}
                  </div>
                  <div>
                    <span className="font-semibold">Current Qty:</span> {productDetails.qty}
                  </div>
                  <div>
                    <span className="font-semibold">Unit Price:</span> ৳{productDetails.unit_price}
                  </div>
                  <div>
                    <span className="font-semibold">Bill Number:</span> {productDetails.bill_number}
                  </div>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Quantity to Reduce</label>
                  <input
                    type="number"
                    min={1}
                    max={productDetails.qty}
                    value={productDetails.reduceQty || ""}
                    onChange={e =>
                      setProductDetails({
                        ...productDetails,
                        reduceQty: Number(e.target.value)
                      })
                    }
                    className="w-full border px-3 py-2 rounded"
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Reason</label>
                  <input
                    type="text"
                    value={adjustmentReason}
                    onChange={e => setAdjustmentReason(e.target.value)}
                    className="w-full border px-3 py-2 rounded"
                    placeholder="Enter reason"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 flex-1"
                    onClick={handleConfirmReplacement}
                  >
                    Confirm Replacement
                  </button>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex-1"
                    onClick={handleConfirmCancel}
                  >
                    Cancel Deal
                  </button>
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex-1"
                    onClick={handleConfirmBillReduction}
                  >
                    Reduce Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentPage;