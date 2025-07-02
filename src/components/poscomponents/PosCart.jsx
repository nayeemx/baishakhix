import React, { useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import {
  removeFromCart,
  updateQty,
  clearCart,
} from "../../redux/features/cartSlice";
import { toast, ToastContainer } from "react-toastify";
import {
  collection,
  doc,
  runTransaction,
  addDoc, // for customer creation outside transaction
} from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import CodeScanner from "./CodeScanner";
import PaymentForm from "./PaymentForm";
import InvoiceComponent from "./InvoiceComponent";
import dayjs from "dayjs";
import { Popover } from "@headlessui/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { RiDeleteBin6Fill } from "react-icons/ri";
import Customer_Adjustment from "../adjustment_component/Customer_Adjustment";
import { FaUserEdit } from "react-icons/fa";

const PosCart = () => {
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart.items || []);
  const currentUser = useSelector((state) => state.auth.user);

  const [vat, setVat] = useState(0);
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  // Date state for backdated sales
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  const subtotal = cart.reduce(
    (sum, item) => sum + (item.retail_price || 0) * (item.quantity || 1),
    0
  );
  const vatAmount = (subtotal * (parseFloat(vat) || 0)) / 100;
  const discountAmt =
    discountType === "percent"
      ? (subtotal * (parseFloat(discountValue) || 0)) / 100
      : parseFloat(discountValue) || 0;
  const total =
    subtotal + vatAmount + (parseFloat(shipping) || 0) - discountAmt;

  // Invoice modal state
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const handlePrint = () => {
    const printContent =
      document.getElementById("invoice-print-root").innerHTML;
    const printWindow = window.open("", "PRINT", "height=600,width=400");

    printWindow.document.write(`
  <html>
    <head>
      <title>Invoice</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        body {
          font-size: 10px;
          margin: 0 auto;
          width: 80mm;
          padding: 0;
          width: 80mm;
          background: white;
        }
        * {
          page-break-inside: avoid;
          overflow: visible;
        }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      ${printContent}
    </body>
  </html>
`);

    printWindow.document.close();
    printWindow.focus();
  };

  const resetForm = () => {
    dispatch(clearCart());
    setVat(0);
    setDiscountType("percent");
    setDiscountValue(0);
    setShipping(0);
    setPaymentMethod("cash");
    setCustomerName("");
    setCustomerNumber("");
    setSaleDate("");
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    if (!currentUser) {
      toast.error("You must be logged in to perform a sale.");
      return;
    }

    setIsCheckingOut(true);

    try {
      const saleResult = await runTransaction(
        firestore,
        async (transaction) => {
          const counterRef = doc(firestore, "counters", "salesCounter");
          const counterDoc = await transaction.get(counterRef);
          const currentCount = counterDoc.exists()
            ? counterDoc.data().value
            : 0;
          const newSaleCount = currentCount + 1;

          const saleTimestamp = saleDate ? new Date(saleDate) : new Date();
          const userId = currentUser.uid;

          // ✅ Generate invoiceNumber (format: DDMMYYYY-HHmm-001)
          const datePart = dayjs(saleTimestamp).format("DDMMYYYY-HHmm");
          const invoiceNumber = `${datePart}-${String(newSaleCount).padStart(
            3,
            "0"
          )}`;

          // Stock check and preparation
          const productUpdates = [];
          for (const cartItem of cart) {
            if (!cartItem.firestoreDocId) {
              throw new Error(
                `Product "${cartItem.product}" is missing a database ID. Please re-add it to the cart.`
              );
            }
            const productRef = doc(
              firestore,
              "products",
              cartItem.firestoreDocId
            );
            const productDoc = await transaction.get(productRef);

            if (!productDoc.exists()) {
              throw new Error(
                `Product "${cartItem.product}" could not be found in the database.`
              );
            }

            const productData = productDoc.data();
            const currentStock = Number(productData.quantity || 0);

            if (currentStock < cartItem.quantity) {
              throw new Error(
                `Not enough stock for "${cartItem.product}". Available: ${currentStock}, Requested: ${cartItem.quantity}.`
              );
            }

            const newStock = currentStock - cartItem.quantity;
            const unitPrice = Number(
              productData.unit_price || productData.retail_price || 0
            );
            const newTotalPrice = newStock * unitPrice;

            productUpdates.push({
              ref: productRef,
              data: {
                quantity: newStock,
                total_price: newTotalPrice,
              },
            });
          }

          // ✅ Prepare sale data
          const saleData = {
            saleCount: newSaleCount,
            invoiceNumber, // ✅ Save to Firestore
            items: cart.map((item) => ({
              ...item,
              created_by: userId,
              updated_by: userId,
            })),
            subtotal,
            vat: Number(vat) || 0,
            vatAmount,
            discountType,
            discountValue:
              discountType === "percent" ? Number(discountValue) || 0 : 0,
            discountAmt,
            shipping: Number(shipping) || 0,
            total,
            paymentMethod,
            customerName,
            customerNumber,
            createdAt: saleTimestamp,
            saleDate: saleDate || null,
            staffId: userId,
            staffEmail: currentUser.email,
            staffName: currentUser.name || currentUser.email,
          };

          const newSaleRef = doc(collection(firestore, "sales"));
          transaction.set(newSaleRef, saleData);

          // Apply stock updates
          productUpdates.forEach((update) => {
            transaction.update(update.ref, update.data);
          });

          // Update sales counter
          transaction.set(counterRef, { value: newSaleCount });

          return { ...saleData, id: newSaleRef.id, saleCount: newSaleCount };
        }
      );

      // Create customer doc outside transaction
      if (customerName || customerNumber) {
        await addDoc(collection(firestore, "customers"), {
          customerName,
          customerNumber,
          createdAt: new Date(),
          lastSaleId: saleResult.id,
        });
      }

      toast.success(`Sale #${saleResult.saleCount} completed successfully!`);

      // ✅ Pass invoiceNumber to InvoiceComponent
      setInvoiceData({
        ...saleResult,
        invoiceNumber: saleResult.invoiceNumber,
        createdAt: saleResult.createdAt.toISOString(),
      });

      setShowInvoice(true);
      resetForm();
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error(`Checkout failed: ${error.message}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleBarcodeScan = (barcode) => {
    const cleanBarcode = String(barcode).trim().toLowerCase();
    toast.info(
      "Barcode scanning is best handled by adding products from the product list."
    );
    // Example of how you might find it if products were globally available:
    const found = products.find(
      (p) => String(p.barcode).trim().toLowerCase() === cleanBarcode
    );
    if (found) {
      const cartItem = cart.find(
        (item) => item.id === found.id || item.barcode === found.barcode
      );
      const currentQty = cartItem ? cartItem.quantity || 1 : 0;
      if ((found.quantity || 1) > currentQty) {
        dispatch(addToCart({ ...found, quantity: 1 })); // Ensure firestoreDocId is passed here
        toast.success(`${found.product || "Product"} added to cart!`);
      } else {
        toast.error("Cannot add more than available stock!");
      }
    } else {
      toast.error(`Product not found for barcode: ${barcode}`);
    }
  };

  const handleIncrease = (item) => {
    dispatch(
      updateQty({ barcode: item.barcode, quantity: (item.quantity || 1) + 1 })
    );
    toast.success(`${item.product || "Product"} quantity increased!`);
  };

  const handleDecrease = (item) => {
    if ((item.quantity || 1) > 1) {
      dispatch(
        updateQty({ barcode: item.barcode, quantity: (item.quantity || 1) - 1 })
      );
      toast.info(`${item.product || "Product"} quantity decreased!`);
    }
  };

  const handleRemove = (item) => {
    dispatch(removeFromCart(item.barcode));
    toast.info(`${item.product || "Product"} removed from cart.`);
  };

  return (
    <>
      <div className="p-4 max-w-4xl mx-auto">
        {/* ToastContainer for react-toastify */}
        <ToastContainer position="top-right" autoClose={3000} />

        {/* Invoice Modal */}
        {showInvoice && (
          <>
            <div id="invoice-print-root" style={{ display: "none" }}>
              <InvoiceComponent {...invoiceData} />
            </div>

            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg p-6 min-w-[350px] max-w-lg relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl"
                  onClick={() => setShowInvoice(false)}
                  aria-label="Close"
                >
                  ×
                </button>

                <InvoiceComponent {...invoiceData} />

                <button
                  onClick={handlePrint}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
                >
                  🖨️ Print Invoice
                </button>
              </div>
            </div>
          </>
        )}

        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">POS Cart</h2>
          <div className="flex items-center gap-2">
            {/* Adjustment Button with Icon and Tooltip */}
            <button
              onClick={() => setShowAdjustmentModal(true)}
              className="flex items-center gap-2 text-sm p-1 rounded shadow-sm"
              title="Open Customer Adjustment Panel"
              aria-label="Customer Adjustment"
            >
              <FaUserEdit className="text-blue-700" aria-hidden="true" />
            </button>

            {/* Customer Adjustment Modal */}
            {showAdjustmentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-lg p-6 min-w-[450px] max-w-2xl relative">
                  <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl"
                    onClick={() => setShowAdjustmentModal(false)}
                    aria-label="Close Adjustment Modal"
                  >
                    ×
                  </button>
                  <Customer_Adjustment />
                </div>
              </div>
            )}

            <Popover className="relative">
              {({ open, close }) => (
                <>
                  <Popover.Button className="flex items-center text-sm bg-gray-100 p-1 gap-2 rounded hover:bg-blue-100 shadow-sm">
                    <FaCalendarAlt
                      className="text-blue-600"
                      title="Back-dated sale"
                    />
                    {saleDate ? dayjs(saleDate).format("DD MMM, YYYY") : ""}
                  </Popover.Button>

                  {open && (
                    <Popover.Panel className="absolute right-0 z-50 mt-2 bg-white border rounded shadow-lg p-2 flex flex-col">
                      <DatePicker
                        selected={saleDate ? new Date(saleDate) : null}
                        onChange={(date) => {
                          setSaleDate(date.toISOString().split("T")[0]);
                          close();
                        }}
                        maxDate={new Date()}
                        inline
                      />
                      {saleDate && (
                        <button
                          onClick={() => {
                            setSaleDate("");
                            close();
                          }}
                          className="mt-2 text-sm text-center text-red-600 hover:bg-red-100 rounded py-1"
                        >
                          Clear Date
                        </button>
                      )}
                    </Popover.Panel>
                  )}
                </>
              )}
            </Popover>
          </div>
        </div>

        {/* Barcode Scanner */}
        <div className="mb-6">
          <CodeScanner
            onScan={handleBarcodeScan}
            placeholder="Scan or enter barcode"
          />
        </div>

        {/* Cart Table */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full border border-gray-200 shadow-sm rounded text-nowrap">
            <thead className="bg-blue-50 text-gray-700">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    No products in cart
                  </td>
                </tr>
              ) : (
                cart.map((item) => (
                  <tr key={item.id || item.barcode} className="even:bg-gray-50">
                    <td className="px-4 py-2">{item.product}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDecrease(item)}
                          disabled={(item.quantity || 1) <= 1}
                          className="bg-gray-200 px-2 rounded hover:bg-gray-300"
                        >
                          -
                        </button>
                        <span>{item.quantity || 1}</span>
                        <button
                          onClick={() => handleIncrease(item)}
                          className="bg-gray-200 px-2 rounded hover:bg-gray-300"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      ৳{item.retail_price}
                    </td>
                    <td className="px-4 py-2 text-center">
                      ৳
                      {(
                        (item.retail_price || 0) * (item.quantity || 1)
                      ).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleRemove(item)}
                        className="text-red-600 hover:underline font-semibold"
                      >
                        <RiDeleteBin6Fill />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Payment Form - assumed it's another component */}
        <div className="mb-6">
          <PaymentForm
            vat={vat}
            setVat={setVat}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            shipping={shipping}
            setShipping={setShipping}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerNumber={customerNumber}
            setCustomerNumber={setCustomerNumber}
          />
        </div>

        {/* Summary & Checkout */}
        <div className="space-y-2 bg-gray-50 p-4 rounded shadow-sm border">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>৳{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT:</span>
            <span>৳{vatAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-৳{discountAmt.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping:</span>
            <span>৳{parseFloat(shipping || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>৳{total.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout} // Use the new handleCheckout
            disabled={isCheckingOut} // Disable during checkout
            className="w-full bg-green-600 text-white py-2 rounded mt-2 hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCheckingOut ? "Processing..." : "Checkout & Pay"}
          </button>
        </div>
      </div>
    </>
  );
};

export default PosCart;