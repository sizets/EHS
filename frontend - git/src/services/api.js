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
    register: (body) => request('/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/login', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request('/logout', { method: 'GET' }),


};
