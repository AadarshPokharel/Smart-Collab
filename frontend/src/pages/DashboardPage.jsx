import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import NotificationDropdown from '../components/NotificationDropdown';
import {
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  AlertTriangle,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  Activity,
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

const compareTaskUrgency = (left, right) => {
  const leftDate = left?.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const rightDate = right?.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;

  if (leftDate !== rightDate) return leftDate - rightDate;

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return (priorityOrder[(left?.priority || '').toLowerCase()] ?? 3) - (priorityOrder[(right?.priority || '').toLowerCase()] ?? 3);
};

const getNotificationAccent = (notification) => {
  const type = (notification?.type || '').toLowerCase();
  if (type.includes('message')) return MessageSquare;
  if (type.includes('task')) return CheckSquare;
  if (type.includes('deadline') || type.includes('reminder')) return Clock;
  if (type.includes('project')) return FolderKanban;
  return Bell;
};

const getActivityIcon = (activityItem) => {
  const text = (activityItem?.text || '').toLowerCase();
  if (text.includes('project')) return FolderKanban;
  if (text.includes('task')) return CheckSquare;
  return Activity;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const [stats, setStats] = useState({
    totalProjects: 0,
    tasksDueToday: 0,
    inProgressTasks: 0,
    completedTasks: 0,
  });
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activity, setActivity] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [quickActionForm, setQuickActionForm] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    email: '',
  });

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleOpenQuickAction = (actionType = 'invite') => {
    setActiveQuickAction(actionType);
    setQuickActionForm((current) => ({
      ...current,
      projectId: current.projectId || projects[0]?._id || projects[0]?.id || '',
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
      email: '',
    }));
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

  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const soon = new Date(startOfToday);
    soon.setDate(soon.getDate() + 7);

    return filteredTasks
      .filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return Number.isFinite(dueDate.getTime()) && dueDate >= startOfToday && dueDate <= soon;
      })
      .sort(compareTaskUrgency)
      .slice(0, 5)
      .map((task) => ({
        ...task,
        urgencyLabel: (() => {
          const dueDate = new Date(task.dueDate);
          if (dueDate < startOfToday && task.status !== 'Done') return 'Overdue';
          if (dueDate < tomorrowStart && task.status !== 'Done') return 'Due today';
          const dayAfterTomorrow = new Date(tomorrowStart);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
          if (dueDate < dayAfterTomorrow) return 'Due tomorrow';
          return 'Soon';
        })(),
      }));
  }, [filteredTasks]);

  const visibleProjects = useMemo(() => {
    if (!normalizedSearch) return projects;
    return projects.filter((project) => {
      const searchable = [project.title, project.description].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [projects, normalizedSearch]);

  const visibleActivity = useMemo(() => {
    if (!normalizedSearch) return activity.slice(0, 8);
    return activity.filter((item) => {
      const searchable = [item.text, item.actorName, item.projectTitle, item.action].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    }).slice(0, 8);
  }, [activity, normalizedSearch]);

  const visibleNotifications = useMemo(() => {
    if (!normalizedSearch) return notifications.slice(0, 5);
    return notifications.filter((note) => {
      const searchable = [note.text, note.title, note.type].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedSearch);
    }).slice(0, 5);
  }, [notifications, normalizedSearch]);

  const overdueTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return filteredTasks.filter((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return dueDate && dueDate < startOfToday && task.status !== 'Done';
    }).slice(0, 3);
  }, [filteredTasks]);

  const dueTodayTasks = useMemo(() => {
    const today = new Date();
    const todayString = today.toDateString();
    return filteredTasks.filter((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return dueDate && dueDate.toDateString() === todayString && task.status !== 'Done';
    }).slice(0, 3);
  }, [filteredTasks]);

  const highPriorityTasks = useMemo(() => {
    return filteredTasks.filter((task) => (task.priority || '').toLowerCase() === 'high' && task.status !== 'Done').slice(0, 3);
  }, [filteredTasks]);

  const compactProjects = useMemo(() => visibleProjects.slice(0, 2), [visibleProjects]);

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

  const handleCreateProject = () => {
    navigate('/projects', { state: { openCreate: true } });
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

  const closeQuickAction = () => {
    setActiveQuickAction(null);
    setQuickActionForm({
      projectId: '',
      email: '',
    });
  };

  const handleQuickActionSubmit = async (event) => {
    event.preventDefault();

    try {
      if (activeQuickAction === 'project') {
        handleCreateProject();
        closeQuickAction();
        return;
      }

      if (activeQuickAction === 'task') {
        if (!quickActionForm.projectId) {
          toast.error('Choose a project');
          return;
        }
        if (!quickActionForm.title.trim()) {
          toast.error('Task title is required');
          return;
        }

        await api.post('/tasks', {
          title: quickActionForm.title.trim(),
          description: quickActionForm.description.trim(),
          projectId: quickActionForm.projectId,
          priority: quickActionForm.priority,
          dueDate: quickActionForm.dueDate ? new Date(quickActionForm.dueDate).toISOString() : null,
          assignedTo: user?._id || null,
        });
        toast.success('Task added');
      }

      if (activeQuickAction === 'invite') {
        if (!quickActionForm.projectId) {
          toast.error('Choose a project');
          return;
        }
        if (!quickActionForm.email.trim()) {
          toast.error('Enter an email address');
          return;
        }

        await api.post(`/projects/${quickActionForm.projectId}/invite`, {
          email: quickActionForm.email.trim(),
        });
        toast.success('Invite sent');
      }

      closeQuickAction();
      await refreshDashboard();
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Action failed';
      toast.error(message);
    }
  };

  const refreshDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard');
      const dashboard = data?.data || data || {};

      setStats(dashboard.stats || { totalProjects: 0, tasksDueToday: 0, inProgressTasks: 0, completedTasks: 0 });
      setTasks(Array.isArray(dashboard.tasks) ? dashboard.tasks : []);
      setProjects(Array.isArray(dashboard.projects) ? dashboard.projects : []);
      setNotifications(Array.isArray(dashboard.notifications) ? dashboard.notifications : []);
      setActivity(Array.isArray(dashboard.activity) ? dashboard.activity : []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setStats({ totalProjects: 0, tasksDueToday: 0, inProgressTasks: 0, completedTasks: 0 });
      setTasks([]);
      setProjects([]);
      setNotifications([]);
      setActivity([]);
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
            <SidebarItem icon={FolderKanban} label="Projects" onClick={() => navigate('/projects')} />
            <SidebarItem icon={CheckSquare} label="Tasks" onClick={() => navigate('/tasks')} />
            <SidebarItem icon={MessageSquare} label="Messages" onClick={() => navigate('/messages')} />
            <SidebarItem icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-violet-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">Focus mode</p>
                <p className="text-xs text-slate-500">Track work, deadlines, and updates.</p>
              </div>
            </div>
          </div>
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
                    placeholder="Search tasks, projects, activity"
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
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">
                  <Sparkles size={14} /> SmartCollab dashboard
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">
                    {getGreeting()}, {user?.firstName || 'Student'}
                  </h1>
                  <p className="mt-3 text-sm lg:text-base text-slate-500 leading-6">
                    Stay on top of tasks, deadlines, and project activity without digging through extra menus.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-[220px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 line-clamp-2">
                  {overdueTasks[0]?.title || dueTodayTasks[0]?.title || highPriorityTasks[0]?.title || upcomingDeadlines[0]?.title || 'You are all caught up'}
                </p>
                <button
                  onClick={() => setSelectedTask(overdueTasks[0] || dueTodayTasks[0] || highPriorityTasks[0] || upcomingDeadlines[0] || null)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!overdueTasks[0] && !dueTodayTasks[0] && !highPriorityTasks[0] && !upcomingDeadlines[0]}
                >
                  Open task
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Today Focus</h2>
                  <p className="text-sm text-slate-500">Urgent work that needs attention within seconds.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle size={14} /> High urgency first
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-rose-700">Overdue Tasks</p>
                    <Badge tone="high">{overdueTasks.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {overdueTasks.length === 0 ? (
                      <p className="text-sm text-rose-700/70">No overdue tasks.</p>
                    ) : overdueTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full rounded-xl bg-white/90 px-3 py-3 text-left shadow-sm transition hover:shadow"
                      >
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.project}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-amber-700">Tasks Due Today</p>
                    <Badge tone="medium">{dueTodayTasks.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dueTodayTasks.length === 0 ? (
                      <p className="text-sm text-amber-700/70">No tasks due today.</p>
                    ) : dueTodayTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full rounded-xl bg-white/90 px-3 py-3 text-left shadow-sm transition hover:shadow"
                      >
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.project}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">High Priority</p>
                    <Badge tone="high">{highPriorityTasks.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {highPriorityTasks.length === 0 ? (
                      <p className="text-sm text-slate-500">No high-priority tasks.</p>
                    ) : highPriorityTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full rounded-xl bg-white px-3 py-3 text-left shadow-sm transition hover:shadow"
                      >
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.project}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] gap-6">
              <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">My Tasks</h2>
                    <p className="text-sm text-slate-500">Largest section. Sorts by urgency and shows the next action.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {filteredTasks.length} assigned
                  </span>
                </div>

                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      No assigned tasks found. Change the search or create a task.
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                      const isOverdue = dueDate && dueDate < new Date(new Date().setHours(0, 0, 0, 0)) && task.status !== 'Done';
                      const isToday = dueDate && dueDate.toDateString() === new Date().toDateString() && task.status !== 'Done';

                      return (
                        <div
                          key={task.id}
                          className={`rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${getTaskTone(task)}`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <button
                              onClick={() => setSelectedTask(task)}
                              className="min-w-0 text-left flex-1"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                                {isOverdue && <Badge tone="high">Overdue</Badge>}
                                {!isOverdue && isToday && <Badge tone="medium">Due today</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{task.project}</p>
                            </button>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
                                <Calendar size={13} /> {formatDateLabel(task.dueDate)}
                              </span>
                              {task.dueDate && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1">
                                  <Clock size={13} /> {formatRelativeTime(task.dueDate)}
                                </span>
                              )}
                              <Badge tone={getPriorityTone(task.priority)}>{task.priority || 'Medium'}</Badge>
                              <Badge tone="neutral">{task.status}</Badge>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleMarkTaskComplete(task);
                                }}
                                disabled={task.status === 'Done'}
                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                <CheckSquare size={14} />
                                {task.status === 'Done' ? 'Completed' : 'Mark complete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Project Snapshot</h2>
                      <p className="text-sm text-slate-500">Only the most relevant projects.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {compactProjects.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                        No active projects.
                      </p>
                    ) : (
                      compactProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleOpenProject(project.id)}
                          className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-violet-200 hover:shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{project.title}</p>
                            <span className="text-xs font-semibold text-slate-600">{project.progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${project.progress}%` }} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Deadline: {formatDateLabel(project.deadline)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                      <p className="text-sm text-slate-500">3–5 recent alerts only.</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{unreadCount} unread</span>
                  </div>
                  <div className="space-y-3">
                    {visibleNotifications.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      visibleNotifications.map((note) => {
                        const Icon = getNotificationAccent(note);
                        return (
                          <button
                            key={note.id}
                            onClick={() => handleMarkNotificationRead(note)}
                            className={`group w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${note.read ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900">{note.text}</p>
                                <p className="mt-1 text-xs text-slate-500">{note.time}</p>
                              </div>
                              {!note.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-500" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Project Progress</h2>
                      <p className="text-sm text-slate-500">See how close each project is to completion.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {visibleProjects.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
                        No projects found.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                      <p className="text-sm text-slate-500">Visible once, no repeats.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleCreateProject}
                      className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                        <Plus size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Create Project</p>
                        <p className="text-xs text-slate-500">Start a new workspace</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleOpenQuickAction('task')}
                      className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                        <CheckSquare size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Add Task</p>
                        <p className="text-xs text-slate-500">Capture work instantly</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleOpenQuickAction('invite')}
                      className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Invite Member</p>
                        <p className="text-xs text-slate-500">Add someone to a project</p>
                      </div>
                    </button>
                  </div>
                </section>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                  <p className="text-sm text-slate-500">Project changes and task updates from your team.</p>
                </div>
              </div>
              <div className="space-y-3">
                {visibleActivity.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
                    No recent activity found.
                  </p>
                ) : (
                  visibleActivity.map((item) => {
                    const Icon = getActivityIcon(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleOpenProject(item.projectId)}
                        className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-violet-50 group-hover:text-violet-600">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">{item.text}</p>
                              {item.projectTitle && <Badge tone="neutral">{item.projectTitle}</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.actorName || 'Someone'} • {item.time}
                            </p>
                          </div>
                          <ArrowUpRight size={16} className="mt-1 text-slate-400 transition group-hover:text-violet-600" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
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

      {activeQuickAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Today</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  {activeQuickAction === 'task' ? 'Add Task' : 'Invite Member'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeQuickAction === 'task'
                    ? 'Add a task directly from the dashboard.'
                    : 'Send a teammate into one of your projects.'}
                </p>
              </div>
              <button
                onClick={closeQuickAction}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close quick action"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleQuickActionSubmit} className="space-y-5 px-6 py-6">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Project</span>
                <select
                  value={quickActionForm.projectId}
                  onChange={(event) => setQuickActionForm((current) => ({ ...current, projectId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Choose a project</option>
                  {projects.map((project) => (
                    <option key={project.id || project._id} value={project.id || project._id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>

              {activeQuickAction === 'task' ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Task title</span>
                    <input
                      value={quickActionForm.title}
                      onChange={(event) => setQuickActionForm((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      placeholder="e.g. Draft presentation outline"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Priority</span>
                      <select
                        value={quickActionForm.priority}
                        onChange={(event) => setQuickActionForm((current) => ({ ...current, priority: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Due date</span>
                      <input
                        type="datetime-local"
                        value={quickActionForm.dueDate}
                        onChange={(event) => setQuickActionForm((current) => ({ ...current, dueDate: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                    <textarea
                      value={quickActionForm.description}
                      onChange={(event) => setQuickActionForm((current) => ({ ...current, description: event.target.value }))}
                      className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      placeholder="Add context, expectations, or links."
                    />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Email address</span>
                  <input
                    type="email"
                    value={quickActionForm.email}
                    onChange={(event) => setQuickActionForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="teammate@example.com"
                  />
                </label>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeQuickAction}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  {activeQuickAction === 'task' ? 'Add task' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
