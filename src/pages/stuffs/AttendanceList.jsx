import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  where,
  doc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';
import { 
  FiUsers, 
  FiClock, 
  FiCalendar, 
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiUser,
  FiEye,
  FiPrinter,
  FiDownload
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import AppLoader from '../../components/AppLoader';
import { usePermissions, PERMISSION_PAGES } from '../../utils/permissions';
import dayjs from 'dayjs';
import AttendanceModal from '../../components/StaffComponents/AttendanceModal';

const AttendanceList = () => {
  const { hasPermission } = usePermissions();
  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Summary data
  const [summary, setSummary] = useState({
    totalStaff: 0,
    presentToday: 0,
    onLeave: 0,
    halfDay: 0,
    absent: 0,
    late: 0
  });

  // Fetch staff and attendance data
  useEffect(() => {
    fetchStaffAndAttendance();
  }, [selectedDate, selectedMonth]);

  // Real-time listeners
  useEffect(() => {
    const usersQuery = query(collection(firestore, 'users'));
    const attendanceQuery = query(
      collection(firestore, 'attendance_records'),
      where('date', '==', selectedDate)
    );

    const unsubscribeUsers = onSnapshot(usersQuery, () => {
      fetchStaffAndAttendance();
    });

    const unsubscribeAttendance = onSnapshot(attendanceQuery, () => {
      fetchStaffAndAttendance();
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAttendance();
    };
  }, [selectedDate]);

  const fetchStaffAndAttendance = async () => {
    try {
      setLoading(true);
      
      // Fetch all staff members (excluding super_user and regular users)
      const usersQuery = query(collection(firestore, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const staffData = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => 
          user.role !== 'user' && 
          user.role !== 'super_user' && 
          user.status === 'verified'
        );

      setStaffList(staffData);

      // Fetch today's attendance records
      const attendanceQuery = query(
        collection(firestore, 'attendance_records'),
        where('date', '==', selectedDate)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setAttendanceRecords(attendanceData);

      // Calculate summary
      calculateSummary(staffData, attendanceData);

    } catch (error) {
      console.error('Error fetching staff and attendance:', error);
      toast.error('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (staff, attendance) => {
    const todayAttendance = attendance.filter(record => record.date === selectedDate);
    
    const summary = {
      totalStaff: staff.length,
      presentToday: todayAttendance.filter(record => record.status === 'present').length,
      onLeave: todayAttendance.filter(record => record.status === 'leave').length,
      halfDay: todayAttendance.filter(record => record.status === 'half_day').length,
      absent: staff.length - todayAttendance.length,
      late: todayAttendance.filter(record => record.isLate).length
    };

    setSummary(summary);
  };

  const handleCheckIn = async (staffId) => {
    if (!hasPermission(PERMISSION_PAGES.ATTENDANCE, 'create')) {
      toast.error('You do not have permission to mark attendance');
      return;
    }

    try {
      setProcessing(true);
      const now = new Date();
      const checkInTime = now.toTimeString().split(' ')[0];
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);

      // Check if attendance record already exists for today
      const existingRecord = attendanceRecords.find(record => 
        record.staffId === staffId && record.date === selectedDate
      );

      if (existingRecord) {
        toast.error('Attendance already marked for today');
        return;
      }

      await addDoc(collection(firestore, 'attendance_records'), {
        staffId,
        staffName: staffList.find(staff => staff.id === staffId)?.name,
        date: selectedDate,
        checkIn: checkInTime,
        checkOut: null,
        status: 'present',
        isLate,
        totalHours: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Check-in recorded successfully');
    } catch (error) {
      console.error('Error recording check-in:', error);
      toast.error('Failed to record check-in');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async (staffId) => {
    if (!hasPermission(PERMISSION_PAGES.ATTENDANCE, 'edit')) {
      toast.error('You do not have permission to update attendance');
      return;
    }

    try {
      setProcessing(true);
      const now = new Date();
      const checkOutTime = now.toTimeString().split(' ')[0];

      const existingRecord = attendanceRecords.find(record => 
        record.staffId === staffId && record.date === selectedDate
      );

      if (!existingRecord) {
        toast.error('No check-in record found for today');
        return;
      }

      if (existingRecord.checkOut) {
        toast.error('Check-out already recorded for today');
        return;
      }

      // Calculate total hours
      const checkInTime = new Date(`2000-01-01T${existingRecord.checkIn}`);
      const checkOutTimeObj = new Date(`2000-01-01T${checkOutTime}`);
      const totalHours = (checkOutTimeObj - checkInTime) / (1000 * 60 * 60);

      // Determine if it's a half day (less than 6 hours)
      const status = totalHours < 6 ? 'half_day' : 'present';

      await updateDoc(doc(firestore, 'attendance_records', existingRecord.id), {
        checkOut: checkOutTime,
        totalHours: Math.round(totalHours * 100) / 100,
        status,
        updatedAt: serverTimestamp()
      });

      toast.success('Check-out recorded successfully');
    } catch (error) {
      console.error('Error recording check-out:', error);
      toast.error('Failed to record check-out');
    } finally {
      setProcessing(false);
    }
  };

  const markLeave = async (staffId) => {
    if (!hasPermission(PERMISSION_PAGES.ATTENDANCE, 'create')) {
      toast.error('You do not have permission to mark attendance');
      return;
    }

    try {
      setProcessing(true);
      
      const existingRecord = attendanceRecords.find(record => 
        record.staffId === staffId && record.date === selectedDate
      );

      if (existingRecord) {
        toast.error('Attendance already marked for today');
        return;
      }

      await addDoc(collection(firestore, 'attendance_records'), {
        staffId,
        staffName: staffList.find(staff => staff.id === staffId)?.name,
        date: selectedDate,
        checkIn: null,
        checkOut: null,
        status: 'leave',
        isLate: false,
        totalHours: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Leave marked successfully');
    } catch (error) {
      console.error('Error marking leave:', error);
      toast.error('Failed to mark leave');
    } finally {
      setProcessing(false);
    }
  };

  const openAttendanceModal = (staff) => {
    setSelectedStaff(staff);
    setShowAttendanceModal(true);
  };

  const getAttendanceStatus = (staffId) => {
    const record = attendanceRecords.find(record => record.staffId === staffId);
    if (!record) return { status: 'absent', color: 'red', text: 'Absent' };
    
    switch (record.status) {
      case 'present':
        return { status: 'present', color: 'green', text: 'Present' };
      case 'leave':
        return { status: 'leave', color: 'yellow', text: 'On Leave' };
      case 'half_day':
        return { status: 'half_day', color: 'orange', text: 'Half Day' };
      default:
        return { status: 'absent', color: 'red', text: 'Absent' };
    }
  };

  const getMonthlyAttendance = (staffId) => {
    const monthStart = dayjs(selectedMonth).startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs(selectedMonth).endOf('month').format('YYYY-MM-DD');
    
    const monthRecords = attendanceRecords.filter(record => 
      record.staffId === staffId && 
      record.date >= monthStart && 
      record.date <= monthEnd
    );

    const presentDays = monthRecords.filter(record => record.status === 'present').length;
    const totalDays = dayjs(selectedMonth).daysInMonth();
    const percentage = Math.round((presentDays / totalDays) * 100);

    return { presentDays, totalDays, percentage };
  };

  const getLeaveBalance = () => {
    // This would typically come from a leave management system
    // For now, returning mock data
    return { used: 4, total: 4, remaining: 0 };
  };

  if (loading) return <AppLoader />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Attendance Dashboard</h1>
          <p className="text-gray-600">Today: {dayjs(selectedDate).format('dddd, MMM DD, YYYY')}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalStaff}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FiCheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Present Today</p>
                <p className="text-2xl font-bold text-gray-900">{summary.presentToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FiCalendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">On Leave</p>
                <p className="text-2xl font-bold text-gray-900">{summary.onLeave}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FiClock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Half Day</p>
                <p className="text-2xl font-bold text-gray-900">{summary.halfDay}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <FiXCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Absent</p>
                <p className="text-2xl font-bold text-gray-900">{summary.absent}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FiAlertTriangle className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Late</p>
                <p className="text-2xl font-bold text-gray-900">{summary.late}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Attendance Table */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Staff Attendance Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Today's Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check Out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Attendance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffList.map((staff) => {
                  const attendanceStatus = getAttendanceStatus(staff.id);
                  const monthlyAttendance = getMonthlyAttendance(staff.id);
                  const leaveBalance = getLeaveBalance(staff.id);
                  const todayRecord = attendanceRecords.find(record => record.staffId === staff.id);

                  return (
                    <tr key={staff.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.role?.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-${attendanceStatus.color}-100 text-${attendanceStatus.color}-800`}>
                          {attendanceStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {todayRecord?.checkIn || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {todayRecord?.checkOut || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {monthlyAttendance.percentage}% ({monthlyAttendance.presentDays}/{monthlyAttendance.totalDays} days)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={leaveBalance.remaining === 0 ? 'text-red-600' : 'text-green-600'}>
                          {leaveBalance.remaining} left {leaveBalance.used}/{leaveBalance.total} used
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {!todayRecord && (
                            <>
                              <button
                                onClick={() => handleCheckIn(staff.id)}
                                disabled={processing}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                Check In
                              </button>
                              <button
                                onClick={() => markLeave(staff.id)}
                                disabled={processing}
                                className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                              >
                                Mark Leave
                              </button>
                            </>
                          )}
                          {todayRecord && !todayRecord.checkOut && todayRecord.status === 'present' && (
                            <button
                              onClick={() => handleCheckOut(staff.id)}
                              disabled={processing}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            >
                              Check Out
                            </button>
                          )}
                          <button
                            onClick={() => openAttendanceModal(staff)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Staff Attendance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((staff) => {
            const monthlyAttendance = getMonthlyAttendance(staff.id);
            
            return (
              <div key={staff.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-lg font-medium text-gray-700">
                      {staff.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">{staff.name}</h3>
                    <p className="text-sm text-gray-600">{staff.role?.replace('_', ' ').toUpperCase()}</p>
                  </div>
                </div>
                
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-gray-900">{monthlyAttendance.percentage}%</div>
                  <div className="text-sm text-gray-600">Attendance Rate</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-100 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-800">{monthlyAttendance.presentDays}</div>
                    <div className="text-xs text-green-600">Present</div>
                  </div>
                  <div className="bg-yellow-100 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-yellow-800">4</div>
                    <div className="text-xs text-yellow-600">Leaves</div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-800">3</div>
                    <div className="text-xs text-red-600">Absent</div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-800">0</div>
                    <div className="text-xs text-blue-600">Left</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && selectedStaff && (
        <AttendanceModal
          staff={selectedStaff}
          selectedMonth={selectedMonth}
          onClose={() => setShowAttendanceModal(false)}
        />
      )}
    </div>
  );
};

export default AttendanceList;