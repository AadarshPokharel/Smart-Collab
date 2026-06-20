import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithPopup } from 'firebase/auth';
import {
  firebaseAuth,
  googleProvider,
  isFirebaseConfigured,
  setFirebaseAuthPersistence,
} from '../services/firebase';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.7 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

const GoogleButtonShell = ({ label, disabled, onClick }) => (
  <button
    type="button"
    className="google-fallback-button google-branded-button"
    onClick={onClick}
    disabled={disabled}
  >
    <span className="google-button-icon">
      <GoogleLogo />
    </span>
    <span>{label}</span>
  </button>
);

export default function GoogleAuthButton({
  rememberMe = true,
  disabled = false,
  text = 'continue_with',
}) {
  const navigate = useNavigate();
  const { loginWithFirebase } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    isFirebaseConfigured ? '' : 'Google sign-in will be available after Firebase web config is added.'
  );
  const [messageTone, setMessageTone] = useState(isFirebaseConfigured ? '' : 'muted');

  const buttonLabel = text === 'signin_with' ? 'Sign in with Google' : 'Continue with Google';

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !firebaseAuth || !googleProvider) {
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageTone('');

    try {
      await setFirebaseAuthPersistence(rememberMe);
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await credential.user.getIdToken();
      const result = await loginWithFirebase(idToken, rememberMe);

      if (result.success) {
        navigate('/dashboard');
      } else {
        setMessage(result.error);
        setMessageTone('error');
      }
    } catch (error) {
      setMessage(
        error?.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in was cancelled.'
          : (error?.message || 'Google sign-in is unavailable right now.')
      );
      setMessageTone('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="social-auth-section">
      <GoogleButtonShell
        label={loading ? 'Connecting to Google...' : buttonLabel}
        onClick={handleGoogleSignIn}
        disabled={disabled || loading || !isFirebaseConfigured}
      />
      {message && <p className={`google-auth-message ${messageTone}`}>{message}</p>}
    </div>
  );
}
