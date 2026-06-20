const Task = require('../models/Task');
const Project = require('../models/Project');
const { createNotification } = require('../services/notificationService');

const TASK_STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High'];

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isGlobalAdmin = (user) => user?.role === 'admin';

const getProjectMemberRecord = (project, userId) => {
  if (!project || !userId) return null;
  const userIdStr = toObjectIdString(userId);
  const members = Array.isArray(project.members) ? project.members : [];

  return (
    members.find((member) => {
      const memberId = toObjectIdString(member?.user);
      return memberId === userIdStr;
    }) || null
  );
};

const isProjectOwner = (project, userId) => {
  if (!project || !userId) return false;
  return toObjectIdString(project.owner) === toObjectIdString(userId);
};

const isProjectMember = (project, userId) => {
  return isProjectOwner(project, userId) || !!getProjectMemberRecord(project, userId);
};

const canViewProject = (project, user) => {
  return isGlobalAdmin(user) || isProjectMember(project, user?._id);
};

const canManageProjectTasks = (project, user) => {
  if (isGlobalAdmin(user) || isProjectOwner(project, user?._id)) {
    return true;
  }

  const member = getProjectMemberRecord(project, user?._id);
  return ['Owner', 'ProjectManager'].includes(member?.role);
};

const canUpdateTaskStatus = (task, project, user) => {
  if (canManageProjectTasks(project, user)) {
    return true;
  }

  return toObjectIdString(task?.assignedTo) === toObjectIdString(user?._id);
};

const parseDueDate = (value) => {
  if (value === undefined) {
    return { hasValue: false, date: undefined };
  }

  if (value === null || value === '') {
    return { hasValue: true, date: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'Invalid dueDate' };
  }

  return { hasValue: true, date: parsed };
};

const validateStatus = (status) => {
  if (status === undefined) return null;
  if (!TASK_STATUSES.includes(status)) {
    return 'Invalid status';
  }
  return null;
};

const validatePriority = (priority) => {
  if (priority === undefined) return null;
  if (!TASK_PRIORITIES.includes(priority)) {
    return 'Invalid priority';
  }
  return null;
};

const validateAssigneeInProject = (project, assignedTo) => {
  if (!assignedTo) return null;

  const assignedUserId = toObjectIdString(assignedTo);
  if (isProjectOwner(project, assignedUserId)) {
    return null;
  }

  if (getProjectMemberRecord(project, assignedUserId)) {
    return null;
  }

  return 'Assigned user must belong to the selected project';
};

const populateTaskRelations = async (task) => {
  await task.populate('project', 'title');
  await task.populate('assignedTo', 'firstName lastName email avatar');
  await task.populate('assignedBy', 'firstName lastName email avatar');
  return task;
};

const sendTaskNotification = async ({ recipientId, actorId, ...payload }) => {
  if (!recipientId) return;
  if (toObjectIdString(recipientId) === toObjectIdString(actorId)) return;

  try {
    await createNotification({
      user: recipientId,
      ...payload,
    });
  } catch (error) {
    console.error('Failed to create task notification:', error.message);
  }
};

const getAccessibleProjectIds = async (user) => {
  const projectQuery = isGlobalAdmin(user)
    ? {}
    : {
        $or: [{ owner: user._id }, { 'members.user': user._id }],
      };

  const projects = await Project.find(projectQuery).select('_id');
  return projects.map((project) => project._id);
};

const getTaskAndProject = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    return { task: null, project: null };
  }

  const project = await Project.findById(task.project);
  return { task, project };
};

exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      priority = 'Medium',
      status = 'To Do',
      dueDate,
      dueTimezone,
    } = req.body;

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    if (!normalizedTitle || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Title and project are required',
      });
    }

    const statusError = validateStatus(status);
    if (statusError) {
      return res.status(400).json({
        success: false,
        error: statusError,
      });
    }

    const priorityError = validatePriority(priority);
    if (priorityError) {
      return res.status(400).json({
        success: false,
        error: priorityError,
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canManageProjectTasks(project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to create tasks in this project',
      });
    }

    const assigneeError = validateAssigneeInProject(project, assignedTo);
    if (assigneeError) {
      return res.status(400).json({
        success: false,
        error: assigneeError,
      });
    }

    const parsedDueDate = parseDueDate(dueDate);
    if (parsedDueDate.error) {
      return res.status(400).json({
        success: false,
        error: parsedDueDate.error,
      });
    }

    const task = await Task.create({
      title: normalizedTitle,
      description: typeof description === 'string' ? description.trim() : '',
      project: project._id,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
      priority,
      status,
      dueDate: parsedDueDate.hasValue ? parsedDueDate.date : null,
      dueTimezone: typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null,
      completedAt: status === 'Done' ? new Date() : null,
    });

    await populateTaskRelations(task);

    await sendTaskNotification({
      recipientId: task.assignedTo,
      actorId: req.user._id,
      type: 'TaskAssigned',
      title: 'Task assigned',
      message: `You were assigned “${task.title}”.`,
      entityType: 'Task',
      entityId: task._id,
      metadata: { projectId: project._id.toString() },
    });

    return res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const projectIds = await getAccessibleProjectIds(req.user);

    const query = projectIds.length
      ? { project: { $in: projectIds } }
      : { _id: { $in: [] } };

    const tasks = await Task.find(query)
      .populate('project', 'title')
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canViewProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view tasks for this project',
      });
    }

    const tasks = await Task.find({ project: projectId })
      .populate('project', 'title')
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const projectIds = await getAccessibleProjectIds(req.user);

    const query = projectIds.length
      ? { assignedTo: req.user._id, project: { $in: projectIds } }
      : { _id: { $in: [] } };

    const tasks = await Task.find(query)
      .populate('project', 'title')
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName email avatar')
      .sort({ dueDate: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const { task, project } = await getTaskAndProject(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canViewProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this task',
      });
    }

    await populateTaskRelations(task);

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { task, project: currentProject } = await getTaskAndProject(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    if (!currentProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canManageProjectTasks(currentProject, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this task',
      });
    }

    const {
      title,
      description,
      projectId,
      assignedTo,
      priority,
      status,
      dueDate,
      dueTimezone,
    } = req.body;

    let targetProject = currentProject;
    if (projectId && projectId !== toObjectIdString(currentProject._id)) {
      targetProject = await Project.findById(projectId);
      if (!targetProject) {
        return res.status(404).json({
          success: false,
          error: 'Selected project not found',
        });
      }

      if (!canManageProjectTasks(targetProject, req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to move this task to the selected project',
        });
      }
    }

    if (title !== undefined) {
      const normalizedTitle = typeof title === 'string' ? title.trim() : '';
      if (!normalizedTitle) {
        return res.status(400).json({
          success: false,
          error: 'Task title is required',
        });
      }
      task.title = normalizedTitle;
    }

    if (description !== undefined) {
      task.description = typeof description === 'string' ? description.trim() : '';
    }

    const statusError = validateStatus(status);
    if (statusError) {
      return res.status(400).json({
        success: false,
        error: statusError,
      });
    }
    if (status !== undefined) {
      task.status = status;
    }

    const priorityError = validatePriority(priority);
    if (priorityError) {
      return res.status(400).json({
        success: false,
        error: priorityError,
      });
    }
    if (priority !== undefined) {
      task.priority = priority;
    }

    const parsedDueDate = parseDueDate(dueDate);
    if (parsedDueDate.error) {
      return res.status(400).json({
        success: false,
        error: parsedDueDate.error,
      });
    }
    if (parsedDueDate.hasValue) {
      task.dueDate = parsedDueDate.date;
    }

    if (dueTimezone !== undefined) {
      task.dueTimezone =
        typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null;
    }

    const previousAssignedTo = toObjectIdString(task.assignedTo);
    if (assignedTo !== undefined) {
      const assigneeError = validateAssigneeInProject(targetProject, assignedTo);
      if (assigneeError) {
        return res.status(400).json({
          success: false,
          error: assigneeError,
        });
      }

      task.assignedTo = assignedTo || null;
    }

    if (projectId && projectId !== toObjectIdString(task.project)) {
      task.project = targetProject._id;
    }

    task.completedAt = task.status === 'Done' ? task.completedAt || new Date() : null;

    await task.save();
    await populateTaskRelations(task);

    const nextAssignedTo = toObjectIdString(task.assignedTo);
    if (nextAssignedTo && nextAssignedTo !== previousAssignedTo) {
      await sendTaskNotification({
        recipientId: nextAssignedTo,
        actorId: req.user._id,
        type: 'TaskAssigned',
        title: 'Task assigned',
        message: `You were assigned “${task.title}”.`,
        entityType: 'Task',
        entityId: task._id,
        metadata: { projectId: toObjectIdString(task.project) },
      });
    }

    if (status !== undefined && task.assignedTo) {
      await sendTaskNotification({
        recipientId: task.assignedTo,
        actorId: req.user._id,
        type: 'Info',
        title: 'Task updated',
        message: `Task “${task.title}” changed to ${task.status}.`,
        entityType: 'Task',
        entityId: task._id,
        metadata: { projectId: toObjectIdString(task.project) },
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const statusError = validateStatus(status);

    if (statusError) {
      return res.status(400).json({
        success: false,
        error: statusError,
      });
    }

    const { task, project } = await getTaskAndProject(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canViewProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this task',
      });
    }

    if (!canUpdateTaskStatus(task, project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this task status',
      });
    }

    task.status = status;
    task.completedAt = status === 'Done' ? task.completedAt || new Date() : null;

    await task.save();
    await populateTaskRelations(task);

    if (task.assignedTo) {
      await sendTaskNotification({
        recipientId: task.assignedTo,
        actorId: req.user._id,
        type: 'Info',
        title: 'Task status updated',
        message: `Task “${task.title}” changed to ${status}.`,
        entityType: 'Task',
        entityId: task._id,
        metadata: { projectId: toObjectIdString(task.project) },
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { task, project } = await getTaskAndProject(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!canManageProjectTasks(project, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this task',
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
