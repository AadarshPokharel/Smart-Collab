const Notification = require('../models/Notification');

const createNotification = async ({ user, type, title, message, entityType = null, entityId = null, metadata = {} }) => {
  if (!user || !title || !message) return null;

  return Notification.create({
    user,
    type,
    title,
    message,
    entityType,
    entityId,
    metadata,
  });
};

const createNotifications = async (entries = []) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const validEntries = entries.filter((entry) => entry && entry.user && entry.title && entry.message);
  if (validEntries.length === 0) return [];
  return Notification.insertMany(validEntries.map((entry) => ({
    user: entry.user,
    type: entry.type || 'Info',
    title: entry.title,
    message: entry.message,
    entityType: entry.entityType || null,
    entityId: entry.entityId || null,
    metadata: entry.metadata || {},
  })));
};

module.exports = {
  createNotification,
  createNotifications,
};