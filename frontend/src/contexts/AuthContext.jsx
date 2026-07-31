import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';
import { API_URL } from '../services/api';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import {
  firebaseAuth,
  isFirebaseConfigured,
  setFirebaseAuthPersistence,
} from '../services/firebase';
import { getUserTheme } from '../utils/userPreferences';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const applyThemePreference = (theme) => {
    if (typeof document === 'undefined') {
      return;
    }

    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    document.body.dataset.theme = nextTheme;
  };

  const persistAuth = (nextToken, nextUser, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    storage.setItem('token', nextToken);
    storage.setItem('user', JSON.stringify(nextUser));
    otherStorage.removeItem('token');
    otherStorage.removeItem('user');
  };

  const persistCurrentUser = (nextUser) => {
    if (localStorage.getItem('token')) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    }

    if (sessionStorage.getItem('token')) {
      sessionStorage.setItem('user', JSON.stringify(nextUser));
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      setUser(parsedUser);
      applyThemePreference(parsedUser?.preferences?.theme);
    } else {
      applyThemePreference('light');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    applyThemePreference(getUserTheme(user));
  }, [user]);

  const persistSessionFromResponse = (response, rememberMe) => {
    const { token: nextToken, user: nextUser } = response.data;
    setToken(nextToken);
    setUser(nextUser);
    persistAuth(nextToken, nextUser, rememberMe);
  };

  const updateCurrentUser = (nextUser) => {
    setUser(nextUser);
    persistCurrentUser(nextUser);
  };

  const exchangeFirebaseSession = async (idToken, rememberMe = true, profile = {}) => {
    const response = await authService.firebaseLogin(idToken, profile);
    persistSessionFromResponse(response, rememberMe);
    return { success: true };
  };

  const mapFirebaseAuthError = (error) => {
    switch (error?.code) {
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled.';
      case 'auth/popup-blocked':
        return 'Google sign-in pop-up was blocked. Allow pop-ups for SmartCollab and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with that email using a different sign-in method.';
      case 'auth/invalid-login-credentials':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'Email already in use.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      default:
        return error?.message || null;
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      if (isFirebaseConfigured && firebaseAuth) {
        try {
          await setFirebaseAuthPersistence(rememberMe);
          const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
          const idToken = await credential.user.getIdToken();
          return await exchangeFirebaseSession(idToken, rememberMe);
        } catch (firebaseError) {
          // Fall through to the existing backend login so legacy accounts keep working.
          const firebaseMessage = mapFirebaseAuthError(firebaseError);

          try {
            const response = await authService.login(email, password);
            persistSessionFromResponse(response, rememberMe);
            return { success: true };
          } catch (fallbackError) {
            return {
              success: false,
              error:
                firebaseMessage ||
                fallbackError.response?.data?.error ||
                fallbackError.message ||
                'Login failed',
            };
          }
        }
      }

      const response = await authService.login(email, password);
      persistSessionFromResponse(response, rememberMe);

      return { success: true };
    } catch (error) {
      const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');

      return {
        success: false,
        error: isNetworkError
          ? `Cannot reach server (${API_URL}). Start the backend and verify the API URL.`
          : (error.response?.data?.error || error.message || 'Login failed'),
      };
    }
  };

  const loginWithFirebase = async (idToken, rememberMe = true) => {
    try {
      return await exchangeFirebaseSession(idToken, rememberMe);
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Firebase sign-in failed',
      };
    }
  };

  const register = async (firstName, lastName, email, password, confirmPassword) => {
    try {
      if (isFirebaseConfigured && firebaseAuth) {
        try {
          await setFirebaseAuthPersistence(true);
          const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

          if (displayName) {
            await updateFirebaseProfile(credential.user, { displayName });
          }

          const idToken = await credential.user.getIdToken(true);
          return await exchangeFirebaseSession(idToken, true, { firstName, lastName });
        } catch (firebaseError) {
          const firebaseMessage = mapFirebaseAuthError(firebaseError);

          try {
            const response = await authService.register(
              firstName,
              lastName,
              email,
              password,
              confirmPassword
            );
            persistSessionFromResponse(response, true);
            return { success: true };
          } catch (fallbackError) {
            return {
              success: false,
              error:
                firebaseMessage ||
                fallbackError.response?.data?.error ||
                'Registration failed',
            };
          }
        }
      }

      const response = await authService.register(
        firstName,
        lastName,
        email,
        password,
        confirmPassword
      );
      persistSessionFromResponse(response, true);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  const logout = () => {
    if (firebaseAuth) {
      firebaseSignOut(firebaseAuth).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithGoogle: loginWithFirebase,
        loginWithFirebase,
        register,
        updateCurrentUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
