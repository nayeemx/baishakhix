import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { 
  FiUsers, 
  FiDollarSign, 
  FiCalendar, 
  FiAlertTriangle,
  FiDownload,
  FiFileText,
  FiUser
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import SalarySettingsModal from './SalarySettingsModal';
import AppLoader from '../AppLoader';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';

const AdminSalaryDashboard = ({ showOnlySummary = false }) => {
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [staffList, setStaffList] = useState([]);
  const [salarySettings, setSalarySettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedStaffForSalary, setSelectedStaffForSalary] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStaffForDetails, setSelectedStaffForDetails] = useState(null);
  
  // Summary data
  const [summary, setSummary] = useState({
    totalStaff: 0,
    totalMonthlySalary: 0,
    currentWeek: 1,
    pendingPayments: 0
  });

  // Staff calculations with new structure
  const [staffCalculations, setStaffCalculations] = useState({});

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    selectedStaff: null,
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Regular',
    notes: '',
    overtimeHours: '',
    overtimeRate: ''
  });

  // Fetch staff and salary data
  useEffect(() => {
    fetchStaffAndSalaries();
  }, []);

  // Add real-time listener for salary transactions
  useEffect(() => {
    const transactionsQuery = query(
      collection(firestore, 'salary_transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      // Refresh data when transactions change
      fetchStaffAndSalaries();
    });

    return () => unsubscribe();
  }, []);

  // Add real-time listener for salary settings
  useEffect(() => {
    const salarySettingsQuery = query(collection(firestore, 'salary_settings'));

    const unsubscribe = onSnapshot(salarySettingsQuery, (snapshot) => {
      // Refresh data when salary settings change
      fetchStaffAndSalaries();
    });

    return () => unsubscribe();
  }, []);

  // Add real-time listener for users collection
  useEffect(() => {
    const usersQuery = query(
      collection(firestore, 'users'),
      where('role', 'in', ['admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      // Refresh data when users change
      fetchStaffAndSalaries();
    });

    return () => unsubscribe();
  }, []);

  // Listen for custom events when transactions are added
  useEffect(() => {
    const handleTransactionAdded = () => {
      fetchStaffAndSalaries();
    };

    window.addEventListener('salaryTransactionAdded', handleTransactionAdded);
    return () => window.removeEventListener('salaryTransactionAdded', handleTransactionAdded);
  }, []);

  const fetchStaffAndSalaries = async () => {
    try {
      setLoading(true);
      
      // Fetch staff from users collection - exclude super_user (developer)
      const usersQuery = query(
        collection(firestore, 'users'),
        where('role', 'in', ['admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
      );
      const usersSnapshot = await getDocs(usersQuery);
      const staff = [];
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        // Filter out super_user from the staff list
        if (userData.role !== 'super_user') {
          staff.push({
            id: doc.id,
            ...userData
          });
        }
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

      // Calculate current week of the month based on Fridays
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDate = now.getDate();
      
      // Find all Fridays in the current month
      const fridaysInMonth = [];
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        if (date.getDay() === 5) { // 5 = Friday
          fridaysInMonth.push(day);
        }
      }
      
      // Calculate current week based on which Friday period we're in
      let currentWeekOfMonth = 1;
      
      if (fridaysInMonth.length === 0) {
        // No Fridays in this month (very rare, but possible)
        currentWeekOfMonth = 1;
      } else if (currentDate <= fridaysInMonth[0]) {
        // Before or on the first Friday = Week 1
        currentWeekOfMonth = 1;
      } else {
        // Find which Friday period we're in
        for (let i = 0; i < fridaysInMonth.length; i++) {
          const currentFriday = fridaysInMonth[i];
          const nextFriday = fridaysInMonth[i + 1];
          
          if (nextFriday) {
            // If we're between this Friday and the next Friday
            if (currentDate > currentFriday && currentDate <= nextFriday) {
              currentWeekOfMonth = i + 2; // +2 because we're in the period after this Friday
              break;
            }
          } else {
            // We're past the last Friday
            if (currentDate > currentFriday) {
              currentWeekOfMonth = fridaysInMonth.length;
            }
          }
        }
      }

      // Simplified logic: Use only salary_transactions collection
      const staffCalculations = {};
      
      for (const staffMember of staff) {
        const staffId = staffMember.id;
        const monthlySalary = settings[staffId]?.monthly_salary || 0;
        
        // Fetch all salary transactions for this staff member
        const transactionsQuery = query(
          collection(firestore, 'salary_transactions'),
          where('staff_id', '==', staffId)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        // Calculate current month totals
        const currentMonth = new Date(now.getFullYear(), now.getMonth());
        let currentMonthTotal = 0;
        
        // Group transactions by month to calculate monthly totals
        const monthlyGroups = {};
        
        transactionsSnapshot.forEach(doc => {
          const transaction = doc.data();
          const transactionDate = transaction.date?.toDate?.() || new Date(transaction.date);
          const monthKey = `${transactionDate.getFullYear()}-${transactionDate.getMonth()}`;
          
          if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = 0;
          }
          monthlyGroups[monthKey] += transaction.amount || 0;
          
          // Calculate current month total
          if (transactionDate.getMonth() === currentMonth.getMonth() && 
              transactionDate.getFullYear() === currentMonth.getFullYear()) {
            currentMonthTotal += transaction.amount || 0;
          }
        });
        
        // Calculate carryover and extra payments for completed months
        let carryover = 0;
        let extraPayments = 0;
        
        // Get the effective date from salary settings
        let effectiveDate;
        try {
          if (settings[staffId]?.effective_date?.toDate) {
            effectiveDate = settings[staffId].effective_date.toDate();
          } else if (settings[staffId]?.effective_date) {
            effectiveDate = new Date(settings[staffId].effective_date);
          } else {
            // If no effective date, use current date
            effectiveDate = new Date();
          }
          
          // Validate the date
          if (isNaN(effectiveDate.getTime())) {
            effectiveDate = new Date();
          }
        } catch (error) {
          console.warn(`Invalid effective date for staff ${staffId}, using current date`);
          effectiveDate = new Date();
        }
        
        // Calculate all months from effective date to current month
        const allMonths = [];
        let currentDate = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), 1);
        
        while (currentDate < currentMonth) {
          const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
          const monthTotal = monthlyGroups[monthKey] || 0;
          allMonths.push({ monthKey, monthTotal, date: new Date(currentDate) });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        // Calculate carryover from all completed months
        allMonths.forEach(({ monthKey, monthTotal }) => {
          if (monthTotal < monthlySalary) {
            // Staff took less than monthly salary - add to carryover
            carryover += (monthlySalary - monthTotal);
          } else if (monthTotal > monthlySalary) {
            // Staff took more than monthly salary - add to extra payments
            extraPayments += (monthTotal - monthlySalary);
          }
        });
        
        // Calculate available amount for current month
        const availableThisMonth = monthlySalary + carryover - currentMonthTotal;
        
        // If current month total exceeds monthly salary + carryover, add to extra payments
        if (currentMonthTotal > (monthlySalary + carryover)) {
          extraPayments += (currentMonthTotal - (monthlySalary + carryover));
        }
        
        staffCalculations[staffId] = {
          carryover,
          extraPayments,
          currentMonthTotal,
          monthlySalary,
          availableThisMonth
        };

        // Debug logging for carryover calculation
        console.log(`Staff: ${staffMember.name}`, {
          monthlySalary,
          currentMonthTotal,
          carryover,
          extraPayments,
          availableThisMonth,
          effectiveDate: effectiveDate ? effectiveDate.toISOString().split('T')[0] : 'Invalid Date',
          completedMonths: allMonths.length,
          transactionMonths: Object.keys(monthlyGroups).length,
          allMonths: allMonths.map(m => `${m.date.getFullYear()}-${m.date.getMonth() + 1}: $${m.monthTotal}`)
        });
      }

      // Calculate pending payments (staff with salary settings who haven't received weekly payment this week)
      let pendingCount = 0;
      
      // Get current week's Friday date
      const currentWeekFriday = fridaysInMonth[fridaysInMonth.length - 1];
      const currentWeekFridayDate = new Date(currentYear, currentMonth, currentWeekFriday);
      
      // Check each staff member with salary settings
      Object.keys(settings).forEach(staffId => {
        const hasWeeklyPaymentThisWeek = false; // We'll implement this check later
        if (!hasWeeklyPaymentThisWeek) {
          pendingCount++;
        }
      });

      // Calculate total monthly salary
      const totalMonthlySalary = staff.reduce((total, member) => {
        const salary = settings[member.id]?.monthly_salary || 0;
        return total + salary;
      }, 0);

      // Debug logging
      console.log('Staff list:', staff);
      console.log('Salary settings:', settings);
      console.log('Staff calculations:', staffCalculations);
      
      setStaffList(staff);
      setSalarySettings(settings);
      setSummary({
        totalStaff: staff.length,
        totalMonthlySalary,
        currentWeek: currentWeekOfMonth,
        pendingPayments: pendingCount
      });

      // Store calculations for use in the component
      setStaffCalculations(staffCalculations);

    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    // Check permission to process salary payments
    if (!hasPermission(PERMISSION_PAGES.SALARY, 'create')) {
      toast.error('You do not have permission to process salary payments');
      return;
    }
    
    if (!paymentForm.selectedStaff || !paymentForm.amount) {
      toast.error('Please select staff and enter a valid amount');
      return;
    }

    // Additional validation for overtime payments
    if (paymentForm.type === 'Overtime') {
      if (!paymentForm.overtimeHours || !paymentForm.overtimeRate) {
        toast.error('Please enter both overtime hours and rate');
        return;
      }
      
      const overtimeHours = parseFloat(paymentForm.overtimeHours);
      const overtimeRate = parseFloat(paymentForm.overtimeRate);
      
      if (overtimeHours <= 0 || overtimeRate <= 0) {
        toast.error('Please enter valid overtime hours and rate');
        return;
      }
    }

    const amount = parseFloat(paymentForm.amount);
    if (amount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    try {
      setProcessing(true);
      
      // All transactions go to salary_transactions collection
      const transactionData = {
        staff_id: paymentForm.selectedStaff.id,
        staff_name: paymentForm.selectedStaff.name,
        staff_role: paymentForm.selectedStaff.role,
        amount: paymentForm.type === 'Repayment' || paymentForm.type === 'Fine' ? -amount : amount,
        type: paymentForm.type,
        notes: paymentForm.notes,
        date: new Date(paymentForm.date),
        processed_by: user.uid,
        processed_by_name: user.name || user.displayName || user.email,
        created_at: serverTimestamp(),
        // Add overtime data if it's an overtime payment
        ...(paymentForm.type === 'Overtime' && {
          overtimeHours: parseFloat(paymentForm.overtimeHours) || 0,
          overtimeRate: parseFloat(paymentForm.overtimeRate) || 0
        })
      };

      await addDoc(collection(firestore, 'salary_transactions'), transactionData);
      
      // Reset form
      setPaymentForm({
        selectedStaff: null,
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'Regular',
        notes: '',
        overtimeHours: '',
        overtimeRate: ''
      });

      toast.success('Payment processed successfully');
      
      // Refresh data
      fetchStaffAndSalaries();
      
      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent('salaryTransactionAdded'));
      
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const openSalarySettingsModal = (staff) => {
    // Check permission to edit salary settings
    if (!hasPermission(PERMISSION_PAGES.SALARY, 'edit')) {
      toast.error('You do not have permission to modify salary settings');
      return;
    }
    
    setSelectedStaffForSalary(staff);
    setShowSalaryModal(true);
  };

  // Auto-calculate overtime amount when hours or rate changes
  const calculateOvertimeAmount = (hours, rate) => {
    const overtimeHours = parseFloat(hours) || 0;
    const overtimeRate = parseFloat(rate) || 0;
    return (overtimeHours * overtimeRate).toFixed(2);
  };

  const navigateToStaffDashboard = () => {
    // Navigate to a route that shows only the staff dashboard
    // We'll need to create a new route or modify the existing one
    navigate('/staff/salary?view=personal');
  };

  if (loading) {
    return <AppLoader />;
  }

  // If only summary is requested, render just the summary cards
  if (showOnlySummary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
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
              <p className="text-sm font-medium text-gray-600">Week of Month</p>
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

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <FiDollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Carryover</p>
              <p className="text-2xl font-bold text-green-600">
                ${Object.values(staffCalculations).reduce((sum, calc) => sum + (calc.carryover || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <FiDollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Extra Payments</p>
              <p className="text-2xl font-bold text-red-600">
                ${Object.values(staffCalculations).reduce((sum, calc) => sum + (calc.extraPayments || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Processing */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Payment Processing</h2>
          <button
            onClick={navigateToStaffDashboard}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <FiUser className="w-4 h-4 mr-2" />
            My Salary Dashboard
          </button>
        </div>
        
        {!hasPermission(PERMISSION_PAGES.SALARY, 'create') && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <FiAlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              <p className="text-yellow-800 text-sm">
                You do not have permission to process salary payments. Contact your administrator to request access.
              </p>
            </div>
          </div>
        )}
        
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {/* Staff Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Staff
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4 overflow-y-auto">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                    paymentForm.selectedStaff?.id === staff.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setPaymentForm(prev => ({ ...prev, selectedStaff: staff }))}
                >
                  <div className="flex flex-col space-y-3">
                    {/* Staff Info */}
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-gray-600">
                          {staff.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{staff.name}</p>
                        <p className="text-sm text-gray-500 truncate">{staff.role}</p>
                      </div>
                    </div>
                    
                    {/* Salary Info */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Monthly:</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${salarySettings[staff.id]?.monthly_salary || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Weekly:</span>
                        <span className="text-sm text-gray-500">
                          ${((salarySettings[staff.id]?.monthly_salary || 0) / 4).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Calculations */}
                    {staffCalculations[staff.id] && (
                      <div className="space-y-1 text-xs">
                        {staffCalculations[staff.id].carryover > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Carryover:</span>
                            <span className="text-green-600 font-medium">
                              +${staffCalculations[staff.id].carryover.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {staffCalculations[staff.id].extraPayments > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Extra:</span>
                            <span className="text-red-600 font-medium">
                              -${staffCalculations[staff.id].extraPayments.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-gray-100">
                          <span className="text-gray-700 font-medium">Available:</span>
                          <span className="text-blue-600 font-medium">
                            ${staffCalculations[staff.id].availableThisMonth.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                      {hasPermission(PERMISSION_PAGES.SALARY, 'edit') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSalarySettingsModal(staff);
                          }}
                          className="flex-1 text-xs text-purple-600 hover:text-purple-800 py-1 px-2 rounded hover:bg-purple-50 transition-colors"
                        >
                          Set Salary
                        </button>
                      )}
                      {staffCalculations[staff.id] && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStaffForDetails(staff);
                            setShowDetailsModal(true);
                          }}
                          className="flex-1 text-xs text-blue-600 hover:text-blue-800 py-1 px-2 rounded hover:bg-blue-50 transition-colors"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                onChange={(e) => {
                  const newType = e.target.value;
                  setPaymentForm(prev => ({ 
                    ...prev, 
                    type: newType,
                    // Auto-calculate amount if switching to overtime and hours/rate are available
                    amount: newType === 'Overtime' && prev.overtimeHours && prev.overtimeRate 
                      ? calculateOvertimeAmount(prev.overtimeHours, prev.overtimeRate) 
                      : prev.amount
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Regular">Regular (Weekly Salary)</option>
                <option value="Overtime">Overtime</option>
                <option value="Extra_Payment">Extra Payment</option>
                <option value="Repayment">Adjustment</option>
                <option value="Fine">Fine (Deduction)</option>
                <option value="Bonus">Bonus</option>
              </select>
            </div>

            {/* Process Payment Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={processing || !paymentForm.selectedStaff || !paymentForm.amount || !hasPermission(PERMISSION_PAGES.SALARY, 'create')}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                title={!hasPermission(PERMISSION_PAGES.SALARY, 'create') ? 'You do not have permission to process salary payments' : ''}
              >
                {processing ? 'Processing...' : 'Payment'}
              </button>
            </div>
          </div>

          {/* Overtime Fields - Show only when payment type is Overtime */}
          {paymentForm.type === 'Overtime' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Overtime Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overtime Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={paymentForm.overtimeHours}
                  onChange={(e) => {
                    const hours = e.target.value;
                    setPaymentForm(prev => ({ 
                      ...prev, 
                      overtimeHours: hours,
                      amount: paymentForm.type === 'Overtime' ? calculateOvertimeAmount(hours, prev.overtimeRate) : prev.amount
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.0"
                />
              </div>

              {/* Overtime Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overtime Rate (per hour)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.overtimeRate}
                  onChange={(e) => {
                    const rate = e.target.value;
                    setPaymentForm(prev => ({ 
                      ...prev, 
                      overtimeRate: rate,
                      amount: paymentForm.type === 'Overtime' ? calculateOvertimeAmount(prev.overtimeHours, rate) : prev.amount
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="$ 0.00"
                />
              </div>
            </div>
          )}

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

      {/* Staff Details Modal */}
      {showDetailsModal && selectedStaffForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedStaffForDetails.name} - Salary Details
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(() => {
              const calc = staffCalculations[selectedStaffForDetails.id];
              if (!calc) return <div>Loading...</div>;

              // Add safe defaults for all calculation properties
              const safeCalc = {
                monthlySalary: calc.monthlySalary || 0,
                availableThisMonth: calc.availableThisMonth || 0,
                currentMonthTotal: calc.currentMonthTotal || 0,
                carryover: calc.carryover || 0,
                extraPayments: calc.extraPayments || 0,
                monthsFromEffective: calc.monthsFromEffective || 0,
                totalTaken: calc.totalTaken || 0
              };

              return (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-700 mb-2">Basic Information</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Name:</span> {selectedStaffForDetails.name}</div>
                        <div><span className="font-medium">Role:</span> {selectedStaffForDetails.role}</div>
                        <div><span className="font-medium">Monthly Salary:</span> ${safeCalc.monthlySalary}</div>
                        <div><span className="font-medium">Weekly Salary:</span> ${(safeCalc.monthlySalary / 4).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-700 mb-2">Current Status</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Available This Month:</span> 
                          <span className={`ml-2 font-bold ${safeCalc.availableThisMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${safeCalc.availableThisMonth.toFixed(2)}
                          </span>
                        </div>
                        <div><span className="font-medium">Current Month Total:</span> ${safeCalc.currentMonthTotal.toFixed(2)}</div>
                        <div><span className="font-medium">Carryover:</span> 
                          <span className={`ml-2 font-bold ${safeCalc.carryover >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${safeCalc.carryover.toFixed(2)}
                          </span>
                        </div>
                        <div><span className="font-medium">Extra Payments:</span> 
                          <span className={`ml-2 font-bold ${safeCalc.extraPayments >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${safeCalc.extraPayments.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Salary History */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-700 mb-2">Salary History</h3>
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">Effective Date:</span> {salarySettings[selectedStaffForDetails.id]?.effective_date?.toDate?.()?.toLocaleDateString() || 'Not set'}</div>
                      <div><span className="font-medium">Total Months Active:</span> {safeCalc.monthsFromEffective}</div>
                      <div><span className="font-medium">Total Expected Salary:</span> ${(safeCalc.monthlySalary * safeCalc.monthsFromEffective).toFixed(2)}</div>
                      <div><span className="font-medium">Total Taken:</span> ${safeCalc.totalTaken.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    {hasPermission(PERMISSION_PAGES.SALARY, 'edit') && (
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          setSelectedStaffForSalary(selectedStaffForDetails);
                          setShowSalaryModal(true);
                        }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                      >
                        Edit Salary Settings
                      </button>
                    )}
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

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