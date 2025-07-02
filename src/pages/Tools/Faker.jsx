import React, { useState } from 'react';
import { FiUserPlus, FiTrash2, FiEdit, FiDownload, FiSettings, FiEye, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { AiOutlineFileExcel, AiOutlineFileText } from 'react-icons/ai';
import { FaRegCalendarAlt } from 'react-icons/fa';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const defaultEmployees = [
  { name: 'iqbal', role: 'manager', base: 50000 },
  { name: 'mukter', role: 'sales man', base: 25000 },
  { name: 'sharif', role: 'stock boy', base: 18000 },
  { name: 'Hasan', role: 'temporary staff', base: 12000 },
  { name: '', role: 'temporary staff', base: 12000 }
];

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSalaryData(employees, years, eidMonths) {
  const startYear = currentYear;
  return employees.map(emp => {
    let carryover = 0;
    const salary_sheet = [];
    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        const month = months[m];
        const year = startYear + y;
        const festival_bonus = eidMonths.includes(month) ? emp.base : 0;
        const overtime = randomInt(0, 5000);
        const advance_salary = Math.random() < 0.2 ? randomInt(1000, 5000) : 0;
        const due_salary = Math.random() < 0.1 ? randomInt(500, 2000) : 0;
        const underpaid_salary = Math.random() < 0.1 ? randomInt(500, 2000) : 0;
        carryover += due_salary - underpaid_salary;
        const net_paid = emp.base + festival_bonus + overtime - advance_salary - due_salary + underpaid_salary + carryover;
        salary_sheet.push({
          year, month, base_salary: emp.base, festival_bonus, overtime, advance_salary, due_salary, underpaid_salary, carryover, net_paid
        });
      }
    }
    return { name: emp.name, role: emp.role, salary_sheet };
  });
}

function generateOperatingCostData(years, salesRange, purchaseCostRange, shopExpensesRange) {
  const startYear = currentYear;
  const operatingCostData = [];
  
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) {
      const month = months[m];
      const year = startYear + y;
      
      // Generate random values within specified ranges
      const sales = randomInt(salesRange.min, salesRange.max);
      const purchaseCost = randomInt(purchaseCostRange.min, Math.min(purchaseCostRange.max, sales)); // Ensure purchase cost doesn't exceed sales
      const shopExpenses = randomInt(shopExpensesRange.min, shopExpensesRange.max);
      
      // Calculate profit and operating cost using your formula
      const profit = sales - purchaseCost;
      const operatingCost = shopExpenses + purchaseCost;
      
      operatingCostData.push({
        year,
        month,
        sales,
        purchase_cost: purchaseCost,
        shop_expenses: shopExpenses,
        profit,
        operating_cost: operatingCost
      });
    }
  }
  
  return operatingCostData;
}

const Faker = () => {
  const [dataType, setDataType] = useState('salary'); // 'salary' or 'operating_cost'
  const [employees, setEmployees] = useState(defaultEmployees);
  const [years, setYears] = useState(5);
  const [eidMonths, setEidMonths] = useState(['April', 'June']);
  
  // Operating cost configuration
  const [salesRange, setSalesRange] = useState({ min: 50000, max: 200000 });
  const [purchaseCostRange, setPurchaseCostRange] = useState({ min: 30000, max: 150000 });
  const [shopExpensesRange, setShopExpensesRange] = useState({ min: 5000, max: 25000 });
  
  const [generated, setGenerated] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState(null);
  const [previewOperatingCost, setPreviewOperatingCost] = useState(null);

  // Employee management
  const handleAddEmployee = () => {
    setEmployees([...employees, { name: '', role: '', base: 10000 }]);
  };
  const handleRemoveEmployee = idx => {
    setEmployees(employees.filter((_, i) => i !== idx));
  };
  const handleEmployeeChange = (idx, field, value) => {
    setEmployees(employees.map((emp, i) => i === idx ? { ...emp, [field]: field === 'base' ? Number(value) : value } : emp));
  };
  const handleEidMonthToggle = month => {
    setEidMonths(eidMonths.includes(month) ? eidMonths.filter(m => m !== month) : [...eidMonths, month]);
  };
  
  const handleGenerate = () => {
    if (dataType === 'salary') {
      const data = generateSalaryData(employees, years, eidMonths);
      setGenerated(data);
      setPreviewOperatingCost(null);
    } else {
      const data = generateOperatingCostData(years, salesRange, purchaseCostRange, shopExpensesRange);
      setGenerated([{ name: 'Operating Cost Data', data }]);
      setPreviewEmployee(null);
    }
    setShowPreview(false);
  };
  
  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(generated, null, 2)], { type: 'application/json' });
    saveAs(blob, `${dataType}_data.json`);
  };
  
  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    if (dataType === 'salary') {
      generated.forEach(emp => {
        const ws = XLSX.utils.json_to_sheet(emp.salary_sheet);
        XLSX.utils.book_append_sheet(wb, ws, emp.name || emp.role);
      });
    } else {
      const ws = XLSX.utils.json_to_sheet(generated[0].data);
      XLSX.utils.book_append_sheet(wb, ws, 'Operating Cost Data');
    }
    XLSX.writeFile(wb, `${dataType}_data.xlsx`);
  };
  
  const handlePreview = (idx) => {
    if (dataType === 'salary') {
      setPreviewEmployee(generated[idx]);
      setPreviewOperatingCost(null);
    } else {
      setPreviewOperatingCost(generated[0].data);
      setPreviewEmployee(null);
    }
    setShowPreview(true);
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        <FiSettings className="text-blue-500" /> Advanced Data Generator
      </h1>
      
      {/* Data Type Selector */}
      <div className="bg-white rounded shadow p-4 mb-6">
        <label className="block font-semibold mb-2">Data Type</label>
        <div className="flex gap-4">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded border ${
              dataType === 'salary' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
            onClick={() => setDataType('salary')}
          >
            <FiUserPlus /> Salary Data
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded border ${
              dataType === 'operating_cost' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
            onClick={() => setDataType('operating_cost')}
          >
            <FiTrendingUp /> Operating Cost Data
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded shadow p-4 mb-6">
        {dataType === 'salary' ? (
          // Salary Configuration
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1">
              <label className="block font-semibold mb-1">Employees</label>
              {employees.map((emp, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-center">
                  <input
                    className="border rounded px-2 py-1 w-32"
                    placeholder="Name"
                    value={emp.name}
                    onChange={e => handleEmployeeChange(idx, 'name', e.target.value)}
                  />
                  <input
                    className="border rounded px-2 py-1 w-32"
                    placeholder="Role"
                    value={emp.role}
                    onChange={e => handleEmployeeChange(idx, 'role', e.target.value)}
                  />
                  <input
                    className="border rounded px-2 py-1 w-24"
                    type="number"
                    min={0}
                    placeholder="Base Salary"
                    value={emp.base}
                    onChange={e => handleEmployeeChange(idx, 'base', e.target.value)}
                  />
                  <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveEmployee(idx)} title="Remove"><FiTrash2 /></button>
                </div>
              ))}
              <button className="mt-2 flex items-center gap-1 text-blue-600 hover:text-blue-800" onClick={handleAddEmployee}><FiUserPlus /> Add Employee</button>
            </div>
            <div>
              <label className="block font-semibold mb-1">Years</label>
              <input
                className="border rounded px-2 py-1 w-20"
                type="number"
                min={1}
                max={10}
                value={years}
                onChange={e => setYears(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Eid Months</label>
              <div className="flex flex-wrap gap-1">
                {months.map(month => (
                  <button
                    key={month}
                    className={`px-2 py-1 rounded text-xs border ${eidMonths.includes(month) ? 'bg-green-100 text-green-700 border-green-400' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
                    onClick={() => handleEidMonthToggle(month)}
                    type="button"
                  >{month}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Operating Cost Configuration
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold mb-1">Years</label>
              <input
                className="border rounded px-2 py-1 w-full"
                type="number"
                min={1}
                max={10}
                value={years}
                onChange={e => setYears(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Sales Range (BDT)</label>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Min"
                  value={salesRange.min}
                  onChange={e => setSalesRange({...salesRange, min: Number(e.target.value)})}
                />
                <span className="self-center">-</span>
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Max"
                  value={salesRange.max}
                  onChange={e => setSalesRange({...salesRange, max: Number(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Purchase Cost Range (BDT)</label>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Min"
                  value={purchaseCostRange.min}
                  onChange={e => setPurchaseCostRange({...purchaseCostRange, min: Number(e.target.value)})}
                />
                <span className="self-center">-</span>
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Max"
                  value={purchaseCostRange.max}
                  onChange={e => setPurchaseCostRange({...purchaseCostRange, max: Number(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Shop Expenses Range (BDT)</label>
              <div className="flex gap-2">
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Min"
                  value={shopExpensesRange.min}
                  onChange={e => setShopExpensesRange({...shopExpensesRange, min: Number(e.target.value)})}
                />
                <span className="self-center">-</span>
                <input
                  className="border rounded px-2 py-1 w-20"
                  type="number"
                  placeholder="Max"
                  value={shopExpensesRange.max}
                  onChange={e => setShopExpensesRange({...shopExpensesRange, max: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2" onClick={handleGenerate}>
            <FiSettings /> Generate {dataType === 'salary' ? 'Salary' : 'Operating Cost'} Data
          </button>
        </div>
      </div>

      {/* Results Section */}
      {generated.length > 0 && (
        <div className="bg-white rounded shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" onClick={handleDownloadExcel}>
              <AiOutlineFileExcel /> Download Excel
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800" onClick={handleDownloadJSON}>
              <AiOutlineFileText /> Download JSON
            </button>
            {dataType === 'operating_cost' && (
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => handlePreview(0)}>
                <FiEye /> Preview Data
              </button>
            )}
          </div>
          
          {dataType === 'salary' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.map((emp, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2 font-semibold">{emp.name || <span className="italic text-gray-400">(No Name)</span>}</td>
                      <td className="p-2">{emp.role}</td>
                      <td className="p-2">
                        <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1" onClick={() => handlePreview(idx)}>
                          <FiEye /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-lg font-semibold text-green-600">
                Generated {generated[0].data.length} months of operating cost data
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Years: {years} | Total Records: {generated[0].data.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview Modals */}
      {showPreview && previewEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl" onClick={() => setShowPreview(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <FaRegCalendarAlt className="text-blue-500" /> {previewEmployee.name || '(No Name)'} - {previewEmployee.role}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2">Year</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Base</th>
                    <th className="p-2">Bonus</th>
                    <th className="p-2">Overtime</th>
                    <th className="p-2">Advance</th>
                    <th className="p-2">Due</th>
                    <th className="p-2">Underpaid</th>
                    <th className="p-2">Carryover</th>
                    <th className="p-2">Net Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {previewEmployee.salary_sheet.map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{row.year}</td>
                      <td className="p-2">{row.month}</td>
                      <td className="p-2">{row.base_salary}</td>
                      <td className="p-2">{row.festival_bonus}</td>
                      <td className="p-2">{row.overtime}</td>
                      <td className="p-2">{row.advance_salary}</td>
                      <td className="p-2">{row.due_salary}</td>
                      <td className="p-2">{row.underpaid_salary}</td>
                      <td className="p-2">{row.carryover}</td>
                      <td className="p-2 font-bold">{row.net_paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewOperatingCost && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl" onClick={() => setShowPreview(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <FiTrendingUp className="text-green-500" /> Operating Cost Data Preview
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2">Year</th>
                    <th className="p-2">Month</th>
                    <th className="p-2">Sales (BDT)</th>
                    <th className="p-2">Purchase Cost (BDT)</th>
                    <th className="p-2">Shop Expenses (BDT)</th>
                    <th className="p-2">Profit (BDT)</th>
                    <th className="p-2">Operating Cost (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewOperatingCost.map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{row.year}</td>
                      <td className="p-2">{row.month}</td>
                      <td className="p-2 font-semibold">{row.sales.toLocaleString()}</td>
                      <td className="p-2">{row.purchase_cost.toLocaleString()}</td>
                      <td className="p-2">{row.shop_expenses.toLocaleString()}</td>
                      <td className="p-2 font-bold text-green-600">{row.profit.toLocaleString()}</td>
                      <td className="p-2 font-bold text-red-600">{row.operating_cost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Faker;