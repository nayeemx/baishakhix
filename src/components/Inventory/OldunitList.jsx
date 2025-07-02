import React, { useEffect, useState, useMemo } from "react";
import { firestore } from "../../firebase/firebase.config";
import { collection, getDocs } from "firebase/firestore";
import Loader from '../Loader';
import GenericDeleteComponent from '../GenericDeleteComponent';
import { MdEdit, MdDelete } from "react-icons/md";
import { FaFileCsv } from "react-icons/fa6";
import { useSelector } from 'react-redux';
import EditoldUnit from './EditoldUnit';
import AddoldUnit from './AddoldUnit';
import AddoldProductModal from './AddoldProductModal';
import Papa from "papaparse";
import {
  MdInventory,
  MdAddBox,
} from "react-icons/md";

const PAGE_SIZE = 12;

const columns = [
  { key: "cosmatic_type", label: "Cosmetic Type" },
  { key: "product_category", label: "Category" },
  { key: "product_type", label: "Type" },
  { key: "brand", label: "Brand" },
  { key: "color", label: "Color" },
  { key: "design", label: "Design" },
  { key: "origin", label: "Origin" },
  { key: "season", label: "Season" },
  { key: "size", label: "Size" },
  { key: "style", label: "Style" },
  { key: "stock_type", label: "Stock Type" },
  { key: "item_type", label: "Item Type" },
  { key: "created_at", label: "Created At" },
  { key: "created_by", label: "Created By" },
  { key: "updated_at", label: "Updated At" },
  { key: "updated_by", label: "Updated By" },
];

const OldunitList = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [addOldUnitOpen, setAddOldUnitOpen] = useState(false);
  const [addOldProductOpen, setAddOldProductOpen] = useState(false);
  // Add suppliers state
  const [suppliersList, setSuppliersList] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const currentUser = useSelector(state => state.auth?.user);

  useEffect(() => {
    const fetchUnits = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(firestore, "product_units"));
        const filtered = snap.docs
          .map(doc => ({ ...doc.data(), docId: doc.id }))
          .filter(unit => unit.stock_type === "old_product");
        setUnits(filtered);
      } catch (error) {
        setUnits([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, []);

  // Fetch suppliers from Firestore
  useEffect(() => {
    if (!addOldProductOpen) return;
    setSuppliersLoading(true);
    getDocs(collection(firestore, "supplier_list"))
      .then(snap => {
        setSuppliersList(
          snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      })
      .catch(() => setSuppliersList([]))
      .finally(() => setSuppliersLoading(false));
  }, [addOldProductOpen]);

  const filteredUnits = useMemo(() => {
    if (!search) return units;
    const lower = search.toLowerCase();
    return units.filter(unit =>
      columns.some(col =>
        (unit[col.key] || "")
          .toString()
          .toLowerCase()
          .includes(lower)
      )
    );
  }, [units, search]);

  const pageCount = Math.ceil(filteredUnits.length / PAGE_SIZE);
  const pagedUnits = filteredUnits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInput);
    if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber <= pageCount) {
      setPage(pageNumber - 1); // Convert to 0-based index
      setPageInput('');
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (!units.length) return;
    // Ensure item_type is next to stock_type in the export columns
    const exportColumns = [
      ...columns
        .filter(col => col.key !== "item_type" && col.key !== "stock_type")
        .map(col => col.key)
    ];
    // Insert stock_type and item_type in order
    const stockTypeIdx = columns.findIndex(col => col.key === "stock_type");
    const itemTypeIdx = columns.findIndex(col => col.key === "item_type");
    // Place stock_type, then item_type
    exportColumns.splice(stockTypeIdx, 0, "stock_type");
    exportColumns.splice(stockTypeIdx + 1, 0, "item_type");

    const csvData = units.map(unit =>
      exportColumns.reduce((acc, key) => {
        acc[key] = unit[key] || "";
        return acc;
      }, {})
    );
    const csv = Papa.unparse({
      fields: exportColumns,
      data: csvData.map(row => exportColumns.map(col => row[col]))
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "old_units.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // If you use react-query, get the queryClient, otherwise use a stub
  // const queryClient = useQueryClient();
  const queryClient = { invalidateQueries: () => {} };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div>
        <h2 className="text-lg font-bold mb-4">Old Product Units</h2>
      
      <input
        type="text"
        className="border rounded px-3 py-1 w-64 mb-4"
        placeholder="Search units..."
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
          onClick={() => setAddOldUnitOpen(true)}
          title="Add Old Unit"
        >
          <MdInventory className='w-6 h-6' />
        </button>
        <button
          className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
          onClick={() => setAddOldProductOpen(true)}
          title="Add Old Product"
        >
          <MdAddBox className='w-6 h-6' />
        </button>
        <button
          className="px-4 py-2 bg-slate-700 text-white rounded cursor-pointer"
          onClick={handleExportCSV}
          title="Export to CSV"
        >
          <FaFileCsv className="w-6 h-6" />
        </button>
      </div>
      </div>
      {loading ? (
        <Loader />
      ) : pagedUnits.length === 0 ? (
        <div className="text-center text-gray-400 py-4">No old product units found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">#</th>
                {columns.map(col => (
                  <th key={col.key} className="border px-2 py-1">{col.label}</th>
                ))}
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedUnits.map((unit, idx) => (
                <tr key={unit.docId}>
                  <td className="border px-2 py-1">{page * PAGE_SIZE + idx + 1}</td>
                  {columns.map(col => (
                    <td key={`${unit.docId}-${col.key}`} className="border px-2 py-1">
                      {unit[col.key] || ""}
                    </td>
                  ))}
                  <td className="border px-2 py-1">
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                        title="Edit Unit"
                        onClick={() => {
                          setEditData(unit);
                          setEditOpen(true);
                        }}
                      >
                        <MdEdit className="w-5 h-5" />
                      </button>
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                        title="Delete Unit"
                        onClick={() => {
                          setDeleteId(unit.docId);
                          setDeleteOpen(true);
                        }}
                      >
                        <MdDelete className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <span className="text-xs text-gray-500">
          Showing {pagedUnits.length} of {filteredUnits.length} unit(s)
        </span>
        <div className="flex gap-2 items-center">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            {"<<"}
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            {"<"}
          </button>
          <span>
            Page <strong>{page + 1}</strong> of <strong>{pageCount}</strong>
          </span>
          <form onSubmit={handleGoToPage} className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max={pageCount}
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              className="border rounded w-14 px-2 py-1 text-center"
              placeholder="Go"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
              disabled={!pageInput || pageInput < 1 || pageInput > pageCount}
            >
              Go
            </button>
          </form>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            {">"}
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(pageCount - 1)}
            disabled={page >= pageCount - 1}
          >
            {">>"}
          </button>
        </div>
      </div>
      {/* Delete Modal */}
      <GenericDeleteComponent
        open={deleteOpen}
        setOpen={setDeleteOpen}
        id={deleteId}
        collectionName="product_units"
        currentUser={currentUser}
        queryClient={{
          invalidateQueries: () => {
            // Refresh units after delete
            // Just refetch units
            setLoading(true);
            getDocs(collection(firestore, "product_units")).then(snap => {
              const filtered = snap.docs
                .map(doc => ({ ...doc.data(), docId: doc.id }))
                .filter(unit => unit.stock_type === "old_product");
              setUnits(filtered);
              setLoading(false);
            });
          }
        }}
      />
      {/* Edit Modal */}
      <EditoldUnit
        open={editOpen}
        setOpen={setEditOpen}
        unitData={editData}
        onSuccess={() => {
          setLoading(true);
          getDocs(collection(firestore, "product_units")).then(snap => {
            const filtered = snap.docs
              .map(doc => ({ ...doc.data(), docId: doc.id }))
              .filter(unit => unit.stock_type === "old_product");
            setUnits(filtered);
            setLoading(false);
          });
        }}
      />
      {/* Add Old Unit Modal */}
      <AddoldUnit
        open={addOldUnitOpen}
        setOpen={setAddOldUnitOpen}
        onSuccess={() => {
          setLoading(true);
          getDocs(collection(firestore, "product_units")).then(snap => {
            const filtered = snap.docs
              .map(doc => ({ ...doc.data(), docId: doc.id }))
              .filter(unit => unit.stock_type === "old_product");
            setUnits(filtered);
            setLoading(false);
          });
        }}
      />
      {/* Add Old Product Modal */}
      {addOldProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setAddOldProductOpen(false)}
              title="Close"
            >
              &times;
            </button>
            {/* Show loader while suppliers are loading */}
            {suppliersLoading ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <Loader />
              </div>
            ) : (
              <AddoldProductModal
                open={addOldProductOpen}
                setOpen={setAddOldProductOpen}
                suppliersList={suppliersList}
                queryClient={queryClient}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OldunitList;