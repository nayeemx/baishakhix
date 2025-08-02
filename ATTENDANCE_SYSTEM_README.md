# Staff Attendance System

A comprehensive attendance management system built for the Baishakhi application, featuring real-time tracking, detailed analytics, and role-based permissions.

## Features

### 🎯 Core Features
- **Real-time Attendance Tracking**: Live updates for check-ins, check-outs, and leave management
- **Staff Dashboard**: Overview of all staff members with their current attendance status
- **Individual Staff Cards**: Detailed attendance statistics for each staff member
- **Calendar View**: Monthly calendar showing attendance patterns with color coding
- **Attendance Analytics**: Charts and statistics for attendance analysis
- **Role-based Permissions**: Secure access control based on user roles

### 📊 Dashboard Components
1. **Summary Cards**: Quick overview of total staff, present, absent, on leave, half-day, and late arrivals
2. **Staff Attendance Table**: Detailed table with check-in/out times, monthly attendance, and leave balance
3. **Individual Staff Cards**: Visual representation of each staff member's attendance rate
4. **Attendance Modal**: Detailed view with calendar and analytics for individual staff

### 🔐 Security & Permissions
- **Super User**: Full access to manage attendance system (but not included in staff list)
- **Admin/Manager**: Can manage all attendance records
- **Staff**: Can view their own attendance records
- **Firestore Rules**: Secure database access with proper authentication

## Database Structure

### Collections

#### `users` Collection
```javascript
{
  uid: "string",
  name: "string",
  email: "string",
  role: "super_user|admin|manager|sales_man|stock_boy|t_staff|user",
  status: "verified|unverified",
  avatarUrl: "string",
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

#### `attendance_records` Collection
```javascript
{
  staffId: "string",           // Reference to user ID
  staffName: "string",         // Staff member's name
  date: "YYYY-MM-DD",          // Date of attendance
  checkIn: "HH:MM:SS",         // Check-in time (null if on leave)
  checkOut: "HH:MM:SS",        // Check-out time (null if not checked out)
  status: "present|leave|half_day|absent",
  isLate: "boolean",           // True if check-in after 9:00 AM
  totalHours: "number",        // Total hours worked
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

## Usage Instructions

### For Administrators/Managers

1. **Access Attendance Dashboard**
   - Navigate to `/staff/attendance`
   - View overall attendance summary and staff list

2. **Mark Attendance**
   - Click "Check In" for staff who arrive
   - Click "Check Out" when staff leave
   - Click "Mark Leave" for staff on leave

3. **View Detailed Reports**
   - Click the eye icon next to any staff member
   - View calendar with attendance patterns
   - See monthly statistics and charts

### For Staff Members

1. **View Personal Attendance**
   - Access attendance dashboard (if permitted)
   - View your own attendance records
   - Check your monthly attendance rate

## Technical Implementation

### Staff Filtering
The attendance system automatically excludes:
- **super_user**: Developers/system administrators (not regular staff)
- **user**: Regular users without staff roles
- **unverified users**: Users who haven't completed email verification

Only users with roles `admin`, `manager`, `sales_man`, `stock_boy`, and `t_staff` who are verified will appear in the attendance system.

### Components

#### `AttendanceList.jsx`
- Main attendance dashboard component
- Handles real-time data fetching
- Manages attendance operations (check-in, check-out, leave)
- Displays summary cards and staff table

#### `AttendanceModal.jsx`
- Detailed attendance view for individual staff
- Calendar visualization with attendance status
- Monthly statistics and charts
- Print functionality for reports

### Key Functions

#### Attendance Operations
```javascript
// Check-in
handleCheckIn(staffId) // Records check-in time and late status

// Check-out  
handleCheckOut(staffId) // Records check-out and calculates total hours

// Mark Leave
markLeave(staffId) // Records leave for the day
```

#### Data Calculations
```javascript
// Calculate attendance status
getAttendanceStatus(staffId) // Returns status with color coding

// Monthly attendance calculation
getMonthlyAttendance(staffId) // Returns percentage and day counts

// Summary calculations
calculateSummary(staff, attendance) // Updates dashboard summary
```

### Real-time Updates
- Uses Firestore `onSnapshot` listeners
- Automatic refresh when attendance records change
- Live updates across all connected clients

## Permissions System

### Role Hierarchy
1. **Super User**: Full access to manage attendance system (excluded from staff list)
2. **Admin**: Can manage all attendance records
3. **Manager**: Can manage all attendance records
4. **Sales Man**: Limited access (view only)
5. **Stock Boy**: Limited access (view only)
6. **T Staff**: Limited access (view only)
7. **User**: No access to attendance features

### Permission Checks
```javascript
// Check if user can mark attendance
hasPermission(PERMISSION_PAGES.ATTENDANCE, 'create')

// Check if user can edit attendance
hasPermission(PERMISSION_PAGES.ATTENDANCE, 'edit')
```

## Firestore Security Rules

```javascript
// Attendance records: admin/manager/super_user can manage all, staff can view their own
match /attendance_records/{docId} {
  allow read: if request.auth != null && (
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['super_user', 'admin', 'manager'] ||
    resource.data.staffId == request.auth.uid
  );
  allow create, update, delete: if request.auth != null && (
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['super_user', 'admin', 'manager']
  );
}
```

## Installation & Setup

1. **Dependencies**: Ensure all required packages are installed
   ```bash
   npm install dayjs recharts react-icons
   ```

2. **Firestore Rules**: Deploy updated security rules
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Permissions**: Update user roles and permissions in the admin panel

4. **Testing**: Test attendance operations with different user roles

## Future Enhancements

### Planned Features
- **Leave Management System**: Advanced leave request and approval workflow
- **Overtime Tracking**: Automatic overtime calculation and reporting
- **Shift Management**: Multiple shift support with different schedules
- **Mobile App**: Native mobile application for attendance tracking
- **Biometric Integration**: Fingerprint/face recognition for check-in
- **Geolocation**: Location-based attendance verification
- **Email Notifications**: Automated attendance reports and alerts
- **Export Features**: PDF/Excel export of attendance reports

### Technical Improvements
- **Offline Support**: PWA capabilities for offline attendance tracking
- **Performance Optimization**: Caching and pagination for large datasets
- **Advanced Analytics**: Machine learning for attendance pattern analysis
- **API Integration**: REST API for third-party integrations

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check user role and permissions
   - Verify Firestore rules are deployed
   - Ensure user is authenticated

2. **Real-time Updates Not Working**
   - Check Firestore connection
   - Verify onSnapshot listeners are properly set up
   - Check for console errors

3. **Attendance Not Saving**
   - Verify user has create/edit permissions
   - Check Firestore rules
   - Ensure proper data format

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'attendance:*');
```

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Compatibility**: React 19+, Firebase 11+, Tailwind CSS 4+ 