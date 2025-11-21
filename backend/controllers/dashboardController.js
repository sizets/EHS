const { ObjectId } = require('mongodb');
const connectDB = require('../mongo');

const dashboardController = {
    // Get dashboard statistics (Admin only)
    getDashboardStats: async (req, res) => {
        try {
            const dbInstance = await connectDB();

            // Get current date and calculate date ranges
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
            startOfWeek.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfYear = new Date(now.getFullYear(), 0, 1);

            // Get last 6 months for trend data
            const last6Months = [];
            for (let i = 5; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                last6Months.push({
                    month: date.toLocaleString('default', { month: 'short' }),
                    year: date.getFullYear(),
                    start: new Date(date.getFullYear(), date.getMonth(), 1),
                    end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
                });
            }

            // Total counts
            const [
                totalDoctors,
                totalPatients,
                totalAppointments,
                totalAssignments,
                totalDepartments,
                totalCharges
            ] = await Promise.all([
                dbInstance.collection('users').countDocuments({ role: 'doctor' }),
                dbInstance.collection('users').countDocuments({ role: 'patient' }),
                dbInstance.collection('appointments').countDocuments({}),
                dbInstance.collection('assignments').countDocuments({}),
                dbInstance.collection('departments').countDocuments({}),
                dbInstance.collection('charges').countDocuments({})
            ]);

            // Today's counts
            const [
                appointmentsToday,
                assignmentsToday,
                chargesToday
            ] = await Promise.all([
                dbInstance.collection('appointments').countDocuments({
                    createdAt: { $gte: startOfToday }
                }),
                dbInstance.collection('assignments').countDocuments({
                    createdAt: { $gte: startOfToday }
                }),
                dbInstance.collection('charges').countDocuments({
                    createdAt: { $gte: startOfToday }
                })
            ]);

            // Revenue calculations
            const allCharges = await dbInstance.collection('charges').find({}).toArray();
            const totalRevenue = allCharges
                .filter(c => c.status === 'paid')
                .reduce((sum, charge) => sum + (charge.amount || 0), 0);
            
            const pendingRevenue = allCharges
                .filter(c => c.status === 'pending')
                .reduce((sum, charge) => sum + (charge.amount || 0), 0);

            const revenueToday = allCharges
                .filter(c => c.status === 'paid' && c.updatedAt >= startOfToday)
                .reduce((sum, charge) => sum + (charge.amount || 0), 0);

            const revenueThisMonth = allCharges
                .filter(c => c.status === 'paid' && c.updatedAt >= startOfMonth)
                .reduce((sum, charge) => sum + (charge.amount || 0), 0);

            // Appointments by status
            const appointmentsByStatus = await dbInstance.collection('appointments')
                .aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
                .toArray();

            const appointmentStatusMap = {};
            appointmentsByStatus.forEach(item => {
                appointmentStatusMap[item._id || 'pending'] = item.count;
            });

            // Assignments by status
            const assignmentsByStatus = await dbInstance.collection('assignments')
                .aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
                .toArray();

            const assignmentStatusMap = {};
            assignmentsByStatus.forEach(item => {
                assignmentStatusMap[item._id || 'pending'] = item.count;
            });

            // Revenue by month (last 6 months)
            const revenueByMonth = await Promise.all(
                last6Months.map(async (monthData) => {
                    const monthCharges = await dbInstance.collection('charges')
                        .find({
                            status: 'paid',
                            updatedAt: {
                                $gte: monthData.start,
                                $lte: monthData.end
                            }
                        })
                        .toArray();
                    
                    const revenue = monthCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
                    return {
                        month: monthData.month,
                        revenue: revenue
                    };
                })
            );

            // Appointments by month (last 6 months)
            const appointmentsByMonth = await Promise.all(
                last6Months.map(async (monthData) => {
                    const count = await dbInstance.collection('appointments')
                        .countDocuments({
                            createdAt: {
                                $gte: monthData.start,
                                $lte: monthData.end
                            }
                        });
                    return {
                        month: monthData.month,
                        count: count
                    };
                })
            );

            // Assignments by month (last 6 months)
            const assignmentsByMonth = await Promise.all(
                last6Months.map(async (monthData) => {
                    const count = await dbInstance.collection('assignments')
                        .countDocuments({
                            createdAt: {
                                $gte: monthData.start,
                                $lte: monthData.end
                            }
                        });
                    return {
                        month: monthData.month,
                        count: count
                    };
                })
            );

            // Top departments by doctor count
            const doctorsByDepartment = await dbInstance.collection('users')
                .aggregate([
                    {
                        $match: { role: 'doctor', department: { $exists: true, $ne: null } }
                    },
                    {
                        $group: {
                            _id: '$department',
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { count: -1 }
                    },
                    {
                        $limit: 5
                    }
                ])
                .toArray();

            // Get department names
            const departmentIds = doctorsByDepartment.map(d => d._id);
            const departments = await dbInstance.collection('departments')
                .find({ _id: { $in: departmentIds } })
                .toArray();

            const departmentMap = {};
            departments.forEach(dept => {
                departmentMap[dept._id.toString()] = dept.name;
            });

            const topDepartments = doctorsByDepartment.map(dept => ({
                departmentId: dept._id.toString(),
                departmentName: departmentMap[dept._id.toString()] || 'Unknown',
                doctorCount: dept.count
            }));

            // Charges by status
            const chargesByStatus = await dbInstance.collection('charges')
                .aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            totalAmount: { $sum: '$amount' }
                        }
                    }
                ])
                .toArray();

            const chargeStatusMap = {};
            chargesByStatus.forEach(item => {
                chargeStatusMap[item._id || 'pending'] = {
                    count: item.count,
                    amount: item.totalAmount || 0
                };
            });

            res.json({
                summary: {
                    totalDoctors,
                    totalPatients,
                    totalAppointments,
                    totalAssignments,
                    totalDepartments,
                    totalCharges
                },
                today: {
                    appointments: appointmentsToday,
                    assignments: assignmentsToday,
                    charges: chargesToday,
                    revenue: revenueToday
                },
                revenue: {
                    total: totalRevenue,
                    pending: pendingRevenue,
                    thisMonth: revenueThisMonth,
                    today: revenueToday
                },
                appointments: {
                    byStatus: appointmentStatusMap,
                    byMonth: appointmentsByMonth
                },
                assignments: {
                    byStatus: assignmentStatusMap,
                    byMonth: assignmentsByMonth
                },
                revenueByMonth: revenueByMonth,
                topDepartments: topDepartments,
                charges: {
                    byStatus: chargeStatusMap
                }
            });

        } catch (error) {
            console.error('Get dashboard stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = dashboardController;

