import React, { useState } from 'react';
import { firestore } from '../../firebase/firebase.config';
import { collection, addDoc } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import BarcodeHistory from './BarcodeHistory';

const AddoldUnit = ({ open, setOpen, onSuccess }) => {
  const [form, setForm] = useState({
    item_type: '',
    cosmatic_type: '',
    product_category: '',
    product_type: '',
    brand: '',
    color: '',
    design: '',
    origin: '',
    season: '',
    size: '',
    style: '',
    stock_type: 'old_product' // Always old_product
  });
  const [loading, setLoading] = useState(false);
  const [showBarcodeHistory, setShowBarcodeHistory] = useState(false);
  const currentUser = useSelector(state => state.auth?.user);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const unitData = {
        ...form,
        stock_type: 'old_product', // Always enforce old_product
        created_at: new Date().toISOString(),
        created_by: currentUser?.name || currentUser?.email || 'Unknown',
        updated_at: '',
        updated_by: ''
      };

      await addDoc(collection(firestore, 'product_units'), unitData);
      toast.success('Old unit added successfully');
      if (onSuccess) onSuccess();
      setOpen(false);
    } catch (error) {
      toast.error('Failed to add old unit');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Add Old Unit</h2>
          <button
            className="text-gray-500 hover:text-red-600 text-xl"
            onClick={() => setOpen(false)}
            title="Close"
          >
            &times;
          </button>
        </div>
        {/* Barcode History Button */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            className="px-3 py-1 bg-gray-700 text-white rounded"
            onClick={() => setShowBarcodeHistory(true)}
          >
            Barcode History
          </button>
        </div>
        {/* BarcodeHistory Modal */}
        {showBarcodeHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
              <button
                className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
                onClick={() => setShowBarcodeHistory(false)}
                title="Close"
              >
                &times;
              </button>
              <BarcodeHistory />
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Item Type</label>
              <select
                name="item_type"
                value={form.item_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Select Item Type</option>
                <option value="General">General</option>
                <option value="Cosmatic">Cosmatic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Cosmetic Type</label>
              <input
                type="text"
                name="cosmatic_type"
                value={form.cosmatic_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input
                type="text"
                name="product_category"
                value={form.product_category}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <input
                type="text"
                name="product_type"
                value={form.product_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand</label>
              <input
                type="text"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <input
                type="text"
                name="color"
                value={form.color}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Design</label>
              <input
                type="text"
                name="design"
                value={form.design}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Origin</label>
              <input
                type="text"
                name="origin"
                value={form.origin}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Season</label>
              <input
                type="text"
                name="season"
                value={form.season}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Size</label>
              <input
                type="text"
                name="size"
                value={form.size}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Style</label>
              <input
                type="text"
                name="style"
                value={form.style}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock Type</label>
              <input
                type="text"
                name="stock_type"
                value="old_product"
                readOnly
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
              />
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
              {loading ? 'Adding...' : 'Add Old Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddoldUnit;