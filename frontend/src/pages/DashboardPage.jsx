import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import NotificationDropdown from '../components/NotificationDropdown';
import {
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock,
  AlertTriangle,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const SmartCollabLogo = ({ size = 36 }) => (
  <img
    src="/logo.jpg"
    alt="SmartCollab Logo"
    width={size}
    height={size}
    className="object-contain"
  />
);

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'bg-violet-100 text-violet-700 shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const Badge = ({ tone, children }) => {
  const styles = {
    high: 'bg-rose-50 text-rose-600 border-rose-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[tone] || styles.neutral}`}>
      {children}
    </span>
  );
};

const OverviewCard = ({ icon: Icon, label, value, tone = 'neutral' }) => {
  const styles = {
    rose: {
      card: 'border-rose-100 bg-rose-50/80',
      icon: 'bg-white text-rose-600',
      label: 'text-rose-700',
    },
    amber: {
      card: 'border-amber-100 bg-amber-50/80',
      icon: 'bg-white text-amber-700',
      label: 'text-amber-700',
    },
    violet: {
      card: 'border-violet-100 bg-violet-50/80',
      icon: 'bg-white text-violet-600',
      label: 'text-violet-700',
    },
    neutral: {
      card: 'border-slate-200 bg-white',
      icon: 'bg-slate-100 text-slate-600',
      label: 'text-slate-700',
    },
  };

  const toneStyles = styles[tone] || styles.neutral;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles.card}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-semibold ${toneStyles.label}`}>{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneStyles.icon}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
};

const formatDateLabel = (value, options) => {
  if (!value) return 'No date set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date set';
  return date.toLocaleDateString(undefined, options || { month: 'short', day: 'numeric' });
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes >= 0 ? `in ${diffMinutes}m` : `${Math.abs(diffMinutes)}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return diffHours >= 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays >= 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
};

const getPriorityTone = (priority) => {
  const value = (priority || '').toLowerCase();
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  return 'low';
};

const getUserName = (user) => {
  if (!user) return 'Unknown user';
  if (typeof user === 'string') return user;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown user';
};

const getTaskTone = (task) => {
  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return 'border-slate-200 bg-white';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dueDate < startOfToday && task.status !== 'Done') return 'border-rose-200 bg-rose-50/70';
  if (dueDate < tomorrow && dueDate >= startOfToday && task.status !== 'Done') return 'border-amber-200 bg-amber-50/70';
  return 'border-slate-200 bg-white';
};

const getTaskUrgencyLabel = (task) => {
  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime()) || task?.status === 'Done') return 'No deadline';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowStart = new Date(startOfToday);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrowStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  if (dueDate < startOfToday) return 'Overdue';
  if (dueDate < tomorrowStart) return 'Due today';
  if (dueDate < dayAfterTomorrow) return 'Due tomorrow';
  return 'Coming up';
};

const compareTaskUrgency = (left, right) => {
  const leftDate = left?.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const rightDate = right?.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;

  if (leftDate !== rightDate) return leftDate - rightDate;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return (priorityOrder[(left?.priority || '').toLowerCase()] ?? 3) - (priorityOrder[(right?.priority || '').toLowerCase()] ?? 3);
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Welcome back';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    const list = normalizedSearch
      ? tasks.filter((task) => {
        const searchable = [task.title, task.project, task.description, task.priority, task.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedSearch);
      })
      : tasks;

    return [...list].sort(compareTaskUrgency);
  }, [tasks, normalizedSearch]);

  const todoTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = new Date(startOfToday);
    soon.setDate(soon.getDate() + 7);

    return filteredTasks
      .filter((task) => {
        if (!task.dueDate || task.status === 'Done') return false;
        const dueDate = new Date(task.dueDate);
        return Number.isFinite(dueDate.getTime()) && dueDate <= soon;
      })
      .sort(compareTaskUrgency)
      .slice(0, 8)
      .map((task) => ({
        ...task,
        urgencyLabel: getTaskUrgencyLabel(task),
      }));
  }, [filteredTasks]);

  const visibleProjects = useMemo(() => {
    if (!normalizedSearch) return projects;
    return projects.filter((project) => {
      const searchable = [project.title, project.description].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [projects, normalizedSearch]);

  const taskPool = normalizedSearch ? filteredTasks : tasks;
  const projectPool = normalizedSearch ? visibleProjects : projects;
  const activeProjectCount = projectPool.length;
  const openTaskCount = taskPool.filter((task) => task.status !== 'Done').length;
  const dueTodayCount = taskPool.filter((task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    return dueDate && dueDate.toDateString() === new Date().toDateString() && task.status !== 'Done';
  }).length;
  const overdueCount = taskPool.filter((task) => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    return dueDate && dueDate < new Date(new Date().setHours(0, 0, 0, 0)) && task.status !== 'Done';
  }).length;

  const unreadCount = notifications.filter((item) => !item.read).length;

  const reloadNotifications = async () => {
    const { data } = await api.get('/notifications');
    setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
  };

  const handleMarkNotificationRead = async (notification) => {
    const notificationId = notification?.id || notification?._id;
    if (!notificationId || notification?.read) return;

    setNotifications((prev) => prev.map((item) => (item.id === notificationId || item._id === notificationId ? { ...item, read: true } : item)));
    try {
      await api.patch(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      reloadNotifications().catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await api.patch('/notifications/read-all');
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
      reloadNotifications().catch(() => {});
    }
  };

  const handleDeleteNotification = async (notification, event) => {
    event?.stopPropagation();
    const notificationId = notification?.id || notification?._id;
    if (!notificationId) return;

    setNotifications((prev) => prev.filter((item) => (item.id || item._id) !== notificationId));
    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      reloadNotifications().catch(() => {});
    }
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);
    try {
      await api.delete('/notifications/clear-all');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      reloadNotifications().catch(() => {});
    }
  };

  const handleOpenProject = (projectId) => {
    if (!projectId) return;
    navigate(`/projects/${projectId}`);
  };

  const handleMarkTaskComplete = async (task) => {
    const taskId = task?.id || task?._id;
    if (!taskId || task?.status === 'Done') return;

    setTasks((prev) => prev.map((item) => (item.id === taskId || item._id === taskId ? { ...item, status: 'Done' } : item)));
    setSelectedTask((current) => (current && (current.id === taskId || current._id === taskId) ? { ...current, status: 'Done' } : current));

    try {
      await api.patch(`/tasks/${taskId}/status`, { status: 'Done' });
      await refreshDashboard();
      toast.success('Task marked complete');
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error(error?.response?.data?.error || 'Failed to complete task');
      refreshDashboard().catch(() => {});
    }
  };

  const refreshDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard');
      const dashboard = data?.data || data || {};

      setTasks(Array.isArray(dashboard.tasks) ? dashboard.tasks : []);
      setProjects(Array.isArray(dashboard.projects) ? dashboard.projects : []);
      setNotifications(Array.isArray(dashboard.notifications) ? dashboard.notifications : []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setTasks([]);
      setProjects([]);
      setNotifications([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200/70 px-6 py-6 flex flex-col gap-10 transition-transform duration-200 lg:static lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-3">
            <SmartCollabLogo size={36} />
            <div>
              <p className="text-lg font-semibold">SmartCollab</p>
              <p className="text-xs text-slate-500">Student Collaboration</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <SidebarItem icon={LayoutGrid} label="Dashboard" active onClick={() => navigate('/dashboard')} />
            <SidebarItem icon={CalendarDays} label="Calendar" onClick={() => navigate('/calendar')} />
            <SidebarItem icon={FolderKanban} label="Projects" onClick={() => navigate('/projects')} />
            <SidebarItem icon={CheckSquare} label="Tasks" onClick={() => navigate('/tasks')} />
            <SidebarItem icon={MessageSquare} label="Messages" onClick={() => navigate('/messages')} />
            <SidebarItem icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
          </nav>

        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1 lg:pl-0">
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200/70">
            <div className="flex items-center justify-between px-6 lg:px-10 py-4">
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu size={20} />
                </button>
                <div className="relative hidden md:block">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9 pr-4 py-2 rounded-lg bg-slate-100/70 border border-transparent focus:outline-none focus:ring-2 focus:ring-violet-200 w-72 text-sm"
                    placeholder="Search tasks and projects"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="relative p-2 rounded-lg hover:bg-slate-100"
                    aria-label="Notifications"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <NotificationDropdown
                      notifications={notifications}
                      onMarkAllRead={handleMarkAllNotificationsRead}
                      onClearAll={handleClearAllNotifications}
                      onMarkRead={handleMarkNotificationRead}
                      onDelete={handleDeleteNotification}
                    />
                  )}
                </div>

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-semibold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <span className="hidden sm:block text-sm font-medium">{user?.firstName}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30">
                      <div className="px-4 py-3 border-b border-slate-200">
                        <p className="text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/settings');
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
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

          <main className="px-6 lg:px-10 py-8 space-y-8">
            <section>
              <div>
                <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">
                  {getGreeting()}, {user?.firstName || 'Student'}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Your tasks, deadlines, and recent activity.
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewCard icon={FolderKanban} label="Projects" value={activeProjectCount} tone="violet" />
              <OverviewCard icon={CheckSquare} label="Open Tasks" value={openTaskCount} />
              <OverviewCard icon={Clock} label="Due Today" value={dueTodayCount} tone="amber" />
              <OverviewCard icon={AlertTriangle} label="Overdue" value={overdueCount} tone="rose" />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:min-h-[calc(100vh-18rem)] xl:grid-cols-[minmax(0,1.9fr)_360px] xl:items-stretch">
              <section className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {visibleProjects.length}
                  </span>
                </div>

                <div className="flex-1 space-y-4">
                  {visibleProjects.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      No active projects.
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {visibleProjects.map((project) => {
                        const projectId = project.id || project._id;
                        const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
                        const deadline = project.deadline || project.dueDate;

                        return (
                          <button
                            key={projectId || project.title}
                            onClick={() => handleOpenProject(projectId)}
                            className="rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:border-violet-200 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-slate-900">{project.title}</p>
                                {project.description && (
                                  <p className="mt-2 text-sm leading-6 text-slate-500 line-clamp-2">
                                    {project.description}
                                  </p>
                                )}
                              </div>
                              <ArrowUpRight size={18} className="mt-1 text-slate-400" />
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                              <span>Deadline</span>
                              <span>{formatDateLabel(deadline)}</span>
                            </div>

                            <div className="mt-2 h-2 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-violet-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <Badge tone="neutral">{progress}% complete</Badge>
                              <span className="text-sm font-semibold text-violet-600">Open project</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <aside className="flex h-full flex-col rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-lg font-semibold text-slate-900">To Do</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {todoTasks.length}
                  </span>
                </div>

                <div className="flex-1 space-y-3">
                  {todoTasks.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      No overdue or upcoming tasks.
                    </div>
                  ) : (
                    todoTasks.map((task) => {
                      const taskId = task.id || task._id;
                      const urgencyTone =
                        task.urgencyLabel === 'Overdue'
                          ? 'high'
                          : task.urgencyLabel === 'Due today' || task.urgencyLabel === 'Due tomorrow'
                            ? 'medium'
                            : 'neutral';

                      return (
                        <button
                          key={taskId}
                          onClick={() => setSelectedTask(task)}
                          className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${getTaskTone(task)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-2">{task.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{task.project}</p>
                            </div>
                            <Badge tone={urgencyTone}>{task.urgencyLabel}</Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
                              <Calendar size={13} /> {formatDateLabel(task.dueDate)}
                            </span>
                            {task.dueDate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
                                <Clock size={13} /> {formatRelativeTime(task.dueDate)}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={getPriorityTone(task.priority)}>{task.priority || 'Medium'}</Badge>
                              <Badge tone="neutral">{task.status}</Badge>
                            </div>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMarkTaskComplete(task);
                              }}
                              disabled={task.status === 'Done'}
                              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              <CheckSquare size={14} />
                              {task.status === 'Done' ? 'Completed' : 'Done'}
                            </button>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>
            </section>
          </main>
        </div>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Task details</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedTask.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedTask.project}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close task details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone={getPriorityTone(selectedTask.priority)}>{selectedTask.priority || 'Medium'}</Badge>
                <Badge tone="neutral">{selectedTask.status}</Badge>
                {selectedTask.dueDate && <Badge tone="neutral">Due {formatDateLabel(selectedTask.dueDate)}</Badge>}
              </div>
              {selectedTask.description && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Description</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedTask.project}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatDateLabel(selectedTask.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  {selectedTask.dueDate && <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(selectedTask.dueDate)}</p>}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned by</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{getUserName(selectedTask.assignedBy)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned to</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{getUserName(selectedTask.assignedTo) || 'Unassigned'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    handleOpenProject(selectedTask.projectId);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  Open project
                  <ArrowUpRight size={16} />
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Close
                </button>
                {selectedTask.status !== 'Done' && (
                  <button
                    onClick={() => handleMarkTaskComplete(selectedTask)}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Mark complete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardPage;
