const Project = require('../models/Project');
const {
  fetchActivities,
  toObjectIdString,
} = require('../services/activityService');

const isProjectMember = (project, userId) => {
  if (!project || !userId) return false;

  const normalizedUserId = toObjectIdString(userId);
  if (toObjectIdString(project.owner) === normalizedUserId) {
    return true;
  }

  const members = Array.isArray(project.members) ? project.members : [];
  return members.some((member) => toObjectIdString(member?.user) === normalizedUserId);
};

const canAccessProject = (project, user) => {
  if (user?.role === 'admin') return true;
  return isProjectMember(project, user?._id);
};

exports.getActivities = async (req, res) => {
  try {
    const result = await fetchActivities({
      user: req.user,
      projectId: req.query.projectId || null,
      userId: req.query.userId || null,
      entityType:
        req.query.entityType && req.query.entityType !== 'all' ? req.query.entityType : null,
      actionType:
        req.query.actionType && req.query.actionType !== 'all' ? req.query.actionType : null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      search: req.query.search || '',
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load activities',
    });
  }
};

exports.getProjectActivities = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id || req.params.projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canAccessProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view activity for this project',
      });
    }

    const result = await fetchActivities({
      user: req.user,
      projectId: project._id,
      userId: req.query.userId || null,
      entityType:
        req.query.entityType && req.query.entityType !== 'all' ? req.query.entityType : null,
      actionType:
        req.query.actionType && req.query.actionType !== 'all' ? req.query.actionType : null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      search: req.query.search || '',
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load project activity',
    });
  }
};
