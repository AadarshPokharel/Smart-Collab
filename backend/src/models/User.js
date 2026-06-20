const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'firebase'],
      default: 'local',
    },
    firebaseUid: {
      type: String,
      default: null,
      sparse: true,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    password: {
      type: String,
      required: function requiredPassword() {
        return this.authProvider === 'local';
      },
      minlength: 6,
      select: false, // Don't return password by default
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    preferences: {
      timezone: {
        type: String,
        default: 'UTC',
      },
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
      },
      notifications: {
        taskAssignments: {
          type: Boolean,
          default: true,
        },
        deadlineReminders: {
          type: Boolean,
          default: true,
        },
        messageNotifications: {
          type: Boolean,
          default: true,
        },
        projectUpdates: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get user profile (without sensitive data)
userSchema.methods.getProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Create index for faster email lookups
userSchema.index({ email: 1 });
userSchema.index({ firebaseUid: 1 }, { sparse: true });
userSchema.index({ googleId: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
