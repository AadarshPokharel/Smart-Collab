import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ActivityList from '../components/ActivityList';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { fetchProjectActivities } from '../api/activitiesApi';
import { useAuth } from '../contexts/AuthContext';
import { normalizeNotifications } from '../utils/notifications';
import api from '../services/api';
import { projectService, taskService } from '../services';

const TAB_OPTIONS = ['overview', 'board', 'members', 'activity', 'collaboration', 'settings'];
const PROJECT_ACTIVITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'project', label: 'Projects' },
  { id: 'task', label: 'Tasks' },
  { id: 'message', label: 'Messages' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'resource', label: 'Resources' },
];

const formatDateLabel = (value, options) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not set';
  return date.toLocaleString(
    undefined,
    options || {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};

const formatDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

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

const getUserName = (user) => {
  if (!user) return 'Unknown user';
  if (typeof user === 'string') return user;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown user';
};

const getPriorityTone = (priority) => {
  const value = (priority || '').toLowerCase();
  if (value === 'high') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (value === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
};

const getStatusTone = (status) => {
  if (status === 'Done' || status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'In Progress' || status === 'Scheduled') return 'bg-violet-50 text-violet-700 border-violet-100';
  if (status === 'In Review') return 'bg-sky-50 text-sky-700 border-sky-100';
  if (status === 'Cancelled' || status === 'Archived') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const SectionCard = ({ title, description, actions = null, children }) => (
  <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
        <Icon size={16} />
      </div>
    </div>
    <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const EmptyState = ({ icon: Icon, title, description, action = null }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
    <Icon size={34} className="text-slate-300" />
    <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 max-w-lg text-sm text-slate-500">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

const defaultTaskForm = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'To Do',
  dueDate: '',
  assignedTo: '',
};

const defaultMeetingForm = {
  title: '',
  description: '',
  meetingLink: '',
  scheduledFor: '',
  participants: [],
  status: 'Scheduled',
};

const defaultResourceForm = {
  title: '',
  description: '',
  type: 'link',
  url: '',
};

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskActionId, setTaskActionId] = useState('');
  const [meetingForm, setMeetingForm] = useState(defaultMeetingForm);
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState('');
  const [resourceForm, setResourceForm] = useState(defaultResourceForm);
  const [resourceSaving, setResourceSaving] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState('');
  const [projectActivities, setProjectActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityEntityFilter, setActivityEntityFilter] = useState('all');

  const activeTab = TAB_OPTIONS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview';

  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(normalizeNotifications(data));
    } catch {
      setNotifications([]);
    }
  }, []);

  const loadProject = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setPageError('');
        const [projectResponse, tasksResponse] = await Promise.all([
          projectService.getProjectById(id),
          taskService.getProjectTasks(id),
        ]);

        setProject(projectResponse.data?.data || projectResponse.data?.project || projectResponse.data);
        setTasks(Array.isArray(tasksResponse.data?.tasks) ? tasksResponse.data.tasks : []);
      } catch (error) {
        console.error('Failed to load project:', error);
        setPageError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            'Unable to load this project right now.'
        );
      } finally {
        if (!silent) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    loadProject();
    loadNotifications();
  }, [loadProject, loadNotifications]);

  const currentMemberRole = useMemo(() => {
    if (!project || !user?._id) return null;
    const currentMember = (project.members || []).find((member) => member?.user?._id === user._id);
    return currentMember?.role || null;
  }, [project, user?._id]);

  const isOwner = project?.owner?._id === user?._id || user?.role === 'admin';
  const canManageTasks = isOwner || currentMemberRole === 'ProjectManager';
  const canCollaborate = Boolean(project && (isOwner || currentMemberRole || project.owner?._id === user?._id));

  const taskGroups = useMemo(
    () => ({
      'To Do': tasks.filter((task) => task.status === 'To Do'),
      'In Progress': tasks.filter((task) => task.status === 'In Progress'),
      'In Review': tasks.filter((task) => task.status === 'In Review'),
      Done: tasks.filter((task) => task.status === 'Done'),
    }),
    [tasks]
  );

  const nextMeeting = project?.upcomingMeeting || project?.meetings?.[0] || null;
  const resourceCount = project?.sharedResourcesCount ?? project?.sharedResources?.length ?? 0;
  const openTaskCount = project?.openTasks ?? tasks.filter((task) => task.status !== 'Done').length;

  const updateProjectSnapshot = (nextProject) => {
    setProject(nextProject);
  };

  const reloadProjectAndNotifications = async () => {
    await Promise.all([loadProject({ silent: true }), loadNotifications()]);
  };

  const loadProjectActivity = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      try {
        if (append) {
          setActivityLoadingMore(true);
        } else {
          setActivityLoading(true);
          setActivityError('');
        }

        const response = await fetchProjectActivities(id, {
          page: nextPage,
          limit: 8,
          entityType: activityEntityFilter,
        });
        const nextItems = Array.isArray(response?.data) ? response.data : [];
        const pagination = response?.pagination || {};

        setProjectActivities((previous) => (append ? [...previous, ...nextItems] : nextItems));
        setActivityPage(pagination.page || nextPage);
        setActivityHasMore(Boolean(pagination.hasMore));
      } catch (error) {
        setActivityError(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            'Unable to load project activity right now.'
        );
        if (!append) {
          setProjectActivities([]);
          setActivityHasMore(false);
        }
      } finally {
        setActivityLoading(false);
        setActivityLoadingMore(false);
      }
    },
    [activityEntityFilter, id]
  );

  useEffect(() => {
    if (activeTab === 'activity') {
      loadProjectActivity({ nextPage: 1 });
    }
  }, [activeTab, loadProjectActivity]);

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
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      loadNotifications().catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));

    try {
      await api.patch('/notifications/read-all');
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
      loadNotifications().catch(() => {});
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
    } catch (error) {
      console.error('Failed to delete notification:', error);
      loadNotifications().catch(() => {});
    }
  };

  const handleClearAllNotifications = async () => {
    setNotifications([]);

    try {
      await api.delete('/notifications/clear-all');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      loadNotifications().catch(() => {});
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      setTaskSaving(true);
      const response = await taskService.createTaskRecord({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        projectId: id,
        priority: taskForm.priority,
        status: taskForm.status,
        assignedTo: taskForm.assignedTo || null,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        dueTimezone: taskForm.dueDate ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
      });

      if (response.data?.task) {
        setTasks((previous) => [response.data.task, ...previous]);
      }

      setTaskForm(defaultTaskForm);
      setShowTaskForm(false);
      toast.success('Task created successfully');
      reloadProjectAndNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'Failed to create task'
      );
    } finally {
      setTaskSaving(false);
    }
  };

  const handleUpdateTaskStatus = async (task, nextStatus) => {
    if (!task?._id) return;

    try {
      setTaskActionId(task._id);
      const response = await taskService.updateTaskStatus(task._id, nextStatus);
      const nextTask = response.data?.task;

      setTasks((previous) =>
        previous.map((item) => (item._id === task._id ? nextTask || { ...item, status: nextStatus } : item))
      );
      toast.success('Task status updated');
      reloadProjectAndNotifications().catch(() => {});
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update task');
    } finally {
      setTaskActionId('');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!task?._id) return;
    if (!window.confirm(`Delete “${task.title}”?`)) return;

    try {
      setTaskActionId(task._id);
      await taskService.deleteTask(task._id);
      setTasks((previous) => previous.filter((item) => item._id !== task._id));
      toast.success('Task deleted');
      reloadProjectAndNotifications().catch(() => {});
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete task');
    } finally {
      setTaskActionId('');
    }
  };

  const handleInviteMember = async (event) => {
    event.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Enter a teammate email');
      return;
    }

    try {
      setInviteLoading(true);
      const response = await projectService.inviteMember(id, { email: inviteEmail.trim() });
      updateProjectSnapshot(response.data?.data || project);
      setInviteEmail('');
      toast.success(response.data?.message || 'Member invited successfully');
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to invite member'
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const memberId = member?.user?._id;
    if (!memberId) return;
    if (!window.confirm(`Remove ${getUserName(member.user)} from this project?`)) return;

    try {
      const response = await projectService.removeMember(id, memberId);
      updateProjectSnapshot(response.data?.data || project);
      toast.success(response.data?.message || 'Member removed successfully');
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to remove member'
      );
    }
  };

  const startEditMeeting = (meeting) => {
    setEditingMeetingId(meeting._id || meeting.id);
    setMeetingForm({
      title: meeting.title || '',
      description: meeting.description || '',
      meetingLink: meeting.meetingLink || '',
      scheduledFor: formatDateInputValue(meeting.scheduledFor),
      participants: Array.isArray(meeting.participants)
        ? meeting.participants.map((participant) => participant._id || participant.id).filter(Boolean)
        : [],
      status: meeting.status || 'Scheduled',
    });
    setActiveTab('collaboration');
  };

  const resetMeetingForm = () => {
    setEditingMeetingId('');
    setMeetingForm(defaultMeetingForm);
  };

  const handleMeetingSubmit = async (event) => {
    event.preventDefault();
    if (!meetingForm.title.trim()) {
      toast.error('Meeting title is required');
      return;
    }
    if (!meetingForm.scheduledFor) {
      toast.error('Meeting date and time are required');
      return;
    }

    try {
      setMeetingSaving(true);
      const payload = {
        title: meetingForm.title.trim(),
        description: meetingForm.description.trim(),
        meetingLink: meetingForm.meetingLink.trim(),
        scheduledFor: new Date(meetingForm.scheduledFor).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        participants: meetingForm.participants,
        status: meetingForm.status,
      };

      const response = editingMeetingId
        ? await projectService.updateMeeting(id, editingMeetingId, payload)
        : await projectService.addMeeting(id, payload);

      updateProjectSnapshot(response.data?.data || project);
      resetMeetingForm();
      toast.success(response.data?.message || (editingMeetingId ? 'Meeting updated' : 'Meeting added'));
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to save meeting'
      );
    } finally {
      setMeetingSaving(false);
    }
  };

  const handleDeleteMeeting = async (meeting) => {
    const meetingId = meeting?._id || meeting?.id;
    if (!meetingId) return;
    if (!window.confirm(`Delete meeting “${meeting.title}”?`)) return;

    try {
      const response = await projectService.deleteMeeting(id, meetingId);
      updateProjectSnapshot(response.data?.data || project);
      if (editingMeetingId === meetingId) {
        resetMeetingForm();
      }
      toast.success(response.data?.message || 'Meeting deleted');
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to delete meeting'
      );
    }
  };

  const startEditResource = (resource) => {
    setEditingResourceId(resource._id || resource.id);
    setResourceForm({
      title: resource.title || '',
      description: resource.description || '',
      type: resource.type || 'link',
      url: resource.url || '',
    });
    setActiveTab('collaboration');
  };

  const resetResourceForm = () => {
    setEditingResourceId('');
    setResourceForm(defaultResourceForm);
  };

  const handleResourceSubmit = async (event) => {
    event.preventDefault();
    if (!resourceForm.title.trim() || !resourceForm.url.trim()) {
      toast.error('Resource title and URL are required');
      return;
    }

    try {
      setResourceSaving(true);
      const payload = {
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim(),
        type: resourceForm.type,
        url: resourceForm.url.trim(),
      };

      const response = editingResourceId
        ? await projectService.updateResource(id, editingResourceId, payload)
        : await projectService.addResource(id, payload);

      updateProjectSnapshot(response.data?.data || project);
      resetResourceForm();
      toast.success(response.data?.message || (editingResourceId ? 'Resource updated' : 'Resource shared'));
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to save resource'
      );
    } finally {
      setResourceSaving(false);
    }
  };

  const handleDeleteResource = async (resource) => {
    const resourceId = resource?._id || resource?.id;
    if (!resourceId) return;
    if (!window.confirm(`Delete resource “${resource.title}”?`)) return;

    try {
      const response = await projectService.deleteResource(id, resourceId);
      updateProjectSnapshot(response.data?.data || project);
      if (editingResourceId === resourceId) {
        resetResourceForm();
      }
      toast.success(response.data?.message || 'Resource deleted');
      loadNotifications().catch(() => {});
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to delete resource'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-violet-500" />
          <p className="text-sm">Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
        <div>
          <AlertCircle size={36} className="mx-auto text-rose-400" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Project not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            This project may have been removed or you may not have access to it.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceLayout
      activeNav="projects"
      title={project.title}
      subtitle={project.description || 'Manage tasks, people, meetings, and shared resources in one workspace.'}
      user={user}
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onDeleteNotification={handleDeleteNotification}
      onClearAllNotifications={handleClearAllNotifications}
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/messages')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <MessageSquare size={16} />
            Messages
          </button>
          <button
            onClick={() => reloadProjectAndNotifications()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Refresh
          </button>
        </div>
      }
    >
      {pageError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p>{pageError}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        <StatCard
          icon={FolderKanban}
          label="Progress"
          value={`${project.progress || 0}%`}
          hint={`${project.completedTasks || 0} of ${project.totalTasks || 0} tasks complete`}
        />
        <StatCard
          icon={CheckSquare}
          label="Open Tasks"
          value={openTaskCount}
          hint={`${project.inReviewTasks || 0} in review`}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={project.members?.length || 0}
          hint={isOwner ? 'You manage this workspace' : 'Shared project workspace'}
        />
        <StatCard
          icon={CalendarClock}
          label="Next Meeting"
          value={nextMeeting ? formatDateLabel(nextMeeting.scheduledFor, { month: 'short', day: 'numeric' }) : 'None'}
          hint={nextMeeting ? nextMeeting.title : 'No meeting scheduled yet'}
        />
      </section>

      <section className="flex flex-wrap gap-3">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold capitalize transition ${
              activeTab === tab
                ? 'bg-violet-100 text-violet-700'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            } border border-slate-200`}
          >
            {tab === 'collaboration' ? 'Meetings & Files' : tab}
          </button>
        ))}
      </section>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
          <div className="space-y-6">
            <SectionCard
              title="Workspace Summary"
              description="Sprint 6 focus areas connected into the project workspace."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {project.dueDate ? formatDateLabel(project.dueDate) : 'No deadline set'}
                  </p>
                  {project.dueDate ? (
                    <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(project.dueDate)}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meetings</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {project.meetingsCount || project.meetings?.length || 0} scheduled item
                    {(project.meetingsCount || project.meetings?.length || 0) === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {nextMeeting ? `Next: ${nextMeeting.title}` : 'Add a meeting link and participants'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resources</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {resourceCount} shared {resourceCount === 1 ? 'resource' : 'resources'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Link-based file sharing prototype is active for this project.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Upcoming Meetings"
              description="Project meeting links and participants kept close to the work."
              actions={
                canCollaborate ? (
                  <button
                    onClick={() => setActiveTab('collaboration')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Plus size={15} />
                    Add meeting
                  </button>
                ) : null
              }
            >
              {(project.meetings || []).length === 0 ? (
                <EmptyState
                  icon={Video}
                  title="No meetings scheduled"
                  description="Add meeting links, time slots, and participants so collaboration stays inside SmartCollab."
                />
              ) : (
                <div className="space-y-3">
                  {(project.meetings || []).slice(0, 4).map((meeting) => (
                    <div
                      key={meeting._id || meeting.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(meeting.status)}`}>
                              {meeting.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDateLabel(meeting.scheduledFor)} {meeting.timezone ? `(${meeting.timezone})` : ''}
                          </p>
                          {meeting.description ? (
                            <p className="mt-2 text-sm text-slate-600">{meeting.description}</p>
                          ) : null}
                        </div>
                        {meeting.meetingLink ? (
                          <a
                            href={meeting.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
                          >
                            Join
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(meeting.participants || []).slice(0, 6).map((participant) => (
                          <span
                            key={participant._id || participant.id}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200"
                          >
                            {getUserName(participant)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Shared Resources"
              description="Recent files and links shared for this project."
            >
              {(project.sharedResources || []).length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="No shared resources yet"
                  description="Share document links, prototypes, and file metadata from the collaboration tab."
                />
              ) : (
                <div className="space-y-3">
                  {(project.sharedResources || []).slice(0, 5).map((resource) => (
                    <a
                      key={resource._id || resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-200 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {resource.type === 'file' ? (
                              <FileText size={16} className="text-violet-600" />
                            ) : (
                              <Link2 size={16} className="text-violet-600" />
                            )}
                            <p className="truncate text-sm font-semibold text-slate-900">{resource.title}</p>
                          </div>
                          {resource.description ? (
                            <p className="mt-2 text-sm text-slate-500">{resource.description}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-slate-400">
                            Shared by {getUserName(resource.uploadedBy)} on {formatDateLabel(resource.createdAt)}
                          </p>
                        </div>
                        <ExternalLink size={16} className="mt-1 text-slate-400" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Members"
              description="People working in this project workspace."
            >
              <div className="space-y-3">
                {(project.members || []).map((member) => (
                  <div
                    key={member?.user?._id || member?.user?.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{getUserName(member.user)}</p>
                      <p className="text-xs text-slate-500">{member.user?.email || 'Project member'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {member.role || 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {activeTab === 'board' && (
        <div className="space-y-6">
          <SectionCard
            title="Task Board"
            description="Track status, assignees, deadlines, and progress inside this project."
            actions={
              canManageTasks ? (
                <button
                  onClick={() => setShowTaskForm((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <Plus size={16} />
                  {showTaskForm ? 'Close form' : 'Create task'}
                </button>
              ) : null
            }
          >
            {showTaskForm && canManageTasks ? (
              <form onSubmit={handleCreateTask} className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Title</label>
                  <input
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Sprint demo checklist"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="Add acceptance notes or implementation details"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>In Review</option>
                    <option>Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Due date</label>
                  <input
                    type="datetime-local"
                    value={taskForm.dueDate}
                    onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Assignee</label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option value="">Unassigned</option>
                    {(project.members || []).map((member) => (
                      <option key={member.user._id} value={member.user._id}>
                        {getUserName(member.user)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTaskForm(false);
                      setTaskForm(defaultTaskForm);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {taskSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Create task
                  </button>
                </div>
              </form>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-4">
              {Object.entries(taskGroups).map(([status, items]) => (
                <div key={status} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{status}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
                        No tasks
                      </div>
                    ) : (
                      items.map((task) => {
                        const canChangeStatus =
                          canManageTasks || task?.assignedTo?._id === user?._id;
                        return (
                          <div key={task._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                                {task.description ? (
                                  <p className="mt-1 text-xs leading-5 text-slate-500">{task.description}</p>
                                ) : null}
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getPriorityTone(task.priority)}`}>
                                {task.priority}
                              </span>
                            </div>
                            <div className="mt-3 space-y-2 text-xs text-slate-500">
                              <p>Assigned to: {getUserName(task.assignedTo) || 'Unassigned'}</p>
                              <p>Due: {task.dueDate ? formatDateLabel(task.dueDate) : 'No due date'}</p>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                              <select
                                value={task.status}
                                onChange={(event) => handleUpdateTaskStatus(task, event.target.value)}
                                disabled={!canChangeStatus || taskActionId === task._id}
                                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-slate-100"
                              >
                                <option>To Do</option>
                                <option>In Progress</option>
                                <option>In Review</option>
                                <option>Done</option>
                              </select>
                              {canManageTasks && (
                                <button
                                  onClick={() => handleDeleteTask(task)}
                                  disabled={taskActionId === task._id}
                                  className="rounded-xl border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                                  aria-label={`Delete ${task.title}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="space-y-6">
          <SectionCard
            title="Project Members"
            description="Invite teammates and keep roles visible inside the workspace."
            actions={
              isOwner ? (
                <form onSubmit={handleInviteMember} className="flex flex-wrap items-center gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="teammate@example.com"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Invite
                  </button>
                </form>
              ) : null
            }
          >
            <div className="space-y-3">
              {(project.members || []).map((member) => (
                <div
                  key={member.user._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{getUserName(member.user)}</p>
                    <p className="text-xs text-slate-500">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {member.role || 'Member'}
                    </span>
                    {isOwner && member.user._id !== project.owner?._id ? (
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-6">
          <SectionCard
            title="Project Activity"
            description="Review the project-specific history for tasks, conversations, meetings, and shared resources."
            actions={
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/activity')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Open full activity page
                </button>
                <button
                  onClick={() => loadProjectActivity({ nextPage: 1 })}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  Refresh
                </button>
              </div>
            }
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {PROJECT_ACTIVITY_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActivityEntityFilter(filter.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    activityEntityFilter === filter.id
                      ? 'border-violet-200 bg-violet-100 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <ActivityList
              activities={projectActivities}
              loading={activityLoading}
              error={activityError}
              onRetry={() => loadProjectActivity({ nextPage: 1 })}
              onLoadMore={
                activityHasMore
                  ? () => loadProjectActivity({ nextPage: activityPage + 1, append: true })
                  : null
              }
              hasMore={activityHasMore}
              loadingMore={activityLoadingMore}
              showProject={false}
              emptyTitle="No project activity yet"
              emptyDescription="Project actions will appear here as teammates create tasks, send messages, schedule meetings, and share resources."
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'collaboration' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title={editingMeetingId ? 'Edit Meeting' : 'Schedule Meeting'}
            description="Add meeting links, participants, and timing without leaving the project."
          >
            <form onSubmit={handleMeetingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Meeting title</label>
                <input
                  value={meetingForm.title}
                  onChange={(event) => setMeetingForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Sprint planning sync"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Meeting link</label>
                <input
                  value={meetingForm.meetingLink}
                  onChange={(event) => setMeetingForm((current) => ({ ...current, meetingLink: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="https://meet.google.com/..."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Date & time</label>
                  <input
                    type="datetime-local"
                    value={meetingForm.scheduledFor}
                    onChange={(event) => setMeetingForm((current) => ({ ...current, scheduledFor: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={meetingForm.status}
                    onChange={(event) => setMeetingForm((current) => ({ ...current, status: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option>Scheduled</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Participants</label>
                <select
                  multiple
                  value={meetingForm.participants}
                  onChange={(event) =>
                    setMeetingForm((current) => ({
                      ...current,
                      participants: Array.from(event.target.selectedOptions, (option) => option.value),
                    }))
                  }
                  className="mt-1 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {(project.members || []).map((member) => (
                    <option key={member.user._id} value={member.user._id}>
                      {getUserName(member.user)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={meetingForm.description}
                  onChange={(event) => setMeetingForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Agenda, checkpoints, or call notes"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetMeetingForm}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={meetingSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {meetingSaving ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                  {editingMeetingId ? 'Save meeting' : 'Add meeting'}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title={editingResourceId ? 'Edit Shared Resource' : 'Share Link or File Metadata'}
            description="Use link and file metadata first so the workflow is demo-ready without full storage infrastructure."
          >
            <form onSubmit={handleResourceSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Resource title</label>
                <input
                  value={resourceForm.title}
                  onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="Sprint 6 review deck"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Type</label>
                  <select
                    value={resourceForm.type}
                    onChange={(event) => setResourceForm((current) => ({ ...current, type: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  >
                    <option value="link">Link</option>
                    <option value="file">File metadata</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">URL</label>
                  <input
                    value={resourceForm.url}
                    onChange={(event) => setResourceForm((current) => ({ ...current, url: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={resourceForm.description}
                  onChange={(event) => setResourceForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  placeholder="What this resource is used for"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetResourceForm}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={resourceSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {resourceSaving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                  {editingResourceId ? 'Save resource' : 'Share resource'}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Meetings"
            description="Upcoming and recent meetings for this project."
          >
            {(project.meetings || []).length === 0 ? (
              <EmptyState
                icon={Video}
                title="No meetings yet"
                description="Add a meeting prototype on the left to keep the project conversation organized."
              />
            ) : (
              <div className="space-y-3">
                {(project.meetings || []).map((meeting) => (
                  <div key={meeting._id || meeting.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusTone(meeting.status)}`}>
                            {meeting.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateLabel(meeting.scheduledFor)} {meeting.timezone ? `(${meeting.timezone})` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {meeting.meetingLink ? (
                          <a
                            href={meeting.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Join
                          </a>
                        ) : null}
                        <button
                          onClick={() => startEditMeeting(meeting)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMeeting(meeting)}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {meeting.description ? (
                      <p className="mt-3 text-sm text-slate-600">{meeting.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Shared Resources"
            description="Links and file metadata shared for the project."
          >
            {(project.sharedResources || []).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No resources shared"
                description="Use the share form to capture links and file references for the team."
              />
            ) : (
              <div className="space-y-3">
                {(project.sharedResources || []).map((resource) => (
                  <div key={resource._id || resource.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {resource.type === 'file' ? (
                            <FileText size={16} className="text-violet-600" />
                          ) : (
                            <Link2 size={16} className="text-violet-600" />
                          )}
                          <p className="truncate text-sm font-semibold text-slate-900">{resource.title}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Shared by {getUserName(resource.uploadedBy)} on {formatDateLabel(resource.createdAt)}
                        </p>
                        {resource.description ? (
                          <p className="mt-2 text-sm text-slate-600">{resource.description}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Open
                        </a>
                        <button
                          onClick={() => startEditResource(resource)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteResource(resource)}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'settings' && (
        <SectionCard
          title="Project Settings"
          description="Project information and current collaboration state."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{project.status}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {project.dueDate ? formatDateLabel(project.dueDate) : 'No deadline'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meetings</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {project.meetingsCount || project.meetings?.length || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shared resources</p>
              <p className="mt-3 text-sm font-semibold text-slate-900">{resourceCount}</p>
            </div>
          </div>
        </SectionCard>
      )}
    </WorkspaceLayout>
  );
}
