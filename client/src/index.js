import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

// Attach session to all API requests (players, teams, auction, bundle require auth)
axios.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('sessionId');
  if (sessionId) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${sessionId}`;
  }
  return config;
});

// On 401 (expired/invalid session), clear session and reload so user sees login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url?.includes('/api/') && !error.config?.url?.includes('/api/auth/login') && !error.config?.url?.includes('/api/auth/signup')) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('expiresAt');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

