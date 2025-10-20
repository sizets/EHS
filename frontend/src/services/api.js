export const API_BASE = "http://localhost:4000/api";

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

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            // Handle different error response formats
            const errorMessage = data.error || data.message || `Request failed with status ${res.status}`;
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

    // Appointments
    listAppointments: () => request('/appointments'),
    createAppointment: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
    updateAppointmentStatus: (id, status) => request(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

    // User Management (Admin only)
    getAllUsers: () => request('/users'),
    getUsersByRole: (role) => request(`/users/role/${role}`),
    getUserById: (id) => request(`/users/${id}`),
    createUser: (body) => request('/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

    // Department Management (Admin only)
    getAllDepartments: () => request('/departments'),
    getDepartmentById: (id) => request(`/departments/${id}`),
    createDepartment: (body) => request('/departments', { method: 'POST', body: JSON.stringify(body) }),
    updateDepartment: (id, body) => request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
};
