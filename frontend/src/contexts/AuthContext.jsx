import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const persistAuth = (nextToken, nextUser, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    storage.setItem('token', nextToken);
    storage.setItem('user', JSON.stringify(nextUser));
    otherStorage.removeItem('token');
    otherStorage.removeItem('user');
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password, rememberMe = false) => {
    try {
      console.log('AuthContext.login called with email:', email);
      const response = await authService.login(email, password);
      console.log('Login response:', response);
      
      const { token, user } = response.data;

      setToken(token);
      setUser(user);
      persistAuth(token, user, rememberMe);

      console.log('Login successful, token stored:', token.substring(0, 20) + '...');
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');

      return {
        success: false,
        error: isNetworkError
          ? `Cannot reach server (${apiUrl}). Start the backend and verify the API URL.`
          : (error.response?.data?.error || error.message || 'Login failed'),
      };
    }
  };

  const register = async (firstName, lastName, email, password, confirmPassword) => {
    try {
      const response = await authService.register(
        firstName,
        lastName,
        email,
        password,
        confirmPassword
      );
      const { token, user } = response.data;

      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
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
