const User = require('../models/User');
const jwt = require('jwt-simple');
const crypto = require('crypto');
const https = require('https');
const { getFirebaseAuth, isFirebaseAdminConfigured } = require('../lib/firebaseAdmin');

// Generate JWT token
const generateToken = (userId) => {
  const payload = {
    _id: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };
  return jwt.encode(payload, process.env.JWT_SECRET || 'your_jwt_secret');
};

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const buildResetPasswordUrl = (token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl.replace(/\/$/, '')}/reset-password/${token}`;
};

const createPasswordResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  return {
    rawToken,
    hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
};

const splitGoogleName = (name = '') => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { firstName: 'Google', lastName: 'User' };
  }

  const [firstName, ...rest] = trimmedName.split(/\s+/);
  return {
    firstName: firstName || 'Google',
    lastName: rest.join(' ') || 'User',
  };
};

const splitDisplayName = (name = '', email = '') => {
  if (name?.trim()) {
    return splitGoogleName(name);
  }

  const fallback = email.split('@')[0] || 'User';
  return {
    firstName: fallback,
    lastName: 'User',
  };
};

const verifyGoogleCredential = (credential) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            if (response.statusCode !== 200) {
              return reject(
                new Error(payload.error_description || payload.error || 'Unable to verify Google credential')
              );
            }
            return resolve(payload);
          } catch (error) {
            return reject(new Error('Unable to parse Google credential response'));
          }
        });
      }
    );

    request.on('error', () => reject(new Error('Unable to reach Google authentication services')));
  });

// Register new user
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validation
    if (!firstName || !lastName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use',
      });
    }

    // Create new user
    const user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password,
    });

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(201).json({
      success: true,
      token,
      user: user.getProfile(),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error during registration',
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validation
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: 'This account uses Google sign-in. Continue with Google to access it.',
      });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(200).json({
      success: true,
      token,
      user: user.getProfile(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error during login',
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Google credential is required',
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        error: 'Google sign-in is not configured on the server',
      });
    }

    const googlePayload = await verifyGoogleCredential(credential);

    if (googlePayload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({
        success: false,
        error: 'Google credential is not valid for this app',
      });
    }

    if (googlePayload.email_verified !== 'true') {
      return res.status(401).json({
        success: false,
        error: 'Google account email must be verified',
      });
    }

    const normalizedEmail = normalizeEmail(googlePayload.email);
    let user = await User.findOne({
      $or: [{ googleId: googlePayload.sub }, { email: normalizedEmail }],
    }).select('+password');

    if (!user) {
      const { firstName, lastName } = splitGoogleName(googlePayload.name);
      user = await User.create({
        firstName: googlePayload.given_name || firstName,
        lastName: googlePayload.family_name || lastName,
        email: normalizedEmail,
        authProvider: 'google',
        googleId: googlePayload.sub,
        avatar: googlePayload.picture || null,
      });
    } else {
      user.googleId = user.googleId || googlePayload.sub;
      if (!user.avatar && googlePayload.picture) user.avatar = googlePayload.picture;
      if (!user.firstName && googlePayload.given_name) user.firstName = googlePayload.given_name;
      if (!user.lastName && googlePayload.family_name) user.lastName = googlePayload.family_name;
      await user.save();
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: user.getProfile(),
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error during Google sign-in',
    });
  }
};

exports.firebaseLogin = async (req, res) => {
  try {
    const { idToken, firstName: requestedFirstName, lastName: requestedLastName } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Firebase ID token is required',
      });
    }

    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Firebase authentication is not configured on the server',
      });
    }

    const firebaseAuth = getFirebaseAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    const normalizedEmail = normalizeEmail(decodedToken.email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Firebase account does not include an email address',
      });
    }

    const providerId = decodedToken.firebase?.sign_in_provider || 'password';
    const nextProvider = providerId === 'google.com' ? 'google' : 'firebase';
    const fallbackName = splitDisplayName(decodedToken.name, normalizedEmail);
    const firstName = requestedFirstName?.trim() || fallbackName.firstName;
    const lastName = requestedLastName?.trim() || fallbackName.lastName;

    let user = await User.findOne({
      $or: [
        { firebaseUid: decodedToken.uid },
        { email: normalizedEmail },
      ],
    }).select('+password');

    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        authProvider: nextProvider,
        firebaseUid: decodedToken.uid,
        avatar: decodedToken.picture || null,
      });
    } else {
      user.firebaseUid = user.firebaseUid || decodedToken.uid;

      if (!user.firstName && firstName) user.firstName = firstName;
      if (!user.lastName && lastName) user.lastName = lastName;
      if (!user.avatar && decodedToken.picture) user.avatar = decodedToken.picture;

      if (providerId === 'google.com' && !user.googleId) {
        const googleIdentity = decodedToken.firebase?.identities?.['google.com']?.[0];
        if (googleIdentity) {
          user.googleId = googleIdentity;
        }
      }

      if (!user.password) {
        user.authProvider = nextProvider;
      }

      await user.save();
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: user.getProfile(),
    });
  } catch (error) {
    console.error('Firebase login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error during Firebase sign-in',
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email address',
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user || !user.password) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been prepared.',
      });
    }

    const { rawToken, hashedToken, expiresAt } = createPasswordResetToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = expiresAt;
    await user.save();

    const response = {
      success: true,
      message: 'If an account with that email exists, a password reset link has been prepared.',
    };

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      response.resetUrl = buildResetPasswordUrl(rawToken);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error while preparing password reset',
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is required',
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide the new password and confirmation',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select('+password +resetPasswordToken +resetPasswordExpiresAt');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'This reset link is invalid or has expired',
      });
    }

    user.password = password;
    user.authProvider = user.authProvider || 'local';
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error while resetting password',
    });
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: user.getProfile(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, avatar, bio } = req.body;
    const updateData = {};

    if (firstName !== undefined) {
      const normalizedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
      if (!normalizedFirstName) {
        return res.status(400).json({
          success: false,
          error: 'First name is required',
        });
      }
      updateData.firstName = normalizedFirstName;
    }

    if (lastName !== undefined) {
      const normalizedLastName = typeof lastName === 'string' ? lastName.trim() : '';
      if (!normalizedLastName) {
        return res.status(400).json({
          success: false,
          error: 'Last name is required',
        });
      }
      updateData.lastName = normalizedLastName;
    }

    if (avatar !== undefined) {
      updateData.avatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null;
    }

    if (bio !== undefined) {
      updateData.bio = typeof bio === 'string' ? bio.trim() : '';
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      user: user.getProfile(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { timezone, theme, notifications } = req.body;
    const updateData = {};

    if (timezone !== undefined) {
      const normalizedTimezone = typeof timezone === 'string' ? timezone.trim() : '';
      if (!normalizedTimezone) {
        return res.status(400).json({
          success: false,
          error: 'Timezone is required',
        });
      }

      updateData['preferences.timezone'] = normalizedTimezone;
    }

    if (theme !== undefined) {
      if (!['light', 'dark'].includes(theme)) {
        return res.status(400).json({
          success: false,
          error: 'Theme must be light or dark',
        });
      }

      updateData['preferences.theme'] = theme;
    }

    if (notifications !== undefined) {
      updateData['preferences.notifications.taskAssignments'] =
        notifications?.taskAssignments !== false;
      updateData['preferences.notifications.deadlineReminders'] =
        notifications?.deadlineReminders !== false;
      updateData['preferences.notifications.messageNotifications'] =
        notifications?.messageNotifications !== false;
      updateData['preferences.notifications.projectUpdates'] =
        notifications?.projectUpdates !== false;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: user.getProfile(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error updating preferences',
    });
  }
};
// Change user password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All password fields are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters',
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'This account uses Google or Firebase sign-in. Update your password there.',
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error changing password',
    });
  }
};
