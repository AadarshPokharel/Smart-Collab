const STORAGE_KEY = 'smartcollab.notificationReadIds';

const getKey = (notification) => notification?.id || notification?._id || notification?.key || null;

const loadReadIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveReadIds = (ids) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Ignore storage failures.
  }
};

export const applyReadState = (notifications = []) => {
  const readIds = new Set(loadReadIds());
  return notifications.map((notification) => {
    const key = getKey(notification);
    return key && readIds.has(key) ? { ...notification, read: true } : notification;
  });
};

export const markNotificationRead = (notifications = [], notification) => {
  const key = getKey(notification);
  if (!key) return notifications;

  const readIds = new Set(loadReadIds());
  readIds.add(key);
  saveReadIds([...readIds]);

  return notifications.map((item) => {
    const itemKey = getKey(item);
    return itemKey === key ? { ...item, read: true } : item;
  });
};

export const markAllNotificationsRead = (notifications = []) => {
  const readIds = notifications.map(getKey).filter(Boolean);
  const existing = new Set(loadReadIds());
  readIds.forEach((id) => existing.add(id));
  saveReadIds([...existing]);

  return notifications.map((notification) => ({ ...notification, read: true }));
};
