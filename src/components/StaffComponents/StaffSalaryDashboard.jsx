import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
  FiAlertTriangle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Loader from '../Loader';

const StaffSalaryDashboard = () => {
  const { user } = useSelector(state => state.auth);
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState({
    monthlySalary: 0,
    currentBalance: 0,
    totalEarned: 0,
    totalPaid: 0,
    recentTransactions: []
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
      where('staff_id', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      // Refresh data when transactions change
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
      // Refresh data when salary settings change
      fetchSalaryData();
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for custom events when transactions are added
  useEffect(() => {
    const handleTransactionAdded = () => {
      fetchSalaryData();
    };

    window.addEventListener('salaryTransactionAdded', handleTransactionAdded);
    return () => window.removeEventListener('salaryTransactionAdded', handleTransactionAdded);
  }, []);

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

      // Fetch all transactions for current user
      const transactionsQuery = query(
        collection(firestore, 'salary_transactions'),
        where('staff_id', '==', user.uid),
        orderBy('date', 'desc')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      let totalEarned = 0;
      let totalPaid = 0;
      let currentBalance = 0;
      const recentTransactions = [];

      transactionsSnapshot.forEach((doc, index) => {
        const transaction = doc.data();
        const amount = transaction.amount || 0;
        
        if (amount > 0) {
          totalEarned += amount;
        } else {
          totalPaid += Math.abs(amount);
        }
        
        currentBalance += amount;
        
        if (index < 5) {
          recentTransactions.push({
            id: doc.id,
            ...transaction,
            date: transaction.date?.toDate?.() || new Date(transaction.date)
          });
        }
      });

      setSalaryData({
        monthlySalary,
        currentBalance,
        totalEarned,
        totalPaid,
        recentTransactions
      });

    } catch (error) {
      console.error('Error fetching salary data:', error);
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const exportPaySlip = () => {
    // This will be implemented to generate and download pay slip
    toast.info('Pay slip export feature will be implemented');
  };

  const exportTransactionHistory = () => {
    // This will be implemented to export transaction history
    toast.info('Transaction history export feature will be implemented');
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <FiDollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Monthly Salary</p>
              <p className="text-2xl font-bold text-gray-900">${salaryData.monthlySalary.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${salaryData.currentBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <FiTrendingUp className={`w-6 h-6 ${salaryData.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Balance</p>
              <p className={`text-2xl font-bold ${salaryData.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${salaryData.currentBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <FiTrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Earned</p>
              <p className="text-2xl font-bold text-gray-900">${salaryData.totalEarned.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <FiTrendingDown className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900">${salaryData.totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Salary Summary</h2>
            <button
              onClick={exportPaySlip}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              <FiFileText className="w-4 h-4 mr-2" />
              Export Pay Slip
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Monthly Salary:</span>
                <span className="font-semibold">${salaryData.monthlySalary.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Balance:</span>
                <span className={`font-semibold ${salaryData.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${salaryData.currentBalance.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  salaryData.currentBalance >= 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {salaryData.currentBalance >= 0 ? 'In Credit' : 'Owed to Company'}
                </span>
              </div>
            </div>
          </div>

          {salaryData.currentBalance < 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <FiAlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Outstanding Balance</p>
                  <p className="text-xs text-yellow-700">
                    You owe ${Math.abs(salaryData.currentBalance).toLocaleString()} to the company. 
                    You can pay this back at your convenience.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Recent Transactions</h2>
            <button
              onClick={exportTransactionHistory}
              className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <FiDownload className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
          
          <div className="space-y-3">
            {salaryData.recentTransactions.length > 0 ? (
              salaryData.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      transaction.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {transaction.amount > 0 ? (
                        <FiTrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <FiTrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{transaction.type}</p>
                      <p className="text-xs text-gray-500">
                        {transaction.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount > 0 ? '+' : ''}${transaction.amount.toLocaleString()}
                    </p>
                    {transaction.notes && (
                      <p className="text-xs text-gray-500 truncate max-w-32">
                        {transaction.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiCalendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No transactions found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffSalaryDashboard;