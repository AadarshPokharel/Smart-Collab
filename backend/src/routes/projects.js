const express = require('express');
const router = express.Router();
const {
  createProject,
  seedDemoWorkspace,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
  addMeeting,
  updateMeeting,
  deleteMeeting,
  addResource,
  updateResource,
  deleteResource,
} = require('../controllers/projectController');
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

// POST   /api/projects/demo-seed - Create or refresh a demo-ready workspace for the current user
router.post('/demo-seed', seedDemoWorkspace);

// GET    /api/projects/:id      - Get project by ID
router.get('/:id', getProjectById);

// PUT    /api/projects/:id      - Update project (owner only)
router.put('/:id', updateProject);

// DELETE /api/projects/:id      - Delete project (owner only)
router.delete('/:id', deleteProject);

// POST   /api/projects/:id/invite - Invite member to project (owner only)
router.post('/:id/invite', inviteMember);

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
