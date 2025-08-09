import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import Logo from '../../assets/logo.png'; // ✅ Adjust the path if needed

// Helper to format date/time
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const d = date.toLocaleDateString('en-GB');
  const t = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date: d, time: t };
}

// Invoice Component
const Invoice = React.forwardRef(({
  items = [],
  vatAmount = 0,
  discountAmt = 0,
  shipping = 0,
  paymentMethod = '',
  customerName = '',
  customerNumber = '',
  total = 0,
  createdAt = '',
  invoiceNumber = '',
  saleCount = null,
  onClose,
}, ref) => {
  const { date, time } = formatDateTime(createdAt || new Date());
  const invoiceNum = invoiceNumber || `${date.replace(/\//g, '')}-${time.replace(/:/g, '')}-${saleCount ?? ''}`;

  return (
    <div
      ref={ref}
      className="text-xs text-black mx-auto w-full max-w-[80mm] bg-white p-2 print:p-0 print:w-[80mm] print:max-w-none"
      style={{
        width: '80mm',
        maxWidth: '80mm',
      }}
    >
      {/* Close button (visible only on screen) */}
      {onClose && (
        <button
          onClick={onClose}
          className="close-button absolute top-2 right-2 text-xl font-bold print:hidden"
          aria-label="Close"
          type="button"
        >
          ×
        </button>
      )}

      {/* Logo */}
      <div className="text-center mb-2">
        <img src={Logo} alt="Baishakhi Logo" className="h-12 mx-auto mb-1 object-contain" />
      </div>

      {/* Date & Invoice Info */}
      <div className="flex justify-between text-[10px] mb-1">
        <div>
          <div>📅 {date}</div>
          <div>⏰ {time}</div>
        </div>
        <div className="text-right">
          Invoice: <span className="font-mono">{invoiceNum}</span>
        </div>
      </div>

      {/* Customer Info */}
      {(customerName || customerNumber) && (
        <div className="text-[10px] mb-2">
          {customerName && <div>Customer: <strong>{customerName}</strong></div>}
          {customerNumber && <div>Phone: <strong>{customerNumber}</strong></div>}
        </div>
      )}

      {/* Product Table */}
      <table className="w-full text-[10px] border-collapse mb-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 px-1">Product</th>
            <th className="text-right py-1 px-1">Price</th>
            <th className="text-right py-1 px-1">Qty</th>
            <th className="text-right py-1 px-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan="4" className="text-center py-2">No products</td></tr>
          ) : (
            items.map((item, idx) => (
              <tr key={item.barcode || item.id || idx} className="border-b border-gray-300">
                <td className="px-1 py-1 break-words">{item.product}</td>
                <td className="px-1 py-1 text-right">৳{parseFloat(item.retail_price || 0).toFixed(2)}</td>
                <td className="px-1 py-1 text-right">{item.quantity}</td>
                <td className="px-1 py-1 text-right">
                  ৳{((item.retail_price || 0) * (item.quantity || 1)).toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="text-[10px] space-y-1">
        <div>VAT: ৳{parseFloat(vatAmount).toFixed(2)}</div>
        <div>Discount: ৳{parseFloat(discountAmt).toFixed(2)}</div>
        <div>Shipping: ৳{parseFloat(shipping).toFixed(2)}</div>
        <div className="font-bold mt-1">Total: ৳{parseFloat(total).toFixed(2)}</div>
        <div>Payment: {paymentMethod}</div>
      </div>

      {/* Footer */}
      <div className="mt-3 text-center text-[9px]">
        <div className="font-medium">Pleased to shop with us ❤️</div>
        <div>Baishakhi © 2024 All rights reserved.</div>
        <div>68/1 Purana Paltan, Dhaka 1000 || +8801711176185</div>
        <div>
          by <a href="https://innologybd.com/" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">innologybd</a>
        </div>
      </div>
    </div>
  );
});

// Parent component with print button
const InvoicePage = () => {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Invoice',
  });

  // Sample data — Replace with your real data
  const sampleInvoiceData = {
    items: [
      { product: 'Rice 1kg', retail_price: 75, quantity: 2, barcode: '123456' },
      { product: 'Oil 500ml', retail_price: 110, quantity: 1, id: 'abc123' },
    ],
    vatAmount: 10,
    discountAmt: 5,
    shipping: 0,
    total: 265,
    paymentMethod: 'Cash',
    customerName: 'Mr. Ali',
    customerNumber: '017XXXXXXXX',
    createdAt: new Date().toISOString(),
    invoiceNumber: '',
    saleCount: 1001,
    onClose: () => alert('Modal close here'),
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      <button
        onClick={handlePrint}
        className="mb-4 px-4 py-2 bg-blue-600 text-white text-sm rounded print:hidden"
      >
        Print Invoice
      </button>

      <Invoice ref={printRef} {...sampleInvoiceData} />
    </div>
  );
};

export default InvoicePage;