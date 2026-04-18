import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  FolderKanban,
  Loader2,
  FolderOpen,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Archive,
  Trash2,
  X,
  LayoutGrid,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  Settings,
  Menu,
  Bell,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import NotificationDropdown from '../components/NotificationDropdown';
import { normalizeNotifications } from '../utils/notifications';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const getDueMs = (dueDate) => {
  if (!dueDate) return null;

  if (dueDate instanceof Date) {
    const ms = dueDate.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof dueDate === 'number') {
    if (!Number.isFinite(dueDate)) return null;
    // Heuristic: treat 10-digit epoch seconds as ms.
    return dueDate < 1e12 ? dueDate * 1000 : dueDate;
  }

  if (typeof dueDate === 'string') {
    // If backend ever sends epoch timestamps as strings.
    if (/^\d{10}(\.\d+)?$/.test(dueDate)) {
      const seconds = Number(dueDate);
      return Number.isFinite(seconds) ? seconds * 1000 : null;
    }
    if (/^\d{13}(\.\d+)?$/.test(dueDate)) {
      const ms = Number(dueDate);
      return Number.isFinite(ms) ? ms : null;
    }

    const parsed = Date.parse(dueDate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof dueDate === 'object') {
    const nested = dueDate.$date || dueDate.date || dueDate.iso;
    if (nested) return getDueMs(nested);
  }

  const fallback = new Date(dueDate).getTime();
  return Number.isFinite(fallback) ? fallback : null;
};

const getUserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const buildUtcIsoFromLocalInputs = ({ scheduleDate, scheduleTime, timeZone }) => {
  if (!scheduleDate || !scheduleTime) return null;

  // HTML inputs typically provide YYYY-MM-DD and HH:mm. We interpret these as a moment in the creator's local timezone,
  // then convert to UTC for storage.
  const local = dayjs.tz(`${scheduleDate} ${scheduleTime}`, 'YYYY-MM-DD HH:mm', timeZone);
  if (!local.isValid()) return null;
  return local.utc().toISOString();
};

const formatUtcToTimeZone = ({ utcIso, timeZone }) => {
  if (!utcIso) return null;
  const d = dayjs.utc(utcIso);
  if (!d.isValid()) return null;
  return d.tz(timeZone).format('MMM D, YYYY h:mm A');
};

const ProjectsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const serverClockRef = useRef({ serverNowMs: null, perfNowMs: null });
  const viewerTimeZone = getUserTimeZone();
  const [serverTimeReady, setServerTimeReady] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNowMs = () => {
    const { serverNowMs, perfNowMs } = serverClockRef.current;
    if (serverNowMs === null || perfNowMs === null) return Date.now();
    // performance.now() isn't affected by manual system clock changes.
    return serverNowMs + (performance.now() - perfNowMs);
  };
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadErrorShownRef = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTargetProject, setScheduleTargetProject] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduleDate: '',
    scheduleTime: '',
  });
  const [scheduleForm, setScheduleForm] = useState({ scheduleDate: '', scheduleTime: '' });
  const scheduledTimeoutsRef = useRef([]);
  const scheduledTriggeredRef = useRef(new Set());
  const [scheduleTick, setScheduleTick] = useState(0);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreateModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    // Legacy guard: if UI state ever contains 'All', normalize it.
    if (filterStatus === 'All') setFilterStatus('Active');
  }, [filterStatus]);

  useEffect(() => {
    let cancelled = false;

    const syncServerTime = async () => {
      try {
        const { data } = await api.get('/time');
        const nowMs = data?.nowMs;
        if (!cancelled && Number.isFinite(nowMs)) {
          serverClockRef.current = {
            serverNowMs: nowMs,
            perfNowMs: performance.now(),
          };
          setServerTimeReady(true);
          setScheduleTick(Date.now());
        }
      } catch {
        // Ignore; scheduling stays disabled until server time is available.
      }
    };

    syncServerTime();
    const intervalId = setInterval(syncServerTime, 60_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // Best-effort: load notifications if endpoint exists. Otherwise keep empty.
    const load = async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifications(normalizeNotifications(data));
      } catch {
        setNotifications([]);
      }
    };
    load();
  }, []);

  const reloadNotifications = async () => {
    const { data } = await api.get('/notifications');
    setNotifications(normalizeNotifications(data));
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

  const fetchProjects = async (options = {}) => {
    const { silent = false } = options;
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get('/projects');
      const nextProjects = data?.data || data?.projects || data || [];
      setProjects(Array.isArray(nextProjects) ? nextProjects : []);
      loadErrorShownRef.current = false;
    } catch (error) {
      const status = error.response?.status;
      if (status === 404 || status === 204) {
        setProjects([]);
        loadErrorShownRef.current = false;
      } else {
        console.error('Failed to fetch projects:', error);
        if (!silent && !loadErrorShownRef.current) {
          toast.error('Failed to load projects');
          loadErrorShownRef.current = true;
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    const hasScheduleDate = Boolean(formData.scheduleDate);
    const hasScheduleTime = Boolean(formData.scheduleTime);
    if (hasScheduleDate !== hasScheduleTime) {
      toast.error('Please select both schedule date and schedule time');
      return;
    }

    const creatorTimeZone = viewerTimeZone;
    const scheduleUtcIso = buildUtcIsoFromLocalInputs({
      scheduleDate: formData.scheduleDate,
      scheduleTime: formData.scheduleTime,
      timeZone: creatorTimeZone,
    });

    if (hasScheduleDate && hasScheduleTime && !scheduleUtcIso) {
      toast.error('Invalid schedule date/time');
      return;
    }

    if (scheduleUtcIso) {
      const scheduleMs = getDueMs(scheduleUtcIso);
      const nowMs = getNowMs();
      if (scheduleMs === null || nowMs === null) {
        toast.error('Invalid schedule date/time');
        return;
      }
      if (scheduleMs <= nowMs) {
        toast.error('Schedule time must be in the future');
        return;
      }
    }

    try {
      setCreateLoading(true);
      const payload = {
        title: formData.title,
        description: formData.description,
        dueDate: scheduleUtcIso,
        dueTimezone: scheduleUtcIso ? creatorTimeZone : null,
      };
      const { data } = await api.post('/projects', payload);
      const createdProject = data?.data || data;
      if (createdProject) {
        const nextCreatedProject = { ...createdProject };
        // If the backend response omits dueDate, keep the schedule locally.
        if (scheduleUtcIso && !nextCreatedProject.dueDate) {
          nextCreatedProject.dueDate = scheduleUtcIso;
        }
        if (scheduleUtcIso && !nextCreatedProject.dueTimezone) {
          nextCreatedProject.dueTimezone = creatorTimeZone;
        }
        setProjects((prev) => [...prev, nextCreatedProject]);
        setScheduleTick(Date.now());
        // Re-sync in background so UI reflects canonical backend data.
        fetchProjects({ silent: true });
      }
      setFormData({ title: '', description: '', scheduleDate: '', scheduleTime: '' });
      setShowCreateModal(false);
      toast.success(data?.message || 'Project created successfully');
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error(error.response?.data?.message || 'Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      setDeleteLoading(true);
      await api.delete(`/projects/${projectId}`);
      setProjects(projects.filter(p => p._id !== projectId));
      setShowDeleteConfirm(null);
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error(error.response?.data?.message || 'Failed to delete project');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openScheduleModal = (project) => {
    setScheduleTargetProject(project);

    const dueMs = getDueMs(project?.dueDate);
    if (dueMs) {
      const d = new Date(dueMs);
      const scheduleDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const scheduleTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setScheduleForm({ scheduleDate, scheduleTime });
    } else {
      setScheduleForm({ scheduleDate: '', scheduleTime: '' });
    }

    setShowScheduleModal(true);
  };

  const handleScheduleProject = async (e) => {
    e.preventDefault();
    if (!scheduleTargetProject?._id) return;

    const hasScheduleDate = Boolean(scheduleForm.scheduleDate);
    const hasScheduleTime = Boolean(scheduleForm.scheduleTime);
    if (hasScheduleDate !== hasScheduleTime) {
      toast.error('Please select both schedule date and schedule time');
      return;
    }

    const creatorTimeZone = viewerTimeZone;
    const scheduleUtcIso = buildUtcIsoFromLocalInputs({
      scheduleDate: scheduleForm.scheduleDate,
      scheduleTime: scheduleForm.scheduleTime,
      timeZone: creatorTimeZone,
    });

    if (hasScheduleDate && hasScheduleTime && !scheduleUtcIso) {
      toast.error('Invalid schedule date/time');
      return;
    }

    if (scheduleUtcIso) {
      const scheduleMs = getDueMs(scheduleUtcIso);
      const nowMs = getNowMs();
      if (scheduleMs === null || scheduleMs <= nowMs) {
        toast.error('Schedule time must be in the future');
        return;
      }
    }

    try {
      const { data } = await api.put(`/projects/${scheduleTargetProject._id}`, {
        dueDate: scheduleUtcIso,
        dueTimezone: scheduleUtcIso ? creatorTimeZone : null,
      });
      const updated = data?.data || data;
      if (updated?._id) {
        setProjects((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else {
        // Fallback: update locally even if response shape is unexpected.
        setProjects((prev) =>
          prev.map((p) =>
            p._id === scheduleTargetProject._id
              ? { ...p, dueDate: scheduleUtcIso, dueTimezone: scheduleUtcIso ? creatorTimeZone : null }
              : p
          )
        );
      }

      setScheduleTick(Date.now());
      setShowScheduleModal(false);
      setScheduleTargetProject(null);
      toast.success('Project scheduled');
    } catch (error) {
      console.error('Failed to schedule project:', error);
      toast.error(error.response?.data?.message || 'Failed to schedule project');
    }
  };

  const now = getNowMs();
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const dueMs = getDueMs(project.dueDate);
    const isFutureScheduled = now !== null && dueMs !== null && dueMs > now;

    // Scheduled projects are hidden from All/Active/Archived until their scheduled time.
    if (filterStatus === 'Scheduled') {
      return matchesSearch && isFutureScheduled;
    }

    const matchesStatus = project.status === filterStatus;
    return matchesSearch && matchesStatus && !isFutureScheduled;
  });

  useEffect(() => {
    scheduledTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    scheduledTimeoutsRef.current = [];

    const now = getNowMs();
    if (now === null) return;

    projects.forEach((project) => {
      if (!project.dueDate) return;
      if (scheduledTriggeredRef.current.has(project._id)) return;

      const scheduleTime = getDueMs(project.dueDate);
      if (scheduleTime === null || scheduleTime <= now) return;

      const timeoutId = setTimeout(() => {
        toast.success(`Scheduled project is live: ${project.title}`);
        scheduledTriggeredRef.current.add(project._id);
        setScheduleTick(Date.now());
      }, scheduleTime - now);

      scheduledTimeoutsRef.current.push(timeoutId);
    });

    return () => {
      scheduledTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [projects, scheduleTick]);

  const unreadCount = notifications.filter((item) => !item?.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="text-violet-600 animate-spin" />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200/70 py-6 flex flex-col gap-10 transition-all duration-200 lg:static ${
            isSidebarOpen
              ? 'translate-x-0 w-72 px-6 lg:w-72 lg:px-6'
              : '-translate-x-full w-0 px-0 lg:-translate-x-full lg:w-0 lg:px-0'
          } overflow-hidden`}
        >
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="SmartCollab" className="w-9 h-9 object-contain" />
            <div>
              <p className="text-lg font-semibold">SmartCollab</p>
              <p className="text-xs text-slate-500">Student Collaboration</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutGrid size={18} /> Dashboard
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => navigate('/calendar')}
            >
              <CalendarDays size={18} /> Calendar
            </button>
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-violet-100 text-violet-700 shadow-sm">
              <FolderKanban size={18} /> Projects
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => navigate('/tasks')}
            >
              <CheckSquare size={18} /> Tasks
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => navigate('/messages')}
            >
              <MessageSquare size={18} /> Messages
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => navigate('/settings')}
            >
              <Settings size={18} /> Settings
            </button>
          </nav>
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex-1">
          {/* Top Navbar */}
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200/70">
            <div className="flex items-center justify-between px-6 lg:px-10 py-4">
              <div className="flex items-center gap-3">
                <button
                  className="p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  <Menu size={20} />
                </button>
                <div className="relative hidden md:block">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="pl-9 pr-4 py-2 rounded-lg bg-slate-100/70 border border-transparent focus:outline-none focus:ring-2 focus:ring-violet-200 w-64 text-sm"
                    placeholder="Search projects"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={notificationRef}>
                  <button
                    className="relative p-2 rounded-lg hover:bg-slate-100"
                    onClick={() => {
                      setShowNotifications((prev) => !prev);
                      setShowProfileMenu(false);
                    }}
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
                      panelClassName="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-30"
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

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FolderKanban size={32} className="text-violet-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
              <p className="text-gray-600 text-sm mt-1">
                Manage and collaborate on team projects
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-3 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none bg-white"
            >
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
              <option value="Scheduled">Scheduled</option>
            </select>
          </div>
        </div>

        {/* Empty state */}
        {filteredProjects.length === 0 && (
          <div className="flex items-center justify-center min-h-96 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-col items-center gap-4 text-center">
              <FolderOpen size={48} className="text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-800">No Projects Yet</h2>
              <p className="text-gray-600">
                {projects.length === 0
                  ? 'Create your first project to get started'
                  : 'No projects match your filters'}
              </p>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project._id}
                project={project}
                nowMs={now}
                onSchedule={() => openScheduleModal(project)}
                onDelete={() => setShowDeleteConfirm(project)}
              />
            ))}
          </div>
        )}

        {showScheduleModal && scheduleTargetProject && (
          <ScheduleProjectModal
            project={scheduleTargetProject}
            formData={scheduleForm}
            setFormData={setScheduleForm}
            onClose={() => {
              setShowScheduleModal(false);
              setScheduleTargetProject(null);
            }}
            onSubmit={handleScheduleProject}
          />
        )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
              <CreateProjectModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateProject}
                formData={formData}
                setFormData={setFormData}
                loading={createLoading}
              />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <DeleteConfirmModal
                project={showDeleteConfirm}
                onConfirm={() => handleDeleteProject(showDeleteConfirm._id)}
                onCancel={() => setShowDeleteConfirm(null)}
                loading={deleteLoading}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, nowMs, onSchedule, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const dueMs = getDueMs(project.dueDate);
  const isFutureScheduled = dueMs !== null && dueMs > nowMs;
  const primaryStatusLabel = isFutureScheduled ? 'Scheduled' : project.status;
  const showSecondaryArchived = isFutureScheduled && project.status === 'Archived';
  const viewerTimeZone = getUserTimeZone();
  const creatorTimeZone =
    typeof project?.dueTimezone === 'string' && project.dueTimezone.trim()
      ? project.dueTimezone.trim()
      : null;
  const scheduledViewerText = formatUtcToTimeZone({
    utcIso: project.dueDate,
    timeZone: viewerTimeZone,
  });
  const scheduledCreatorText = creatorTimeZone
    ? formatUtcToTimeZone({ utcIso: project.dueDate, timeZone: creatorTimeZone })
    : null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div
      className={`rounded-lg border p-6 transition-shadow ${
        isFutureScheduled
          ? 'bg-slate-50 border-slate-200/80 opacity-75 hover:opacity-90 hover:shadow-md'
          : 'bg-white border-gray-200 hover:shadow-lg'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {project.title}
          </h3>
        </div>
        <div className="relative ml-2" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-max">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onSchedule?.();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Bell size={14} /> Schedule
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Edit2 size={14} /> Edit
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Archive size={14} /> Archive
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            primaryStatusLabel === 'Scheduled'
              ? 'bg-violet-100 text-violet-700'
              : primaryStatusLabel === 'Active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {primaryStatusLabel}
        </span>
        {showSecondaryArchived && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Archived
          </span>
        )}
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {project.dueDate && (
        <p className="text-xs text-gray-500 mb-4">
          Scheduled:{' '}
          {scheduledViewerText || new Date(project.dueDate).toLocaleString()}{' '}
          <span className="text-gray-400">({viewerTimeZone})</span>
          {scheduledCreatorText && creatorTimeZone && creatorTimeZone !== viewerTimeZone && (
            <>
              {' '}
              <span className="text-gray-300">/</span>{' '}
              {scheduledCreatorText}{' '}
              <span className="text-gray-400">({creatorTimeZone})</span>
            </>
          )}
        </p>
      )}

      {/* Members */}
      <div className="mb-4 pb-4 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
            {project.members?.length || 0} member{project.members?.length !== 1 ? 's' : ''}
          </span>
          <div className="flex -space-x-2">
            {project.members?.slice(0, 4).map(member => (
              <div
                key={member.user._id}
                className="w-6 h-6 bg-violet-600 text-white text-xs font-medium rounded-full flex items-center justify-center border-2 border-white"
                title={`${member.user.firstName} ${member.user.lastName}`}
              >
                {member.user.firstName?.[0]}{member.user.lastName?.[0]}
              </div>
            ))}
            {project.members?.length > 4 && (
              <div className="w-6 h-6 bg-gray-300 text-gray-700 text-xs font-medium rounded-full flex items-center justify-center border-2 border-white">
                +{project.members.length - 4}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Progress */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Task Progress</span>
          <span className="text-xs font-medium text-gray-900">0%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-violet-600 h-2 rounded-full" style={{ width: '0%' }}></div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          View Details
        </button>
        <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors">
          Open Board
        </button>
      </div>
    </div>
  );
};

const ScheduleProjectModal = ({ project, formData, setFormData, onClose, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Schedule Project</h2>
            <p className="text-sm text-gray-500 mt-1 truncate">{project?.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Time</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                value={formData.scheduleDate}
                onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="time"
                value={formData.scheduleTime}
                onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Scheduled projects stay hidden from Active until this time.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
            >
              Save Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreateProjectModal = ({ isOpen, onClose, onSubmit, formData, setFormData, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Project</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter project title"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter project description"
              disabled={loading}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Schedule Time
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                value={formData.scheduleDate}
                onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                disabled={loading}
                placeholder="Select date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
              />
              <input
                type="time"
                value={formData.scheduleTime}
                onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                disabled={loading}
                placeholder="Select time"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Pick a date and time to schedule this project.</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmModal = ({ project, onConfirm, onCancel, loading }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Project?</h2>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>{project.title}</strong>? This action cannot be undone.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
