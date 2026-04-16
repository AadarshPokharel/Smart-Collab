const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

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

const getDisplayName = (user) => {
  if (!user) return 'Someone';
  if (typeof user === 'string') return user;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Someone';
};

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
      return dueDate && dueDate >= todayStart && dueDate <= todayEnd && task.status !== 'Done';
    }).length,
    inProgressTasks: myTasks.filter((task) => task.status === 'In Progress').length,
    completedTasks: myTasks.filter((task) => task.status === 'Done').length,
  };
};

const buildProjectProgress = (projects, tasks) => {
  return projects.map((project) => {
    const projectTasks = tasks.filter((task) => toObjectIdString(task.project) === project._id.toString());
    const completedTasks = projectTasks.filter((task) => task.status === 'Done').length;
    const progress = projectTasks.length === 0 ? 0 : Math.round((completedTasks / projectTasks.length) * 100);

    return {
      id: project._id,
      title: project.title,
      progress,
      deadline: project.dueDate || project.createdAt,
    };
  });
};

const buildActivity = (projects, tasks) => {
  const projectActivity = projects.map((project) => ({
    id: `project-${project._id}`,
    text: `${getDisplayName(project.owner)} created project ${project.title}`,
    actorName: getDisplayName(project.owner),
    action: 'created project',
    projectId: project._id,
    projectTitle: project.title,
    time: project.createdAt,
    createdAt: project.createdAt,
  }));

  const taskActivity = tasks.map((task) => ({
    id: `task-${task._id}`,
    text: `${getDisplayName(task.assignedBy)} ${task.status === 'Done' ? 'completed' : 'updated'} task ${task.title}`,
    actorName: getDisplayName(task.assignedBy),
    action: task.status === 'Done' ? 'completed task' : 'updated task',
    projectId: toObjectIdString(task.project),
    projectTitle: task.project?.title || 'Untitled project',
    time: task.createdAt,
    createdAt: task.createdAt,
  }));

  return [...projectActivity, ...taskActivity]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map(({ createdAt, ...item }) => ({
      ...item,
      time: new Date(item.time).toLocaleString(),
    }));
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
});

exports.getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const projects = await getAccessibleProjects(req.user._id);
    const projectIds = projects.map((project) => project._id);
    const tasks = await getAccessibleTasks(projectIds);
    const myTasks = tasks.filter((task) => isTaskAssignedToUser(task, req.user._id));

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
          status: task.status,
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
        projects: buildProjectProgress(projects, tasks),
        notifications: await Notification.find({ user: req.user._id })
          .sort({ createdAt: -1 })
          .limit(8)
          .then((items) => items.map(formatNotification)),
        activity: buildActivity(projects, tasks),
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
      stats: buildStats({ projects, tasks, now }),
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
    const projects = await getAccessibleProjects(req.user._id);
    const projectIds = projects.map((project) => project._id);
    const tasks = await getAccessibleTasks(projectIds);

    res.status(200).json({
      success: true,
      activity: buildActivity(projects, tasks),
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
    const now = new Date();
    const projects = await getAccessibleProjects(req.user._id);
    const projectIds = projects.map((project) => project._id);
    const tasks = await getAccessibleTasks(projectIds);
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