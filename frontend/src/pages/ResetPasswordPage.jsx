import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authService } from '../services';
import '../styles/Auth.css';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword(token, password, confirmPassword);
      setSuccess(response.data?.message || 'Password updated successfully');
      setPassword('');
      setConfirmPassword('');
      window.setTimeout(() => navigate('/login'), 1200);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-left">
        <div className="auth-branding-center">
          <img src="/logo.jpg" alt="SmartCollab" className="logo-large" />
          <h1>SmartCollab</h1>
          <p>Create a fresh password</p>
        </div>
        <div className="auth-features">
          <h2>Reset Password</h2>
          <ul>
            <li>Choose a new password for your account</li>
            <li>Use at least six characters</li>
            <li>Sign in again after the update is complete</li>
          </ul>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <h1>Reset Password</h1>
          <p className="auth-subtitle">Enter a new password for your SmartCollab account.</p>

          {error && <div className="error-alert">{error}</div>}
          {success && <div className="success-alert">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="password">New Password</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Create a new password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  className="toggle-btn"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-field">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  disabled={loading}
                  className="toggle-btn"
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Back to{' '}
              <Link to="/login">sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
