import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Check, CheckSquare, Clock, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const NotificationsPanel = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/notifications');
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await axios.put('/api/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkOneRead = async (notificationId) => {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n =>
        n._id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to update notification');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TaskAssigned':
      case 'task_assigned':
        return CheckSquare;
      case 'DeadlineReminder':
      case 'deadline_reminder':
        return Clock;
      case 'NewMessage':
      case 'new_message':
        return MessageSquare;
      case 'ProjectInvite':
      case 'project_invite':
        return UserPlus;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'TaskAssigned':
      case 'task_assigned':
        return 'violet';
      case 'DeadlineReminder':
      case 'deadline_reminder':
        return 'orange';
      case 'NewMessage':
      case 'new_message':
        return 'blue';
      case 'ProjectInvite':
      case 'project_invite':
        return 'green';
      default:
        return 'gray';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const NotificationItem = ({ notification }) => {
    const IconComponent = getNotificationIcon(notification.type);
    const color = getNotificationColor(notification.type);
    const colorMap = {
      violet: 'text-violet-600',
      orange: 'text-orange-600',
      blue: 'text-blue-600',
      green: 'text-green-600',
      gray: 'text-gray-600'
    };

    return (
      <div className={`flex items-start gap-3 p-4 rounded-lg transition-colors ${
        notification.read
          ? 'bg-white hover:bg-gray-50'
          : 'bg-violet-50 border-l-4 border-l-violet-600'
      }`}>
        <div className="flex-shrink-0 mt-1">
          <IconComponent size={20} className={colorMap[color]} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {notification.title}
          </p>
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
            {notification.message}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {formatTimeAgo(notification.timestamp)}
          </p>
        </div>
        {!notification.read && (
          <button
            onClick={() => handleMarkOneRead(notification._id)}
            className="flex-shrink-0 p-2 text-violet-600 hover:bg-violet-100 rounded-md transition-colors"
            title="Mark as read"
          >
            <Check size={18} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-violet-600" />
          <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-violet-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="px-3 py-1 text-sm font-medium text-violet-600 hover:bg-violet-50 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {markingAll ? <Loader2 size={16} className="animate-spin" /> : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          // Loading skeleton
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          // Empty state
          <div className="p-12 text-center">
            <BellOff size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 font-medium">You are all caught up</p>
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          // Notifications list
          <div className="divide-y divide-gray-100 p-4 space-y-2">
            {notifications.map(notification => (
              <NotificationItem
                key={notification._id}
                notification={notification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
