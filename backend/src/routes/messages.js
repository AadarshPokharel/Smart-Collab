const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all conversations for the logged-in user
router.get('/conversations', messageController.getConversations);

// Get all messages for a specific project
router.get('/:projectId', messageController.getProjectMessages);

// Send a new message
router.post('/', messageController.sendMessage);

// Mark a message as read
router.patch('/:id/read', messageController.markMessageAsRead);

module.exports = router;
