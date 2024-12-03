import axios from 'axios';

console.log('API URL:', process.env.REACT_APP_API_URL);

// Create an Axios instance
const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// this is the newly added fetchCsrfToken function
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

  let csrfToken = localStorage.getItem('CSRF_TOKEN');
  if (!csrfToken) {
    csrfToken = await fetchCsrfToken();  // Fetch CSRF token if not present
  }

  if (csrfToken) {
    config.headers['X-XSRF-TOKEN'] = csrfToken;
  }

  console.log("X-XSRF-TOKEN:", csrfToken);
  return config;
}, error => {
  return Promise.reject(error);
});

// Add a response interceptor to handle CSRF token expiration
api.interceptors.response.use(response => {
  return response; // If response is successful, just return it
}, async error => {
  const originalRequest = error.config;

  // Check if error is due to CSRF token expiry (typically 403 or a specific error message)
  if (error.response && error.response.status === 403 && !originalRequest._retry) {
    originalRequest._retry = true;  // Prevent infinite retry loops

    try {
      const newCsrfToken = await fetchCsrfToken();  // Fetch a new CSRF token
      originalRequest.headers['X-XSRF-TOKEN'] = newCsrfToken;  // Update the header with new token

      // Retry the original request with the new CSRF token
      return api(originalRequest);
    } catch (tokenRefreshError) {
      return Promise.reject(tokenRefreshError); // If token refresh fails, reject the promise
    }
  }

  return Promise.reject(error); // If error is not due to CSRF, reject it as usual
});

export default api;