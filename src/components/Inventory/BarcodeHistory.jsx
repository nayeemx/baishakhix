import React, { useState, useMemo, useEffect } from "react";
import bwipjs from "bwip-js";
import debounce from "lodash.debounce";
import { FaSearch, FaSyncAlt, FaPrint } from "react-icons/fa";
import Loader from "../../components/Loader";
import bLogo from "../../assets/icons/b.png";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";

const PAGE_SIZE = 40;

const BarcodeHistory = () => {
  const [printLayout, setPrintLayout] = useState("normal"); // 'normal' or 'dense'
  const [labelsPerPage, setLabelsPerPage] = useState(40);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [filterBill, setFilterBill] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState({});

  // Fetch products and suppliers from Firestore
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [productsSnap, suppliersSnap] = await Promise.all([
          getDocs(collection(firestore, "products")),
          getDocs(collection(firestore, "supplier_list")),
        ]);
        const allProducts = productsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          supplier_id: doc.data().supplier_id
            ? String(doc.data().supplier_id)
            : "",
        }));
        setProducts(allProducts);
        setTotalRecords(allProducts.length);

        const suppliersMap = {};
        suppliersSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data && data.supplier_name) {
            suppliersMap[String(doc.id)] = {
              ...data,
              id: String(doc.id),
            };
          }
        });
        setSuppliers(suppliersMap);
      } catch (err) {
        // handle error
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get unique bill numbers from products
  const billNumbers = useMemo(() => {
    return [
      ...new Set(products.map((p) => p.bill_number).filter(Boolean)),
    ].sort();
  }, [products]);

  // Show suppliers filtered by selected bill
  const availableSuppliers = useMemo(() => {
    let supplierIds;
    if (filterBill) {
      supplierIds = new Set(
        products
          .filter((p) => String(p.bill_number) === String(filterBill))
          .map((p) => String(p.supplier_id))
      );
    }
    return Object.entries(suppliers)
      .map(([id, s]) => ({
        id: String(id),
        name: s?.supplier_name,
      }))
      .filter((s) => s.name && (!filterBill || supplierIds.has(s.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, filterBill, products]);

  // Show bills filtered by selected supplier
  const availableBillNumbers = useMemo(() => {
    let filtered = products;
    if (filterSupplier) {
      filtered = filtered.filter(
        (p) => String(p.supplier_id) === String(filterSupplier)
      );
    }
    return [
      ...new Set(filtered.map((p) => p.bill_number).filter(Boolean)),
    ].sort();
  }, [filterSupplier, products]);

  // Debounced search
  const debouncedSetSearch = useMemo(
    () =>
      debounce((val) => {
        setDebouncedSearch(val);
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 100);
      }, 300),
    []
  );
  useEffect(() => {
    debouncedSetSearch(search);
    return () => debouncedSetSearch.cancel();
  }, [search, debouncedSetSearch]);

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timeout);
  }, [debouncedSearch, filterBill, filterSupplier, products]);

  // Filtering logic - show ALL products
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.barcode && String(p.barcode).toLowerCase().includes(s)) ||
          (p.old_barcode && String(p.old_barcode).toLowerCase().includes(s)) ||
          (p.sku && String(p.sku).toLowerCase().includes(s))
      );
    }
    if (filterBill.trim()) {
      filtered = filtered.filter(
        (p) => p.bill_number && String(p.bill_number) === String(filterBill)
      );
    }
    if (filterSupplier) {
      filtered = filtered.filter(
        (p) => String(p.supplier_id) === String(filterSupplier)
      );
    }
    return filtered;
  }, [products, debouncedSearch, filterBill, filterSupplier]);

  // Create expanded products array with proper indexing
  const expandedProducts = useMemo(() => {
    return filteredProducts.flatMap((product) => {
      const quantity = Math.max(1, parseInt(product.quantity) || 1);
      return Array.from({ length: quantity }, (_, index) => ({
        ...product,
        quantityIndex: index,
      }));
    });
  }, [filteredProducts]);

  // Update pagination to use expanded products
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return expandedProducts.slice(start, start + PAGE_SIZE);
  }, [expandedProducts, currentPage]);

  const totalPages = Math.ceil(expandedProducts.length / PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages]);

  // Barcode generator
  const generateBarcode = (canvas, barcodeText) => {
    try {
      if (canvas) {
        canvas.width = 320;
        canvas.height = 80;
        bwipjs.toCanvas(canvas, {
          bcid: "code128",
          text: barcodeText,
          scale: 3, // or 4
          height: 26, // or 40
          includetext: true,
          textxalign: "center",
          backgroundcolor: "FFFFFF",
          paddingwidth: 6,
          paddingheight: 2,
          textfont: "Arial", // optional
          textsize: 13, // optional, try 13 or 16
        });
      }
    } catch (err) {
      // ignore
    }
  };

  if (isLoading) {
    return <Loader bLogoSrc={bLogo} />;
  }

  // Only render up to labelsPerPage labels for both screen and print
  const visibleProducts = paginatedProducts.slice(0, labelsPerPage);

  // Print handler: open a new window, inject bwip-js CDN, and render barcodes after script loads
  const handlePrint = () => {
    const layoutColumns = { normal: 5, dense: 6, dense1: 7 };
    const cols = layoutColumns[printLayout] || 5;

    const style = `
    @page {
      size: A4;
      margin: 0mm;
    }
    body {
      margin: 0 -11px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 8px;
      padding: 8px;
      width: 100vw;
    }
    .item {
      border: 1px solid #ccc;
      padding: 4px 8px;
      text-align: center;
      break-inside: avoid;
      font-size: 10px;
    }
    .barcode-canvas {
      width: 100%;
      height: 86px;
      margin: 0 0;
    }
    .product-info {
      font-size: 10px;
      color: #333;
      margin: 0 0;
    }
    .product-info span {
      display: block;
    }
  `;

    const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${style}</style>
      </head>
      <body>
        <div class="grid">
          ${visibleProducts
            .map(
              (product) => `
            <div class="item">
              <div class="product-info">
                <span>${
                  product.product_type_name
                    ? product.product_type_name.slice(3)
                    : ""
                }</span>
                <span>${
                  product.size_name ? product.size_name.slice(3) : ""
                }</span>
              </div>
              <canvas class="barcode-canvas" width="320" height="80"></canvas>
              <div class="product-info">
                <div>${product.sku || ""}</div>
                <div>BDT: ${product.retail_price ?? ""}</div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
        <script src="https://unpkg.com/bwip-js/dist/bwip-js-min.js"></script>
        <script>
          window.onload = function() {
            const canvases = document.querySelectorAll('canvas');
            const products = ${JSON.stringify(visibleProducts)};
            canvases.forEach((canvas, i) => {
              const barcodeText = products[i].barcode || products[i].old_barcode;
              try {
                window.bwipjs.toCanvas(canvas, {
                  bcid: 'code128',
                  text: barcodeText,
                  scale: 2,
                  height: 12,
                  includetext: true,
                  textxalign: 'center',
                  backgroundcolor: 'FFFFFF'
                });
              } catch (e) {}
            });
            setTimeout(() => {
              window.print();
              setTimeout(window.close, 500);
            }, 200);
          }
        </script>
      </body>
    </html>
  `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print barcodes");
      return;
    }

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const getLabelsPerPageOptions = () => {
    const layoutColumns = { normal: 5, dense: 6, dense1: 7 };
    const cols = layoutColumns[printLayout] || 5;
    return Array.from({ length: 10 }, (_, i) => (i + 1) * cols);
  };

  return (
    <div className="h-[98vh] overflow-auto print:overflow-hidden p-4 bg-white rounded-lg">
      <div className="mb-4 flex flex-col md:flex-row gap-2 items-center print:hidden">
        <div className="relative w-full md:w-1/3">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Barcode or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded w-full pl-10"
          />
        </div>
        <select
          value={filterBill}
          onChange={(e) => setFilterBill(e.target.value)}
          className="border p-2 rounded w-full md:w-1/4"
        >
          <option key="default-bill" value="">
            Filter by Bill Number
          </option>
          {availableBillNumbers.map((bill) => (
            <option key={bill} value={bill}>
              {bill}
            </option>
          ))}
        </select>
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="border p-2 rounded w-full md:w-1/4"
        >
          <option key="default-supplier" value="">
            Filter by Supplier
          </option>
          {availableSuppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="flex items-center border px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          onClick={() => {
            setSearch("");
            setFilterBill("");
            setFilterSupplier("");
          }}
        >
          <FaSyncAlt className="mr-2" />
          Clear
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="labelsPerPage" className="whitespace-nowrap">
            Labels:
          </label>
          <select
            id="labelsPerPage"
            value={labelsPerPage}
            onChange={(e) => setLabelsPerPage(Number(e.target.value))}
            className="border p-2 rounded"
          >
            {getLabelsPerPageOptions().map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="printLayout" className="whitespace-nowrap">
            Layout:
          </label>
          <select
            id="printLayout"
            value={printLayout}
            onChange={(e) => setPrintLayout(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="normal">(5x5)</option>
            <option value="dense">(6x6)</option>
            <option value="dense1">(7x7)</option>
          </select>
        </div>
        <button
          className="flex items-center border px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
          onClick={handlePrint}
        >
          <FaPrint className="text-lg my-1" />
        </button>
      </div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div>
          Page{" "}
          <strong>
            {currentPage} of {totalPages}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            {"<<"}
          </button>
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            {"<"}
          </button>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              let val = Number(e.target.value);
              if (!val || val < 1) val = 1;
              if (val > totalPages) val = totalPages;
              setCurrentPage(val);
            }}
            className="w-16 py-1 text-center border rounded"
            aria-label="Go to page number"
          />
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            {">"}
          </button>
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            {">>"}
          </button>
        </div>
        <div>
          Showing {paginatedProducts.length} of {expandedProducts.length} labels
          ({filteredProducts.length} of {totalRecords} total products)
        </div>
      </div>
      <div className="w-full">
        <div className="barcode-history-print-grid grid grid-cols-8 print:grid-cols-5 gap-4">
          {visibleProducts.map((product) => (
            <div
              key={`${product.id}-${product.quantityIndex}`}
              className="barcode-history-label border rounded p-2"
            >
              <div className="barcode-label-header mb-2 text-xs text-gray-700 flex justify-around">
                <span>
                  {product.product_type_name
                    ? product.product_type_name.slice(3)
                    : ""}
                </span>
                <span>
                  {product.size_name ? product.size_name.slice(3) : ""}
                </span>
              </div>
              <canvas
                ref={(canvas) =>
                  canvas &&
                  generateBarcode(
                    canvas,
                    product.barcode || product.old_barcode
                  )
                }
                className="w-[8vw] h-[12vh] print:w-[10vh] print:h-[8vh] mx-auto"
              />
              <div className="text-xs text-gray-500 flex flex-col items-center">
                <span className="block text-xs text-center">
                  {product.sku || ""}
                </span>
                <span className="block barcode-retail-price">
                  BDT: {product.retail_price ?? ""}
                </span>
              </div>
            </div>
          ))}
        </div>
        {visibleProducts.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            No products found
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeHistory;