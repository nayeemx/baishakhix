import React, { useEffect, useState, useCallback } from "react";
import { collection, getDocs, onSnapshot, query, where, doc, updateDoc, addDoc } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import SupplierAdjustmentEdit from "../../components/adjustment_component/supplier_adjustment_edit";
import GenericDeleteComponent from "../../components/adjustment_component/GenericDeleteComponent";
import { useSelector } from "react-redux";
import SupplierAdjustment from "../../components/PeopleComponent/SupplierAdjustment";
import { toast } from "react-toastify";
import { MdOutlineEditNote, MdDeleteOutline, MdAdd } from 'react-icons/md';
import { TbAdjustments } from 'react-icons/tb';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';

const SupplierReturn = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editAdjustment, setEditAdjustment] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteAdjustment, setDeleteAdjustment] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const user = useSelector(state => state.auth?.user);
  const { canCreate, canEdit, canDelete } = usePermissions();

  // Real-time fetch using Firestore onSnapshot
  useEffect(() => {
    setLoading(true);
    const colRef = collection(firestore, "supplier_adjustment");
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const arr = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAdjustments(arr.reverse());
        setLoading(false);
      },
      (error) => {
        setAdjustments([]);
        setLoading(false);
        console.error("Error fetching supplier_adjustment from Firestore:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Callback to close modal and optionally refresh (not needed with onSnapshot)
  const handleEditClose = useCallback(() => {
    setEditModalOpen(false);
    setEditAdjustment(null);
  }, []);

  // Custom delete logic for restoring quantity and deal_amount
  const handleDeleteAdjustment = async (adj, reason, closeModal) => {
    try {
      // 1. Restore quantity for the barcode in products table
      const productsCol = collection(firestore, "products");
      const q = query(
        productsCol,
        where("bill_number", "==", adj.bill_number),
        where("barcode", "==", adj.barcode)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const prodDoc = snap.docs[0];
        const prodData = prodDoc.data();
        const productDocRef = doc(firestore, "products", prodDoc.id);

        // Restore quantity
        const currentQty = Number(prodData.quantity) || 0;
        const restoreQty = Number(adj.quantity) || 0;
        const updatedQty = currentQty + restoreQty;
        await updateDoc(productDocRef, { quantity: String(updatedQty) });
      }

      // 2. Restore deal_amount for all products with this bill_number
      const allBillProductsQ = query(
        productsCol,
        where("bill_number", "==", adj.bill_number)
      );
      const allBillSnap = await getDocs(allBillProductsQ);
      const unitPrice = Number(adj.unit_price) || 0;
      const dealAmountRestore = unitPrice * Number(adj.quantity);

      for (const docSnap of allBillSnap.docs) {
        const prod = docSnap.data();
        const currentDealAmount = Number(prod.deal_amount) || 0;
        const newDealAmount = currentDealAmount + dealAmountRestore;
        await updateDoc(doc(firestore, "products", docSnap.id), {
          deal_amount: String(newDealAmount)
        });
      }

      // 3. Call GenericDeleteComponent logic to delete and log
      // You can call the delete logic directly or use the component as a modal
      // Here, we assume you use the modal and pass a callback to handle the actual delete
      closeModal(); // Close the modal after delete
    } catch (err) {
      // Optionally show error
    }
  };

  // Fetch all suppliers for dropdown (only when modal is opened)
  useEffect(() => {
    if (showAdjustmentModal) {
      const fetchSuppliers = async () => {
        const snap = await getDocs(collection(firestore, "supplier_list")); // Changed from "suppliers" to "supplier_list"
        const arr = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setSuppliers(arr);
      };
      fetchSuppliers();
      setSelectedSupplier(null);
      setSupplierProducts([]);
    }
  }, [showAdjustmentModal]);

  // Fetch products for selected supplier
  useEffect(() => {
    if (selectedSupplier) {
      const fetchProducts = async () => {
        const snap = await getDocs(
          query(
            collection(firestore, "products"),
            where("supplier_id", "==", selectedSupplier.id)
          )
        );
        const arr = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setSupplierProducts(arr);
      };
      fetchProducts();
    } else {
      setSupplierProducts([]);
    }
  }, [selectedSupplier]);

  const handleAdjustmentSubmit = async (adjustment) => {
    try {
      if (adjustment.type === "bill_reduction") {
        // For bill reduction, let the original component handle it
        await addDoc(collection(firestore, "supplier_adjustment"), adjustment);
      } else {
        // For regular adjustments
        const adjustmentRef = await addDoc(collection(firestore, "supplier_adjustment"), {
          ...adjustment,
          created_at: new Date().toISOString()
        });
      }
      toast.success("Adjustment saved successfully!");
      setShowAdjustmentModal(false);
    } catch (err) {
      toast.error("Failed to save adjustment: " + err.message);
      console.error("Adjustment error:", err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TbAdjustments className="text-2xl text-blue-600" />
          <h2 className="text-xl font-bold">Supplier Adjustments</h2>
        </div>
        {/* Adjustment Button */}
        <div className="flex justify-end">
          {canCreate(PERMISSION_PAGES.SUPPLIER_ADJUSTMENT) && (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
              onClick={() => setShowAdjustmentModal(true)}
            >
              <MdAdd className="text-xl" />
              <span>New Adjustment</span>
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : adjustments.length === 0 ? (
        <div className="text-gray-500">No adjustments found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2">total_price</th>
                <th className="border px-3 py-2">type</th>
                <th className="border px-3 py-2">bill_number</th>
                <th className="border px-3 py-2">supplier_name</th>
                <th className="border px-3 py-2">unit_price</th>
                <th className="border px-3 py-2">note</th>
                <th className="border px-3 py-2">barcode</th>
                <th className="border px-3 py-2">quantity</th>
                <th className="border px-3 py-2">supplier_id</th>
                <th className="border px-3 py-2">product</th>
                <th className="border px-3 py-2">created_at</th>
                <th className="border px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="border px-3 py-2">{adj.total_price}</td>
                  <td className="border px-3 py-2">{adj.type}</td>
                  <td className="border px-3 py-2">{adj.bill_number}</td>
                  <td className="border px-3 py-2">{adj.supplier_name}</td>
                  <td className="border px-3 py-2">{adj.unit_price}</td>
                  <td className="border px-3 py-2">{adj.note}</td>
                  <td className="border px-3 py-2">{adj.barcode}</td>
                  <td className="border px-3 py-2">{adj.quantity}</td>
                  <td className="border px-3 py-2">{adj.supplier_id}</td>
                  <td className="border px-3 py-2">{adj.product}</td>
                  <td className="border px-3 py-2">
                    {adj.created_at
                      ? new Date(adj.created_at).toLocaleString()
                      : ""}
                  </td>
                  <td className="border px-3 py-2">
                    {canEdit(PERMISSION_PAGES.SUPPLIER_ADJUSTMENT) && (
                      <button
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 mr-2 flex items-center gap-1"
                        onClick={() => {
                          setEditAdjustment(adj);
                          setEditModalOpen(true);
                        }}
                      >
                        <MdOutlineEditNote className="text-lg" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete(PERMISSION_PAGES.SUPPLIER_ADJUSTMENT) && (
                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                        onClick={() => {
                          setDeleteAdjustment(adj);
                          setDeleteModalOpen(true);
                        }}
                      >
                        <MdDeleteOutline className="text-lg" />
                        <span>Delete</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => {
                setEditModalOpen(false);
                setEditAdjustment(null);
              }}
              title="Close"
            >
              &times;
            </button>
            <SupplierAdjustmentEdit adjustment={editAdjustment} onClose={() => {
              setEditModalOpen(false);
              setEditAdjustment(null);
            }} />
          </div>
        </div>
      )}
      {/* Delete Modal */}
      {deleteModalOpen && deleteAdjustment && (
        <GenericDeleteComponent
          open={deleteModalOpen}
          setOpen={setDeleteModalOpen}
          id={deleteAdjustment.id}
          collectionName="supplier_adjustment"
          currentUser={user}
          adjustment={deleteAdjustment}
        />
      )}
      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowAdjustmentModal(false)}
              title="Close"
            >
              &times;
            </button>
            {/* Supplier dropdown for this page only */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Supplier</label>
              <select
                className="border rounded p-2 w-full"
                value={selectedSupplier?.id || ""}
                onChange={e => {
                  const sup = suppliers.find(s => s.id === e.target.value);
                  setSelectedSupplier(sup || null);
                }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.supplier_name}
                  </option>
                ))}
              </select>
            </div>
            {selectedSupplier ? (
              <SupplierAdjustment
                supplier={selectedSupplier}
                products={supplierProducts}
                onSubmit={handleAdjustmentSubmit} // Pass the handler here
              />
            ) : (
              <div className="text-gray-500 text-center py-8">Please select a supplier to continue.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierReturn;