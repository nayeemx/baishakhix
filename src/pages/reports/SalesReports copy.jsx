// SalesReports.jsx
import React, { useEffect, useState, Fragment } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import dayjs from "dayjs";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Dialog, Transition } from "@headlessui/react";
import { FiSearch, FiMoreVertical, FiEye, FiEdit2, FiPrinter, FiDownload } from "react-icons/fi";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import debounce from "lodash.debounce";

const SalesReports = () => {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState({ brand: "", category: "", startDate: null, endDate: null });
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalType, setModalType] = useState("view");

  useEffect(() => {
    const fetchSales = async () => {
      const snapshot = await getDocs(collection(firestore, "sales"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(data);
      setFilteredSales(data);

      const allItems = data.flatMap(sale => sale.items || []);
      const uniqueBrands = [...new Set(allItems.map(i => i.brand).filter(Boolean))];
      const uniqueCategories = [...new Set(allItems.map(i => i.product_category || i.category).filter(Boolean))];
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    };
    fetchSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchTerm, filter]);

  const filterSales = debounce(() => {
    let result = [...sales];
    if (searchTerm) {
      result = result.filter(sale =>
        sale.items?.some(item =>
          [item.product, item.sku, item.barcode].some(val => val?.toLowerCase().includes(searchTerm.toLowerCase()))
        ) || sale.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filter.brand) result = result.filter(sale => sale.items?.some(item => item.brand === filter.brand));
    if (filter.category) {
      result = result.filter(sale =>
        sale.items?.some(item => (item.product_category || item.category) === filter.category)
      );
    }
    if (filter.startDate && filter.endDate) {
      result = result.filter(sale => {
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
          Date: dayjs(sale.createdAt?.toDate?.() || sale.createdAt).format("YYYY-MM-DD HH:mm"),
        };
      })
    );
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "sales_report.csv");
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-4">Sales Transactions</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center border rounded px-3 py-1 w-full md:w-1/3">
          <FiSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search by product, invoice, SKU..."
            className="w-full outline-none"
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select onChange={e => setFilter({ ...filter, brand: e.target.value })} className="border rounded px-3 py-1">
          <option value="">All Brands</option>
          {brands.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select onChange={e => setFilter({ ...filter, category: e.target.value })} className="border rounded px-3 py-1">
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <DatePicker
          selected={filter.startDate}
          onChange={date => setFilter({ ...filter, startDate: date })}
          placeholderText="Start Date"
          className="border px-2 py-1 rounded"
        />
        <DatePicker
          selected={filter.endDate}
          onChange={date => setFilter({ ...filter, endDate: date })}
          placeholderText="End Date"
          className="border px-2 py-1 rounded"
        />
        <button onClick={exportCSV} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 flex items-center gap-1">
          <FiDownload /> Export
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 flex items-center gap-1">
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
                const profit = calculateProfit(item.retail_price, item.unit_price);
                return (
                  <tr key={`${sale.id}-${i}`} className="border-t">
                    <td className="p-3 flex items-center gap-3">
                      <img src={item.image || "/no-image.png"} className="w-10 h-10 object-cover rounded" alt="thumb" />
                      <div>
                        <div className="font-medium">{item.product}</div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                        <div className="text-xs text-gray-500">{item.barcode}</div>
                      </div>
                    </td>
                    <td className="p-3 text-blue-600">{sale.invoiceNumber || <span className="text-gray-400 italic">No Invoice</span>}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">৳ {parseFloat(item.retail_price).toFixed(2)}</td>
                    <td className="p-3 text-right">৳ {parseFloat(sale.total).toFixed(2)}</td>
                    <td className="p-3 text-right text-green-600 font-medium">{profit.percent}% <br />৳ {profit.amount}</td>
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
                              setModalData(item);
                              setModalType("view");
                              setActiveMenu(null);
                            }}
                          >
                            <FiEye /> View
                          </button>
                          <button
                            className="block px-4 py-2 hover:bg-gray-100 w-full flex items-center gap-2"
                            onClick={() => {
                              setModalData(item);
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
        <Dialog as="div" className="relative z-50" onClose={() => setModalData(null)}>
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
                  <Dialog.Title className="text-lg font-medium leading-6 text-gray-900">
                    {modalType === "view" ? "View Product" : "Edit Product"}
                  </Dialog.Title>
                  <div className="mt-2">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(modalData, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200"
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