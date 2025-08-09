import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, updateDoc, getDoc, addDoc, runTransaction, doc as firestoreDoc } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import GenericDeleteComponent from "../../components/GenericDeleteComponent";
import { useSelector } from "react-redux";
import ViewSupplier from "../../components/PeopleComponent/ViewSupplier";
import AppLoader from "../../components/AppLoader";
import Loader from "../../components/Loader";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { FaEdit, FaTrash, FaFileInvoiceDollar } from 'react-icons/fa';
import { usePermissions, PERMISSION_PAGES } from "../../utils/permissions";

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // For edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [editForm, setEditForm] = useState({ supplier_name: "", address: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);

  // For delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [deleteBlockMsg, setDeleteBlockMsg] = useState("");
  const currentUser = useSelector(state => state.auth?.user);
  const { canCreate, canEdit, canDelete } = usePermissions();

  // For view modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [viewProducts, setViewProducts] = useState([]);
  const [viewProductsLoading, setViewProductsLoading] = useState(false);
  const [viewSearch, setViewSearch] = useState("");
  const [viewFilteredProducts, setViewFilteredProducts] = useState([]);

  // New state for search
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);

  // Add state for add modal and form
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ supplier_name: '', address: '', phone: '' });
  const [addSaving, setAddSaving] = useState(false);

  // Fetch all suppliers on mount
  useEffect(() => {
    setLoading(true);
    getDocs(collection(firestore, "supplier_list"))
      .then((snap) => {
        setSuppliers(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch products for selected supplier (for view modal)
  useEffect(() => {
    if (viewOpen && viewSupplier) {
      setViewProductsLoading(true);
      getDocs(
        query(
          collection(firestore, "products"),
          where("supplier_id", "==", viewSupplier.id)
        )
      ).then((snap) => {
        const prods = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setViewProducts(prods);
        setViewFilteredProducts(prods);
        setViewProductsLoading(false);
      });
    }
  }, [viewOpen, viewSupplier]);

  // Filter products by bill_number in view modal
  useEffect(() => {
    if (!viewSearch.trim()) {
      setViewFilteredProducts(viewProducts);
    } else {
      setViewFilteredProducts(
        viewProducts.filter(
          (p) =>
            (p.bill_number || "")
              .toLowerCase()
              .includes(viewSearch.trim().toLowerCase())
        )
      );
    }
  }, [viewSearch, viewProducts]);

  // Filter suppliers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSuppliers(suppliers);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = suppliers.filter(supplier => 
      supplier.supplier_name?.toLowerCase().includes(query) ||
      supplier.address?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.id?.toLowerCase().includes(query)
    );
    setFilteredSuppliers(filtered);
  }, [searchQuery, suppliers]);

  // Fetch products for selected supplier
  const handleSupplierClick = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowModal(true);
    setProductsLoading(true);
    const q = query(
      collection(firestore, "products"),
      where("supplier_id", "==", supplier.id)
    );
    const snap = await getDocs(q);
    setProducts(
      snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
    setProductsLoading(false);
  };

  // Handle edit
  const handleEditClick = (supplier) => {
    setEditSupplier(supplier);
    setEditForm({
      supplier_name: supplier.supplier_name || "",
      address: supplier.address || "",
      phone: supplier.phone || "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      // Defensive: check for valid Firestore doc ID
      if (!editSupplier?.id) {
        alert("Invalid supplier ID.");
        setEditSaving(false);
        return;
      }
      // If supplier id is changed, update both supplier_list and all products with the new id
      const newId = editForm.id?.trim() || editSupplier.id;
      const supplierDocRef = doc(firestore, "supplier_list", editSupplier.id);
      const docSnap = await getDoc(supplierDocRef);
      let updatedId = editSupplier.id;

      if (!docSnap.exists()) {
        // Try to find the correct doc by searching for the supplier_name (fallback)
        const snap = await getDocs(
          query(
            collection(firestore, "supplier_list"),
            where("supplier_name", "==", editSupplier.supplier_name)
          )
        );
        if (!snap.empty) {
          const foundDoc = snap.docs[0];
          updatedId = foundDoc.id;
          // Update supplier_list with new id field (not doc id)
          await updateDoc(foundDoc.ref, {
            supplier_name: editForm.supplier_name,
            address: editForm.address,
            phone: editForm.phone,
            id: newId
          });
        } else {
          alert("Supplier not found. It may have been deleted.");
          setEditSaving(false);
          return;
        }
      } else {
        // Update supplier_list with new id field (not doc id)
        await updateDoc(supplierDocRef, {
          supplier_name: editForm.supplier_name,
          address: editForm.address,
          phone: editForm.phone,
          id: newId
        });
      }

      // If supplier id was changed, update all products with the old supplier_id to the new one
      if (editSupplier.id !== newId) {
        const productsSnap = await getDocs(
          query(
            collection(firestore, "products"),
            where("supplier_id", "==", editSupplier.id)
          )
        );
        await Promise.all(
          productsSnap.docs.map((productDoc) =>
            updateDoc(productDoc.ref, { supplier_id: newId })
          )
        );
      }

      // Refetch suppliers from Firestore to ensure UI is in sync
      const snap = await getDocs(collection(firestore, "supplier_list"));
      setSuppliers(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      );
      // Update viewSupplier with the correct id after edit
      setViewSupplier((prev) =>
        prev && prev.id === editSupplier.id
          ? { ...prev, ...editForm, id: newId }
          : prev
      );
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  // Handle delete
  const handleDeleteClick = async (supplier) => {
    // Check if supplier has products
    const q = query(
      collection(firestore, "products"),
      where("supplier_id", "==", supplier.id)
    );
    const snap = await getDocs(q);
    if (snap.size > 0) {
      setDeleteBlocked(true);
      setDeleteBlockMsg("Cannot delete supplier: products exist for this supplier.");
      setDeleteOpen(true);
      setDeleteId(null);
    } else {
      setDeleteBlocked(false);
      setDeleteOpen(true);
      setDeleteId(supplier.id);
    }
  };

  const exportSuppliersAsCSV = () => {
    const csv = Papa.unparse(suppliers.map(s => ({
      "Supplier Name": s.supplier_name,
      "Address": s.address,
      "Phone": s.phone,
      "Supplier ID": s.id
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `supplier-list-${new Date().toLocaleDateString()}.csv`);
  };

  return (
    <div className="p-6 w-[104vw] xl:w-[82vw]">
      <h1 className="text-2xl font-bold mb-6">Supplier List</h1>
      
      <div className="flex flex-col md:flex-row space-y-4 justify-between items-center mb-4">
        {/* Search bar */}
        <div className="flex-grow relative mr-4">
          <input
            type="text"
            placeholder="Search supplier by name, address, phone or ID..."
            className="w-full px-4 py-2 pl-10 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
        {/* Add Supplier button */}
        {canCreate(PERMISSION_PAGES.SUPPLIER_LIST) && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mr-2"
            title="Add Supplier"
          >
            <span className="text-xl mr-2">+</span> Add Supplier
          </button>
        )}
        {/* Export button */}
        <button
          onClick={exportSuppliersAsCSV}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          title="Export Supplier List as CSV"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 text-left">Supplier Name</th>
                <th className="border px-3 py-2 text-left">Address</th>
                <th className="border px-3 py-2 text-left">Phone</th>
                <th className="border px-3 py-2 text-left">Supplier ID</th>
                <th className="border px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s, idx) => (
                // Use both supplier id and index to ensure unique keys even if ids are duplicated
                <tr key={String(s.id) + "-" + idx} className="hover:bg-blue-50">
                  <td className="border px-3 py-2 cursor-pointer" onClick={() => handleSupplierClick(s)}>{s.supplier_name}</td>
                  <td className="border px-3 py-2 cursor-pointer" onClick={() => handleSupplierClick(s)}>{s.address}</td>
                  <td className="border px-3 py-2 cursor-pointer" onClick={() => handleSupplierClick(s)}>{s.phone}</td>
                  <td className="border px-3 py-2 cursor-pointer" onClick={() => handleSupplierClick(s)}>{s.id}</td>
                  <td className="border px-3 py-2 flex">
                    <button
                      className="p-2 bg-blue-200 hover:bg-blue-300 rounded mr-2"
                      onClick={() => {
                        setViewSupplier(s);
                        setViewOpen(true);
                      }}
                      title="View Bills"
                    >
                      <FaFileInvoiceDollar className="text-blue-700" />
                    </button>
                    {canEdit(PERMISSION_PAGES.SUPPLIER_LIST) && (
                      <button
                        className="p-2 bg-yellow-200 hover:bg-yellow-300 rounded mr-2"
                        onClick={() => handleEditClick(s)}
                        title="Edit Supplier"
                      >
                        <FaEdit className="text-yellow-700" />
                      </button>
                    )}
                    {canDelete(PERMISSION_PAGES.SUPPLIER_LIST) && (
                      <button
                        className="p-2 bg-red-200 hover:bg-red-300 rounded"
                        onClick={() => handleDeleteClick(s)}
                        title="Delete Supplier"
                      >
                        <FaTrash className="text-red-700" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* ...existing code... */}
          </table>
          
          {/* No results message */}
          {filteredSuppliers.length === 0 && searchQuery && (
            <div className="text-center py-4 text-gray-500">
              No suppliers found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {/* Modal for supplier's products */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[700px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">
              Products for: {selectedSupplier?.supplier_name}
            </h2>
            {productsLoading ? (
              <Loader />
            ) : products.length === 0 ? (
              <div className="text-gray-500">
                No products found for this supplier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Bill</th>
                      <th className="border px-2 py-1">Barcode</th>
                      <th className="border px-2 py-1">Product</th>
                      <th className="border px-2 py-1">Category</th>
                      <th className="border px-2 py-1">Size</th>
                      <th className="border px-2 py-1">Color</th>
                      <th className="border px-2 py-1">Qty</th>
                      <th className="border px-2 py-1">Unit Price</th>
                      <th className="border px-2 py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="border px-2 py-1">{p.bill_number}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
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
                <label className="block text-sm font-medium mb-1">Supplier ID</label>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  value={editForm.id ?? editSupplier?.id ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, id: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier Name</label>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  value={editForm.supplier_name}
                  onChange={e => setEditForm(f => ({ ...f, supplier_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  className="border rounded p-2 w-full"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
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

      {/* Delete Supplier Modal */}
      {deleteOpen && (
        deleteBlocked ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px] max-w-full relative">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
                onClick={() => setDeleteOpen(false)}
                title="Close"
              >
                &times;
              </button>
              <div className="text-red-600 font-bold mb-2">Delete Not Allowed</div>
              <div className="mb-4">{deleteBlockMsg}</div>
              <div className="flex justify-end">
                <button
                  className="px-4 py-2 bg-gray-300 rounded"
                  onClick={() => setDeleteOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <GenericDeleteComponent
            open={deleteOpen}
            setOpen={setDeleteOpen}
            id={deleteId}
            collectionName="supplier_list"
            currentUser={currentUser}
            queryClient={null}
          />
        )
      )}

      {/* View Supplier Modal */}
      {viewOpen && viewSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[700px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setViewOpen(false)}
              title="Close"
            >
              &times;
            </button>
            <ViewSupplier supplier={viewSupplier} />
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setAddOpen(false)}
              title="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Add New Supplier</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAddSaving(true);
                try {
                  if (!addForm.supplier_name.trim() || !addForm.address.trim() || !addForm.phone.trim()) {
                    alert('All fields are required.');
                    setAddSaving(false);
                    return;
                  }
                  // Firestore transaction for auto-increment supplier_id
                  let newSupplierId;
                  await runTransaction(firestore, async (transaction) => {
                    const counterRef = firestoreDoc(firestore, 'counters', 'supplier');
                    const counterSnap = await transaction.get(counterRef);
                    let currentId = 1;
                    if (!counterSnap.exists()) {
                      transaction.set(counterRef, { supplier_id: 2 }); // next will be 2
                    } else {
                      currentId = counterSnap.data().supplier_id || 1;
                      transaction.update(counterRef, { supplier_id: currentId + 1 });
                    }
                    newSupplierId = currentId;
                  });
                  // Add to Firestore
                  await addDoc(collection(firestore, 'supplier_list'), {
                    supplier_name: addForm.supplier_name.trim(),
                    address: addForm.address.trim(),
                    phone: addForm.phone.trim(),
                    id: String(newSupplierId),
                  });
                  // Refresh list
                  const snap = await getDocs(collection(firestore, 'supplier_list'));
                  setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                  setAddOpen(false);
                  setAddForm({ supplier_name: '', address: '', phone: '' });
                } catch (err) {
                  alert('Failed to add supplier: ' + err.message);
                } finally {
                  setAddSaving(false);
                }
              }}
            >
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Supplier Name</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={addForm.supplier_name}
                  onChange={e => setAddForm(f => ({ ...f, supplier_name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={addForm.address}
                  onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={addForm.phone}
                  onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 rounded"
                  onClick={() => setAddOpen(false)}
                  disabled={addSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  disabled={addSaving}
                >
                  {addSaving ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierList;