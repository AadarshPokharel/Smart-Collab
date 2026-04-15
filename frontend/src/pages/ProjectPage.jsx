import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Settings } from 'lucide-react';
import { projectService, taskService } from '../services';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getMockNotifications, normalizeNotifications } from '../utils/notifications';
import '../styles/ProjectBoard.css';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
  });
  const [activeTab, setActiveTab] = useState('board');

  useEffect(() => {
    fetchProjectData();
  }, [id]);

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
        setNotifications(getMockNotifications());
      }
    };
    load();
  }, []);

  const fetchProjectData = async () => {
    try {
      const projectRes = await projectService.getProjectById(id);
      setProject(projectRes.data?.data || projectRes.data?.project || projectRes.data);

      const tasksRes = await taskService.getProjectTasks(id);
      setTasks(tasksRes.data.tasks || []);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      logout();
    } finally {
      navigate('/login');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await taskService.createTask(
        formData.title,
        formData.description,
        id,
        formData.priority,
        null,
        null
      );
      setFormData({ title: '', description: '', priority: 'Medium' });
      setShowTaskForm(false);
      fetchProjectData();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      fetchProjectData();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await taskService.deleteTask(taskId);
        fetchProjectData();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter((task) => task.status === status);
  };

  const unreadCount = notifications.filter((item) => !item?.read).length;

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return <div className="error">Project not found</div>;
  }

  const projectTitle = project.title || project.name || 'Project';
  const projectDescription = project.description || '';
  const projectMembers = Array.isArray(project.members) ? project.members : [];
  const projectOwnerId = project.owner?._id || project.owner;

  const todoTasks = getTasksByStatus('To Do');
  const inProgressTasks = getTasksByStatus('In Progress');
  const doneTasks = getTasksByStatus('Done');

  return (
    <div className="project-page">
      <header className="project-header">
        <div className="header-content">
          <div className="header-left">
            <button className="btn-back" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
            <div className="project-header-divider"></div>
            <img src="/logo.jpg" alt="SmartCollab" className="app-logo-header-small" />
          </div>
          <div className="project-title-section">
            <h1>{projectTitle}</h1>
            <p>{projectDescription}</p>
          </div>
          <div className="project-meta">
            <span>👥 {project.members?.length || 0} members</span>
            <span>✓ {tasks.length} tasks</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationRef}>
              <button
                className="relative p-2 rounded-lg hover:bg-white/10"
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
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">Notifications</p>
                    <button
                      className="text-xs text-violet-600 hover:text-violet-700"
                      onClick={() =>
                        setNotifications((prev) => prev.map((note) => ({ ...note, read: true })))
                      }
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-3 max-h-80 overflow-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center text-sm text-slate-500 py-6">No new notifications</div>
                    ) : (
                      notifications.map((note, index) => {
                        const isRead = !!note?.read;
                        const text = note?.text || note?.message || note?.title || 'Notification';
                        const time =
                          note?.time ||
                          (note?.createdAt
                            ? new Date(note.createdAt).toLocaleString()
                            : note?.timestamp
                              ? new Date(note.timestamp).toLocaleString()
                              : '');

                        return (
                          <div
                            key={note?.id || note?._id || index}
                            className={`p-3 rounded-lg border text-sm ${
                              isRead
                                ? 'border-slate-200 bg-slate-50'
                                : 'border-violet-200 bg-violet-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <p className="text-slate-700 font-medium">{text}</p>
                              {!isRead && <span className="w-2 h-2 bg-violet-500 rounded-full mt-1" />}
                            </div>
                            {time && <p className="text-xs text-slate-500 mt-2">{time}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => {
                  setShowProfileMenu((prev) => !prev);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-semibold">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span className="hidden sm:block text-sm font-medium">{user?.firstName}</span>
                <ChevronDown size={14} className="text-white/70" />
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

      <nav className="project-tabs">
        <button
          className={`tab ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          Board
        </button>
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="project-content">
        {activeTab === 'board' && (
          <div className="board-section">
            <div className="board-header">
              <h2>Task Board</h2>
              <button
                className="btn btn-primary"
                onClick={() => setShowTaskForm(!showTaskForm)}
              >
                {showTaskForm ? 'Cancel' : '+ Add Task'}
              </button>
            </div>

            {showTaskForm && (
              <form className="task-form" onSubmit={handleCreateTask}>
                <input
                  type="text"
                  placeholder="Task title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                <textarea
                  placeholder="Description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <button type="submit" className="btn btn-primary">
                  Create Task
                </button>
              </form>
            )}

            <div className="kanban-board">
              {/* To Do Column */}
              <div className="kanban-column">
                <div className="column-header">
                  <h3>To Do</h3>
                  <span className="task-count">{todoTasks.length}</span>
                </div>
                <div className="tasks-container">
                  {todoTasks.map((task) => (
                    <div key={task._id} className="task-card">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="task-footer">
                        <span className={`priority ${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                          className="status-select"
                        >
                          <option>To Do</option>
                          <option>In Progress</option>
                          <option>Done</option>
                        </select>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* In Progress Column */}
              <div className="kanban-column">
                <div className="column-header">
                  <h3>In Progress</h3>
                  <span className="task-count">{inProgressTasks.length}</span>
                </div>
                <div className="tasks-container">
                  {inProgressTasks.map((task) => (
                    <div key={task._id} className="task-card">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="task-footer">
                        <span className={`priority ${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                          className="status-select"
                        >
                          <option>To Do</option>
                          <option>In Progress</option>
                          <option>Done</option>
                        </select>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done Column */}
              <div className="kanban-column">
                <div className="column-header">
                  <h3>Done</h3>
                  <span className="task-count">{doneTasks.length}</span>
                </div>
                <div className="tasks-container">
                  {doneTasks.map((task) => (
                    <div key={task._id} className="task-card completed">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="task-footer">
                        <span className={`priority ${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                          className="status-select"
                        >
                          <option>To Do</option>
                          <option>In Progress</option>
                          <option>Done</option>
                        </select>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="members-section">
            <h2>Project Members</h2>
            <div className="members-list">
              {projectMembers.length > 0 ? (
                projectMembers.map((member, idx) => {
                  const memberUser = member?.user;
                  const memberId = memberUser?._id || memberUser;
                  const memberName =
                    memberUser && typeof memberUser === 'object'
                      ? `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim() || memberUser.email
                      : String(memberId || '');
                  const memberEmail =
                    memberUser && typeof memberUser === 'object' ? memberUser.email : '';
                  const isOwner =
                    projectOwnerId && memberId && projectOwnerId.toString() === memberId.toString();

                  return (
                    <div
                      key={memberId?.toString() || `${project._id || 'project'}-member-${idx}`}
                      className="member-item"
                    >
                      <div className="member-info">
                        <h4>{memberName}</h4>
                        {memberEmail ? <p>{memberEmail}</p> : null}
                      </div>
                      {isOwner ? (
                        <span className="badge">Owner</span>
                      ) : member?.role ? (
                        <span className="badge">{member.role}</span>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p>No members yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-section">
            <h2>Project Settings</h2>
            <div className="settings-content">
              <h3>{projectTitle}</h3>
              <p>{projectDescription}</p>
              <p>
                <strong>Status:</strong> <span className="status-badge">{project.status}</span>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
