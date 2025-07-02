// SalesReports.jsx
import React, { useEffect, useState, Fragment } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import dayjs from "dayjs";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiSearch,
  FiMoreVertical,
  FiEye,
  FiEdit2,
  FiPrinter,
  FiDownload,
  FiUser,
  FiShoppingBag,
  FiArrowUpRight,
  FiArrowDownRight,
  FiInfo,
} from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import debounce from "lodash.debounce";
import placeholderImage from "../../assets/logo.png";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(weekOfYear);

// Helper for tooltips
const TooltipComponent = ({ text, children }) => (
  <span className="relative group cursor-pointer">
    {children}
    <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
      {text}
    </span>
  </span>
);

// Helper for badge
const GrowthBadge = ({ value }) => {
  const isGrowth = value >= 0;
  return (
    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${isGrowth ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {isGrowth ? <FiArrowUpRight /> : <FiArrowDownRight />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const SalesReports = () => {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState({
    brand: "",
    category: "",
    startDate: null,
    endDate: null,
  });
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState("view");
  const [topStats, setTopStats] = useState({
    cashiers: [],
    products: [],
  });
  const [radarView, setRadarView] = useState("day");
  const [radarYear, setRadarYear] = useState(new Date().getFullYear());
  const [radarMonth, setRadarMonth] = useState(new Date().getMonth());
  const [radarMenuOpen, setRadarMenuOpen] = useState(false);
  const [operatingCost, setOperatingCost] = useState(5000); // Placeholder, replace with real data if available

  // Radar chart data calculation
  const radarData = React.useMemo(() => {
    if (!sales.length) return [];
    if (radarView === "day") {
      // Sales by day of week
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayTotals = Array(7).fill(0);
      sales.forEach((sale) => {
        const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
        const day = d.getDay();
        dayTotals[day] += parseFloat(sale.total || 0);
      });
      return days.map((name, i) => ({ name, Sales: dayTotals[i] }));
    } else if (radarView === "month") {
      // Sales for each day in the selected month and year
      const daysInMonth = dayjs(`${radarYear}-${radarMonth + 1}-01`).daysInMonth();
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      return days.map((day) => {
        const total = sales.reduce((sum, sale) => {
          const d = dayjs(sale.createdAt?.toDate?.() || sale.createdAt);
          return d.year() === radarYear && d.month() === radarMonth && d.date() === day
            ? sum + parseFloat(sale.total || 0)
            : sum;
        }, 0);
        return { name: day.toString(), Sales: total };
      });
    } else if (radarView === "week") {
      // Sales by week number for selected year
      const weekTotals = {};
      sales.forEach((sale) => {
        const d = dayjs(sale.createdAt?.toDate?.() || sale.createdAt);
        if (d.year() === radarYear) {
          const week = d.week();
          weekTotals[week] = (weekTotals[week] || 0) + parseFloat(sale.total || 0);
        }
      });
      // Find max week number in selected year
      const maxWeek = Math.max(0, ...Object.keys(weekTotals).map(Number));
      return Array.from({ length: maxWeek }, (_, i) => ({
        name: `W${i + 1}`,
        Sales: weekTotals[i + 1] || 0,
      }));
    } else if (radarView === "year") {
      // Sales by year (show only selected year)
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthTotals = Array(12).fill(0);
      sales.forEach((sale) => {
        const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
        if (d.getFullYear() === radarYear) {
          const m = d.getMonth();
          monthTotals[m] += parseFloat(sale.total || 0);
        }
      });
      return months.map((name, i) => ({ name, Sales: monthTotals[i] }));
    }
    return [];
  }, [sales, radarView, radarYear, radarMonth]);

  useEffect(() => {
    const fetchSales = async () => {
      const snapshot = await getDocs(collection(firestore, "sales"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSales(data);
      setFilteredSales(data);

      const allItems = data.flatMap((sale) => sale.items || []);
      const uniqueBrands = [
        ...new Set(allItems.map((i) => i.brand).filter(Boolean)),
      ];
      const uniqueCategories = [
        ...new Set(
          allItems.map((i) => i.product_category || i.category).filter(Boolean)
        ),
      ];
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    };
    fetchSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchTerm, filter]);

  useEffect(() => {
    if (filteredSales.length === 0) {
      setTopStats({
        cashiers: [],
        products: [],
      });
      return;
    }

    // Calculate Top 5 Cashiers by number of sales
    const cashierCounts = filteredSales.reduce((acc, sale) => {
      const name = sale.staffName || "Unknown";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const sortedCashiers = Object.entries(cashierCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate Top 5 Products by quantity sold
    const productCounts = filteredSales.reduce((acc, sale) => {
      (sale.items || []).forEach((item) => {
        const name = item.product || "Unknown Product";
        acc[name] = (acc[name] || 0) + (item.quantity || 1);
      });
      return acc;
    }, {});

    const sortedProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopStats({ cashiers: sortedCashiers, products: sortedProducts });
  }, [filteredSales]);

  const filterSales = debounce(() => {
    let result = [...sales];
    if (searchTerm) {
      result = result.filter(
        (sale) =>
          sale.items?.some((item) =>
            [item.product, item.sku, item.barcode].some((val) =>
              val?.toLowerCase().includes(searchTerm.toLowerCase())
            )
          ) ||
          sale.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filter.brand)
      result = result.filter((sale) =>
        sale.items?.some((item) => item.brand === filter.brand)
      );
    if (filter.category) {
      result = result.filter((sale) =>
        sale.items?.some(
          (item) => (item.product_category || item.category) === filter.category
        )
      );
    }
    if (filter.startDate && filter.endDate) {
      result = result.filter((sale) => {
        const date = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
        return date >= filter.startDate && date <= filter.endDate;
      });
    }
    setFilteredSales(result);
  }, 300);

  const calculateProfit = (retail, cost) => {
    const r = parseFloat(retail);
    const c = parseFloat(cost);
    const profit = r - c;
    const percent = ((profit / c) * 100).toFixed(2);
    return {
      amount: profit.toFixed(2),
      percent: isFinite(percent) ? percent : "0.00",
    };
  };

  const exportCSV = () => {
    const rows = filteredSales.flatMap((sale, saleIndex) =>
      sale.items.map((item, i) => {
        const profit = calculateProfit(item.retail_price, item.unit_price);
        return {
          SN: saleIndex + i + 1,
          Product: item.product,
          SKU: item.sku,
          Barcode: item.barcode,
          Invoice: sale.invoiceNumber || "-",
          Quantity: item.quantity,
          Price: item.retail_price,
          FinalAmount: sale.total,
          ProfitPercent: profit.percent,
          ProfitAmount: profit.amount,
          Cashier: sale.staffName,
          Date: dayjs(sale.createdAt?.toDate?.() || sale.createdAt).format(
            "YYYY-MM-DD HH:mm"
          ),
        };
      })
    );
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "sales_report.csv");
  };

  // Get available years from sales data
  const availableYears = React.useMemo(() => {
    const years = new Set();
    sales.forEach((sale) => {
      const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
      years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [sales]);

  // Calculate metrics for current and previous period (month)
  const currentMonth = radarMonth;
  const currentYear = radarYear;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const getSalesForMonth = (year, month) => {
    return sales.filter(sale => {
      const d = dayjs(sale.createdAt?.toDate?.() || sale.createdAt);
      return d.year() === year && d.month() === month;
    });
  };
  const getRevenue = (salesArr) => salesArr.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const getGrossProfit = (salesArr) => salesArr.reduce((sum, sale) => {
    let profit = 0;
    (sale.items || []).forEach(item => {
      const retail = parseFloat(item.retail_price || 0);
      const cost = parseFloat(item.unit_price || 0);
      const qty = parseFloat(item.quantity || 1);
      profit += (retail - cost) * qty;
    });
    return sum + profit;
  }, 0);

  const salesThisMonth = getSalesForMonth(currentYear, currentMonth);
  const salesPrevMonth = getSalesForMonth(prevYear, prevMonth);
  const revenue = getRevenue(salesThisMonth);
  const revenuePrev = getRevenue(salesPrevMonth);
  const grossProfit = getGrossProfit(salesThisMonth);
  const grossProfitPrev = getGrossProfit(salesPrevMonth);
  const netProfit = grossProfit - operatingCost;
  const netProfitPrev = grossProfitPrev - operatingCost;
  const profitPercent = revenue ? (netProfit / revenue) * 100 : 0;
  const profitPercentPrev = revenuePrev ? (netProfitPrev / revenuePrev) * 100 : 0;

  const growth = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / Math.abs(prev)) * 100;

  const summaryCards = [
    {
      label: "Revenue",
      value: revenue,
      growth: growth(revenue, revenuePrev),
      tooltip: "Total sales (selling price × qty).",
      formula: "Revenue = Total sales (selling price × qty)"
    },
    {
      label: "Gross Profit",
      value: grossProfit,
      growth: growth(grossProfit, grossProfitPrev),
      tooltip: "Revenue - Cost of Goods Sold.",
      formula: "Gross Profit = Revenue - Cost of Goods Sold"
    },
    {
      label: "Operating Cost",
      value: operatingCost,
      growth: 0,
      tooltip: "Rent + Salary + Utilities + etc. (placeholder)",
      formula: "Operating Cost = Rent + Salary + Utilities + etc."
    },
    {
      label: "Net Profit",
      value: netProfit,
      growth: growth(netProfit, netProfitPrev),
      tooltip: "Gross Profit - Operating Cost.",
      formula: "Net Profit = Gross Profit - Operating Cost"
    },
    {
      label: "Profit %",
      value: profitPercent,
      growth: growth(profitPercent, profitPercentPrev),
      tooltip: "(Net Profit / Revenue) × 100.",
      formula: "Profit % = (Net Profit / Revenue) × 100"
    },
  ];

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-4">Sales Transactions</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {summaryCards.map((card, i) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-4 flex flex-col gap-2 relative">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">{card.label}</span>
              <TooltipComponent text={<span><b>Formula:</b> {card.formula}<br/>{card.tooltip}</span>}>
                <FiInfo className="text-gray-400 hover:text-blue-600" />
              </TooltipComponent>
            </div>
            <div className="text-2xl font-bold">
              {card.label === "Profit %" ? `${card.value.toFixed(2)}%` : `৳${card.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </div>
            <GrowthBadge value={card.growth} />
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Sales Trend</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={radarYear}
                onChange={(e) => setRadarYear(parseInt(e.target.value))}
                className="border px-3 py-1 rounded text-sm"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <select
                value={radarView}
                onChange={(e) => setRadarView(e.target.value)}
                className="border px-3 py-1 rounded text-sm"
              >
                <option value="day">By Day</option>
                <option value="month">By Month</option>
                <option value="week">By Week</option>
                <option value="year">By Year</option>
              </select>
            </div>
          </div>
          {radarView === "month" && (
            <div className="flex gap-2 mb-2">
              <select
                value={radarYear}
                onChange={(e) => setRadarYear(parseInt(e.target.value))}
                className="border px-3 py-1 rounded text-sm w-fit"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={radarMonth}
                onChange={(e) => setRadarMonth(parseInt(e.target.value))}
                className="border px-3 py-1 rounded text-sm w-fit"
              >
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            {radarView === "day" ? (
              <LineChart data={radarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `৳${v}`} />
                <Tooltip formatter={(value) => `৳${parseFloat(value).toFixed(2)}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Sales"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  name="Sales"
                  dot={{ r: 4 }}
                />
              </LineChart>
            ) : radarView === "month" ? (
              <AreaChart data={radarData}>
                <defs>
                  <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `৳${v}`} />
                <Tooltip formatter={(value) => `৳${parseFloat(value).toFixed(2)}`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Sales"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#salesColor)"
                  name="Sales"
                />
              </AreaChart>
            ) : radarView === "week" ? (
              <AreaChart data={radarData}>
                <defs>
                  <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `৳${v}`} />
                <Tooltip formatter={(value) => `৳${parseFloat(value).toFixed(2)}`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Sales"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#salesColor)"
                  name="Sales"
                />
              </AreaChart>
            ) : (
              <AreaChart data={radarData}>
                <defs>
                  <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `৳${v}`} />
                <Tooltip formatter={(value) => `৳${parseFloat(value).toFixed(2)}`} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Sales"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#salesColor)"
                  name="Sales"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
        {/* Radar Chart for Traffic Sources */}
        <div className="bg-white p-4 rounded-lg shadow flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Traffic Sources</h3>
            <div className="relative">
              <button
                className="p-2 rounded-full hover:bg-gray-100"
                onClick={() => setRadarMenuOpen((v) => !v)}
              >
                <FiMoreVertical />
              </button>
              {radarMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow z-10">
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${radarView === "day" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("day"); setRadarMenuOpen(false); }}
                  >
                    By Day
                  </button>
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${radarView === "month" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("month"); setRadarMenuOpen(false); }}
                  >
                    By Month
                  </button>
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${radarView === "week" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("week"); setRadarMenuOpen(false); }}
                  >
                    By Week
                  </button>
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${radarView === "year" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("year"); setRadarMenuOpen(false); }}
                  >
                    By Year
                  </button>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} outerRadius={100}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis angle={30} domain={[0, Math.max(...radarData.map(d => d.Sales || 0), 1)]} />
              <Radar
                name="Sales"
                dataKey="Sales"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-blue-100 p-3 rounded-full">
              <FiUser className="text-blue-600 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Top 5 Cashiers</h3>
          </div>
          <ol className="list-decimal list-inside space-y-2">
            {topStats.cashiers.length > 0 ? (
              topStats.cashiers.map((cashier, index) => (
                <li key={index} className="text-sm flex justify-between">
                  <span>{cashier.name}</span>
                  <span className="font-semibold">{cashier.count} sales</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No sales data</li>
            )}
          </ol>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-green-100 p-3 rounded-full">
              <FiShoppingBag className="text-green-600 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Top 5 Products</h3>
          </div>
          <ol className="list-decimal list-inside space-y-2">
            {topStats.products.length > 0 ? (
              topStats.products.map((product, index) => (
                <li key={index} className="text-sm flex justify-between">
                  <span>{product.name}</span>
                  <span className="font-semibold">{product.count} units</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No sales data</li>
            )}
          </ol>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center border rounded px-3 py-1 w-full md:w-1/3">
          <FiSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search by product, invoice, SKU..."
            className="w-full outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          onChange={(e) => setFilter({ ...filter, brand: e.target.value })}
          className="border rounded px-3 py-1"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="border rounded px-3 py-1"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <DatePicker
          selected={filter.startDate}
          onChange={(date) => setFilter({ ...filter, startDate: date })}
          placeholderText="Start Date"
          className="border px-2 py-1 rounded"
        />
        <DatePicker
          selected={filter.endDate}
          onChange={(date) => setFilter({ ...filter, endDate: date })}
          placeholderText="End Date"
          className="border px-2 py-1 rounded"
        />
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 flex items-center gap-1"
        >
          <FiDownload /> Export
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 flex items-center gap-1"
        >
          <FiPrinter /> Print
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Invoice</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Final</th>
              <th className="p-3 text-right">Profit</th>
              <th className="p-3 text-left">Cashier</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale, saleIndex) =>
              sale.items.map((item, i) => {
                const profit = calculateProfit(
                  item.retail_price,
                  item.unit_price
                );
                return (
                  <tr key={`${sale.id}-${i}`} className="border-t">
                    <td className="p-3 flex items-center gap-3">
                      <img
                        src={item.image || placeholderImage}
                        onError={(e) => {
                          e.currentTarget.src = placeholderImage;
                        }}
                        className="w-10 h-10 object-contain rounded"
                        alt={item.product || "Product thumbnail"}
                      />
                      <div>
                        <div className="font-medium">{item.product}</div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                        <div className="text-xs text-gray-500">
                          {item.barcode}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-blue-600">
                      {sale.invoiceNumber || (
                        <span className="text-gray-400 italic">No Invoice</span>
                      )}
                    </td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">
                      ৳ {parseFloat(item.retail_price).toFixed(2)}
                    </td>
                    <td className="p-3 text-right">
                      ৳ {parseFloat(sale.total).toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-green-600 font-medium">
                      {profit.percent}% <br />৳ {profit.amount}
                    </td>
                    <td className="p-3">{sale.staffName || "-"}</td>
                    <td className="p-3 text-center relative">
                      <button onClick={() => setActiveMenu(`${sale.id}-${i}`)}>
                        <FiMoreVertical />
                      </button>
                      {activeMenu === `${sale.id}-${i}` && (
                        <div className="absolute right-0 z-10 mt-2 bg-white border rounded shadow-md">
                          <button
                            className="block px-4 py-2 hover:bg-gray-100 w-full flex items-center gap-2"
                            onClick={() => {
                              setModalData({ ...sale, ...item });
                              setModalType("view");
                              setActiveMenu(null);
                            }}
                          >
                            <FiEye /> View
                          </button>
                          <button
                            className="block px-4 py-2 hover:bg-gray-100 w-full flex items-center gap-2"
                            onClick={() => {
                              setModalData({ ...sale, ...item });
                              setModalType("edit");
                              setActiveMenu(null);
                            }}
                          >
                            <FiEdit2 /> Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Transition appear show={!!modalData} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setModalData(null)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-bold leading-6 text-gray-800 flex items-center gap-2">
                    <FiEye className="text-blue-600" />
                    Product Details
                  </Dialog.Title>

                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <div className="flex gap-4 items-center">
                      <img
                        src={modalData?.image || placeholderImage}
                        onError={(e) => {
                          e.currentTarget.src = placeholderImage;
                        }}
                        className="w-20 h-20 object-contain rounded border"
                        alt={modalData?.product || "Product image"}
                      />
                      <div>
                        <div className="text-lg font-semibold">
                          {modalData?.product}
                        </div>
                        <div className="text-xs text-gray-500">
                          SKU: {modalData?.sku}
                        </div>
                        <div className="text-xs text-gray-500">
                          Barcode: {modalData?.barcode}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <span className="font-medium">Brand:</span>{" "}
                        {modalData?.brand || "-"}
                      </div>
                      <div>
                        <span className="font-medium">Category:</span>{" "}
                        {modalData?.product_category ||
                          modalData?.category ||
                          "-"}
                      </div>
                      <div>
                        <span className="font-medium">Quantity:</span>{" "}
                        {modalData?.quantity}
                      </div>
                      <div>
                        <span className="font-medium">Retail Price:</span> ৳{" "}
                        {parseFloat(modalData?.retail_price || 0).toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Stock Price:</span> ৳{" "}
                        {parseFloat(modalData?.unit_price || 0).toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">VAT:</span>{" "}
                        {modalData?.vatAmount || 0}
                      </div>
                      <div>
                        <span className="font-medium">Discount:</span>{" "}
                        {(modalData?.discountType === "percent"
                          ? modalData.discountValue
                          : 0) || 0}
                        %
                      </div>
                      <div>
                        <span className="font-medium">Discount Amt:</span> ৳{" "}
                        {parseFloat(modalData?.discountAmt || 0).toFixed(2)}
                      </div>

                      <div>
                        <span className="font-medium">Shipping Cost:</span> ৳{" "}
                        {parseFloat(modalData?.shipping || 0).toFixed(2)}
                      </div>
                    </div>

                    <hr className="my-3" />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium">Invoice:</span>{" "}
                        {modalData?.invoiceNumber || "-"}
                      </div>
                      <div>
                        <span className="font-medium">Cashier:</span>{" "}
                        {modalData?.staffName || "-"}
                      </div>
                      <div>
                        <span className="font-medium">Sale Date:</span>{" "}
                        {modalData?.createdAt
                          ? dayjs(
                              modalData.createdAt.toDate?.() ||
                                modalData.createdAt
                            ).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 text-right">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      onClick={() => setModalData(null)}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default SalesReports;