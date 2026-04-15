const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasksByProject,
  getMyTasks,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/taskController');
const { authMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

router.post('/', createTask);
router.get('/', (req, res, next) => {
  // If query has projectId, get tasks by project
  if (req.query.projectId) {
    return getTasksByProject(req, res);
  }
  // Otherwise get user's tasks
  return getMyTasks(req, res);
});
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

module.exports = router;
