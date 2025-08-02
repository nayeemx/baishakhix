import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  where,
  orderBy
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { FiX, FiPrinter, FiCalendar, FiClock } from 'react-icons/fi';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const AttendanceModal = ({ staff, selectedMonth, onClose }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [staff.id, currentMonth]);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const monthStart = dayjs(currentMonth).startOf('month').format('YYYY-MM-DD');
      const monthEnd = dayjs(currentMonth).endOf('month').format('YYYY-MM-DD');

      const attendanceQuery = query(
        collection(firestore, 'attendance_records'),
        where('staffId', '==', staff.id),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd),
        orderBy('date', 'asc')
      );

      const attendanceSnapshot = await getDocs(attendanceQuery);
      const records = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceForDate = (date) => {
    const record = attendanceRecords.find(record => record.date === date);
    if (!record) return null;
    return record;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-500';
      case 'leave':
        return 'bg-yellow-500';
      case 'half_day':
        return 'bg-orange-500';
      case 'absent':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'leave':
        return 'Leave';
      case 'half_day':
        return 'Half Day';
      case 'absent':
        return 'Absent';
      default:
        return '';
    }
  };

  const generateCalendarDays = () => {
    const startOfMonth = dayjs(currentMonth).startOf('month');
    const endOfMonth = dayjs(currentMonth).endOf('month');
    const startOfWeek = startOfMonth.startOf('week');
    const endOfWeek = endOfMonth.endOf('week');

    const days = [];
    let currentDay = startOfWeek;

    while (currentDay.isBefore(endOfWeek) || currentDay.isSame(endOfWeek, 'day')) {
      days.push(currentDay.format('YYYY-MM-DD'));
      currentDay = currentDay.add(1, 'day');
    }

    return days;
  };

  const calculateMonthlyStats = () => {
    const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
    const absentDays = attendanceRecords.filter(record => record.status === 'absent').length;
    const leaveDays = attendanceRecords.filter(record => record.status === 'leave').length;
    const halfDays = attendanceRecords.filter(record => record.status === 'half_day').length;
    const lateDays = attendanceRecords.filter(record => record.isLate).length;

    return {
      presentDays,
      absentDays,
      leaveDays,
      halfDays,
      lateDays
    };
  };

  const getChartData = () => {
    const stats = calculateMonthlyStats();
    return [
      { name: 'Present', value: stats.presentDays, color: '#10B981' },
      { name: 'Absent', value: stats.absentDays, color: '#EF4444' },
      { name: 'Leave', value: stats.leaveDays, color: '#F59E0B' },
      { name: 'Half Day', value: stats.halfDays, color: '#F97316' },
      { name: 'Late', value: stats.lateDays, color: '#8B5CF6' }
    ].filter(item => item.value > 0);
  };

  const navigateMonth = (direction) => {
    const newMonth = direction === 'next' 
      ? dayjs(currentMonth).add(1, 'month').format('YYYY-MM')
      : dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM');
    setCurrentMonth(newMonth);
  };

  const printReport = () => {
    window.print();
  };

  const calendarDays = generateCalendarDays();
  const stats = calculateMonthlyStats();
  const chartData = getChartData();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
              <span className="text-lg font-medium text-gray-700">
                {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{staff.name}</h2>
              <p className="text-sm text-gray-600">{staff.role?.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <FiCalendar className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {dayjs(currentMonth).format('MMMM YYYY')}
          </h3>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <FiCalendar className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Calendar View</h4>
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                    {calendarDays.map((date, index) => {
                      const attendance = getAttendanceForDate(date);
                      const isCurrentMonth = dayjs(date).format('YYYY-MM') === currentMonth;
                      const isToday = date === dayjs().format('YYYY-MM-DD');
                      
                      return (
                        <div
                          key={index}
                          className={`min-h-[40px] flex items-center justify-center text-sm border border-gray-100 ${
                            !isCurrentMonth ? 'text-gray-300' : 'text-gray-900'
                          } ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}
                        >
                          <div className="text-center">
                            <div className="font-medium">{dayjs(date).format('D')}</div>
                            {attendance && (
                              <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${getStatusColor(attendance.status)}`} 
                                   title={getStatusText(attendance.status)}></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-6">
                {/* Monthly Summary */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Monthly Summary</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm text-gray-600">Present Days</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{stats.presentDays}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                        <span className="text-sm text-gray-600">Absent Days</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{stats.absentDays}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                        <span className="text-sm text-gray-600">Leave Days</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{stats.leaveDays}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                        <span className="text-sm text-gray-600">Late Arrivals</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{stats.lateDays}</span>
                    </div>
                  </div>
                </div>

                {/* Attendance Overview Chart */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Attendance Overview</h4>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-2">
                      {chartData.map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: item.color }}
                          ></div>
                          <span className="text-xs text-gray-600">{item.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={printReport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <FiPrinter className="h-4 w-4 mr-2" />
              Print Report
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModal; 