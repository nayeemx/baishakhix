import React, { useEffect, useState, useMemo } from "react";
import { firestore } from "../../firebase/firebase.config";
import { collection, getDocs } from "firebase/firestore";
import Papa from "papaparse";
import EditUnit from './EditUnit'
import Loader from '../Loader'
import GenericDeleteComponent from '../GenericDeleteComponent'
import AddProductModal from './AddProductModal'
import AddUnit from './AddUnit';
import { useSelector } from 'react-redux'
import { TbLayoutGridAdd } from "react-icons/tb";
import {
  MdAddBox,
  MdEdit,
  MdDelete,
} from "react-icons/md";
import { FaFileCsv } from "react-icons/fa6";

const PAGE_SIZE = 12;

const columns = [
  { key: "item_type", label: "Item Type" },
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
  { key: "created_at", label: "Created At" },
  { key: "created_by", label: "Created By" },
  { key: "updated_at", label: "Updated At" },
  { key: "updated_by", label: "Updated By" },
];

const exportColumns = [
  { key: "id", label: "ID" },
  { key: "item_type", label: "Item Type" },
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
  { key: "created_at", label: "Created At" },
  { key: "created_by", label: "Created By" },
  { key: "updated_at", label: "Updated At" },
  { key: "updated_by", label: "Updated By" },
];

const UnitList = ({ open, setOpen }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState('');
  const [editData, setEditData] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [openAddUnit, setOpenAddUnit] = useState(false);
  const currentUser = useSelector(state => state.auth?.user);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(firestore, "product_units"));
      const sortedUnits = snap.docs
        .map(doc => ({ 
          ...doc.data(),
          docId: doc.id
        }))
        .sort((a, b) => {
          // Sort by created_at in descending order (newest first)
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
      setUnits(sortedUnits);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchUnits();
  }, [open]);

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

  const handleExport = async () => {
    try {
      const snap = await getDocs(collection(firestore, "product_units"));
      const allUnits = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const csvData = allUnits.map(unit => 
        exportColumns.reduce((acc, col) => {
          acc[col.label] = unit[col.key] || "";
          return acc;
        }, {})
      );

      const csv = Papa.unparse({
        fields: exportColumns.map(col => col.label),
        data: csvData.map(row => exportColumns.map(col => row[col.label]))
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "units.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export failed.");
    }
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const pageNumber = parseInt(pageInput);
    if (!isNaN(pageNumber) && pageNumber > 0 && pageNumber <= pageCount) {
      setPage(pageNumber - 1); // Convert to 0-based index
      setPageInput('');
    }
  };

  const handleDelete = (unitId) => {
    setDeleteId(unitId);
    setDeleteOpen(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[900px] max-w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Manage Units</h2>
          <button
            className="text-gray-500 hover:text-red-600 text-xl"
            onClick={() => setOpen(false)}
            title="Close"
          >
            &times;
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            className="border rounded px-3 py-1 w-64"
            placeholder="Search units..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <button
            className="px-4 py-1 bg-green-600 text-white rounded"
            onClick={() => setOpenAddUnit(true)}
            title="Add Unit List"
          >
            <TbLayoutGridAdd className="w-6 h-6" />
          </button>
          <button
            className="px-4 py-1 bg-blue-600 text-white rounded"
            onClick={() => setOpenAddProduct(true)}
            title="Add Product"
          >
            <MdAddBox className='w-6 h-6' />
          </button>
          <button
            className="px-4 py-1 bg-gray-700 text-white rounded"
            onClick={handleExport}
            title="Export to CSV" // Added tooltip
          >
            <FaFileCsv className="w-6 h-6" />
          </button>
        </div>
        <div>
          {loading ? (
            <Loader />
          ) : pagedUnits.length === 0 ? (
            <div className="text-center text-gray-400 py-4">No units found.</div>
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
                            onClick={() => {
                              setEditData({
                                ...unit,
                                docId: unit.docId
                              });
                              setOpenEdit(true);
                            }}
                            className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                            title="Edit Unit"
                          >
                            <MdEdit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(unit.docId)}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                            title="Delete Unit"
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
        </div>
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
            <form onSubmit={handleGoToPage} className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={pageCount}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="border rounded w-16 px-2 py-1 text-center"
                placeholder="Page"
              />
              <button 
                type="submit"
                className="px-2 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                disabled={!pageInput || pageInput < 1 || pageInput > pageCount}
              >
                Go
              </button>
            </form>
          </div>
        </div>
        <EditUnit 
          open={openEdit}
          setOpen={setOpenEdit}
          unitData={editData}
          onSuccess={fetchUnits}
        />
        <GenericDeleteComponent
          open={deleteOpen}
          setOpen={setDeleteOpen}
          id={deleteId}
          collectionName="product_units"
          currentUser={currentUser}
          queryClient={{
            invalidateQueries: () => {
              fetchUnits();
            }
          }}
        />
        <AddProductModal
          open={openAddProduct}
          setOpen={setOpenAddProduct}
          suppliersList={[]} // Pass your suppliers list here if needed
          queryClient={{
            invalidateQueries: () => {
              fetchUnits();
            }
          }}
        />
        <AddUnit 
          open={openAddUnit}
          setOpen={setOpenAddUnit}
          onSuccess={fetchUnits}
        />
      </div>
    </div>
  );
};

export default UnitList;