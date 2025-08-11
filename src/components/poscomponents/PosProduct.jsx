import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  getCountFromServer,
  where,
} from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/features/cartSlice";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { FaShoppingCart } from "react-icons/fa";
import Logo from "../../assets/logo.png";
import Loader from "../Loader";
import { RiDeleteBin6Fill } from "react-icons/ri";

const PosProduct = () => {
  const [products, setProducts] = useState([]);
  const [filter, setfilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [colorFilter, setColorFilter] = useState("All");
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // Products per page
  const [totalProducts, setTotalProducts] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  // Use a ref to cache cursors for fast access (avoid unnecessary re-renders)
  const pageCursorsRef = useRef([]);
  const [pageCursors, setPageCursors] = useState([]); // For UI updates
  const dispatch = useDispatch();

  // Fetch total product count in real-time.
  useEffect(() => {
    const coll = collection(firestore, "products");
    // Note: Listening to the entire collection for the count can be inefficient
    // for a large number of products. A better approach for scalability is to
    // maintain a separate counter document in Firestore.
    const unsubscribe = onSnapshot(coll, (snapshot) => {
      setTotalProducts(snapshot.size);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 800); // 800ms debounce
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when search or filters change (debounced)
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, brand, colorFilter]);

  // Fetch products: paginated if no filter, all if any filter is active
  useEffect(() => {
    setLoading(true);

    const isFiltering =
      debouncedSearch.trim() ||
      category !== "All" ||
      brand !== "All" ||
      colorFilter !== "All";

    let unsubscribe = () => {};

    const setupListener = async () => {
      try {
        let productsQuery;

        if (isFiltering) {
          // When filtering, listen to the entire collection for real-time updates.
          productsQuery = query(
            collection(firestore, "products"),
            orderBy("barcode")
          );
        } else {
          // When not filtering, use pagination.
          const q = collection(firestore, "products");

          // This logic gets a cursor for a specific page. It's kept to support "jump-to-page",
          // but it can be inefficient for large page numbers as it reads many documents.
          const getStartAfterDoc = async (targetPage) => {
            if (targetPage === 1) return null;
            if (pageCursorsRef.current[targetPage - 2])
              return pageCursorsRef.current[targetPage - 2];
            
            let cursor = null;
            let docsFetched = 0;
            let lastDoc = null;
            while (docsFetched < (targetPage - 1) * pageSize) {
              const batchLimit = Math.min(
                pageSize,
                (targetPage - 1) * pageSize - docsFetched
              );
              const batchQ = cursor
                ? query(q, orderBy("barcode"), startAfter(cursor), limit(batchLimit))
                : query(q, orderBy("barcode"), limit(batchLimit));
              const snap = await getDocs(batchQ);
              if (snap.docs.length === 0) break;
              lastDoc = snap.docs[snap.docs.length - 1];
              cursor = lastDoc;
              docsFetched += snap.docs.length;
            }
            pageCursorsRef.current[targetPage - 2] = cursor;
            setPageCursors((prev) => {
              const newCursors = [...prev];
              newCursors[targetPage - 2] = cursor;
              return newCursors;
            });
            return cursor;
          };

          if (page === 1) {
            productsQuery = query(q, orderBy("barcode"), limit(pageSize));
          } else {
            const startAfterDoc = await getStartAfterDoc(page);
            if (!startAfterDoc) {
              setProducts([]);
              setLoading(false);
              return; // No documents for this page
            }
            productsQuery = query(
              q,
              orderBy("barcode"),
              startAfter(startAfterDoc),
              limit(pageSize)
            );
          }
        }

        unsubscribe = onSnapshot(productsQuery, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            firestoreDocId: doc.id, // Add Firestore document ID to each product
            ...doc.data(),
          }));
          setProducts(data);

          if (!isFiltering) {
            setFirstVisible(snapshot.docs[0] || null);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
            if (snapshot.docs.length > 0) {
              pageCursorsRef.current[page - 1] = snapshot.docs[snapshot.docs.length - 1];
              setPageCursors((prev) => {
                const newCursors = [...prev];
                newCursors[page - 1] = snapshot.docs[snapshot.docs.length - 1];
                return newCursors;
              });
            }
          } else {
            // When filtering, we get all products, so reset pagination cursors
            setFirstVisible(null);
            setLastVisible(null);
            setPageCursors([]);
          }

          setLoading(false);
        }, (error) => {
          console.error("Error fetching real-time products:", error);
          toast.error("Failed to load products in real-time.");
          setLoading(false);
        });

      } catch (error) {
        console.error("Failed to set up product listener:", error);
        toast.error("An error occurred while setting up data fetching.");
        setLoading(false);
      }
    };

    setupListener();

    // Cleanup listener on component unmount or when dependencies change
    return () => unsubscribe();
  }, [page, pageSize, debouncedSearch, category, brand, colorFilter]);

  // Get unique categories and brands from all products (not just current page)
  const [allCategories, setAllCategories] = useState([]);
  const [allBrands, setAllBrands] = useState([]);

  useEffect(() => {
    // Fetch all categories and brands from the entire collection
    const fetchAllCategoriesAndBrands = async () => {
      let allDocs = [];
      let lastDoc = null;
      let hasMore = true;
      while (hasMore) {
        const q = lastDoc
          ? query(
              collection(firestore, "products"),
              orderBy("barcode"),
              startAfter(lastDoc),
              limit(1000)
            )
          : query(
              collection(firestore, "products"),
              orderBy("barcode"),
              limit(1000)
            );
        const snap = await getDocs(q);
        allDocs = allDocs.concat(snap.docs);
        if (snap.docs.length < 1000) {
          hasMore = false;
        } else {
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }
      const allData = allDocs.map((doc) => doc.data());
      const uniqueCategories = Array.from(
        new Set(allData.map((p) => p.product_category).filter(Boolean))
      );
      const uniqueBrands = Array.from(
        new Set(allData.map((p) => p.brand).filter(Boolean))
      );
      setAllCategories(uniqueCategories);
      setAllBrands(uniqueBrands);
    };
    fetchAllCategoriesAndBrands();
  }, []);

  // Color logic
  function getCardColor(product) {
    if (product.expiry_date) {
      const exp = dayjs(product.expiry_date);
      if (exp.isBefore(dayjs(), "day")) return "bg-red-100"; // expired
      if (exp.isBefore(dayjs().add(30, "day"), "day")) return "bg-orange-100"; // expiring soon
    }
    return "bg-white";
  }

  // Filtering
  useEffect(() => {
    let data = [...products];
    // Apply all filters here
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim().toLowerCase();
      data = data.filter(
        (p) =>
          (p.product && p.product.toLowerCase().includes(s)) ||
          (p.barcode && p.barcode.toLowerCase().includes(s)) ||
          (p.sku && p.sku.toLowerCase().includes(s)) ||
          (p.retail_price && p.retail_price.toString().includes(s))
      );
    }
    if (category !== "All") {
      data = data.filter((p) => p.product_category === category);
    }
    if (brand !== "All") {
      data = data.filter((p) => p.brand === brand);
    }
    if (colorFilter !== "All") {
      data = data.filter((p) => {
        const color = getCardColor(p);
        if (colorFilter === "Red") return color === "bg-red-100";
        if (colorFilter === "Orange") return color === "bg-orange-100";
        if (colorFilter === "White") return color === "bg-white";
        return false;
      });
    }
    setfilter(data);
  }, [products, debouncedSearch, category, brand, colorFilter]);

  const handleAddToCart = (product) => {
    dispatch(addToCart({ ...product, quantity: 1 }));
    toast.success(`${product.product || "Product"} added to cart!`);
  };

  // Pagination controls (disable if filtering)
  const isFiltering =
    debouncedSearch.trim() ||
    category !== "All" ||
    brand !== "All" ||
    colorFilter !== "All";
  const totalPages = isFiltering
    ? 1
    : Math.max(1, Math.ceil(totalProducts / pageSize));
  const canPrev = !isFiltering && page > 1;
  const canNext = !isFiltering && page < totalPages;

  // For direct page jump
  const [gotoPage, setGotoPage] = useState("");

  if (loading) return <Loader />;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-gray-800">
        🛒 Product List (POS)
      </h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow border border-gray-200">
        <input
          type="text"
          placeholder="Search by name, price, SKU, barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (e.target.value === "All") setBrand("All");
          }}
          className="border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="All">Select Category</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            if (e.target.value === "All") setCategory("All");
          }}
          className="border border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="All">Select Brand</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Color Filters */}
        <div className="flex items-center gap-2 ml-4">
          {[
            { color: "Red", bg: "#f87171", title: "Expired" },
            { color: "Orange", bg: "#fb923c", title: "Expiring soon" },
            { color: "White", bg: "#ffffff", title: "Normal" },
          ].map(({ color, bg, title }) => (
            <button
              key={color}
              onClick={() => setColorFilter(color)}
              className={`w-5 h-5 rounded-full border ${
                colorFilter === color ? "ring-2 ring-blue-400" : ""
              }`}
              style={{ backgroundColor: bg }}
              title={title}
            />
          ))}
        </div>

        <button
          onClick={() => {
            setCategory("All");
            setBrand("All");
            setColorFilter("All");
            setSearch("");
          }}
          className="ml-2 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded border border-gray-400"
        >
          <RiDeleteBin6Fill className="w-5 h-5" />
        </button>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filter.map((product) => (
          <div
            key={product.barcode}
            className={`border rounded-2xl shadow hover:shadow-lg p-4 relative flex flex-col items-center ${getCardColor(
              product
            )} transition`}
            style={{ borderColor: "#222", boxShadow: "0 0 0 2px #e5e7eb" }}
          >
            <img
              src={product.image || Logo}
              alt={product.product}
              className="w-full h-36 object-contain mb-2 bg-gray-100 rounded"
              onError={(e) => (e.target.src = Logo)}
            />
            <div className="text-xs text-gray-500 mb-1">
              Barcode: {product.barcode}
            </div>
            <div className="font-semibold text-center text-base text-gray-800 mb-1">
              {product.product}
            </div>
            <div className="flex items-center justify-between md:self-end self-center w-[10vw]">
              <div className="text-green-600 text-xl font-bold">
                ৳{product.retail_price}
              </div>
              <div
                className={`text-xs px-2 py-0.5 rounded ${
                  Number(product.quantity) === 0
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {product.quantity} left
              </div>
            </div>

            <button
              className="absolute top-2 right-2 p-2 rounded-full bg-green-100 hover:bg-green-200 border-2 border-green-300 shadow"
              onClick={() => handleAddToCart(product)}
              aria-label="Add to cart"
            >
              <FaShoppingCart className="w-5 h-5 text-green-600" />
            </button>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!isFiltering && (
        <div className="flex flex-col items-center gap-4 mt-8">
          {/* Page controls */}
          <div className="flex gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={!canPrev}
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              &#171;
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              &#60;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (page > 3 && totalPages > 5) {
                if (page + 2 > totalPages) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
              }
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 rounded ${
                    pageNum === page
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canNext}
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              &#62;
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={!canNext}
              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              &#187;
            </button>
          </div>

          {/* Go to page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Go to page:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={gotoPage || page}
              onChange={(e) => setGotoPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const num = Number(gotoPage);
                  if (num >= 1 && num <= totalPages) setPage(num);
                }
              }}
              className="border rounded px-2 py-1 w-16 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-700">/ {totalPages}</span>
            <button
              onClick={() => {
                const num = Number(gotoPage);
                if (num >= 1 && num <= totalPages) setPage(num);
              }}
              className="ml-2 px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosProduct;