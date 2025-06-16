import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import logo from "../../assets/logo.png";
import bwipjs from "bwip-js";
import { getDoc, doc, query, where, getDocs, collection } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import AppLoader from "../AppLoader";
import bLogo from "../../assets/icons/b.png";

const Show_Qrdata = ({ product, productId: propProductId, onClose, isQrScan = false }) => {
  const params = useParams();
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const qrCanvasRef = useRef(null);

  // Determine productId: from props or from URL param
  const productId = propProductId || params.id;

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        if (!productId) {
          console.warn("No productId provided to Show_Qrdata");
          setProductData(null);
          return;
        }
        // Query by "id" field instead of doc id
        const q = query(collection(firestore, "products"), where("id", "==", productId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = { id: docSnap.id, ...docSnap.data() };
          console.log("Fetched Product Data by id field:", data);
          setProductData(data);
        } else {
          console.warn("No product found for the given id field:", productId);
          setProductData(null);
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setProductData(null);
      } finally {
        setLoading(false);
      }
    };

    if (product) {
      setProductData(product);
    } else if (productId) {
      fetchProduct();
    }
  }, [product, productId]);

  const generateQR = useCallback(
    async (canvas, product) => {
      if (!canvas || !product) return;
      try {
        const qrUrl = `${window.location.origin}/qr/${product.id}`;
        await bwipjs.toCanvas(canvas, {
          bcid: "qrcode",
          text: qrUrl,
          scale: 3,
          width: 20,
          height: 20,
          includetext: false,
          backgroundcolor: "FFFFFF",
          padding: 2,
        });
      } catch (err) {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    if (productData && qrCanvasRef.current) {
      generateQR(qrCanvasRef.current, productData);
    }
  }, [productData, generateQR]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <AppLoader bLogoSrc={bLogo} />
        </div>
      </div>
    );
  }

  const displayedColumns = [
    "barcode",
    "sku",
    "brand",
    "color",
    "origin",
    "product",
    "product_category",
    "product_type",
    "retail_price",
    "season",
    "size",
    "style",
    "design",
    "manufacture_date",
    "expiry_date",
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] relative">
        <div className="flex justify-between items-center mb-4">
          
          <div className="flex flex-col items-center w-[53vw]">
            <div>
              <Link to="/" className="flex items-center space-x-2">
                <img src={logo} alt="Logo" />
              </Link>
            </div>
            <h2 className="text-2xl flex-start font-bold">Product Details</h2>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center justify-center">
            <canvas
              ref={qrCanvasRef}
              width={120}
              height={120}
              className="mb-4"
            />
            <div className="text-xs text-gray-500 text-center">
              {productData?.barcode || productData?.old_barcode}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[60vh] border rounded-lg flex-1">
            <table className="table-auto w-full">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {productData
                  ? displayedColumns.map((column) => (
                      <tr key={column} className="border-b">
                        <td className="px-4 py-2 font-medium">{column}</td>
                        <td className="px-4 py-2">
                          {column === "color"
                            ? (productData[column] && productData[column].includes('-')
                                ? productData[column].split('-').slice(1).join('-')
                                : productData[column]?.substring(3) || "-")
                            : column === "origin"
                            ? (productData[column]?.substring(2) || "-")
                            : column === "product_type"
                            ? (productData[column]?.substring(3) || "-")
                            : column === "season"
                            ? (productData[column] && productData[column].includes('-')
                                ? productData[column].split('-').slice(1).join('-')
                                : productData[column] || "-")
                            : column === "size"
                            ? (productData[column]?.substring(3) || "-")
                            : column === "style"
                            ? (productData[column]?.substring(3) || "-")
                            : column === "design"
                            ? (productData[column]?.substring(3) || "-")
                            : column === "product_category"
                            ? (productData[column] && productData[column].includes('-')
                                ? productData[column].split('-').slice(1).join('-')
                                : productData[column] || "-")
                            : column === "brand"
                            ? (productData[column] && productData[column].startsWith("0-")
                                ? productData[column].substring(2)
                                : productData[column]?.toString() || "-")
                            : (productData[column]?.toString() || "-")
                          }
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="absolute top-[1vh] right-[0.4vw]">
          <Link to="/inventory/barcode">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            X
          </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Show_Qrdata;