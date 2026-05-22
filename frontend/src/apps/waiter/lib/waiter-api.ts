import axios from 'axios';

const waiterApi = axios.create({
  baseURL: '/api',
  withCredentials: false,
});

waiterApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('waiter_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

waiterApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('waiter_token');
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

export default waiterApi;
