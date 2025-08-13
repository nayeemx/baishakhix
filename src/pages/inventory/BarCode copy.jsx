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

const PAGE_SIZE = 80;

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
        id: doc.id, // Firestore document ID
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
    let result = products.filter(p => p.is_labeled === "f"); // Only show products with is_labeled = "f"
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
    } catch (err) {
      // ignore rendering errors
    }
  };

  const handleClear = async () => {
    const productsToUpdate = products.filter(p => p.is_labeled === "f"); // Use full products state to find all "f" records
    if (productsToUpdate.length === 0) {
      console.log("No products to update.");
      return;
    }

    console.log("Products to update (Firestore IDs):", productsToUpdate.map(p => p.id));

    // Update only products with is_labeled = "f" using Firestore document IDs
    for (const product of productsToUpdate) {
      try {
        const productRef = doc(firestore, 'products', product.id); // Use Firestore document ID
        await updateDoc(productRef, { is_labeled: "t" });
        console.log(`Successfully updated document ${product.id}`);
      } catch (error) {
        console.error(`Error updating document ${product.id}:`, error);
      }
    }

    // Refresh products state after updates
    const snap = await getDocs(collection(firestore, 'products'));
    const updatedProducts = snap.docs.map(doc => ({
      id: doc.id, // Firestore document ID
      ...doc.data(),
    })).filter(p => p.barcode && p.is_labeled !== undefined && p.quantity !== undefined);
    setProducts(updatedProducts);
    console.log("Products refreshed after clear.");
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
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0 -14px !important; padding: 0 !important; background: #fff !important; }
        .barcode-print-grid { display: grid !important; grid-template-columns: repeat(5, 1fr) !important; grid-auto-rows: 1fr !important; gap: 4px !important; width: 50vw !important; max-width: 50vw !important; padding: 4px !important; }
        .barcode-print-label { border: 1px solid #000 !important; margin: 0 !important; padding: 2px !important; box-shadow: none !important; page-break-inside: avoid !important; min-height: 100px !important; min-width: 50px !important; font-size: 8px !important; background: #fff !important; }
        .barcode-label-header { display: flex !important; justify-content: space-around !important; font-size: 10px !important; font-weight: bold !important; margin-bottom: 0px !important; width: 50% !important; }
        .barcode-retail-price { font-size: 11px !important; font-weight: 600 !important; }
        .barcode-print-label span, .barcode-print-label div { font-size: 8px !important; line-height: 1.1 !important; }
        .barcode-print-label canvas { width: 50px !important; height: 50px !important; display: block !important; margin: 0 auto !important; image-rendering: crisp-edges !important; image-rendering: pixelated !important; }
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
        <button
          type="button"
          className="px-4 py-2 bg-red-700 text-white rounded flex items-center gap-2"
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-gray-700 text-white rounded flex items-center gap-2"
          onClick={() => setShowBarcodeHistory(true)}
        >
          <MdHistory className="text-lg" />
          Barcode History
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-purple-700 text-white rounded flex items-center gap-2"
          onClick={() => setShowQrCode(true)}
        >
          <RiQrCodeLine className="text-lg" />
          QR Code
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-green-700 text-white rounded flex items-center gap-2"
          onClick={handlePrint}
        >
          <FaPrint className="text-lg" />
          Print
        </button>
      </div>
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
      <div ref={printAreaRef} className="barcode-print-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 print:-ml-[1vw] print:grid-cols-8 print:gap-2 gap-4">
        {paginatedProducts.slice(0, labelsPerPage).flatMap((product, index) => {
          const quantity = parseInt(product.quantity, 10) || 1;
          return Array.from({ length: quantity }, (_, qIndex) => (
            <div
              key={`${product.id}-${index}-${qIndex}`}
              className="barcode-print-label border rounded flex flex-col items-center p-2 bg-white shadow"
            >
              <div className="barcode-label-header text-xs text-gray-700 flex justify-around w-full">
                <span>{product.product_type || ''}</span>
                <span className='ml-1'>{product.size || ''}</span>
              </div>
              <canvas
                ref={canvas => {
                  if (canvas && product.barcode) {
                    renderBarcode(canvas, String(product.barcode));
                  }
                }}
                className="w-[140px] h-[100px] print:w-[100px] print:h-[66px] mx-auto"
              />
              <div className="text-xs text-gray-500 flex flex-col items-center">
                <span className="block text-xs text-center print:text-nowrap">
                  {product.sku || ''}
                </span>
                <span className="block barcode-retail-price font-bold text-sm">
                  BDT: {product.retail_price ?? ''}
                </span>
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
    </div>
  );
};

export default BarCode;