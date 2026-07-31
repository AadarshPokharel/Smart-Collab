const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  getTasksByProject,
  getMyTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  uploadTaskSubmission,
  downloadTaskSubmission,
  deleteTask,
} = require('../controllers/taskController');
const { authMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

router.post('/', createTask);
router.get('/', (req, res, next) => {
  if (req.query.projectId) {
    return getTasksByProject(req, res);
  }

  if (req.query.scope === 'mine') {
    return getMyTasks(req, res);
  }

  return getTasks(req, res);
});
router.post('/:id/submission', uploadTaskSubmission);
router.get('/:id/submission/download', downloadTaskSubmission);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

module.exports = router;
