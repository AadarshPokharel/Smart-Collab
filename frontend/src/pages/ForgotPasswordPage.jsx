import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../services/firebase';
import '../styles/Auth.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResetUrl('');
    setLoading(true);

    try {
      if (isFirebaseConfigured && firebaseAuth) {
        await sendPasswordResetEmail(firebaseAuth, email);
        setSuccess('If an account with that email exists, a password reset email has been sent.');
        return;
      }

      const response = await authService.forgotPassword(email);
      setSuccess(response.data?.message || 'If an account exists, a reset link is ready.');
      setResetUrl(response.data?.resetUrl || '');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to prepare password reset');
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
          <p>Recover your account access</p>
        </div>
        <div className="auth-features">
          <h2>Password Reset</h2>
          <ul>
            <li>Enter the email linked to your account</li>
            <li>Open the reset link and create a new password</li>
            <li>Return to login and continue working</li>
          </ul>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <h1>Forgot Password</h1>
          <p className="auth-subtitle">We&apos;ll help you reset your password and get back in.</p>

          {error && <div className="error-alert">{error}</div>}
          {success && <div className="success-alert">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Preparing Reset...' : 'Send Reset Link'}
            </button>
          </form>

          {resetUrl && (
            <div className="auth-helper-card">
              <p className="auth-helper-text">
                Development reset link ready. Open it to choose a new password.
              </p>
              <a href={resetUrl} className="secondary-button">
                Open Reset Page
              </a>
            </div>
          )}

          <div className="auth-footer">
            <p>
              Remembered your password?{' '}
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
