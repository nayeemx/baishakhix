import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiArrowLeft, FiEdit, FiTrash, FiEye, FiX } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { firestore } from '../../firebase/firebase.config';
import { collection, addDoc, getDocs, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';

const CustomerList = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [editCustomer, setEditCustomer] = useState({ name: '', phone: '', email: '', address: '' });

  // Fetch customers from Firestore
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const q = query(collection(firestore, 'customers'));
        const querySnapshot = await getDocs(q);
        const customerList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCustomers(customerList);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers.');
      }
    };
    fetchCustomers();
  }, []);

  // Handle form submission to create a new customer
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(firestore, 'customers'), {
        name,
        phone,
        email,
        address,
        createdAt: new Date(),
      });
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      const q = query(collection(firestore, 'customers'));
      const querySnapshot = await getDocs(q);
      const customerList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCustomers(customerList);
      toast.success('Customer created successfully!');
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Failed to create customer.');
    }
  };

  // Handle edit customer
  const handleEdit = (customer) => {
    setEditCustomer({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const customerRef = doc(firestore, 'customers', editCustomer.id);
      await updateDoc(customerRef, {
        name: editCustomer.name,
        phone: editCustomer.phone,
        email: editCustomer.email,
        address: editCustomer.address,
      });
      setCustomers(customers.map(c => (c.id === editCustomer.id ? { ...c, ...editCustomer } : c)));
      setIsEditModalOpen(false);
      toast.success('Customer updated successfully!');
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer.');
    }
  };

  // Handle delete customer
  const handleDeleteRequest = (customer) => {
    setCustomerToDelete(customer);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteDoc(doc(firestore, 'customers', customerToDelete.id));
      setCustomers(customers.filter(customer => customer.id !== customerToDelete.id));
      setIsDeleteModalOpen(false);
      toast.success('Customer deleted successfully!');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer.');
    }
  };

  // Handle view customer
  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setIsViewModalOpen(true);
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  return (
    <div className="bg-blue-50 min-h-screen p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Customers</h2>
        <button className="bg-gray-800 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-700">
          <FiArrowLeft /> Back to Home
        </button>
      </div>
      <div className="flex gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md w-1/3">
          <h3 className="text-xl font-semibold mb-4">Create Customer</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700"
            >
              Create
            </button>
          </form>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md w-2/3">
          <h3 className="text-xl font-semibold mb-4">Customer List</h3>
          <input
            type="text"
            placeholder="Search by name or phone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-4 border border-gray-300 rounded"
          />
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border-b">Name</th>
                <th className="p-2 border-b">Phone</th>
                <th className="p-2 border-b">Total Due</th>
                <th className="p-2 border-b">Purchases</th>
                <th className="p-2 border-b">Last Visit</th>
                <th className="p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="border-b">
                  <td className="p-2">{customer.name}</td>
                  <td className="p-2">{customer.phone}</td>
                  <td className="p-2">{customer.totalDue || '£0.00'}</td>
                  <td className="p-2">{customer.purchases || 0}</td>
                  <td className="p-2">{customer.lastVisit ? new Date(customer.lastVisit).toLocaleString() : 'N/A'}</td>
                  <td className="p-2">
                    <button
                      onClick={() => handleView(customer)}
                      className="text-blue-500 mr-2 hover:text-blue-600"
                      title="View"
                    >
                      <FiEye />
                    </button>
                    <button
                      onClick={() => handleEdit(customer)}
                      className="text-green-500 mr-2 hover:text-green-600"
                      title="Edit"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(customer)}
                      className="text-red-500 hover:text-red-600"
                      title="Delete"
                    >
                      <FiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ToastContainer />

      {/* View Modal */}
      <Transition appear show={isViewModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsViewModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border border-gray-200">
                  <button
                    onClick={() => setIsViewModalOpen(false)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <FiX size={24} />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Customer Details</h2>
                  {selectedCustomer && (
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Name:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.name}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Phone:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Email:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Address:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Total Due:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.totalDue || '£0.00'}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Purchases:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.purchases || 0}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-1/3 font-semibold text-gray-700 text-sm">Last Visit:</span>
                        <span className="w-2/3 text-gray-600">{selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleString() : 'N/A'}</span>
                      </div>
                      <button
                        onClick={() => setIsViewModalOpen(false)}
                        className="mt-6 w-full bg-gray-800 text-white py-2 rounded-md hover:bg-gray-900 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Edit Modal */}
      <Transition appear show={isEditModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEditModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixedInset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white p-6 rounded-lg relative max-w-md w-full">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                  <h2 className="text-xl font-semibold mb-4">Edit Customer</h2>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={editCustomer.name}
                        onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                        required
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input
                        type="text"
                        value={editCustomer.phone}
                        onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                        required
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email (optional)</label>
                      <input
                        type="email"
                        value={editCustomer.email}
                        onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <input
                        type="text"
                        value={editCustomer.address}
                        onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700"
                    >
                      Save Changes
                    </button>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white p-6 rounded-lg relative max-w-md w-full">
                  <button
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                  >
                    <FiX size={24} />
                  </button>
                  <h2 className="text-xl font-semibold mb-4">Confirm Delete</h2>
                  <p>Are you sure you want to delete {customerToDelete?.name}?</p>
                  <div className="flex justify-end gap-4 mt-4">
                    <button
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default CustomerList;