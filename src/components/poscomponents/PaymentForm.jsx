import React, { useState } from 'react';

const PaymentForm = ({
  vat,
  setVat,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  shipping,
  setShipping,
  paymentMethod,
  setPaymentMethod,
  customerName,
  setCustomerName,
  customerNumber,
  setCustomerNumber,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-4 bg-white p-4 border rounded shadow-sm">
      {/* VAT */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32">VAT (%)</label>
        <input
          type="number"
          value={vat}
          onChange={(e) => setVat(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-[200px]"
          placeholder="0"
        />
      </div>

      {/* Discount */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32">Discount</label>
        <div className="flex items-center gap-2 w-full max-w-[200px]">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="percent">%</option>
            <option value="fixed">৳</option>
          </select>
          <input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            placeholder="0"
          />
        </div>
      </div>

      {/* Shipping */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32">Shipping</label>
        <input
          type="number"
          value={shipping}
          onChange={(e) => setShipping(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-[200px]"
          placeholder="0"
        />
      </div>

      {/* Payment Method */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32">Payment</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-[200px]"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mfs">MFS</option>
          <option value="due_sale">Due Sale</option>
        </select>
      </div>

      {/* Customer Name */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32">Customer</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-[200px]"
          placeholder="Name"
        />
      </div>

      {/* Customer Number */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium w-32"></label>
        <input
          type="text"
          value={customerNumber}
          onChange={(e) => setCustomerNumber(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-[200px]"
          placeholder="Mobile"
        />
      </div>
    </div>
  );
};

export default PaymentForm;