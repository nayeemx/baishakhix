import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import TiptapEditor from '../TiptapEditor';

const dropdownFields = [
  'brand',
  'color',
  'design',
  'origin',
  'product_category',
  'product_type',
  'season',
  'style',
  'size',
];

const allFields = [
  'barcode',
  'sku',
  'old_barcode',
  'old_sku',
  'product',
  'origin',
  'season',
  'product_type',
  'product_category',
  'brand',
  'design',
  'size',
  'color',
  'style',
  'quantity',
  'original_qty',
  'unit_price',
  'total_price',
  'retail_price',
  'percentage',
  'manufacture_date',
  'expiry_date',
  'image',
  'description',
];

const murukhhoOptions = [
  { value: 'party', label: 'Party' },
  { value: 'cash purchase', label: 'Cash_Purchase' },
  { value: 'own house', label: 'Own_house' },
];

const MAX_IMAGES = 6;
const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;

const getFieldLabel = (field) => {
  if (field === 'murukhho') return 'Supplier Type';
  if (field === 'supplier_id') return 'Supplier';
  return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const EditOldProductModal = ({
  open,
  setOpen,
  product,
  suppliersList = [],
  queryClient,
}) => {
  const [form, setForm] = useState(product || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unitOptions, setUnitOptions] = useState({});
  const [uploading, setUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    setForm(product || {});
    // Normalize image field to array
    const imgs = typeof product?.image === 'string'
      ? product.image.split(',').map(i => i.trim()).filter(Boolean)
      : Array.isArray(product?.image) ? product.image : [];
    setImagePreviews(imgs);
    setError('');
  }, [product, open]);

  // Fetch all products for dropdown options
  useEffect(() => {
    if (!open) return;
    const fetchUnits = async () => {
      const productsSnap = await getDocs(collection(firestore, 'products'));
      const productsArr = productsSnap.docs.map(doc => doc.data());
      const options = {};
      dropdownFields.forEach(field => {
        options[field] = [
          ...new Set(
            productsArr
              .map(u => u[field])
              .filter(v => v && v.trim() !== '')
          ),
        ].sort();
      });
      setUnitOptions(options);
    };
    fetchUnits();
  }, [open]);

  // Auto-calculate total_price when quantity or unit_price changes
  useEffect(() => {
    const qty = Number(form.quantity) || 0;
    const unit = Number(form.unit_price) || 0;
    if (!isNaN(qty) && !isNaN(unit)) {
      setForm(f => ({ ...f, total_price: (qty * unit).toString() }));
    }
    // eslint-disable-next-line
  }, [form.quantity, form.unit_price]);

  if (!open || !product) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle image upload to imgbb (append instead of overwrite)
  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_IMAGES);
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          urls.push(data.data.url);
        } else {
          throw new Error('Image upload failed');
        }
      }
      setImagePreviews(prev => [...prev, ...urls]);
      setForm(f => ({
        ...f,
        image: [...(Array.isArray(f.image) ? f.image : (typeof f.image === 'string' && f.image ? f.image.split(',').map(i => i.trim()).filter(Boolean) : [])), ...urls].join(',')
      }));
    } catch (err) {
      setError('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Remove image handler
  const handleRemoveImage = (url) => {
    setImagePreviews(prev => prev.filter(img => img !== url));
    setForm(f => {
      const arr = (Array.isArray(f.image) ? f.image : (typeof f.image === 'string' ? f.image.split(',').map(i => i.trim()).filter(Boolean) : []));
      return { ...f, image: arr.filter(img => img !== url).join(',') };
    });
  };

  // Improved duplicate barcode check
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(firestore, 'products'),
        where('barcode', '==', form.barcode)
      );
      const snapshot = await getDocs(q);
      const duplicate = snapshot.docs.find(docSnap => docSnap.id !== product.id);
      if (duplicate) {
        setError('Barcode already exists. Please enter a unique barcode.');
        setLoading(false);
        return;
      }
      // Save image as array or comma-separated string
      const saveForm = { ...form };
      if (Array.isArray(form.image)) {
        saveForm.image = form.image.join(',');
      }
      saveForm.updated_at = new Date().toISOString();
      await updateDoc(doc(firestore, 'products', product.id), saveForm);
      setOpen(false);
      if (queryClient) queryClient.invalidateQueries(['products']);
    } catch (err) {
      setError('Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 h-[98vh] p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold"
          onClick={() => setOpen(false)}
          type="button"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Edit Product</h2>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allFields
              .filter(field => field !== 'description')
              .map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {getFieldLabel(field)}
                  </label>
                  {field === 'image' ? (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        disabled={uploading}
                        className="w-full border rounded p-2"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {imagePreviews.map((url, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={url}
                              alt={`preview-${idx}`}
                              className="w-16 h-16 object-cover rounded border"
                            />
                            <button
                              type="button"
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              onClick={() => handleRemoveImage(url)}
                              tabIndex={-1}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {uploading && <div className="text-blue-600 text-xs">Uploading...</div>}
                    </>
                  ) : dropdownFields.includes(field) && unitOptions[field]?.length > 0 ? (
                    <select
                      name={field}
                      value={form[field] ?? ''}
                      onChange={handleChange}
                      className="w-full border rounded p-2"
                      required={field === 'product' || field === 'barcode'}
                    >
                      <option value="">Select {getFieldLabel(field)}</option>
                      {unitOptions[field].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field}
                      value={form[field] ?? ''}
                      onChange={handleChange}
                      className="w-full border rounded p-2"
                      required={field === 'product' || field === 'barcode'}
                      type={field.includes('date') ? 'date' : 'text'}
                    />
                  )}
                </div>
              ))}
          </div>
          {/* Move description editor OUTSIDE the grid for full width */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
              {getFieldLabel('description')}
            </label>
            <TiptapEditor
              content={form.description || ''}
              onChange={(html) => setForm(f => ({ ...f, description: html }))}
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm mb-2">{error}</div>
          )}
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={loading || uploading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditOldProductModal;