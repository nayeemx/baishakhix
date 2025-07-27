import React, { useState, useEffect } from "react";
import { firestore } from "../../firebase/firebase.config";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { usePermissions, PERMISSION_PAGES } from "../../utils/permissions";

const EditUnit = ({ open, setOpen, unitData, onSuccess }) => {
  const { canEdit } = usePermissions();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const currentUser = useSelector((state) => state.auth?.user);

  useEffect(() => {
    if (unitData) {
      // Store docId separately, don't include in formData
      const { docId, ...rest } = unitData;
      setFormData(rest);
      console.log('Edit data received:', { docId, ...rest }); // Debug log
    }
  }, [unitData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check permissions first
    if (!canEdit(PERMISSION_PAGES.PRODUCT_LIST)) {
      toast.error('You do not have permission to edit units');
      return;
    }
    
    if (!unitData?.docId) {
      console.error('Missing Firestore document ID:', unitData);
      toast.error("Cannot update: Missing document reference");
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(firestore, "product_units", unitData.docId);
      
      const updateData = {
        ...formData,
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.name || currentUser?.email || currentUser?.uid || "Unknown"
      };
      
      await updateDoc(docRef, updateData);
      toast.success("Unit updated successfully!");
      setOpen(false);
      // Refresh the list after successful update
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(`Failed to update unit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Edit Unit</h2>
          <button
            className="text-gray-500 hover:text-red-600 text-xl"
            onClick={() => setOpen(false)}
            title="Close"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Item Type</label>
              <input
                type="text"
                name="item_type"
                value={formData.item_type || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cosmetic Type</label>
              <input
                type="text"
                name="cosmatic_type"
                value={formData.cosmatic_type || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input
                type="text"
                name="product_category"
                value={formData.product_category || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <input
                type="text"
                name="product_type"
                value={formData.product_type || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <input
                type="text"
                name="color"
                value={formData.color || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Design</label>
              <input
                type="text"
                name="design"
                value={formData.design || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Origin</label>
              <input
                type="text"
                name="origin"
                value={formData.origin || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Season</label>
              <input
                type="text"
                name="season"
                value={formData.season || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Size</label>
              <input
                type="text"
                name="size"
                value={formData.size || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Style</label>
              <input
                type="text"
                name="style"
                value={formData.style || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock Type</label>
              <select
                name="stock_type"
                value={formData.stock_type || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select Type</option>
                <option value="new_product">New Product</option>
                <option value="old_product">Old Product</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm border rounded text-gray-600"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUnit;