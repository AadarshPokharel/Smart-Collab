const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');
const { createNotifications } = require('../services/notificationService');
const {
  getDisplayName,
  recordActivitySafely,
} = require('../services/activityService');

const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isProjectMember = (project, userId) => {
  if (!project || !userId) return false;

  const normalizedUserId = toObjectIdString(userId);
  if (toObjectIdString(project.owner) === normalizedUserId) {
    return true;
  }

  const members = Array.isArray(project.members) ? project.members : [];
  return members.some((member) => toObjectIdString(member?.user || member) === normalizedUserId);
};

const getAccessibleProjectsQuery = (user) => {
  if (user?.role === 'admin') {
    return {};
  }

  return {
    $or: [{ owner: user._id }, { 'members.user': user._id }],
  };
};

const getProjectForMessaging = async (projectId) => {
  return Project.findById(projectId)
    .populate('owner', '_id firstName lastName email avatar')
    .populate({
      path: 'members.user',
      select: '_id firstName lastName email avatar',
    });
};

const hasUserReadMessage = (message, userId) => {
  const normalizedUserId = toObjectIdString(userId);
  const readByList = Array.isArray(message?.readBy) ? message.readBy : [];

  if (toObjectIdString(message?.sender) === normalizedUserId) {
    return true;
  }

  return readByList.some((readerId) => toObjectIdString(readerId) === normalizedUserId);
};

const formatMessage = (message, userId) => ({
  ...message.toObject(),
  read: hasUserReadMessage(message, userId),
});

const getProjectRecipientIds = (project, excludeUserId) => {
  const uniqueIds = new Set([
    toObjectIdString(project?.owner),
    ...(Array.isArray(project?.members)
      ? project.members.map((member) => toObjectIdString(member?.user))
      : []),
  ]);

  if (excludeUserId) {
    uniqueIds.delete(toObjectIdString(excludeUserId));
  }

  return Array.from(uniqueIds).filter(Boolean);
};

const markProjectMessagesAsRead = async (projectId, userId) => {
  await Message.updateMany(
    {
      project: projectId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
      $set: { read: true },
    }
  );
};

// Get all messages for a specific project
exports.getProjectMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const project = await getProjectForMessaging(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!isProjectMember(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this project',
      });
    }

    const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (normalizedPage - 1) * normalizedLimit;

    await markProjectMessagesAsRead(projectId, req.user._id);

    const messages = await Message.find({ project: projectId })
      .populate('sender', 'firstName lastName email avatar')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(normalizedLimit);

    const total = await Message.countDocuments({ project: projectId });

    return res.status(200).json({
      success: true,
      data: messages.map((message) => formatMessage(message, req.user._id)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        pages: Math.ceil(total / normalizedLimit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error fetching messages',
    });
  }
};

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { projectId, content } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content cannot be empty',
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot exceed 1000 characters',
      });
    }

    const project = await getProjectForMessaging(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (!isProjectMember(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this project',
      });
    }

    const message = new Message({
      sender: req.user._id,
      project: projectId,
      content: content.trim(),
      read: false,
      readBy: [req.user._id],
    });

    await message.save();
    await message.populate('sender', 'firstName lastName email avatar');
    const senderName = getDisplayName(req.user);

    const recipientIds = getProjectRecipientIds(project, req.user._id);
    if (recipientIds.length > 0) {
      const recipients = await User.find({
        _id: { $in: recipientIds },
        'preferences.notifications.messageNotifications': { $ne: false },
      }).select('_id');

      if (recipients.length > 0) {
        await createNotifications(
          recipients.map((recipient) => ({
            user: recipient._id,
            type: 'NewMessage',
            title: `New message in ${project.title}`,
            message: `${senderName}: ${content.trim().slice(0, 140)}`,
            entityType: 'Project',
            entityId: project._id,
            metadata: {
              projectId: project._id.toString(),
              messageId: message._id.toString(),
            },
          }))
        );
      }
    }

    const messagePreview = content.trim().slice(0, 120);
    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'message_sent',
      entityType: 'message',
      entityId: message._id,
      title: messagePreview || 'Project message',
      description: `sent a message in “${project.title}”`,
      newValue: {
        content: content.trim(),
      },
      projectTitle: project.title,
      userName: senderName,
      entityTitle: messagePreview || 'Project message',
      metadata: {
        projectTitle: project.title,
        userName: senderName,
        entityTitle: messagePreview || 'Project message',
        messagePreview,
      },
    });

    return res.status(201).json({
      success: true,
      data: formatMessage(message, req.user._id),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error sending message',
    });
  }
};

// Get all conversations (projects with latest message)
exports.getConversations = async (req, res) => {
  try {
    const projects = await Project.find(getAccessibleProjectsQuery(req.user))
      .populate('owner', '_id firstName lastName email avatar')
      .populate({
        path: 'members.user',
        select: '_id firstName lastName email avatar',
      })
      .lean();

    if (projects.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const conversations = await Promise.all(
      projects.map(async (project) => {
        const latestMessage = await Message.findOne({ project: project._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'firstName lastName avatar')
          .lean();

        const unreadCount = await Message.countDocuments({
          project: project._id,
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
        });

        const members = Array.isArray(project.members) ? project.members : [];
        const uniqueMemberIds = new Set([
          ...members.map((member) => toObjectIdString(member?.user)),
          toObjectIdString(project.owner),
        ].filter(Boolean));

        return {
          projectId: project._id,
          title: project.title,
          membersCount: uniqueMemberIds.size,
          membersPreview: [
            project.owner,
            ...members.map((member) => member?.user).filter(Boolean),
          ]
            .filter(Boolean)
            .slice(0, 4)
            .map((member) => ({
              _id: member._id,
              firstName: member.firstName || '',
              lastName: member.lastName || '',
              avatar: member.avatar || null,
            })),
          latestMessage: latestMessage?.content || null,
          latestMessageTime: latestMessage?.createdAt || project.createdAt,
          latestMessageSender: latestMessage?.sender || null,
          unreadCount,
          meetingsCount: Array.isArray(project.meetings) ? project.meetings.length : 0,
          sharedResourcesCount: Array.isArray(project.sharedResources) ? project.sharedResources.length : 0,
          nextMeeting:
            (Array.isArray(project.meetings) ? project.meetings : [])
              .filter((meeting) => meeting?.scheduledFor && meeting?.status !== 'Cancelled')
              .sort((left, right) => new Date(left.scheduledFor) - new Date(right.scheduledFor))
              .find((meeting) => new Date(meeting.scheduledFor).getTime() >= Date.now()) || null,
        };
      })
    );

    conversations.sort((left, right) => new Date(right.latestMessageTime) - new Date(left.latestMessageTime));

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error fetching conversations',
    });
  }
};

// Mark a single message as read
exports.markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    const project = await getProjectForMessaging(message.project);
    if (!project || !isProjectMember(project, req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not allowed to access this message',
      });
    }

    if (toObjectIdString(message.sender) === toObjectIdString(req.user._id)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot mark your own message as read',
      });
    }

    message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
    if (!hasUserReadMessage(message, req.user._id)) {
      message.readBy.push(req.user._id);
    }
    message.read = true;
    await message.save();

    return res.status(200).json({
      success: true,
      message: 'Message marked as read',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Error marking message as read',
    });
  }
};
