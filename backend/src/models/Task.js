const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'In Review', 'Done'],
      default: 'To Do',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    dueTimezone: {
      type: String,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    submissionRequired: {
      type: Boolean,
      default: false,
    },
    allowedSubmissionFormats: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    submission: {
      fileName: {
        type: String,
        default: '',
        trim: true,
      },
      mimeType: {
        type: String,
        default: '',
        trim: true,
      },
      size: {
        type: Number,
        default: 0,
      },
      extension: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      note: {
        type: String,
        default: '',
      },
      data: {
        type: String,
        default: '',
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
  },
  { timestamps: true }
);

// Index for faster lookups
taskSchema.index({ project: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
