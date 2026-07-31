import React from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Link2,
  Loader2,
  MessageSquare,
  PencilLine,
  Trash2,
  UserPlus,
  UserMinus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  formatDateTimeInTimeZone,
  getUserTimezone,
} from '../utils/userPreferences';

const FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  dueDate: 'Due Date',
  dueTimezone: 'Time Zone',
  meetingLink: 'Meeting Link',
  scheduledFor: 'Scheduled For',
  timezone: 'Time Zone',
  participants: 'Participants',
  assignedToId: 'Assignee',
  assignedToName: 'Assignee',
  project: 'Project',
  memberName: 'Member',
  role: 'Role',
  type: 'Type',
  url: 'Link',
  content: 'Message',
};

const getInitials = (name = 'U') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

const formatDateTime = (value, timeZone) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown time';

  return formatDateTimeInTimeZone(
    value,
    timeZone,
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    'Unknown time'
  );
};

const formatRelativeTime = (value, timeZone) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateTime(value, timeZone);
};

const formatValue = (value, timeZone) => {
  if (value === null || value === undefined || value === '') return 'None';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';

  if (typeof value === 'string') {
    const asDate = new Date(value);
    if (
      /\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(asDate.getTime())
    ) {
      return formatDateTime(value, timeZone);
    }
    return value;
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildChangeRows = (activity, timeZone) => {
  const oldValue =
    activity?.oldValue && typeof activity.oldValue === 'object' && !Array.isArray(activity.oldValue)
      ? activity.oldValue
      : {};
  const newValue =
    activity?.newValue && typeof activity.newValue === 'object' && !Array.isArray(activity.newValue)
      ? activity.newValue
      : {};

  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));

  return keys.map((key) => ({
    key,
    label: FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()),
    oldValue: formatValue(oldValue[key], timeZone),
    newValue: formatValue(newValue[key], timeZone),
  }));
};

const getActivityVisual = (activity) => {
  if (activity?.actionType === 'deleted') {
    return {
      icon: Trash2,
      bubble: 'bg-rose-50 text-rose-600 border-rose-100',
    };
  }

  if (activity?.actionType === 'completed') {
    return {
      icon: CheckCircle2,
      bubble: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    };
  }

  if (activity?.actionType === 'member_added') {
    return {
      icon: UserPlus,
      bubble: 'bg-sky-50 text-sky-600 border-sky-100',
    };
  }

  if (activity?.actionType === 'member_removed') {
    return {
      icon: UserMinus,
      bubble: 'bg-amber-50 text-amber-700 border-amber-100',
    };
  }

  if (activity?.actionType === 'updated') {
    return {
      icon: PencilLine,
      bubble: 'bg-violet-50 text-violet-600 border-violet-100',
    };
  }

  switch (activity?.entityType) {
    case 'task':
      return { icon: CheckSquare, bubble: 'bg-violet-50 text-violet-600 border-violet-100' };
    case 'message':
      return { icon: MessageSquare, bubble: 'bg-sky-50 text-sky-600 border-sky-100' };
    case 'meeting':
      return { icon: CalendarClock, bubble: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'resource':
      return { icon: Link2, bubble: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    case 'project':
      return { icon: FolderKanban, bubble: 'bg-slate-100 text-slate-700 border-slate-200' };
    default:
      return { icon: Users, bubble: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
};

const getVisiblePageNumbers = (currentPage, totalPages) => {
  if (!totalPages || totalPages <= 1) {
    return [];
  }

  const maxVisible = 5;
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const LoadingState = ({ compact = false }) => (
  <div className="space-y-3">
    {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
      <div
        key={index}
        className={`animate-pulse rounded-2xl border border-slate-200 bg-white ${
          compact ? 'p-4' : 'p-5'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            {!compact && <div className="h-3 w-4/5 rounded bg-slate-100" />}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default function ActivityList({
  activities = [],
  loading = false,
  error = '',
  compact = false,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Team actions will appear here once work starts moving across projects.',
  onRetry = null,
  onLoadMore = null,
  hasMore = false,
  loadingMore = false,
  showProject = true,
  onOpenProject = null,
  page = 1,
  totalPages = 0,
  totalItems = 0,
  pageSize = 0,
  onPageChange = null,
}) {
  const { user } = useAuth();
  const userTimeZone = getUserTimezone(user);

  if (loading) {
    return <LoadingState compact={compact} />;
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
        <AlertCircle size={30} className="text-rose-400" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Unable to load activity</h3>
        <p className="mt-2 max-w-lg text-sm text-rose-700">{error}</p>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="mt-5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <Users size={30} className="text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">{emptyTitle}</h3>
        <p className="mt-2 max-w-lg text-sm text-slate-500">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const userName = activity?.user?.displayName || activity?.metadata?.userName || 'Someone';
        const projectTitle = activity?.project?.title || activity?.metadata?.projectTitle || 'Untitled project';
        const { icon: Icon, bubble } = getActivityVisual(activity);
        const changeRows = compact ? [] : buildChangeRows(activity, userTimeZone);
        const canOpenProject =
          Boolean(onOpenProject && activity?.projectId) &&
          !activity?.metadata?.projectDeleted &&
          !(activity?.entityType === 'project' && activity?.actionType === 'deleted');

        return (
          <article
            key={activity.id || activity._id}
            className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${
              compact ? 'p-4' : 'p-5'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                {activity?.user?.avatar ? (
                  <img
                    src={activity.user.avatar}
                    alt={userName}
                    className="h-11 w-11 rounded-2xl object-cover"
                  />
                ) : (
                  getInitials(userName)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{userName}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${bubble}`}>
                        <Icon size={12} />
                        {activity.entityType}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{activity.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {showProject ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                          <FolderKanban size={12} />
                          {projectTitle}
                        </span>
                      ) : null}
                      <span>{formatDateTime(activity.createdAt, userTimeZone)}</span>
                      <span>{formatRelativeTime(activity.createdAt, userTimeZone)}</span>
                    </div>
                  </div>

                  {canOpenProject ? (
                    <button
                      onClick={() => onOpenProject(activity.projectId)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Open project
                    </button>
                  ) : null}
                </div>

                {!compact && changeRows.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {changeRows.map((row) => (
                        <div key={row.key} className="rounded-xl bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {row.label}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">Before</p>
                          <p className="mt-1 text-sm text-slate-700">{row.oldValue}</p>
                          <p className="mt-3 text-xs text-slate-500">After</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{row.newValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}

      {onLoadMore && hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null}
            {loadingMore ? 'Loading more' : 'Load more'}
          </button>
        </div>
      ) : null}

      {onPageChange && totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            Showing{' '}
            <span className="font-semibold text-slate-900">
              {Math.min((page - 1) * pageSize + 1, totalItems || activities.length)}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-900">
              {Math.min(page * pageSize, totalItems || activities.length)}
            </span>{' '}
            of <span className="font-semibold text-slate-900">{totalItems}</span> activities
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            {getVisiblePageNumbers(page, totalPages).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                disabled={loading}
                className={`min-w-[40px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  pageNumber === page
                    ? 'border-violet-200 bg-violet-100 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                } disabled:cursor-not-allowed`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
