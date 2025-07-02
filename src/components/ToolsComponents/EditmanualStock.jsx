import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';

const EditmanualStock = ({ product, onClose, currentUser }) => {
  // Parse costing as number, fallback to 0 if invalid
  const costingNum = parseFloat((product.costing || '').toString().replace(/,/g, ''));
  const validCosting = !isNaN(costingNum);
  const [countStock, setCountStock] = useState(Number(product.count_stock) || 0);
  const [note, setNote] = useState(product.note || '');
  const [totalCosting, setTotalCosting] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Update totalCosting when countStock or costing changes
    if (validCosting) {
      setTotalCosting((countStock * costingNum).toFixed(2));
    } else {
      setTotalCosting('—');
    }
  }, [countStock, costingNum, validCosting]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(firestore, 'manual_product', product.id);
      await updateDoc(docRef, {
        count_stock: countStock,
        total_costing: validCosting ? Number(totalCosting) : 0,
        note: note,
        updated_at: new Date().toISOString(),
        updated_by_name: currentUser?.name || '',
      });
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      alert('Failed to update: ' + err.message);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-blue-700 mb-4">Edit Manual Stock</h2>
      <table className="min-w-full text-sm border mb-4">
        <tbody>
          <tr>
            <td className="font-semibold p-2">Barcode</td>
            <td className="p-2">{product.barcode}</td>
          </tr>
          <tr>
            <td className="font-semibold p-2">SKU</td>
            <td className="p-2">{product.sku}</td>
          </tr>
          <tr>
            <td className="font-semibold p-2">Qty</td>
            <td className="p-2">{product.qty}</td>
          </tr>
          <tr>
            <td className="font-semibold p-2">Costing</td>
            <td className="p-2">{validCosting ? costingNum.toLocaleString() : '—'}</td>
          </tr>
          <tr>
            <td className="font-semibold p-2">Count Stock</td>
            <td className="p-2">
              <input
                type="number"
                className="border rounded px-2 py-1 w-24"
                value={countStock}
                min={0}
                onChange={e => setCountStock(Number(e.target.value))}
                disabled={saving}
              />
            </td>
          </tr>
          <tr>
            <td className="font-semibold p-2 align-top">Note</td>
            <td className="p-2">
              <textarea
                className="border rounded px-2 py-1 w-full min-h-[60px] resize-y"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write a note about this product..."
                disabled={saving}
              />
            </td>
          </tr>
          <tr>
            <td className="font-semibold p-2">Total Costing</td>
            <td className="p-2">{validCosting ? Number(totalCosting).toLocaleString() : '—'}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex justify-end gap-2">
        <button
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          onClick={onClose}
          disabled={saving}
        >Cancel</button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
};

export default EditmanualStock;