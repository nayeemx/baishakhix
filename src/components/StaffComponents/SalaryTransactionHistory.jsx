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

const SalaryTransactionHistory = () => {
  const { user } = useSelector(state => state.auth);
  const { isSuperUser, isAdmin, isManager } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
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
        where('role', 'in', ['super_user', 'admin', 'manager', 'sales_man', 'stock_boy', 't_staff'])
      );
      const usersSnapshot = await getDocs(usersQuery);
      const staff = [{ id: 'all', name: 'All Staff' }];
      
      usersSnapshot.forEach(doc => {
        staff.push({
          id: doc.id,
          name: doc.data().name || 'Unknown'
        });
      });

      // Sort staff by name on client side
      staff.sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(staff);
    } catch (error) {
      console.error('Error fetching staff list:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // First, ensure we have the staff list for name resolution
      if (canViewAllTransactions && staffList.length === 0) {
        await fetchStaffList();
      }

      let transactionsQuery;
      
      if (canViewAllTransactions) {
        // Admin/Manager can view all transactions
        transactionsQuery = query(
          collection(firestore, 'salary_transactions'),
          orderBy('date', 'desc')
        );
      } else {
        // Regular staff can only view their own transactions
        transactionsQuery = query(
          collection(firestore, 'salary_transactions'),
          where('staff_id', '==', user.uid),
          orderBy('date', 'desc')
        );
      }

      const transactionsSnapshot = await getDocs(transactionsQuery);
      const allTransactions = [];

      // Process transactions and resolve staff names
      for (const doc of transactionsSnapshot.docs) {
        const transaction = doc.data();
        const transactionDate = transaction.date?.toDate?.() || new Date(transaction.date);
        
        // Apply date filter
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59); // Include the entire end date
        
        if (transactionDate >= startDate && transactionDate <= endDate) {
          // Apply staff filter
          if (filters.selectedStaff === 'all' || transaction.staff_id === filters.selectedStaff) {
            // Enhanced staff name resolution
            let staffName = transaction.staff_name;
            
            // If staff_name is missing or empty, try to find it from staffList
            if (!staffName || staffName.trim() === '') {
              if (transaction.staff_id && staffList.length > 0) {
                const staffMember = staffList.find(staff => staff.id === transaction.staff_id);
                staffName = staffMember?.name || 'Unknown';
              } else if (transaction.staff_id) {
                // If staffList is not available, try to fetch the staff name directly
                staffName = await getStaffNameById(transaction.staff_id);
              }
            }
            
            allTransactions.push({
              id: doc.id,
              ...transaction,
              staff_name: staffName,
              date: transactionDate
            });
          }
        }
      }

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
        Running_Balance: calculateRunningBalance(transaction.id)
      }));

      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
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
    // This will be implemented with a PDF library
    toast.info('PDF export feature will be implemented');
  };

  const calculateRunningBalance = (transactionId) => {
    // Calculate running balance up to this transaction
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) return 0;

    let balance = 0;
    for (let i = transactions.length - 1; i >= transactionIndex; i--) {
      balance += transactions[i].amount;
    }
    return balance;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
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
                     {transaction.type}
                   </td>
                   <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                     {transaction.notes || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     ${calculateRunningBalance(transaction.id).toLocaleString()}
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
                 <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                   ${(() => {
                     const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
                     return totalBalance.toLocaleString();
                   })()}
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