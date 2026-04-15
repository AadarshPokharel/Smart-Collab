import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getMockNotifications, normalizeNotifications } from '../utils/notifications';
import {
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
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
  AlertTriangle,
  Activity,
  ArrowUpRight,
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

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 hover:shadow-md transition-all">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
      </div>
      <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const FilterButton = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
      active
        ? 'bg-violet-600 text-white shadow-sm'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`}
  >
    {label}
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
  const [taskFilter, setTaskFilter] = useState('all');

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
    const fetchDashboard = async () => {
      try {
        const [statsRes, tasksRes, projectsRes, notificationsRes, activityRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/tasks'),
          api.get('/projects'),
          api.get('/notifications'),
          api.get('/activity'),
        ]);

        setStats(statsRes.data?.stats || statsRes.data || stats);
        setTasks(tasksRes.data?.tasks || tasksRes.data || []);
        setProjects(projectsRes.data?.projects || projectsRes.data || []);
        setNotifications(normalizeNotifications(notificationsRes.data));
        setActivity(activityRes.data?.activity || activityRes.data || []);
      } catch (error) {
        setStats({
          totalProjects: 8,
          tasksDueToday: 5,
          inProgressTasks: 12,
          completedTasks: 48,
        });
        setTasks([
          { id: 1, title: 'Finalize sprint board', project: 'Collabrix UI', dueDate: '2026-04-14', priority: 'High', status: 'In Progress' },
          { id: 2, title: 'Sync with backend API', project: 'SmartCollab Core', dueDate: '2026-04-14', priority: 'Medium', status: 'Review' },
          { id: 3, title: 'Prepare demo slides', project: 'Launch Plan', dueDate: '2026-04-13', priority: 'High', status: 'Pending' },
          { id: 4, title: 'QA regression pass', project: 'Release 2.4', dueDate: '2026-04-16', priority: 'Low', status: 'Pending' },
        ]);
        setProjects([
          { id: 1, name: 'SmartCollab Core', progress: 72, deadline: '2026-04-25' },
          { id: 2, name: 'Collabrix UI', progress: 58, deadline: '2026-04-21' },
          { id: 3, name: 'Launch Plan', progress: 35, deadline: '2026-04-30' },
        ]);
        setNotifications(getMockNotifications());
        setActivity([
          { id: 1, text: 'Task “API sync” moved to Review.', time: '32m ago' },
          { id: 2, text: 'Project “Collabrix UI” updated roadmap.', time: '2h ago' },
          { id: 3, text: 'You completed “Draft onboarding doc”.', time: '1d ago' },
        ]);
      }
    };

    fetchDashboard();
  }, []);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks;
    const today = new Date();
    return tasks.filter((task) => {
      const due = new Date(task.dueDate);
      if (taskFilter === 'today') {
        return due.toDateString() === today.toDateString();
      }
      if (taskFilter === 'high') {
        return (task.priority || '').toLowerCase() === 'high';
      }
      return true;
    });
  }, [tasks, taskFilter]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const taskStatusTone = (task) => {
    const due = new Date(task.dueDate);
    const today = new Date();
    const isOverdue = due < new Date(today.toDateString()) && task.status !== 'Completed';
    const isToday = due.toDateString() === today.toDateString();
    if (isOverdue) return 'border-rose-200 bg-rose-50/60';
    if (isToday) return 'border-amber-200 bg-amber-50/60';
    return 'border-slate-200 bg-white';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        {/* Sidebar */}
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
            <SidebarItem icon={LayoutGrid} label="Dashboard" active />
            <SidebarItem icon={FolderKanban} label="Projects" onClick={() => navigate('/projects')} />
            <SidebarItem icon={CheckSquare} label="Tasks" />
            <SidebarItem icon={MessageSquare} label="Messages" />
            <SidebarItem icon={Settings} label="Settings" />
          </nav>

          <div className="mt-auto rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-violet-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">Quick Boost</p>
                <p className="text-xs text-slate-500">Invite teammates faster</p>
              </div>
            </div>
            <button className="mt-4 w-full text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition rounded-lg py-2">
              Invite Member
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 lg:pl-0">
          {/* Top Navbar */}
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
                    className="pl-9 pr-4 py-2 rounded-lg bg-slate-100/70 border border-transparent focus:outline-none focus:ring-2 focus:ring-violet-200 w-64 text-sm"
                    placeholder="Search projects, tasks, people"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="relative p-2 rounded-lg hover:bg-slate-100"
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">Notifications</p>
                        <button className="text-xs text-violet-600 hover:text-violet-700">Mark all read</button>
                      </div>
                      <div className="space-y-3 max-h-80 overflow-auto">
                        {notifications.map((note) => (
                          <div
                            key={note.id}
                            className={`p-3 rounded-lg border text-sm ${
                              note.read ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <p className="text-slate-700 font-medium">{note.text}</p>
                              {!note.read && <span className="w-2 h-2 bg-violet-500 rounded-full mt-1" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{note.time}</p>
                          </div>
                        ))}
                      </div>
                    </div>
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
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl">
                      <div className="px-4 py-3 border-b border-slate-200">
                        <p className="text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                      </div>
                      <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">
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
            {/* Dashboard Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-semibold text-slate-900">
                  {getGreeting()}, {user?.firstName || 'Student'}
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                  You have {stats.tasksDueToday} tasks due today and {unreadCount} unread notifications.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition flex items-center gap-2">
                  <Plus size={16} /> Create Project
                </button>
                <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                  Add Task
                </button>
                <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                  Open Messages
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <StatCard icon={FolderKanban} label="Total Projects" value={stats.totalProjects} />
              <StatCard icon={Calendar} label="Tasks Due Today" value={stats.tasksDueToday} />
              <StatCard icon={Clock} label="In Progress" value={stats.inProgressTasks} />
              <StatCard icon={CheckCircle2} label="Completed Tasks" value={stats.completedTasks} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* My Tasks */}
              <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">My Tasks</h2>
                    <p className="text-sm text-slate-500">Track upcoming work and priorities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FilterButton label="All" active={taskFilter === 'all'} onClick={() => setTaskFilter('all')} />
                    <FilterButton label="Due Today" active={taskFilter === 'today'} onClick={() => setTaskFilter('today')} />
                    <FilterButton label="High Priority" active={taskFilter === 'high'} onClick={() => setTaskFilter('high')} />
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <button
                      key={task.id}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-sm ${taskStatusTone(task)}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{task.project}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} /> {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                          <Badge tone={task.priority?.toLowerCase() === 'high' ? 'high' : task.priority?.toLowerCase() === 'medium' ? 'medium' : 'low'}>
                            {task.priority || 'Priority'}
                          </Badge>
                          <Badge tone="neutral">{task.status}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Project Progress */}
              <section className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Project Progress</h2>
                    <p className="text-sm text-slate-500">Keep projects on track.</p>
                  </div>
                  <button className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1">
                    View all <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="space-y-4">
                  {projects.map((project) => (
                    <button key={project.id} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                        <span className="text-xs font-semibold text-slate-600">{project.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-violet-500" style={{ width: `${project.progress}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Deadline: {new Date(project.deadline).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Notifications Panel */}
              <section className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  <span className="text-xs text-slate-500">{unreadCount} unread</span>
                </div>
                <div className="space-y-3">
                  {notifications.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-xl border ${note.read ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'} transition`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white text-violet-600 flex items-center justify-center">
                          <Bell size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{note.text}</p>
                          <p className="text-xs text-slate-500 mt-1">{note.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Activity */}
              <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Activity</h2>
                  <button className="text-xs text-violet-600 hover:text-violet-700">View timeline</button>
                </div>
                <div className="space-y-3">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Activity size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.text}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Quick Actions */}
            <section className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Quick Actions</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <AlertTriangle size={14} /> Overdue tasks are highlighted
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Create Project</button>
                <button className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Add Task</button>
                <button className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Invite Member</button>
                <button className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Open Messages</button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
