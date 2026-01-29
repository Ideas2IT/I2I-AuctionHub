import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Attempting login to:', `${API_URL}/auth/login`);
      const response = await axios.post(`${API_URL}/auth/login`, {
        username: username.trim(),
        password: password
      });

      console.log('Login response:', response.data);

      if (response.data.success) {
        // Store session in localStorage
        localStorage.setItem('sessionId', response.data.sessionId);
        localStorage.setItem('username', response.data.username);
        localStorage.setItem('role', response.data.role);
        localStorage.setItem('expiresAt', response.data.expiresAt);
        
        onLogin({
          sessionId: response.data.sessionId,
          username: response.data.username,
          role: response.data.role
        });
      } else {
        setError('Login failed. Invalid response from server.');
      }
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Login failed. ';
      
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error') || err.message.includes('Failed to fetch')) {
        errorMessage += 'Cannot connect to server. Please make sure the backend server is running on port 5000.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Please check if the server is running.';
      }
      
      setError(errorMessage);
      console.error('Full error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>ICL Tournament {new Date().getFullYear()}</h1>
          <h2>Auction System</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (admin or user)"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

