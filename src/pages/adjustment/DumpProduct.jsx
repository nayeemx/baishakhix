import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  addDoc,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { firestore } from '../../firebase/firebase.config';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiPackage, FiCheckCircle } from 'react-icons/fi';
import { BsExclamationTriangle } from 'react-icons/bs';
import { AiOutlineDelete } from 'react-icons/ai';
import { usePermissions } from '../../utils/permissions';

const PAGE_SIZE = 25;

const TABS = [
  { label: 'All Products', value: 'all' },
  { label: 'Expired Only', value: 'expired' },
  { label: 'Good Condition', value: 'good' },
  { label: 'Dumped', value: 'dumped' },
];

const DUMPED_COLUMNS = [
  { label: 'Product Name', key: 'product' },
  { label: 'SKU', key: 'sku' },
  { label: 'Barcode', key: 'barcode' },
  { label: 'Dumped Qty', key: 'dumped_quantity' },
  { label: 'Reason', key: 'reason' },
  { label: 'Dumped By', key: 'dumped_by_name' },
  { label: 'Dumped At', key: 'dumped_at' },
  { label: 'Category', key: 'product_category' },
  { label: 'Cost Price', key: 'total_price' },
];

const PRODUCT_COLUMNS = [
  { label: 'Status', key: 'isExpired' },
  { label: 'Product Name', key: 'product' },
  { label: 'SKU', key: 'sku' },
  { label: 'Barcode', key: 'barcode' },
  { label: 'Quantity', key: 'quantity' },
  { label: 'Dumped Qty', key: 'dumpedQty' },
  { label: 'MFG Date', key: 'manufacture_date' },
  { label: 'EXP Date', key: 'expiry_date' },
  { label: 'Category', key: 'product_category' },
  { label: 'Cost Price', key: 'total_price' },
  { label: 'Actions', key: 'actions' },
];

const DumpProduct = () => {
  const user = useSelector((state) => state.auth.user);
  const { canCreate, canEdit, canDelete } = usePermissions();
  // (No page-blocking check! Always render the page)
  const [products, setProducts] = useState([]);
  const [dumpedMap, setDumpedMap] = useState({}); // product_id -> total dumped
  const [dumpedRecords, setDumpedRecords] = useState([]); // all dump_product records
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dumpQuantity, setDumpQuantity] = useState(1);
  const [dumpReason, setDumpReason] = useState('');
  const [summary, setSummary] = useState({
    total: 0,
    good: 0,
    expired: 0,
    dumped: 0,
  });
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Centralized fetch function
  const fetchProducts = async () => {
    setLoading(true);
    const productSnapshot = await getDocs(collection(firestore, 'products'));
    const dumpSnapshot = await getDocs(collection(firestore, 'dump_product'));

    const productList = [];
    let expired = 0;
    const dumpedMapTemp = {};
    const dumpedRecordsTemp = [];

    dumpSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.product_id) {
        dumpedMapTemp[data.product_id] = (dumpedMapTemp[data.product_id] || 0) + (Number(data.dumped_quantity) || 0);
      }
      dumpedRecordsTemp.push({ ...data, id: doc.id });
    });

    productSnapshot.forEach((doc) => {
      const data = doc.data();
      let isExpired = false;
      if (data.expiry_date) {
        const exp = new Date(data.expiry_date);
        if (!isNaN(exp) && exp < new Date()) isExpired = true;
      }
      if (isExpired) expired++;
      productList.push({ ...data, id: doc.id, isExpired });
    });

    setProducts(productList);
    setDumpedMap(dumpedMapTemp);
    setDumpedRecords(dumpedRecordsTemp);
    setSummary({
      total: productList.length,
      good: productList.length - expired,
      expired,
      dumped: dumpSnapshot.size,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtering and search
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (activeTab === 'expired') {
      filtered = filtered.filter((p) => p.isExpired);
    } else if (activeTab === 'good') {
      filtered = filtered.filter((p) => !p.isExpired);
    } else if (activeTab === 'dumped') {
      filtered = products;
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.product && p.product.toLowerCase().includes(s)) ||
          (p.sku && p.sku.toLowerCase().includes(s)) ||
          (p.barcode && String(p.barcode).toLowerCase().includes(s))
      );
    }
    return filtered;
  }, [products, activeTab, search]);

  // Filtering and search for dumped records
  const filteredDumpedRecords = useMemo(() => {
    let filtered = dumpedRecords;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.product && d.product.toLowerCase().includes(s)) ||
          (d.sku && d.sku.toLowerCase().includes(s)) ||
          (d.barcode && String(d.barcode).toLowerCase().includes(s))
      );
    }
    return filtered;
  }, [dumpedRecords, search]);

  // Pagination
  const totalPages = useMemo(() => {
    if (activeTab === 'dumped') {
      return Math.max(1, Math.ceil(filteredDumpedRecords.length / PAGE_SIZE));
    }
    return Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  }, [filteredProducts, filteredDumpedRecords, activeTab]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const paginatedDumpedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDumpedRecords.slice(start, start + PAGE_SIZE);
  }, [filteredDumpedRecords, page]);

  // Reset page if filter/search or tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const handleDumpClick = (product) => {
    setSelectedProduct(product);
    setDumpQuantity(1);
    setDumpReason('');
    setModalOpen(true);
  };

  const handleDumpSubmit = async () => {
    if (!canCreate('DumpProduct')) {
      toast.error('You do not have permission to dump products.');
      return;
    }
    if (!selectedProduct || !dumpReason || dumpQuantity < 1) return;
    try {
      // 1. Fetch full user info from users collection
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      // 2. Combine product and user data
      const dumpData = {
        ...selectedProduct,
        product_id: selectedProduct.id,
        dumped_quantity: dumpQuantity,
        reason: dumpReason,
        dumped_at: new Date().toISOString(),
        dumped_by_uid: user?.uid,
        dumped_by_name: user?.name || user?.displayName || user?.email,
        type: 'dump_product',
        user_info: userData, // nested user info
      };

      // 3. Add to delete_traces
      await addDoc(collection(firestore, 'delete_traces'), dumpData);

      // 4. Delete from products
      const productRef = doc(firestore, 'products', selectedProduct.id);
      await deleteDoc(productRef);

      toast.success(`Successfully dumped ${dumpQuantity} units of ${selectedProduct.product}`);
      setModalOpen(false);
      setSelectedProduct(null);
      await fetchProducts();
    } catch (err) {
      toast.error('Failed to dump product: ' + err.message);
      console.error('Dump error:', err);
    }
  };

  // Pagination controls
  const goToPage = (p) => {
    const pageNum = Math.max(1, Math.min(totalPages, Number(p)));
    setPage(pageNum);
  };

  // Modern summary cards with icons
  const summaryCards = [
    {
      label: 'Total Products',
      icon: <FiPackage className="text-blue-500 bg-blue-100 rounded-full p-2" size={36} />,
      value: summary.total,
    },
    {
      label: 'Good Condition',
      icon: <FiCheckCircle className="text-green-500 bg-green-100 rounded-full p-2" size={36} />,
      value: summary.good,
    },
    {
      label: 'Expired',
      icon: <BsExclamationTriangle className="text-orange-500 bg-orange-100 rounded-full p-2" size={36} />,
      value: summary.expired,
    },
    {
      label: 'Dumped',
      icon: <AiOutlineDelete className="text-gray-500 bg-gray-100 rounded-full p-2" size={36} />,
      value: summary.dumped,
    },
  ];

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      <h1 className="text-3xl font-bold mb-2 text-red-600 flex items-center gap-2">
        <span role="img" aria-label="dumpster">🗑️</span> Product Dumpster Fire Fighter
      </h1>
      <p className="mb-6 text-gray-600">Manage and dump expired or damaged products from your inventory</p>

      {/* Modern Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card, idx) => (
          <div key={idx} className="bg-white shadow rounded p-4 flex flex-col items-center">
            {card.icon}
            <div className="text-lg font-semibold mt-2">{card.label}</div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={`px-4 py-2 rounded font-semibold border transition focus:outline-none ${
                activeTab === tab.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="border rounded px-3 py-2 flex-1 min-w-[220px]"
          placeholder="Search by product name, SKU, or barcode"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product Table or Dumped Table */}
      <div className="bg-white shadow rounded p-4 overflow-x-auto">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Products Inventory</div>
          <div className="text-sm text-red-500">
            {summary.expired > 0 ? `${summary.expired} expired products need attention` : ''}
          </div>
        </div>
        {activeTab === 'dumped' ? (
          <>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {DUMPED_COLUMNS.map((col) => (
                    <th key={col.key} className="p-2">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={DUMPED_COLUMNS.length} className="text-center p-4">Loading...</td></tr>
                ) : paginatedDumpedRecords.length === 0 ? (
                  <tr><td colSpan={DUMPED_COLUMNS.length} className="text-center p-4">No dumped records found.</td></tr>
                ) : (
                  paginatedDumpedRecords.map((record) => (
                    <tr key={record.id} className="border-b">
                      <td className="p-2">{record.product}</td>
                      <td className="p-2">{record.sku}</td>
                      <td className="p-2">{record.barcode}</td>
                      <td className="p-2">{record.dumped_quantity}</td>
                      <td className="p-2">{record.reason}</td>
                      <td className="p-2">{record.dumped_by_name}</td>
                      <td className="p-2">{record.dumped_at ? new Date(record.dumped_at).toLocaleString() : ''}</td>
                      <td className="p-2">{record.product_category}</td>
                      <td className="p-2">${Number(record.total_price).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Pagination Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mt-4 gap-2">
              <div className="text-sm text-gray-500">
                {filteredDumpedRecords.length} dumped records shown | Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                >First</button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >Previous</button>
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={e => goToPage(e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-center"
                />
                <span>of {totalPages}</span>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >Next</button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages}
                >Last</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {PRODUCT_COLUMNS.map((col) => (
                    <th key={col.key} className="p-2">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={PRODUCT_COLUMNS.length} className="text-center p-4">Loading...</td></tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr><td colSpan={PRODUCT_COLUMNS.length} className="text-center p-4">No products found.</td></tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const dumpedQty = dumpedMap[product.id] || 0;
                    const fullyDumped = dumpedQty >= (Number(product.quantity) + dumpedQty);
                    return (
                      <tr key={product.id} className="border-b">
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${product.isExpired ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {product.isExpired ? 'Expired' : 'Good'}
                          </span>
                        </td>
                        <td className="p-2">{product.product}</td>
                        <td className="p-2">{product.sku}</td>
                        <td className="p-2">{product.barcode}</td>
                        <td className="p-2">{product.quantity}</td>
                        <td className="p-2">{dumpedQty}</td>
                        <td className="p-2">{product.manufacture_date || '—'}</td>
                        <td className="p-2">{product.expiry_date || '—'}</td>
                        <td className="p-2">{product.product_category}</td>
                        <td className="p-2">${Number(product.total_price).toLocaleString()}</td>
                        <td className="p-2">
                          {activeTab === 'dumped' && dumpedQty >= (Number(product.quantity) + dumpedQty) ? (
                            <span className="text-xs text-gray-400 font-semibold">Already dumped</span>
                          ) : (
                            <button
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                              onClick={() => handleDumpClick(product)}
                              disabled={!canCreate('DumpProduct') || dumpedQty >= (Number(product.quantity) + dumpedQty)}
                              title={!canCreate('DumpProduct') ? 'You do not have permission to dump products.' : ''}
                            >
                              Dump
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {/* Pagination Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mt-4 gap-2">
              <div className="text-sm text-gray-500">
                {filteredProducts.length} products shown | Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(1)}
                  disabled={page === 1}
                >First</button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >Previous</button>
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={e => goToPage(e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-center"
                />
                <span>of {totalPages}</span>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >Next</button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-50"
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages}
                >Last</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dump Modal */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setModalOpen(false)}
            >&times;</button>
            <h2 className="text-xl font-bold mb-2">Dump Product</h2>
            <div className="mb-2"><b>Product:</b> {selectedProduct.product}</div>
            <div className="mb-2"><b>SKU:</b> {selectedProduct.sku}</div>
            <div className="mb-2"><b>Available Quantity:</b> {selectedProduct.quantity}</div>
            <div className="mb-2">
              <label className="block mb-1 font-semibold">Quantity to Dump</label>
              <input
                type="number"
                min={1}
                max={selectedProduct.quantity}
                value={dumpQuantity}
                onChange={e => setDumpQuantity(Math.max(1, Math.min(selectedProduct.quantity, Number(e.target.value))))}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block mb-1 font-semibold">Reason</label>
              <textarea
                value={dumpReason}
                onChange={e => setDumpReason(e.target.value)}
                className="border rounded px-2 py-1 w-full"
                rows={2}
                placeholder="Enter reason for dumping..."
              />
            </div>
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full mt-2"
              onClick={handleDumpSubmit}
              disabled={!canCreate('DumpProduct') || !dumpReason || dumpQuantity < 1}
              title={!canCreate('DumpProduct') ? 'You do not have permission to dump products.' : ''}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DumpProduct;