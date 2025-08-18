import React, { useState, useEffect, useRef } from 'react';
import { firestore, auth } from '../../firebase/firebase.config';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import TiptapEditor from '../../components/TiptapEditor';
import { Switch } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { MdInventory } from 'react-icons/md';
import UnitList from '../../components/Inventory/UnitList';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';
import AppLoader from '../../components/AppLoader';

const dropdownFields = [
  'item_type', 'cosmatic_type', 'product_category', 'product_type', 'brand',
  'color', 'design', 'origin', 'season', 'size', 'style', 'stock_type'
];

const FIELD_ALIASES = {
  product_type: ['product_type', 'productType', 'type'],
  origin: ['origin'],
  design: ['design', 'pattern'],
  color: ['color', 'colour'],
  size: ['size'],
  season: ['season'],
  style: ['style'],
  cosmatic_type: ['cosmatic_type', 'cosmetic_type', 'cosmetics_type'],
  item_type: ['item_type', 'itemType', 'category', 'category_type'],
  stock_type: ['stock_type', 'stockType'],
  brand: ['brand'],
};

const murukhhoOptions = [
  { value: 'party', label: 'Party (due purchase)' },
  { value: 'cash purchase', label: 'Cash_Purchase' },
  { value: 'own house', label: 'Own_house' }
];

const MAX_IMAGES = 6;
const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;

const AddProduct = () => {
  const initialForm = {
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
  };
  const [isCosmeticMode, setIsCosmeticMode] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
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
  const formRef = useRef({});

  // Convert FileList to base64 for persistence
  const filesToBase64 = async (files) => {
    const base64Files = [];
    for (const file of files) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
        reader.readAsDataURL(file);
      });
      base64Files.push(base64);
    }
    return base64Files;
  };

  // Convert base64 back to File objects
  const base64ToFiles = (base64Files) => {
    return base64Files.map((base64) => {
      const byteString = atob(base64.data.split(',')[1]);
      const mimeString = base64.type;
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new File([ab], base64.name, { type: mimeString });
    });
  };

  // Load draft from Firestore or localStorage on mount
  useEffect(() => {
    const loadDraft = async () => {
      setIsLoadingDraft(true);
      try {
        if (auth.currentUser) {
          const draftDoc = await getDoc(doc(firestore, 'user_drafts', auth.currentUser.uid));
          if (draftDoc.exists()) {
            const { form: savedForm, isCosmeticMode: savedMode, description: savedDesc, images: savedImages } = draftDoc.data();
            const restoredForm = { ...initialForm, ...savedForm };
            setForm(restoredForm);
            setIsCosmeticMode(savedMode || false);
            setDescription(savedDesc || '');
            if (savedImages && savedImages.length > 0) {
              const restoredFiles = base64ToFiles(savedImages);
              setSelectedFiles(restoredFiles);
            }
            Object.keys(restoredForm).forEach(key => {
              if (formRef.current[key]) {
                formRef.current[key].value = restoredForm[key] || '';
              }
            });
            setIsLoadingDraft(false);
            return;
          }
        }
        const savedDraft = localStorage.getItem('addProductDraft');
        if (savedDraft) {
          try {
            const { form: savedForm, isCosmeticMode: savedMode, description: savedDesc, images: savedImages } = JSON.parse(savedDraft);
            const restoredForm = { ...initialForm, ...savedForm };
            setForm(restoredForm);
            setIsCosmeticMode(savedMode || false);
            setDescription(savedDesc || '');
            if (savedImages && savedImages.length > 0) {
              const restoredFiles = base64ToFiles(savedImages);
              setSelectedFiles(restoredFiles);
            }
            Object.keys(restoredForm).forEach(key => {
              if (formRef.current[key]) {
                formRef.current[key].value = restoredForm[key] || '';
              }
            });
          } catch (err) {
            console.error('Error parsing localStorage draft:', err);
            localStorage.removeItem('addProductDraft');
            toast.error('Failed to load saved form data from local storage');
          }
        }
      } catch (err) {
        console.error('Error loading draft from Firestore:', err);
        toast.error('Failed to load saved form data from server');
      } finally {
        setIsLoadingDraft(false);
      }
    };
    loadDraft();
  }, []);

  // Save draft to Firestore and localStorage on changes
  useEffect(() => {
    const saveDraft = async () => {
      if (isLoadingDraft) return;
      const base64Files = await filesToBase64(selectedFiles);
      const draftData = { form, isCosmeticMode, description, images: base64Files };
      localStorage.setItem('addProductDraft', JSON.stringify(draftData));
      if (auth.currentUser) {
        try {
          await setDoc(doc(firestore, 'user_drafts', auth.currentUser.uid), draftData);
        } catch (err) {
          console.error('Error saving draft to Firestore:', err);
          toast.error('Failed to save form data to server');
        }
      }
    };
    saveDraft();
  }, [form, isCosmeticMode, description, selectedFiles]);

  // Handle logout to ensure draft is saved
  useEffect(() => {
    const handleLogout = async () => {
      if (auth.currentUser) {
        try {
          const base64Files = await filesToBase64(selectedFiles);
          await setDoc(doc(firestore, 'user_drafts', auth.currentUser.uid), {
            form,
            isCosmeticMode,
            description,
            images: base64Files,
          });
        } catch (err) {
          console.error('Error saving draft on logout:', err);
        }
      }
    };
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (!user) handleLogout();
    });
    return () => unsubscribe();
  }, [form, isCosmeticMode, description, selectedFiles]);

  // Restore image previews from selectedFiles
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(newPreviews);
      return () => {
        newPreviews.forEach(url => URL.revokeObjectURL(url));
      };
    } else {
      setImagePreviews([]);
    }
  }, [selectedFiles]);

  // Reset form fields when switching modes
  const handleModeChange = (newMode) => {
    setIsCosmeticMode(newMode);
    setForm(prev => {
      const newForm = {
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
        quantity: '',
        original_qty: '',
        total_price: '',
        percentage: '',
        product: '',
        bill_number: '',
        deal_amount: '',
        paid_amount: '',
        manufacture_date: '',
        expiry_date: '',
        sku: '',
      };
      Object.keys(newForm).forEach(key => {
        if (formRef.current[key]) {
          formRef.current[key].value = newForm[key] || '';
        }
      });
      return newForm;
    });
    setImagePreviews([]);
    setSelectedFiles([]);
    setDescription('');
  };

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const snap = await getDocs(collection(firestore, 'supplier_list'));
        setSuppliersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        toast.error('Failed to load suppliers');
      }
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
        
        const coerceToArray = (value) => {
          if (value == null) return [];
          if (Array.isArray(value)) return value;
          return [value];
        };

        dropdownFields.forEach(field => {
          const aliases = FIELD_ALIASES[field] || [field];
          const collected = [];
          allUnits.forEach(unit => {
            for (const alias of aliases) {
              const raw = unit[alias];
              if (raw !== undefined && raw !== null) {
                const arr = coerceToArray(raw)
                  .map(v => typeof v === 'number' ? String(v) : String(v))
                  .map(v => v.trim())
                  .filter(v => v.length > 0);
                collected.push(...arr);
                break;
              }
            }
          });
          options[field] = Array.from(new Set(collected)).sort((a, b) => a.localeCompare(b));
        });
        
        setUnitOptions(options);
        setForm(prev => {
          const updatedForm = { ...prev };
          dropdownFields.forEach(field => {
            if (prev[field] && !options[field]?.includes(prev[field])) {
              updatedForm[field] = '';
              if (formRef.current[field]) {
                formRef.current[field].value = '';
              }
            }
          });
          return updatedForm;
        });
      } catch (error) {
        console.error('Error fetching product units:', error);
        toast.error('Failed to load product unit options');
      }
    };
    fetchUnits();
  }, []);

  // Real-time barcode generation
  useEffect(() => {
    const productsRef = collection(firestore, 'products');
    const q = query(productsRef, where('barcode', '>=', '19000'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const barcodes = snapshot.docs
        .map(doc => parseInt(doc.data().barcode))
        .filter(code => !isNaN(code));
      const nextNumber = barcodes.length > 0 ? Math.max(...barcodes) + 1 : 19000;
      setGeneratedBarcode(nextNumber.toString());
    }, (error) => {
      console.error('Error listening to barcode updates:', error);
      toast.error('Failed to fetch next barcode');
    });
    return () => unsubscribe();
  }, []);

  // Helper for visible fields
  const getVisibleFields = () => {
    const baseFields = [
      { name: 'product_type', label: 'Product Type' },
      { name: 'brand', label: 'Brand' },
      { name: 'origin', label: 'Origin' },
      { name: 'design', label: 'Design' },
      { name: 'color', label: 'Color' },
      { name: 'size', label: 'Size' },
      { name: 'season', label: 'Season' },
      { name: 'style', label: 'Style' },
    ];
    
    if (isCosmeticMode) {
      return [
        { name: 'product_type', label: 'Product Type' },
        { name: 'cosmatic_type', label: 'Cosmetic Type' },
        { name: 'brand', label: 'Brand' },
        { name: 'origin', label: 'Origin' },
        { name: 'size', label: 'Size' },
        { name: 'season', label: 'Season' },
      ];
    }
    
    return baseFields;
  };

  // SKU generation logic
  useEffect(() => {
    const getFieldPart = (value = '', length = 1) => (value ? value.split('-')[0].slice(0, length).toUpperCase() : '');
    let sku = '';
    if (form.product_type && form.origin && form.size) {
      if (isCosmeticMode) {
        sku = [
          getFieldPart(form.cosmatic_type, 2),
          getFieldPart(form.origin, 1) + getFieldPart(form.product_type, 3),
          getFieldPart(form.season, 1) + getFieldPart(form.size, 3),
          getFieldPart(form.brand, 2)
        ].filter(Boolean).join('-');
      } else {
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
      if (isNaN(qty) || isNaN(unitPrice)) {
        setError('Invalid quantity or unit price');
        return;
      }
      const totalPrice = qty * unitPrice;
      const retailPrice = parseFloat(form.retail_price) || 0;
      setForm(prev => ({
        ...prev,
        total_price: totalPrice.toFixed(2),
        original_qty: prev.original_qty || qty.toString(),
        percentage: retailPrice ? (((retailPrice - unitPrice) / unitPrice) * 100).toFixed(2) : ''
      }));
      setError('');
    }
  }, [form.quantity, form.unit_price, form.retail_price]);

  // User data
  useEffect(() => {
    const fetchUser = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load user data');
      }
    };
    fetchUser();
  }, []);

  // Image input handler
  const handleImageInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setSelectedFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES));
  };

  // Upload images to ImgBB
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
      console.error('Image upload error:', err);
      toast.error('Failed to upload one or more images');
      return '';
    } finally {
      setUploading(false);
    }
  };

  // Form change handler with ref updates
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (formRef.current[name]) {
      formRef.current[name].value = value;
    }
  };

  // Submit handler with validation
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
    if (!form.supplier_id || !form.murukhho || !form.product) {
      toast.error('Please fill all required fields');
      return;
    }
    if (isCosmeticMode && (!form.manufacture_date || !form.expiry_date)) {
      toast.error('Manufacture and expiry dates are required for cosmetic products');
      return;
    }
    setLoading(true);
    try {
      const imageString = selectedFiles.length > 0 ? await uploadImagesToImgBB(selectedFiles) : '';
      const productData = {
        ...form,
        barcode: generatedBarcode,
        sku: generatedSku,
        description,
        image: imageString,
        is_labeled: 'f', // Automatically set is_labeled to "f"
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userData?.name || auth.currentUser.email,
        created_by_uid: auth.currentUser.uid
      };
      await addDoc(collection(firestore, 'products'), productData);
      toast.success('Product added successfully!');
      // Persist form data after submission by updating draft
      const base64Files = await filesToBase64(selectedFiles);
      const draftData = { form, isCosmeticMode, description, images: base64Files };
      localStorage.setItem('addProductDraft', JSON.stringify(draftData));
      if (auth.currentUser) {
        await setDoc(doc(firestore, 'user_drafts', auth.currentUser.uid), draftData);
      }
    } catch (err) {
      console.error('Error adding product:', err);
      toast.error(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  // Clear form handler
  const handleClearForm = async () => {
    setForm(initialForm);
    setDescription('');
    setImagePreviews([]);
    setSelectedFiles([]);
    setIsCosmeticMode(false);
    Object.keys(initialForm).forEach(key => {
      if (formRef.current[key]) {
        formRef.current[key].value = '';
      }
    });
    localStorage.removeItem('addProductDraft');
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(firestore, 'user_drafts', auth.currentUser.uid));
      } catch (err) {
        console.error('Error clearing draft in Firestore:', err);
        toast.error('Failed to clear form data on server');
      }
    }
    toast.info('Form cleared');
  };

  // Render loading state while draft is being fetched
  if (isLoadingDraft) {
    return <AppLoader />;
  }

  return (
    <div className="w-[98%] mx-auto bg-white rounded-lg shadow-lg p-6 h-[185vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold mb-4">Add Product</h2>
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
              <MdInventory className="w-6 h-6" />
            </button>
          )}
          <button
            type="button"
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={handleClearForm}
          >
            Clear Form
          </button>
        </div>
      </div>
      {showUnitList && (
        <UnitList open={showUnitList} setOpen={setShowUnitList} />
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                name="supplier_id"
                value={form.supplier_id}
                onChange={handleChange}
                ref={el => (formRef.current.supplier_id = el)}
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
              <input
                type="text"
                name="bill_number"
                value={form.bill_number}
                onChange={handleChange}
                ref={el => (formRef.current.bill_number = el)}
                className="w-full border rounded p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Amount</label>
              <input
                type="number"
                step="0.01"
                name="deal_amount"
                value={form.deal_amount}
                onChange={handleChange}
                ref={el => (formRef.current.deal_amount = el)}
                className="w-full border rounded p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
              <input
                type="number"
                step="0.01"
                name="paid_amount"
                value={form.paid_amount}
                onChange={handleChange}
                ref={el => (formRef.current.paid_amount = el)}
                className="w-full border rounded p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Type</label>
              <select
                name="murukhho"
                value={form.murukhho}
                onChange={handleChange}
                ref={el => (formRef.current.murukhho = el)}
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
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Product Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                name="product"
                value={form.product || ''}
                onChange={handleChange}
                ref={el => (formRef.current.product = el)}
                className="w-full border rounded p-2"
                required
              />
            </div>
            {getVisibleFields().map(field => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                <select
                  name={field.name}
                  value={form[field.name] || ''}
                  onChange={handleChange}
                  ref={el => (formRef.current[field.name] = el)}
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
        <div>
          <h3 className="text-lg font-semibold mb-2 pb-2 border-b">Transaction Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                ref={el => (formRef.current.quantity = el)}
                className="w-full border rounded p-2"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
              <input
                type="number"
                step="0.01"
                name="unit_price"
                value={form.unit_price}
                onChange={handleChange}
                ref={el => (formRef.current.unit_price = el)}
                className="w-full border rounded p-2"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
              <input
                type="text"
                value={form.total_price}
                className="w-full border rounded p-2 bg-gray-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retail Price</label>
              <input
                type="number"
                step="0.01"
                name="retail_price"
                value={form.retail_price}
                onChange={handleChange}
                ref={el => (formRef.current.retail_price = el)}
                className="w-full border rounded p-2"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
              <input
                type="text"
                value={form.percentage ? `${form.percentage}%` : ''}
                className="w-full border rounded p-2 bg-gray-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacture Date{isCosmeticMode && ' *'}</label>
              <input
                type="date"
                name="manufacture_date"
                value={form.manufacture_date}
                onChange={handleChange}
                ref={el => (formRef.current.manufacture_date = el)}
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
                ref={el => (formRef.current.expiry_date = el)}
                className="w-full border rounded p-2"
                required={isCosmeticMode}
              />
            </div>
          </div>
        </div>
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
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
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