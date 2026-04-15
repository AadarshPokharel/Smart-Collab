const Task = require('../models/Task');
const Project = require('../models/Project');

const isProjectMember = (project, userId) => {
  if (!project || !userId) return false;
  const userIdStr = userId.toString();

  const ownerId = project.owner?._id || project.owner;
  if (ownerId && ownerId.toString() === userIdStr) return true;

  const members = Array.isArray(project.members) ? project.members : [];
  return members.some((m) => {
    const memberId = m?.user?._id || m?.user;
    return memberId && memberId.toString() === userIdStr;
  });
};

// Create new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, projectId, priority, dueDate, dueTimezone, assignedTo } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Title and project are required',
      });
    }

    // Check if project exists and user is member
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const isMember = isProjectMember(project, req.user._id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this project',
      });
    }

    let parsedDueDate = null;
    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      parsedDueDate = new Date(dueDate);
      const ms = parsedDueDate.getTime();
      if (!Number.isFinite(ms)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid dueDate',
        });
      }
      if (ms <= Date.now()) {
        return res.status(400).json({
          success: false,
          error: 'Schedule time must be in the future',
        });
      }
    }

    // Create task
    const task = await Task.create({
      title,
      description: description || '',
      project: projectId,
      assignedTo: assignedTo || null,
      assignedBy: req.user._id,
      priority: priority || 'Medium',
      dueDate: parsedDueDate,
      dueTimezone: typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null,
    });

    await task.populate('assignedBy', 'firstName lastName email');
    if (assignedTo) {
      await task.populate('assignedTo', 'firstName lastName email');
    }

    // Add task to project
    project.tasks.push(task._id);
    await project.save();

    res.status(201).json({
      success: true,
      task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get tasks by project
exports.getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      });
    }

    // Check if user is member of project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const isMember = isProjectMember(project, req.user._id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this project',
      });
    }

    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Get tasks assigned to user
exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate('project', 'name')
      .populate('assignedBy', 'firstName lastName email')
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if user is in the project
    const project = await Project.findById(task.project);
    const isMember = isProjectMember(project, req.user._id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this project',
      });
    }

    const { title, description, status, priority, dueDate, dueTimezone, assignedTo } = req.body;

    if (title) task.title = title;
    if (description) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        task.dueDate = null;
      } else {
        const parsed = new Date(dueDate);
        const ms = parsed.getTime();
        if (!Number.isFinite(ms)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid dueDate',
          });
        }
        if (ms <= Date.now()) {
          return res.status(400).json({
            success: false,
            error: 'Schedule time must be in the future',
          });
        }
        task.dueDate = parsed;
      }
    }

    if (dueTimezone !== undefined) {
      task.dueTimezone =
        typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null;
    }
    if (assignedTo) task.assignedTo = assignedTo;

    // Mark as completed
    if (status === 'Done' && !task.completedAt) {
      task.completedAt = new Date();
    } else if (status !== 'Done') {
      task.completedAt = null;
    }

    await task.save();
    await task.populate(['assignedTo', 'assignedBy']);

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if user is in the project
    const project = await Project.findById(task.project);
    const isMember = isProjectMember(project, req.user._id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this project',
      });
    }

    if (!['To Do', 'In Progress', 'Done'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    task.status = status;

    // Mark as completed
    if (status === 'Done' && !task.completedAt) {
      task.completedAt = new Date();
    } else if (status !== 'Done') {
      task.completedAt = null;
    }

    await task.save();
    await task.populate(['assignedTo', 'assignedBy']);

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Only creator or project leader can delete
    const project = await Project.findById(task.project);
    const ownerId = project.owner?._id || project.owner;
    const isCreatorOrOwner =
      task.assignedBy.toString() === req.user._id.toString() ||
      (ownerId && ownerId.toString() === req.user._id.toString());

    if (!isCreatorOrOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this task',
      });
    }

    // Remove from project
    project.tasks = project.tasks.filter((t) => t.toString() !== req.params.id);
    await project.save();

    await Task.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
