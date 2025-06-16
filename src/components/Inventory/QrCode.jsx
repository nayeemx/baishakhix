import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import bwipjs from 'bwip-js';
import debounce from 'lodash.debounce';
import Show_Qrdata from './Show_Qrdata';
import Loader from '../Loader';
import bLogo from '../../assets/icons/b.png';
import { FaPrint } from 'react-icons/fa';

const PAGE_SIZE = 25;
const DEBOUNCE_DELAY = 300;
const QR_CACHE_SIZE = 100;

const QrCode = ({ onClose }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Indexed data structure for O(1) lookups
  const [productsIndex, setProductsIndex] = useState({});
  // QR code cache using LRU-like structure
  const qrCache = useMemo(() => new Map(), []);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Inject print-specific CSS for A4, no margin, no border, 40 labels per page, hide UI, and make barcode small
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          margin: 0 -84px !important;
          padding: 0 !important;
          background: #fff !important;
        }
        .barcode-print-grid {
          display: grid !important;
          margin: 0 -40px !important;
          grid-template-columns: repeat(5, 1fr) !important;
          grid-auto-rows: 1fr !important;
          gap: 6px !important;
          width: 100vw !important;
          max-width: 100vw !important;
        }
        .barcode-print-label {
          border: 1px solid #000 !important;
          margin: 0 !important;
          padding: 2px !important;
          box-shadow: none !important;
          page-break-inside: avoid !important;
        }
        .barcode-print-label canvas {
          width: 160px !important;
          height: 140px !important;
          max-width: 130px !important;
          max-height: 145px !important;
          display: block;
          margin: 0 auto;
          image-rendering: crisp-edges !important;
          image-rendering: pixelated !important;
        }
        .no-print, .no-print * {
          display: none !important;
        }
        .barcode-print-label .barcode-label-header {
          display: flex !important;
          justify-content: space-around !important;
          font-size: 12px !important;
          font-weight: bold !important;
          margin-bottom: 2px !important;
        }
        .barcode-print-label .barcode-retail-price {
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        .barcode-print-label span,
        .barcode-print-label div {
          font-size: 10px !important;
          line-height: 1.2 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch products from Firestore (get id for QR code route)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const productsSnap = await getDocs(collection(firestore, 'products'));
        const productsArr = productsSnap.docs.map(doc => ({
          id: doc.id, // use id for QR code route
          ...doc.data()
        }));
        setProducts(productsArr);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Single debounced search implementation
  const debouncedSetSearch = useMemo(
    () => debounce((value) => {
      setSearch(value);
    }, DEBOUNCE_DELAY),
    []
  );

  // Memoized filtered products
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const searchLower = search.toLowerCase();
    return products.filter(p => {
      const barcode = p.barcode?.toLowerCase();
      const oldBarcode = p.old_barcode?.toLowerCase();
      return (barcode && barcode.includes(searchLower)) ||
             (oldBarcode && oldBarcode.includes(searchLower));
    });
  }, [products, search]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  // Add total pages calculation
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);

  // Add page input handler
  const handlePageInput = (e) => {
    const value = parseInt(e.target.value);
    if (!value) return;
    const page = Math.max(1, Math.min(value, totalPages));
    setCurrentPage(page);
  };

  // Update QR generation to use a smaller scale for higher density in a small canvas
  const generateQR = useCallback((canvas, product) => {
    if (!canvas || !product || !product.id) {
      return;
    }
    const cacheKey = `qr_${product.id}`;
    if (qrCache.has(cacheKey)) {
      const cached = qrCache.get(cacheKey);
      const ctx = canvas.getContext('2d');
      ctx.putImageData(cached, 0, 0);
      return;
    }
    try {
      const qrUrl = `${window.location.origin}/qr/${product.id}`;
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: qrUrl,
        scale: 1.2, // Lower scale for higher density in small canvas
        includetext: false,
        backgroundcolor: 'FFFFFF',
        padding: 0 // Remove extra padding
      });
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      qrCache.set(cacheKey, imageData);
      if (qrCache.size > QR_CACHE_SIZE) {
        const firstKey = qrCache.keys().next().value;
        qrCache.delete(firstKey);
      }
    } catch (err) {
      // ignore
    }
  }, [qrCache]);

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Products</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return <Loader bLogoSrc={bLogo} />;
  }

  // Helper component for QR canvas
  const QrCanvas = ({ product, generateQR, setSelectedProduct }) => {
    const canvasRef = React.useRef(null);
    useEffect(() => {
      if (canvasRef.current && product) {
        generateQR(canvasRef.current, product);
      }
    }, [canvasRef, product, generateQR]);
    return (
      <canvas
        ref={canvasRef}
        width="160"
        height="160"
        style={{ width: 160, height: 160 }} // Ensure rendered size is also small
        className="mx-auto mb-3 cursor-pointer"
        onClick={() => {
          // Open modal with product details
          setSelectedProduct(product);
        }}
      />
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 no-print">
        <h2 className="text-xl font-bold">Product QR Codes</h2>
        <input
          type="text"
          placeholder="Search by barcode..."
          onChange={e => debouncedSetSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <button
          onClick={handlePrint}
          className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 flex items-center gap-2"
        >
          <FaPrint className="text-lg" />
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="barcode-print-grid flex flex-wrap gap-6 justify-center h-[65vh] overflow-auto">
          {paginatedProducts.map(product => (
            <div key={product.id} className="barcode-print-label border p-2 rounded text-center shadow-sm">
              <QrCanvas
                product={product}
                generateQR={generateQR}
                setSelectedProduct={setSelectedProduct}
              />
              <div className="text-sm font-medium space-y-1">
                <div className='print:hidden'>Barcode: {product.barcode || product.old_barcode || 'N/A'}</div>
                <div className='print:hidden'>SKU: {product.sku || 'N/A'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Updated Pagination */}
      <div className="mt-4 flex items-center justify-between print:hidden no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {'<<'}
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {'<'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={handlePageInput}
            className="w-16 px-2 py-1 border rounded text-center"
          />
          <span>of {totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {'>'}
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {'>>'}
          </button>
        </div>
      </div>
      
      {/* Product Details Modal */}
      {selectedProduct && (
        <Show_Qrdata
          product={selectedProduct}
          productId={selectedProduct.id}
          onClose={() => setSelectedProduct(null)}
        >
          {/* Add close button in the marked area */}
          <button
            onClick={() => setSelectedProduct(null)}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center border-2 border-red-500 rounded bg-white hover:bg-red-100 z-50"
            style={{ fontSize: '2rem', lineHeight: '1', padding: 0 }}
            aria-label="Close"
          >
            <span style={{ color: '#e11d48', fontWeight: 'bold' }}>&#9633;</span>
          </button>
        </Show_Qrdata>
      )}
      {/* Add a close button for the QR code page/modal if needed */}
      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 bg-red-500 border border-gray-400 rounded-full w-10 h-10 flex items-center justify-center text-2xl shadow hover:bg-gray-600"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default QrCode;