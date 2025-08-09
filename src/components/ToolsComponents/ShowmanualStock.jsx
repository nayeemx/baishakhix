import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { firestore } from '../../firebase/firebase.config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { FiX, FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import AppLoader from '../AppLoader';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600 text-center">
          <p>Something went wrong: {this.state.error.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 bg-blue-500 text-white px-2 py-1 rounded"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ShowmanualStock = ({ open, onClose }) => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('barcode');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('All Users');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [countStockInput, setCountStockInput] = useState('');

  const { user } = useSelector((state) => state.auth);
  const loggedInUser = user ? user.name : null;

  useEffect(() => {
    if (open && loggedInUser) {
      const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
          const stockQuerySnapshot = await getDocs(collection(firestore, 'manual_product'));
          const stockDataArray = stockQuerySnapshot.docs.map(doc => {
            const docData = doc.data();
            let costingValue = docData.costing;
            if (costingValue === undefined || costingValue === null) {
              costingValue = '0';
            } else if (typeof costingValue !== 'string') {
              costingValue = costingValue.toString();
            }
            let numericCosting = parseFloat(costingValue.replace(/[^0-9.-]/g, '')) || 0;

            return {
              id: doc.id.toString(),
              barcode: doc.id,
              costing: costingValue,
              numericCosting: numericCosting,
              qty: docData.qty || 0,
              sku: docData.sku || 'N/A',
              totalCosting: (docData.qty || 0) * numericCosting,
              countStock: docData.countStock || 'N/A'
            };
          });
          const uniqueStockData = Array.from(new Set(stockDataArray.map(item => item.id)))
            .map(id => stockDataArray.find(item => item.id === id));
          setStockData(uniqueStockData);
          setTotalRecords(uniqueStockData.length);

          const usersQuerySnapshot = await getDocs(collection(firestore, 'users'));
          const usersArray = usersQuerySnapshot.docs.map(doc => doc.data().name || 'Unknown');
          const uniqueUsers = ['All Users', ...new Set(usersArray)];
          setUsers(uniqueUsers);
          if (loggedInUser && uniqueUsers.includes(loggedInUser)) {
            setSelectedUser(loggedInUser);
          }
        } catch (e) {
          console.error('Fetch error:', e);
          setError('Failed to fetch data: ' + e.message + '. Check Firestore permissions or collection name.');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [open, loggedInUser]);

  const recordsPerUser = users.length > 1 ? Math.ceil(totalRecords / (users.length - 1)) : totalRecords;
  const selectedUserIndex = selectedUser !== 'All Users' ? users.indexOf(selectedUser) : -1;
  const startIndex = selectedUserIndex >= 0 ? (selectedUserIndex - 1) * recordsPerUser : 0;
  const endIndex = selectedUserIndex >= 0 ? Math.min((selectedUserIndex) * recordsPerUser, totalRecords) : totalRecords;
  const loggedInUserIndex = loggedInUser ? users.indexOf(loggedInUser) : -1;
  const loggedInStartIndex = loggedInUserIndex >= 0 ? (loggedInUserIndex - 1) * recordsPerUser : 0;
  const loggedInEndIndex = loggedInUserIndex >= 0 ? Math.min(loggedInUserIndex * recordsPerUser, totalRecords) : totalRecords;

  const filteredData = stockData.filter((item, index) => {
    if (selectedUser === 'All Users') return true;
    if (users.length <= 2 && selectedUser === loggedInUser) return true;
    return index >= startIndex && index < endIndex;
  }).filter(item => {
    if (!searchTerm) return true;
    const searchValue = searchTerm.toLowerCase();
    return searchField === 'barcode' 
      ? item.barcode.toLowerCase().includes(searchValue)
      : item.sku.toLowerCase().includes(searchValue);
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFieldChange = (e) => {
    setSearchField(e.target.value);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleUserChange = (e) => {
    setSelectedUser(e.target.value);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleEditClick = (record) => {
    if (loggedInUser) {
      const recordIndex = stockData.findIndex(item => item.id === record.id);
      if (users.length <= 2 || (recordIndex >= loggedInStartIndex && recordIndex < loggedInEndIndex)) {
        setSelectedRecord(record);
        setCountStockInput(record.countStock === 'N/A' ? '' : record.countStock.toString());
        setModalOpen(true);
      } else {
        console.log(`Edit disabled for record ${record.id}: Outside logged-in user range ${loggedInStartIndex}-${loggedInEndIndex}, Record Index: ${recordIndex}`);
      }
    }
  };

  const handleSaveCount = async () => {
    if (selectedRecord && countStockInput !== '' && loggedInUser) {
      const recordIndex = stockData.findIndex(item => item.id === selectedRecord.id);
      if (users.length <= 2 || (recordIndex >= loggedInStartIndex && recordIndex < loggedInEndIndex)) {
        try {
          const recordRef = doc(firestore, 'manual_product', selectedRecord.id);
          await updateDoc(recordRef, { countStock: parseInt(countStockInput) || 0 });
          setStockData(stockData.map(item =>
            item.id === selectedRecord.id ? { ...item, countStock: parseInt(countStockInput) || 0 } : item
          ));
          setModalOpen(false);
        } catch (e) {
          console.error('Update error:', e);
          setError('Failed to update count stock: ' + e.message);
        }
      } else {
        console.log(`Save disabled for record ${selectedRecord.id}: Outside logged-in user range ${loggedInStartIndex}-${loggedInEndIndex}`);
      }
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedRecord(null);
    setCountStockInput('');
  };

  if (!open) return null;

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4 bg-blue-100 p-2 rounded-t-xl">
            <h2 className="text-xl font-bold text-blue-700">Manual Product Stock ({totalRecords} records)</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <FiX className="text-xl" />
            </button>
          </div>
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 justify-between items-center mb-4 p-2 bg-blue-50">
            <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 md:items-center">
              <select className="border p-1 rounded" value={searchField} onChange={handleFieldChange}>
                <option value="barcode">Barcode</option>
                <option value="sku">SKU</option>
              </select>
              <select className="border p-1 rounded" value={selectedUser} onChange={handleUserChange}>
                {users.map((user, index) => (
                  <option key={index} value={user}>{user}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder={`Search by ${searchField}`}
                className="border p-1 rounded"
                value={searchTerm}
                onChange={handleSearch}
              />
              <button className="bg-blue-600 text-white px-2 py-1 rounded" onClick={() => setSearchTerm('')}>Clear</button>
            </div>
            <div className="flex space-x-2">
              <button
                className="bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-50"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                &lt; Prev
              </button>
              <span className="border p-1">Page {currentPage} / {totalPages}</span>
              <button
                className="bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-50"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next &gt;
              </button>
            </div>
          </div>
          {loading && <AppLoader />}
          {error && (
            <p className="text-red-600 flex items-center gap-2">
              <FiAlertCircle /> {error}
            </p>
          )}
          {currentData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="p-2 text-blue-700 font-semibold">SL</th>
                    <th className="p-2 text-blue-700 font-semibold">Barcode</th>
                    <th className="p-2 text-blue-700 font-semibold">SKU</th>
                    <th className="p-2 text-blue-700 font-semibold">Qty</th>
                    <th className="p-2 text-blue-700 font-semibold">Costing</th>
                    <th className="p-2 text-blue-700 font-semibold">Total Costing</th>
                    <th className="p-2 text-blue-700 font-semibold">Count Stock</th>
                    <th className="p-2 text-blue-700 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row, index) => {
                    const recordIndex = stockData.findIndex(item => item.id === row.id);
                    const isEditable = loggedInUser && (users.length <= 2 || (recordIndex >= loggedInStartIndex && recordIndex < loggedInEndIndex));
                    return (
                      <tr key={row.id} className="border-b hover:bg-blue-50 transition">
                        <td className="p-2">{index + 1 + (currentPage - 1) * itemsPerPage}</td>
                        <td className="p-2">{row.barcode}</td>
                        <td className="p-2 text-nowrap">{row.sku}</td>
                        <td className="p-2">{row.qty}</td>
                        <td className="p-2">{row.costing}</td>
                        <td className="p-2">{Number.isInteger(row.totalCosting) ? row.totalCosting : row.totalCosting.toFixed(2)}</td>
                        <td className="p-2">{row.countStock}</td>
                        <td className="p-2">
                          {isEditable && (
                            <button
                              className="text-blue-500 hover:text-blue-700"
                              onClick={() => handleEditClick(row)}
                            >
                              <FiEdit2 className="text-lg" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            !loading && <p className="text-gray-500 text-center">No data found.</p>
          )}
          <div className="p-2 bg-blue-50 mt-2 text-gray-600 text-center">
            Showing {currentData.length} of {filteredData.length} records.
          </div>
          {modalOpen && selectedRecord && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Edit Count Stock</h3>
                <div className="mb-4">
                  <p><strong>Barcode:</strong> {selectedRecord.barcode}</p>
                  <p><strong>SKU:</strong> {selectedRecord.sku}</p>
                  <p><strong>Qty:</strong> {selectedRecord.qty}</p>
                  <p><strong>Costing:</strong> {selectedRecord.costing}</p>
                  <p><strong>Total Costing:</strong> {Number.isInteger(selectedRecord.totalCosting) ? selectedRecord.totalCosting : selectedRecord.totalCosting.toFixed(2)}</p>
                  <div className="mt-2">
                    <label className="block mb-1">Count Stock:</label>
                    <input
                      type="number"
                      value={countStockInput}
                      onChange={(e) => setCountStockInput(e.target.value)}
                      className="border p-2 rounded w-full"
                      placeholder="Enter count"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    className="bg-gray-500 text-white px-4 py-2 rounded"
                    onClick={handleModalClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    onClick={handleSaveCount}
                    disabled={!loggedInUser || (users.length > 2 && (stockData.findIndex(item => item.id === selectedRecord.id) < loggedInStartIndex || stockData.findIndex(item => item.id === selectedRecord.id) >= loggedInEndIndex))}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default ShowmanualStock;