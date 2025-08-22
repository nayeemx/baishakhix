import React, { useEffect, useState, useMemo, useRef } from 'react';
import bwipjs from 'bwip-js';
import { collection, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import BarcodeHistory from '../../components/Inventory/BarcodeHistory';
import QrCode from '../../components/Inventory/QrCode';
import { MdHistory } from "react-icons/md";
import { RiQrCodeLine } from "react-icons/ri";
import { FaPrint } from "react-icons/fa";
import Loader from '../../components/Loader';
import bLogo from '../../assets/icons/b.png';
import { toast } from 'react-toastify';

const PAGE_SIZE = 80;
const LABELS_PER_PRINT_PAGE = 50;

const BarCode = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showBarcodeHistory, setShowBarcodeHistory] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [labelsPerPage, setLabelsPerPage] = useState(80);

  const printAreaRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'products'), (snap) => {
      const allProducts = snap.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data(),
      })).filter(p => p.barcode && p.is_labeled !== undefined && p.quantity !== undefined);
      setProducts(allProducts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.is_labeled === "f");
    if (!search.trim()) return result;
    const s = search.trim().toLowerCase();
    return result.filter(
      p =>
        (p.barcode && String(p.barcode).toLowerCase().includes(s)) ||
        (p.sku && String(p.sku).toLowerCase().includes(s)) ||
        (p.product && String(p.product).toLowerCase().includes(s))
    );
  }, [products, search]);

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

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
    } catch {
      // ignore rendering errors
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(firestore, 'products'));
      const productsToUpdate = snap.docs
        .map(doc => ({ firestoreId: doc.id, ...doc.data() }))
        .filter(p => p.is_labeled === "f");

      if (productsToUpdate.length === 0) {
        toast.info("No products to update.");
        setLoading(false);
        return;
      }

      await Promise.all(
        productsToUpdate.map(product => {
          const productRef = doc(firestore, 'products', product.firestoreId);
          return updateDoc(productRef, { is_labeled: "t" });
        })
      );

      toast.success(`${productsToUpdate.length} products updated successfully!`);
    } catch (error) {
      console.error("Error during clear operation:", error);
      toast.error("Failed to update products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const styleId = 'barcode-print-style';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = `
      @media print {
        @page { size: A4 portrait; margin: 0mm; }
        body { background: #fff !important; }
        .barcode-page {
          display: block !important;
          page-break-after: always !important;
        }
        .barcode-print-label {
          display: inline-block !important;
          vertical-align: top;
          width: 15% !important; /* ~5 per row */
          height: 133px !important;
          margin: 1mm !important;
          border: 1px solid #000 !important;
          padding: 3px !important;
          box-sizing: border-box;
          page-break-inside: avoid !important;
          background: #fff !important;
          font-size: 10px !important;
        }
        .barcode-label-header {
          font-size: 11px !important;
          font-weight: bold !important;
          text-align: center !important;
        }
        .barcode-sku {
          font-size: 10px !important;
          color: #666 !important;
          text-align: center !important;
          margin-top: 2px !important;
        }
        .barcode-retail-price {
          font-size: 12px !important;
          font-weight: 600 !important;
          text-align: center !important;
          margin-top: 2px !important;
        }
        .barcode-print-label canvas {
          width: 92% !important;
          height: auto !important;
          display: block !important;
          margin: 0 auto !important;
        }
        .no-print, .no-print * { display: none !important; }
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

  // Group labels into chunks of LABELS_PER_PRINT_PAGE for printing
  const labelChunks = [];
  for (let i = 0; i < paginatedProducts.length; i += LABELS_PER_PRINT_PAGE) {
    labelChunks.push(paginatedProducts.slice(i, i + LABELS_PER_PRINT_PAGE));
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 print:hidden">Product Barcodes</h2>
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        <input
          type="text"
          placeholder="Search by Barcode, SKU, or Product Name"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        />
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
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1 border rounded">{"<<"}</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded">{"<"}</button>
          <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded">{">"}</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded">{">>"}</button>
        </div>
        <button onClick={handleClear} className="px-4 py-2 bg-red-700 text-white rounded">Clear</button>
        <button onClick={() => setShowBarcodeHistory(true)} className="px-4 py-2 bg-gray-700 text-white rounded flex items-center gap-2">
          <MdHistory /> Barcode History
        </button>
        <button onClick={() => setShowQrCode(true)} className="px-4 py-2 bg-purple-700 text-white rounded flex items-center gap-2">
          <RiQrCodeLine /> QR Code
        </button>
        <button onClick={handlePrint} className="px-4 py-2 bg-green-700 text-white rounded flex items-center gap-2">
          <FaPrint /> Print
        </button>
      </div>

      {/* Print-ready chunked pages */}
      <div ref={printAreaRef} className="print:block hidden">
        {labelChunks.map((chunk, pageIndex) => (
          <div key={pageIndex} className="barcode-page">
            {chunk.flatMap((product, index) => {
              const quantity = parseInt(product.quantity, 10) || 1;
              return Array.from({ length: quantity }, (_, qIndex) => (
                <div key={`${product.id}-${index}-${qIndex}`} className="barcode-print-label">
                  <div className="barcode-label-header flex justify-between">
                    <span>{(product.product_type || '').slice(3, 8)}</span> <span>{product.size || ''}</span>
                  </div>
                  <canvas ref={canvas => canvas && product.barcode && renderBarcode(canvas, String(product.barcode))} />
                  <div className="text-center">
                    <div className="barcode-sku">
                      SKU: {product.sku ?? ''}
                    </div>
                    <div className="barcode-retail-price">
                      BDT: {product.retail_price ?? ''}
                    </div>
                  </div>
                </div>
              ));
            })}
          </div>
        ))}
      </div>

      {/* Screen view grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 print:hidden">
        {paginatedProducts.slice(0, labelsPerPage).flatMap((product, index) => {
          const quantity = parseInt(product.quantity, 10) || 1;
          return Array.from({ length: quantity }, (_, qIndex) => (
            <div key={`${product.id}-${index}-${qIndex}`} className="border rounded flex flex-col items-center p-2 bg-white shadow">
              <div className="text-xs text-gray-700 flex justify-between w-full">
                <span>{(product.product_type || '').slice(3, 8)}</span>
                <span>{product.size || ''}</span>
              </div>
              <canvas ref={canvas => canvas && product.barcode && renderBarcode(canvas, String(product.barcode))} className="w-[140px] h-[10vh]" />
              <div className="text-xs text-gray-500 flex flex-col items-center">
                <span>{product.sku ?? ''}</span>
                <span className="font-bold text-sm">BDT: {product.retail_price ?? ''}</span>
              </div>
            </div>
          ));
        })}
      </div>

      {paginatedProducts.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          No products found
        </div>
      )}

      {showBarcodeHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
            <button onClick={() => setShowBarcodeHistory(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl">&times;</button>
            <BarcodeHistory />
          </div>
        </div>
      )}

      {showQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[420px] max-w-full relative">
            <button onClick={() => setShowQrCode(false)} className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl">&times;</button>
            <QrCode />
          </div>
        </div>
      )}
    </div>
  );
};

export default BarCode;