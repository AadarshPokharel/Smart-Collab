const mongoose = require('mongoose');

/**
 * Project Schema
 * Represents a collaborative project in SmartCollab
 * Sprint 3 spec: title, description, owner, members with roles, milestones, status
 */
const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project must have an owner'],
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['Owner', 'ProjectManager', 'Member'],
          default: 'Member',
        },
      },
    ],
    milestones: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        dueDate: Date,
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    status: {
      type: String,
      enum: ['Active', 'Archived'],
      default: 'Active',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    dueTimezone: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ status: 1 });

module.exports = mongoose.model('Project', projectSchema);
