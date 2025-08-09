import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import debounce from 'lodash.debounce'
import { saveAs } from 'file-saver'
import Papa from 'papaparse'
import { firestore } from '../../firebase/firebase.config'
import { collection, getDocs, query, orderBy, startAfter, limit } from 'firebase/firestore'
import Loader from '../../components/Loader'
import {
  MdInventory,
  MdAddBox,
  MdPrint,
} from "react-icons/md";
import { FaFileCsv } from "react-icons/fa6";
import OldunitList from '../../components/Inventory/OldunitList';
import AddoldProductModal from '../../components/Inventory/AddoldProductModal';
import GenericDeleteComponent from '../../components/GenericDeleteComponent';
import { useSelector } from 'react-redux';
import { MdVisibility, MdEdit, MdDelete } from "react-icons/md";
import ViewOldProductModal from '../../components/Inventory/ViewOldProductModal';
import EditOldProductModal from '../../components/Inventory/EditOldProductModal';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';

const PAGE_SIZE = 28

// Fetch only products with both old_barcode and old_sku present and non-empty
async function fetchOldProducts() {
  const productsCol = collection(firestore, 'products')
  let q = query(productsCol, orderBy('created_at', 'desc'), limit(1000))
  let allDocs = []
  let lastDoc = null
  while (true) {
    if (lastDoc) {
      q = query(productsCol, orderBy('created_at', 'desc'), startAfter(lastDoc), limit(1000))
    }
    const snap = await getDocs(q)
    allDocs = allDocs.concat(snap.docs)
    if (snap.docs.length < 1000) break
    lastDoc = snap.docs[snap.docs.length - 1]
  }
  return allDocs
    .map(doc => ({ ...doc.data(), id: doc.id }))
    .filter(p => {
      const old_barcode = (p.old_barcode ?? '').toString().trim()
      const old_sku = (p.old_sku ?? '').toString().trim()
      return old_barcode !== '' && old_sku !== ''
    })
}

const OldProduct = () => {
  const [globalFilter, setGlobalFilter] = useState('')
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageInput, setPageInput] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    type: '',
    brand: '',
    origin: '',
    bill_number: '',
    supplier_id: '',
    fromDate: '',
    toDate: '',
  })
  const [showOldUnitModal, setShowOldUnitModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [suppliersList, setSuppliersList] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const currentUser = useSelector(state => state.auth?.user);
  const { canCreate, canEdit, canDelete } = usePermissions();

  const debouncedSetGlobalFilter = useMemo(
    () => debounce((value) => setGlobalFilter(value), 300),
    []
  )
  useEffect(() => () => debouncedSetGlobalFilter.cancel(), [debouncedSetGlobalFilter])

  const { data: products = [], isLoading, isError, error } = useQuery({
    queryKey: ['old-products'],
    queryFn: fetchOldProducts,
  })

  // Filter dropdown options
  const filterOptions = useMemo(() => {
    return {
      category: Array.from(new Set(products.map(p => p.product_category).filter(Boolean))).sort(),
      type: Array.from(new Set(products.map(p => p.product_type).filter(Boolean))).sort(),
      brand: Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort(),
      origin: Array.from(new Set(products.map(p => p.origin).filter(Boolean))).sort(),
      bill_number: Array.from(new Set(products.map(p => p.bill_number).filter(Boolean))).sort(),
    }
  }, [products])

  // Table data (apply UI filters)
  const tableData = useMemo(() => {
    let data = products
    if (filters.category) data = data.filter(p => p.product_category === filters.category)
    if (filters.type) data = data.filter(p => p.product_type === filters.type)
    if (filters.brand) data = data.filter(p => p.brand === filters.brand)
    if (filters.origin) data = data.filter(p => p.origin === filters.origin)
    if (filters.bill_number) data = data.filter(p => p.bill_number === filters.bill_number)
    if (filters.fromDate) {
      const from = new Date(filters.fromDate)
      data = data.filter(p => p.created_at && new Date(p.created_at) >= from)
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate)
      data = data.filter(p => p.created_at && new Date(p.created_at) <= to)
    }
    if (globalFilter) {
      const lower = globalFilter.toLowerCase()
      data = data.filter(p =>
        [p.product, p.barcode, p.sku, p.old_barcode, p.old_sku]
          .some(field => field && field.toString().toLowerCase().includes(lower))
      )
    }
    return data
  }, [products, filters, globalFilter])

  // Calculate totals for the current page
  const allRows = useMemo(() => {
    const startIdx = pageIndex * pageSize;
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
      unit_price: sum('unit_price'),
    };
  }, [allRows]);

  const columns = useMemo(
    () => [
      {
        header: 'SL',
        id: 'serial',
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex || 0
          const pageSize = table.getState().pagination.pageSize || PAGE_SIZE
          return pageIndex * pageSize + row.index + 1
        },
      },
      { header: 'Name', accessorKey: 'product' },
      { header: 'Barcode', accessorKey: 'barcode' },
      { header: 'SKU', accessorKey: 'sku' },
      { header: 'Old Barcode', accessorKey: 'old_barcode' },
      { header: 'Old SKU', accessorKey: 'old_sku' },
      { header: 'Quantity', accessorKey: 'quantity' },
      { header: 'Unit Price', accessorKey: 'unit_price' },
      { 
        header: 'Created At', 
        accessorKey: 'created_at',
        cell: ({ getValue }) => {
          const date = getValue();
          return date ? new Date(date).toLocaleDateString() : '-';
        },
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2 print-hide">
            <button
              className="p-1 rounded bg-blue-100 hover:bg-blue-200"
              title="View"
              onClick={() => {
                setViewProduct(row.original);
                setViewOpen(true);
              }}
            >
              <MdVisibility className="w-5 h-5 text-blue-600" />
            </button>
            {canEdit(PERMISSION_PAGES.OLD_PRODUCT) && (
              <button
                className="p-1 rounded bg-yellow-100 hover:bg-yellow-200"
                title="Edit"
                onClick={() => {
                  setEditProduct(row.original);
                  setEditOpen(true);
                }}
              >
                <MdEdit className="w-5 h-5 text-yellow-600" />
              </button>
            )}
            {canDelete(PERMISSION_PAGES.OLD_PRODUCT) && (
              <button
                className="p-1 rounded bg-red-100 hover:bg-red-200"
                title="Delete"
                onClick={() => {
                  setDeleteId(row.original.id);
                  setDeleteOpen(true);
                }}
              >
                <MdDelete className="w-5 h-5 text-red-600" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canEdit, canDelete]
  )

  const table = useReactTable({
    data: tableData,
    columns,
    pageCount: Math.ceil(tableData.length / pageSize),
    state: {
      globalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: updater => {
      if (typeof updater === 'function') {
        const next = updater({ pageIndex, pageSize })
        if (typeof next.pageIndex === 'number') setPageIndex(next.pageIndex)
        if (typeof next.pageSize === 'number') setPageSize(next.pageSize)
        setPageInput('')
      } else if (typeof updater === 'object') {
        if (typeof updater.pageIndex === 'number') setPageIndex(updater.pageIndex)
        if (typeof updater.pageSize === 'number') setPageSize(updater.pageSize)
        setPageInput('')
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  })

  const handleGoToPage = e => {
    e.preventDefault()
    const page = Number(pageInput)
    if (!isNaN(page) && page > 0 && page <= table.getPageCount()) {
      setPageIndex(page - 1)
    }
  }

  // CSV Export
  const handleExport = () => {
    const csvColumns = [
      "SL", "product", "barcode", "sku", "old_barcode", "old_sku", "quantity", "unit_price", "created_at"
    ]
    const csvData = tableData.map((row, idx) => {
      const obj = csvColumns.reduce((acc, col) => {
        if (col === "SL") {
          acc["SL"] = idx + 1
        } else if (col === "created_at") {
          acc[col] = row[col] ? new Date(row[col]).toLocaleDateString() : ''
        } else {
          acc[col] = row[col] !== undefined ? row[col] : ""
        }
        return acc
      }, {})
      return obj
    })
    const csv = Papa.unparse({ fields: csvColumns, data: csvData.map(row => csvColumns.map(col => row[col])) })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'old_products.csv')
  }

  // Print handler
  const handlePrint = () => {
    window.print()
  }

  // Fetch suppliers when modal opens
  useEffect(() => {
    if (!showAddProductModal) return;
    setSuppliersLoading(true);
    getDocs(collection(firestore, "supplier_list"))
      .then(snap => {
        setSuppliersList(
          snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      })
      .catch(() => setSuppliersList([]))
      .finally(() => setSuppliersLoading(false));
  }, [showAddProductModal]);

  // Report time for print
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

  if (isLoading) return (
    <div className="relative top-[40vh]">
      <Loader />
    </div>
  )
  if (isError) return <div>Error: {error.message}</div>

  return (
    <div className="p-4 w-[100vw] xl:w-[82vw]">
      <div className="mb-4 flex flex-col items-center space-y-4 md:flex-row md:justify-between md:space-y-0 print-hide">
        <h1 className="text-xl font-semibold">
          Old Products: {products.length}
        </h1>
        <div className="flex gap-2">
          {canCreate(PERMISSION_PAGES.OLD_PRODUCT) && (
            <button
              onClick={() => setShowOldUnitModal(true)}
              className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
              title="Manage Units"
            >
              <MdInventory className='w-6 h-6' />
            </button>
          )}
          {canCreate(PERMISSION_PAGES.OLD_PRODUCT) && (
            <button
              onClick={() => setShowAddProductModal(true)}
              className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
              title="Add Old Product"
            >
              <MdAddBox className='w-6 h-6' />
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
            title="Export to CSV"
          >
            <FaFileCsv className='w-6 h-6' />
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
            title="Print List"
          >
            <MdPrint className='w-6 h-6' />
          </button>
        </div>
      </div>
      <div className="print-report-time text-center text-sm sm:text-base font-medium mb-2 print:block hidden">
        {getBDReportTimeString()}
      </div>
      <div className="print-header hidden print:block text-center text-lg font-bold mb-4">
        Old Products ({products.length})
      </div>
      <div>
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={e => debouncedSetGlobalFilter(e.target.value)}
          className="border p-2 rounded w-full mb-4 text-sm sm:text-base print:hidden"
        />
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2 print-hide">
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
          value={filters.bill_number}
          onChange={e => setFilters(f => ({ ...f, bill_number: e.target.value }))}
        >
          <option value="">All Bill Numbers</option>
          {filterOptions.bill_number.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
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
      <div className="overflow-auto">
        <table className="min-w-full border text-xs sm:text-sm print-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className={`border px-2 py-1 text-left ${header.column.id === 'actions' ? 'print-hide' : ''}`}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column?.columnDef?.header ?? '',
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={`border px-2 py-1 ${cell.column.id === 'actions' ? 'print-hide' : ''}`}>
                    {flexRender(cell.column?.columnDef?.cell ?? '', cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-bold bg-gray-100">
              <td className="border px-2 py-1" colSpan={6}>Total (Carryover up to this page):</td>
              <td className="border px-2 py-1">{totals.quantity}</td>
              <td className="border px-2 py-1">{totals.unit_price}</td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1 print-hide"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col items-center md:flex-row md:justify-between gap-2 print-hide">
        <div className="text-xs sm:text-sm text-gray-500">
          Showing {table.getRowModel().rows.length} of {tableData.length} filtered products ({products.length} total)
        </div>
        <div className="flex gap-2 items-center flex-col md:flex-row">
          <button
            onClick={() => setPageIndex(0)}
            disabled={pageIndex === 0}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'<<'}
          </button>
          <button
            onClick={() => setPageIndex(old => Math.max(0, old - 1))}
            disabled={pageIndex === 0}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
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
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'>'}
          </button>
          <button
            onClick={() => setPageIndex(table.getPageCount() - 1)}
            disabled={pageIndex >= table.getPageCount() - 1}
            className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400"
          >
            {'>>'}
          </button>
          <select
            className="border rounded p-1 text-xs sm:text-sm ml-2"
            value={pageSize}
            onChange={e => {
              const newSize = Number(e.target.value)
              setPageSize(newSize)
              setPageIndex(0)
              setPageInput('')
            }}
          >
            {[10, 20, 28, 50, 100].map(size => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>
          <span className="ml-2 text-xs sm:text-sm text-gray-500">
            {table.getRowModel().rows.length} record(s) in this page
          </span>
        </div>
      </div>
      {showOldUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[900px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowOldUnitModal(false)}
              title="Close"
            >
              &times;
            </button>
            <OldunitList />
          </div>
        </div>
      )}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[900px] max-w-full max-h-[98vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowAddProductModal(false)}
              title="Close"
            >
              &times;
            </button>
            {suppliersLoading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader />
              </div>
            ) : (
              <AddoldProductModal
                open={showAddProductModal}
                setOpen={setShowAddProductModal}
                suppliersList={suppliersList}
                queryClient={{ invalidateQueries: () => {} }}
              />
            )}
          </div>
        </div>
      )}
      {viewOpen && viewProduct && (
        <ViewOldProductModal
          open={viewOpen}
          setOpen={setViewOpen}
          product={viewProduct}
        />
      )}
      {editOpen && editProduct && (
        <EditOldProductModal
          open={editOpen}
          setOpen={setEditOpen}
          product={editProduct}
        />
      )}
      <GenericDeleteComponent
        open={deleteOpen}
        setOpen={setDeleteOpen}
        id={deleteId}
        collectionName="products"
        currentUser={currentUser}
        queryClient={{ invalidateQueries: () => {} }}
      />
      <style>
        {`
          @media print {
            .print-hide {
              display: none !important;
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
          }
          @media (max-width: 640px) {
            table {
              display: block;
              overflow-x: auto;
              white-space: nowrap;
            }
            th, td {
              min-width: 80px;
            }
          }
        `}
      </style>
    </div>
  )
}

export default OldProduct