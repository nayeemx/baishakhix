import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import debounce from 'lodash.debounce';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { firestore } from '../../firebase/firebase.config';
import { collection, getDocs, query, orderBy, startAfter, limit } from 'firebase/firestore';
import GenericDeleteComponent from '../../components/GenericDeleteComponent';
import ViewProductsModal from '../../components/Inventory/ViewProductsShop';
import EditProductModal from '../../components/Inventory/EditProductModalShop';
import AddProductModal from '../../components/Inventory/AddProductModal';
import UnitList from '../../components/Inventory/UnitList';
import Loader from '../../components/Loader';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';
import {
  MdInventory,
  MdAddBox,
  MdPrint,
  MdVisibility,
  MdEdit,
  MdDelete,
} from 'react-icons/md';
import { FaFileCsv } from 'react-icons/fa6';

const PAGE_SIZE = 28;

// Fetch all products from Firestore, filter out those with old_barcode or old_sku
async function fetchAllProducts() {
  const productsCol = collection(firestore, 'products');
  let q = query(productsCol, orderBy('created_at', 'desc'), limit(1000));
  let allDocs = [];
  let lastDoc = null;
  while (true) {
    if (lastDoc) {
      q = query(productsCol, orderBy('created_at', 'desc'), startAfter(lastDoc), limit(1000));
    }
    const snap = await getDocs(q);
    allDocs = allDocs.concat(snap.docs);
    if (snap.docs.length < 1000) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return allDocs
    .map(doc => ({ ...doc.data(), id: doc.id }))
    .filter(p => {
      const old_barcode = (p.old_barcode ?? '').toString().trim();
      const old_sku = (p.old_sku ?? '').toString().trim();
      return old_barcode === '' && old_sku === '';
    });
}

// Fetch all suppliers from Firestore
async function fetchAllSuppliers() {
  const suppliersCol = collection(firestore, 'supplier_list');
  const snap = await getDocs(suppliersCol);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

const createSearchIndex = (products) => {
  const searchIndex = new Map();
  products.forEach((product, idx) => {
    const searchableFields = [
      product.product,
      product.barcode,
      product.sku,
      product.quantity,
      product.product_category,
      product.product_type,
      product.brand,
      product.origin,
      product.bill_number,
    ].filter(Boolean);
    searchableFields.forEach(field => {
      const tokens = String(field).toLowerCase().split(/\s+/);
      tokens.forEach(token => {
        if (!searchIndex.has(token)) {
          searchIndex.set(token, new Set());
        }
        searchIndex.get(token).add(idx);
      });
    });
  });
  return searchIndex;
};

function getSupplierByBillNumber(billNumber, products, suppliersList) {
  const product = products.find(p => p.bill_number === billNumber);
  if (!product) return null;
  return suppliersList.find(s => s.id === product.supplier_id) || null;
}

function getBillNumbersBySupplierId(supplierId, products) {
  return Array.from(
    new Set(products.filter(p => p.supplier_id === supplierId).map(p => p.bill_number).filter(Boolean))
  );
}

const PurchaseReport = () => {
  const currentUser = useSelector(state => state.auth?.user);
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [columnVisibility, setColumnVisibility] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState({});
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openUnitList, setOpenUnitList] = useState(false);
  const [editData, setEditData] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    type: '',
    brand: '',
    origin: '',
    bill_number: '',
    supplier_id: '',
    fromDate: '',
    toDate: '',
  });
  const [pageInput, setPageInput] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedBillNumber, setSelectedBillNumber] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: filteredProducts = [], isLoading, isError, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchAllProducts,
  });

  const { data: suppliersList = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: fetchAllSuppliers,
  });

  const filterOptions = useMemo(() => {
    return {
      category: Array.from(new Set(filteredProducts.map(p => p.product_category).filter(Boolean))).sort(),
      type: Array.from(new Set(filteredProducts.map(p => p.product_type).filter(Boolean))).sort(),
      brand: Array.from(new Set(filteredProducts.map(p => p.brand).filter(Boolean))).sort(),
      origin: Array.from(new Set(filteredProducts.map(p => p.origin).filter(Boolean))).sort(),
      bill_number: Array.from(new Set(filteredProducts.map(p => p.bill_number).filter(Boolean))).sort(),
      supplier: suppliersList
        .filter(s => filteredProducts.some(p => p.supplier_id === s.id))
        .map(s => ({ id: s.id, name: s.supplier_name || s.id })),
    };
  }, [filteredProducts, suppliersList]);

  const searchIndex = useMemo(() => 
    createSearchIndex(filteredProducts), 
    [filteredProducts]
  );

  const lookupMaps = useMemo(() => ({
    categories: new Set(filteredProducts.map(p => p.product_category).filter(Boolean)),
    types: new Set(filteredProducts.map(p => p.product_type).filter(Boolean)),
    brands: new Set(filteredProducts.map(p => p.brand).filter(Boolean)),
    origins: new Set(filteredProducts.map(p => p.origin).filter(Boolean)),
    billNumbers: new Set(filteredProducts.map(p => p.bill_number).filter(Boolean)),
    supplierProducts: new Map(
      filteredProducts.map(p => [p.supplier_id, true])
    ),
  }), [filteredProducts]);

  const searchProducts = useCallback((query, products) => {
    if (!query) return products;
    const tokens = Array.from(new Set(query.toLowerCase().split(/\s+/).filter(Boolean)));
    if (tokens.length === 0) return products;
    let matchingIndices = null;
    for (const token of tokens) {
      const matches = searchIndex.get(token) || new Set();
      if (matchingIndices === null) {
        matchingIndices = new Set(matches);
      } else {
        for (const idx of matchingIndices) {
          if (!matches.has(idx)) {
            matchingIndices.delete(idx);
          }
        }
      }
      if (matchingIndices.size === 0) break;
    }
    return matchingIndices && matchingIndices.size > 0
      ? Array.from(matchingIndices).map(idx => products[idx])
      : [];
  }, [searchIndex]);

  const debouncedSetGlobalFilter = useMemo(
    () => debounce((value) => setGlobalFilter(value), 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSetGlobalFilter.cancel();
    };
  }, [debouncedSetGlobalFilter]);

  const tableData = useMemo(() => {
    let data = filteredProducts;
    if (filters.category) {
      data = data.filter(p => p.product_category === filters.category);
    }
    if (filters.type) {
      data = data.filter(p => p.product_type === filters.type);
    }
    if (filters.brand) data = data.filter(p => p.brand === filters.brand);
    if (filters.origin) data = data.filter(p => p.origin === filters.origin);
    if (filters.bill_number) data = data.filter(p => p.bill_number === filters.bill_number);
    if (filters.supplier_id) data = data.filter(p => p.supplier_id === filters.supplier_id);
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      data = data.filter(p => p.created_at && new Date(p.created_at) >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      data = data.filter(p => p.created_at && new Date(p.created_at) <= to);
    }
    if (globalFilter) {
      data = searchProducts(globalFilter, data);
    }
    return data.map(product => {
      const supplier = suppliersList.find(s => s.id === product.supplier_id);
      return {
        ...product,
        supplier_name: supplier ? supplier.supplier_name || supplier.id : 'Not Found',
      };
    });
  }, [filteredProducts, filters, globalFilter, searchProducts, suppliersList]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Dropdown options:', filterOptions);
      console.log('Products shown in table:', filteredProducts.length);
    }
  }, [filterOptions, filteredProducts]);

  const columns = useMemo(
    () => [
      {
        header: 'SL',
        id: 'serial',
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex || 0;
          const pageSize = table.getState().pagination.pageSize || PAGE_SIZE;
          return pageIndex * pageSize + row.index + 1;
        },
        footer: () => 'SL',
      },
      {
        header: 'Supplier Name',
        accessorKey: 'supplier_name',
        footer: props => props.column.id,
      },
      {
        header: 'Product Name',
        accessorKey: 'product',
        footer: props => props.column.id,
      },
      {
        header: 'Barcode',
        accessorKey: 'barcode',
        footer: props => props.column.id,
      },
      {
        header: 'SKU',
        accessorKey: 'sku',
        footer: props => props.column.id,
      },
      {
        header: 'Quantity',
        accessorKey: 'quantity',
        footer: props => props.column.id,
      },
      {
        header: 'Manual Count',
        id: 'manual_count',
        cell: () => '',
        footer: () => '',
        meta: { printOnly: true },
      },
      {
        header: 'Original Quantity',
        accessorKey: 'original_qty',
        footer: props => props.column.id,
        meta: { printOnly: true },
      },
      {
        header: 'Unit Price',
        accessorKey: 'unit_price',
        footer: props => props.column.id,
      },
      {
        header: 'Total Price',
        accessorKey: 'total_price',
        footer: props => props.column.id,
      },
      {
        header: 'Purchase Date',
        accessorKey: 'created_at',
        cell: ({ getValue }) => {
          const date = getValue();
          return date ? new Date(date).toLocaleDateString() : '-';
        },
        footer: props => props.column.id,
      },
      {
        header: 'Created by',
        accessorKey: 'created_by',
        footer: props => props.column.id,
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditData(row.original);
                setOpenView(true);
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-blue-600"
              title="View Product Details"
            >
              <MdVisibility className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">View</span>
            </button>
            {canEdit(PERMISSION_PAGES.PRODUCT_LIST) && (
              <button
                onClick={() => {
                  setEditData(row.original);
                  setOpenEdit(true);
                }}
                className="px-2 py-1 bg-yellow-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-yellow-600"
                title="Edit Product"
              >
                <MdEdit className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {canDelete(PERMISSION_PAGES.PRODUCT_LIST) && (
              <button
                onClick={() => {
                  setDeleteId(row.original.id);
                  setDeleteOpen(true);
                }}
                className="px-2 py-1 bg-red-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-red-600"
                title="Delete Product"
              >
                <MdDelete className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        ),
        footer: props => props.column.id,
      },
    ],
    [canEdit, canDelete]
  );

  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState(0);

  const table = useReactTable({
    data: tableData,
    columns,
    pageCount: Math.ceil(tableData.length / pageSize),
    state: {
      columnVisibility,
      globalFilter,
      rowSelection,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: updater => {
      if (typeof updater === 'function') {
        const next = updater({
          pageIndex,
          pageSize,
        });
        if (typeof next.pageIndex === 'number') setPageIndex(next.pageIndex);
        if (typeof next.pageSize === 'number') setPageSize(next.pageSize);
        setPageInput('');
      } else if (typeof updater === 'object') {
        if (typeof updater.pageIndex === 'number') setPageIndex(updater.pageIndex);
        if (typeof updater.pageSize === 'number') setPageSize(updater.pageSize);
        setPageInput('');
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const handleGoToPage = e => {
    e.preventDefault();
    const page = Number(pageInput);
    if (!isNaN(page) && page > 0 && page <= table.getPageCount()) {
      setPageIndex(page - 1);
    }
  };

  const handleExport = () => {
    const csvColumns = [
      'SL', 'supplier_name', 'product', 'barcode', 'sku', 'quantity', 'original_qty',
      'unit_price', 'total_price', 'created_at', 'created_by', 'bill_number',
      'product_category', 'product_type', 'brand', 'origin', 'id',
    ];
    const csvData = tableData.map((row, idx) => {
      const obj = csvColumns.reduce((acc, col) => {
        if (col === 'SL') {
          acc['SL'] = idx + 1;
        } else if (col === 'created_at') {
          acc[col] = row[col] ? new Date(row[col]).toLocaleDateString() : '';
        } else {
          acc[col] = row[col] !== undefined ? row[col] : '';
        }
        return acc;
      }, {});
      return obj;
    });
    const csv = Papa.unparse({ fields: csvColumns, data: csvData.map(row => csvColumns.map(col => row[col])) });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'purchase_report.csv');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddProduct = () => {
    if (!currentUser) {
      alert('You must be logged in to add a product.');
      navigate('/login');
      return;
    }
    setOpenAdd(true);
  };

  const handleEditProduct = (product) => {
    if (!currentUser) {
      alert('You must be logged in to edit a product.');
      navigate('/login');
      return;
    }
    setEditData(product);
    setOpenEdit(true);
  };

  const handleDeleteProduct = (productId) => {
    if (!currentUser) {
      alert('You must be logged in to delete a product.');
      navigate('/login');
      return;
    }
    setDeleteId(productId);
    setDeleteOpen(true);
  };

  const handleUnitList = () => {
    if (!currentUser) {
      alert('You must be logged in to manage units.');
      navigate('/login');
      return;
    }
    setOpenUnitList(true);
  };

  const allRows = useMemo(() => {
    const startIdx = 0;
    const endIdx = (pageIndex + 1) * pageSize;
    return tableData.slice(startIdx, endIdx);
  }, [tableData, pageIndex, pageSize]);

  const totals = useMemo(() => {
    const sum = (key) =>
      allRows.reduce((acc, row) => {
        const val = Number(row[key]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
    return {
      quantity: sum('quantity'),
      original_qty: sum('original_qty'),
      unit_price: sum('unit_price'),
      total_price: sum('total_price'),
    };
  }, [allRows]);

  function getBDReportTimeString() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bd = new Date(utc + 6 * 60 * 60000);
    const days = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];
    const day = days[bd.getDay()];
    const date = bd.getDate().toString().padStart(2, '0');
    const month = bd.toLocaleString('en-US', { month: 'long' });
    const year = bd.getFullYear();
    let hour = bd.getHours();
    const minute = bd.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'P.M' : 'A.M';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `Generated Report: ${day} ${date} ${month} ${year} | ${hour}.${minute} ${ampm}`;
  }

  // Format date range for print view
  const formatDateRange = () => {
    if (!filters.fromDate && !filters.toDate) return '';
    const from = filters.fromDate ? new Date(filters.fromDate) : null;
    const to = filters.toDate ? new Date(filters.toDate) : null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const formatSingleDate = (date) => {
      if (!date) return '';
      return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
    };
    
    if (from && to) {
      return `${formatSingleDate(from)} to ${formatSingleDate(to)}`;
    } else if (from) {
      return `From ${formatSingleDate(from)}`;
    } else if (to) {
      return `Up to ${formatSingleDate(to)}`;
    }
    return '';
  };

  useEffect(() => {
    if (selectedBillNumber) {
      const supplier = getSupplierByBillNumber(selectedBillNumber, filteredProducts, suppliersList);
      if (supplier) setSelectedSupplierId(supplier.id);
    }
  }, [selectedBillNumber, filteredProducts, suppliersList]);

  useEffect(() => {
    if (selectedSupplierId) {
      const bills = getBillNumbersBySupplierId(selectedSupplierId, filteredProducts);
      if (selectedBillNumber && !bills.includes(selectedBillNumber)) {
        setSelectedBillNumber('');
      }
    }
  }, [selectedSupplierId, selectedBillNumber, filteredProducts]);

  useEffect(() => {
    setFilters(f => ({
      ...f,
      supplier_id: selectedSupplierId,
      bill_number: selectedBillNumber,
    }));
  }, [selectedSupplierId, selectedBillNumber]);

  if (isLoading) return (
    <div className="relative top-[40vh]">
      <Loader />
    </div>
  );
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div className="p-2 sm:p-4 w-[100vw] xl:w-[82vw]">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between print-hide gap-2">
        <h1 className="text-lg sm:text-xl font-semibold">
          Purchase Report ({filteredProducts.length})
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleUnitList}
            className="p-2 sm:p-3 bg-slate-700 text-white rounded cursor-pointer hover:bg-slate-800"
            title="Manage Units"
          >
            <MdInventory className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          {canCreate(PERMISSION_PAGES.PRODUCT_LIST) && (
            <button
              onClick={handleAddProduct}
              className="p-2 sm:p-3 bg-slate-700 text-white rounded cursor-pointer hover:bg-slate-800"
              title="Add New Product"
            >
              <MdAddBox className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <button
            onClick={handleExport}
            className="p-2 sm:p-3 bg-slate-700 text-white rounded cursor-pointer hover:bg-slate-800"
            title="Export to CSV"
          >
            <FaFileCsv className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={handlePrint}
            className="p-2 sm:p-3 bg-slate-700 text-white rounded cursor-pointer hover:bg-slate-800"
            title="Print Report"
          >
            <MdPrint className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
      <div className="print-report-time text-center text-sm sm:text-base font-medium mb-2 print:block hidden">
        {getBDReportTimeString()}
      </div>
      <div className="print-header hidden print:block text-center text-lg font-bold mb-4">
        Purchase Report ({filteredProducts.length}) {formatDateRange()}
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={e => debouncedSetGlobalFilter(e.target.value)}
          className="border p-2 rounded w-full text-sm sm:text-base print:hidden"
        />
      </div>
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 print-hide">
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
        >
          <option value="">All Categories</option>
          {filterOptions.category.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
        >
          <option value="">All Types</option>
          {filterOptions.type.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.brand}
          onChange={e => setFilters(f => ({ ...f, brand: e.target.value }))}
        >
          <option value="">All Brands</option>
          {filterOptions.brand.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.origin}
          onChange={e => setFilters(f => ({ ...f, origin: e.target.value }))}
        >
          <option value="">All Origins</option>
          {filterOptions.origin.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={selectedSupplierId}
          onChange={e => setSelectedSupplierId(e.target.value)}
        >
          <option value="">All Suppliers</option>
          {filterOptions.supplier.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <select
          className="border p-2 rounded text-sm sm:text-base"
          value={selectedBillNumber}
          onChange={e => setSelectedBillNumber(e.target.value)}
        >
          <option value="">All Bill Numbers</option>
          {(selectedSupplierId
            ? getBillNumbersBySupplierId(selectedSupplierId, filteredProducts)
            : filterOptions.bill_number
          ).map(bn => (
            <option key={bn} value={bn}>{bn}</option>
          ))}
        </select>
        <input
          type="date"
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.fromDate}
          onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))}
          placeholder="From Date"
        />
        <input
          type="date"
          className="border p-2 rounded text-sm sm:text-base"
          value={filters.toDate}
          onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))}
          placeholder="To Date"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-xs sm:text-sm print-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  if (header.column.id === 'actions') {
                    return (
                      <th
                        key={header.id}
                        className="border px-1 py-1 sm:px-2 sm:py-1 text-left print-hide"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column?.columnDef?.header ?? '',
                              header.getContext()
                            )}
                      </th>
                    );
                  }
                  if (
                    header.column.id === 'manual_count' ||
                    header.column.id === 'original_qty'
                  ) {
                    return (
                      <th
                        key={header.id}
                        className="border px-1 py-1 sm:px-2 sm:py-1 text-left print-only"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column?.columnDef?.header ?? '',
                              header.getContext()
                            )}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={header.id}
                      className={`border px-1 py-1 sm:px-2 sm:py-1 text-left ${header.column.id === 'sku' ? 'text-nowrap' : ''}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column?.columnDef?.header ?? '',
                            header.getContext()
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  if (cell.column.id === 'actions') {
                    return (
                      <td key={cell.id} className="border px-1 py-1 sm:px-2 sm:py-1 print-hide">
                        {cell.column.id === 'actions' ? (
                          <div className="flex sm:flex-row gap-2">
                            <button
                              onClick={() => {
                                setEditData(row.original);
                                setOpenView(true);
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-blue-600"
                              title="View Product Details"
                            >
                              <MdVisibility className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            {canEdit(PERMISSION_PAGES.PRODUCT_LIST) && (
                              <button
                                onClick={() => handleEditProduct(row.original)}
                                className="px-2 py-1 bg-yellow-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-yellow-600"
                                title="Edit Product"
                              >
                                <MdEdit className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                            )}
                            {canDelete(PERMISSION_PAGES.PRODUCT_LIST) && (
                              <button
                                onClick={() => handleDeleteProduct(row.original.id)}
                                className="px-2 py-1 bg-red-500 text-white rounded cursor-pointer flex items-center justify-center text-sm hover:bg-red-600"
                                title="Delete Product"
                              >
                                <MdDelete className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          flexRender(cell.column?.columnDef?.cell ?? '', cell.getContext())
                        )}
                      </td>
                    );
                  }
                  if (
                    cell.column.id === 'manual_count' ||
                    cell.column.id === 'original_qty'
                  ) {
                    return (
                      <td key={cell.id} className="border px-1 py-1 sm:px-2 sm:py-1 print-only">
                        {cell.column.id === 'manual_count'
                          ? ''
                          : flexRender(cell.column?.columnDef?.cell ?? '', cell.getContext())}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={cell.id}
                      className={`border px-1 py-1 sm:px-2 sm:py-1 ${cell.column.id === 'sku' ? 'text-nowrap' : ''}`}
                    >
                      {flexRender(cell.column?.columnDef?.cell ?? '', cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="font-bold bg-gray-100">
              <td className="border px-1 py-1 sm:px-2 sm:py-1" colSpan={5}>Total (Carryover up to this page):</td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1">{totals.quantity}</td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1 print-only"></td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1 print-only">{totals.original_qty}</td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1"></td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1">{totals.total_price}</td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1"></td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1"></td>
              <td className="border px-1 py-1 sm:px-2 sm:py-1 print-hide"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 print-hide">
        <div className="text-xs sm:text-sm text-gray-500">
          Showing {table.getRowModel().rows.length} of {tableData.length} filtered products ({filteredProducts.length} total)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'<<'}
          </button>
          <button
            onClick={() => setPageIndex(old => Math.max(0, old - 1))}
            disabled={pageIndex === 0}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'<'}
          </button>
          <span className="text-xs sm:text-sm">
            Page{' '}
            <strong>
              {pageIndex + 1} of {table.getPageCount()}
            </strong>
          </span>
          <form onSubmit={handleGoToPage} className="inline">
            <input
              type="number"
              min={1}
              max={table.getPageCount()}
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              className="border rounded w-12 p-1 text-center text-xs sm:text-sm"
              placeholder="Go"
            />
          </form>
          <button
            onClick={() => setPageIndex(old => Math.min(table.getPageCount() - 1, old + 1))}
            disabled={pageIndex >= table.getPageCount() - 1}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'>'}
          </button>
          <button
            onClick={() => setPageIndex(table.getPageCount() - 1)}
            disabled={pageIndex >= table.getPageCount() - 1}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'>>'}
          </button>
          <select
            className="border rounded p-1 text-xs sm:text-sm"
            value={pageSize}
            onChange={e => {
              const newSize = Number(e.target.value);
              setPageSize(newSize);
              setPageIndex(0);
              setPageInput('');
            }}
          >
            {[10, 20, 28, 50, 100].map(size => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>
          <span className="text-xs sm:text-sm text-gray-500">
            {table.getRowModel().rows.length} record(s) in this page
          </span>
        </div>
      </div>
      <GenericDeleteComponent
        open={deleteOpen}
        setOpen={setDeleteOpen}
        id={deleteId}
        queryClient={queryClient}
        collectionName="products"
        currentUser={currentUser}
      />
      <ViewProductsModal
        open={openView}
        setOpen={setOpenView}
        data={editData}
        suppliersList={suppliersList}
        className="fixed inset-0 flex items-center justify-center z-50"
      />
      <EditProductModal
        open={openEdit}
        setOpen={setOpenEdit}
        data={editData}
        suppliersList={suppliersList}
        queryClient={queryClient}
      />
      <AddProductModal
        open={openAdd}
        setOpen={setOpenAdd}
        suppliersList={suppliersList}
        queryClient={queryClient}
        className="fixed inset-0 flex items-center justify-center z-50"
      />
      <UnitList open={openUnitList} setOpen={setOpenUnitList} />
      <style>
        {`
          @media print {
            .print-hide {
              display: none !important;
            }
            .print-only {
              display: table-cell !important;
            }
            .print-table {
              width: 100% !important;
              font-size: 12px !important;
            }
            th, td {
              border: 1px solid #000 !important;
              padding: 4px !important;
            }
            .print-header {
              display: block !important;
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 16px;
            }
            .print-report-time {
              display: block !important;
              text-align: center;
              font-size: 15px;
              font-weight: 500;
              margin-bottom: 8px;
            }
          }
          @media screen {
            .print-header {
              display: none;
            }
            .print-report-time {
              display: none;
            }
            .print-only {
              display: none !important;
            }
          }
          @media (max-width: 640px) {
            .text-nowrap {
              white-space: nowrap;
            }
            table {
              display: block;
              overflow-x: auto;
              white-space: nowrap;
            }
            th, td {
              min-width: 80px;
            }
            .actions {
              min-width: 120px;
            }
          }
        `}
      </style>
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar />
    </div>
  );
};

export default PurchaseReport;