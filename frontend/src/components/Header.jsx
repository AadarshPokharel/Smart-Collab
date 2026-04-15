import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationCount] = useState(3);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <h1>Dashboard</h1>
        </div>
        
        <div className="header-actions">
          {/* Notifications */}
          <button className="notification-btn" title="Notifications">
            <span className="notification-icon">🔔</span>
            {notificationCount > 0 && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </button>

          {/* User Profile */}
          <div className="profile-container">
            <button
              className="profile-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title={user?.email}
            >
              <div className="profile-avatar">{userInitial}</div>
            </button>

            {showProfileMenu && (
              <div className="profile-menu">
                <div className="profile-info">
                  <p className="profile-email">{user?.email}</p>
                </div>
                <div className="profile-divider"></div>
                <button className="profile-menu-item" onClick={() => navigate('/settings')}>
                  Settings
                </button>
                <button className="profile-menu-item" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
