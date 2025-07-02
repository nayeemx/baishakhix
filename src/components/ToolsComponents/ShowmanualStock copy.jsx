import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, where, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import Loader from '../Loader';
import { FiSearch, FiChevronLeft, FiChevronRight, FiX, FiHash, FiEdit } from 'react-icons/fi';
import EditmanualStock from './EditmanualStock';
import { useSelector } from 'react-redux';

const PAGE_SIZE = 50;

const ShowmanualStock = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('barcode');
  const [pageInput, setPageInput] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [refreshFlag, setRefreshFlag] = useState(false); // Used to trigger refresh after edit
  const tableRef = useRef();
  const user = useSelector((state) => state.auth.user); // Get user from Redux
  const pageCursorsRef = useRef([]); // Use ref for page cursors
  const [allProducts, setAllProducts] = useState([]);

  // Fetch current user's name from users table
  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(firestore, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          setCurrentUserName(snap.data().name || '');
        }
      });
    }
  }, [user]);

  // Fetch all products when modal opens or refreshFlag changes
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setLoading(true);
    getDocs(query(collection(firestore, 'manual_product'), orderBy('barcode')))
      .then(snap => {
        if (ignore) return;
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllProducts(docs);
        setTotalCount(docs.length);
        setPage(1); // Reset to first page on open
      })
      .catch(() => setAllProducts([]))
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [open, refreshFlag]);

  // Handler to refresh products after edit
  const handleEditModalClose = (shouldRefresh = false) => {
    setEditModalOpen(false);
    setEditProduct(null);
    if (shouldRefresh) {
      setRefreshFlag(f => !f); // Toggle to trigger useEffect
    }
  };

  // Search filter (client-side, after fetching products)
  const searchValue = search.trim();
  console.log('All products:', allProducts);
  console.log('Search value:', searchValue, 'Search field:', searchField);

  const filteredProducts = allProducts.filter(product => {
    const barcode = product.barcode !== undefined && product.barcode !== null ? String(product.barcode) : '';
    const sku = product.sku ? String(product.sku).toLowerCase() : '';
    if (searchField === 'barcode' && searchValue) {
      const result = barcode.includes(searchValue);
      console.log('Checking barcode:', barcode, 'against', searchValue, '->', result);
      return result;
    } else if (searchField === 'sku' && searchValue) {
      const result = sku.includes(searchValue.toLowerCase());
      console.log('Checking sku:', sku, 'against', searchValue.toLowerCase(), '->', result);
      return result;
    }
    return true;
  });

  const pageSize = 50;
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl relative max-h-[90vh] flex flex-col border border-gray-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xl font-bold text-blue-700">
            <FiHash className="text-blue-500" /> Manual Product Stock
            <span className="ml-2 text-xs font-normal text-gray-500">({totalCount} records)</span>
          </div>
          <button
            className="text-gray-400 hover:text-red-500 text-3xl p-1 rounded-full transition"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <FiX />
          </button>
        </div>
        {/* Search and Controls */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b">
          <div className="flex items-center gap-2">
            <select
              className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-300"
              value={searchField}
              onChange={e => setSearchField(e.target.value)}
            >
              <option value="barcode">Barcode</option>
              <option value="sku">SKU</option>
            </select>
            <div className="relative">
              <input
                className="border rounded pl-8 pr-2 py-1 focus:ring-2 focus:ring-blue-300 w-48"
                placeholder={`Search by ${searchField}`}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
              onClick={() => setSearch('')}
              disabled={!search}
            >Clear</button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              className="px-2 py-1 rounded bg-gray-100 hover:bg-blue-100 border border-gray-200 text-blue-700 flex items-center gap-1"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              title="Previous Page"
            >
              <FiChevronLeft /> Prev
            </button>
            <span className="text-gray-600">Page</span>
            <input
              type="number"
              min={1}
              max={Math.ceil(totalCount / PAGE_SIZE)}
              value={pageInput || page}
              onChange={e => setPageInput(e.target.value)}
              onBlur={() => {
                const num = parseInt(pageInput, 10);
                if (num && num >= 1 && num <= Math.ceil(totalCount / PAGE_SIZE)) setPage(num);
                setPageInput('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const num = parseInt(pageInput, 10);
                  if (num && num >= 1 && num <= Math.ceil(totalCount / PAGE_SIZE)) setPage(num);
                  setPageInput('');
                }
              }}
              className="border rounded px-2 py-1 w-16 text-center focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-gray-600">/ {Math.ceil(totalCount / PAGE_SIZE)}</span>
            <button
              className="px-2 py-1 rounded bg-gray-100 hover:bg-blue-100 border border-gray-200 text-blue-700 flex items-center gap-1"
              onClick={() => setPage(p => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
              disabled={page === Math.ceil(totalCount / PAGE_SIZE) || loading}
              title="Next Page"
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-y-auto" ref={tableRef}>
          {loading ? (
            <Loader />
          ) : (
            <table className="min-w-full text-xs border">
              <thead className="sticky top-0 z-10 bg-blue-50 shadow-sm">
                <tr className="bg-blue-100">
                  <th className="p-2 font-semibold text-blue-700">Barcode</th>
                  <th className="p-2 font-semibold text-blue-700">SKU</th>
                  <th className="p-2 font-semibold text-blue-700">Qty</th>
                  <th className="p-2 font-semibold text-blue-700">Costing</th>
                  <th className="p-2 font-semibold text-blue-700">Total Costing</th>
                  <th className="p-2 font-semibold text-blue-700">Count Stock</th>
                  <th className="p-2 font-semibold text-blue-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-8">No data found.</td>
                  </tr>
                ) : (
                  paginatedProducts.map((row, i) => (
                    <tr key={row.id || i} className="border-b hover:bg-blue-50 transition">
                      <td className="p-2 font-mono text-blue-900">{String(row.barcode)}</td>
                      <td className="p-2 font-mono text-blue-900">{row.sku}</td>
                      <td className="p-2 text-blue-900">{row.qty}</td>
                      <td className="p-2 text-blue-900">{row.costing}</td>
                      <td className="p-2 text-blue-900">{row.total_costing}</td>
                      <td className="p-2 text-blue-900">{row.count_stock}</td>
                      <td className="p-2">
                        <button
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 border border-blue-200 rounded p-1 flex items-center gap-1 shadow-sm"
                          title="Edit"
                          onClick={() => { setEditProduct(row); setEditModalOpen(true); }}
                        >
                          <FiEdit /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-2 text-xs text-gray-500 text-center border-t bg-blue-50 rounded-b-2xl">Showing {products.length} of {totalCount} records.</div>
        {editModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-2xl font-bold"
                onClick={() => handleEditModalClose(true)}
                type="button"
                title="Close"
              >
                <FiX />
              </button>
              <EditmanualStock product={editProduct} onClose={() => handleEditModalClose(true)} currentUser={{ name: currentUserName }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowmanualStock;