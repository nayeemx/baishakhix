import React, { useState } from 'react';
import {
  doc,
  deleteDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { firestore } from '../../firebase/firebase.config';
import { toast } from 'react-toastify';

const GenericDeleteComponent = ({
  open,
  setOpen,
  id,
  collectionName,
  currentUser,
  adjustment, // pass the adjustment object for restore logic
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const user = useSelector(state => state.auth?.user);

  const handleDelete = async () => {
    setError('');
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    try {
      // 1. Get the document data before deleting
      const docRef = doc(firestore, collectionName, id);
      const docSnap = await getDoc(docRef);
      const deletedData = docSnap.exists() ? docSnap.data() : null;

      // 2. Restore quantity and deal_amount if adjustment is bill_reduction
      if (collectionName === "supplier_adjustment" && adjustment && adjustment.type === "bill_reduction") {
        // Restore quantity for the barcode in products table
        const productsCol = collection(firestore, "products");
        const q = query(
          productsCol,
          where("bill_number", "==", adjustment.bill_number),
          where("barcode", "==", adjustment.barcode)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const prodDoc = snap.docs[0];
          const prodData = prodDoc.data();
          const productDocRef = doc(firestore, "products", prodDoc.id);

          // Restore quantity
          const currentQty = Number(prodData.quantity) || 0;
          const restoreQty = Number(adjustment.quantity) || 0;
          const updatedQty = currentQty + restoreQty;
          await updateDoc(productDocRef, { quantity: String(updatedQty) });
        }

        // Restore deal_amount for all products with this bill_number
        const allBillProductsQ = query(
          productsCol,
          where("bill_number", "==", adjustment.bill_number)
        );
        const allBillSnap = await getDocs(allBillProductsQ);
        const unitPrice = Number(adjustment.unit_price) || 0;
        const dealAmountRestore = unitPrice * Number(adjustment.quantity);

        for (const docSnap of allBillSnap.docs) {
          const prod = docSnap.data();
          const currentDealAmount = Number(prod.deal_amount) || 0;
          const newDealAmount = currentDealAmount + dealAmountRestore;
          await updateDoc(doc(firestore, "products", docSnap.id), {
            deal_amount: String(newDealAmount)
          });
        }
      }

      // 3. Delete the document
      await deleteDoc(docRef);

      // 4. Log the delete trace in a single delete_traces collection
      await addDoc(collection(firestore, 'delete_traces'), {
        deleted_data: deletedData,
        deleted_id: id,
        table: collectionName,
        deleted_by:
          user?.displayName || user?.email || user?.uid || 'Unknown',
        deleted_by_uid: user?.uid || null,
        reason,
        deleted_at: serverTimestamp(),
      });

      setOpen(false);
      setReason('');
      toast.success('Deleted successfully!');
    } catch (err) {
      setError('Delete failed: ' + err.message);
      toast.error('Delete failed: ' + err.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white p-6 rounded shadow-lg min-w-[320px] flex flex-col gap-4">
        <h2 className="text-lg font-bold text-red-600">Confirm Delete</h2>
        <div>
          <label className="block mb-1 font-medium">
            Reason for delete <span className="text-red-500">*</span>
          </label>
          <textarea
            className="border rounded p-2 w-full min-h-[60px]"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Please provide a reason for deletion"
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={() => {
              setOpen(false);
              setReason('');
              setError('');
            }}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenericDeleteComponent;
