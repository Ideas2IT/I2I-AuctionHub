import React, { useState } from 'react';
import axios from 'axios';
import './SignUp.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function SignUp({ onSwitchToLogin, onLoginAfterSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/signup`, {
        username: username.trim(),
        password
      });

      if (response.data.success) {
        if (onLoginAfterSignup) {
          // Optional: auto-login after signup by calling login
          const loginRes = await axios.post(`${API_URL}/auth/login`, {
            username: username.trim(),
            password
          });
          if (loginRes.data.success) {
            localStorage.setItem('sessionId', loginRes.data.sessionId);
            localStorage.setItem('username', loginRes.data.username);
            localStorage.setItem('role', loginRes.data.role);
            localStorage.setItem('expiresAt', loginRes.data.expiresAt);
            onLoginAfterSignup({
              sessionId: loginRes.data.sessionId,
              username: loginRes.data.username,
              role: loginRes.data.role
            });
            return;
          }
        }
        setError('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        onSwitchToLogin();
      } else {
        setError(response.data.error || 'Sign up failed');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Sign up failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1>ICL Tournament {new Date().getFullYear()}</h1>
          <h2>Create Account</h2>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="input-group">
            <label htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (min 2 characters)"
              required
              autoFocus
              minLength={2}
              maxLength={50}
            />
          </div>

          <div className="input-group">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>

          <div className="input-group">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary signup-button"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p className="signup-switch">
            Already have an account?{' '}
            <button type="button" className="link-button" onClick={onSwitchToLogin}>
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
