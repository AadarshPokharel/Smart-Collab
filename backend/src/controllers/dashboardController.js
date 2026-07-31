const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { fetchActivities } = require('../services/activityService');
const {
  getTaskStatsByProject,
  serializeProjectSummary,
} = require('../services/projectSummaryService');
const { syncDeadlineReminderNotificationsForUser } = require('../services/notificationService');

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const toObjectIdString = (value) => {
  if (!value) return null;
  return value._id ? value._id.toString() : value.toString();
};

const normalizeTaskStatus = (status) => (status === 'Done' ? 'Done' : 'To Do');

const isTaskAssignedToUser = (task, userId) => {
  return toObjectIdString(task.assignedTo) === toObjectIdString(userId);
};

const getAccessibleProjects = async (userId) => {
  return Project.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  })
    .populate('owner', 'firstName lastName email avatar')
    .populate({
      path: 'members.user',
      select: 'firstName lastName email avatar',
    })
    .sort({ createdAt: -1 });
};

const getAccessibleTasks = async (projectIds) => {
  if (!projectIds.length) return [];

  return Task.find({ project: { $in: projectIds } })
    .populate('project', 'title')
    .populate('assignedTo', 'firstName lastName email avatar')
    .populate('assignedBy', 'firstName lastName email avatar')
    .sort({ createdAt: -1 });
};

const buildStats = ({ projects, tasks, now, userId }) => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const myTasks = tasks.filter((task) => isTaskAssignedToUser(task, userId));

  return {
    totalProjects: projects.length,
    tasksDueToday: myTasks.filter((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return dueDate && dueDate >= todayStart && dueDate <= todayEnd && normalizeTaskStatus(task.status) !== 'Done';
    }).length,
    inProgressTasks: myTasks.filter((task) => normalizeTaskStatus(task.status) !== 'Done').length,
    completedTasks: myTasks.filter((task) => normalizeTaskStatus(task.status) === 'Done').length,
  };
};

const formatNotification = (notification) => ({
  id: notification._id,
  type: notification.type,
  title: notification.title,
  text: notification.message,
  message: notification.message,
  time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '',
  timestamp: notification.createdAt,
  read: !!notification.read,
  entityType: notification.entityType || null,
  entityId: notification.entityId || null,
  metadata: notification.metadata || {},
});

exports.getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const projects = await getAccessibleProjects(req.user._id);
    const projectIds = projects.map((project) => project._id);
    const tasks = await getAccessibleTasks(projectIds);
    const myTasks = tasks.filter((task) => isTaskAssignedToUser(task, req.user._id));
    const taskStatsByProject = await getTaskStatsByProject(projectIds);
    const activityResult = await fetchActivities({
      user: req.user,
      page: 1,
      limit: 8,
    });

    await syncDeadlineReminderNotificationsForUser(req.user);

    const upcomingMeetings = projects
      .flatMap((project) => {
        const meetings = Array.isArray(project.meetings) ? project.meetings : [];
        return meetings
          .filter((meeting) => meeting?.scheduledFor && meeting?.status !== 'Cancelled')
          .map((meeting) => ({
            id: meeting._id,
            title: meeting.title,
            description: meeting.description || '',
            scheduledFor: meeting.scheduledFor,
            timezone: meeting.timezone || project.dueTimezone || null,
            projectId: project._id,
            projectTitle: project.title,
            meetingLink: meeting.meetingLink || '',
          }));
      })
      .filter((meeting) => new Date(meeting.scheduledFor).getTime() >= Date.now())
      .sort((left, right) => new Date(left.scheduledFor) - new Date(right.scheduledFor))
      .slice(0, 5);

    const recentResources = projects
      .flatMap((project) => {
        const resources = Array.isArray(project.sharedResources) ? project.sharedResources : [];
        return resources.map((resource) => ({
          id: resource._id,
          title: resource.title,
          description: resource.description || '',
          type: resource.type || 'link',
          url: resource.url || '',
          createdAt: resource.createdAt || project.updatedAt,
          projectId: project._id,
          projectTitle: project.title,
        }));
      })
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        stats: buildStats({ projects, tasks, now, userId: req.user._id }),
        tasks: myTasks.map((task) => ({
          id: task._id,
          title: task.title,
          project: task.project?.title || 'Untitled project',
          projectId: task.project?._id || task.project,
          dueDate: task.dueDate,
          dueTimezone: task.dueTimezone,
          priority: task.priority,
          status: normalizeTaskStatus(task.status),
          description: task.description,
          assignedTo: task.assignedTo
            ? {
              id: task.assignedTo._id,
              firstName: task.assignedTo.firstName,
              lastName: task.assignedTo.lastName,
              email: task.assignedTo.email,
            }
            : null,
          assignedBy: task.assignedBy
            ? {
              id: task.assignedBy._id,
              firstName: task.assignedBy.firstName,
              lastName: task.assignedBy.lastName,
              email: task.assignedBy.email,
            }
            : null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        })),
        projects: projects.map((project) =>
          serializeProjectSummary(project, taskStatsByProject.get(project._id.toString()))
        ),
        notifications: await Notification.find({ user: req.user._id })
          .sort({ createdAt: -1 })
          .limit(8)
          .then((items) => items.map(formatNotification)),
        activity: activityResult.data,
        upcomingMeetings,
        recentResources,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const projects = await getAccessibleProjects(req.user._id);
    const projectIds = projects.map((project) => project._id);
    const tasks = await getAccessibleTasks(projectIds);

    res.status(200).json({
      success: true,
      stats: buildStats({ projects, tasks, now, userId: req.user._id }),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getDashboardActivity = async (req, res) => {
  try {
    const activityResult = await fetchActivities({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit || 8,
      projectId: req.query.projectId || null,
      userId: req.query.userId || null,
      entityType:
        req.query.entityType && req.query.entityType !== 'all' ? req.query.entityType : null,
      actionType:
        req.query.actionType && req.query.actionType !== 'all' ? req.query.actionType : null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      search: req.query.search || '',
    });

    res.status(200).json({
      success: true,
      activity: activityResult.data,
      pagination: activityResult.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getDashboardNotifications = async (req, res) => {
  try {
    await syncDeadlineReminderNotificationsForUser(req.user);
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(8);

    res.status(200).json({
      success: true,
      notifications: notifications.map(formatNotification),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
