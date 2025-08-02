import React, { useState, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { FiX, FiClock, FiCalendar, FiUser, FiEdit3, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const AttendanceEditModal = ({ 
  staff, 
  selectedDate, 
  existingRecord, 
  onClose, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState({
    status: 'present',
    checkIn: '',
    checkOut: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setFormData({
        status: existingRecord.status || 'present',
        checkIn: existingRecord.checkIn || '',
        checkOut: existingRecord.checkOut || '',
        notes: existingRecord.notes || ''
      });
      setIsNewRecord(false);
    } else {
      setFormData({
        status: 'present',
        checkIn: '',
        checkOut: '',
        notes: ''
      });
      setIsNewRecord(true);
    }
  }, [existingRecord]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalHours = () => {
    if (!formData.checkIn || !formData.checkOut) return 0;
    
    try {
      const checkInTime = new Date(`2000-01-01T${formData.checkIn}`);
      const checkOutTime = new Date(`2000-01-01T${formData.checkOut}`);
      const totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      return Math.round(totalHours * 100) / 100;
    } catch (error) {
      return 0;
    }
  };

  const determineStatus = () => {
    if (formData.status === 'leave' || formData.status === 'absent') {
      return formData.status;
    }
    
    const totalHours = calculateTotalHours();
    if (totalHours < 6 && totalHours > 0) {
      return 'half_day';
    }
    return 'present';
  };

  const isLate = () => {
    if (!formData.checkIn) return false;
    const checkInTime = new Date(`2000-01-01T${formData.checkIn}`);
    return checkInTime.getHours() > 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() > 0);
  };

  const handleSave = async () => {
    if (!formData.status) {
      toast.error('Please select attendance status');
      return;
    }

    if (formData.status === 'present' && !formData.checkIn) {
      toast.error('Please enter check-in time for present status');
      return;
    }

    if (formData.checkIn && formData.checkOut) {
      const checkInTime = new Date(`2000-01-01T${formData.checkIn}`);
      const checkOutTime = new Date(`2000-01-01T${formData.checkOut}`);
      
      if (checkOutTime <= checkInTime) {
        toast.error('Check-out time must be after check-in time');
        return;
      }
    }

    try {
      setLoading(true);
      
      const attendanceData = {
        staffId: staff.id,
        staffName: staff.name,
        date: selectedDate,
        status: determineStatus(),
        checkIn: formData.checkIn || null,
        checkOut: formData.checkOut || null,
        totalHours: calculateTotalHours(),
        isLate: isLate(),
        notes: formData.notes,
        updatedAt: serverTimestamp()
      };

      if (isNewRecord) {
        attendanceData.createdAt = serverTimestamp();
        await addDoc(collection(firestore, 'attendance_records'), attendanceData);
        toast.success('Attendance record created successfully');
      } else {
        await updateDoc(doc(firestore, 'attendance_records', existingRecord.id), attendanceData);
        toast.success('Attendance record updated successfully');
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance record');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRecord) return;
    
    if (!window.confirm('Are you sure you want to delete this attendance record?')) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(firestore, 'attendance_records', existingRecord.id));
      toast.success('Attendance record deleted successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast.error('Failed to delete attendance record');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'leave': return 'bg-yellow-100 text-yellow-800';
      case 'half_day': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
              <span className="text-sm font-medium text-gray-700">
                {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{staff.name}</h2>
              <p className="text-sm text-gray-600">{dayjs(selectedDate).format('dddd, MMM DD, YYYY')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attendance Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'present', label: 'Present', color: 'bg-green-100 text-green-800' },
                { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-800' },
                { value: 'leave', label: 'On Leave', color: 'bg-yellow-100 text-yellow-800' },
                { value: 'half_day', label: 'Half Day', color: 'bg-orange-100 text-orange-800' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleInputChange('status', option.value)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    formData.status === option.value
                      ? `${option.color} border-current`
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check In Time
              </label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="time"
                  value={formData.checkIn}
                  onChange={(e) => handleInputChange('checkIn', e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="09:00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check Out Time
              </label>
              <div className="relative">
                <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="time"
                  value={formData.checkOut}
                  onChange={(e) => handleInputChange('checkOut', e.target.value)}
                  className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="17:00"
                />
              </div>
            </div>
          </div>

          {/* Calculated Fields */}
          {(formData.checkIn || formData.checkOut) && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Hours:</span>
                <span className="font-medium">{calculateTotalHours()} hours</span>
              </div>
              {formData.checkIn && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Late Arrival:</span>
                  <span className={`font-medium ${isLate() ? 'text-red-600' : 'text-green-600'}`}>
                    {isLate() ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Final Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(determineStatus())}`}>
                  {determineStatus().replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any additional notes..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between p-6 border-t border-gray-200">
          {existingRecord && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <FiTrash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          )}
          
          <div className="flex space-x-3 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FiEdit3 className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : (isNewRecord ? 'Create' : 'Update')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceEditModal; 