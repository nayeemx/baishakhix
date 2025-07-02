import React from 'react';
import Logo from '../../assets/logo.png';

function formatDateTime(dateString) {
  const date = new Date(dateString);
  const d = date.toLocaleDateString('en-GB');
  const t = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { date: d, time: t };
}

const InvoiceComponent = ({
  items = [],
  subtotal = 0,
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
}) => {
  const { date, time } = formatDateTime(createdAt || new Date());
  const invoiceNum = invoiceNumber || `${date.replace(/\//g, '')}-${time.replace(/:/g, '')}-${saleCount ?? ''}`;

  return (
    <div className="text-gray-800">
      <div className="print-container bg-white text-black">
        <div className="flex flex-col items-center mb-2 text-center">
          <img src={Logo} alt="Baishakhi Logo" className="h-16 mb-1 object-contain" />
        </div>

        <div className="flex justify-between items-center mb-2 text-xs">
          <div>
            <div className="flex items-center gap-1 mb-1">📅 {date}</div>
            <div className="flex items-center gap-1">⏰ {time}</div>
          </div>

          <div className="text-right text-gray-600">
            Invoice: <span className="font-mono">{invoiceNum}</span>
          </div>
        </div>

        {(customerName || customerNumber) && (
          <div className="mb-2 text-xs">
            {customerName && (
              <span>
                Customer: <span className="font-semibold">{customerName}</span>
              </span>
            )}
            {customerNumber && (
              <span className="ml-4">
                Phone: <span className="font-semibold">{customerNumber}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-2">
          <table className="w-full text-xs border-collapse mb-2">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="text-left py-1 px-2">Product</th>
                <th className="text-right py-1 px-2">Price</th>
                <th className="text-right py-1 px-2">Qty</th>
                <th className="text-right py-1 px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-2">No products</td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.barcode || item.id || idx} className="border-b border-gray-300 last:border-none">
                    <td className="py-1 px-2 break-words whitespace-normal">{item.product}</td>
                    <td className="py-1 px-2 text-right">৳{parseFloat(item.retail_price || 0).toFixed(2)}</td>
                    <td className="py-1 px-2 text-right">{item.quantity}</td>
                    <td className="py-1 px-2 text-right">
                      ৳{((item.retail_price || 0) * (item.quantity || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs space-y-1">
          <div>VAT: ৳{parseFloat(vatAmount).toFixed(2)}</div>
          <div>Discount: ৳{parseFloat(discountAmt).toFixed(2)}</div>
          <div>Shipping: ৳{parseFloat(shipping).toFixed(2)}</div>
          <div className="font-bold mt-2">Total: ৳{parseFloat(total).toFixed(2)}</div>
          <div>Payment: {paymentMethod}</div>
        </div>

        <div className="mt-6 text-center text-xs">
          <div className='font-medium'>Pleased to shop with us ❤️</div>
          <div className="text-[10px]">Baishakhi © 2024 All rights reserved.</div>
          <div className="text-[10px]">68/1 Purana Paltan, Dhaka 1000 || +8801711176185</div>
          <div className="text-[10px]">
            by <a href="https://innologybd.com/" className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">innologybd</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceComponent;