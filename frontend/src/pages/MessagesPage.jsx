import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Clock3,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { normalizeNotifications } from '../utils/notifications';

const POLL_INTERVAL_MS = 12000;

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getAvatarColor = (userId = '') => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  if (!userId) return colors[0];

  const first = userId.charCodeAt(0) || 0;
  const last = userId.charCodeAt(userId.length - 1) || 0;
  return colors[(first + last) % colors.length];
};

const getInitials = (firstName, lastName) =>
  `${firstName?.[0] || 'U'}${lastName?.[0] || 'U'}`.toUpperCase();

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const currentUserId = user?._id || '';

  const [conversations, setConversations] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const messagesEndRef = useRef(null);

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
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      reloadNotifications().catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));

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

    setNotifications((previous) =>
      previous.filter((item) => (item.id || item._id) !== notificationId)
    );

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

  const loadConversations = useCallback(
    async ({ showSpinner = false } = {}) => {
      try {
        if (showSpinner) {
          setLoadingConversations(true);
        } else {
          setRefreshing(true);
        }

        setConversationError('');
        const response = await api.get('/messages/conversations');
        const nextConversations = Array.isArray(response.data?.data) ? response.data.data : [];

        setConversations(nextConversations);
        setLastSyncedAt(new Date().toISOString());
        setSelectedProjectId((currentProjectId) => {
          if (!nextConversations.length) return '';
          if (currentProjectId && nextConversations.some((item) => item.projectId === currentProjectId)) {
            return currentProjectId;
          }
          return nextConversations[0].projectId;
        });
      } catch (error) {
        setConversationError(getErrorMessage(error, 'Failed to load conversations.'));
      } finally {
        if (showSpinner) {
          setLoadingConversations(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    []
  );

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.projectId === selectedProjectId) || null,
    [conversations, selectedProjectId]
  );

  const loadMessages = useCallback(
    async (projectId, { showSpinner = true } = {}) => {
      if (!projectId) {
        setMessages([]);
        return;
      }

      try {
        if (showSpinner) {
          setLoadingMessages(true);
        }

        setMessageError('');
        const response = await api.get(`/messages/${projectId}`, {
          params: { page: 1, limit: 100 },
        });

        const nextMessages = Array.isArray(response.data?.data) ? response.data.data : [];
        setMessages(nextMessages);
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.projectId === projectId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      } catch (error) {
        setMessageError(getErrorMessage(error, 'Failed to load messages.'));
      } finally {
        if (showSpinner) {
          setLoadingMessages(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadConversations({ showSpinner: true });
    loadNotifications();
  }, [loadConversations, loadNotifications]);

  useEffect(() => {
    if (selectedProjectId) {
      loadMessages(selectedProjectId, { showSpinner: true });
    } else {
      setMessages([]);
      setMessageError('');
    }
  }, [selectedProjectId, loadMessages]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadConversations();
      if (selectedProjectId) {
        loadMessages(selectedProjectId, { showSpinner: false });
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadConversations, loadMessages, selectedProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return conversations;

    return conversations.filter((conversation) => {
      const searchable = [
        conversation.title,
        conversation.latestMessage,
        conversation.latestMessageSender?.firstName,
        conversation.latestMessageSender?.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [conversations, searchTerm]);

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!selectedConversation || !messageInput.trim() || sendingMessage) {
      return;
    }

    const content = messageInput.trim();
    setSendingMessage(true);
    setMessageInput('');

    try {
      const response = await api.post('/messages', {
        projectId: selectedConversation.projectId,
        content,
      });

      const newMessage = response.data?.data;
      if (newMessage) {
        setMessages((previous) => [...previous, newMessage]);
      }

      setConversations((previous) =>
        previous
          .map((conversation) =>
            conversation.projectId === selectedConversation.projectId
              ? {
                ...conversation,
                latestMessage: content,
                latestMessageTime: newMessage?.createdAt || new Date().toISOString(),
                latestMessageSender: newMessage?.sender || null,
              }
              : conversation
          )
          .sort((left, right) => new Date(right.latestMessageTime) - new Date(left.latestMessageTime))
      );
    } catch (error) {
      setMessageInput(content);
      toast.error(getErrorMessage(error, 'Failed to send message.'));
    } finally {
      setSendingMessage(false);
    }
  };

  const hasProjects = conversations.length > 0;

  return (
    <WorkspaceLayout
      activeNav="messages"
      title="Messages"
      subtitle="Talk with your team inside each project workspace and keep collaboration tied to the work itself."
      user={user}
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onDeleteNotification={handleDeleteNotification}
      onClearAllNotifications={handleClearAllNotifications}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search conversations"
      actions={
        <button
          onClick={() => {
            loadConversations();
            if (selectedProjectId) {
              loadMessages(selectedProjectId, { showSpinner: false });
            }
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          Refresh
        </button>
      }
    >
      {conversationError && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p>{conversationError}</p>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div
          className={`rounded-3xl border border-slate-200/70 bg-white shadow-sm ${
            selectedConversation ? 'hidden xl:flex xl:flex-col' : 'flex flex-col'
          }`}
        >
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Project Conversations</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <MessageSquare size={18} />
              </div>
            </div>
          </div>

          {loadingConversations ? (
            <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-violet-500" />
              <p className="text-sm">Loading conversations...</p>
            </div>
          ) : !hasProjects ? (
            <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
              <MessageSquare size={34} className="text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No project chats yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Join or create a project to start messaging your team.
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
              <AlertCircle size={32} className="text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No matching conversations</h3>
              <p className="mt-2 text-sm text-slate-500">
                Try a different project name or message keyword.
              </p>
            </div>
          ) : (
              <div className="max-h-[720px] flex-1 space-y-2 overflow-y-auto p-3">
              {filteredConversations.map((conversation) => {
                const isActive = conversation.projectId === selectedProjectId;

                return (
                  <button
                    key={conversation.projectId}
                    onClick={() => setSelectedProjectId(conversation.projectId)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-violet-200 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {conversation.title}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <Users size={12} />
                          {conversation.membersCount} member{conversation.membersCount !== 1 ? 's' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {conversation.nextMeeting?.scheduledFor ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                              <CalendarClock size={12} />
                              {formatRelativeTime(conversation.nextMeeting.scheduledFor)}
                            </span>
                          ) : null}
                          {conversation.sharedResourcesCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              <Link2 size={12} />
                              {conversation.sharedResourcesCount} resource{conversation.sharedResourcesCount === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formatRelativeTime(conversation.latestMessageTime)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                      {conversation.latestMessage || 'No messages yet. Start the conversation.'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className={`rounded-3xl border border-slate-200/70 bg-white shadow-sm ${
            selectedConversation ? 'flex flex-col' : 'hidden xl:flex xl:flex-col'
          }`}
        >
          {!selectedConversation ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-6 text-center">
              <MessageSquare size={36} className="text-slate-300" />
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Select a conversation</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Choose a project from the left to read or send messages.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setSelectedProjectId('')}
                      className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 xl:hidden"
                      aria-label="Back to conversation list"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {selectedConversation.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Users size={14} />
                          {selectedConversation.membersCount} member{selectedConversation.membersCount !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={14} />
                          Last active {formatRelativeTime(selectedConversation.latestMessageTime)}
                        </span>
                        {lastSyncedAt ? (
                          <span className="inline-flex items-center gap-1">
                            <RefreshCcw size={14} />
                            Synced {formatRelativeTime(lastSyncedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(selectedConversation.nextMeeting || selectedConversation.sharedResourcesCount > 0) && (
                <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                  <div className="flex flex-wrap gap-3">
                    {selectedConversation.nextMeeting?.scheduledFor ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">
                          Next meeting: {selectedConversation.nextMeeting.title}
                        </p>
                        <p className="mt-1">
                          {formatMessageTime(selectedConversation.nextMeeting.scheduledFor)}
                        </p>
                        {selectedConversation.nextMeeting.meetingLink ? (
                          <a
                            href={selectedConversation.nextMeeting.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                          >
                            Open meeting link
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedConversation.sharedResourcesCount > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">Shared resources</p>
                        <p className="mt-1">
                          {selectedConversation.sharedResourcesCount} file/link item
                          {selectedConversation.sharedResourcesCount === 1 ? '' : 's'} connected to this project.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {messageError && (
                <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <p>{messageError}</p>
                  </div>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <p className="text-sm">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
                  <MessageSquare size={36} className="text-slate-300" />
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">No messages yet</h3>
                  <p className="mt-2 max-w-md text-sm text-slate-500">
                    Start the conversation with your project team.
                  </p>
                </div>
              ) : (
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  {messages.map((message) => {
                    const isOwnMessage = message.sender?._id === currentUserId;

                    return (
                      <div
                        key={message._id}
                        className={`flex gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isOwnMessage && (
                          <div
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: getAvatarColor(message.sender?._id) }}
                          >
                            {getInitials(message.sender?.firstName, message.sender?.lastName)}
                          </div>
                        )}

                        <div className={`max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!isOwnMessage && (
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {message.sender?.firstName} {message.sender?.lastName}
                            </p>
                          )}

                          <div
                            className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                              isOwnMessage
                                ? 'bg-violet-600 text-white'
                                : 'border border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                          >
                            {message.content}
                          </div>

                          <span className="mt-2 text-xs text-slate-400">
                            {formatMessageTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-200 bg-slate-50/80 px-5 py-4"
              >
                <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <textarea
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder="Type a message..."
                    rows={1}
                    maxLength={1000}
                    className="max-h-40 min-h-[48px] flex-1 resize-y rounded-xl border-0 bg-transparent px-3 py-2 text-sm focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendingMessage}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    aria-label="Send message"
                  >
                    {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-slate-400">
                  <span>Project messages are visible to everyone in this workspace.</span>
                  <span>{messageInput.trim().length}/1000</span>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
