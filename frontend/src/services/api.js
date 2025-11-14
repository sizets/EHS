import { toast } from "react-toastify";

export const API_BASE = "http://localhost:8081/api";

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
                ...(options.headers || {})
            }
        });

        // Try to parse JSON response
        let data = {};
        try {
            data = await res.json();
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            // If parsing fails, check if response is not ok
            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
            }
        }

        // Handle 401 Unauthorized - token is invalid or expired
        if (res.status === 401) {
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            
            // Only redirect if not already on a public route
            const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
            const currentPath = window.location.pathname;
            
            if (!publicRoutes.includes(currentPath)) {
                // Show a toast notification
                toast.error('Your session has expired. Please login again.');
                // Redirect to login page
                window.location.href = '/login';
            }
            
            // Throw error with appropriate message
            const errorMessage = data.error || data.message || 'Token is not valid or expired';
            throw new Error(errorMessage);
        }

        if (!res.ok) {
            // Handle different error response formats
            const errorMessage = data.error || data.message || `Request failed with status ${res.status}`;
            console.error('API Error Response:', { status: res.status, data });
            throw new Error(errorMessage);
        }

        return data;
    } catch (error) {
        // Re-throw with more context if it's a network error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error - please check if the server is running');
        }
        throw error;
    }
}

export const hmsApi = {
    // Auth
    login: (body) => request('/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body) => request('/register', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/logout', { method: 'GET' }),
    getProfile: () => request('/profile'),
    forgotPassword: (body) => request('/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body) => request('/reset-password', { method: 'POST', body: JSON.stringify(body) }),

    // Dashboard
    getSummary: () => request('/dashboard/summary'),

    // Patients
    listPatients: (query = '') => request(`/patients${query ? `?${query}` : ''}`),
    createPatient: (body) => request('/patients', { method: 'POST', body: JSON.stringify(body) }),
    updatePatient: (id, body) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),

    // Doctors
    listDoctors: (query = '') => request(`/doctors${query ? `?${query}` : ''}`),
    createDoctor: (body) => request('/doctors', { method: 'POST', body: JSON.stringify(body) }),
    updateDoctor: (id, body) => request(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDoctor: (id) => request(`/doctors/${id}`, { method: 'DELETE' }),

    // Appointment Management
    getAllAppointments: () => request('/appointments'),
    getAppointmentById: (id) => request(`/appointments/${id}`),
    createAppointment: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
    updateAppointmentStatus: (id, body) => request(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),
    getAppointmentsByPatient: (patientId) => request(`/appointments/patient/${patientId}`),
    getAppointmentsByDoctor: (doctorId) => request(`/appointments/doctor/${doctorId}`),
    getAvailableDoctorsForAppointment: (date, time) => {
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (time) params.append('time', time);
        return request(`/appointments/available-doctors${params.toString() ? `?${params.toString()}` : ''}`);
    },
    getAvailableTimeSlots: (doctorId, date) => {
        const params = new URLSearchParams();
        if (doctorId) params.append('doctorId', doctorId);
        if (date) params.append('date', date);
        return request(`/appointments/available-slots${params.toString() ? `?${params.toString()}` : ''}`);
    },
    // Patient-specific appointment methods
    getMyAppointments: () => request('/my-appointments'),
    // Doctor-specific appointment methods
    getMyAppointmentsDoctor: () => request('/my-appointments-doctor'),

    // User Management (Admin only)
    getAllUsers: () => request('/users'),
    getUsersByRole: (role) => request(`/users/role/${role}`),
    getUserById: (id) => request(`/users/${id}`),
    getPendingPatients: () => request('/users/pending'),
    createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    approvePatient: (id, status) => request(`/users/${id}/approve`, { method: 'PUT', body: JSON.stringify({ status }) }),
    deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

    // Department Management (Admin only)
    getAllDepartments: () => request('/departments'),
    getDepartmentById: (id) => request(`/departments/${id}`),
    createDepartment: (body) => request('/departments', { method: 'POST', body: JSON.stringify(body) }),
    updateDepartment: (id, body) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),

    // Assignment Management (Admin only)
    getAllAssignments: () => request('/assignments'),
    getAssignmentById: (id) => request(`/assignments/${id}`),
    createAssignment: (body) => request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
    updateAssignmentStatus: (id, body) => request(`/assignments/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteAssignment: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),
    getAssignmentsByPatient: (patientId) => request(`/assignments/patient/${patientId}`),
    getAssignmentsByDoctor: (doctorId) => request(`/assignments/doctor/${doctorId}`),
    getAvailableDoctors: () => request('/assignments/available-doctors'),

    // Doctor-specific assignment methods
    getMyAssignments: () => request('/my-assignments'),
    updateMyAssignmentStatus: (id, body) => request(`/my-assignments/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
    // Patient-specific assignment methods
    getMyAssignmentsPatient: () => request('/my-assignments-patient'),

    // Diagnosis Management (Doctor and Admin)
    getAllDiagnoses: () => request('/diagnoses'),
    getDiagnosisById: (id) => request(`/diagnoses/${id}`),
    getDiagnosesByAssignment: (assignmentId) => request(`/diagnoses/assignment/${assignmentId}`),
    getDiagnosesByAppointment: (appointmentId) => request(`/diagnoses/appointment/${appointmentId}`),
    createDiagnosis: (body) => request('/diagnoses', { method: 'POST', body: JSON.stringify(body) }),
    updateDiagnosis: (id, body) => request(`/diagnoses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDiagnosis: (id) => request(`/diagnoses/${id}`, { method: 'DELETE' }),

    // Test Management (Doctor and Admin)
    getAllTests: () => request('/tests'),
    getTestById: (id) => request(`/tests/${id}`),
    getTestsByPatient: (patientId) => request(`/tests/patient/${patientId}`),
    createTest: (body) => request('/tests', { method: 'POST', body: JSON.stringify(body) }),
    updateTest: (id, body) => request(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),

    // Profile management
    updateProfile: (body) => request('/profile', { method: 'PUT', body: JSON.stringify(body) }),

    // Billing/Charges Management
    getAllCharges: () => request('/charges'),
    getChargesByPatient: (patientId) => request(`/charges/patient/${patientId}`),
    getChargesByAssignment: (assignmentId) => request(`/charges/assignment/${assignmentId}`),
    createCharge: (body) => request('/charges', { method: 'POST', body: JSON.stringify(body) }),
    updateChargeStatus: (id, body) => request(`/charges/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteCharge: (id) => request(`/charges/${id}`, { method: 'DELETE' }),
    // Patient-specific billing methods
    getMyCharges: () => request('/my-charges'),
};
