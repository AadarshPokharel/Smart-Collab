const Task = require('../models/Task');

const normalizeTaskStatus = (status) => (status === 'Done' ? 'Done' : 'To Do');

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const mapUserBrief = (user) => {
  if (!user) return null;

  if (typeof user === 'string') {
    return {
      id: user,
      _id: user,
    };
  }

  return {
    id: toObjectIdString(user),
    _id: user._id || user.id || null,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    avatar: user.avatar || null,
  };
};

const buildEmptyTaskStats = () => ({
  totalTasks: 0,
  completedTasks: 0,
  openTasks: 0,
  todoTasks: 0,
  inProgressTasks: 0,
  inReviewTasks: 0,
  overdueTasks: 0,
  dueSoonTasks: 0,
  progress: 0,
});

const getTaskStatsByProject = async (projectIds = []) => {
  const normalizedIds = projectIds.map(toObjectIdString).filter(Boolean);
  const statsByProjectId = new Map(normalizedIds.map((projectId) => [projectId, buildEmptyTaskStats()]));

  if (normalizedIds.length === 0) {
    return statsByProjectId;
  }

  const tasks = await Task.find({ project: { $in: projectIds } }).select('project status dueDate');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soonThreshold = new Date(startOfToday);
  soonThreshold.setDate(soonThreshold.getDate() + 7);

  tasks.forEach((task) => {
    const projectId = toObjectIdString(task.project);
    if (!projectId) return;

    if (!statsByProjectId.has(projectId)) {
      statsByProjectId.set(projectId, buildEmptyTaskStats());
    }

    const stats = statsByProjectId.get(projectId);
    stats.totalTasks += 1;

    const normalizedStatus = normalizeTaskStatus(task.status);
    if (normalizedStatus === 'Done') {
      stats.completedTasks += 1;
      return;
    }

    stats.openTasks += 1;
    stats.todoTasks += 1;

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      if (Number.isFinite(dueDate.getTime())) {
        if (dueDate < startOfToday) {
          stats.overdueTasks += 1;
        } else if (dueDate <= soonThreshold) {
          stats.dueSoonTasks += 1;
        }
      }
    }
  });

  statsByProjectId.forEach((stats) => {
    stats.progress = stats.totalTasks
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;
  });

  return statsByProjectId;
};

const sortMeetings = (meetings = []) =>
  [...meetings].sort((left, right) => {
    const leftTime = new Date(left?.scheduledFor || 0).getTime();
    const rightTime = new Date(right?.scheduledFor || 0).getTime();
    return leftTime - rightTime;
  });

const getUpcomingMeeting = (meetings = []) => {
  const now = Date.now();
  const scheduledMeetings = sortMeetings(
    meetings.filter((meeting) => meeting?.scheduledFor && meeting?.status !== 'Cancelled')
  );

  return (
    scheduledMeetings.find((meeting) => new Date(meeting.scheduledFor).getTime() >= now) ||
    scheduledMeetings[0] ||
    null
  );
};

const serializeMeeting = (meeting) => {
  if (!meeting) return null;

  return {
    id: toObjectIdString(meeting._id) || null,
    _id: meeting._id || null,
    title: meeting.title || 'Untitled meeting',
    description: meeting.description || '',
    meetingLink: meeting.meetingLink || '',
    scheduledFor: meeting.scheduledFor || null,
    timezone: meeting.timezone || null,
    status: meeting.status || 'Scheduled',
    createdAt: meeting.createdAt || null,
    updatedAt: meeting.updatedAt || null,
    createdBy: mapUserBrief(meeting.createdBy),
    participants: Array.isArray(meeting.participants)
      ? meeting.participants.map(mapUserBrief).filter(Boolean)
      : [],
  };
};

const serializeResource = (resource) => {
  if (!resource) return null;

  return {
    id: toObjectIdString(resource._id) || null,
    _id: resource._id || null,
    title: resource.title || 'Untitled resource',
    description: resource.description || '',
    type: resource.type || 'link',
    url: resource.url || '',
    createdAt: resource.createdAt || null,
    uploadedBy: mapUserBrief(resource.uploadedBy),
  };
};

const serializePendingInvite = (invite) => {
  if (!invite) return null;

  return {
    id: toObjectIdString(invite._id) || null,
    _id: invite._id || null,
    email: invite.email || '',
    role: invite.role || 'Member',
    status: invite.status || 'pending',
    createdAt: invite.createdAt || null,
    user: mapUserBrief(invite.user),
    invitedBy: mapUserBrief(invite.invitedBy),
  };
};

const serializePendingRoleChange = (request) => {
  if (!request) return null;

  return {
    id: toObjectIdString(request._id) || null,
    _id: request._id || null,
    currentRole: request.currentRole || 'Member',
    requestedRole: request.requestedRole || 'ProjectManager',
    status: request.status || 'pending',
    createdAt: request.createdAt || null,
    user: mapUserBrief(request.user),
    requestedBy: mapUserBrief(request.requestedBy),
  };
};

const serializeProjectSummary = (project, stats = buildEmptyTaskStats()) => {
  const meetings = Array.isArray(project?.meetings) ? project.meetings : [];
  const resources = Array.isArray(project?.sharedResources) ? project.sharedResources : [];

  return {
    _id: project._id,
    id: toObjectIdString(project._id),
    title: project.title,
    description: project.description || '',
    status: project.status || 'Active',
    dueDate: project.dueDate || null,
    dueTimezone: project.dueTimezone || null,
    owner: project.owner || null,
    members: Array.isArray(project.members) ? project.members : [],
    createdAt: project.createdAt || null,
    updatedAt: project.updatedAt || null,
    totalTasks: stats.totalTasks || 0,
    completedTasks: stats.completedTasks || 0,
    openTasks: stats.openTasks || 0,
    todoTasks: stats.todoTasks || 0,
    inProgressTasks: stats.inProgressTasks || 0,
    inReviewTasks: stats.inReviewTasks || 0,
    overdueTasks: stats.overdueTasks || 0,
    dueSoonTasks: stats.dueSoonTasks || 0,
    progress: stats.progress || 0,
    meetingsCount: meetings.length,
    sharedResourcesCount: resources.length,
    upcomingMeeting: serializeMeeting(getUpcomingMeeting(meetings)),
  };
};

const serializeProjectDetail = (project, stats = buildEmptyTaskStats()) => {
  const summary = serializeProjectSummary(project, stats);

  return {
    ...summary,
    pendingInvites: [...(project?.pendingInvites || [])]
      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
      .map(serializePendingInvite)
      .filter(Boolean),
    pendingRoleChanges: [...(project?.pendingRoleChanges || [])]
      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
      .map(serializePendingRoleChange)
      .filter(Boolean),
    meetings: sortMeetings(project?.meetings || []).map(serializeMeeting).filter(Boolean),
    sharedResources: [...(project?.sharedResources || [])]
      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
      .map(serializeResource)
      .filter(Boolean),
  };
};

module.exports = {
  toObjectIdString,
  mapUserBrief,
  getTaskStatsByProject,
  serializeMeeting,
  serializeResource,
  serializePendingInvite,
  serializePendingRoleChange,
  serializeProjectSummary,
  serializeProjectDetail,
};
