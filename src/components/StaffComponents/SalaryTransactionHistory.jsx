import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { usePermissions } from '../../utils/permissions';
import { 
  collection, 
  query, 
  getDocs, 
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  doc
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { 
  FiDownload,
  FiFileText,
  FiFilter,
  FiCalendar
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Loader from '../Loader';

const SalaryTransactionHistory = () => {
  const { user } = useSelector(state => state.auth);
  const { isSuperUser, isAdmin, isManager } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [salarySettings, setSalarySettings] = useState({});
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0],
    viewMode: 'Daily',
    selectedStaff: 'all'
  });

  // Check if user can view all transactions (admin/manager/super_user) or just their own
  const canViewAllTransactions = isSuperUser || isAdmin || isManager;

  useEffect(() => {
    fetchStaffList();
    fetchSalarySettings();
    fetchTransactions();
  }, [filters, canViewAllTransactions]);

  // Add real-time listener for transactions
  useEffect(() => {
    if (!canViewAllTransactions) return;

    // Set up real-time listener for transactions
    const transactionsQuery = query(
      collection(firestore, 'salary_transactions'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      // Only update if filters haven't changed (to avoid conflicts)
      fetchTransactions();
    });

    return () => unsubscribe();
  }, [canViewAllTransactions]);

  // Add real-time listener for salary settings
  useEffect(() => {
    const salarySettingsQuery = query(collection(firestore, 'salary_settings'));

    const unsubscribe = onSnapshot(salarySettingsQuery, (snapshot) => {
      // Refresh data when salary settings change
      fetchSalarySettings();
    });

    return () => unsubscribe();
  }, []);

  // Add real-time listener for users collection
  useEffect(() => {
    if (!canViewAllTransactions) return;

    const usersQuery = query(
      collection(firestore, 'users'),
      where('role', 'in', ['admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      // Refresh data when users change
      fetchStaffList();
    });

    return () => unsubscribe();
  }, [canViewAllTransactions]);

  // Listen for custom events when transactions are added
  useEffect(() => {
    const handleTransactionAdded = () => {
      fetchTransactions();
    };

    window.addEventListener('salaryTransactionAdded', handleTransactionAdded);
    return () => window.removeEventListener('salaryTransactionAdded', handleTransactionAdded);
  }, []);

  const fetchStaffList = async () => {
    if (!canViewAllTransactions) return;

    try {
      const usersQuery = query(
        collection(firestore, 'users'),
        where('role', 'in', ['admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
      );
      const usersSnapshot = await getDocs(usersQuery);
      const staff = [{ id: 'all', name: 'All Staff' }];
      
      usersSnapshot.forEach(doc => {
        // Filter out super_user from the staff list
        const userData = doc.data();
        if (userData.role !== 'super_user') {
          staff.push({
            id: doc.id,
            name: userData.name || 'Unknown'
          });
        }
      });

      // Sort staff by name on client side
      staff.sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(staff);
    } catch (error) {
      console.error('Error fetching staff list:', error);
    }
  };

  const fetchSalarySettings = async () => {
    try {
      const salarySettingsQuery = query(collection(firestore, 'salary_settings'));
      const salarySettingsSnapshot = await getDocs(salarySettingsQuery);
      const settings = {};
      
      salarySettingsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.staff_id) {
          settings[data.staff_id] = data;
        }
      });
      
      setSalarySettings(settings);
    } catch (error) {
      console.error('Error fetching salary settings:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // First, ensure we have the staff list for name resolution
      if (canViewAllTransactions && staffList.length === 0) {
        await fetchStaffList();
      }

      let allTransactions = [];

      if (canViewAllTransactions) {
        // Admin/Manager can view all transactions
        const staffId = filters.selectedStaff === 'all' ? null : filters.selectedStaff;
        
        // Fetch salary transactions
        let transactionsQuery = query(
          collection(firestore, 'salary_transactions')
        );
        if (staffId) {
          transactionsQuery = query(
            collection(firestore, 'salary_transactions'),
            where('staff_id', '==', staffId)
          );
        }
        const transactionsSnapshot = await getDocs(transactionsQuery);

        // Process transactions
        transactionsSnapshot.forEach(doc => {
          const transaction = doc.data();
          const transactionDate = transaction.date?.toDate?.() || new Date(transaction.date);
          
          // Apply date filter
          const startDate = new Date(filters.startDate);
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59);
          
          if (transactionDate >= startDate && transactionDate <= endDate) {
            allTransactions.push({
              id: doc.id,
              ...transaction,
              date: transactionDate
            });
          }
        });
      } else {
        // Regular staff can only view their own transactions
        const transactionsQuery = query(
          collection(firestore, 'salary_transactions'),
          where('staff_id', '==', user.uid)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        transactionsSnapshot.forEach(doc => {
          const transaction = doc.data();
          const transactionDate = transaction.date?.toDate?.() || new Date(transaction.date);
          
          // Apply date filter
          const startDate = new Date(filters.startDate);
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59);
          
          if (transactionDate >= startDate && transactionDate <= endDate) {
            allTransactions.push({
              id: doc.id,
              ...transaction,
              date: transactionDate
            });
          }
        });
      }

      // Sort all transactions by date (newest first)
      allTransactions.sort((a, b) => b.date - a.date);

      // Apply view mode grouping
      let processedTransactions = allTransactions;
      
      if (filters.viewMode === 'Weekly') {
        // Group by week but show individual transactions
        const weeklyGroups = {};
        allTransactions.forEach(transaction => {
          const weekStart = getWeekStart(transaction.date);
          const weekKey = weekStart.toISOString().split('T')[0];
          
          if (!weeklyGroups[weekKey]) {
            weeklyGroups[weekKey] = [];
          }
          weeklyGroups[weekKey].push(transaction);
        });

        // Flatten all transactions but add week information
        processedTransactions = [];
        Object.entries(weeklyGroups).forEach(([weekKey, weekTransactions]) => {
          weekTransactions.forEach(transaction => {
            const weekStartDate = new Date(weekKey);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            
            processedTransactions.push({
              ...transaction,
              weekStart: weekStartDate,
              weekLabel: `Week of ${weekStartDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
            });
          });
        });
        
        // Sort by week start date (descending) then by transaction date (descending)
        processedTransactions.sort((a, b) => {
          if (a.weekStart.getTime() !== b.weekStart.getTime()) {
            return b.weekStart - a.weekStart;
          }
          return b.date - a.date;
        });
      }

      setTransactions(processedTransactions);

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Calculate the start of the week (Sunday = 0)
    // Get the start of the week (Sunday)
    const daysToSubtract = day;
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysToSubtract);
    return weekStart;
  };

  const getStaffNameById = async (staffId) => {
    try {
      const staffDoc = await getDoc(doc(firestore, 'users', staffId));
      if (staffDoc.exists()) {
        return staffDoc.data().name || 'Unknown';
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error fetching staff name:', error);
      return 'Unknown';
    }
  };

  const exportToCSV = () => {
    try {
      const csvData = transactions.map(transaction => ({
        Date: transaction.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        Staff: transaction.staff_name || 'N/A',
        Amount: transaction.amount,
        Type: transaction.type,
        Notes: transaction.notes || '',
        Running_Balance: calculateRunningBalance(transaction.id).toFixed(2)
      }));

      // Add summary row
      if (transactions.length > 0) {
        const staffBalances = {};
        
        // Get the latest transaction for each staff member
        transactions.forEach(transaction => {
          const staffId = transaction.staff_id;
          if (!staffBalances[staffId] || transaction.date > staffBalances[staffId].date) {
            staffBalances[staffId] = {
              balance: calculateRunningBalance(transaction.id),
              date: transaction.date
            };
          }
        });
        
        // Sum up the final balances
        const totalBalance = Object.values(staffBalances).reduce((sum, staff) => {
          return sum + staff.balance;
        }, 0);

        const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
        const uniqueStaff = [...new Set(transactions.map(t => t.staff_name).filter(name => name && name !== 'Unknown'))];
        const uniqueTypes = [...new Set(transactions.map(t => t.type))];

        csvData.push({
          Date: 'SUMMARY',
          Staff: `${uniqueStaff.length} Staff Members`,
          Amount: totalAmount,
          Type: uniqueTypes.join(', '),
          Notes: `${transactions.length} Transactions`,
          Running_Balance: totalBalance.toFixed(2)
        });
      }

      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary_transactions_${filters.startDate}_${filters.endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const exportToPDF = () => {
    try {
      // Import jsPDF dynamically
      import('jspdf').then(({ default: jsPDF }) => {
        import('jspdf-autotable').then(({ default: autoTable }) => {
          const doc = new jsPDF();
          
          // Add title
          doc.setFontSize(16);
          doc.text('Salary Transaction History', 14, 22);
          doc.setFontSize(10);
          doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, 14, 30);
          doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
          
          // Prepare table data
          const tableData = transactions.map(transaction => [
            transaction.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            transaction.staff_name || 'Unknown',
            `${transaction.amount > 0 ? '+' : ''}${transaction.amount}`,
            transaction.type,
            transaction.notes || '-',
            calculateRunningBalance(transaction.id).toFixed(2)
          ]);

          // Add summary row
          if (transactions.length > 0) {
            const staffBalances = {};
            
            transactions.forEach(transaction => {
              const staffId = transaction.staff_id;
              if (!staffBalances[staffId] || transaction.date > staffBalances[staffId].date) {
                staffBalances[staffId] = {
                  balance: calculateRunningBalance(transaction.id),
                  date: transaction.date
                };
              }
            });
            
            const totalBalance = Object.values(staffBalances).reduce((sum, staff) => {
              return sum + staff.balance;
            }, 0);

            const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
            const uniqueStaff = [...new Set(transactions.map(t => t.staff_name).filter(name => name && name !== 'Unknown'))];
            const uniqueTypes = [...new Set(transactions.map(t => t.type))];

            tableData.push([
              'SUMMARY',
              `${uniqueStaff.length} Staff Members`,
              totalAmount.toString(),
              uniqueTypes.join(', '),
              `${transactions.length} Transactions`,
              totalBalance.toFixed(2)
            ]);
          }

          // Create table
          autoTable(doc, {
            head: [['Date', 'Staff', 'Amount', 'Type', 'Notes', 'Running Balance']],
            body: tableData,
            startY: 45,
            styles: {
              fontSize: 8,
              cellPadding: 2
            },
            headStyles: {
              fillColor: [66, 139, 202],
              textColor: 255
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245]
            }
          });

          // Save PDF
          doc.save(`salary_transactions_${filters.startDate}_${filters.endDate}.pdf`);
          toast.success('PDF exported successfully');
        }).catch(error => {
          console.error('Error loading jspdf-autotable:', error);
          toast.error('PDF export failed - autotable not available');
        });
      }).catch(error => {
        console.error('Error loading jsPDF:', error);
        toast.error('PDF export failed - jsPDF not available');
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  const calculateRunningBalance = (transactionId) => {
    // Calculate running balance up to this transaction
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) return 0;

    // Get the staff member for this transaction
    const transaction = transactions[transactionIndex];
    const staffId = transaction.staff_id;
    
    // Get all transactions for this staff member up to this transaction
    const staffTransactions = transactions
      .filter(t => t.staff_id === staffId)
      .sort((a, b) => a.date - b.date); // Sort by date ascending
    
    const currentTransactionIndex = staffTransactions.findIndex(t => t.id === transactionId);
    
    // Calculate total taken up to this transaction
    let totalTaken = 0;
    for (let i = 0; i <= currentTransactionIndex; i++) {
      totalTaken += staffTransactions[i].amount;
    }
    
    // Get the staff's monthly salary and effective date
    const monthlySalary = salarySettings[staffId]?.monthly_salary || 0;
    
    // Get the effective date
    let effectiveDate;
    try {
      if (salarySettings[staffId]?.effective_date?.toDate) {
        effectiveDate = salarySettings[staffId].effective_date.toDate();
      } else if (salarySettings[staffId]?.effective_date) {
        effectiveDate = new Date(salarySettings[staffId].effective_date);
      } else {
        effectiveDate = new Date();
      }
      
      if (isNaN(effectiveDate.getTime())) {
        effectiveDate = new Date();
      }
    } catch (error) {
      effectiveDate = new Date();
    }
    
    // Calculate carryover from completed months (same logic as AdminSalaryDashboard)
    let carryover = 0;
    let extraPayments = 0;
    
    // Calculate all months from effective date to current month (completed months only)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(effectiveDate);
    currentDate.setDate(1);
    currentDate.setHours(0, 0, 0, 0);
    
    while (currentDate < currentMonth) {
      const monthTotal = staffTransactions
        .filter(t => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === currentDate.getFullYear() && 
                 tDate.getMonth() === currentDate.getMonth();
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      if (monthTotal < monthlySalary) {
        // Staff took less than monthly salary - add to carryover
        carryover += (monthlySalary - monthTotal);
      } else if (monthTotal > monthlySalary) {
        // Staff took more than monthly salary - add to extra payments
        extraPayments += (monthTotal - monthlySalary);
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Calculate current month's salary entitlement
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const currentMonthTotal = staffTransactions
      .filter(t => {
        const tDate = new Date(t.date);
        return tDate.getFullYear() === currentMonthStart.getFullYear() && 
               tDate.getMonth() === currentMonthStart.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Running balance = Carryover + Current Month Salary - Current Month Taken - Total Taken
    // This gives us: Available Balance = (Carryover + Monthly Salary) - Total Taken
    const runningBalance = carryover + monthlySalary - totalTaken;
    
    // Debug logging
    console.log(`Running Balance Debug for ${transaction.staff_name}:`, {
      transactionId,
      totalTaken,
      monthlySalary,
      carryover,
      extraPayments,
      runningBalance: carryover - totalTaken
    });
    
    return runningBalance;
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6" id="transaction-history">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Transaction History</h2>
        <div className="flex space-x-2">
          <button
            onClick={exportToCSV}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <FiDownload className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <FiFileText className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
          <select
            value={filters.viewMode}
            onChange={(e) => setFilters(prev => ({ ...prev, viewMode: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Weekly">Weekly</option>
            <option value="Daily">Daily</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>

        {canViewAllTransactions && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
            <select
              value={filters.selectedStaff}
              onChange={(e) => setFilters(prev => ({ ...prev, selectedStaff: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DATE
              </th>
              {canViewAllTransactions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  STAFF
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AMOUNT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                TYPE
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NOTES
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RUNNING BALANCE
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {filters.viewMode === 'Weekly' && transaction.weekLabel ? (
                      <div>
                        <div className="font-medium text-purple-600">{transaction.weekLabel}</div>
                        <div className="text-xs text-gray-500">{transaction.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      </div>
                    ) : (
                      transaction.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    )}
                  </td>
                  {canViewAllTransactions && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-gray-600">
                            {transaction.staff_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {transaction.staff_name || 'Unknown'}
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}${transaction.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      transaction.type === 'Repayment' 
                        ? 'bg-green-100 text-green-800' 
                        : transaction.type === 'Fine'
                        ? 'bg-red-100 text-red-800'
                        : transaction.type === 'Bonus'
                        ? 'bg-yellow-100 text-yellow-800'
                        : transaction.type === 'Extra_Payment'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {transaction.notes || '-'}
                  </td>
                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     <span className={`font-medium ${
                       calculateRunningBalance(transaction.id) >= 0 ? 'text-green-600' : 'text-red-600'
                     }`}>
                       ${calculateRunningBalance(transaction.id).toFixed(2)}
                     </span>
                   </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canViewAllTransactions ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                  <FiCalendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No transactions found for the selected filters</p>
                </td>
              </tr>
            )}
            
            {/* Summary Row */}
            {transactions.length > 0 && (
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  SUMMARY
                </td>
                {canViewAllTransactions && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {(() => {
                      const uniqueStaff = [...new Set(transactions.map(t => t.staff_name).filter(name => name && name !== 'Unknown'))];
                      return `${uniqueStaff.length} Staff Members`;
                    })()}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                  ${(() => {
                    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
                    return totalAmount.toLocaleString();
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {(() => {
                    const uniqueTypes = [...new Set(transactions.map(t => t.type))];
                    return uniqueTypes.join(', ');
                  })()}
                </td>

                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                  {transactions.length} Transactions
                </td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                   <span className={`${
                     (() => {
                       // Calculate the final running balance for each staff member and sum them
                       const staffBalances = {};
                       
                       // Get the latest transaction for each staff member
                       transactions.forEach(transaction => {
                         const staffId = transaction.staff_id;
                         if (!staffBalances[staffId] || transaction.date > staffBalances[staffId].date) {
                           staffBalances[staffId] = {
                             balance: calculateRunningBalance(transaction.id),
                             date: transaction.date
                           };
                         }
                       });
                       
                       // Sum up the final balances
                       const totalBalance = Object.values(staffBalances).reduce((sum, staff) => {
                         return sum + staff.balance;
                       }, 0);
                       
                       return totalBalance >= 0 ? 'text-green-600' : 'text-red-600';
                     })()
                   }`}>
                     ${(() => {
                       // Calculate the final running balance for each staff member and sum them
                       const staffBalances = {};
                       
                       // Get the latest transaction for each staff member
                       transactions.forEach(transaction => {
                         const staffId = transaction.staff_id;
                         if (!staffBalances[staffId] || transaction.date > staffBalances[staffId].date) {
                           staffBalances[staffId] = {
                             balance: calculateRunningBalance(transaction.id),
                             date: transaction.date
                           };
                         }
                       });
                       
                       // Sum up the final balances
                       const totalBalance = Object.values(staffBalances).reduce((sum, staff) => {
                         return sum + staff.balance;
                       }, 0);
                       
                       return totalBalance.toLocaleString();
                     })()}
                   </span>
                 </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalaryTransactionHistory;