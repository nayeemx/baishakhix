import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '../../utils/permissions';
import AdminSalaryDashboard from '../../components/StaffComponents/AdminSalaryDashboard';
import StaffSalaryDashboard from '../../components/StaffComponents/StaffSalaryDashboard';
import SalaryTransactionHistory from '../../components/StaffComponents/SalaryTransactionHistory';

const SalaryList = () => {
  const { user } = useSelector(state => state.auth);
  const [searchParams] = useSearchParams();
  const { isSuperUser, isAdmin, isManager } = usePermissions();
  
  // Determine if user can manage salaries (admin/manager/super_user)
  const canManageSalaries = isSuperUser || isAdmin || isManager;
  
  // Check if user wants to view personal dashboard
  const viewPersonal = searchParams.get('view') === 'personal';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Salary System</h1>
        
        {canManageSalaries && !viewPersonal ? (
          <>
            {/* Summary Cards - Full Width */}
            <div className="mb-6">
              <AdminSalaryDashboard showOnlySummary={true} />
            </div>
            
            {/* Payment Processing and Transaction History - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <AdminSalaryDashboard showOnlySummary={false} />
              </div>
              <div>
                <SalaryTransactionHistory />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Staff Dashboard Only - Full Width */}
            <div>
              <StaffSalaryDashboard />
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default SalaryList;