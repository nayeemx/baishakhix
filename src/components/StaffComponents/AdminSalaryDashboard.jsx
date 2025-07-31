import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { 
  FiUsers, 
  FiDollarSign, 
  FiCalendar, 
  FiAlertTriangle,
  FiDownload,
  FiFileText
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import SalarySettingsModal from './SalarySettingsModal';

const AdminSalaryDashboard = () => {
  const { user } = useSelector(state => state.auth);
  const [staffList, setStaffList] = useState([]);
  const [salarySettings, setSalarySettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedStaffForSalary, setSelectedStaffForSalary] = useState(null);
  
  // Summary data
  const [summary, setSummary] = useState({
    totalStaff: 0,
    totalMonthlySalary: 0,
    currentWeek: 1,
    pendingPayments: 0
  });

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    selectedStaff: null,
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Regular',
    notes: ''
  });

  // Fetch staff and salary data
  useEffect(() => {
    fetchStaffAndSalaries();
  }, []);

  const fetchStaffAndSalaries = async () => {
    try {
      setLoading(true);
      
      // Fetch staff from users collection - include all roles except 'user'
      const usersQuery = query(
        collection(firestore, 'users'),
        where('role', 'in', ['super_user', 'admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
      );
      const usersSnapshot = await getDocs(usersQuery);
      const staff = [];
      
      usersSnapshot.forEach(doc => {
        staff.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort staff by name on client side
      staff.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // Fetch salary settings
      const salarySettingsQuery = query(collection(firestore, 'salary_settings'));
      const salarySettingsSnapshot = await getDocs(salarySettingsQuery);
      const settings = {};
      
      salarySettingsSnapshot.forEach(doc => {
        const data = doc.data();
        // Use staff_id as the key instead of document ID
        if (data.staff_id) {
          settings[data.staff_id] = data;
        }
      });

      // Fetch recent transactions to calculate pending payments
      const transactionsQuery = query(
        collection(firestore, 'salary_transactions'),
        orderBy('date', 'desc'),
        limit(50)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Calculate pending payments (negative balances)
      let pendingCount = 0;
      const staffBalances = {};
      
      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        if (!staffBalances[transaction.staff_id]) {
          staffBalances[transaction.staff_id] = 0;
        }
        staffBalances[transaction.staff_id] += transaction.amount;
      });

      Object.values(staffBalances).forEach(balance => {
        if (balance < 0) pendingCount++;
      });

      // Calculate current week (simple calculation)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const currentWeek = Math.ceil((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));

      // Calculate total monthly salary
      const totalMonthlySalary = staff.reduce((total, member) => {
        const salary = settings[member.id]?.monthly_salary || 0;
        return total + salary;
      }, 0);

      // Debug logging
      console.log('Staff list:', staff);
      console.log('Salary settings:', settings);
      
      // Check specific staff member
      const ishtieaq = staff.find(s => s.name === 'Ishtieaq Nayeem');
      if (ishtieaq) {
        console.log('Ishtieaq staff data:', ishtieaq);
        console.log('Ishtieaq salary lookup:', settings[ishtieaq.id]);
        console.log('Ishtieaq staff.id:', ishtieaq.id);
        console.log('Available salary keys:', Object.keys(settings));
      }
      
      setStaffList(staff);
      setSalarySettings(settings);
      setSummary({
        totalStaff: staff.length,
        totalMonthlySalary,
        currentWeek,
        pendingPayments: pendingCount
      });

    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!paymentForm.selectedStaff || !paymentForm.amount || paymentForm.amount <= 0) {
      toast.error('Please select staff and enter a valid amount');
      return;
    }

    try {
      setProcessing(true);
      
      const transactionData = {
        staff_id: paymentForm.selectedStaff.id,
        staff_name: paymentForm.selectedStaff.name,
        staff_role: paymentForm.selectedStaff.role,
        amount: parseFloat(paymentForm.amount),
        type: paymentForm.type,
        notes: paymentForm.notes,
        date: new Date(paymentForm.date),
        processed_by: user.uid,
        processed_by_name: user.name || user.displayName || user.email,
        created_at: serverTimestamp()
      };

      await addDoc(collection(firestore, 'salary_transactions'), transactionData);
      
      // Reset form
      setPaymentForm({
        selectedStaff: null,
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'Regular',
        notes: ''
      });

      toast.success('Payment processed successfully');
      
      // Refresh data
      fetchStaffAndSalaries();
      
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const openSalarySettingsModal = (staff) => {
    setSelectedStaffForSalary(staff);
    setShowSalaryModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <FiUsers className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalStaff}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <FiDollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Monthly Salary</p>
              <p className="text-2xl font-bold text-gray-900">${summary.totalMonthlySalary.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <FiCalendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Week</p>
              <p className="text-2xl font-bold text-gray-900">Week {summary.currentWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <FiAlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900">{summary.pendingPayments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Processing */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Payment Processing</h2>
        
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {/* Staff Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    paymentForm.selectedStaff?.id === staff.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setPaymentForm(prev => ({ ...prev, selectedStaff: staff }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-gray-600">
                          {staff.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{staff.name}</p>
                        <p className="text-sm text-gray-500">{staff.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ${salarySettings[staff.id]?.monthly_salary || 0}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSalarySettingsModal(staff);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800"
                      >
                        Set Salary
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Payment Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="$ 0.00"
              />
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type
              </label>
              <select
                value={paymentForm.type}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Regular">Regular</option>
                <option value="Bonus">Bonus</option>
                <option value="Advance">Advance</option>
                <option value="Fine">Fine</option>
                <option value="Adjustment">Adjustment</option>
              </select>
            </div>

            {/* Process Payment Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={processing || !paymentForm.selectedStaff || !paymentForm.amount}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Processing...' : 'Process Payment'}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Add any notes about this payment"
            />
          </div>
        </form>
      </div>

      {/* Salary Settings Modal */}
      <SalarySettingsModal
        isOpen={showSalaryModal}
        onClose={() => {
          setShowSalaryModal(false);
          setSelectedStaffForSalary(null);
        }}
        staff={selectedStaffForSalary}
        onSuccess={fetchStaffAndSalaries}
      />
    </div>
  );
};

export default AdminSalaryDashboard;