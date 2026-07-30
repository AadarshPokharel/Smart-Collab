const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { createNotification, createNotifications } = require('../services/notificationService');
const {
  getDisplayName,
  recordActivitySafely,
} = require('../services/activityService');
const {
  getTaskStatsByProject,
  serializeProjectSummary,
  serializeProjectDetail,
  toObjectIdString,
} = require('../services/projectSummaryService');

const isGlobalAdmin = (user) => user?.role === 'admin';

const isProjectOwner = (project, userId) =>
  toObjectIdString(project?.owner) === toObjectIdString(userId);

const getProjectMemberRecord = (project, userId) => {
  if (!project || !userId) return null;
  const normalizedUserId = toObjectIdString(userId);
  const members = Array.isArray(project.members) ? project.members : [];

  return (
    members.find((member) => toObjectIdString(member?.user) === normalizedUserId) || null
  );
};

const isProjectMember = (project, userId) =>
  isProjectOwner(project, userId) || !!getProjectMemberRecord(project, userId);

const canAccessProject = (project, user) =>
  isGlobalAdmin(user) || isProjectMember(project, user?._id);

const canManageProject = (project, user) =>
  isGlobalAdmin(user) || isProjectOwner(project, user?._id);

const canCollaborateOnProject = (project, user) =>
  canAccessProject(project, user);

const normalizeFutureDate = (value, label = 'dueDate') => {
  if (value === undefined) return { hasValue: false, date: undefined };
  if (value === null || value === '') return { hasValue: true, date: null };

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return { error: `Invalid ${label}` };
  }

  if (parsed.getTime() <= Date.now()) {
    return { error: 'Schedule time must be in the future' };
  }

  return { hasValue: true, date: parsed };
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const snapshotProjectForActivity = (project) => ({
  title: project?.title || '',
  description: project?.description || '',
  status: project?.status || 'Active',
  dueDate: toIsoOrNull(project?.dueDate),
  dueTimezone: project?.dueTimezone || null,
});

const snapshotMeetingForActivity = (meeting) => ({
  title: meeting?.title || '',
  description: meeting?.description || '',
  meetingLink: meeting?.meetingLink || '',
  scheduledFor: toIsoOrNull(meeting?.scheduledFor),
  timezone: meeting?.timezone || null,
  status: meeting?.status || 'Scheduled',
  participants: Array.isArray(meeting?.participants)
    ? meeting.participants.map((participant) => toObjectIdString(participant)).filter(Boolean)
    : [],
});

const snapshotResourceForActivity = (resource) => ({
  title: resource?.title || '',
  description: resource?.description || '',
  type: resource?.type || 'link',
  url: resource?.url || '',
});

const buildChangedFieldPayload = (before, after, keys = []) => {
  const oldValue = {};
  const newValue = {};

  keys.forEach((key) => {
    const left = before?.[key] ?? null;
    const right = after?.[key] ?? null;
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      oldValue[key] = left;
      newValue[key] = right;
    }
  });

  return {
    oldValue,
    newValue,
    hasChanges: Object.keys(oldValue).length > 0,
  };
};

const populateProjectRelations = async (project, { detail = false } = {}) => {
  await project.populate('owner', 'firstName lastName email avatar');
  await project.populate({
    path: 'members.user',
    select: 'firstName lastName email avatar',
  });

  if (detail) {
    await project.populate({
      path: 'meetings.createdBy',
      select: 'firstName lastName email avatar',
    });
    await project.populate({
      path: 'meetings.participants',
      select: 'firstName lastName email avatar',
    });
    await project.populate({
      path: 'sharedResources.uploadedBy',
      select: 'firstName lastName email avatar',
    });
  }

  return project;
};

const buildProjectPayload = async (project, { detail = false } = {}) => {
  await populateProjectRelations(project, { detail });
  const taskStatsByProject = await getTaskStatsByProject([project._id]);
  const stats = taskStatsByProject.get(project._id.toString());

  return detail
    ? serializeProjectDetail(project, stats)
    : serializeProjectSummary(project, stats);
};

const getProjectNotificationRecipients = async (
  project,
  { excludeUserId = null, preferenceKey = 'projectUpdates' } = {}
) => {
  const memberIds = new Set(
    [
      toObjectIdString(project?.owner),
      ...(Array.isArray(project?.members) ? project.members.map((member) => toObjectIdString(member?.user)) : []),
    ].filter(Boolean)
  );

  if (excludeUserId) {
    memberIds.delete(toObjectIdString(excludeUserId));
  }

  if (memberIds.size === 0) {
    return [];
  }

  const query = { _id: { $in: Array.from(memberIds) } };
  if (preferenceKey) {
    query[`preferences.notifications.${preferenceKey}`] = { $ne: false };
  }

  const users = await User.find(query).select('_id');
  return users.map((user) => user._id);
};

const normalizeParticipantIds = (project, participants = []) => {
  const nextIds = Array.isArray(participants) ? participants.map(toObjectIdString).filter(Boolean) : [];
  const allowedIds = new Set([
    toObjectIdString(project?.owner),
    ...(Array.isArray(project?.members) ? project.members.map((member) => toObjectIdString(member?.user)) : []),
  ]);

  const uniqueParticipantIds = Array.from(new Set(nextIds));
  const invalidParticipants = uniqueParticipantIds.filter((id) => !allowedIds.has(id));

  return {
    ids: uniqueParticipantIds.filter((id) => allowedIds.has(id)),
    invalidParticipants,
  };
};

const validateMeetingPayload = (payload = {}, { partial = false } = {}) => {
  const errors = [];
  const next = {};

  if (!partial || payload.title !== undefined) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      errors.push('Meeting title is required');
    } else {
      next.title = title;
    }
  }

  if (!partial || payload.scheduledFor !== undefined) {
    const scheduled = normalizeFutureDate(payload.scheduledFor, 'scheduledFor');
    if (scheduled.error) {
      errors.push(scheduled.error);
    } else {
      next.scheduledFor = scheduled.date;
    }
  }

  if (payload.description !== undefined) {
    next.description = typeof payload.description === 'string' ? payload.description.trim() : '';
  } else if (!partial) {
    next.description = '';
  }

  if (payload.meetingLink !== undefined) {
    next.meetingLink = typeof payload.meetingLink === 'string' ? payload.meetingLink.trim() : '';
  } else if (!partial) {
    next.meetingLink = '';
  }

  if (payload.timezone !== undefined) {
    next.timezone = typeof payload.timezone === 'string' && payload.timezone.trim()
      ? payload.timezone.trim()
      : null;
  } else if (!partial) {
    next.timezone = null;
  }

  if (payload.status !== undefined) {
    if (!['Scheduled', 'Completed', 'Cancelled'].includes(payload.status)) {
      errors.push('Invalid meeting status');
    } else {
      next.status = payload.status;
    }
  } else if (!partial) {
    next.status = 'Scheduled';
  }

  if (payload.participants !== undefined) {
    next.participants = payload.participants;
  }

  return { errors, next };
};

const validateResourcePayload = (payload = {}, { partial = false } = {}) => {
  const errors = [];
  const next = {};

  if (!partial || payload.title !== undefined) {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      errors.push('Resource title is required');
    } else {
      next.title = title;
    }
  }

  if (!partial || payload.url !== undefined) {
    const url = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!url) {
      errors.push('Resource URL is required');
    } else {
      next.url = url;
    }
  }

  if (payload.description !== undefined) {
    next.description = typeof payload.description === 'string' ? payload.description.trim() : '';
  } else if (!partial) {
    next.description = '';
  }

  if (payload.type !== undefined) {
    if (!['link', 'file'].includes(payload.type)) {
      errors.push('Invalid resource type');
    } else {
      next.type = payload.type;
    }
  } else if (!partial) {
    next.type = 'link';
  }

  return { errors, next };
};

const getMeetingEntry = (project, meetingId) => project?.meetings?.id(meetingId) || null;

const getResourceEntry = (project, resourceId) => project?.sharedResources?.id(resourceId) || null;

const canManageMeeting = (project, meeting, user) =>
  canManageProject(project, user) || toObjectIdString(meeting?.createdBy) === toObjectIdString(user?._id);

const canManageResource = (project, resource, user) =>
  canManageProject(project, user) || toObjectIdString(resource?.uploadedBy) === toObjectIdString(user?._id);

exports.createProject = async (req, res) => {
  try {
    const { title, description, status, dueDate, dueTimezone } = req.body;
    const normalizedTitle = typeof title === 'string' ? title.trim() : '';

    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Project title is required',
      });
    }

    const nextStatus = ['Active', 'Archived'].includes(status) ? status : 'Active';
    const parsedDueDate = normalizeFutureDate(dueDate);
    if (parsedDueDate.error) {
      return res.status(400).json({
        success: false,
        message: parsedDueDate.error,
      });
    }

    const project = await Project.create({
      title: normalizedTitle,
      description: typeof description === 'string' ? description.trim() : '',
      status: nextStatus,
      owner: req.user._id,
      dueDate: parsedDueDate.hasValue ? parsedDueDate.date : null,
      dueTimezone: typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null,
      members: [
        {
          user: req.user._id,
          role: 'Owner',
        },
      ],
    });
    const actorName = getDisplayName(req.user);

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'created',
      entityType: 'project',
      entityId: project._id,
      title: project.title,
      description: `created project “${project.title}”`,
      newValue: snapshotProjectForActivity(project),
      projectTitle: project.title,
      userName: actorName,
      entityTitle: project.title,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: project.title,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(201).json({
      success: true,
      data: payload,
      message: 'Project created successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'firstName lastName email avatar')
      .populate({
        path: 'members.user',
        select: 'firstName lastName email avatar',
      })
      .sort({ createdAt: -1 });

    const taskStatsByProject = await getTaskStatsByProject(projects.map((project) => project._id));
    const payload = projects.map((project) =>
      serializeProjectSummary(project, taskStatsByProject.get(project._id.toString()))
    );

    return res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canAccessProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this project',
      });
    }

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canManageProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can update project',
      });
    }

    const beforeSnapshot = snapshotProjectForActivity(project);
    const actorName = getDisplayName(req.user);

    const { title, description, status, milestones, dueDate, dueTimezone } = req.body;

    if (title !== undefined) {
      const normalizedTitle = typeof title === 'string' ? title.trim() : '';
      if (!normalizedTitle) {
        return res.status(400).json({
          success: false,
          message: 'Project title is required',
        });
      }
      project.title = normalizedTitle;
    }

    if (description !== undefined) {
      project.description = typeof description === 'string' ? description.trim() : '';
    }

    if (status !== undefined) {
      if (!['Active', 'Archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid project status',
        });
      }
      project.status = status;
    }

    if (milestones !== undefined) {
      project.milestones = Array.isArray(milestones) ? milestones : [];
    }

    const parsedDueDate = normalizeFutureDate(dueDate);
    if (parsedDueDate.error) {
      return res.status(400).json({
        success: false,
        message: parsedDueDate.error,
      });
    }
    if (parsedDueDate.hasValue) {
      project.dueDate = parsedDueDate.date;
    }

    if (dueTimezone !== undefined) {
      project.dueTimezone = typeof dueTimezone === 'string' && dueTimezone.trim() ? dueTimezone.trim() : null;
    }

    await project.save();
    const afterSnapshot = snapshotProjectForActivity(project);
    const changedFields = buildChangedFieldPayload(beforeSnapshot, afterSnapshot, [
      'title',
      'description',
      'status',
      'dueDate',
      'dueTimezone',
    ]);

    if (changedFields.hasChanges) {
      await recordActivitySafely({
        projectId: project._id,
        userId: req.user._id,
        actionType: 'updated',
        entityType: 'project',
        entityId: project._id,
        title: project.title,
        description: `updated project “${project.title}”`,
        oldValue: changedFields.oldValue,
        newValue: changedFields.newValue,
        projectTitle: project.title,
        userName: actorName,
        entityTitle: project.title,
        metadata: {
          projectTitle: project.title,
          userName: actorName,
          entityTitle: project.title,
        },
      });
    }

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Project updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canManageProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can delete project',
      });
    }

    const actorName = getDisplayName(req.user);
    const projectSnapshot = snapshotProjectForActivity(project);
    await Task.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'deleted',
      entityType: 'project',
      entityId: project._id,
      title: project.title,
      description: `deleted project “${project.title}”`,
      oldValue: projectSnapshot,
      projectTitle: project.title,
      userName: actorName,
      entityTitle: project.title,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: project.title,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.inviteMember = async (req, res) => {
  try {
    const { userId, email, role = 'Member' } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canManageProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can invite members',
      });
    }

    const actorName = getDisplayName(req.user);
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    let invitedUser = null;

    if (userId) {
      invitedUser = await User.findById(userId).select('firstName lastName email');
    } else if (normalizedEmail) {
      invitedUser = await User.findOne({ email: normalizedEmail }).select('firstName lastName email');
    }

    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isAlreadyMember = isProjectMember(project, invitedUser._id);
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member',
      });
    }

    project.members.push({
      user: invitedUser._id,
      role,
    });
    await project.save();

    await createNotification({
      user: invitedUser._id,
      type: 'ProjectInvite',
      title: 'Project invitation',
      message: `You were invited to “${project.title}”.`,
      entityType: 'Project',
      entityId: project._id,
      metadata: { projectId: project._id.toString(), role },
    });

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'member_added',
      entityType: 'project',
      entityId: invitedUser._id,
      title: invitedUser.email,
      description: `added ${getDisplayName(invitedUser)} to project “${project.title}”`,
      newValue: {
        memberId: invitedUser._id.toString(),
        memberName: getDisplayName(invitedUser),
        role,
      },
      projectTitle: project.title,
      userName: actorName,
      entityTitle: getDisplayName(invitedUser),
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: getDisplayName(invitedUser),
        role,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Member invited successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    const memberId = req.params.memberId || req.body?.memberId;

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canManageProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can remove members',
      });
    }

    const actorName = getDisplayName(req.user);
    const removedMemberRecord = project.members.find(
      (member) => toObjectIdString(member.user) === toObjectIdString(memberId)
    );
    const removedMember = removedMemberRecord
      ? await User.findById(removedMemberRecord.user).select('firstName lastName email')
      : null;

    project.members = project.members.filter(
      (member) => toObjectIdString(member.user) !== toObjectIdString(memberId)
    );
    await project.save();

    await createNotification({
      user: memberId,
      type: 'Info',
      title: 'Removed from project',
      message: `You were removed from “${project.title}”.`,
      entityType: 'Project',
      entityId: project._id,
    });

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'member_removed',
      entityType: 'project',
      entityId: memberId,
      title: removedMember ? getDisplayName(removedMember) : 'Removed member',
      description: `removed ${removedMember ? getDisplayName(removedMember) : 'a member'} from project “${project.title}”`,
      oldValue: removedMember
        ? {
            memberId: toObjectIdString(removedMember._id),
            memberName: getDisplayName(removedMember),
            role: removedMemberRecord?.role || 'Member',
          }
        : null,
      projectTitle: project.title,
      userName: actorName,
      entityTitle: removedMember ? getDisplayName(removedMember) : 'Removed member',
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: removedMember ? getDisplayName(removedMember) : 'Removed member',
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Member removed successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addMeeting = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canCollaborateOnProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add meetings to this project',
      });
    }

    const actorName = getDisplayName(req.user);
    const { errors, next } = validateMeetingPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    const { ids: participantIds, invalidParticipants } = normalizeParticipantIds(
      project,
      next.participants
    );
    if (invalidParticipants.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Meeting participants must belong to the project',
      });
    }

    project.meetings.push({
      title: next.title,
      description: next.description,
      meetingLink: next.meetingLink,
      scheduledFor: next.scheduledFor,
      timezone: next.timezone,
      participants: participantIds,
      createdBy: req.user._id,
      status: next.status,
    });
    const createdMeeting = project.meetings[project.meetings.length - 1];

    await project.save();

    const recipientIds = participantIds.length
      ? participantIds.filter((participantId) => participantId !== req.user._id.toString())
      : (await getProjectNotificationRecipients(project, { excludeUserId: req.user._id }));

    if (recipientIds.length > 0) {
      await createNotifications(
        recipientIds.map((userId) => ({
          user: userId,
          type: 'ProjectUpdate',
          title: 'Meeting scheduled',
          message: `A new meeting “${next.title}” was scheduled in “${project.title}”.`,
          entityType: 'Project',
          entityId: project._id,
          metadata: { projectId: project._id.toString(), feature: 'meeting' },
        }))
      );
    }

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'created',
      entityType: 'meeting',
      entityId: createdMeeting?._id,
      title: next.title,
      description: `created meeting “${next.title}”`,
      newValue: snapshotMeetingForActivity(createdMeeting || next),
      projectTitle: project.title,
      userName: actorName,
      entityTitle: next.title,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: next.title,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(201).json({
      success: true,
      data: payload,
      message: 'Meeting added successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const meeting = getMeetingEntry(project, req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    if (!canManageMeeting(project, meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this meeting',
      });
    }

    const beforeSnapshot = snapshotMeetingForActivity(meeting);
    const actorName = getDisplayName(req.user);
    const { errors, next } = validateMeetingPayload(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    if (next.participants !== undefined) {
      const { ids: participantIds, invalidParticipants } = normalizeParticipantIds(
        project,
        next.participants
      );
      if (invalidParticipants.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Meeting participants must belong to the project',
        });
      }
      meeting.participants = participantIds;
    }

    if (next.title !== undefined) meeting.title = next.title;
    if (next.description !== undefined) meeting.description = next.description;
    if (next.meetingLink !== undefined) meeting.meetingLink = next.meetingLink;
    if (next.scheduledFor !== undefined) meeting.scheduledFor = next.scheduledFor;
    if (next.timezone !== undefined) meeting.timezone = next.timezone;
    if (next.status !== undefined) meeting.status = next.status;

    await project.save();
    const afterSnapshot = snapshotMeetingForActivity(meeting);
    const changedFields = buildChangedFieldPayload(beforeSnapshot, afterSnapshot, [
      'title',
      'description',
      'meetingLink',
      'scheduledFor',
      'timezone',
      'status',
      'participants',
    ]);

    if (changedFields.hasChanges) {
      await recordActivitySafely({
        projectId: project._id,
        userId: req.user._id,
        actionType: 'updated',
        entityType: 'meeting',
        entityId: meeting._id,
        title: meeting.title,
        description: `updated meeting “${meeting.title}”`,
        oldValue: changedFields.oldValue,
        newValue: changedFields.newValue,
        projectTitle: project.title,
        userName: actorName,
        entityTitle: meeting.title,
        metadata: {
          projectTitle: project.title,
          userName: actorName,
          entityTitle: meeting.title,
        },
      });
    }

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Meeting updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const meeting = getMeetingEntry(project, req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found',
      });
    }

    if (!canManageMeeting(project, meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this meeting',
      });
    }

    const actorName = getDisplayName(req.user);
    const meetingSnapshot = snapshotMeetingForActivity(meeting);
    const meetingTitle = meeting.title;
    meeting.deleteOne();
    await project.save();

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'deleted',
      entityType: 'meeting',
      entityId: req.params.meetingId,
      title: meetingTitle,
      description: `deleted meeting “${meetingTitle}”`,
      oldValue: meetingSnapshot,
      projectTitle: project.title,
      userName: actorName,
      entityTitle: meetingTitle,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: meetingTitle,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Meeting deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addResource = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!canCollaborateOnProject(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add resources to this project',
      });
    }

    const actorName = getDisplayName(req.user);
    const { errors, next } = validateResourcePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    project.sharedResources.push({
      title: next.title,
      description: next.description,
      type: next.type,
      url: next.url,
      uploadedBy: req.user._id,
    });
    const createdResource = project.sharedResources[project.sharedResources.length - 1];

    await project.save();

    const recipientIds = await getProjectNotificationRecipients(project, { excludeUserId: req.user._id });
    if (recipientIds.length > 0) {
      await createNotifications(
        recipientIds.map((userId) => ({
          user: userId,
          type: 'ProjectUpdate',
          title: 'Resource shared',
          message: `A new ${next.type} resource “${next.title}” was shared in “${project.title}”.`,
          entityType: 'Project',
          entityId: project._id,
          metadata: { projectId: project._id.toString(), feature: 'resource' },
        }))
      );
    }

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'created',
      entityType: 'resource',
      entityId: createdResource?._id,
      title: next.title,
      description: `shared resource “${next.title}”`,
      newValue: snapshotResourceForActivity(createdResource || next),
      projectTitle: project.title,
      userName: actorName,
      entityTitle: next.title,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: next.title,
        resourceType: next.type,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(201).json({
      success: true,
      data: payload,
      message: 'Resource shared successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateResource = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const resource = getResourceEntry(project, req.params.resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    if (!canManageResource(project, resource, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this resource',
      });
    }

    const beforeSnapshot = snapshotResourceForActivity(resource);
    const actorName = getDisplayName(req.user);
    const { errors, next } = validateResourcePayload(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    if (next.title !== undefined) resource.title = next.title;
    if (next.description !== undefined) resource.description = next.description;
    if (next.type !== undefined) resource.type = next.type;
    if (next.url !== undefined) resource.url = next.url;

    await project.save();
    const afterSnapshot = snapshotResourceForActivity(resource);
    const changedFields = buildChangedFieldPayload(beforeSnapshot, afterSnapshot, [
      'title',
      'description',
      'type',
      'url',
    ]);

    if (changedFields.hasChanges) {
      await recordActivitySafely({
        projectId: project._id,
        userId: req.user._id,
        actionType: 'updated',
        entityType: 'resource',
        entityId: resource._id,
        title: resource.title,
        description: `updated resource “${resource.title}”`,
        oldValue: changedFields.oldValue,
        newValue: changedFields.newValue,
        projectTitle: project.title,
        userName: actorName,
        entityTitle: resource.title,
        metadata: {
          projectTitle: project.title,
          userName: actorName,
          entityTitle: resource.title,
          resourceType: resource.type,
        },
      });
    }

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Resource updated successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const resource = getResourceEntry(project, req.params.resourceId);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    if (!canManageResource(project, resource, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this resource',
      });
    }

    const actorName = getDisplayName(req.user);
    const resourceSnapshot = snapshotResourceForActivity(resource);
    const resourceTitle = resource.title;
    resource.deleteOne();
    await project.save();

    await recordActivitySafely({
      projectId: project._id,
      userId: req.user._id,
      actionType: 'deleted',
      entityType: 'resource',
      entityId: req.params.resourceId,
      title: resourceTitle,
      description: `removed resource “${resourceTitle}”`,
      oldValue: resourceSnapshot,
      projectTitle: project.title,
      userName: actorName,
      entityTitle: resourceTitle,
      metadata: {
        projectTitle: project.title,
        userName: actorName,
        entityTitle: resourceTitle,
        resourceType: resource.type,
      },
    });

    const payload = await buildProjectPayload(project, { detail: true });

    return res.status(200).json({
      success: true,
      data: payload,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
