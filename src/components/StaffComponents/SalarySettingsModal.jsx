import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { toast } from 'react-toastify';
import { FiX, FiDollarSign } from 'react-icons/fi';

const SalarySettingsModal = ({ isOpen, onClose, staff, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    monthlySalary: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (staff && isOpen) {
      fetchCurrentSalary();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!salaryForm.monthlySalary || parseFloat(salaryForm.monthlySalary) <= 0) {
      toast.error('Please enter a valid monthly salary');
      return;
    }

    try {
      setLoading(true);

      const salaryData = {
        staff_id: staff.id,
        staff_name: staff.name,
        staff_role: staff.role,
        monthly_salary: parseFloat(salaryForm.monthlySalary),
        effective_date: new Date(salaryForm.effectiveDate),
        notes: salaryForm.notes,
        updated_at: serverTimestamp()
      };

      // Check if salary setting already exists
      const existingQuery = query(
        collection(firestore, 'salary_settings'),
        where('staff_id', '==', staff.id)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        // Update existing salary setting
        const docRef = doc(firestore, 'salary_settings', existingSnapshot.docs[0].id);
        await updateDoc(docRef, salaryData);
        toast.success('Salary updated successfully');
      } else {
        // Create new salary setting
        await addDoc(collection(firestore, 'salary_settings'), {
          ...salaryData,
          created_at: serverTimestamp()
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Salary
            </label>
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
      </div>
    </div>
  );
};

export default SalarySettingsModal; 