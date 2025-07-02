import React, { useRef, useEffect, useState } from "react";
import { FaCamera } from "react-icons/fa";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/features/cartSlice";
import { toast } from "react-toastify";
import { firestore } from "../../firebase/firebase.config";
import { collection, getDocs } from "firebase/firestore";
import CameraScanner from "./CameraScanner";

const CodeScanner = ({ placeholder = "Scan or enter barcode" }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();

  const [showCamera, setShowCamera] = useState(false);
  const [products, setProducts] = useState([]);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Fetch product list from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(firestore, "products"));
        const list = snap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          firestoreDocId: doc.id,
        }));
        setProducts(list);
      } catch (err) {
        console.error("Failed to load products:", err);
        toast.error("Failed to load product list.");
      }
    };
    fetchProducts();
  }, []);

  const handleBarcodeInput = (barcode) => {
    const cleanBarcode = String(barcode).trim().toLowerCase();

    const found = products.find(
      (p) => String(p.barcode).trim().toLowerCase() === cleanBarcode
    );

    if (!found) {
      toast.error(`Product not found for barcode: ${barcode}`);
      return;
    }

    if ((found.quantity || 0) <= 0) {
      toast.error(`"${found.product}" is out of stock.`);
      return;
    }

    dispatch(addToCart({ ...found, quantity: 1 }));
    toast.success(`Added "${found.product}" to cart.`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const value = e.target.value.trim();
      if (value) {
        handleBarcodeInput(value);
        e.target.value = "";
      }
    }
  };

  const handleCameraDetected = (barcode) => {
    setShowCamera(false);
    if (barcode) handleBarcodeInput(barcode);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        className="border p-2 rounded w-full"
        autoFocus
      />
      <button
        type="button"
        className="p-2 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none"
        title="Scan with camera"
        onClick={() => setShowCamera(true)}
      >
        <FaCamera className="w-5 h-5 text-gray-700" />
      </button>

      {showCamera && (
        <CameraScanner
          onDetected={handleCameraDetected}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default CodeScanner;