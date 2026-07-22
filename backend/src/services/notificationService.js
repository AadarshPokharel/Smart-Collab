const Notification = require('../models/Notification');
const Project = require('../models/Project');
const Task = require('../models/Task');

const DAY_MS = 24 * 60 * 60 * 1000;

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

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

const buildDeadlineReminderPayload = ({ kind, item, projectTitle }) => {
  const dueDate = item?.dueDate ? new Date(item.dueDate) : null;
  if (!dueDate || !Number.isFinite(dueDate.getTime())) return null;

  const remainingMs = dueDate.getTime() - Date.now();
  const subject = kind === 'task' ? 'Task' : 'Project';
  const name = item?.title || 'Untitled';
  const metadata = {
    reminderDueDate: dueDate.toISOString(),
    projectTitle: projectTitle || null,
  };

  if (remainingMs < 0) {
    return {
      type: 'DeadlineReminder',
      title: `${subject} overdue`,
      message:
        kind === 'task'
          ? `Task “${name}” in ${projectTitle || 'your project'} is overdue.`
          : `Project “${name}” deadline has passed.`,
      reminderKey: `${kind}-overdue-${toObjectIdString(item._id)}-${dueDate.toISOString()}`,
      metadata,
    };
  }

  if (remainingMs <= DAY_MS) {
    return {
      type: 'DeadlineReminder',
      title: `${subject} due today`,
      message:
        kind === 'task'
          ? `Task “${name}” in ${projectTitle || 'your project'} is due within 24 hours.`
          : `Project “${name}” is due within 24 hours.`,
      reminderKey: `${kind}-due-today-${toObjectIdString(item._id)}-${dueDate.toISOString()}`,
      metadata,
    };
  }

  if (remainingMs <= 2 * DAY_MS) {
    return {
      type: 'DeadlineReminder',
      title: `${subject} due tomorrow`,
      message:
        kind === 'task'
          ? `Task “${name}” in ${projectTitle || 'your project'} is due tomorrow.`
          : `Project “${name}” is due tomorrow.`,
      reminderKey: `${kind}-due-tomorrow-${toObjectIdString(item._id)}-${dueDate.toISOString()}`,
      metadata,
    };
  }

  return null;
};

const syncDeadlineReminderNotificationsForUser = async (user) => {
  if (!user?._id || user?.preferences?.notifications?.deadlineReminders === false) {
    return [];
  }

  const projectQuery = user?.role === 'admin'
    ? {}
    : {
        $or: [{ owner: user._id }, { 'members.user': user._id }],
      };

  const projects = await Project.find(projectQuery).select('title dueDate status owner members');
  const projectIds = projects.map((project) => project._id);

  const taskQuery = projectIds.length
    ? {
        project: { $in: projectIds },
        assignedTo: user._id,
        status: { $ne: 'Done' },
        dueDate: { $ne: null },
      }
    : { _id: { $in: [] } };

  const tasks = await Task.find(taskQuery).select('title dueDate project status');
  const projectTitles = new Map(projects.map((project) => [toObjectIdString(project._id), project.title]));

  const reminderEntries = [];

  projects.forEach((project) => {
    if (!project?.dueDate || project?.status === 'Archived') return;

    const reminder = buildDeadlineReminderPayload({
      kind: 'project',
      item: project,
    });

    if (!reminder) return;

    reminderEntries.push({
      user: user._id,
      type: reminder.type,
      title: reminder.title,
      message: reminder.message,
      entityType: 'Project',
      entityId: project._id,
      metadata: {
        ...reminder.metadata,
        reminderKey: reminder.reminderKey,
        projectId: toObjectIdString(project._id),
      },
    });
  });

  tasks.forEach((task) => {
    const reminder = buildDeadlineReminderPayload({
      kind: 'task',
      item: task,
      projectTitle: projectTitles.get(toObjectIdString(task.project)) || 'your project',
    });

    if (!reminder) return;

    reminderEntries.push({
      user: user._id,
      type: reminder.type,
      title: reminder.title,
      message: reminder.message,
      entityType: 'Task',
      entityId: task._id,
      metadata: {
        ...reminder.metadata,
        reminderKey: reminder.reminderKey,
        projectId: toObjectIdString(task.project),
      },
    });
  });

  if (reminderEntries.length === 0) {
    return [];
  }

  const reminderKeys = reminderEntries.map((entry) => entry.metadata.reminderKey);
  const existingNotifications = await Notification.find({
    user: user._id,
    'metadata.reminderKey': { $in: reminderKeys },
  }).select('metadata.reminderKey');

  const existingKeys = new Set(
    existingNotifications
      .map((notification) => notification?.metadata?.reminderKey)
      .filter(Boolean)
  );

  const missingEntries = reminderEntries.filter(
    (entry) => !existingKeys.has(entry.metadata.reminderKey)
  );

  if (missingEntries.length === 0) {
    return [];
  }

  return createNotifications(missingEntries);
};

module.exports = {
  createNotification,
  createNotifications,
  syncDeadlineReminderNotificationsForUser,
};
