import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Moon,
  Save,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services';
import api from '../services/api';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { normalizeNotifications } from '../utils/notifications';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

const TAB_CONFIG = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'preferences', label: 'Preferences', icon: Bell },
];

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const isLocalPasswordAccount = (user) => (user?.authProvider || 'local') === 'local';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, updateCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState([]);
  const [loadingTab, setLoadingTab] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    avatar: user?.avatar || '',
    bio: user?.bio || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [preferencesForm, setPreferencesForm] = useState({
    timezone: user?.preferences?.timezone || 'UTC',
    theme: user?.preferences?.theme || 'light',
    notifications: {
      taskAssignments: user?.preferences?.notifications?.taskAssignments !== false,
      deadlineReminders: user?.preferences?.notifications?.deadlineReminders !== false,
      messageNotifications: user?.preferences?.notifications?.messageNotifications !== false,
      projectUpdates: user?.preferences?.notifications?.projectUpdates !== false,
    },
  });

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      avatar: user?.avatar || '',
      bio: user?.bio || '',
    });

    setPreferencesForm({
      timezone: user?.preferences?.timezone || 'UTC',
      theme: user?.preferences?.theme || 'light',
      notifications: {
        taskAssignments: user?.preferences?.notifications?.taskAssignments !== false,
        deadlineReminders: user?.preferences?.notifications?.deadlineReminders !== false,
        messageNotifications: user?.preferences?.notifications?.messageNotifications !== false,
        projectUpdates: user?.preferences?.notifications?.projectUpdates !== false,
      },
    });
  }, [user]);

  useEffect(() => {
    if (!saveSuccess) return undefined;

    const timeoutId = window.setTimeout(() => setSaveSuccess(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [saveSuccess]);

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

  useEffect(() => {
    loadNotifications();
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

  const profileCompletion = useMemo(() => {
    let score = 0;
    if (profileForm.firstName.trim()) score += 1;
    if (profileForm.lastName.trim()) score += 1;
    if (profileForm.bio.trim()) score += 1;
    if (profileForm.avatar.trim()) score += 1;
    return `${score}/4 completed`;
  }, [profileForm]);

  const togglePasswordVisibility = (field) => {
    setShowPasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      toast.error('First and last names are required.');
      return;
    }

    try {
      setLoadingTab('profile');
      const response = await authService.updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        avatar: profileForm.avatar.trim(),
        bio: profileForm.bio.trim(),
      });

      if (response.data?.user) {
        updateCurrentUser(response.data.user);
      }

      setSaveSuccess('profile');
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update profile.'));
    } finally {
      setLoadingTab('');
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (!passwordForm.currentPassword) {
      toast.error('Current password is required.');
      return;
    }

    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    try {
      setLoadingTab('password');
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSaveSuccess('password');
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to change password.'));
    } finally {
      setLoadingTab('');
    }
  };

  const handleSavePreferences = async (event) => {
    event.preventDefault();

    try {
      setLoadingTab('preferences');
      const response = await authService.updatePreferences({
        timezone: preferencesForm.timezone,
        theme: preferencesForm.theme,
        notifications: preferencesForm.notifications,
      });

      if (response.data?.user) {
        updateCurrentUser(response.data.user);
      }

      setSaveSuccess('preferences');
      toast.success('Preferences updated successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update preferences.'));
    } finally {
      setLoadingTab('');
    }
  };

  const renderSuccess = (key, message) =>
    saveSuccess === key ? (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      </div>
    ) : null;

  return (
    <WorkspaceLayout
      activeNav="settings"
      title="Settings"
      subtitle="Manage your SmartCollab account details, security, and personal preferences in one place."
      user={user}
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      onDeleteNotification={handleDeleteNotification}
      onClearAllNotifications={handleClearAllNotifications}
    >
      <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account overview
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
            <p className="mt-4 text-xs text-slate-500">Profile progress</p>
            <p className="mt-1 text-sm font-semibold text-violet-600">{profileCompletion}</p>
          </div>

          <div className="mt-4 space-y-2">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Profile Information</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Update how your name and profile details appear across SmartCollab.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      First name
                    </label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, firstName: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Enter your first name"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Last name
                    </label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, lastName: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Enter your last name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Avatar URL
                    </label>
                    <input
                      type="url"
                      value={profileForm.avatar}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, avatar: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Bio</label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, bio: event.target.value }))
                      }
                      rows={5}
                      maxLength={500}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Tell your team a little about yourself"
                    />
                    <p className="mt-2 text-xs text-slate-400">{profileForm.bio.length}/500</p>
                  </div>
                </div>

                {renderSuccess('profile', 'Profile saved successfully')}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingTab === 'profile'}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Save size={16} />
                    {loadingTab === 'profile' ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Password & Security</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Keep your SmartCollab account secure with a strong password.
                </p>
              </div>

              {!isLocalPasswordAccount(user) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">External sign-in account</p>
                      <p className="mt-1">
                        This account uses {user?.authProvider || 'external'} authentication. Change your password through that provider instead of SmartCollab.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Enter your current password"
                      disabled={!isLocalPasswordAccount(user)}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.next ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Enter a new password"
                      disabled={!isLocalPasswordAccount(user)}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('next')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      {showPasswords.next ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Minimum 6 characters.</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Re-enter your new password"
                      disabled={!isLocalPasswordAccount(user)}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('confirm')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {renderSuccess('password', 'Password changed successfully')}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingTab === 'password' || !isLocalPasswordAccount(user)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Lock size={16} />
                    {loadingTab === 'password' ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Preferences</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Control how SmartCollab displays time, theme, and account notifications for you.
                </p>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Globe size={16} />
                      Timezone
                    </label>
                    <select
                      value={preferencesForm.timezone}
                      onChange={(event) =>
                        setPreferencesForm((current) => ({
                          ...current,
                          timezone: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    >
                      {TIMEZONES.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                    <p className="mt-3 text-xs text-slate-400">
                      Used to display task deadlines, timestamps, and reminders.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      {preferencesForm.theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                      Theme preference
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                      ].map((themeOption) => {
                        const ThemeIcon = themeOption.icon;
                        const isActive = preferencesForm.theme === themeOption.id;

                        return (
                          <button
                            key={themeOption.id}
                            type="button"
                            onClick={() =>
                              setPreferencesForm((current) => ({
                                ...current,
                                theme: themeOption.id,
                              }))
                            }
                            className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-medium transition ${
                              isActive
                                ? 'border-violet-200 bg-violet-50 text-violet-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
                            }`}
                          >
                            <ThemeIcon size={16} />
                            <span>{themeOption.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <p className="text-sm font-semibold text-slate-700">Notification preferences</p>
                  <div className="mt-4 space-y-4">
                    {[
                      {
                        key: 'taskAssignments',
                        title: 'Task assignments',
                        description: 'Notify me when a task is assigned to me.',
                      },
                      {
                        key: 'deadlineReminders',
                        title: 'Deadline reminders',
                        description: 'Notify me before tasks are due.',
                      },
                      {
                        key: 'messageNotifications',
                        title: 'Message notifications',
                        description: 'Notify me when new project messages arrive.',
                      },
                      {
                        key: 'projectUpdates',
                        title: 'Project updates',
                        description: 'Notify me when my projects are updated.',
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
                      >
                        <input
                          type="checkbox"
                          checked={preferencesForm.notifications[item.key]}
                          onChange={(event) =>
                            setPreferencesForm((current) => ({
                              ...current,
                              notifications: {
                                ...current.notifications,
                                [item.key]: event.target.checked,
                              },
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                        />
                        <span className="min-w-0">
                          <strong className="block text-sm text-slate-900">{item.title}</strong>
                          <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {renderSuccess('preferences', 'Preferences saved successfully')}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingTab === 'preferences'}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Save size={16} />
                    {loadingTab === 'preferences' ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </WorkspaceLayout>
  );
}
