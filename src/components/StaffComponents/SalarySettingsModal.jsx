import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  where,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { toast } from 'react-toastify';
import { FiX, FiDollarSign, FiClock, FiList } from 'react-icons/fi';
import AppLoader from '../AppLoader';

const SalarySettingsModal = ({ isOpen, onClose, staff, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const [previousSalary, setPreviousSalary] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    monthlySalary: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (staff && isOpen) {
      console.log('Modal opened for staff:', staff);
      console.log('Staff ID:', staff.id);
      setModalLoading(true);
      Promise.all([
        fetchCurrentSalary(),
        checkHistoryAvailability()
      ]).finally(() => {
        setModalLoading(false);
      });
    }
  }, [staff, isOpen]);

  const fetchCurrentSalary = async () => {
    try {
      const salaryQuery = query(
        collection(firestore, 'salary_settings'),
        where('staff_id', '==', staff.id)
      );
      const salarySnapshot = await getDocs(salaryQuery);
      
      if (!salarySnapshot.empty) {
        const currentSalary = salarySnapshot.docs[0].data();
        setSalaryForm(prev => ({
          ...prev,
          monthlySalary: currentSalary.monthly_salary?.toString() || '',
          notes: currentSalary.notes || ''
        }));
      } else {
        setSalaryForm(prev => ({
          ...prev,
          monthlySalary: '',
          notes: ''
        }));
      }
    } catch (error) {
      console.error('Error fetching current salary:', error);
    }
  };

  const checkHistoryAvailability = async () => {
    try {
      const historyQuery = query(
        collection(firestore, 'salary_history'),
        where('staff_id', '==', staff.id)
      );
      const historySnapshot = await getDocs(historyQuery);
      
      setHasHistory(!historySnapshot.empty);
      
      if (!historySnapshot.empty) {
        // Get all records and sort them to find the most recent one
        const records = [];
        historySnapshot.forEach(doc => {
          records.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Sort by effective_date in descending order and get the first one
        records.sort((a, b) => {
          const dateA = a.effective_date?.toDate?.() || new Date(0);
          const dateB = b.effective_date?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
        
        setPreviousSalary(records[0]);
      } else {
        setPreviousSalary(null);
      }
    } catch (error) {
      console.error('Error checking history availability:', error);
      setHasHistory(false);
    }
  };

  const fetchSalaryHistory = async () => {
    try {
      setHistoryLoading(true);
      console.log('=== DEBUGGING SALARY HISTORY ===');
      console.log('Staff object:', staff);
      console.log('Staff ID being used:', staff.id);
      console.log('Staff ID type:', typeof staff.id);
      
      // Get records for this staff member (without orderBy to avoid index requirement)
      const historyQuery = query(
        collection(firestore, 'salary_history'),
        where('staff_id', '==', staff.id)
      );
      const historySnapshot = await getDocs(historyQuery);
      
      console.log('Filtered history snapshot size:', historySnapshot.size);
      
      const history = [];
      historySnapshot.forEach(doc => {
        const data = doc.data();
        console.log('History record:', data);
        history.push({
          id: doc.id,
          ...data
        });
      });
      
      // Sort the history by effective_date in descending order (newest first)
      history.sort((a, b) => {
        const dateA = a.effective_date?.toDate?.() || new Date(0);
        const dateB = b.effective_date?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      console.log('Final history array (sorted):', history);
      setSalaryHistory(history);
    } catch (error) {
      console.error('Error fetching salary history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSetHistoricalSalary = async (historicalRecord) => {
    try {
      setLoading(true);
      
      const newSalary = historicalRecord.monthly_salary;
      const effectiveDate = new Date(); // Current timestamp
      
      // Check if salary setting already exists
      const existingQuery = query(
        collection(firestore, 'salary_settings'),
        where('staff_id', '==', staff.id)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        const currentSalaryData = existingSnapshot.docs[0].data();
        const currentSalary = currentSalaryData.monthly_salary;

        // Only add to history if the salary is actually different
        if (currentSalary !== newSalary) {
          // Add current salary to history before updating
          await addDoc(collection(firestore, 'salary_history'), {
            staff_id: staff.id,
            staff_name: staff.name,
            staff_role: staff.role,
            monthly_salary: currentSalary,
            effective_date: currentSalaryData.effective_date,
            notes: currentSalaryData.notes,
            changed_at: serverTimestamp(),
            changed_by: 'admin',
            change_reason: 'Salary Changed'
          });
        }

        // Update current salary setting
        const docRef = doc(firestore, 'salary_settings', existingSnapshot.docs[0].id);
        await updateDoc(docRef, {
          monthly_salary: newSalary,
          effective_date: effectiveDate,
          notes: `Set to $${newSalary.toFixed(2)} from history`,
          updated_at: serverTimestamp()
        });
        
        toast.success(`Salary set to $${newSalary.toFixed(2)} successfully`);
      } else {
        // Create new salary setting
        await addDoc(collection(firestore, 'salary_settings'), {
          staff_id: staff.id,
          staff_name: staff.name,
          staff_role: staff.role,
          monthly_salary: newSalary,
          effective_date: effectiveDate,
          notes: `Set to $${newSalary.toFixed(2)} from history`,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success(`Salary set to $${newSalary.toFixed(2)} successfully`);
      }

      // Refresh the data
      fetchCurrentSalary();
      fetchSalaryHistory();
      onSuccess?.();
      
    } catch (error) {
      console.error('Error setting historical salary:', error);
      toast.error('Failed to set historical salary');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!salaryForm.monthlySalary || parseFloat(salaryForm.monthlySalary) <= 0) {
      toast.error('Please enter a valid monthly salary');
      return;
    }

    try {
      setLoading(true);

      const newSalary = parseFloat(salaryForm.monthlySalary);
      const effectiveDate = new Date(salaryForm.effectiveDate);

      // Check if salary setting already exists
      const existingQuery = query(
        collection(firestore, 'salary_settings'),
        where('staff_id', '==', staff.id)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        const currentSalaryData = existingSnapshot.docs[0].data();
        const currentSalary = currentSalaryData.monthly_salary;

        // If salary is actually changing, add to history
        if (currentSalary !== newSalary) {
          // Add current salary to history before updating
          await addDoc(collection(firestore, 'salary_history'), {
            staff_id: staff.id,
            staff_name: staff.name,
            staff_role: staff.role,
            monthly_salary: currentSalary,
            effective_date: currentSalaryData.effective_date,
            notes: currentSalaryData.notes,
            changed_at: serverTimestamp(),
            changed_by: 'admin', // You can add user authentication later
            change_reason: 'Salary Update'
          });
        }

        // Update current salary setting
        const docRef = doc(firestore, 'salary_settings', existingSnapshot.docs[0].id);
        await updateDoc(docRef, {
          monthly_salary: newSalary,
          effective_date: effectiveDate,
          notes: salaryForm.notes,
          updated_at: serverTimestamp()
        });
        
        toast.success('Salary updated successfully');
      } else {
        // Create new salary setting
        await addDoc(collection(firestore, 'salary_settings'), {
          staff_id: staff.id,
          staff_name: staff.name,
          staff_role: staff.role,
          monthly_salary: newSalary,
          effective_date: effectiveDate,
          notes: salaryForm.notes,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
        toast.success('Salary set successfully');
      }

      onSuccess?.();
      onClose();
      
    } catch (error) {
      console.error('Error saving salary setting:', error);
      toast.error('Failed to save salary setting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <FiDollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Set Monthly Salary</h2>
              <p className="text-sm text-gray-600">{staff.name} - {staff.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>



        {/* Form */}
        {modalLoading ? (
          <div className="p-6 flex justify-center">
            <AppLoader />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Monthly Salary
              </label>
              {hasHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(true);
                    setHistoryLoading(true);
                    fetchSalaryHistory();
                  }}
                  className="flex items-center text-xs text-blue-600 hover:text-blue-800"
                >
                  <FiList className="w-3 h-3 mr-1" />
                  View History
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salaryForm.monthlySalary}
                onChange={(e) => setSalaryForm(prev => ({ ...prev, monthlySalary: e.target.value }))}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Effective Date
            </label>
            <input
              type="date"
              value={salaryForm.effectiveDate}
              onChange={(e) => setSalaryForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

                                 <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={salaryForm.notes}
                onChange={(e) => setSalaryForm(prev => ({ ...prev, notes: e.target.value }))}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Add any notes about this salary setting..."
              />
            </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Salary'}
            </button>
          </div>
                 </form>
        )}
       </div>

       {/* Salary History Modal */}
       {showHistoryModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
             {/* Header */}
             <div className="flex items-center justify-between p-6 border-b">
               <div className="flex items-center">
                 <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                   <FiList className="w-5 h-5 text-blue-600" />
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-gray-800">Salary History</h2>
                   <p className="text-sm text-gray-600">{staff.name} - {staff.role}</p>
                 </div>
               </div>
               <button
                 onClick={() => setShowHistoryModal(false)}
                 className="text-gray-400 hover:text-gray-600 transition-colors"
               >
                 <FiX className="w-6 h-6" />
               </button>
             </div>

             {/* Current Salary */}
             <div className="p-6 border-b bg-green-50">
               <h3 className="text-lg font-semibold text-green-800 mb-2">Current Salary</h3>
               <div className="text-green-700">
                 <p className="text-2xl font-bold">${salaryForm.monthlySalary || '0.00'}</p>
                 <p className="text-sm">Effective: {salaryForm.effectiveDate}</p>
               </div>
             </div>

             {/* Salary History */}
             <div className="p-6">
               <h3 className="text-lg font-semibold text-gray-800 mb-4">Previous Salaries</h3>
               {historyLoading ? (
                 <div className="flex justify-center py-8">
                   <AppLoader />
                 </div>
               ) : salaryHistory.length > 0 ? (
                 <div className="space-y-4">
                   {salaryHistory.map((record) => (
                     <div key={record.id} className="bg-gray-50 p-4 rounded-lg border">
                       <div className="flex justify-between items-start mb-2">
                         <span className="text-xl font-bold text-gray-800">
                           ${record.monthly_salary?.toFixed(2)}
                         </span>
                         <div className="flex items-center space-x-2">
                           <span className="text-sm text-gray-500">
                             Changed: {record.changed_at?.toDate?.()?.toLocaleDateString() || 'N/A'}
                           </span>
                           <button
                             onClick={() => handleSetHistoricalSalary(record)}
                             disabled={loading}
                             className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                           >
                             {loading ? 'Setting...' : 'Set'}
                           </button>
                         </div>
                       </div>
                       <div className="text-gray-600 space-y-1">
                         <p><strong>Effective Date:</strong> {record.effective_date?.toDate?.()?.toLocaleDateString() || 'N/A'}</p>
                         <p><strong>Changed By:</strong> {record.changed_by || 'Admin'}</p>
                         <p><strong>Reason:</strong> {record.change_reason || 'Salary Update'}</p>
                         {record.notes && (
                           <p><strong>Notes:</strong> {record.notes}</p>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-8">
                   <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                   <p className="text-gray-500">No salary history found.</p>
                   <p className="text-sm text-gray-400">This is the first salary setting for this staff member.</p>
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
     </div>
   );
   };
  
  export default SalarySettingsModal; 