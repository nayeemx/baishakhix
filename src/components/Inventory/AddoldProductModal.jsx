import { useState, useEffect } from 'react';
import { firestore, auth } from '../../firebase/firebase.config';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import TiptapEditor from '../TiptapEditor';
import { Switch } from '@headlessui/react';
import Loader from '../AppLoader'; // <-- Add this import

const dropdownFields = [
  "item_type",
  "cosmatic_type",
  "product_category",
  "product_type",
  "brand",
  "color",
  "design",
  "origin",
  "season",
  "size",
  "style",
  "stock_type"
];

const murukhhoOptions = [
  { value: 'party', label: 'Party (due purchase)' },
  { value: 'cash purchase', label: 'Cash_Purchase' },
  { value: 'own house', label: 'Own_house' }
];

const MAX_IMAGES = 6;
const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;

// Extract prefix from value (e.g., "8M-GRABADINE" -> "8M")
const getPrefix = (str = '') => {
  if (!str) return '';
  const match = str.match(/^([^-]+)-/);
  return match ? match[1] : str;
};

// Add these helper functions at the top
const getFirstChars = (str = '') => {
  if (!str) return '';
  const parts = str.split(/[\s]/);  // Split only by spaces, not hyphens
  
  return parts.map(part => {
    // Look for pattern like "01-", "02-", "2-" etc.
    const match = part.match(/^(\d+)-(.+)/);
    if (!match) return part; // No number prefix, return whole part

    const [, num, text] = match;
    const length = parseInt(num);
    return num + '-' + text.slice(0, length); // Keep prefix and hyphen
  }).join('');
};

// Update helper text to show actual format from available options
const getHelperText = (field, options = []) => {
  const example = options[0] || ''; // Get first available option as example
  if (!example) return '';
  
  return `Format example: ${example}`;
};

// Define fixed character lengths for each field
const FIELD_LENGTHS = {
  general: {
    product_type: 2,    // e.g., "8M" from "8M-GRABADINE"
    origin: 1,          // e.g., "1" from "1-LOCAL"
    design: 1,          // e.g., "A" from "A-CHECK"
    color: 2,           // e.g., "03" from "03-MERUN"
    size: 2,            // e.g., "A1" from "A1-27"
    season: 1,          // e.g., "5" from "5-ALL"
    style: 1,           // e.g., "A" from "A-FORMAL"
  },
  cosmetic: {
    product_type: 2,    // e.g., "8B" from "8B-SHAMPOO"
    origin: 1,          // e.g., "1" from "1-LOCAL"
    cosmatic_type: 2,   // e.g., "C" from "C-TYPE"
    season: 1,          // e.g., "5" from "5-SUMMER"
    size: 2,            // e.g., "A1" from "A1-27"
    style: 1,           // e.g., "B" from "B-USE"
  }
};

// Extract exact number of characters from field value
const getFieldPart = (value = '', length = 1) => {
  if (!value) return '';
  // Extract everything before the hyphen
  const prefix = value.split('-')[0];
  return prefix.slice(0, length);
};

// Add new constant for localStorage keys
const STORAGE_KEYS = {
  general: 'lastGeneralProductInputs',
  cosmetic: 'lastCosmeticProductInputs'
};

const AddoldProductModal = ({ open, setOpen, suppliersList, queryClient }) => {
  const [isCosmeticMode, setIsCosmeticMode] = useState(false);
  const [form, setForm] = useState({
    item_type: 'General', // Default to General
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
    stock_type: 'new_product', // Default value
    quantity: '',
    original_qty: '', // Same as quantity initially
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
    old_barcode: '', // <-- add this
    old_sku: '',     // <-- add this
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unitOptions, setUnitOptions] = useState({});
  const [uploading, setUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [description, setDescription] = useState('');
  const [showCode, setShowCode] = useState(true);
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [generatedSku, setGeneratedSku] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]); // Add this state
  const [selectedFiles, setSelectedFiles] = useState([]); // New state for storing files
  const [userData, setUserData] = useState(null);

  // Fetch and filter dropdown options
  useEffect(() => {
    if (!open) return;
    const fetchUnits = async () => {
      try {
        const unitsSnap = await getDocs(collection(firestore, 'product_units'));
        const options = {};
        
        // Filter new products only
        const validUnits = unitsSnap.docs
          .map(doc => doc.data())
          .filter(unit => unit.stock_type === 'new_product');

        // If in cosmetic mode, further filter by item_type
        const filteredUnits = isCosmeticMode 
          ? validUnits.filter(unit => unit.item_type === 'Cosmatic')
          : validUnits.filter(unit => unit.item_type !== 'Cosmatic');

        // Get unique values for each field
        dropdownFields.forEach(field => {
          options[field] = [...new Set(
            filteredUnits
              .map(u => u[field])
              .filter(v => v && v.trim() !== '')
          )].sort();
        });
        setUnitOptions(options);
      } catch (err) {
        console.error('Error fetching units:', err);
      }
    };
    fetchUnits();
  }, [open, isCosmeticMode]); // Added isCosmeticMode as dependency

  // Get visible fields based on mode
  const getVisibleFields = () => {
    const commonFields = [
      "product_category",
      "brand",
      "origin",
      "season",
      "size",
    ];

    if (isCosmeticMode) {
      return [
        ...commonFields,
        "product_type",
        "cosmatic_type",
        "style"
      ];
    }
    return [
      ...commonFields,
      "product_type",
      "color",
      "design",
      "style"
    ];
  };

  // --- Helper for Product Info fields ---
  const renderProductInfoFields = () => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
        <input type="text" name="product" value={form.product || ''} onChange={handleChange} className="w-full border rounded p-2" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
        <select
          name="origin"
          value={form.origin || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Origin</option>
          {unitOptions.origin?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
        <select
          name="season"
          value={form.season || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Season</option>
          {unitOptions.season?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isCosmeticMode ? 'Cosmetic Type' : 'Product Type'}
        </label>
        <select
          name={isCosmeticMode ? "cosmatic_type" : "product_type"}
          value={isCosmeticMode ? form.cosmatic_type : form.product_type}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select {isCosmeticMode ? 'Cosmetic Type' : 'Product Type'}</option>
          {(isCosmeticMode ? unitOptions.cosmatic_type : unitOptions.product_type)?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
        <select
          name="product_category"
          value={form.product_category || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Product Category</option>
          {unitOptions.product_category?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
        <select
          name="brand"
          value={form.brand || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Brand</option>
          {unitOptions.brand?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      {/* Only show Design and Color if not cosmetic */}
      {!isCosmeticMode && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Design</label>
            <select
              name="design"
              value={form.design || ''}
              onChange={handleChange}
              className="w-full border rounded p-2"
            >
              <option value="">Select Design</option>
              {unitOptions.design?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <select
              name="color"
              value={form.color || ''}
              onChange={handleChange}
              className="w-full border rounded p-2"
            >
              <option value="">Select Color</option>
              {unitOptions.color?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {isCosmeticMode ? 'Use Place' : 'Style'}
        </label>
        <select
          name="style"
          value={form.style || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
        >
          <option value="">{isCosmeticMode ? 'Select Use Place' : 'Select Style'}</option>
          {unitOptions.style?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
        <select
          name="size"
          value={form.size || ''}
          onChange={handleChange}
          className="w-full border rounded p-2"
          required
        >
          <option value="">Select Size</option>
          {unitOptions.size?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );

  // Create renderFormSections function
  const renderFormSections = () => (
    <>
      {/* General Information Section */}
      <div className="col-span-2 mb-6">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">General Information</h3>
        <div className="grid grid-cols-2 gap-4">
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
              {suppliersList?.map(sup => (
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

      {/* Product Information Section */}
      <div className="col-span-2 mb-6">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Product Information</h3>
        {renderProductInfoFields()}
      </div>

      {/* Transactional Section */}
      <div className="col-span-2 mb-6">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Transaction Details</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manufacture Date {isCosmeticMode && <span className="text-red-500">*</span>}
            </label>
            <input type="date" name="manufacture_date" value={form.manufacture_date} onChange={handleChange} className="w-full border rounded p-2" required={isCosmeticMode} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date {isCosmeticMode && <span className="text-red-500">*</span>}
            </label>
            <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange} className="w-full border rounded p-2" required={isCosmeticMode} />
          </div>
        </div>
      </div>
    </>
  );

  // Simplified image input handler - just store files
  const handleImageInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setSelectedFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES));
    // Create local preview URLs
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
        if (result.success) {
          urls.push(result.data.url);
        }
      }
      return urls.join(','); // Return comma-separated string
    } catch (err) {
      console.error('Image upload error:', err);
      throw new Error('Failed to upload one or more images');
    } finally {
      setUploading(false);
    }
  };

  // Get next barcode number
  const getNextBarcode = async () => {
    try {
      const productsRef = collection(firestore, 'products');
      const q = query(productsRef, where('barcode', '>=', '19000'));
      const snapshot = await getDocs(q);
      
      const barcodes = snapshot.docs
        .map(doc => parseInt(doc.data().barcode))
        .filter(code => !isNaN(code));
      
      const nextNumber = barcodes.length > 0 
        ? Math.max(...barcodes) + 1 
        : 19000;
      
      return nextNumber.toString();
    } catch (err) {
      console.error('Error getting next barcode:', err);
      return '19000';
    }
  };

  // Replace existing generateSku function
  const generateSku = () => {
    if (!form.product_type || !form.origin || !form.size) return '';

    if (isCosmeticMode) {
      // SKU pattern for cosmetics: PT-OC-SS-ST
      // PT = Product Type (2 chars)
      // O = Origin (1 char)
      // C = Cosmetic Type (1 char)
      // S = Season (1 char)
      // S = Size (2 chars)
      // ST = Style (1 char)
      const parts = [
        getFieldPart(form.product_type, FIELD_LENGTHS.cosmetic.product_type),
        getFieldPart(form.origin, FIELD_LENGTHS.cosmetic.origin) + 
          getFieldPart(form.cosmatic_type, FIELD_LENGTHS.cosmetic.cosmatic_type),
        getFieldPart(form.season, FIELD_LENGTHS.cosmetic.season) + 
          getFieldPart(form.size, FIELD_LENGTHS.cosmetic.size),
        getFieldPart(form.style, FIELD_LENGTHS.cosmetic.style)
      ];
      return parts.filter(Boolean).join('-');
    }

    // SKU pattern for general: PT-OD-CS-SS
    // PT = Product Type (2 chars)
    // O = Origin (1 char)
    // D = Design (1 char)
    // C = Color (2 chars)
    // S = Size (2 chars)
    // S = Season (1 char)
    // S = Style (1 char)
    const parts = [
      getFieldPart(form.product_type, FIELD_LENGTHS.general.product_type),
      getFieldPart(form.origin, FIELD_LENGTHS.general.origin) + 
        getFieldPart(form.design, FIELD_LENGTHS.general.design),
      getFieldPart(form.color, FIELD_LENGTHS.general.color) + 
        getFieldPart(form.size, FIELD_LENGTHS.general.size),
      getFieldPart(form.season, FIELD_LENGTHS.general.season) + 
        getFieldPart(form.style, FIELD_LENGTHS.general.style)
    ];
    return parts.filter(Boolean).join('-');
  };

  // Update SKU when form changes
  useEffect(() => {
    const sku = generateSku();
    setGeneratedSku(sku);
  }, [form, isCosmeticMode]);

  // Get initial barcode when modal opens
  useEffect(() => {
    if (open) {
      getNextBarcode().then(setGeneratedBarcode);
    }
  }, [open]);

  // Load last used values when modal opens
  useEffect(() => {
    if (!open) return;
    
    try {
      const storageKey = isCosmeticMode ? STORAGE_KEYS.cosmetic : STORAGE_KEYS.general;
      const savedInputs = JSON.parse(localStorage.getItem(storageKey) || '{}');
      
      // Only update fields that exist in savedInputs
      setForm(prev => ({
        ...prev,
        ...savedInputs,
        item_type: isCosmeticMode ? 'Cosmatic' : 'General', // Always set correct item_type
        stock_type: 'new_product' // Always set default stock_type
      }));
    } catch (err) {
      console.error('Error loading saved inputs:', err);
    }
  }, [open, isCosmeticMode]);

  // Save inputs when form changes
  useEffect(() => {
    const storageKey = isCosmeticMode ? STORAGE_KEYS.cosmetic : STORAGE_KEYS.general;
    localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form, isCosmeticMode]);

  // Modify generateSku to handle duplicates
  const generateUniqueSkuWithCounter = async (baseSku) => {
    try {
      // Query for SKUs that start with the base SKU
      const skuQuery = query(
        collection(firestore, 'products'),
        where('sku', '>=', baseSku),
        where('sku', '<=', baseSku + '\uf8ff')
      );
      
      const snapshot = await getDocs(skuQuery);
      const existingSkus = snapshot.docs.map(doc => doc.data().sku);
      
      if (!existingSkus.includes(baseSku)) {
        return baseSku;
      }

      // Find highest counter
      let maxCounter = 0;
      existingSkus.forEach(sku => {
        const match = sku.match(new RegExp(`^${baseSku}-([0-9]+)$`));
        if (match) {
          maxCounter = Math.max(maxCounter, parseInt(match[1]));
        }
      });

      return `${baseSku}-${maxCounter + 1}`;
    } catch (err) {
      console.error('Error checking SKU uniqueness:', err);
      return baseSku; // Fallback to base SKU
    }
  };

  // Modify handleSubmit
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
      // Get unique SKU
      const uniqueSku = await generateUniqueSkuWithCounter(generatedSku);

      // Upload images and get comma-separated URLs
      const imageString = selectedFiles.length > 0 ? 
        await uploadImagesToImgBB(selectedFiles) : '';

      const productData = {
        ...form,
        barcode: generatedBarcode,
        sku: uniqueSku,
        description,
        image: imageString,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userData?.name || auth.currentUser.email,
        created_by_uid: auth.currentUser.uid
      };

      await addDoc(collection(firestore, 'products'), productData);
      queryClient?.invalidateQueries(['products']);
      toast.success(
        <div>
          Product added successfully!<br/>
          Barcode: {generatedBarcode}<br/>
          SKU: {uniqueSku}
        </div>
      );
      setOpen(false);
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
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imagePreviews]);

  // Handle change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle toggle change
  const handleModeToggle = (checked) => {
    setIsCosmeticMode(checked);
    // Update item_type and reset related fields
    setForm(prev => ({
      ...prev,
      item_type: checked ? 'Cosmatic' : 'General',
      // Reset fields that don't apply to the new mode
      cosmatic_type: checked ? prev.cosmatic_type : '',
      color: checked ? '' : prev.color,
      design: checked ? '' : prev.design,
      // Keep common fields
      product_category: prev.product_category,
      brand: prev.brand,
      origin: prev.origin,
      season: prev.season,
      size: prev.size,
      style: prev.style,
      stock_type: prev.stock_type
    }));
  };

  // Add price calculation effect
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

  // Add effect to fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUser();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-11/12 h-[98vh] overflow-auto p-6">
        {/* Show loader overlay when loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
            <Loader />
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Add Product</h2>
            {generatedBarcode && (
              <div className="text-sm text-gray-600">
                Barcode: <span className="font-mono">{generatedBarcode}</span>
              </div>
            )}
            {generatedSku && (
              <div className="text-sm text-gray-600">
                SKU: <span className="font-mono">{generatedSku}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-sm ${!isCosmeticMode ? 'font-bold' : ''}`}>General</span>
            <Switch
              checked={isCosmeticMode}
              onChange={handleModeToggle} // Use new handler
              className={`${
                isCosmeticMode ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            >
              <span className={`${
                isCosmeticMode ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
            </Switch>
            <span className={`text-sm ${isCosmeticMode ? 'font-bold' : ''}`}>Cosmetic</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            {/* Add old_barcode and old_sku fields at the top */}
            <div className="col-span-2 mb-2 flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Old Barcode</label>
                <input
                  type="text"
                  name="old_barcode"
                  value={form.old_barcode}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  placeholder="Enter old barcode"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Old SKU</label>
                <input
                  type="text"
                  name="old_sku"
                  value={form.old_sku}
                  onChange={handleChange}
                  className="w-full border rounded p-2"
                  placeholder="Enter old SKU"
                />
              </div>
            </div>
            {/* Remove General Information section */}
            {/* Product Information */}
            <div className="col-span-2 mb-6">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Product Information</h3>
              {renderProductInfoFields()}
            </div>

            {/* Transactional */}
            <div className="col-span-2 mb-6">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Transaction Details</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacture Date {isCosmeticMode && <span className="text-red-500">*</span>}
                  </label>
                  <input type="date" name="manufacture_date" value={form.manufacture_date} onChange={handleChange} className="w-full border rounded p-2" required={isCosmeticMode} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date {isCosmeticMode && <span className="text-red-500">*</span>}
                  </label>
                  <input type="date" name="expiry_date" value={form.expiry_date} onChange={handleChange} className="w-full border rounded p-2" required={isCosmeticMode} />
                </div>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="col-span-2 mb-6">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Product Images</h3>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Images 
                <span className="text-xs text-gray-500 ml-2">
                  (Max {MAX_IMAGES} images, 2MB each)
                </span>
                {uploading && <span className="text-blue-500 ml-2">Uploading...</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageInputChange}
                className="w-full border rounded p-2 mb-2"
                disabled={loading || uploading}
              />
              {/* Image Previews */}
              <div className="grid grid-cols-6 gap-2">
                {imagePreviews.map((url, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (url.startsWith('blob:')) {
                          URL.revokeObjectURL(url);
                        }
                        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                        setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Description Section */}
            <div className="col-span-2">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Product Description</h3>
              <div className="border rounded-md">
                <TiptapEditor
                  content={description}
                  onChange={html => setDescription(html)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-gray-300 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddoldProductModal;