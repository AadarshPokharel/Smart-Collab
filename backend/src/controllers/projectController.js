const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

/**
 * Create new project
 * Any authenticated user can create projects
 */
exports.createProject = async (req, res) => {
  try {
    // RBAC: Allow any authenticated user to create projects

    const { title, description, status, dueDate, dueTimezone } = req.body;
    const nextStatus = ['Active', 'Archived'].includes(status) ? status : 'Active';

    let parsedDueDate = null;
    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      parsedDueDate = new Date(dueDate);
      const ms = parsedDueDate.getTime();
      if (!Number.isFinite(ms)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid dueDate',
        });
      }
      if (ms <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'Schedule time must be in the future',
        });
      }
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Project title is required',
      });
    }

    const project = await Project.create({
      title,
      description: description || '',
      status: nextStatus,
      owner: req.user._id,
      dueDate: parsedDueDate,
      dueTimezone: typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null,
      members: [
        {
          user: req.user._id,
          role: 'Owner',
        },
      ],
    });

    await project.populate('owner', 'firstName lastName email avatar');
    await project.populate({
      path: 'members.user',
      select: 'firstName lastName email avatar',
    });

    if (project.owner.toString() !== req.user._id.toString()) {
      await createNotification({
        user: project.owner,
        type: 'Info',
        title: 'Project created',
        message: `Project “${project.title}” was created.`,
        entityType: 'Project',
        entityId: project._id,
      });
    }

    res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all projects for authenticated user
 * Returns projects where user is owner or member
 */
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate({
        path: 'members.user',
        select: 'firstName lastName email avatar',
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get project by ID
 * Check access: user must be owner or member
 */
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'firstName lastName email avatar')
      .populate({
        path: 'members.user',
        select: 'firstName lastName email avatar',
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check if user is owner or member
    const isAuthorized =
      project.owner._id.toString() === req.user._id.toString() ||
      project.members.some(
        (m) => m.user._id.toString() === req.user._id.toString()
      );

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this project',
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update project
 * Only owner can update
 */
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // RBAC: Only owner can update
    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can update project',
      });
    }

    const { title, description, status, milestones, dueDate, dueTimezone } = req.body;
    if (title) project.title = title;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (milestones) project.milestones = milestones;
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        project.dueDate = null;
      } else {
        const parsed = new Date(dueDate);
        const ms = parsed.getTime();
        if (!Number.isFinite(ms)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid dueDate',
          });
        }
        if (ms <= Date.now()) {
          return res.status(400).json({
            success: false,
            message: 'Schedule time must be in the future',
          });
        }
        project.dueDate = parsed;
      }
    }

    if (dueTimezone !== undefined) {
      project.dueTimezone = typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null;
    }

    await project.save();
    await project.populate('owner', 'firstName lastName email avatar');
    await project.populate({
      path: 'members.user',
      select: 'firstName lastName email avatar',
    });

    res.status(200).json({
      success: true,
      data: project,
      message: 'Project updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete project
 * Only owner can delete, also deletes all tasks
 */
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // RBAC: Only owner can delete
    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can delete project',
      });
    }

    // Delete all tasks in project
    await Task.deleteMany({ project: req.params.id });

    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Invite member to project
 * Only owner can invite members
 * POST /api/projects/:id/invite { email, role }
 */
exports.inviteMember = async (req, res) => {
  try {
    const { userId, email, role = 'Member' } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // RBAC: Only owner can invite
    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can invite members',
      });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    let invitedUser = null;

    if (userId) {
      invitedUser = await User.findById(userId).select('firstName lastName email');
    } else if (normalizedEmail) {
      invitedUser = await User.findOne({ email: normalizedEmail }).select('firstName lastName email');
    }

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already member
    const isMember = project.members.some(
      (m) => m.user.toString() === invitedUser._id.toString()
    );
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member',
      });
    }

    project.members.push({
      user: invitedUser._id,
      role,
    });
    await project.save();
    await project.populate('owner', 'firstName lastName email avatar');
    await project.populate({
      path: 'members.user',
      select: 'firstName lastName email avatar',
    });

    await createNotification({
      user: invitedUser._id,
      type: 'ProjectInvite',
      title: 'Project invitation',
      message: `You were invited to “${project.title}”.`,
      entityType: 'Project',
      entityId: project._id,
      metadata: { projectId: project._id.toString(), role },
    });

    res.status(200).json({
      success: true,
      data: project,
      message: 'Member invited successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Remove member from project
 * Only owner can remove members
 */
exports.removeMember = async (req, res) => {
  try {
    const { memberId } = req.body;
    const projectId = req.params.id;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // RBAC: Only owner can remove members
    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can remove members',
      });
    }

    // Remove member
    project.members = project.members.filter(
      (m) => m.user.toString() !== memberId
    );
    await project.save();
    await project.populate('owner', 'firstName lastName email avatar');
    await project.populate({
      path: 'members.user',
      select: 'firstName lastName email avatar',
    });

    await createNotification({
      user: memberId,
      type: 'Info',
      title: 'Removed from project',
      message: `You were removed from “${project.title}”.`,
      entityType: 'Project',
      entityId: project._id,
    });

    res.status(200).json({
      success: true,
      data: project,
      message: 'Member removed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
