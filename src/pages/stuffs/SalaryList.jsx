import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { usePermissions } from '../../utils/permissions';
import AdminSalaryDashboard from '../../components/StaffComponents/AdminSalaryDashboard';
import StaffSalaryDashboard from '../../components/StaffComponents/StaffSalaryDashboard';
import SalaryTransactionHistory from '../../components/StaffComponents/SalaryTransactionHistory';

const SalaryList = () => {
  const { user } = useSelector(state => state.auth);
  const { isSuperUser, isAdmin, isManager } = usePermissions();
  
  // Determine if user can manage salaries (admin/manager/super_user)
  const canManageSalaries = isSuperUser || isAdmin || isManager;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Salary System</h1>
        
        {canManageSalaries ? (
          <AdminSalaryDashboard />
        ) : (
          <StaffSalaryDashboard />
        )}
        
        <div className="mt-8">
          <SalaryTransactionHistory />
        </div>
      </div>
    </div>
  );
};

export default SalaryList;