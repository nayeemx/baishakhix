import React, { useEffect, useState, useMemo, useCallback } from "react";
import { firestore } from "../../firebase/firebase.config";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { FaTable, FaTrashAlt, FaSpinner, FaDatabase, FaExclamationCircle } from "react-icons/fa";
import { useSelector } from "react-redux";
import debounce from "lodash.debounce";
import GenericDeleteComponent from '../../components/GenericDeleteComponent';

// List your known Firestore collections here
const KNOWN_COLLECTIONS = [
  "products",
  "supplier_list",
  "uploads",
  "users",
  "delete_traces",
  "product_units",
  // Add more collection names here as your app grows
];

const Database = () => {
  const [tables, setTables] = useState(KNOWN_COLLECTIONS);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: "success", message: "" });
  const [deleteConfig, setDeleteConfig] = useState({
    open: false,
    id: null,
    collectionName: null
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [tableError, setTableError] = useState(null);
  const currentUser = useSelector((state) => state.auth?.user);
  const darkMode = useSelector((state) => state.theme.darkMode);
  
  // Use currentUser.role directly instead of role state
  const isSuperUser = currentUser?.role === 'super_user';

  // Fetch tables (collections) - static list for Firestore
  useEffect(() => {
    // To see new tables, update meta/collections document with the new collection names.
    // This is a Firestore limitation: client SDK cannot list all root collections.
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const metaDoc = await getDoc(doc(firestore, "meta", "collections"));
        if (metaDoc.exists()) {
          const names = metaDoc.data().names;
          if (Array.isArray(names) && names.length > 0) {
            setTables(names);
          } else {
            setTables(KNOWN_COLLECTIONS);
          }
        } else {
          setTables(KNOWN_COLLECTIONS);
        }
      } catch (err) {
        setTables(KNOWN_COLLECTIONS);
      }
      setLoading(false);
    };
    fetchCollections();
  }, []);

  // Fetch docs for selected table
  useEffect(() => {
    if (!selectedTable) {
      setTableData([]);
      return;
    }
    const fetchDocs = async () => {
      setLoadingData(true);
      setTableError(null);
      try {
        const docsSnap = await getDocs(collection(firestore, selectedTable));
        setTableData(
          docsSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      } catch (err) {
        setTableError("Failed to fetch table data: " + err.message);
      }
      setLoadingData(false);
    };
    fetchDocs();
  }, [selectedTable]);

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const handleDeleteTable = async (tableName) => {
    if (!isSuperUser) {
      toast.error("You do not have permission to delete tables.");
      return;
    }

    if (tableName === "users") {
      toast.error("The users table cannot be deleted for security reasons.");
      return;
    }

    try {
      setLoadingData(true);
      // 1. Get all documents in the collection
      const snapshot = await getDocs(collection(firestore, tableName));
      
      // 2. Delete in batches since Firestore has limits
      const batchSize = 500;
      const batches = [];
      let batch = writeBatch(firestore);
      let operationCount = 0;

      // Create delete operations in batches
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        operationCount++;

        if (operationCount === batchSize) {
          batches.push(batch.commit());
          batch = writeBatch(firestore);
          operationCount = 0;
        }
      }

      // Commit any remaining operations
      if (operationCount > 0) {
        batches.push(batch.commit());
      }

      // Execute all batches
      await Promise.all(batches);

      // 3. Log the deletion in delete_traces
      await addDoc(collection(firestore, 'delete_traces'), {
        deleted_collection: tableName,
        deleted_by: currentUser?.displayName || currentUser?.email || currentUser?.uid,
        deleted_by_uid: currentUser?.uid,
        deleted_at: serverTimestamp(),
        reason: `Collection ${tableName} deleted by admin`
      });

      toast.success(`Table "${tableName}" deleted successfully`);
      
      // 4. Update UI
      setTables(prev => prev.filter(t => t !== tableName));
      if (selectedTable === tableName) {
        setSelectedTable("");
        setTableData([]);
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      toast.error(`Failed to delete table: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteRecord = async (id, tableName) => {
    if (!isSuperUser) {
      toast.error("You do not have permission to delete records.");
      return;
    }

    // Special handling for users table
    if (tableName === "users") {
      try {
        const userDoc = await getDoc(doc(firestore, 'users', id));
        const userData = userDoc.data();
        
        if (userData?.role === 'super_user') {
          toast.error("Super users cannot be deleted.");
          return;
        }
      } catch (err) {
        console.error("Error checking user role:", err);
        toast.error("Error verifying user permissions");
        return;
      }
    }

    setDeleteConfig({
      open: true,
      id: id,
      collectionName: tableName
    });
  };

  const confirmDelete = async () => {
    const { type, id } = itemToDelete;
    setLoadingData(true);

    try {
      if (type === "table") {
        // Delete all docs in the collection
        const docsSnap = await getDocs(collection(firestore, id));
        await Promise.all(
          docsSnap.docs.map((d) => deleteDoc(doc(firestore, id, d.id)))
        );
        toast.success(`Table "${id}" deleted successfully.`);
        showNotification("success", `Table "${id}" deleted successfully.`);
        setTables((prev) => prev.filter((t) => t !== id));
        if (selectedTable === id) {
          setTableData([]);
          setSelectedTable("");
        }
      } else {
        await deleteDoc(doc(firestore, selectedTable, id));
        toast.success("Record deleted successfully.");
        showNotification("success", "Record deleted successfully.");
        setTableData((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (error) {
      toast.error("Error deleting item.");
      showNotification("error", "Error deleting item.");
    } finally {
      setLoadingData(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleSearchChange = useCallback(
    debounce((value) => setSearchQuery(value), 300),
    []
  );

  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    let baseCols = Object.keys(tableData[0]).filter((key) => key !== "id");
    return baseCols;
  }, [tableData, selectedTable]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return tableData;
    return tableData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [tableData, searchQuery]);

  return (
    <div className="min-h-screen">
      {notification.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            notification.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          <p className="font-medium">{notification.message}</p>
        </div>
      )}

      <GenericDeleteComponent
        open={deleteConfig.open}
        setOpen={(isOpen) => setDeleteConfig(prev => ({ ...prev, open: isOpen }))}
        id={deleteConfig.id}
        collectionName={deleteConfig.collectionName}
        currentUser={currentUser}
        queryClient={{
          invalidateQueries: async () => {
            // Refresh data after delete
            if (selectedTable === deleteConfig.collectionName) {
              const snap = await getDocs(collection(firestore, selectedTable));
              setTableData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
            // If a table was deleted, refresh tables list
            if (deleteConfig.id === deleteConfig.collectionName) {
              setTables(prev => prev.filter(t => t !== deleteConfig.id));
              if (selectedTable === deleteConfig.id) {
                setSelectedTable("");
                setTableData([]);
              }
            }
          }
        }}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Firestore Database Viewer</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tables */}
          <div className={`rounded-lg shadow-md p-4 lg:col-span-1 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Database Tables</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{tables.length} Tables</span>
            </div>

            {loading && tables.length === 0 ? (
              <div className="flex justify-center py-8">
                <FaSpinner className="animate-spin text-blue-500 text-2xl" />
              </div>
            ) : (
              <ul className="space-y-2">
                {tables.map((table) => (
                  <li key={table} className="relative">
                    <div
                      className={`flex justify-between items-center p-3 rounded cursor-pointer ${
                        selectedTable === table
                          ? "bg-blue-100 text-blue-700 font-semibold dark:bg-blue-900 dark:text-blue-300"
                          : `${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`
                      }`}
                      onClick={() => setSelectedTable(table)}
                    >
                      <div className="flex items-center space-x-2">
                        <FaTable />
                        <span className="truncate">{table}</span>
                      </div>
                      {isSuperUser && (
                        <button
                          className="text-red-500 hover:text-red-700"
                          title={`Delete table ${table}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete the entire "${table}" table? This cannot be undone.`)) {
                              handleDeleteTable(table);
                            }
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Table Data */}
          <div
            className={`rounded-lg shadow-md p-6 lg:col-span-3 flex flex-col ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {selectedTable ? `Data: ${selectedTable}` : "Select a table to view data"}
              </h2>
              <input
                type="text"
                placeholder="Search..."
                className={`border rounded px-3 py-1 text-sm ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                    : "border-gray-300 text-gray-800"
                }`}
                onChange={(e) => handleSearchChange(e.target.value)}
                disabled={!selectedTable}
              />
            </div>

            {tableError && (
              <div className="flex flex-col justify-center items-center h-48 text-red-500">
                <FaExclamationCircle className="text-4xl mb-2" />
                <span>{tableError}</span>
              </div>
            )}

            {!selectedTable ? (
              <div className="flex justify-center items-center h-48 text-gray-500">
                <FaDatabase className="text-4xl mr-2" />
                <span>No table selected.</span>
              </div>
            ) : loadingData ? (
              <div className="flex justify-center items-center h-48 text-blue-600">
                <FaSpinner className="animate-spin text-4xl" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-48 text-gray-500">
                <FaExclamationCircle className="text-4xl mb-2" />
                <span>No records found.</span>
              </div>
            ) : (
              // Add horizontal scroll for wide tables
              <div className="flex-1 overflow-x-auto border rounded">
                {/* Table header */}
                <div
                  className={`flex items-center border-b px-4 py-2 font-semibold text-sm min-w-max ${
                    darkMode ? "border-gray-600 text-gray-300 bg-gray-700" : "border-gray-200 text-gray-800 bg-gray-100"
                  }`}
                  style={{ minWidth: columns.length * 180 + (isSuperUser ? 60 : 0) }}
                >
                  {columns.map((col) => (
                    <div key={col} className="min-w-[180px] max-w-[320px] truncate px-2">
                      {col}
                    </div>
                  ))}
                  {isSuperUser && (
                    <div className="w-10 flex-shrink-0 px-2">Actions</div>
                  )}
                </div>
                {/* Render rows with .map instead of <List> */}
                <div>
                  {filteredData.map((row, index) => (
                    <div
                      key={row.id}
                      className={`flex items-center border-b px-4 text-sm min-w-max ${
                        darkMode ? "border-gray-600 text-gray-200" : "border-gray-200 text-gray-800"
                      } ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                      style={{ minHeight: 40 }}
                    >
                      {columns.map((col) => (
                        <div
                          key={`${row.id}-${col}`}
                          className="min-w-[180px] max-w-[320px] px-2 whitespace-nowrap overflow-x-auto"
                          style={{ overflowX: "auto" }}
                          title={
                            typeof row[col] === "object"
                              ? JSON.stringify(row[col])
                              : String(row[col])
                          }
                        >
                          {typeof row[col] === "object"
                            ? <span className="font-mono text-xs">{JSON.stringify(row[col], null, 2)}</span>
                            : String(row[col])}
                        </div>
                      ))}
                      {isSuperUser && (
                        <button
                          className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                          title="Delete record"
                          onClick={() => handleDeleteRecord(row.id, selectedTable)}
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Database;