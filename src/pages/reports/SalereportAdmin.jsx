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
  FiBox,
  FiAlertTriangle,
} from "react-icons/fi";
import { TbCurrencyTaka } from "react-icons/tb";
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import weekOfYear from "dayjs/plugin/weekOfYear";
import Loader from '../../components/Loader';

dayjs.extend(weekOfYear);

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
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [lowStockFilter, setLowStockFilter] = useState("general");
  const [showLowStockMenu, setShowLowStockMenu] = useState(false);

  // Radar chart data calculation
  const radarData = React.useMemo(() => {
    if (!sales.length) return [];
    if (radarView === "day") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayTotals = Array(7).fill(0);
      sales.forEach((sale) => {
        const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
        const day = d.getDay();
        dayTotals[day] += parseFloat(sale.total || 0);
      });
      return days.map((name, i) => ({ name, Sales: dayTotals[i] }));
    } else if (radarView === "month") {
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
      const weekTotals = {};
      sales.forEach((sale) => {
        const d = dayjs(sale.createdAt?.toDate?.() || sale.createdAt);
        if (d.year() === radarYear) {
          const week = d.week();
          weekTotals[week] = (weekTotals[week] || 0) + parseFloat(sale.total || 0);
        }
      });
      const maxWeek = Math.max(0, ...Object.keys(weekTotals).map(Number));
      return Array.from({ length: maxWeek }, (_, i) => ({
        name: `W${i + 1}`,
        Sales: weekTotals[i + 1] || 0,
      }));
    } else if (radarView === "year") {
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
    const fetchSalesAndProducts = async () => {
      setLoading(true);
      const snapshot = await getDocs(collection(firestore, "sales"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSales(data);
      setFilteredSales(data);
      const prodSnap = await getDocs(collection(firestore, "products"));
      const prodArr = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prodArr);
      const allItems = data.flatMap((sale) => sale.items || []);
      const uniqueBrands = [...new Set(allItems.map((i) => i.brand).filter(Boolean))];
      const uniqueCategories = [
        ...new Set(allItems.map((i) => i.product_category || i.category).filter(Boolean))
      ];
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
      setLoading(false);
    };
    fetchSalesAndProducts();
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

    const cashierCounts = filteredSales.reduce((acc, sale) => {
      const name = sale.staffName || "Unknown";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const sortedCashiers = Object.entries(cashierCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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
          Purchase: item.unit_price,
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

  const availableYears = React.useMemo(() => {
    const years = new Set();
    sales.forEach((sale) => {
      const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
      years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [sales]);

  const totalProducts = products.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const lowStockThreshold = 1;
  const lowStockProducts = products.filter(p => {
    const qty = parseFloat(p.stock || p.quantity || 0);
    if (lowStockFilter === "cosmetic") {
      return qty <= lowStockThreshold && (p.category?.toLowerCase() === "cosmetic" || p.product_category?.toLowerCase() === "cosmetic");
    } else if (lowStockFilter === "general") {
      return qty <= lowStockThreshold && (p.category?.toLowerCase() !== "cosmetic" && p.product_category?.toLowerCase() !== "cosmetic");
    }
    return qty <= lowStockThreshold;
  });
  const lowStockItems = lowStockProducts.length;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const salesThisMonth = sales.filter(sale => {
    const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });
  const salesLastMonth = sales.filter(sale => {
    const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
    return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
  });

  const revenueThisMonth = salesThisMonth.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const revenueLastMonth = salesLastMonth.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

  const grossProfit = sales.reduce((sum, sale) => {
    let cost = 0;
    (sale.items || []).forEach(item => {
      cost += parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 1);
    });
    return sum + (parseFloat(sale.total || 0) - cost);
  }, 0);
  const grossProfitThisMonth = salesThisMonth.reduce((sum, sale) => {
    let cost = 0;
    (sale.items || []).forEach(item => {
      cost += parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 1);
    });
    return sum + (parseFloat(sale.total || 0) - cost);
  }, 0);
  const grossProfitLastMonth = salesLastMonth.reduce((sum, sale) => {
    let cost = 0;
    (sale.items || []).forEach(item => {
      cost += parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 1);
    });
    return sum + (parseFloat(sale.total || 0) - cost);
  }, 0);

  const netProfit = grossProfit;
  const netProfitThisMonth = grossProfitThisMonth;
  const netProfitLastMonth = grossProfitLastMonth;

  const profitPercent = totalRevenue ? (netProfit / totalRevenue) * 100 : 0;
  const profitPercentThisMonth = revenueThisMonth ? (netProfitThisMonth / revenueThisMonth) * 100 : 0;
  const profitPercentLastMonth = revenueLastMonth ? (netProfitLastMonth / revenueLastMonth) * 100 : 0;

  const growth = (curr, prev) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const revenueGrowth = growth(revenueThisMonth, revenueLastMonth);
  const grossProfitGrowth = growth(grossProfitThisMonth, grossProfitLastMonth);
  const netProfitGrowth = growth(netProfitThisMonth, netProfitLastMonth);
  const profitPercentGrowth = growth(profitPercentThisMonth, profitPercentLastMonth);

  const trendData = React.useMemo(() => {
    if (!sales.length) return [];
    if (radarView === "day") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayTotals = Array(7).fill(0);
      const dayProfits = Array(7).fill(0);
      sales.forEach((sale) => {
        const d = new Date(sale.createdAt?.toDate?.() || sale.createdAt);
        const day = d.getDay();
        dayTotals[day] += parseFloat(sale.total || 0);
        let profit = 0;
        (sale.items || []).forEach(item => {
          profit += parseFloat(item.retail_price || 0) - parseFloat(item.unit_price || 0);
          if (item.quantity) profit *= parseFloat(item.quantity);
        });
        dayProfits[day] += profit;
      });
      return days.map((name, i) => ({ name, Sales: dayTotals[i], Profit: dayProfits[i] }));
    }
    return [];
  }, [sales, radarView, radarYear, radarMonth]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="w-[100vw] xl:w-[82vw] p-4 sm:p-6">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4">Sales Transactions</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 print:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col items-center">
          <div className="bg-blue-100 p-2 sm:p-3 rounded-full mb-2"><FiBox className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="text-gray-500 font-semibold text-sm sm:text-base">Total Products</div>
          <div className="text-xl sm:text-2xl font-bold">{totalProducts}</div>
          <div className="text-green-600 text-xs sm:text-sm mt-2">↑ {growth(totalProducts, totalProducts)}% from last month</div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col items-center">
          <div className="bg-green-100 p-2 sm:p-3 rounded-full mb-2"><TbCurrencyTaka className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="text-gray-500 font-semibold text-sm sm:text-base">Total Revenue</div>
          <div className="text-xl sm:text-2xl font-extrabold">৳ {totalRevenue.toLocaleString()}</div>
          <div className={`text-xs sm:text-sm mt-2 ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(revenueGrowth).toFixed(1)}% from last month
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col items-center relative">
          <div className="bg-yellow-100 p-2 sm:p-3 rounded-full mb-2"><FiAlertTriangle className="text-yellow-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="text-gray-500 font-semibold text-sm sm:text-base">Low Stock Items</div>
          <div className="text-xl sm:text-2xl font-bold">{lowStockItems}</div>
          <button
            className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100"
            onClick={() => setShowLowStockMenu(v => !v)}
          >
            <FiMoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          {showLowStockMenu && (
            <div className="absolute top-8 sm:top-10 right-2 bg-white border rounded shadow z-10 min-w-[100px] sm:min-w-[120px]">
              <button
                className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${lowStockFilter === 'cosmetic' ? 'font-bold' : ''}`}
                onClick={() => { setLowStockFilter('cosmetic'); setShowLowStockMenu(false); }}
              >
                Cosmetic
              </button>
              <button
                className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${lowStockFilter === 'general' ? 'font-bold' : ''}`}
                onClick={() => { setLowStockFilter('general'); setShowLowStockMenu(false); }}
              >
                General
              </button>
            </div>
          )}
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col items-center">
          <div className="bg-green-100 p-2 sm:p-3 rounded-full mb-2"><TbCurrencyTaka className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="text-gray-500 font-semibold text-sm sm:text-base">Gross Profit</div>
          <div className="text-xl sm:text-2xl font-extrabold">৳ {grossProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          <div className={`text-xs sm:text-sm mt-2 ${grossProfitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {grossProfitGrowth >= 0 ? '↑' : '↓'} {Math.abs(grossProfitGrowth).toFixed(1)}% from last month
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col items-center">
          <div className="bg-green-100 p-2 sm:p-3 rounded-full mb-2"><TbCurrencyTaka className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="text-gray-500 font-semibold text-sm sm:text-base">Net Profit</div>
          <div className="text-xl sm:text-2xl font-extrabold">৳ {netProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          <div className={`text-xs sm:text-sm mt-2 ${netProfitGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {netProfitGrowth >= 0 ? '↑' : '↓'} {Math.abs(netProfitGrowth).toFixed(1)}% from last month
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="mb-4 sm:mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
            <h3 className="text-lg sm:text-xl font-semibold">Sales Trend</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 sm:mt-0">
              <select
                value={radarYear}
                onChange={(e) => setRadarYear(parseInt(e.target.value))}
                className="border px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
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
                className="border px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
              >
                <option value="day">By Day</option>
                <option value="month">By Month</option>
                <option value="week">By Week</option>
                <option value="year">By Year</option>
              </select>
            </div>
          </div>
          {radarView === "month" && (
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <select
                value={radarYear}
                onChange={(e) => setRadarYear(parseInt(e.target.value))}
                className="border px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={radarMonth}
                onChange={(e) => setRadarMonth(parseInt(e.target.value))}
                className="border px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
              >
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <ResponsiveContainer width="100%" height={250} className="min-h-[200px]">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `৳${parseFloat(value).toFixed(2)}`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `৳${parseFloat(value).toFixed(2)}`} labelStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Sales"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Sales"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="Profit"
                stroke="#10B981"
                strokeWidth={2}
                name="Profit"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg sm:text-xl font-semibold">Traffic Sources</h3>
            <div className="relative">
              <button
                className="p-1 sm:p-2 rounded-full hover:bg-gray-100"
                onClick={() => setRadarMenuOpen((v) => !v)}
              >
                <FiMoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {radarMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 sm:w-40 bg-white border rounded shadow z-10">
                  <button
                    className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${radarView === "day" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("day"); setRadarMenuOpen(false); }}
                  >
                    By Day
                  </button>
                  <button
                    className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${radarView === "month" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("month"); setRadarMenuOpen(false); }}
                  >
                    By Month
                  </button>
                  <button
                    className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${radarView === "week" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("week"); setRadarMenuOpen(false); }}
                  >
                    By Week
                  </button>
                  <button
                    className={`block w-full text-left px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 text-xs sm:text-sm ${radarView === "year" ? "font-bold" : ""}`}
                    onClick={() => { setRadarView("year"); setRadarMenuOpen(false); }}
                  >
                    By Year
                  </button>
                </div>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250} className="min-h-[200px]">
            <RadarChart data={radarData} outerRadius={80}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, Math.max(...radarData.map(d => d.Sales || 0), 1)]} tick={{ fontSize: 12 }} />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex items-center gap-3 sm:gap-4 mb-3">
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <FiUser className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-700">Top 5 Cashiers</h3>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm">
            {topStats.cashiers.length > 0 ? (
              topStats.cashiers.map((cashier, index) => (
                <li key={index} className="flex justify-between">
                  <span>{cashier.name}</span>
                  <span className="font-semibold">{cashier.count} sales</span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">No sales data</li>
            )}
          </ol>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex items-center gap-3 sm:gap-4 mb-3">
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <FiShoppingBag className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-700">Top 5 Products</h3>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm">
            {topStats.products.length > 0 ? (
              topStats.products.map((product, index) => (
                <li key={index} className="flex justify-between">
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
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 print-hide">
        <div className="flex items-center border rounded px-3 py-1 w-full sm:w-64">
          <FiSearch className="text-gray-400 mr-2 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Search by product, invoice, SKU..."
            className="w-full outline-none text-xs sm:text-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          onChange={(e) => setFilter({ ...filter, brand: e.target.value })}
          className="border rounded px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm w-full sm:w-auto"
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
          className="border rounded px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm w-full sm:w-auto"
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
          className="border px-2 py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
        />
        <DatePicker
          selected={filter.endDate}
          onChange={(date) => setFilter({ ...filter, endDate: date })}
          placeholderText="End Date"
          className="border px-2 py-1 rounded text-xs sm:text-sm w-full sm:w-auto"
        />
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-3 py-1 sm:px-4 sm:py-1 rounded hover:bg-green-700 flex items-center gap-1 text-xs sm:text-sm"
        >
          <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" /> Export
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-3 py-1 sm:px-4 sm:py-1 rounded hover:bg-blue-700 flex items-center gap-1 text-xs sm:text-sm"
        >
          <FiPrinter className="w-4 h-4 sm:w-5 sm:h-5" /> Print
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 sm:p-3 text-left product-cell">Product</th>
              <th className="p-2 sm:p-3 text-left">Invoice</th>
              <th className="p-2 sm:p-3 text-left">Purchase</th>
              <th className="p-2 sm:p-3 text-center">Qty</th>
              <th className="p-2 sm:p-3 text-right">Price</th>
              <th className="p-2 sm:p-3 text-right">Final</th>
              <th className="p-2 sm:p-3 text-right">Profit</th>
              <th className="p-2 sm:p-3 text-left hidden sm:table-cell">Cashier</th>
              <th className="p-2 sm:p-3 actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale, saleIndex) =>
              sale.items.map((item, i) => {
                const profit = calculateProfit(item.retail_price, item.unit_price);
                return (
                  <tr key={`${sale.id}-${i}`} className="border-t">
                    <td className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
                      <img
                        src={item.image || placeholderImage}
                        onError={(e) => {
                          e.currentTarget.src = placeholderImage;
                        }}
                        className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded"
                        alt={item.product || "Product thumbnail"}
                      />
                      <div>
                        <div className="font-medium text-xs sm:text-sm">{item.product}</div>
                        <div className="text-xs text-gray-500 hidden sm:block">{item.sku}</div>
                        <div className="text-xs text-gray-500 hidden sm:block">{item.barcode}</div>
                      </div>
                    </td>
                    <td className="p-2 sm:p-3 text-blue-600 text-xs sm:text-sm">
                      {sale.invoiceNumber || (
                        <span className="text-gray-400 italic">No Invoice</span>
                      )}
                    </td>
                    <td className="p-2 sm:p-3 text-left text-xs sm:text-sm">
                      ৳ {parseFloat(item.unit_price).toFixed(2)}
                    </td>
                    <td className="p-2 sm:p-3 text-center text-xs sm:text-sm">{item.quantity}</td>
                    <td className="p-2 sm:p-3 text-right text-xs sm:text-sm">
                      ৳ {parseFloat(item.retail_price).toFixed(2)}
                    </td>
                    <td className="p-2 sm:p-3 text-right text-xs sm:text-sm">
                      ৳ {parseFloat(sale.total).toFixed(2)}
                    </td>
                    <td className="p-2 sm:p-3 text-right text-green-600 font-medium text-xs sm:text-sm">
                      {profit.percent}% <br />৳ {profit.amount}
                    </td>
                    <td className="p-2 sm:p-3 text-xs sm:text-sm hidden sm:table-cell">{sale.staffName || "-"}</td>
                    <td className="p-2 sm:p-3 text-center relative actions">
                      <button onClick={() => setActiveMenu(`${sale.id}-${i}`)}>
                        <FiMoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      {activeMenu === `${sale.id}-${i}` && (
                        <div className="absolute right-0 z-10 mt-2 bg-white border rounded shadow-md w-24 sm:w-32">
                          <button
                            className="block px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 w-full flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                            onClick={() => {
                              setModalData({ ...sale, ...item });
                              setModalType("view");
                              setActiveMenu(null);
                            }}
                          >
                            <FiEye className="w-4 h-4" /> <span className="hidden sm:inline">View</span>
                          </button>
                          <button
                            className="block px-3 py-1 sm:px-4 sm:py-2 hover:bg-gray-100 w-full flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                            onClick={() => {
                              setModalData({ ...sale, ...item });
                              setModalType("edit");
                              setActiveMenu(null);
                            }}
                          >
                            <FiEdit2 className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
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
                <Dialog.Panel className="w-full max-w-sm sm:max-w-md transform overflow-hidden rounded-2xl bg-white p-4 sm:p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title className="text-base sm:text-lg font-bold leading-6 text-gray-800 flex items-center gap-2">
                    <FiEye className="text-blue-600 w-5 h-5" />
                    Product Details
                  </Dialog.Title>

                  <div className="mt-4 space-y-3 text-xs sm:text-sm text-gray-700">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
                      <img
                        src={modalData?.image || placeholderImage}
                        onError={(e) => {
                          e.currentTarget.src = placeholderImage;
                        }}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded border"
                        alt={modalData?.product || "Product image"}
                      />
                      <div>
                        <div className="text-base sm:text-lg font-semibold">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-4">
                      <div>
                        <span className="font-medium">Brand:</span>{" "}
                        {modalData?.brand || "-"}
                      </div>
                      <div>
                        <span className="font-medium">Category:</span>{" "}
                        {modalData?.product_category || modalData?.category || "-"}
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
                        {(modalData?.discountType === "percent" ? modalData.discountValue : 0) || 0}%
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                          ? dayjs(modalData.createdAt.toDate?.() || modalData.createdAt).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 text-right">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700"
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

      {/* Print-specific CSS */}
      <style>
        {`
          @media print {
            .print-hide {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            table {
              width: 100% !important;
              font-size: 10px !important;
            }
            th, td {
              border: 1px solid #000 !important;
              padding: 4px !important;
            }
          }
          @media screen {
            .print-only {
              display: none !important;
            }
          }
          @media (max-width: 640px) {
            table {
              display: block;
              overflow-x: auto;
              white-space: nowrap;
            }
            th, td {
              min-width: 80px;
            }
            .actions {
              min-width: 100px;
            }
            .product-cell {
              min-width: 200px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default SalesReports;