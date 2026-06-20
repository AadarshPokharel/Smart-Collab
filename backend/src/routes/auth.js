const express = require('express');
const router = express.Router();
const {
  register,
  login,
  googleLogin,
  firebaseLogin,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  updatePreferences,
  changePassword,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/firebase', firebaseLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', authMiddleware, getCurrentUser);
router.put('/me', authMiddleware, updateProfile);
router.put('/me/preferences', authMiddleware, updatePreferences);
router.put('/me/password', authMiddleware, changePassword);

module.exports = router;
