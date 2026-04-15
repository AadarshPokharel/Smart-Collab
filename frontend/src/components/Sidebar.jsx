import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '◆' },
    { id: 'projects', label: 'Projects', path: '/projects', icon: '▢' },
    { id: 'tasks', label: 'Tasks', path: '/tasks', icon: '✓' },
    { id: 'messages', label: 'Messages', path: '/messages', icon: '✉' },
    { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button 
          className="toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title="Toggle sidebar"
        >
          ≡
        </button>
        {!isCollapsed && <h2>SmartCollab</h2>}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {!isCollapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-divider"></div>
        <button className="nav-item help-btn" title="Help">
          <span className="nav-icon">?</span>
          {!isCollapsed && <span className="nav-label">Help</span>}
        </button>
      </div>
    </aside>
  );
}
