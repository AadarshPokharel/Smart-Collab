import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from '../components/NotificationDropdown';
import api from '../services/api';
import { projectService, taskService } from '../services';
import { normalizeNotifications } from '../utils/notifications';

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

const CALENDAR_TONES = [
  {
    dot: 'bg-violet-500',
    card: 'border-violet-100 bg-violet-50/60 hover:bg-violet-50',
    text: 'text-violet-900',
    chip: 'bg-violet-100 text-violet-700',
  },
  {
    dot: 'bg-sky-500',
    card: 'border-sky-100 bg-sky-50/60 hover:bg-sky-50',
    text: 'text-sky-900',
    chip: 'bg-sky-100 text-sky-700',
  },
  {
    dot: 'bg-emerald-500',
    card: 'border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50',
    text: 'text-emerald-900',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  {
    dot: 'bg-amber-500',
    card: 'border-amber-100 bg-amber-50/60 hover:bg-amber-50',
    text: 'text-amber-900',
    chip: 'bg-amber-100 text-amber-700',
  },
  {
    dot: 'bg-rose-500',
    card: 'border-rose-100 bg-rose-50/60 hover:bg-rose-50',
    text: 'text-rose-900',
    chip: 'bg-rose-100 text-rose-700',
  },
  {
    dot: 'bg-indigo-500',
    card: 'border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50',
    text: 'text-indigo-900',
    chip: 'bg-indigo-100 text-indigo-700',
  },
];

const VIEW_OPTIONS = ['month', 'week', 'agenda'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (value) => dayjs(value).format('YYYY-MM-DD');

const formatTimeLabel = (value) => {
  const date = dayjs(value);
  if (!date.isValid()) return '';
  if (date.hour() === 0 && date.minute() === 0) return 'All day';
  return date.format('h:mm A');
};

const formatDayHeading = (value) => dayjs(value).format('dddd, MMMM D');

const getProjectList = (responseData) => {
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.projects)) return responseData.projects;
  if (Array.isArray(responseData)) return responseData;
  return [];
};

const CompactEvent = ({ event, tone, onOpen }) => (
  <button
    onClick={(clickEvent) => {
      clickEvent.stopPropagation();
      onOpen(event);
    }}
    className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${tone.card}`}
  >
    <div className="flex items-start gap-2">
      <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${tone.dot}`} />
      <div className="min-w-0">
        <p className={`text-xs font-semibold line-clamp-1 ${tone.text}`}>{event.title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{event.projectTitle}</p>
      </div>
    </div>
  </button>
);

const CalendarEventCard = ({ event, tone, onOpen }) => (
  <button
    onClick={() => onOpen(event)}
    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${tone.card}`}
  >
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${tone.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${tone.text}`}>{event.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>
            {event.type === 'task' ? 'Task' : 'Project'}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{event.projectTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{formatTimeLabel(event.date)}</span>
          {event.type === 'task' && event.priority ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5">{event.priority}</span>
          ) : null}
          {event.type === 'task' && event.status ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5">{event.status}</span>
          ) : null}
        </div>
      </div>
    </div>
  </button>
);

const CalendarPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [projectVisibility, setProjectVisibility] = useState({});

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
    loadCalendar();
    reloadNotifications().catch(() => {});
  }, []);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const [taskResponse, projectResponse] = await Promise.all([
        taskService.getMyTasks(),
        projectService.getProjects(),
      ]);

      setTasks(Array.isArray(taskResponse.data?.tasks) ? taskResponse.data.tasks : []);
      setProjects(getProjectList(projectResponse.data));
    } catch (error) {
      console.error('Failed to load calendar:', error);
      setTasks([]);
      setProjects([]);
      toast.error('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const reloadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(normalizeNotifications(data));
    } catch {
      setNotifications([]);
    }
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

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const calendarProjects = useMemo(() => {
    const seen = new Map();

    projects.forEach((project) => {
      if (!project?._id) return;
      seen.set(project._id.toString(), {
        id: project._id.toString(),
        title: project.title || 'Untitled project',
      });
    });

    tasks.forEach((task) => {
      const projectId = task?.project?._id || task?.projectId;
      if (!projectId) return;
      const id = projectId.toString();
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          title: task?.project?.title || task?.project || 'Untitled project',
        });
      }
    });

    return Array.from(seen.values());
  }, [projects, tasks]);

  useEffect(() => {
    setProjectVisibility((previous) => {
      const next = {};
      calendarProjects.forEach((project) => {
        next[project.id] = previous[project.id] ?? true;
      });
      return next;
    });
  }, [calendarProjects]);

  const tonesByProjectId = useMemo(() => {
    const next = {};
    calendarProjects.forEach((project, index) => {
      next[project.id] = CALENDAR_TONES[index % CALENDAR_TONES.length];
    });
    return next;
  }, [calendarProjects]);

  const allEvents = useMemo(() => {
    const taskEvents = tasks
      .map((task) => {
        const date = dayjs(task?.dueDate);
        if (!date.isValid()) return null;

        const projectId = task?.project?._id || task?.projectId;
        const projectTitle = task?.project?.title || task?.project || 'Untitled project';

        return {
          id: `task-${task?._id || task?.id}`,
          type: 'task',
          title: task?.title || 'Untitled task',
          projectId: projectId ? projectId.toString() : null,
          projectTitle,
          date,
          priority: task?.priority || 'Medium',
          status: task?.status || 'To Do',
        };
      })
      .filter(Boolean);

    const projectEvents = projects
      .map((project) => {
        const date = dayjs(project?.dueDate);
        if (!date.isValid()) return null;

        return {
          id: `project-${project?._id}`,
          type: 'project',
          title: `${project?.title || 'Project'} deadline`,
          projectId: project?._id?.toString() || null,
          projectTitle: project?.title || 'Untitled project',
          date,
          status: project?.status || 'Active',
        };
      })
      .filter(Boolean);

    return [...taskEvents, ...projectEvents].sort((left, right) => left.date.valueOf() - right.date.valueOf());
  }, [projects, tasks]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      if (!event.projectId) return true;
      return projectVisibility[event.projectId] !== false;
    });
  }, [allEvents, projectVisibility]);

  const eventsByDate = useMemo(() => {
    return filteredEvents.reduce((lookup, event) => {
      const key = formatDateKey(event.date);
      if (!lookup[key]) lookup[key] = [];
      lookup[key].push(event);
      return lookup;
    }, {});
  }, [filteredEvents]);

  const currentRangeLabel = useMemo(() => {
    if (view === 'month') return currentDate.format('MMMM YYYY');
    if (view === 'week') {
      const start = currentDate.startOf('week');
      const end = currentDate.endOf('week');
      if (start.month() === end.month()) {
        return `${start.format('MMM D')} - ${end.format('D, YYYY')}`;
      }
      return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    }
    return `Agenda from ${currentDate.format('MMM D, YYYY')}`;
  }, [currentDate, view]);

  const headerDateLabel = useMemo(() => {
    return currentDate.format('dddd, MMMM D, YYYY');
  }, [currentDate]);

  const monthGridDays = useMemo(() => {
    const startOfMonth = currentDate.startOf('month');
    const leadingEmptyDays = startOfMonth.day();
    const daysInMonth = currentDate.daysInMonth();

    const cells = Array.from({ length: leadingEmptyDays }, () => null);
    for (let index = 0; index < daysInMonth; index += 1) {
      cells.push(startOfMonth.add(index, 'day'));
    }

    const trailingEmptyDays = (7 - (cells.length % 7)) % 7;
    for (let index = 0; index < trailingEmptyDays; index += 1) {
      cells.push(null);
    }

    return cells;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = currentDate.startOf('week');
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }, [currentDate]);

  const agendaGroups = useMemo(() => {
    const start = currentDate.startOf('day');
    const grouped = filteredEvents
      .filter((event) => event.date.isSame(start, 'day') || event.date.isAfter(start))
      .slice(0, 40)
      .reduce((lookup, event) => {
        const key = formatDateKey(event.date);
        if (!lookup[key]) {
          lookup[key] = {
            date: event.date,
            events: [],
          };
        }
        lookup[key].events.push(event);
        return lookup;
      }, {});

    return Object.values(grouped);
  }, [currentDate, filteredEvents]);

  const selectedDateEvents = useMemo(() => {
    return eventsByDate[formatDateKey(selectedDate)] || [];
  }, [eventsByDate, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = dayjs();
    return filteredEvents.filter((event) => event.date.isSame(now, 'day') || event.date.isAfter(now)).slice(0, 8);
  }, [filteredEvents]);

  const totalVisibleEvents = filteredEvents.length;
  const unreadCount = notifications.filter((item) => !item?.read).length;
  const allCalendarsVisible =
    calendarProjects.length > 0 &&
    calendarProjects.every((project) => projectVisibility[project.id] !== false);

  const handleToggleAllCalendars = () => {
    const nextValue = !allCalendarsVisible;
    setProjectVisibility((previous) => {
      const next = { ...previous };
      calendarProjects.forEach((project) => {
        next[project.id] = nextValue;
      });
      return next;
    });
  };

  const handleOpenEvent = (event) => {
    if (!event?.projectId) return;
    navigate(`/projects/${event.projectId}`);
  };

  const moveCalendar = (direction) => {
    const unit = view === 'month' ? 'month' : 'week';
    setCurrentDate((current) => current.add(direction, unit));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Loading calendar...
      </div>
    );
  }

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
            <SidebarItem icon={LayoutGrid} label="Dashboard" onClick={() => navigate('/dashboard')} />
            <SidebarItem icon={CalendarDays} label="Calendar" active onClick={() => navigate('/calendar')} />
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

        <div className="flex-1">
          <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200/70">
            <div className="flex items-center justify-between px-6 lg:px-10 py-4">
              <div className="flex items-center gap-3">
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu size={20} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Calendar</p>
                  <p className="text-xs text-slate-500">{headerDateLabel}</p>
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

          <main className="px-6 lg:px-10 py-8 space-y-6">
            <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900">Calendar</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Tasks and project deadlines in one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    onClick={() => moveCalendar(-1)}
                    className="p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    aria-label="Previous range"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="min-w-[180px] px-4 text-center text-sm font-semibold text-slate-900">
                    {currentRangeLabel}
                  </div>
                  <button
                    onClick={() => moveCalendar(1)}
                    className="p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    aria-label="Next range"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    const today = dayjs();
                    setCurrentDate(today);
                    setSelectedDate(today);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Today
                </button>

                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  {VIEW_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => setView(option)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
                        view === option
                          ? 'bg-violet-100 text-violet-700'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_340px] items-start">
              <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                {view === 'month' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-3">
                      {DAY_NAMES.map((name) => (
                        <div key={name} className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {name}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
                      {monthGridDays.map((day, index) => {
                        if (!day) {
                          return (
                            <div
                              key={`empty-day-${currentDate.format('YYYY-MM')}-${index}`}
                              className="min-h-[150px] rounded-2xl border border-transparent bg-transparent"
                              aria-hidden="true"
                            />
                          );
                        }

                        const dayKey = formatDateKey(day);
                        const dayEvents = eventsByDate[dayKey] || [];
                        const isToday = day.isSame(dayjs(), 'day');
                        const isSelected = day.isSame(selectedDate, 'day');

                        return (
                          <button
                            key={dayKey}
                            onClick={() => setSelectedDate(day)}
                            className={`min-h-[150px] rounded-2xl border p-3 text-left align-top transition ${
                              isSelected
                                ? 'border-violet-300 bg-violet-50/40'
                                : 'border-slate-200 hover:border-violet-200 hover:bg-slate-50'
                            } bg-white`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  isToday
                                    ? 'bg-violet-600 text-white'
                                    : isSelected
                                      ? 'bg-violet-100 text-violet-700'
                                      : 'text-slate-700'
                                }`}
                              >
                                {day.date()}
                              </span>
                              {dayEvents.length > 0 && (
                                <span className="text-[11px] font-semibold text-slate-400">{dayEvents.length}</span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {dayEvents.slice(0, 2).map((event) => {
                                const tone = tonesByProjectId[event.projectId] || CALENDAR_TONES[0];
                                return (
                                  <CompactEvent
                                    key={event.id}
                                    event={event}
                                    tone={tone}
                                    onOpen={handleOpenEvent}
                                  />
                                );
                              })}

                              {dayEvents.length > 2 && (
                                <div className="px-1 text-[11px] font-semibold text-slate-500">
                                  +{dayEvents.length - 2} more
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {view === 'week' && (
                  <div className="grid gap-4 lg:grid-cols-7">
                    {weekDays.map((day) => {
                      const dayKey = formatDateKey(day);
                      const dayEvents = eventsByDate[dayKey] || [];
                      const isToday = day.isSame(dayjs(), 'day');

                      return (
                        <div key={dayKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {day.format('ddd')}
                            </p>
                            <p className={`mt-1 text-lg font-semibold ${isToday ? 'text-violet-700' : 'text-slate-900'}`}>
                              {day.format('MMM D')}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {dayEvents.length === 0 ? (
                              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                No items
                              </p>
                            ) : (
                              dayEvents.map((event) => {
                                const tone = tonesByProjectId[event.projectId] || CALENDAR_TONES[0];
                                return (
                                  <CalendarEventCard
                                    key={event.id}
                                    event={event}
                                    tone={tone}
                                    onOpen={handleOpenEvent}
                                  />
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {view === 'agenda' && (
                  <div className="space-y-6">
                    {agendaGroups.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                        No scheduled items.
                      </div>
                    ) : (
                      agendaGroups.map((group) => (
                        <div key={formatDateKey(group.date)} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold text-slate-900">{formatDayHeading(group.date)}</h2>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {group.events.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {group.events.map((event) => {
                              const tone = tonesByProjectId[event.projectId] || CALENDAR_TONES[0];
                              return (
                                <CalendarEventCard
                                  key={event.id}
                                  event={event}
                                  tone={tone}
                                  onOpen={handleOpenEvent}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Calendars</h2>
                    {calendarProjects.length > 0 && (
                      <button
                        onClick={handleToggleAllCalendars}
                        className="text-xs font-semibold text-violet-600 transition hover:text-violet-700"
                      >
                        {allCalendarsVisible ? 'Hide all' : 'Show all'}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {calendarProjects.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                        No project calendars yet.
                      </p>
                    ) : (
                      calendarProjects.map((project) => {
                        const tone = tonesByProjectId[project.id] || CALENDAR_TONES[0];
                        const count = filteredEvents.filter((event) => event.projectId === project.id).length;
                        const isVisible = projectVisibility[project.id] !== false;

                        return (
                          <button
                            key={project.id}
                            onClick={() => setProjectVisibility((prev) => ({ ...prev, [project.id]: !isVisible }))}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                              isVisible
                                ? 'border-slate-200 bg-white hover:border-violet-200'
                                : 'border-slate-200 bg-slate-50 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`h-3 w-3 rounded-full flex-shrink-0 ${tone.dot}`} />
                              <span className="truncate text-sm font-semibold">{project.title}</span>
                            </div>
                            <span className="text-xs font-semibold">{count}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">{formatDayHeading(selectedDate)}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedDateEvents.length} item{selectedDateEvents.length === 1 ? '' : 's'}</p>
                  </div>

                  <div className="space-y-3">
                    {selectedDateEvents.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                        Nothing scheduled for this date.
                      </p>
                    ) : (
                      selectedDateEvents.map((event) => {
                        const tone = tonesByProjectId[event.projectId] || CALENDAR_TONES[0];
                        return (
                          <CalendarEventCard
                            key={event.id}
                            event={event}
                            tone={tone}
                            onOpen={handleOpenEvent}
                          />
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">Coming Up</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {totalVisibleEvents}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {upcomingEvents.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                        No upcoming deadlines.
                      </p>
                    ) : (
                      upcomingEvents.map((event) => {
                        const tone = tonesByProjectId[event.projectId] || CALENDAR_TONES[0];
                        return (
                          <div key={event.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>
                                {event.type === 'task' ? 'Task' : 'Project'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{event.projectTitle}</p>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">
                                {event.date.format('MMM D')} at {formatTimeLabel(event.date)}
                              </p>
                              <button
                                onClick={() => handleOpenEvent(event)}
                                className="text-xs font-semibold text-violet-600 transition hover:text-violet-700"
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
