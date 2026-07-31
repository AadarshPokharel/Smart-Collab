const Notification = require('../models/Notification');
const { syncDeadlineReminderNotificationsForUser } = require('../services/notificationService');

const isPendingProjectInvite = (notification) =>
  ['ProjectInvite', 'project_invite'].includes(notification?.type) &&
  notification?.metadata?.invitationStatus === 'pending' &&
  notification?.metadata?.invitationId &&
  notification?.metadata?.projectId;

const formatNotification = (notification) => ({
  id: notification._id,
  type: notification.type,
  title: notification.title,
  text: notification.message,
  message: notification.message,
  time: notification.createdAt ? notification.createdAt.toLocaleString() : '',
  timestamp: notification.createdAt,
  read: !!notification.read,
  entityType: notification.entityType || null,
  entityId: notification.entityId || null,
  metadata: notification.metadata || {},
});

exports.getNotifications = async (req, res) => {
  try {
    await syncDeadlineReminderNotificationsForUser(req.user);

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      notifications: notifications.map(formatNotification),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateNotificationReadState = async (req, res) => {
  try {
    const nextReadState = req.body?.read !== false;

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: nextReadState },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      notification: formatNotification(notification),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      notification: formatNotification(notification),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    if (isPendingProjectInvite(notification)) {
      return res.status(400).json({
        success: false,
        error: 'Respond to the project invitation before removing this notification',
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({
      user: req.user._id,
      $nor: [
        {
          type: 'ProjectInvite',
          'metadata.invitationStatus': 'pending',
        },
        {
          type: 'project_invite',
          'metadata.invitationStatus': 'pending',
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: 'Notifications cleared successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
