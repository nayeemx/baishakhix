import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, where, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import Loader from '../Loader';
import { FiSearch, FiChevronLeft, FiChevronRight, FiX, FiHash, FiEdit } from 'react-icons/fi';
import EditmanualStock from './EditmanualStock';
import { useSelector } from 'react-redux';
import { collection as fsCollection, getDocs as fsGetDocs, query as fsQuery, where as fsWhere, doc as fsDoc, setDoc as fsSetDoc, deleteDoc as fsDeleteDoc, serverTimestamp } from 'firebase/firestore';

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
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState(null);
  const [userFilter, setUserFilter] = useState('');
  const [userSlots, setUserSlots] = useState([]);
  const [assignedUserSlot, setAssignedUserSlot] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Assign user slot based on Firestore users collection (non-'user' roles)
  useEffect(() => {
    async function assignSlot() {
      if (!user || !user.email) return;
      // Fetch all users with role !== 'user'
      const q = fsQuery(fsCollection(firestore, 'users'), fsWhere('role', '!=', 'user'));
      const snap = await fsGetDocs(q);
      const nonUserRoles = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Sort by createdAt (or fallback to email)
      nonUserRoles.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return a.email.localeCompare(b.email);
      });
      // Assign slots
      const slotMap = {};
      nonUserRoles.forEach((u, idx) => {
        slotMap[u.email] = `uesr${idx + 1}`;
      });
      // Find current user's slot
      const slot = slotMap[user.email] || '';
      setAssignedUserSlot(slot);
      // For dropdown, show all slots present in manual_product data
      const uniqueSlots = Array.from(new Set(allProducts.map(p => p.users).filter(Boolean)));
      setUserSlots(uniqueSlots);
      setUserFilter(slot); // Default to your assigned slot
    }
    assignSlot();
  }, [user, allProducts]);

  // Handler to refresh products after edit
  const handleEditModalClose = (shouldRefresh = false) => {
    setEditModalOpen(false);
    setEditProduct(null);
    if (shouldRefresh) {
      setRefreshFlag(f => !f); // Toggle to trigger useEffect
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms debounce
    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Use debouncedSearch in filter logic
  const searchValue = debouncedSearch.trim();
  console.log('All products:', allProducts);
  console.log('Search value:', searchValue, 'Search field:', searchField);

  // Add debug log to filter
  console.log('Filtering with user:', userFilter, 'searchField:', searchField, 'searchValue:', searchValue);
  const filteredProducts = allProducts.filter(product => {
    if (userFilter && product.users !== userFilter) return false;
    const barcode = product.barcode !== undefined && product.barcode !== null ? String(product.barcode) : '';
    const sku = product.sku ? String(product.sku).toLowerCase() : '';
    const name = product.name ? String(product.name).toLowerCase() : '';
    if (searchField === 'barcode' && searchValue) {
      return barcode.includes(searchValue);
    } else if (searchField === 'sku' && searchValue) {
      return sku.includes(searchValue.toLowerCase());
    } else if (searchField === 'name' && searchValue) {
      return name.includes(searchValue.toLowerCase());
    }
    return true;
  });

  const pageSize = 50;
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  // Handler to open image modal
  const handleImageClick = (imgUrl) => {
    console.log('Image clicked:', imgUrl);
    setModalImageUrl(imgUrl);
    setImageModalOpen(true);
  };

  // Handler to close image modal
  const handleCloseImageModal = () => {
    setImageModalOpen(false);
    setModalImageUrl(null);
  };

  // Handler to open delete modal
  const handleDeleteClick = (row) => {
    setDeleteProduct(row);
    setDeleteReason('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  // Handler to confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteReason.trim()) {
      setDeleteError('Delete reason is required.');
      return;
    }
    setDeleteLoading(true);
    try {
      // Move to manual_product_deleted
      const deletedDoc = { ...deleteProduct, delete_reason: deleteReason, deleted_at: serverTimestamp() };
      await fsSetDoc(fsDoc(firestore, 'manual_product_deleted', deleteProduct.id), deletedDoc);
      // Delete from manual_product
      await fsDeleteDoc(fsDoc(firestore, 'manual_product', deleteProduct.id));
      setDeleteModalOpen(false);
      setDeleteProduct(null);
      setRefreshFlag(f => !f); // Refresh table
    } catch (err) {
      setDeleteError('Failed to delete record.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!open) return null;

  // Add debug log to modal rendering
  if (imageModalOpen) {
    console.log('Modal open with image:', modalImageUrl);
  }

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
              <option value="name">Name</option>
            </select>
            <select
              className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-300"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            >
              <option value="">All Users</option>
              {userSlots.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
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
                  <th className="p-2 font-semibold text-blue-700">Image</th>
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
                    <td colSpan={8} className="text-center text-gray-400 py-8">No data found.</td>
                  </tr>
                ) : (
                  paginatedProducts.map((row, i) => (
                    <tr key={row.id || i} className="border-b hover:bg-blue-50 transition">
                      <td className="p-2">
                        {row.url && (
                          <img
                            src={row.url}
                            alt={row.name || 'Image'}
                            className="h-10 w-10 object-cover rounded cursor-pointer border border-gray-200"
                            onClick={() => handleImageClick(row.url)}
                          />
                        )}
                      </td>
                      <td className="p-2 font-mono text-blue-900">{String(row.barcode)}</td>
                      <td className="p-2 font-mono text-blue-900">{row.sku}</td>
                      <td className="p-2 text-blue-900">{row.qty}</td>
                      <td className="p-2 text-blue-900">{row.costing}</td>
                      <td className="p-2 text-blue-900">{row.total_costing}</td>
                      <td className="p-2 text-blue-900">{row.count_stock}</td>
                      <td className="p-2 flex gap-2">
                        <button
                          className={`text-blue-600 hover:text-blue-900 bg-blue-50 border border-blue-200 rounded p-1 flex items-center gap-1 shadow-sm ${row.users !== assignedUserSlot ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={row.users === assignedUserSlot ? 'Edit' : 'You can only edit records assigned to you'}
                          onClick={() => {
                            if (row.users === assignedUserSlot) {
                              setEditProduct(row);
                              setEditModalOpen(true);
                            }
                          }}
                          disabled={row.users !== assignedUserSlot}
                        >
                          <FiEdit /> Edit
                        </button>
                        <button
                          className={`text-red-600 hover:text-red-900 bg-red-50 border border-red-200 rounded p-1 flex items-center gap-1 shadow-sm ${row.users !== assignedUserSlot ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={row.users === assignedUserSlot ? 'Delete' : 'You can only delete records assigned to you'}
                          onClick={() => {
                            if (row.users === assignedUserSlot) {
                              handleDeleteClick(row);
                            }
                          }}
                          disabled={row.users !== assignedUserSlot}
                        >
                          <FiX /> Delete
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
        {/* Image Modal */}
        {imageModalOpen && (
          <>
            {console.log('Modal open with image:', modalImageUrl)}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
              <div
                className="bg-white rounded-lg shadow-lg p-4 relative flex flex-col"
                style={{ maxHeight: '98vh', overflowY: 'auto' }}
              >
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-2xl"
                  onClick={handleCloseImageModal}
                  title="Close"
                >
                  &times;
                </button>
                <img
                  src={modalImageUrl}
                  alt="Full Size"
                  className="max-h-[90vh] max-w-full object-contain mx-auto"
                  style={{ display: 'block' }}
                />
              </div>
            </div>
          </>
        )}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-2xl font-bold"
                onClick={() => setDeleteModalOpen(false)}
                type="button"
                title="Close"
              >
                <FiX />
              </button>
              <h2 className="text-xl font-bold mb-4 text-red-700 flex items-center gap-2"><FiX /> Delete Record</h2>
              <div className="mb-4">Please provide a reason for deleting this record:</div>
              <textarea
                className="border rounded px-3 py-2 w-full min-h-[80px] focus:ring-2 focus:ring-red-300"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Enter reason (required)"
                disabled={deleteLoading}
              />
              {deleteError && <div className="text-red-600 mt-2">{deleteError}</div>}
              <div className="flex gap-2 mt-6 justify-end">
                <button
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteLoading}
                >Cancel</button>
                <button
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 border border-red-700"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                >{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowmanualStock;