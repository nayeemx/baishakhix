import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "../../firebase/firebase.config";

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Fetch all suppliers on mount
  useEffect(() => {
    setLoading(true);
    getDocs(collection(firestore, "supplier_list"))
      .then((snap) => {
        setSuppliers(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch products for selected supplier
  const handleSupplierClick = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowModal(true);
    setProductsLoading(true);
    const q = query(
      collection(firestore, "products"),
      where("supplier_id", "==", supplier.id)
    );
    const snap = await getDocs(q);
    setProducts(
      snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
    setProductsLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Supplier List</h1>
      {loading ? (
        <div>Loading suppliers...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 text-left">Supplier Name</th>
                <th className="border px-3 py-2 text-left">Address</th>
                <th className="border px-3 py-2 text-left">Phone</th>
                <th className="border px-3 py-2 text-left">Supplier ID</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => handleSupplierClick(s)}
                >
                  <td className="border px-3 py-2">{s.supplier_name}</td>
                  <td className="border px-3 py-2">{s.address}</td>
                  <td className="border px-3 py-2">{s.phone}</td>
                  <td className="border px-3 py-2">{s.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for supplier's products */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[700px] max-w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setShowModal(false)}
              title="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">
              Products for: {selectedSupplier?.supplier_name}
            </h2>
            {productsLoading ? (
              <div>Loading products...</div>
            ) : products.length === 0 ? (
              <div className="text-gray-500">
                No products found for this supplier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Barcode</th>
                      <th className="border px-2 py-1">Product</th>
                      <th className="border px-2 py-1">Category</th>
                      <th className="border px-2 py-1">Size</th>
                      <th className="border px-2 py-1">Color</th>
                      <th className="border px-2 py-1">Qty</th>
                      <th className="border px-2 py-1">Unit Price</th>
                      <th className="border px-2 py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="border px-2 py-1">{p.barcode}</td>
                        <td className="border px-2 py-1">{p.product}</td>
                        <td className="border px-2 py-1">
                          {p.product_category}
                        </td>
                        <td className="border px-2 py-1">{p.size}</td>
                        <td className="border px-2 py-1">{p.color}</td>
                        <td className="border px-2 py-1">{p.quantity}</td>
                        <td className="border px-2 py-1">{p.unit_price}</td>
                        <td className="border px-2 py-1">{p.total_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierList;