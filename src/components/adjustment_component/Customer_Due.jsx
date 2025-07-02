import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import { FiSearch, FiUser, FiPhone, FiCalendar, FiCheckCircle, FiAlertCircle, FiBox, FiCreditCard } from "react-icons/fi";
import { useSelector } from "react-redux";

const HIGH_DUE_THRESHOLD = 1000; // You can adjust this threshold

const Customer_Due = ({ onOpen }) => {
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState(null);
  const [dueSales, setDueSales] = useState([]); // Only due sales
  const [payments, setPayments] = useState([]);
  const [selectedSales, setSelectedSales] = useState({}); // { saleId: { amount, selectedProducts: [productId, ...] } }
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [allSales, setAllSales] = useState([]); // For last visit
  const [reference, setReference] = useState("");
  const user = useSelector(state => state.auth?.user); // Assuming user is stored in redux
  const [tab, setTab] = useState("payment"); // 'payment' or 'history'

  useEffect(() => {
    if (onOpen) onOpen();
  }, [onOpen]);

  // Search customer by phone number
  const handleSearch = async () => {
    setLoading(true);
    setCustomer(null);
    setDueSales([]);
    setPayments([]);
    setSelectedSales({});
    setAllSales([]);
    setMessage("");
    try {
      const q = query(collection(firestore, "customers"), where("customerNumber", "==", search));
      const snap = await getDocs(q);
      if (snap.empty) {
        setMessage("No customer found.");
        setLoading(false);
        return;
      }
      const cust = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setCustomer(cust);
      // Fetch due sales for this customer
      const salesQ = query(
        collection(firestore, "sales"),
        where("customerNumber", "==", search),
        where("paymentMethod", "==", "due_sale")
      );
      const salesSnap = await getDocs(salesQ);
      const salesArr = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDueSales(salesArr);
      // Fetch all sales for this customer (for last visit)
      const allSalesQ = query(
        collection(firestore, "sales"),
        where("customerNumber", "==", search)
      );
      const allSalesSnap = await getDocs(allSalesQ);
      const allSalesArr = allSalesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllSales(allSalesArr);
      // Fetch payments for this customer
      const payQ = query(collection(firestore, "customer_transactions"), where("customerNumber", "==", search));
      const paySnap = await getDocs(payQ);
      const payArr = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(payArr.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
    } catch (err) {
      setMessage("Error searching customer.");
    }
    setLoading(false);
  };

  // Helper: get paid and remaining for a sale
  const getSalePaid = (sale) => {
    return payments
      .filter(p => p.salesPaid && p.salesPaid.some(sp => sp.saleId === sale.id))
      .reduce((sum, p) => {
        return sum + p.salesPaid.filter(sp => sp.saleId === sale.id).reduce((s, sp) => s + parseFloat(sp.amount || 0), 0);
      }, 0);
  };
  const getSaleRemaining = (sale) => parseFloat(sale.total || 0) - getSalePaid(sale);

  // Helper: get remaining due for a sale after a given payment
  const getSaleRemainingAfterPayment = (saleId, paymentIndex) => {
    const sale = dueSales.find(s => s.id === saleId);
    if (!sale) return 0;
    let paid = 0;
    for (let i = 0; i <= paymentIndex; i++) {
      const p = payments[i];
      if (p.salesPaid) {
        paid += p.salesPaid.filter(sp => sp.saleId === saleId).reduce((s, sp) => s + parseFloat(sp.amount || 0), 0);
      }
    }
    return parseFloat(sale.total || 0) - paid;
  };

  // Calculate total due
  const totalDue = dueSales.reduce((sum, sale) => sum + getSaleRemaining(sale), 0);

  // Handle selection and amount input for each sale
  const handleSaleSelect = (saleId, checked) => {
    setSelectedSales(prev => {
      const copy = { ...prev };
      if (checked) {
        copy[saleId] = { amount: '', selectedProducts: [] };
      } else {
        delete copy[saleId];
      }
      return copy;
    });
  };
  const handleSaleAmount = (saleId, value) => {
    setSelectedSales(prev => ({ ...prev, [saleId]: { ...prev[saleId], amount: value } }));
  };
  const handleProductSelect = (saleId, productId, checked) => {
    setSelectedSales(prev => {
      const copy = { ...prev };
      if (!copy[saleId]) copy[saleId] = { amount: '', selectedProducts: [] };
      if (checked) {
        copy[saleId].selectedProducts = [...(copy[saleId].selectedProducts || []), productId];
      } else {
        copy[saleId].selectedProducts = (copy[saleId].selectedProducts || []).filter(id => id !== productId);
      }
      return copy;
    });
  };

  // Record a payment
  const handlePayment = async (e) => {
    e.preventDefault();
    if (!Object.keys(selectedSales).length || !method) {
      setMessage("Select at least one due sale and payment method.");
      return;
    }
    // Validate amounts
    for (const saleId of Object.keys(selectedSales)) {
      const sale = dueSales.find(s => s.id === saleId);
      const due = getSaleRemaining(sale);
      const amt = parseFloat(selectedSales[saleId].amount || 0);
      if (!amt || amt <= 0 || amt > due) {
        setMessage("Invalid payment amount for a selected sale.");
        return;
      }
    }
    setLoading(true);
    try {
      // Fetch user name from users table
      let createdBy = user?.displayName || user?.name || user?.email || "Unknown";
      if (user?.uid) {
        const userQ = query(collection(firestore, "users"), where("uid", "==", user.uid));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          createdBy = userData.name || userData.email || createdBy;
        }
      }
      // Prepare salesPaid array
      const salesPaid = Object.keys(selectedSales).map(saleId => ({
        saleId,
        productIds: selectedSales[saleId].selectedProducts,
        amount: parseFloat(selectedSales[saleId].amount || 0)
      }));
      // Build payment data object
      const paymentData = {
        customerId: customer.id,
        customerName: customer.customerName,
        customerNumber: customer.customerNumber,
        amount: salesPaid.reduce((sum, s) => sum + s.amount, 0),
        method,
        notes,
        timestamp: Timestamp.now(),
        salesPaid,
        createdBy
      };
      if (["MFS", "Card", "Other"].includes(method) && reference) {
        paymentData.reference = reference;
      }
      await addDoc(collection(firestore, "customer_transactions"), paymentData);
      // Reset all form and selection state after payment
      setSelectedSales({});
      setMethod("");
      setReference("");
      setNotes("");
      setMessage("");
      // Refetch due sales and payments
      await handleSearch();
    } catch (err) {
      setMessage("Error recording payment.");
      console.error("Payment error:", err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 w-full mx-auto">
      <h2 className="text-3xl font-bold mb-2 text-center">Customer Adjustment Tool</h2>
      <p className="text-center mb-6 text-gray-500">Manage customer dues and payment adjustments</p>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Search & Details */}
        <div className="flex flex-col gap-4 w-full md:w-1/3">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-700 text-xl font-bold">
              <FiSearch /> Customer Search
            </div>
            <label className="block text-sm font-semibold mb-1">Search by Phone</label>
            <div className="flex gap-2">
              <input
                className="border rounded p-2 w-full"
                placeholder="Enter customer phone number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                disabled={loading}
              />
              <button onClick={handleSearch} className="bg-blue-500 text-white px-4 py-2 rounded" disabled={loading}>
                <FiSearch />
              </button>
            </div>
            {message && <div className="text-red-500 mt-2 text-sm">{message}</div>}
            {customer && (
              <div className="mt-4 flex items-center gap-2 p-2 border rounded bg-gray-50">
                <FiUser className="text-xl" />
                <div className="flex-1">
                  <div className="font-semibold">{customer.customerName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1"><FiPhone />{customer.customerNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold text-lg">৳{totalDue.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Due Amount</div>
                </div>
              </div>
            )}
          </div>
          {/* Customer Details */}
          {customer && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2 text-purple-700 text-xl font-bold">
                <FiUser /> Customer Details
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-full p-3">
                  <FiUser className="text-3xl text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-lg">{customer.customerName}</div>
                  <div className="text-gray-500 text-sm flex items-center gap-1"><FiPhone />{customer.customerNumber}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="text-red-500 font-extrabold">৳</span>
                  Total Due: <span className="text-red-600">৳{totalDue.toFixed(2)}</span>
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"><FiCheckCircle /> Due Sales {dueSales.length}</div>
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded"><FiCalendar /> Last Visit {(() => {
                    if (!allSales.length) return "-";
                    const latest = allSales.reduce((max, sale) => {
                      const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt);
                      return d > max ? d : max;
                    }, new Date(0));
                    return latest.toLocaleDateString();
                  })()}</div>
                </div>
                <div className="mt-3">
                  {totalDue > HIGH_DUE_THRESHOLD ? (
                    <div className="bg-red-100 text-red-700 px-3 py-1 rounded flex items-center gap-2"><FiAlertCircle /> High Due Amount</div>
                  ) : (
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded flex items-center gap-2"><FiCheckCircle /> Low Due Amount</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Payment & History */}
        <div className="flex-1">
          {customer ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex gap-4 mb-4">
                <button className={`px-4 py-2 font-semibold border-b-2 ${tab === 'payment' ? 'border-blue-500' : 'border-transparent'}`} onClick={() => setTab('payment')}>Payment Adjustment</button>
                <button className={`px-4 py-2 font-semibold border-b-2 ${tab === 'history' ? 'border-blue-500' : 'border-transparent'}`} onClick={() => setTab('history')}>Adjustment History</button>
              </div>
              {tab === 'payment' && (
                <>
                {/* Due Sales List */}
                <div className="mb-6">
                  <div className="font-semibold mb-2 flex items-center gap-2"><FiBox /> Due Sales</div>
                  {dueSales.length === 0 ? (
                    <div className="text-gray-400 text-sm">No due sales found.</div>
                  ) : (
                    <ul className="divide-y">
                      {dueSales.map(sale => {
                        const saleDue = getSaleRemaining(sale);
                        const salePaid = getSalePaid(sale);
                        return (
                          <li key={sale.id} className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!selectedSales[sale.id]}
                                onChange={e => handleSaleSelect(sale.id, e.target.checked)}
                                disabled={saleDue <= 0}
                              />
                              <div className="flex-1">
                                <div className="font-semibold">Invoice: {sale.invoiceNumber || sale.id}</div>
                                <div className="text-xs text-gray-500">Date: {sale.createdAt && (sale.createdAt.toDate ? sale.createdAt.toDate().toLocaleString() : new Date(sale.createdAt).toLocaleString())}</div>
                                <div className="text-xs text-gray-500">Total: <span className="font-bold">৳{parseFloat(sale.total || 0).toFixed(2)}</span> | Paid: <span className="text-green-600 font-bold">৳{salePaid.toFixed(2)}</span> | Remaining: <span className="text-red-600 font-bold">৳{saleDue.toFixed(2)}</span></div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {sale.items && sale.items.map(item => (
                                    <label key={item.sku} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                                      <input
                                        type="checkbox"
                                        checked={selectedSales[sale.id]?.selectedProducts?.includes(item.sku) || false}
                                        onChange={e => handleProductSelect(sale.id, item.sku, e.target.checked)}
                                        disabled={!selectedSales[sale.id]}
                                      />
                                      {item.product} ({item.barcode}) (BDT {item.retail_price})
                                    </label>
                                  ))}
                                </div>
                              </div>
                              {selectedSales[sale.id] && (
                                <input
                                  type="number"
                                  className="border rounded p-2 w-24 ml-2"
                                  placeholder="Amount"
                                  min={0.01}
                                  max={saleDue}
                                  step="0.01"
                                  value={selectedSales[sale.id].amount}
                                  onChange={e => handleSaleAmount(sale.id, e.target.value)}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {/* Payment Form */}
                <form onSubmit={handlePayment} className="mb-6">
                  <div className="flex flex-col md:flex-row gap-4 mb-2">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold mb-1">Payment Method *</label>
                      <select
                        className="border rounded p-2 w-full"
                        value={method}
                        onChange={e => setMethod(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">Select payment method</option>
                        <option value="Cash">Cash</option>
                        <option value="MFS">MFS</option>
                        <option value="Card">Card</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  {/* Reference field for MFS, Card, Other */}
                  {["MFS", "Card", "Other"].includes(method) && (
                    <div className="mb-2">
                      <label className="block text-sm font-semibold mb-1">Reference *</label>
                      <input
                        className="border rounded p-2 w-full"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="block text-sm font-semibold mb-1">Notes (Optional)</label>
                    <textarea
                      className="border rounded p-2 w-full"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-green-500 text-white px-6 py-2 rounded w-full font-semibold mt-2"
                    disabled={loading || totalDue <= 0}
                  >
                    Record Payment
                  </button>
                </form>
                {/* Payment History */}
                <div>
                  <div className="font-semibold mb-2 flex items-center gap-2"><FiCheckCircle /> Recent Adjustments</div>
                  {payments.length === 0 ? (
                    <div className="text-gray-400 text-sm">No payments found.</div>
                  ) : (
                    <ul className="divide-y">
                      {[payments[0]].filter(Boolean).map((p, idx) => (
                        <li key={p.id} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{customer.customerName} <span className="bg-gray-100 text-xs px-2 py-1 rounded ml-2">payment</span></div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              {p.timestamp && new Date(p.timestamp.seconds * 1000).toLocaleString()} | {p.method} <span>{p.method === 'MFS' ? '📱' : p.method === 'Cash' ? '💵' : p.method === 'Card' ? <FiCreditCard className="inline" /> : ''}</span>
                              {p.reference && <span className="ml-2">Ref: {p.reference}</span>}
                              {p.createdBy && <span className="ml-2">By: {p.createdBy}</span>}
                            </div>
                            {p.notes && <div className="italic text-xs text-gray-600 mt-1">{p.notes}</div>}
                            {p.salesPaid && (
                              <div className="text-xs text-gray-500 mt-1">
                                Paid for: {p.salesPaid.map(sp => {
                                  const sale = dueSales.find(s => s.id === sp.saleId);
                                  const remaining = sale ? getSaleRemainingAfterPayment(sp.saleId, idx) : 0;
                                  return `Invoice: ${sp.saleId} (৳${sp.amount}) [Remaining: ৳${remaining.toFixed(2)}]`;
                                }).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-green-600 font-bold text-lg">৳{parseFloat(p.amount).toFixed(2)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Summary */}
                  <div className="bg-blue-50 rounded p-3 mt-4 flex gap-8">
                    <div> <span className="font-semibold">Total Payments:</span> ৳{payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toFixed(2)}</div>
                    <div> <span className="font-semibold">Transactions:</span> {payments.length}</div>
                    <div> <span className="font-semibold">Total Remaining Due:</span> ৳{totalDue.toFixed(2)}</div>
                  </div>
                </div>
                </>
              )}
              {tab === 'history' && (
                <div>
                  <div className="font-semibold mb-2 flex items-center gap-2"><FiCheckCircle /> Adjustment History</div>
                  {payments.length === 0 ? (
                    <div className="text-gray-400 text-sm">No payments found.</div>
                  ) : (
                    <ul className="divide-y">
                      {payments.map((p, idx) => (
                        <li key={p.id} className="py-3">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                              <div className="font-semibold">{customer.customerName} <span className="bg-gray-100 text-xs px-2 py-1 rounded ml-2">payment</span></div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                {p.timestamp && new Date(p.timestamp.seconds * 1000).toLocaleString()} | {p.method} <span>{p.method === 'MFS' ? '📱' : p.method === 'Cash' ? '💵' : p.method === 'Card' ? <FiCreditCard className="inline" /> : ''}</span>
                                {p.reference && <span className="ml-2">Ref: {p.reference}</span>}
                                {p.createdBy && <span className="ml-2">By: {p.createdBy}</span>}
                              </div>
                              {p.notes && <div className="italic text-xs text-gray-600 mt-1">{p.notes}</div>}
                              {p.salesPaid && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Paid for: {p.salesPaid.map(sp => {
                                    const sale = dueSales.find(s => s.id === sp.saleId);
                                    const remaining = sale ? getSaleRemainingAfterPayment(sp.saleId, idx) : 0;
                                    return `Invoice: ${sp.saleId} (৳${sp.amount}) [Remaining: ৳${remaining.toFixed(2)}]`;
                                  }).join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="text-green-600 font-bold text-lg">৳{parseFloat(p.amount).toFixed(2)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Summary */}
                  <div className="bg-blue-50 rounded p-3 mt-4 flex gap-8">
                    <div> <span className="font-semibold">Total Payments:</span> ৳{payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toFixed(2)}</div>
                    <div> <span className="font-semibold">Transactions:</span> {payments.length}</div>
                    <div> <span className="font-semibold">Total Remaining Due:</span> ৳{totalDue.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center h-[70vh] overflow-y-auto text-gray-400">
              <FiUser className="text-6xl mb-4" />
              <div className="text-xl font-semibold">No Customer Selected</div>
              <div className="text-sm">Please search and select a customer to record payment adjustments.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Customer_Due;