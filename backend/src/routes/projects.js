const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
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

module.exports = router;
