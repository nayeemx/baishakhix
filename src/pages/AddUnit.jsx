import React, { useState } from 'react'
import UnitList from '../components/units/UnitList'
import { db } from '../firebase/firebase.config'
import { ref, set } from 'firebase/database'
import { useSelector } from 'react-redux'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
// Import icons from react-icons
import { FaListUl, FaTag, FaPalette, FaPencilRuler, FaGlobe, FaThLarge, FaBox, FaSun, FaRuler, FaTshirt, FaPlusSquare } from 'react-icons/fa'
import { useNavigate } from 'react-router-dom'; // Add this import

const AddUnit = () => {
  const [showUnitList, setShowUnitList] = useState(false)
  const [formData, setFormData] = useState({
    brand: '',
    color: '',
    design: '',
    origin: '',
    productCategory: '',
    productType: '',
    season: '',
    size: '',
    style: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const currentUser = useSelector(state => state.auth?.user)
  const navigate = useNavigate(); // Add this line

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const newKey = Date.now().toString()
      await set(ref(db, `units/${newKey}`), {
        brand: formData.brand,
        color: formData.color,
        design: formData.design,
        origin: formData.origin,
        product_category: formData.productCategory,
        product_type: formData.productType,
        season: formData.season,
        size: formData.size,
        style: formData.style,
        created_at: new Date().toISOString(),
        created_by: currentUser?.name || 'Unknown'
      })
      setFormData({
        brand: '',
        color: '',
        design: '',
        origin: '',
        productCategory: '',
        productType: '',
        season: '',
        size: '',
        style: ''
      })
      toast.success('Unit added successfully!')
    } catch (err) {
      setError('Failed to add unit')
      toast.error('Failed to add unit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <ToastContainer position="top-center" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white rounded-lg shadow-sm p-4">
          <h1 className="text-2xl font-bold text-gray-800">Add Unit</h1>
          <button
            className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-button hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
            onClick={() => setShowUnitList(true)}
          >
            <FaListUl />
            <span>Unit List</span>
          </button>
          <button
            className="flex items-center space-x-2 bg-green-50 text-green-600 px-4 py-2 rounded-button hover:bg-green-100 transition-colors cursor-pointer whitespace-nowrap ml-2"
            onClick={() => navigate('/inventory/add-product')}
          >
            <FaPlusSquare />
            <span>Add Product</span>
          </button>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Brand */}
                <div>
                  <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaTag className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter brand name"
                      required
                    />
                  </div>
                </div>
                {/* Color */}
                <div>
                  <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaPalette className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="color"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter color"
                      required
                    />
                  </div>
                </div>
                {/* Design */}
                <div>
                  <label htmlFor="design" className="block text-sm font-medium text-gray-700 mb-1">
                    Design
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaPencilRuler className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="design"
                      name="design"
                      value={formData.design}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter design details"
                      required
                    />
                  </div>
                </div>
                {/* Origin */}
                <div>
                  <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-1">
                    Origin
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaGlobe className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="origin"
                      name="origin"
                      value={formData.origin}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter country of origin"
                      required
                    />
                  </div>
                </div>
                {/* Product Category */}
                <div>
                  <label htmlFor="productCategory" className="block text-sm font-medium text-gray-700 mb-1">
                    Product Category
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaThLarge className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="productCategory"
                      name="productCategory"
                      value={formData.productCategory}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter product category"
                      required
                    />
                  </div>
                </div>
              </div>
              {/* Right Column */}
              <div className="space-y-6">
                {/* Product Type */}
                <div>
                  <label htmlFor="productType" className="block text-sm font-medium text-gray-700 mb-1">
                    Product Type
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaBox className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="productType"
                      name="productType"
                      value={formData.productType}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter product type"
                      required
                    />
                  </div>
                </div>
                {/* Season */}
                <div>
                  <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-1">
                    Season
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaSun className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="season"
                      name="season"
                      value={formData.season}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter season"
                      required
                    />
                  </div>
                </div>
                {/* Size */}
                <div>
                  <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-1">
                    Size
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaRuler className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="size"
                      name="size"
                      value={formData.size}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter size"
                      required
                    />
                  </div>
                </div>
                {/* Style */}
                <div>
                  <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-1">
                    Style
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaTshirt className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="style"
                      name="style"
                      value={formData.style}
                      onChange={handleChange}
                      className="pl-10 py-2 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter style"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Submit Button */}
            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                className="flex items-center justify-center rounded-lg px-6 py-3 border border-transparent text-base font-medium rounded-button shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors cursor-pointer whitespace-nowrap w-full md:w-1/2"
                disabled={loading}
              >
                <FaPlusSquare className="mr-2" />
                {loading ? 'Saving...' : 'Add Unit'}
              </button>
            </div>
            {error && <div className="text-red-600 mt-4 text-center">{error}</div>}
          </form>
        </div>
      </div>
      {showUnitList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg h-[98vh] w-full relative p-6">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold"
              onClick={() => setShowUnitList(false)}
              aria-label="Close"
              type="button"
            >
              &times;
            </button>
            <UnitList />
          </div>
        </div>
      )}
    </div>
  )
}

export default AddUnit