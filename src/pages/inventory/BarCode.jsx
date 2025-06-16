import React, { useEffect, useState, useMemo, useRef } from 'react';
import bwipjs from 'bwip-js';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import BarcodeHistory from '../../components/Inventory/BarcodeHistory';
import QrCode from '../../components/Inventory/QrCode';
import { MdHistory } from "react-icons/md";
import { RiQrCodeLine } from "react-icons/ri";
import { FaPrint } from "react-icons/fa";
import Loader from '../../components/Loader'; // <-- use Loader instead of AppLoader
import bLogo from '../../assets/icons/b.png';

const PAGE_SIZE = 80; // 80 barcode labels per page

const BarCode = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showBarcodeHistory, setShowBarcodeHistory] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [labelsPerPage, setLabelsPerPage] = useState(80); // Add this state

  // Ref for printable area
  const printAreaRef = useRef(null);

  // Fetch products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const snap = await getDocs(collection(firestore, 'products'));
      const allProducts = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.barcode);
      setProducts(allProducts);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // Search filter
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const s = search.trim().toLowerCase();
    return products.filter(
      p =>
        (p.barcode && String(p.barcode).toLowerCase().includes(s)) ||
        (p.sku && String(p.sku).toLowerCase().includes(s)) ||
        (p.product && String(p.product).toLowerCase().includes(s))
    );
  }, [products, search]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  // Barcode rendering function using bwip-js
  const renderBarcode = (canvas, barcodeText) => {
    if (!canvas || !barcodeText) return;
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: barcodeText,
        scale: 2.5,
        height: 18,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF'
      });
    } catch (err) {
      // ignore rendering errors
    }
  };

  // Print handler: let the browser handle page breaks
  const handlePrint = () => {
    // Add print-specific CSS
    const styleId = 'barcode-print-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          margin: 0 -14px !important;
          padding: 0 !important;
          background: #fff !important;
        }
        .barcode-print-grid {
          display: grid !important;
          grid-template-columns: repeat(5, 1fr) !important;
          grid-auto-rows: 1fr !important;
          gap: 8px !important;
          width: 100vw !important;
          max-width: 100vw !important;
          padding: 8px !important;
        }
        .barcode-print-label {
          border: 1px solid #000 !important;
          margin: 0 !important;
          padding: 4px 2px !important;
          box-shadow: none !important;
          page-break-inside: avoid !important;
          min-height: 120px !important;
          min-width: 120px !important;
          font-size: 10px !important;
          background: #fff !important;
        }
        .barcode-label-header {
          display: flex !important;
          justify-content: space-around !important;
          font-size: 12px !important;
          font-weight: bold !important;
          margin-bottom: 2px !important;
          width: 100% !important;
        }
        .barcode-retail-price {
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        .barcode-print-label span,
        .barcode-print-label div {
          font-size: 10px !important;
          line-height: 1.2 !important;
        }
        .barcode-print-label canvas {
          width: 120px !important;
          height: 70px !important;
          display: block !important;
          margin: 0 auto !important;
          image-rendering: crisp-edges !important;
          image-rendering: pixelated !important;
        }
        .no-print, .no-print * {
          display: none !important;
        }
      }
    `;
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="mt-20 mb-4">
          <Loader bLogoSrc={bLogo} />
        </div>
        <span className="text-gray-500 text-lg mt-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 print:hidden">Product Barcodes</h2>
      <div className="flex gap-2 mb-4 print:hidden">
        <input
          type="text"
          placeholder="Search by Barcode, SKU, or Product Name"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        />
        {/* Labels per page input */}
        <div className="flex items-center gap-2">
          <label htmlFor="labelsPerPage" className="whitespace-nowrap">Labels per page (screen):</label>
          <input
            id="labelsPerPage"
            type="number"
            min={1}
            max={paginatedProducts.length}
            value={labelsPerPage}
            onChange={e => {
              let val = Number(e.target.value);
              if (!val || val < 1) val = 1;
              if (val > paginatedProducts.length) val = paginatedProducts.length;
              setLabelsPerPage(val);
            }}
            className="border p-2 rounded w-20 text-center"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            {'<<'}
          </button>
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            {'<'}
          </button>
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            {'>'}
          </button>
          <button
            className="px-3 py-1 border rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            {'>>'}
          </button>
        </div>
        {/* Barcode History Button with icon */}
        <button
          type="button"
          className="px-4 py-2 bg-gray-700 text-white rounded flex items-center gap-2"
          onClick={() => setShowBarcodeHistory(true)}
        >
          <MdHistory className="text-lg" />
          Barcode History
        </button>
        {/* QR Code Button with icon */}
        <button
          type="button"
          className="px-4 py-2 bg-purple-700 text-white rounded flex items-center gap-2"
          onClick={() => setShowQrCode(true)}
        >
          <RiQrCodeLine className="text-lg" />
          QR Code
        </button>
        {/* Print Button */}
        <button
          type="button"
          className="px-4 py-2 bg-green-700 text-white rounded flex items-center gap-2"
          onClick={handlePrint}
        >
          <FaPrint className="text-lg" />
          Print
        </button>
      </div>
      {/* BarcodeHistory Modal */}
      {showBarcodeHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowBarcodeHistory(false)}
              title="Close"
            >
              &times;
            </button>
            <BarcodeHistory />
          </div>
        </div>
      )}
      {/* QrCode Modal */}
      {showQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowQrCode(false)}
              title="Close"
            >
              &times;
            </button>
            <QrCode />
          </div>
        </div>
      )}
      <div ref={printAreaRef} className="barcode-print-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {paginatedProducts.slice(0, labelsPerPage).map((product, index) => (
          <div
            key={`${product.id}-${index}`}
            className="barcode-print-label border rounded flex flex-col items-center p-2 bg-white shadow"
          >
            <div className="barcode-label-header mb-2 text-xs text-gray-700 flex justify-around w-full">
              <span>{product.product_type || ''}</span>
              <span>{product.size || ''}</span>
            </div>
            <canvas
              ref={canvas => {
                if (canvas && product.barcode) {
                  try {
                    bwipjs.toCanvas(canvas, {
                      bcid: 'code128',
                      text: String(product.barcode),
                      scale: 2.5,
                      height: 18,
                      includetext: true,
                      textxalign: 'center',
                      backgroundcolor: 'FFFFFF'
                    });
                  } catch (err) {
                    // ignore rendering errors
                  }
                }
              }}
              className="w-[140px] h-[100px] mx-auto"
            />
            <div className="text-xs text-gray-500 flex flex-col items-center">
              <span className="block text-xs text-center">
                {product.sku || ''}
              </span>
              <span className="block barcode-retail-price font-bold text-sm">
                BDT: {product.retail_price ?? ''}
              </span>
            </div>
          </div>
        ))}
      </div>
      {paginatedProducts.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No products found
        </div>
      )}
    </div>
  );
};

export default BarCode;