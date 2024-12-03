import axios from 'axios';

// Create an Axios instance
const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Function to fetch a new CSRF token and store it
async function fetchCsrfToken() {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/csrf-token`, { withCredentials: true });
    const csrfToken = response.data.token;
    localStorage.setItem('CSRF_TOKEN', csrfToken);
    return csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token', error);
    throw error;
  }
}

// Add a request interceptor to include JWT and CSRF tokens
api.interceptors.request.use(async config => {
  const token = localStorage.getItem('JWT_TOKEN');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Always fetch a new CSRF token for mutation requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase())) {
    try {
      const csrfToken = await fetchCsrfToken();
      config.headers['X-XSRF-TOKEN'] = csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token', error);
    }
  } else {
    // For non-mutation requests, use stored token if available
    const csrfToken = localStorage.getItem('CSRF_TOKEN');
    if (csrfToken) {
      config.headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }

  return config;
}, error => {
  return Promise.reject(error);
});

// Add a response interceptor to handle CSRF token expiration
api.interceptors.response.use(response => {
  return response;
}, async error => {
  const originalRequest = error.config;

  // Check if error is due to CSRF token expiry (typically 403)
  if (error.response && error.response.status === 403 && !originalRequest._retry) {
    originalRequest._retry = true;

    try {
      const newCsrfToken = await fetchCsrfToken();
      originalRequest.headers['X-XSRF-TOKEN'] = newCsrfToken;
      return api(originalRequest);
    } catch (tokenRefreshError) {
      return Promise.reject(tokenRefreshError);
    }
  }

  return Promise.reject(error);
});

export default api;
