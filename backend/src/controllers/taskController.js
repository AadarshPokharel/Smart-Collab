const Task = require('../models/Task');
const Project = require('../models/Project');
const { createNotification } = require('../services/notificationService');
const {
  getDisplayName,
  recordActivitiesSafely,
  recordActivitySafely,
} = require('../services/activityService');

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

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const getProjectTitle = (project) => project?.title || 'Untitled project';

const snapshotTask = (task) => ({
  title: task?.title || '',
  description: task?.description || '',
  status: task?.status || 'To Do',
  priority: task?.priority || 'Medium',
  dueDate: toIsoOrNull(task?.dueDate),
  dueTimezone: task?.dueTimezone || null,
  projectId: toObjectIdString(task?.project),
  projectTitle: task?.project?.title || '',
  assignedToId: toObjectIdString(task?.assignedTo),
  assignedToName: task?.assignedTo ? getDisplayName(task.assignedTo) : 'Unassigned',
});

const buildTaskActivityMetadata = ({ task, projectTitle, actorName, extra = {} }) => ({
  projectTitle,
  userName: actorName,
  entityTitle: task?.title || '',
  taskTitle: task?.title || '',
  ...extra,
});

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
    const actorName = getDisplayName(req.user);

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

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'created',
      entityType: 'task',
      entityId: task._id,
      title: task.title,
      description: `created task “${task.title}”`,
      newValue: snapshotTask(task),
      projectTitle: project.title,
      userName: actorName,
      entityTitle: task.title,
      metadata: buildTaskActivityMetadata({
        task,
        projectTitle: project.title,
        actorName,
        extra: {
          assignedToName: task.assignedTo ? getDisplayName(task.assignedTo) : 'Unassigned',
          status: task.status,
          priority: task.priority,
        },
      }),
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

    await task.populate('assignedTo', 'firstName lastName email avatar');
    const beforeSnapshot = {
      ...snapshotTask(task),
      projectTitle: getProjectTitle(currentProject),
    };
    const actorName = getDisplayName(req.user);

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
    const afterSnapshot = snapshotTask(task);

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

    const activityEntries = [];
    const targetProjectTitle = getProjectTitle(task.project);

    if (beforeSnapshot.status !== afterSnapshot.status) {
      activityEntries.push({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: afterSnapshot.status === 'Done' ? 'completed' : 'status_changed',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description:
          afterSnapshot.status === 'Done'
            ? `completed task “${task.title}”`
            : `changed task “${task.title}” status from ${beforeSnapshot.status} to ${afterSnapshot.status}`,
        oldValue: { status: beforeSnapshot.status },
        newValue: { status: afterSnapshot.status },
        projectTitle: targetProjectTitle,
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: targetProjectTitle,
          actorName,
          extra: {
            fromStatus: beforeSnapshot.status,
            toStatus: afterSnapshot.status,
          },
        }),
      });
    }

    if (beforeSnapshot.priority !== afterSnapshot.priority) {
      activityEntries.push({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: 'priority_changed',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description: `changed task “${task.title}” priority from ${beforeSnapshot.priority} to ${afterSnapshot.priority}`,
        oldValue: { priority: beforeSnapshot.priority },
        newValue: { priority: afterSnapshot.priority },
        projectTitle: targetProjectTitle,
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: targetProjectTitle,
          actorName,
          extra: {
            fromPriority: beforeSnapshot.priority,
            toPriority: afterSnapshot.priority,
          },
        }),
      });
    }

    if (
      beforeSnapshot.assignedToId !== afterSnapshot.assignedToId ||
      beforeSnapshot.assignedToName !== afterSnapshot.assignedToName
    ) {
      const isUnassigned = !afterSnapshot.assignedToId;
      activityEntries.push({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: 'assigned',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description: isUnassigned
          ? `unassigned task “${task.title}”`
          : `assigned task “${task.title}” to ${afterSnapshot.assignedToName}`,
        oldValue: {
          assignedToId: beforeSnapshot.assignedToId,
          assignedToName: beforeSnapshot.assignedToName,
        },
        newValue: {
          assignedToId: afterSnapshot.assignedToId,
          assignedToName: afterSnapshot.assignedToName,
        },
        projectTitle: targetProjectTitle,
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: targetProjectTitle,
          actorName,
          extra: {
            assignedToName: afterSnapshot.assignedToName,
          },
        }),
      });
    }

    if (beforeSnapshot.dueDate !== afterSnapshot.dueDate) {
      activityEntries.push({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: 'due_date_changed',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description: `changed task “${task.title}” due date`,
        oldValue: {
          dueDate: beforeSnapshot.dueDate,
          dueTimezone: beforeSnapshot.dueTimezone,
        },
        newValue: {
          dueDate: afterSnapshot.dueDate,
          dueTimezone: afterSnapshot.dueTimezone,
        },
        projectTitle: targetProjectTitle,
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: targetProjectTitle,
          actorName,
        }),
      });
    }

    const genericChanges = {};
    if (beforeSnapshot.title !== afterSnapshot.title) {
      genericChanges.title = { old: beforeSnapshot.title, new: afterSnapshot.title };
    }
    if (beforeSnapshot.description !== afterSnapshot.description) {
      genericChanges.description = {
        old: beforeSnapshot.description,
        new: afterSnapshot.description,
      };
    }
    if (beforeSnapshot.projectId !== afterSnapshot.projectId) {
      genericChanges.project = {
        old: beforeSnapshot.projectTitle || getProjectTitle(currentProject),
        new: afterSnapshot.projectTitle || targetProjectTitle,
      };
    }

    if (Object.keys(genericChanges).length > 0) {
      activityEntries.push({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: 'updated',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description: `updated task “${task.title}”`,
        oldValue: Object.fromEntries(
          Object.entries(genericChanges).map(([key, value]) => [key, value.old])
        ),
        newValue: Object.fromEntries(
          Object.entries(genericChanges).map(([key, value]) => [key, value.new])
        ),
        projectTitle: targetProjectTitle,
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: targetProjectTitle,
          actorName,
        }),
      });
    }

    await recordActivitiesSafely(activityEntries);

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

    const previousStatus = task.status;
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

    if (previousStatus !== status) {
      const actorName = getDisplayName(req.user);
      await recordActivitySafely({
        projectId: task.project?._id || task.project,
        userId: req.user._id,
        actionType: status === 'Done' ? 'completed' : 'status_changed',
        entityType: 'task',
        entityId: task._id,
        title: task.title,
        description:
          status === 'Done'
            ? `completed task “${task.title}”`
            : `changed task “${task.title}” status from ${previousStatus} to ${status}`,
        oldValue: { status: previousStatus },
        newValue: { status },
        projectTitle: getProjectTitle(task.project),
        userName: actorName,
        entityTitle: task.title,
        metadata: buildTaskActivityMetadata({
          task,
          projectTitle: getProjectTitle(task.project),
          actorName,
          extra: {
            fromStatus: previousStatus,
            toStatus: status,
          },
        }),
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

    await task.populate('assignedTo', 'firstName lastName email avatar');
    const taskSnapshot = snapshotTask(task);
    const actorName = getDisplayName(req.user);
    await Task.findByIdAndDelete(req.params.id);

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'deleted',
      entityType: 'task',
      entityId: task._id,
      title: task.title,
      description: `deleted task “${task.title}”`,
      oldValue: taskSnapshot,
      projectTitle: project.title,
      userName: actorName,
      entityTitle: task.title,
      metadata: buildTaskActivityMetadata({
        task,
        projectTitle: project.title,
        actorName,
      }),
    });

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
