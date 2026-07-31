import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  formatDateTimeInTimeZone,
  getUserTimezone,
} from '../utils/userPreferences';

const NotificationDropdown = ({
  notifications,
  onMarkAllRead,
  onClearAll,
  onMarkRead,
  onDelete,
  emptyLabel = 'No new notifications',
  panelClassName = 'absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4',
}) => {
  const { user } = useAuth();
  const userTimeZone = getUserTimezone(user);
  const [displayNotifications, setDisplayNotifications] = useState(notifications);
  const [inviteActionId, setInviteActionId] = useState('');

  useEffect(() => {
    setDisplayNotifications(notifications);
  }, [notifications]);

  const getNotificationId = (note) => note?.id || note?._id || '';

  const isPendingProjectInvite = (note) =>
    ['ProjectInvite', 'project_invite'].includes(note?.type) &&
    note?.metadata?.projectId &&
    note?.metadata?.invitationId &&
    note?.metadata?.invitationStatus === 'pending';

  const hasPendingProjectInvites = useMemo(
    () => displayNotifications.some((note) => isPendingProjectInvite(note)),
    [displayNotifications]
  );

  const updateInviteNotificationState = (notificationId, nextStatus, nextMessage) => {
    setDisplayNotifications((current) =>
      current.map((note) => {
        if (getNotificationId(note) !== notificationId) {
          return note;
        }

        return {
          ...note,
          read: true,
          title: nextStatus === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
          message: nextMessage || note.message,
          metadata: {
            ...note.metadata,
            invitationStatus: nextStatus,
          },
        };
      })
    );
  };

  const handleInviteResponse = async (note, responseType, event) => {
    event.stopPropagation();

    const notificationId = getNotificationId(note);
    const projectId = note?.metadata?.projectId;
    const invitationId = note?.metadata?.invitationId;

    if (!notificationId || !projectId || !invitationId) {
      toast.error('Invitation details are missing.');
      return;
    }

    const endpoint =
      responseType === 'accept'
        ? `/projects/${projectId}/invitations/${invitationId}/accept`
        : `/projects/${projectId}/invitations/${invitationId}/decline`;

    try {
      setInviteActionId(notificationId);
      const { data } = await api.post(endpoint);
      updateInviteNotificationState(
        notificationId,
        responseType === 'accept' ? 'accepted' : 'declined',
        data?.message
      );

      if (!note?.read) {
        onMarkRead?.(note);
      }

      toast.success(
        data?.message ||
          (responseType === 'accept'
            ? 'Invitation accepted successfully.'
            : 'Invitation declined.')
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          `Failed to ${responseType} invitation.`
      );
    } finally {
      setInviteActionId('');
    }
  };

  const handleClearAllClick = async () => {
    const removableNotifications = displayNotifications.filter(
      (note) => !isPendingProjectInvite(note)
    );

    if (removableNotifications.length === 0) {
      return;
    }

    if (!hasPendingProjectInvites) {
      onClearAll?.();
      return;
    }

    await Promise.allSettled(removableNotifications.map((note) => onDelete?.(note)));
    setDisplayNotifications((current) => current.filter((note) => isPendingProjectInvite(note)));
  };

  return (
    <div className={panelClassName}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Notifications</p>
        <div className="flex items-center gap-3 text-xs font-medium">
          <button className="text-violet-600 hover:text-violet-700" onClick={onMarkAllRead}>
            Mark all as read
          </button>
          <button className="text-slate-500 hover:text-slate-700" onClick={handleClearAllClick}>
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-auto">
        {displayNotifications.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-6">{emptyLabel}</div>
        ) : (
          displayNotifications.map((note, index) => {
            const isRead = !!note?.read;
            const title = note?.title || note?.text || note?.message || 'Notification';
            const message = note?.message || note?.text || title;
            const timeValue = note?.createdAt || note?.timestamp || null;
            const pendingInvite = isPendingProjectInvite(note);
            const actionBusy = inviteActionId === getNotificationId(note);
            const time = timeValue
              ? formatDateTimeInTimeZone(timeValue, userTimeZone, undefined, '')
              : note?.time || '';

            return (
              <div
                key={note?.id || note?._id || index}
                className={`group p-3 rounded-lg border text-sm transition-all duration-200 ${
                  isRead ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'
                }`}
                onClick={() => onMarkRead(note)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-700 font-medium">{title}</p>
                    {message && message !== title ? (
                      <p className="mt-1 text-xs leading-5 text-slate-500">{message}</p>
                    ) : null}
                    {pendingInvite ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          disabled={actionBusy}
                          onClick={(event) => handleInviteResponse(note, 'accept', event)}
                        >
                          {actionBusy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Accept
                        </button>
                        <button
                          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={actionBusy}
                          onClick={(event) => handleInviteResponse(note, 'decline', event)}
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                    {time && <p className="text-xs text-slate-500 mt-2">{time}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isRead && <span className="w-2 h-2 bg-violet-500 rounded-full mt-1 transition-all duration-200" />}
                    {!pendingInvite ? (
                      <button
                        className="text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(note, event);
                        }}
                        aria-label="Delete notification"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
