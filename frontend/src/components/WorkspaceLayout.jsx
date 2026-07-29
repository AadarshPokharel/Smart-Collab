import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
} from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

const SmartCollabLogo = ({ size = 36 }) => (
  <img
    src="/logo.jpg"
    alt="SmartCollab Logo"
    width={size}
    height={size}
    className="object-contain"
  />
);

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
      active
        ? 'bg-violet-100 text-violet-700 shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/calendar' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, path: '/tasks' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' },
  { id: 'activity', label: 'Activity', icon: History, path: '/activity' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export default function WorkspaceLayout({
  activeNav,
  title,
  subtitle,
  children,
  actions = null,
  user,
  onLogout,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onClearAllNotifications,
  searchValue = '',
  onSearchChange = null,
  searchPlaceholder = 'Search',
}) {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const unreadCount = notifications.filter((item) => !item?.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-10 border-r border-slate-200/70 bg-white px-6 py-6 transition-transform duration-200 lg:static lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-3">
            <SmartCollabLogo size={36} />
            <div>
              <p className="text-lg font-semibold">SmartCollab</p>
              <p className="text-xs text-slate-500">Collaboration Platform</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeNav === item.id}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1 lg:pl-0">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4 lg:px-10">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu size={20} />
                </button>

                {onSearchChange && (
                  <div className="relative hidden md:block">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchValue}
                      onChange={(event) => onSearchChange(event.target.value)}
                      className="w-72 rounded-lg border border-transparent bg-slate-100/70 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder={searchPlaceholder}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => {
                      setShowNotifications((current) => !current);
                      setShowProfileMenu(false);
                    }}
                    className="relative rounded-lg p-2 hover:bg-slate-100"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <NotificationDropdown
                      notifications={notifications}
                      onMarkAllRead={onMarkAllNotificationsRead}
                      onClearAll={onClearAllNotifications}
                      onMarkRead={onMarkNotificationRead}
                      onDelete={onDeleteNotification}
                    />
                  )}
                </div>

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => {
                      setShowProfileMenu((current) => !current);
                      setShowNotifications(false);
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                      {user?.firstName?.[0]}
                      {user?.lastName?.[0]}
                    </div>
                    <span className="hidden text-sm font-medium sm:block">{user?.firstName}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/settings');
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                      <button
                        onClick={onLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="space-y-8 px-6 py-8 lg:px-10">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">{subtitle}</p>
                )}
              </div>

              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </section>

            {onSearchChange && (
              <section className="md:hidden">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder={searchPlaceholder}
                  />
                </div>
              </section>
            )}

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
