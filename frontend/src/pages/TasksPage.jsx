import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock3,
  FolderKanban,
  History,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Download,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from '../components/NotificationDropdown';
import { normalizeNotifications } from '../utils/notifications';
import api from '../services/api';
import { projectService, taskService } from '../services';
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  getDateKeyInTimeZone,
  getUserTimezone,
} from '../utils/userPreferences';
import { getInitialSidebarOpen } from '../utils/sidebarState';
import {
  formatAllowedSubmissionFormats,
  hasTaskSubmission,
  readFileAsBase64,
  triggerBlobDownload,
} from '../utils/taskSubmission';

const TASK_STATUSES = ['To Do', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High'];
const TASK_ASSIGNMENT_OPTIONS = [
  { id: 'single', label: 'One user' },
  { id: 'some', label: 'Some users' },
  { id: 'all', label: 'All users' },
];
const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'assigned_to_me', label: 'Assigned to Me' },
  { id: 'due_today', label: 'Due Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'high_priority', label: 'High Priority' },
  { id: 'completed', label: 'Completed' },
];

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

const Badge = ({ tone = 'neutral', children }) => {
  const styles = {
    high: 'bg-rose-50 text-rose-600 border-rose-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    progress: 'bg-sky-50 text-sky-700 border-sky-100',
    review: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
    todo: 'bg-slate-100 text-slate-600 border-slate-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.neutral}`}
    >
      {children}
    </span>
  );
};

const SummaryCard = ({ icon: Icon, label, value, tone = 'neutral' }) => {
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
    emerald: {
      card: 'border-emerald-100 bg-emerald-50/80',
      icon: 'bg-white text-emerald-600',
      label: 'text-emerald-700',
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

const getEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return '';
};

const getDisplayName = (value) => {
  if (!value) return 'Unassigned';
  if (typeof value === 'string') return value;

  const fullName = [value.firstName, value.lastName].filter(Boolean).join(' ').trim();
  return fullName || value.email || 'Unassigned';
};

const getProjectName = (value) => {
  if (!value) return 'No project';
  if (typeof value === 'string') return value;
  return value.title || value.name || 'No project';
};

const toDateKey = (value) => {
  if (!value) return '';

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateFromKey = (dateKey) => {
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (
  value,
  timeZone,
  options = { month: 'short', day: 'numeric', year: 'numeric' }
) => formatDateInTimeZone(value, timeZone, options, 'No due date');

const formatDateTimeLabel = (value, timeZone) =>
  formatDateTimeInTimeZone(value, timeZone, undefined, 'Not available');

const formatDateInputValue = (value) => {
  return toDateKey(value);
};

const isDueToday = (task, timeZone) => {
  if (!task?.dueDate || task.status === 'Done') return false;

  const dueDateKey = getDateKeyInTimeZone(task.dueDate, timeZone);
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  return Boolean(dueDateKey) && dueDateKey === todayKey;
};

const isOverdue = (task, timeZone) => {
  if (!task?.dueDate || task.status === 'Done') return false;

  const dueDateKey = getDateKeyInTimeZone(task.dueDate, timeZone);
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  return Boolean(dueDateKey) && Boolean(todayKey) && dueDateKey < todayKey;
};

const getPriorityTone = (priority) => {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
};

const getStatusTone = (status) => {
  switch (status) {
    case 'Done':
      return 'success';
    default:
      return 'todo';
  }
};

const sortTasks = (taskList) => {
  const priorityRank = { High: 0, Medium: 1, Low: 2 };

  return [...taskList].sort((left, right) => {
    const leftDue = dateFromKey(toDateKey(left.dueDate))?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDue = dateFromKey(toDateKey(right.dueDate))?.getTime() ?? Number.POSITIVE_INFINITY;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    const leftPriority = priorityRank[left.priority] ?? 3;
    const rightPriority = priorityRank[right.priority] ?? 3;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return new Date(right.updatedAt || right.createdAt || 0).getTime() -
      new Date(left.updatedAt || left.createdAt || 0).getTime();
  });
};

const normalizeTask = (task) => ({
  id: getEntityId(task) || task?.id || '',
  title: task?.title || '',
  description: task?.description || '',
  projectId: getEntityId(task?.project),
  projectName: getProjectName(task?.project),
  assignedTo: task?.assignedTo || null,
  assignedBy: task?.assignedBy || null,
  priority: task?.priority || 'Medium',
  status: task?.status || 'To Do',
  dueDate: task?.dueDate || null,
  submissionRequired: !!task?.submissionRequired,
  allowedSubmissionFormats: Array.isArray(task?.allowedSubmissionFormats)
    ? task.allowedSubmissionFormats
    : [],
  submission: task?.submission || null,
  createdAt: task?.createdAt || null,
  updatedAt: task?.updatedAt || null,
});

const buildProjectUserOptions = (project) => {
  if (!project) return [];

  const seen = new Set();
  const users = [];
  const owner = project.owner;
  const ownerId = getEntityId(owner);

  if (ownerId) {
    seen.add(ownerId);
    users.push({
      id: ownerId,
      name: getDisplayName(owner),
      email: owner?.email || '',
      role: 'Owner',
    });
  }

  const members = Array.isArray(project.members) ? project.members : [];
  members.forEach((member) => {
    const memberUser = member?.user || member;
    const memberId = getEntityId(memberUser);
    if (!memberId || seen.has(memberId)) return;

    seen.add(memberId);
    users.push({
      id: memberId,
      name: getDisplayName(memberUser),
      email: memberUser?.email || '',
      role: member?.role || 'Member',
    });
  });

  return users.sort((left, right) => left.name.localeCompare(right.name));
};

const isProjectManager = (project, user) => {
  if (!project || !user) return false;
  if (user.role === 'admin') return true;
  if (getEntityId(project.owner) === getEntityId(user)) return true;

  const members = Array.isArray(project.members) ? project.members : [];
  const membership = members.find((member) => getEntityId(member?.user) === getEntityId(user));
  return ['Owner', 'ProjectManager'].includes(membership?.role);
};

const canUpdateTaskStatus = (task, project, user) => {
  if (!task || !user) return false;
  if (isProjectManager(project, user)) return true;
  return getEntityId(task.assignedTo) === getEntityId(user);
};

const canUploadTaskSubmission = (task, project, user) => {
  if (!task || !user) return false;
  if (isProjectManager(project, user)) return true;
  return getEntityId(task.assignedTo) === getEntityId(user);
};

const canSeeSubmissionUploader = (task, project, user) => {
  if (!task || !user) return false;
  if (isProjectManager(project, user)) return true;
  return getEntityId(task.assignedBy) === getEntityId(user);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export default function TasksPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userTimeZone = getUserTimezone(user);

  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarOpen);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskBeingEdited, setTaskBeingEdited] = useState(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState(null);
  const [submissionTask, setSubmissionTask] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState('');
  const [uploadingSubmissionId, setUploadingSubmissionId] = useState('');
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState('');
  const [formError, setFormError] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    projectId: '',
    assignmentMode: 'single',
    assignedTo: '',
    assignedToIds: [],
    priority: 'Medium',
    status: 'To Do',
    dueDate: '',
    submissionRequired: false,
    allowedSubmissionFormats: '',
  });

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(normalizeNotifications(data));
    } catch {
      setNotifications([]);
    }
  };

  const reloadNotifications = async () => {
    const { data } = await api.get('/notifications');
    setNotifications(normalizeNotifications(data));
  };

  const loadTaskPageData = async ({ showSpinner = true } = {}) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      setError('');

      const [taskResponse, projectResponse] = await Promise.all([
        taskService.getTasks(),
        projectService.getProjects(),
      ]);

      const rawTasks = taskResponse?.data?.tasks || taskResponse?.data?.data || [];
      const rawProjects = projectResponse?.data?.data || projectResponse?.data?.projects || [];

      setTasks(sortTasks(Array.isArray(rawTasks) ? rawTasks.map(normalizeTask) : []));
      setProjects(Array.isArray(rawProjects) ? rawProjects : []);
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Unable to load tasks right now.');
      setError(message);
      if (!showSpinner) {
        toast.error(message);
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadTaskPageData();
    loadNotifications();
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

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false);
        setShowNotifications(false);
        if (!savingTask) setShowTaskModal(false);
        if (!deletingTaskId) setTaskPendingDelete(null);
        if (!uploadingSubmissionId) {
          setSubmissionTask(null);
          setSubmissionFile(null);
          setSubmissionNote('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [deletingTaskId, savingTask, uploadingSubmissionId]);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [getEntityId(project), project])),
    [projects]
  );

  const manageableProjects = useMemo(
    () => projects.filter((project) => isProjectManager(project, user)),
    [projects, user]
  );

  const hasTaskCreateAccess = manageableProjects.length > 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    const searchedTasks = normalizedSearch
      ? tasks.filter((task) => {
        const searchable = [
          task.title,
          task.description,
          task.projectName,
          getDisplayName(task.assignedTo),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      })
      : tasks;

    const nextTasks = searchedTasks.filter((task) => {
      switch (activeFilter) {
        case 'assigned_to_me':
          return getEntityId(task.assignedTo) === getEntityId(user);
        case 'due_today':
          return isDueToday(task, userTimeZone);
        case 'overdue':
          return isOverdue(task, userTimeZone);
        case 'high_priority':
          return task.priority === 'High';
        case 'completed':
          return task.status === 'Done';
        default:
          return true;
      }
    });

    return sortTasks(nextTasks);
  }, [activeFilter, normalizedSearch, tasks, user, userTimeZone]);

  const selectedProject = taskForm.projectId ? projectMap.get(taskForm.projectId) : null;
  const selectedProjectUsers = useMemo(
    () => buildProjectUserOptions(selectedProject),
    [selectedProject]
  );

  useEffect(() => {
    const validUserIds = new Set(selectedProjectUsers.map((member) => member.id));

    if (taskForm.assignmentMode === 'single') {
      if (!taskForm.assignedTo) return;
      if (!validUserIds.has(taskForm.assignedTo)) {
        setTaskForm((current) => ({ ...current, assignedTo: '' }));
      }
      return;
    }

    if (taskForm.assignmentMode === 'some' && taskForm.assignedToIds.length > 0) {
      const nextAssignedToIds = taskForm.assignedToIds.filter((id) => validUserIds.has(id));
      if (nextAssignedToIds.length !== taskForm.assignedToIds.length) {
        setTaskForm((current) => ({ ...current, assignedToIds: nextAssignedToIds }));
      }
    }
  }, [selectedProjectUsers, taskForm.assignedTo, taskForm.assignedToIds, taskForm.assignmentMode]);

  const overview = useMemo(() => {
    const openTasks = tasks.filter((task) => task.status !== 'Done').length;
    const assignedToMe = tasks.filter((task) => getEntityId(task.assignedTo) === getEntityId(user)).length;
    const dueToday = tasks.filter((task) => isDueToday(task, userTimeZone)).length;
    const completed = tasks.filter((task) => task.status === 'Done').length;

    return { openTasks, assignedToMe, dueToday, completed };
  }, [tasks, user, userTimeZone]);

  const unreadCount = notifications.filter((item) => !item?.read).length;

  const handleMarkNotificationRead = async (notification) => {
    const notificationId = notification?.id || notification?._id;
    if (!notificationId || notification?.read) return;

    setNotifications((previous) =>
      previous.map((item) =>
        item.id === notificationId || item._id === notificationId
          ? { ...item, read: true }
          : item
      )
    );

    try {
      await api.patch(`/notifications/${notificationId}/read`);
    } catch (requestError) {
      console.error('Failed to mark notification read:', requestError);
      reloadNotifications().catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));

    try {
      await api.patch('/notifications/read-all');
    } catch (requestError) {
      console.error('Failed to mark all notifications read:', requestError);
      reloadNotifications().catch(() => {});
    }
  };

  const handleDeleteNotification = async (notification, event) => {
    event?.stopPropagation();
    const notificationId = notification?.id || notification?._id;
    if (!notificationId) return;

    setNotifications((previous) =>
      previous.filter((item) => (item.id || item._id) !== notificationId)
    );

    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (requestError) {
      console.error('Failed to delete notification:', requestError);
      reloadNotifications().catch(() => {});
    }
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);

    try {
      await api.delete('/notifications/clear-all');
    } catch (requestError) {
      console.error('Failed to clear notifications:', requestError);
      reloadNotifications().catch(() => {});
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      projectId: manageableProjects[0] ? getEntityId(manageableProjects[0]) : '',
      assignmentMode: 'single',
      assignedTo: '',
      assignedToIds: [],
      priority: 'Medium',
      status: 'To Do',
      dueDate: '',
      submissionRequired: false,
      allowedSubmissionFormats: '',
    });
    setFormError('');
    setTaskBeingEdited(null);
  };

  const openCreateTaskModal = () => {
    if (!hasTaskCreateAccess) {
      toast.error('You do not have permission to create tasks in the available projects.');
      return;
    }

    resetTaskForm();
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    const relatedProject = projectMap.get(task.projectId);
    if (!isProjectManager(relatedProject, user)) {
      toast.error('Only project owners, managers, or admins can edit this task.');
      return;
    }

    setTaskBeingEdited(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      projectId: task.projectId || '',
      assignmentMode: 'single',
      assignedTo: getEntityId(task.assignedTo),
      assignedToIds: getEntityId(task.assignedTo) ? [getEntityId(task.assignedTo)] : [],
      priority: task.priority || 'Medium',
      status: task.status || 'To Do',
      dueDate: formatDateInputValue(task.dueDate),
      submissionRequired: !!task.submissionRequired,
      allowedSubmissionFormats: Array.isArray(task.allowedSubmissionFormats)
        ? task.allowedSubmissionFormats.join(', ')
        : '',
    });
    setFormError('');
    setShowTaskModal(true);
  };

  const handleTaskFormChange = (field, value) => {
    setTaskForm((current) => ({
      ...current,
      [field]: field === 'submissionRequired' ? Boolean(value) : value,
      ...(field === 'submissionRequired' && !value
        ? { allowedSubmissionFormats: '' }
        : {}),
    }));
  };

  const handleTaskAssignmentModeChange = (mode) => {
    setTaskForm((current) => ({
      ...current,
      assignmentMode: mode,
      assignedTo: mode === 'single' ? current.assignedTo : '',
      assignedToIds: mode === 'some' ? current.assignedToIds : [],
    }));
  };

  const toggleTaskAssigneeSelection = (userId) => {
    setTaskForm((current) => {
      const exists = current.assignedToIds.includes(userId);
      return {
        ...current,
        assignedToIds: exists
          ? current.assignedToIds.filter((id) => id !== userId)
          : [...current.assignedToIds, userId],
      };
    });
  };

  const handleSaveTask = async (event) => {
    event.preventDefault();

    const normalizedTitle = taskForm.title.trim();
    if (!normalizedTitle) {
      setFormError('Task title is required.');
      return;
    }

    if (!taskForm.projectId) {
      setFormError('Please select a project.');
      return;
    }

    if (!taskBeingEdited && taskForm.assignmentMode === 'some' && taskForm.assignedToIds.length === 0) {
      setFormError('Choose at least one user for this task.');
      return;
    }

    const payload = {
      title: normalizedTitle,
      description: taskForm.description.trim(),
      projectId: taskForm.projectId,
      assignedTo: taskForm.assignedTo || null,
      priority: taskForm.priority,
      status: taskForm.status,
      dueDate: taskForm.dueDate || null,
      submissionRequired: taskForm.submissionRequired,
      allowedSubmissionFormats: taskForm.allowedSubmissionFormats,
    };

    if (!taskBeingEdited) {
      payload.assignmentMode = taskForm.assignmentMode;
      if (taskForm.assignmentMode === 'some') {
        payload.assignedToIds = taskForm.assignedToIds;
      }
    }

    try {
      setSavingTask(true);
      setFormError('');

      if (taskBeingEdited?.id) {
        await taskService.updateTask(taskBeingEdited.id, payload);
        toast.success('Task updated successfully');
      } else {
        const response = await taskService.createTaskRecord(payload);
        const createdTasks = Array.isArray(response?.data?.tasks)
          ? response.data.tasks.map(normalizeTask)
          : response?.data?.task
            ? [normalizeTask(response.data.task)]
            : [];

        if (createdTasks.length > 0) {
          setTasks((previous) => sortTasks([...createdTasks, ...previous]));
        }

        const createdCount = response?.data?.createdCount || createdTasks.length || 1;
        toast.success(
          createdCount > 1
            ? `${createdCount} tasks created successfully`
            : 'Task created successfully'
        );
      }

      setShowTaskModal(false);
      resetTaskForm();
      if (taskBeingEdited?.id) {
        await loadTaskPageData({ showSpinner: false });
      }
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Unable to save this task.');
      setFormError(message);
      toast.error(message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskPendingDelete?.id) return;

    try {
      setDeletingTaskId(taskPendingDelete.id);
      await taskService.deleteTask(taskPendingDelete.id);
      setTasks((previous) => previous.filter((task) => task.id !== taskPendingDelete.id));
      toast.success('Task deleted successfully');
      setTaskPendingDelete(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, 'Unable to delete this task.'));
    } finally {
      setDeletingTaskId('');
    }
  };

  const openSubmissionModal = (task) => {
    setSubmissionTask(task);
    setSubmissionFile(null);
    setSubmissionNote(task?.submission?.note || '');
  };

  const handleUploadSubmission = async (event) => {
    event.preventDefault();

    if (!submissionTask?.id) return;
    if (!submissionFile) {
      toast.error('Choose a file to upload.');
      return;
    }

    try {
      setUploadingSubmissionId(submissionTask.id);
      const contentBase64 = await readFileAsBase64(submissionFile);
      const response = await taskService.uploadTaskSubmission(submissionTask.id, {
        fileName: submissionFile.name,
        mimeType: submissionFile.type,
        contentBase64,
        note: submissionNote.trim(),
      });

      const updatedTask = normalizeTask(response?.data?.task || {});
      if (updatedTask.id) {
        setTasks((previous) =>
          sortTasks(previous.map((item) => (item.id === updatedTask.id ? updatedTask : item)))
        );
      } else {
        await loadTaskPageData({ showSpinner: false });
      }

      setSubmissionTask(null);
      setSubmissionFile(null);
      setSubmissionNote('');
      toast.success(response?.data?.message || 'Task submitted successfully');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, 'Unable to upload task work.'));
    } finally {
      setUploadingSubmissionId('');
    }
  };

  const handleDownloadSubmission = async (task) => {
    if (!task?.id || !task?.submission?.fileName) return;

    try {
      setDownloadingSubmissionId(task.id);
      const response = await taskService.downloadTaskSubmission(task.id);
      triggerBlobDownload(response.data, task.submission.fileName);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, 'Unable to download task work.'));
    } finally {
      setDownloadingSubmissionId('');
    }
  };

  const handleStatusChange = async (task, nextStatus) => {
    if (!task?.id || task.status === nextStatus) return;

    const relatedProject = projectMap.get(task.projectId);
    if (!canUpdateTaskStatus(task, relatedProject, user)) {
      toast.error('You are only allowed to update tasks assigned to you.');
      return;
    }

    if (nextStatus === 'Done' && task.submissionRequired && !hasTaskSubmission(task)) {
      toast.error('Upload the required task work before marking this task as done.');
      return;
    }

    const previousStatus = task.status;
    setUpdatingStatusId(task.id);
    setTasks((previous) =>
      previous.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const response = await taskService.updateTaskStatus(task.id, nextStatus);
      const updatedTask = normalizeTask(response?.data?.task || {});

      if (updatedTask.id) {
        setTasks((previous) =>
          sortTasks(previous.map((item) => (item.id === task.id ? updatedTask : item)))
        );
      } else {
        await loadTaskPageData({ showSpinner: false });
      }

      toast.success('Task status updated');
    } catch (requestError) {
      setTasks((previous) =>
        sortTasks(previous.map((item) => (item.id === task.id ? { ...item, status: previousStatus } : item)))
      );
      toast.error(getErrorMessage(requestError, 'Unable to update task status.'));
    } finally {
      setUpdatingStatusId('');
    }
  };

  const emptyStateMessage = tasks.length === 0
    ? 'No tasks have been created yet.'
    : 'No tasks match your current search or filter.';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col gap-10 overflow-hidden border-r border-slate-200/70 bg-white py-6 transition-all duration-200 lg:static ${
            isSidebarOpen
              ? 'translate-x-0 w-72 px-6 lg:w-72 lg:px-6'
              : '-translate-x-full w-0 px-0 lg:-translate-x-full lg:w-0 lg:px-0'
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
            <SidebarItem icon={LayoutGrid} label="Dashboard" onClick={() => navigate('/dashboard')} />
            <SidebarItem icon={CalendarDays} label="Calendar" onClick={() => navigate('/calendar')} />
            <SidebarItem icon={FolderKanban} label="Projects" onClick={() => navigate('/projects')} />
            <SidebarItem icon={CheckSquare} label="Tasks" active onClick={() => navigate('/tasks')} />
            <SidebarItem icon={MessageSquare} label="Messages" onClick={() => navigate('/messages')} />
            <SidebarItem icon={History} label="Activity Log" onClick={() => navigate('/activity')} />
            <SidebarItem icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
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
                  className="rounded-lg p-2 hover:bg-slate-100"
                  onClick={() => setIsSidebarOpen((current) => !current)}
                  aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                  title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  <Menu size={20} />
                </button>

                <div className="relative hidden md:block">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-72 rounded-lg border border-transparent bg-slate-100/70 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Search tasks or projects"
                  />
                </div>
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
                      onMarkAllRead={handleMarkAllNotificationsRead}
                      onClearAll={handleClearAllNotifications}
                      onMarkRead={handleMarkNotificationRead}
                      onDelete={handleDeleteNotification}
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
                        onClick={handleLogout}
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
                  Task Workspace
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Track assignments, deadlines, and progress across your SmartCollab projects.
                </p>
              </div>

              <button
                onClick={openCreateTaskModal}
                disabled={!hasTaskCreateAccess}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus size={16} />
                Create Task
              </button>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={CheckSquare} label="Open Tasks" value={overview.openTasks} tone="violet" />
              <SummaryCard icon={UserRound} label="Assigned to Me" value={overview.assignedToMe} />
              <SummaryCard icon={Clock3} label="Due Today" value={overview.dueToday} tone="amber" />
              <SummaryCard icon={CalendarDays} label="Completed" value={overview.completed} tone="emerald" />
            </section>

            <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="relative md:hidden">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Search tasks or projects"
                  />
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Search size={16} className="hidden md:block" />
                  <span>Filters</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {FILTER_OPTIONS.map((filterOption) => (
                    <button
                      key={filterOption.id}
                      onClick={() => setActiveFilter(filterOption.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        activeFilter === filterOption.id
                          ? 'border-violet-200 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                  <button
                    onClick={() => loadTaskPageData()}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Retry
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} in view
                  </p>
                </div>
                <Badge tone="neutral">{tasks.length} total</Badge>
              </div>

              {loading ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <p className="text-sm">Loading tasks...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <CheckSquare size={30} className="text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">No tasks found</h3>
                  <p className="mt-2 max-w-md text-sm text-slate-500">{emptyStateMessage}</p>
                  {tasks.length === 0 && (
                    <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                      {hasTaskCreateAccess ? (
                        <button
                          onClick={openCreateTaskModal}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                        >
                          <Plus size={16} />
                          Create your first task
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/projects')}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <FolderKanban size={16} />
                          Go to projects
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map((task) => {
                    const relatedProject = projectMap.get(task.projectId);
                    const canManageThisTask = isProjectManager(relatedProject, user);
                    const canChangeThisTaskStatus = canUpdateTaskStatus(task, relatedProject, user);
                    const canUploadThisTaskSubmission = canUploadTaskSubmission(task, relatedProject, user);
                    const canSelfSubmitTask = canChangeThisTaskStatus && !canManageThisTask;
                    const showSubmissionUploader = canSeeSubmissionUploader(task, relatedProject, user);
                    const taskHasSubmission = hasTaskSubmission(task);
                    const isStatusUpdating = updatingStatusId === task.id;
                    const isDeletingThisTask = deletingTaskId === task.id;
                    const isDownloadingSubmission = downloadingSubmissionId === task.id;
                    const isUploadingThisTask = uploadingSubmissionId === task.id;

                    return (
                      <article
                        key={task.id}
                        className={`rounded-3xl border p-5 transition ${
                          isOverdue(task, userTimeZone)
                            ? 'border-rose-200 bg-rose-50/40'
                            : 'border-slate-200 bg-white hover:border-violet-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                              <Badge tone={getPriorityTone(task.priority)}>{task.priority}</Badge>
                              <Badge tone={getStatusTone(task.status)}>{task.status}</Badge>
                              {isDueToday(task, userTimeZone) && <Badge tone="medium">Due today</Badge>}
                              {isOverdue(task, userTimeZone) && <Badge tone="high">Overdue</Badge>}
                            </div>

                            <p className="mt-2 text-sm font-medium text-violet-600">{task.projectName}</p>

                            {task.description ? (
                              <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p>
                            ) : (
                              <p className="mt-3 text-sm italic text-slate-400">No description provided.</p>
                            )}

                            {task.submissionRequired ? (
                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={taskHasSubmission ? 'success' : 'medium'}>
                                    {taskHasSubmission ? 'Work uploaded' : 'Submission required'}
                                  </Badge>
                                  <span className="text-xs font-medium text-amber-700">
                                    Accepted formats: {formatAllowedSubmissionFormats(task.allowedSubmissionFormats)}
                                  </span>
                                </div>

                                {taskHasSubmission ? (
                                  <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                                    <p>
                                      Uploaded file: <span className="font-medium text-slate-900">{task.submission.fileName}</span>
                                    </p>
                                    <p>
                                      {showSubmissionUploader && task.submission.uploadedBy
                                        ? `Submitted by ${getDisplayName(task.submission.uploadedBy)} on `
                                        : 'Submitted on '}
                                      <span className="font-medium text-slate-900">
                                        {formatDateTimeLabel(task.submission.uploadedAt, userTimeZone)}
                                      </span>
                                    </p>
                                    {task.submission.note ? (
                                      <p className="text-slate-500">{task.submission.note}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-sm text-amber-700">
                                    Upload the required work file to submit this task.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            {(taskHasSubmission || canUploadThisTaskSubmission) && (
                              <button
                                onClick={() =>
                                  taskHasSubmission && !canUploadThisTaskSubmission
                                    ? handleDownloadSubmission(task)
                                    : openSubmissionModal(task)
                                }
                                disabled={isDownloadingSubmission || isUploadingThisTask}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {taskHasSubmission && !canUploadThisTaskSubmission ? (
                                  <Download size={15} />
                                ) : (
                                  <Upload size={15} />
                                )}
                                {taskHasSubmission && !canUploadThisTaskSubmission
                                  ? 'Download Work'
                                  : taskHasSubmission
                                    ? canManageThisTask
                                      ? 'Replace Work'
                                      : 'Replace Submission'
                                    : canManageThisTask
                                      ? 'Upload Work'
                                      : 'Submit Work'}
                              </button>
                            )}
                            {taskHasSubmission && canUploadThisTaskSubmission && (
                              <button
                                onClick={() => handleDownloadSubmission(task)}
                                disabled={isDownloadingSubmission}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isDownloadingSubmission ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Download size={15} />
                                )}
                                Download Work
                              </button>
                            )}
                            <button
                              onClick={() => openEditTaskModal(task)}
                              disabled={!canManageThisTask}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>
                            <button
                              onClick={() => setTaskPendingDelete(task)}
                              disabled={!canManageThisTask || isDeletingThisTask}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned to</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {task.assignedTo ? getDisplayName(task.assignedTo) : 'Unassigned'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {formatDateLabel(task.dueDate, userTimeZone)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {formatDateTimeLabel(task.createdAt, userTimeZone)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">
                              {formatDateTimeLabel(task.updatedAt, userTimeZone)}
                            </p>
                          </div>
                        </div>

                        {(canManageThisTask || canSelfSubmitTask) && (
                          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {canManageThisTask ? 'Task status' : 'Task submission'}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {canManageThisTask
                                  ? `Owners, admins, and project managers can manage task status.${task.submissionRequired ? ' Required work must be uploaded before Done.' : ''}`
                                  : task.status === 'Done'
                                    ? 'This task has already been submitted.'
                                    : task.submissionRequired
                                      ? 'Upload the required work above to submit this task.'
                                      : 'Submit this task when your work is complete.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {isStatusUpdating && (
                                <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                                  <Loader2 size={16} className="animate-spin" />
                                  Saving
                                </span>
                              )}
                              {canManageThisTask ? (
                                <select
                                  value={task.status}
                                  onChange={(event) => handleStatusChange(task, event.target.value)}
                                  disabled={!canChangeThisTaskStatus || isStatusUpdating}
                                  className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  {TASK_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : task.status === 'Done' ? (
                                <Badge tone="success">Submitted</Badge>
                              ) : !task.submissionRequired ? (
                                <button
                                  onClick={() => handleStatusChange(task, 'Done')}
                                  disabled={isStatusUpdating}
                                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  Submit Task
                                </button>
                              ) : (
                                <Badge tone="medium">Waiting for submission</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  {taskBeingEdited ? 'Edit task' : 'Create task'}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  {taskBeingEdited ? 'Update task details' : 'Add a new task'}
                </h2>
              </div>
              <button
                onClick={() => {
                  if (savingTask) return;
                  setShowTaskModal(false);
                  setFormError('');
                }}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close task form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-6 px-6 py-6">
              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Task title
                  </label>
                  <input
                    value={taskForm.title}
                    onChange={(event) => handleTaskFormChange('title', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Enter a task title"
                    maxLength={120}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={taskForm.description}
                    onChange={(event) => handleTaskFormChange('description', event.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Add task details"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Project
                  </label>
                  <select
                    value={taskForm.projectId}
                    onChange={(event) => handleTaskFormChange('projectId', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option value="">Select a project</option>
                    {manageableProjects.map((project) => (
                      <option key={getEntityId(project)} value={getEntityId(project)}>
                        {getProjectName(project)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(event) => handleTaskFormChange('priority', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={taskForm.status}
                    onChange={(event) => handleTaskFormChange('status', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => handleTaskFormChange('dueDate', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <label className="mb-3 block text-sm font-semibold text-slate-700">
                    {taskBeingEdited ? 'Assignee' : 'Assign task'}
                  </label>

                  {!taskBeingEdited ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {TASK_ASSIGNMENT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleTaskAssignmentModeChange(option.id)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            taskForm.assignmentMode === option.id
                              ? 'border-violet-200 bg-violet-100 text-violet-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                          disabled={!taskForm.projectId}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!taskForm.projectId ? (
                    <p className="text-sm text-slate-500">
                      Select a project first to choose assignees.
                    </p>
                  ) : null}

                  {taskForm.projectId && (taskBeingEdited || taskForm.assignmentMode === 'single') ? (
                    <select
                      value={taskForm.assignedTo}
                      onChange={(event) => handleTaskFormChange('assignedTo', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    >
                      <option value="">Unassigned</option>
                      {selectedProjectUsers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} {member.role ? `(${member.role})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {taskForm.projectId && !taskBeingEdited && taskForm.assignmentMode === 'some' ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                        <span>
                          {taskForm.assignedToIds.length} user
                          {taskForm.assignedToIds.length === 1 ? '' : 's'} selected
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTaskForm((current) => ({
                                ...current,
                                assignedToIds: selectedProjectUsers.map((member) => member.id),
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setTaskForm((current) => ({ ...current, assignedToIds: [] }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                        {selectedProjectUsers.map((member) => (
                          <label
                            key={member.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={taskForm.assignedToIds.includes(member.id)}
                              onChange={() => toggleTaskAssigneeSelection(member.id)}
                              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                            />
                            <span>
                              {member.name} {member.role ? `(${member.role})` : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {taskForm.projectId && !taskBeingEdited && taskForm.assignmentMode === 'all' ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                      This will create one task for every user in the selected project.
                    </div>
                  ) : null}
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={taskForm.submissionRequired}
                      onChange={(event) => handleTaskFormChange('submissionRequired', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                    />
                    Require uploaded task work before Done
                  </label>

                  {taskForm.submissionRequired ? (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Accepted file formats
                      </label>
                      <input
                        value={taskForm.allowedSubmissionFormats}
                        onChange={(event) =>
                          handleTaskFormChange('allowedSubmissionFormats', event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                        placeholder="pdf, docx, zip, fig"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Leave blank to accept any file format.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (savingTask) return;
                    setShowTaskModal(false);
                    setFormError('');
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingTask && <Loader2 size={16} className="animate-spin" />}
                  {taskBeingEdited ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {submissionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  Task submission
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  Submit work for {submissionTask.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Accepted formats: {formatAllowedSubmissionFormats(submissionTask.allowedSubmissionFormats)}
                </p>
              </div>
              <button
                onClick={() => {
                  if (uploadingSubmissionId) return;
                  setSubmissionTask(null);
                  setSubmissionFile(null);
                  setSubmissionNote('');
                }}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close submission form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmission} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Select file
                </label>
                <input
                  type="file"
                  onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Maximum upload size: 5 MB.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Submission note
                </label>
                <textarea
                  value={submissionNote}
                  onChange={(event) => setSubmissionNote(event.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Add context for the uploaded work"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (uploadingSubmissionId) return;
                    setSubmissionTask(null);
                    setSubmissionFile(null);
                    setSubmissionNote('');
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(uploadingSubmissionId)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {uploadingSubmissionId && <Loader2 size={16} className="animate-spin" />}
                  Submit Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 size={18} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Delete task</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-700">{taskPendingDelete.title}</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (deletingTaskId) return;
                  setTaskPendingDelete(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={Boolean(deletingTaskId)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {deletingTaskId && <Loader2 size={16} className="animate-spin" />}
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
