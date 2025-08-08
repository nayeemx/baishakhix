import React, { useState, useEffect } from 'react';
import { firestore, auth } from '../../firebase/firebase.config';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import TiptapEditor from '../../components/TiptapEditor';
import { Switch } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { MdInventory } from "react-icons/md";
import UnitList from '../../components/Inventory/UnitList'; // adjust path as needed
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';

const dropdownFields = [
  "item_type", "cosmatic_type", "product_category", "product_type", "brand",
  "color", "design", "origin", "season", "size", "style", "stock_type"
];

// Normalize possible field name variations from Firestore docs
const FIELD_ALIASES = {
  product_type: ["product_type", "productType", "type"],
  origin: ["origin"],
  design: ["design", "pattern"],
  color: ["color", "colour"],
  size: ["size"],
  season: ["season"],
  style: ["style"],
  cosmatic_type: ["cosmatic_type", "cosmetic_type", "cosmetics_type"],
  item_type: ["item_type", "itemType", "category", "category_type"],
  stock_type: ["stock_type", "stockType"],
  brand: ["brand"],
};

const murukhhoOptions = [
  { value: 'party', label: 'Party (due purchase)' },
  { value: 'cash purchase', label: 'Cash_Purchase' },
  { value: 'own house', label: 'Own_house' }
];

const MAX_IMAGES = 6;
const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;

const AddProduct = () => {
  const [isCosmeticMode, setIsCosmeticMode] = useState(false);
  const [form, setForm] = useState({
    item_type: 'General',
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
    stock_type: 'new_product',
    quantity: '',
    original_qty: '',
    unit_price: '',
    total_price: '',
    retail_price: '',
    percentage: '',
    manufacture_date: '',
    expiry_date: '',
    murukhho: '',
    bill_number: '',
    deal_amount: '',
    paid_amount: '',
    supplier_id: '',
    sku: '',
    product: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unitOptions, setUnitOptions] = useState({});
  const [suppliersList, setSuppliersList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [description, setDescription] = useState('');
  const [showCode, setShowCode] = useState(true);
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [generatedSku, setGeneratedSku] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [userData, setUserData] = useState(null);
  const [showUnitList, setShowUnitList] = useState(false);
  const navigate = useNavigate();
  const { canCreate } = usePermissions();

  // Reset form fields when switching modes
  const handleModeChange = (newMode) => {
    setIsCosmeticMode(newMode);
    // Reset product-related fields when switching modes
    setForm(prev => ({
      ...prev,
      item_type: newMode ? 'Cosmetic' : 'General',
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
    }));
  };

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      const snap = await getDocs(collection(firestore, 'supplier_list'));
      setSuppliersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSuppliers();
  }, []);

  // Fetch units for dropdowns
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const unitsSnap = await getDocs(collection(firestore, 'product_units'));
        const options = {};
        const allUnits = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('All units fetched:', allUnits); // Debug log
        
        // Show ALL units regardless of mode - no filtering
        const unitsToUse = allUnits;
        console.log('Using all units:', unitsToUse.length);
        
        // Populate dropdown options from all units
        const coerceToArray = (value) => {
          if (value == null) return [];
          if (Array.isArray(value)) return value;
          return [value];
        };

        dropdownFields.forEach(field => {
          const aliases = FIELD_ALIASES[field] || [field];
          const collected = [];
          unitsToUse.forEach(unit => {
            // pick first alias that exists
            for (const alias of aliases) {
              const raw = unit[alias];
              if (raw !== undefined && raw !== null) {
                const arr = coerceToArray(raw)
                  .map(v => typeof v === 'number' ? String(v) : String(v))
                  .map(v => v.trim())
                  .filter(v => v.length > 0);
                collected.push(...arr);
                break; // move to next field for this unit
              }
            }
          });
          const uniqueSorted = Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b));
          options[field] = uniqueSorted;
        });
        
        setUnitOptions(options);
        console.log('Unit options loaded:', options); // Debug log
      } catch (error) {
        console.error('Error fetching product units:', error);
        toast.error('Failed to load product unit options');
      }
    };
    fetchUnits();
  }, []);

  // Barcode and SKU generation
  useEffect(() => {
    const getNextBarcode = async () => {
      const productsRef = collection(firestore, 'products');
      const q = query(productsRef, where('barcode', '>=', '19000'));
      const snapshot = await getDocs(q);
      const barcodes = snapshot.docs.map(doc => parseInt(doc.data().barcode)).filter(code => !isNaN(code));
      const nextNumber = barcodes.length > 0 ? Math.max(...barcodes) + 1 : 19000;
      setGeneratedBarcode(nextNumber.toString());
    };
    getNextBarcode();
  }, []);

  // Helper for visible fields and label renaming, with requested order
  const getVisibleFields = () => {
    const baseFields = [
      { name: "product_type", label: "Product Type" },
      { name: "brand", label: "Brand" },
      { name: "origin", label: "Origin" },
      { name: "design", label: "Design" },
      { name: "color", label: "Color" },
      { name: "size", label: "Size" },
      { name: "season", label: "Season" },
      { name: "style", label: "Style" },
    ];
    
    if (isCosmeticMode) {
      // Cosmetic mode: include brand, exclude color, design, style
      return [
        { name: "product_type", label: "Product Type" },
        { name: "cosmatic_type", label: "Cosmetic Type" },
        { name: "brand", label: "Brand" },
        { name: "origin", label: "Origin" },
        { name: "size", label: "Size" },
        { name: "season", label: "Season" },
      ];
    }
    
    return baseFields;
  };

  // SKU generation logic
  useEffect(() => {
    const getFieldPart = (value = '', length = 1) => value ? value.split('-')[0].slice(0, length).toUpperCase() : '';
    let sku = '';
    if (form.product_type && form.origin && form.size) {
      if (isCosmeticMode) {
        // Cosmetic mode: CT-OP-SZ-B (e.g., 8Z-28A-5D2-01)
        sku = [
          getFieldPart(form.cosmatic_type, 2), // e.g., "8Z"
          getFieldPart(form.origin, 1) + getFieldPart(form.product_type, 3), // e.g., "2" + "8A" → "28A"
          getFieldPart(form.season, 1) + getFieldPart(form.size, 3), // e.g., "5" + "D2" → "5D2"
          getFieldPart(form.brand, 2) // e.g., "01"
        ].filter(Boolean).join('-');
      } else {
        // General mode: PT-OD-CS-SS
        sku = [
          getFieldPart(form.product_type, 2),
          getFieldPart(form.origin, 1) + getFieldPart(form.design, 1),
          getFieldPart(form.color, 2) + getFieldPart(form.size, 2),
          getFieldPart(form.season, 1) + getFieldPart(form.style, 2)
        ].filter(Boolean).join('-');
      }
    }
    setGeneratedSku(sku);
  }, [form, isCosmeticMode]);

  // Price/percentage calculation
  useEffect(() => {
    if (form.quantity && form.unit_price) {
      const qty = parseFloat(form.quantity);
      const unitPrice = parseFloat(form.unit_price);
      const totalPrice = qty * unitPrice;
      const retailPrice = parseFloat(form.retail_price) || 0;
      setForm(prev => ({
        ...prev,
        total_price: totalPrice.toFixed(2),
        original_qty: prev.original_qty || qty.toString(),
        percentage: retailPrice ? (((retailPrice - unitPrice) / unitPrice) * 100).toFixed(2) : ''
      }));
    }
  }, [form.quantity, form.unit_price, form.retail_price]);

  // User data
  useEffect(() => {
    const fetchUser = async () => {
      if (!auth.currentUser) return;
      const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
      if (userDoc.exists()) setUserData(userDoc.data());
    };
    fetchUser();
  }, []);

  // Image input handler
  const handleImageInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setSelectedFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES));
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  // Upload images to ImgBB and return URLs
  const uploadImagesToImgBB = async (files) => {
    const urls = [];
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large. Max size is 2MB`);
          continue;
        }
        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', imgbbApiKey);
        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
        const result = await response.json();
        if (result.success) urls.push(result.data.url);
      }
      return urls.join(',');
    } catch (err) {
      toast.error('Failed to upload one or more images');
      return '';
    } finally {
      setUploading(false);
    }
  };

  // Form change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!generatedBarcode || !generatedSku) {
      toast.error('Barcode or SKU not generated');
      return;
    }
    if (!auth.currentUser) {
      toast.error('You must be logged in to add products');
      return;
    }
    setLoading(true);
    try {
      // Upload images
      const imageString = selectedFiles.length > 0 ? await uploadImagesToImgBB(selectedFiles) : '';
      const productData = {
        ...form,
        barcode: generatedBarcode,
        sku: generatedSku,
        description,
        image: imageString,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userData?.name || auth.currentUser.email,
        created_by_uid: auth.currentUser.uid
      };
      await addDoc(collection(firestore, 'products'), productData);
      toast.success('Product added successfully!');
      // Optionally reset form here
    } catch (err) {
      toast.error(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [imagePreviews]);

  return (
    <div className="w-[98%] mx-auto bg-white rounded-lg shadow-lg p-6 h-[185vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold mb-4">Add Product</h2>
        {/* Toggle switch for General/Cosmetic */}
        <div className="flex items-center gap-4 mb-6">
          <span className={`text-sm ${!isCosmeticMode ? 'font-bold' : ''}`}>General</span>
          <Switch
            checked={isCosmeticMode}
            onChange={handleModeChange}
            className={`${
              isCosmeticMode ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
          >
            <span
              className={`${
                isCosmeticMode ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
          <span className={`text-sm ${isCosmeticMode ? 'font-bold' : ''}`}>Cosmetic</span>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {/* Show generated SKU below the toggle or above the form */}
          {showCode && (
            <div className="flex items-center gap-4">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-mono text-sm">
                Barcode: {generatedBarcode}
              </span>
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded font-mono text-sm">
                SKU: {generatedSku}
              </span>
              <button
                className="ml-2 text-gray-500 hover:text-red-600 font-bold"
                onClick={() => setShowCode(false)}
                type="button"
              >
                &times;
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => navigate('/inventory/products')}
          >
            Product List
          </button>
          {canCreate(PERMISSION_PAGES.ADD_PRODUCT) && (
            <button
              onClick={() => setShowUnitList(true)}
              className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
              title="Manage Units"
              type="button"
            >
              <MdInventory className='w-6 h-6' />
            </button>
          )}
        </div>
      </div>
      {showUnitList && (
        <UnitList open={showUnitList} setOpen={setShowUnitList} />
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Information */}
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                name="supplier_id"
                value={form.supplier_id}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required
              >
                <option value="">Select Supplier</option>
                {suppliersList.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.supplier_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
              <input type="text" name="bill_number" value={form.bill_number} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Amount</label>
              <input type="number" step="0.01" name="deal_amount" value={form.deal_amount} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
              <input type="number" step="0.01" name="paid_amount" value={form.paid_amount} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Type</label>
              <select
                name="murukhho"
                value={form.murukhho}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required
              >
                <option value="">Select Type</option>
                {murukhhoOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* Product Information */}
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Product Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                name="product"
                value={form.product || ''}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required
              />
            </div>
            {/* Product Type, Origin, Design, Color, Size, Season, Style, Brand */}
            {getVisibleFields().map(field => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <select
                  name={field.name}
                  value={form[field.name] || ''}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Select {field.label}</option>
                  {unitOptions[field.name]?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        {/* Transaction Details */}
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Transaction Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input type="number" name="quantity" value={form.quantity} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
              <input type="number" step="0.01" name="unit_price" value={form.unit_price} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
              <input type="text" value={form.total_price} className="w-full border rounded p-2 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retail Price</label>
              <input type="number" step="0.01" name="retail_price" value={form.retail_price} onChange={handleChange} className="w-full border rounded p-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
              <input type="text" value={form.percentage ? `${form.percentage}%` : ''} className="w-full border rounded p-2 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date{isCosmeticMode && ' *'}</label>
              <input
                type="date"
                name="manufacture_date"
                value={form.manufacture_date}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required={isCosmeticMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date{isCosmeticMode && ' *'}</label>
              <input
                type="date"
                name="expiry_date"
                value={form.expiry_date}
                onChange={handleChange}
                className="w-full border rounded p-2"
                required={isCosmeticMode}
              />
            </div>
          </div>
        </div>
        {/* Product Images */}
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Product Images</h3>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload Images
            <span className="text-xs text-gray-500 ml-2">
              (Max {MAX_IMAGES} images, 2MB each)
            </span>
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageInputChange}
            className="w-full border rounded p-2"
            disabled={loading || uploading}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {imagePreviews.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`preview-${idx}`}
                className="w-16 h-16 object-cover rounded border"
              />
            ))}
          </div>
          {uploading && <div className="text-blue-600 text-xs">Uploading...</div>}
        </div>
        {/* Product Description */}
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Product Description</h3>
          <div className="border rounded-md">
            <TiptapEditor
              content={description}
              onChange={html => setDescription(html)}
            />
          </div>
        </div>
        {error && (
          <div className="text-red-600 text-sm mb-2">{error}</div>
        )}
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded"
          disabled={!canCreate(PERMISSION_PAGES.ADD_PRODUCT) || loading}
          title={!canCreate(PERMISSION_PAGES.ADD_PRODUCT) ? 'You do not have permission to add products.' : ''}
        >
          {loading ? 'Adding...' : 'Add Product'}
        </button>
      </form>
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar />
    </div>
  );
};

export default AddProduct;