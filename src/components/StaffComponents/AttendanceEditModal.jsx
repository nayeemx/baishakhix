import React, { useState, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where
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
    notes: '',
    leaveType: 'full_day',
    customLeave: false, // New state to toggle custom leave mode
    startDate: '',     // For custom leave start date
    endDate: '',       // For custom leave end date
    halfDays: [{ date: '', checkIn: '', checkOut: '', notes: '' }] // For custom half-day leaves
  });
  const [loading, setLoading] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [usedLeaves, setUsedLeaves] = useState(0);
  const [proposedLeaves, setProposedLeaves] = useState(0);

  useEffect(() => {
    if (existingRecord) {
      setFormData({
        status: existingRecord.status || 'present',
        checkIn: existingRecord.checkIn || '',
        checkOut: existingRecord.checkOut || '',
        notes: existingRecord.notes || '',
        leaveType: existingRecord.leaveType || 'full_day',
        customLeave: false,
        startDate: '',
        endDate: '',
        halfDays: [{ date: '', checkIn: '', checkOut: '', notes: '' }]
      });
      setIsNewRecord(false);
    } else {
      setFormData({
        status: 'present',
        checkIn: '',
        checkOut: '',
        notes: '',
        leaveType: 'full_day',
        customLeave: false,
        startDate: '',
        endDate: '',
        halfDays: [{ date: '', checkIn: '', checkOut: '', notes: '' }]
      });
      setIsNewRecord(true);
    }
  }, [existingRecord]);

  useEffect(() => {
    if (formData.customLeave) {
      const fetchUsedLeaves = async () => {
        const monthStart = dayjs(selectedDate).startOf('month').format('YYYY-MM-DD');
        const monthEnd = dayjs(selectedDate).endOf('month').format('YYYY-MM-DD');
        let used = 0;

        // Fetch leave status
        const leaveQuery = query(
          collection(firestore, 'attendance_records'),
          where('staffId', '==', staff.id),
          where('date', '>=', monthStart),
          where('date', '<=', monthEnd),
          where('status', '==', 'leave')
        );
        const leaveSnapshot = await getDocs(leaveQuery);
        leaveSnapshot.forEach((doc) => {
          const data = doc.data();
          used += data.leaveType === 'half_day' ? 0.5 : 1;
        });

        // Fetch half_day status
        const halfDayQuery = query(
          collection(firestore, 'attendance_records'),
          where('staffId', '==', staff.id),
          where('date', '>=', monthStart),
          where('date', '<=', monthEnd),
          where('status', '==', 'half_day')
        );
        const halfDaySnapshot = await getDocs(halfDayQuery);
        used += halfDaySnapshot.size * 0.5;

        setUsedLeaves(used);
      };
      fetchUsedLeaves();
    }
  }, [formData.customLeave, staff.id, selectedDate]);

  useEffect(() => {
    if (formData.customLeave) {
      let full = 0;
      if (formData.startDate && formData.endDate) {
        const start = dayjs(formData.startDate);
        const end = dayjs(formData.endDate);
        full = end.diff(start, 'day') + 1;
      }
      const half = formData.halfDays.filter(hd => hd.date).length * 0.5;
      setProposedLeaves(full + half);
    } else {
      setProposedLeaves(0);
    }
  }, [formData.customLeave, formData.startDate, formData.endDate, formData.halfDays]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHalfDayChange = (index, field, value) => {
    const newHalfDays = [...formData.halfDays];
    newHalfDays[index][field] = value;
    setFormData(prev => ({
      ...prev,
      halfDays: newHalfDays
    }));
  };

  const addHalfDay = () => {
    setFormData(prev => ({
      ...prev,
      halfDays: [...prev.halfDays, { date: '', checkIn: '', checkOut: '', notes: '' }]
    }));
  };

  const removeHalfDay = (index) => {
    const newHalfDays = formData.halfDays.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      halfDays: newHalfDays
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

    if (formData.status === 'half_day' && !formData.checkIn && !formData.checkOut) {
      toast.error('Half day status requires either check-in or check-out time');
      return;
    }

    if (formData.status === 'leave' && formData.leaveType === 'half_day' && !formData.checkIn && !formData.checkOut && !formData.customLeave) {
      toast.error('Half day leave requires either check-in or check-out time');
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

      if (formData.customLeave) {
        // Handle custom leave (multi-day or half-day leaves)
        if (formData.startDate && formData.endDate) {
          let current = dayjs(formData.startDate);
          const end = dayjs(formData.endDate);
          while (current.isBefore(end) || current.isSame(end, 'day')) {
            await addDoc(collection(firestore, 'attendance_records'), {
              staffId: staff.id,
              staffName: staff.name,
              date: current.format('YYYY-MM-DD'),
              status: 'leave',
              leaveType: 'full_day',
              notes: formData.notes,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            current = current.add(1, 'day');
          }
        }
        for (const hd of formData.halfDays) {
          if (hd.date) {
            await addDoc(collection(firestore, 'attendance_records'), {
              staffId: staff.id,
              staffName: staff.name,
              date: hd.date,
              status: 'leave',
              leaveType: 'half_day',
              checkIn: hd.checkIn || null,
              checkOut: hd.checkOut || null,
              notes: hd.notes,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        }
        toast.success('Custom leave records created successfully');
      } else {
        // Handle single-day attendance
        const attendanceData = {
          staffId: staff.id,
          staffName: staff.name,
          date: selectedDate,
          status: determineStatus(),
          checkIn: (formData.status === 'absent' || 
                   (formData.status === 'leave' && formData.leaveType === 'full_day')) 
                   ? null : (formData.checkIn || null),
          checkOut: (formData.status === 'absent' || 
                    (formData.status === 'leave' && formData.leaveType === 'full_day')) 
                    ? null : (formData.checkOut || null),
          totalHours: calculateTotalHours(),
          isLate: isLate(),
          notes: formData.notes,
          leaveType: formData.status === 'leave' ? formData.leaveType : null,
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
        <div className="p-4 space-y-4 h-[70vh] overflow-y-auto">
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
              <button
                type="button"
                onClick={() => handleInputChange('customLeave', !formData.customLeave)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  formData.customLeave
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                } col-span-2`}
              >
                Custom Leave (Multi-day/Half-day)
              </button>
            </div>
          </div>

          {/* Custom Leave Fields */}
          {formData.customLeave && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date (Full Days)
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Full Days)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (for full days)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Half Day Leaves</h3>
                  <button
                    onClick={addHalfDay}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Add Half Day
                  </button>
                </div>
                {formData.halfDays.map((hd, index) => (
                  <div key={index} className="border border-gray-200 p-3 rounded-lg mb-2 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Date</label>
                      <input
                        type="date"
                        value={hd.date}
                        onChange={(e) => handleHalfDayChange(index, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Check In</label>
                        <input
                          type="time"
                          value={hd.checkIn}
                          onChange={(e) => handleHalfDayChange(index, 'checkIn', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Check Out</label>
                        <input
                          type="time"
                          value={hd.checkOut}
                          onChange={(e) => handleHalfDayChange(index, 'checkOut', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Notes</label>
                      <textarea
                        value={hd.notes}
                        onChange={(e) => handleHalfDayChange(index, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeHalfDay(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 p-3 rounded-lg space-y-1">
                <p className="text-sm text-gray-700">Used leaves this month: {usedLeaves.toFixed(1)} / 4</p>
                <p className="text-sm text-gray-700">Proposed leave: {proposedLeaves.toFixed(1)} days</p>
                {usedLeaves + proposedLeaves > 4 && (
                  <p className="text-sm text-red-600">Warning: This will exceed allocated leaves by {(usedLeaves + proposedLeaves - 4).toFixed(1)} days, which may affect next month's allocation.</p>
                )}
              </div>
            </div>
          )}

          {/* Time Inputs - Only show for present, half_day, or half day leave */}
          {!formData.customLeave && (formData.status === 'present' || formData.status === 'half_day' || 
            (formData.status === 'leave' && formData.leaveType === 'half_day')) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check In Time
                  {formData.status === 'leave' && formData.leaveType === 'half_day' && (
                    <span className="text-xs text-gray-500 ml-1">(Required for half day leave)</span>
                  )}
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
                  {formData.status === 'leave' && formData.leaveType === 'half_day' && (
                    <span className="text-xs text-gray-500 ml-1">(Required for half day leave)</span>
                  )}
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
          )}
          
          {/* Absent/Leave Message */}
          {!formData.customLeave && (formData.status === 'absent' || 
            (formData.status === 'leave' && formData.leaveType === 'full_day')) && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {formData.status === 'absent' 
                  ? 'No check-in/check-out time required for absent status.'
                  : 'No check-in/check-out time required for full day leave.'
                }
              </p>
            </div>
          )}

          {/* Leave Type Selection */}
          {!formData.customLeave && formData.status === 'leave' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Leave Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'full_day', label: 'Full Day Leave', description: 'No check-in/check-out required' },
                  { value: 'half_day', label: 'Half Day Leave', description: 'Requires check-in or check-out time' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleInputChange('leaveType', option.value)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors text-left ${
                      formData.leaveType === option.value
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Calculated Fields */}
          {!formData.customLeave && (formData.checkIn || formData.checkOut || formData.status === 'leave' || formData.status === 'absent') && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {formData.status !== 'leave' && formData.status !== 'absent' && (formData.checkIn || formData.checkOut) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Hours:</span>
                  <span className="font-medium">{calculateTotalHours()} hours</span>
                </div>
              )}
              {formData.checkIn && formData.status !== 'leave' && formData.status !== 'absent' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Late Arrival:</span>
                  <span className={`font-medium ${isLate() ? 'text-red-600' : 'text-green-600'}`}>
                    {isLate() ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {formData.status === 'leave' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Leave Type:</span>
                  <span className="font-medium text-blue-600">
                    {formData.leaveType === 'full_day' ? 'Full Day Leave' : 'Half Day Leave'}
                  </span>
                </div>
              )}
              {formData.status === 'absent' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-red-600">Absent - No time tracking</span>
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