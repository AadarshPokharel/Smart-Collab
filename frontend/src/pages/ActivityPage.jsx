import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Filter,
  History,
  RefreshCcw,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import WorkspaceLayout from '../components/WorkspaceLayout';
import ActivityList from '../components/ActivityList';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { fetchActivities } from '../api/activitiesApi';
import { projectService } from '../services';
import { normalizeNotifications } from '../utils/notifications';

const ENTITY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'project', label: 'Projects' },
  { id: 'task', label: 'Tasks' },
  { id: 'message', label: 'Messages' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'resource', label: 'Resources' },
];

const DEFAULT_LIMIT = 12;

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown user';
  if (typeof user === 'string') return user;
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown user';
};

export default function ActivityPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    entityType: 'all',
    userId: 'all',
    startDate: '',
    endDate: '',
  });
  const deferredSearchTerm = useDeferredValue(searchTerm);

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

  const reloadNotifications = async () => {
    const { data } = await api.get('/notifications');
    setNotifications(normalizeNotifications(data));
  };

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

  const loadProjects = useCallback(async () => {
    try {
      const response = await projectService.getProjects();
      const projectList = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.projects)
          ? response.data.projects
          : [];

      setProjects(projectList);
    } catch {
      setProjects([]);
    }
  }, []);

  const activityUsers = useMemo(() => {
    const userMap = new Map();

    projects.forEach((project) => {
      const owner = project?.owner;
      if (owner?._id || owner?.id) {
        userMap.set(owner._id || owner.id, {
          id: owner._id || owner.id,
          label: getUserDisplayName(owner),
        });
      }

      (project?.members || []).forEach((member) => {
        const memberUser = member?.user;
        const memberId = memberUser?._id || memberUser?.id;
        if (!memberId) return;

        userMap.set(memberId, {
          id: memberId,
          label: getUserDisplayName(memberUser),
        });
      });
    });

    return Array.from(userMap.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [projects]);

  const loadActivity = useCallback(
    async ({ nextPage = 1, append = false, silent = false } = {}) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        if (!append) {
          setError('');
        }

        const response = await fetchActivities({
          page: nextPage,
          limit: DEFAULT_LIMIT,
          entityType: filters.entityType,
          userId: filters.userId !== 'all' ? filters.userId : undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          search: deferredSearchTerm || undefined,
        });

        const nextItems = Array.isArray(response?.data) ? response.data : [];
        const pagination = response?.pagination || {};

        setActivities((previous) => (append ? [...previous, ...nextItems] : nextItems));
        setHasMore(Boolean(pagination.hasMore));
        setPage(pagination.page || nextPage);
        setTotal(pagination.total || nextItems.length);
      } catch (requestError) {
        const message = getErrorMessage(requestError, 'Unable to load activity right now.');
        setError(message);
        if (!append) {
          setActivities([]);
          setHasMore(false);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [deferredSearchTerm, filters.endDate, filters.entityType, filters.startDate, filters.userId]
  );

  useEffect(() => {
    loadNotifications();
    loadProjects();
  }, [loadNotifications, loadProjects]);

  useEffect(() => {
    loadActivity({ nextPage: 1 });
  }, [loadActivity]);

  const handleRefresh = async () => {
    await Promise.all([
      loadNotifications(),
      loadProjects(),
      loadActivity({ nextPage: 1, silent: true }),
    ]);
  };

  const totalByEntity = useMemo(() => {
    return activities.reduce(
      (summary, activity) => {
        const key = activity?.entityType || 'other';
        summary[key] = (summary[key] || 0) + 1;
        return summary;
      },
      { all: activities.length }
    );
  }, [activities]);

  return (
    <WorkspaceLayout
      activeNav="activity"
      title="Activity Log"
      subtitle="Track project, task, message, meeting, and shared-resource changes across SmartCollab."
      user={user}
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onDeleteNotification={handleDeleteNotification}
      onClearAllNotifications={handleClearAllNotifications}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search users, projects, tasks, or actions"
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      }
    >
      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">Visible Activities</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History size={16} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold text-slate-900">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Newest actions first</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">Task Activity</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Filter size={16} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold text-slate-900">{totalByEntity.task || 0}</p>
          <p className="mt-1 text-xs text-slate-500">Assignments, status, and completion</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">Messages & Meetings</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <CalendarRange size={16} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold text-slate-900">
            {(totalByEntity.message || 0) + (totalByEntity.meeting || 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Conversation and schedule changes</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">Team Members</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={16} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-semibold text-slate-900">{activityUsers.length}</p>
          <p className="mt-1 text-xs text-slate-500">Members across your accessible projects</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            <p className="mt-1 text-sm text-slate-500">
              Narrow the activity stream by entity type, teammate, and date range.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilters({
                entityType: 'all',
                userId: 'all',
                startDate: '',
                endDate: '',
              });
            }}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {ENTITY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilters((current) => ({ ...current, entityType: filter.id }))}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                filters.entityType === filter.id
                  ? 'border-violet-200 bg-violet-100 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Team Member
            <select
              value={filters.userId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, userId: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              <option value="all">All users</option>
              {activityUsers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Start Date
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, startDate: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            End Date
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endDate: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search matches user names, project names, task titles, and activity descriptions.
          </p>
        </div>

        <ActivityList
          activities={activities}
          loading={loading}
          error={error}
          onRetry={() => loadActivity({ nextPage: 1 })}
          onLoadMore={hasMore ? () => loadActivity({ nextPage: page + 1, append: true }) : null}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
          emptyTitle="No matching activity found"
          emptyDescription="Try adjusting the filters or search term to see more project history."
        />
      </section>
    </WorkspaceLayout>
  );
}
