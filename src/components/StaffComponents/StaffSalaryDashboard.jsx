import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  getDocs, 
  where,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { 
  FiDollarSign, 
  FiTrendingUp, 
  FiTrendingDown,
  FiCalendar,
  FiDownload,
  FiFileText,
  FiAlertTriangle,
  FiUser,
  FiSettings
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Loader from '../Loader';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePermissions } from '../../utils/permissions';

const StaffSalaryDashboard = () => {
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const { isSuperUser, isAdmin, isManager } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState({
    monthlySalary: 0,
    currentBalance: 0,
    totalEarned: 0,
    totalPaid: 0,
    recentTransactions: [],
    weeklyData: [],
    monthlyData: []
  });


  useEffect(() => {
    if (user?.uid) {
      fetchSalaryData();
    }
  }, [user]);

  // Add real-time listener for salary transactions
  useEffect(() => {
    if (!user?.uid) return;

    const transactionsQuery = query(
      collection(firestore, 'salary_transactions'),
      where('staff_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      fetchSalaryData();
    });

    return () => unsubscribe();
  }, [user]);

  // Add real-time listener for salary settings
  useEffect(() => {
    if (!user?.uid) return;

    const salarySettingsQuery = query(
      collection(firestore, 'salary_settings'),
      where('staff_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(salarySettingsQuery, (snapshot) => {
      fetchSalaryData();
    });

    return () => unsubscribe();
  }, [user]);

  const fetchSalaryData = async () => {
    try {
      setLoading(true);

      // Fetch salary settings for current user
      const salarySettingsQuery = query(
        collection(firestore, 'salary_settings'),
        where('staff_id', '==', user.uid)
      );
      const salarySettingsSnapshot = await getDocs(salarySettingsQuery);
      let monthlySalary = 0;
      
      if (!salarySettingsSnapshot.empty) {
        monthlySalary = salarySettingsSnapshot.docs[0].data().monthly_salary || 0;
      }

      // Fetch all transactions for current user (without orderBy to avoid index requirement)
      const transactionsQuery = query(
        collection(firestore, 'salary_transactions'),
        where('staff_id', '==', user.uid)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      let totalEarned = 0;
      let totalPaid = 0;
      let currentBalance = 0;
      const allTransactions = [];

      // Process all transactions and sort by date
      transactionsSnapshot.forEach((doc) => {
        const transaction = doc.data();
        const amount = transaction.amount || 0;
        
        if (amount > 0) {
          totalEarned += amount;
        } else {
          totalPaid += Math.abs(amount);
        }
        
        currentBalance += amount;
        
        allTransactions.push({
          id: doc.id,
          ...transaction,
          date: transaction.date?.toDate?.() || new Date(transaction.date)
        });
      });

             // Sort by date descending (most recent first)
       allTransactions.sort((a, b) => b.date - a.date);
       
       // Get recent transactions (first 5 after sorting)
       const recentTransactions = allTransactions.slice(0, 5);

       // Generate weekly data from actual transactions
       const weeklyData = generateWeeklyData(allTransactions, monthlySalary);
       
       // Generate monthly data from actual transactions
       const monthlyData = generateMonthlyData(allTransactions, monthlySalary);

      setSalaryData({
        monthlySalary,
        currentBalance,
        totalEarned,
        totalPaid,
        recentTransactions,
        weeklyData,
        monthlyData
      });

    } catch (error) {
      console.error('Error fetching salary data:', error);
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
     };

   // Helper function to generate weekly data from actual transactions
   const generateWeeklyData = (transactions, monthlySalary) => {
     const weeklySalary = monthlySalary / 4; // Assuming 4 weeks per month
     const currentDate = new Date();
     const currentWeek = Math.ceil(currentDate.getDate() / 7);
     
     const weeklyData = [];
     for (let week = 1; week <= 4; week++) {
       const weekStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), (week - 1) * 7 + 1);
       const weekEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), week * 7);
       
       // Filter transactions for this week
       const weekTransactions = transactions.filter(transaction => {
         const transactionDate = new Date(transaction.date);
         return transactionDate >= weekStart && transactionDate <= weekEnd;
       });
       
       const received = weekTransactions.reduce((sum, transaction) => {
         return sum + (transaction.amount > 0 ? transaction.amount : 0);
       }, 0);
       
       weeklyData.push({
         week: `Week ${week}`,
         allocated: weeklySalary,
         received: received
       });
     }
     
     return weeklyData;
   };

   // Helper function to generate monthly data from actual transactions
   const generateMonthlyData = (transactions, monthlySalary) => {
     const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
     const currentDate = new Date();
     const monthlyData = [];
     
     // Generate data for last 6 months
     for (let i = 5; i >= 0; i--) {
       const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
       const monthName = months[monthDate.getMonth()];
       
       // Filter transactions for this month
       const monthTransactions = transactions.filter(transaction => {
         const transactionDate = new Date(transaction.date);
         return transactionDate.getMonth() === monthDate.getMonth() && 
                transactionDate.getFullYear() === monthDate.getFullYear();
       });
       
       const received = monthTransactions.reduce((sum, transaction) => {
         return sum + (transaction.amount > 0 ? transaction.amount : 0);
       }, 0);
       
       const balance = monthlySalary - received;
       
       monthlyData.push({
         month: monthName,
         allocated: monthlySalary,
         received: received,
         balance: balance
       });
     }
     
     return monthlyData;
   };

  const exportPaySlip = () => {
    try {
      // Create pay slip content
      const currentDate = new Date().toLocaleDateString();
      const paySlipContent = `
PAY SLIP

Employee Information:
Name: ${user?.name || 'Unknown'}
Role: ${user?.role || 'Unknown'}
Date: ${currentDate}

Salary Details:
Monthly Salary: $${salaryData.monthlySalary.toLocaleString()}
Total Earned: $${salaryData.totalEarned.toLocaleString()}
Total Paid: $${salaryData.totalPaid.toLocaleString()}
Current Balance: $${salaryData.currentBalance.toLocaleString()}

Recent Transactions:
${salaryData.recentTransactions.map(transaction => 
  `${transaction.date.toLocaleDateString()} - ${transaction.type}: $${transaction.amount.toLocaleString()}`
).join('\n')}

Generated on: ${currentDate}
      `.trim();
      
      // Create and download file
      const blob = new Blob([paySlipContent], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pay_slip_${user?.name || 'user'}_${new Date().toISOString().split('T')[0]}.txt`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Pay slip exported successfully');
    } catch (error) {
      console.error('Error exporting pay slip:', error);
      toast.error('Failed to export pay slip');
    }
  };

  const downloadStatement = () => {
    try {
      // Create CSV content
      let csvContent = 'Date,Amount,Type,Notes,Running Balance\n';
      
      // Add transaction data
      salaryData.recentTransactions.forEach((transaction, index) => {
        const date = transaction.date.toLocaleDateString();
        const amount = transaction.amount;
        const type = transaction.type;
        const notes = transaction.notes || '';
        const runningBalance = salaryData.currentBalance - (index * 100);
        
        csvContent += `${date},${amount},${type},"${notes}",${runningBalance}\n`;
      });
      
      // Add summary data
      csvContent += '\nSummary\n';
      csvContent += `Monthly Salary,${salaryData.monthlySalary}\n`;
      csvContent += `Total Earned,${salaryData.totalEarned}\n`;
      csvContent += `Total Paid,${salaryData.totalPaid}\n`;
      csvContent += `Current Balance,${salaryData.currentBalance}\n`;
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `salary_statement_${user?.name || 'user'}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Statement downloaded successfully');
    } catch (error) {
      console.error('Error downloading statement:', error);
      toast.error('Failed to download statement');
    }
  };

  const navigateToAdminDashboard = () => {
    navigate('/staff/salary');
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
             {/* User Profile Section */}
       <div className="bg-white rounded-lg shadow-md p-6">
         <div className="flex items-center justify-between">
           <div className="flex items-center space-x-4">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
               {user?.avatarUrl ? (
                 <img 
                   src={user.avatarUrl} 
                   alt={user?.name || 'User'} 
                   className="w-full h-full object-cover"
                 />
               ) : (
                 <FiUser className="w-8 h-8 text-blue-600" />
               )}
             </div>
             <div>
               <h2 className="text-2xl font-bold text-gray-900">{user?.name || user?.displayName || 'Unknown User'}</h2>
               <p className="text-gray-600">{user?.role || 'Unknown Role'}</p>
               <p className="text-sm text-gray-500">Joined: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown Date'}</p>
             </div>
           </div>
           <div className="flex items-center space-x-4">
             <div className="text-right">
               <p className="text-sm text-gray-600">Monthly Salary</p>
               <p className="text-3xl font-bold text-blue-600">${salaryData.monthlySalary.toLocaleString()}</p>
             </div>
             
             {/* Admin/Manager Dashboard Button */}
             {(isSuperUser || isAdmin || isManager) && (
               <button
                 onClick={navigateToAdminDashboard}
                 className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
               >
                 <FiSettings className="w-4 h-4 mr-2" />
                 Admin Dashboard
               </button>
             )}
           </div>
         </div>
       </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Current Month Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Current Month Summary</h3>
                         <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-gray-600">Total Allocated:</span>
                 <span className="font-bold text-gray-900">${salaryData.monthlySalary.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-600">Received So Far:</span>
                 <span className="font-bold text-green-600">${salaryData.totalEarned.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-600">Remaining:</span>
                 <span className={`font-bold ${(salaryData.monthlySalary - salaryData.totalEarned) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                   ${(salaryData.monthlySalary - salaryData.totalEarned).toLocaleString()}
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-600">Current Balance:</span>
                 <span className={`font-bold ${salaryData.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                   ${salaryData.currentBalance.toLocaleString()}
                 </span>
               </div>
             </div>
          </div>

          {/* Weekly Salary Breakdown Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Weekly Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salaryData.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="allocated" fill="#3B82F6" name="Allocated" />
                <Bar dataKey="received" fill="#10B981" name="Received" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Monthly Salary Trend Graph */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Salary Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salaryData.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="allocated" stroke="#3B82F6" strokeWidth={2} name="Allocated" />
                <Line type="monotone" dataKey="received" stroke="#10B981" strokeWidth={2} name="Received" />
                <Line type="monotone" dataKey="balance" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" name="Balance" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">My Transaction History</h3>
              <button
                onClick={downloadStatement}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FiDownload className="w-4 h-4 mr-2" />
                Download Statement
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex space-x-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Daily</option>
                </select>
              </div>
            </div>

            {/* Transaction Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">DATE</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">AMOUNT</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">TYPE</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">NOTES</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">RUNNING BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryData.recentTransactions.length > 0 ? (
                    salaryData.recentTransactions.map((transaction, index) => (
                      <tr key={transaction.id} className="border-b border-gray-100">
                        <td className="py-2 text-sm text-gray-900">
                          {transaction.date.toLocaleDateString()}
                        </td>
                        <td className="py-2 text-sm font-medium text-green-600">
                          ${transaction.amount.toLocaleString()}
                        </td>
                        <td className="py-2 text-sm text-gray-900">
                          {transaction.type}
                          {transaction.type === 'Overtime' && transaction.overtimeHours && transaction.overtimeRate && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({transaction.overtimeHours}h @ ${transaction.overtimeRate}/h)
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-sm text-gray-600">
                          {transaction.notes || '-'}
                        </td>
                        <td className="py-2 text-sm text-gray-900">
                          ${(salaryData.currentBalance - (index * 100)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        <FiCalendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffSalaryDashboard;