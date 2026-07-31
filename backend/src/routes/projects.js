const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  inviteMember,
  acceptInvite,
  declineInvite,
  removeMember,
  addMeeting,
  updateMeeting,
  deleteMeeting,
  addResource,
  updateResource,
  deleteResource,
} = require('../controllers/projectController');
const { getProjectActivities } = require('../controllers/activityController');
const { authMiddleware } = require('../middleware/auth');

/**
 * Project Routes
 * All routes require authentication via JWT authMiddleware
 */

// All routes require authentication
router.use(authMiddleware);

// GET    /api/projects          - Get all projects for user
router.get('/', getProjects);

// POST   /api/projects          - Create new project (Admin/ProjectManager only)
router.post('/', createProject);

// GET    /api/projects/:id/activities - Get activity history for a project
router.get('/:id/activities', getProjectActivities);

// GET    /api/projects/:id      - Get project by ID
router.get('/:id', getProjectById);

// PUT    /api/projects/:id      - Update project (owner only)
router.put('/:id', updateProject);

// DELETE /api/projects/:id      - Delete project (owner only)
router.delete('/:id', deleteProject);

// POST   /api/projects/:id/invite - Invite member to project (owner only)
router.post('/:id/invite', inviteMember);

// POST   /api/projects/:id/invitations/:invitationId/accept - Accept a project invitation
router.post('/:id/invitations/:invitationId/accept', acceptInvite);

// POST   /api/projects/:id/invitations/:invitationId/decline - Decline a project invitation
router.post('/:id/invitations/:invitationId/decline', declineInvite);

// DELETE /api/projects/:id/members/:memberId - Remove member (owner only)
router.delete('/:id/members/:memberId', removeMember);

// POST   /api/projects/:id/meetings              - Add meeting to project
router.post('/:id/meetings', addMeeting);

// PUT    /api/projects/:id/meetings/:meetingId   - Update meeting
router.put('/:id/meetings/:meetingId', updateMeeting);

// DELETE /api/projects/:id/meetings/:meetingId   - Delete meeting
router.delete('/:id/meetings/:meetingId', deleteMeeting);

// POST   /api/projects/:id/resources             - Share project resource
router.post('/:id/resources', addResource);

// PUT    /api/projects/:id/resources/:resourceId - Update project resource
router.put('/:id/resources/:resourceId', updateResource);

// DELETE /api/projects/:id/resources/:resourceId - Delete project resource
router.delete('/:id/resources/:resourceId', deleteResource);

module.exports = router;
