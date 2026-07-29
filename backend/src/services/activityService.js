const Activity = require('../models/Activity');
const Project = require('../models/Project');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 12;

const toObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const getDisplayName = (user) => {
  if (!user) return 'Someone';
  if (typeof user === 'string') return user;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Someone';
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLimit = (value) => {
  const parsed = parseInt(value, 10) || DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
};

const normalizePage = (value) => {
  const parsed = parseInt(value, 10) || 1;
  return Math.max(parsed, 1);
};

const parseDateBoundary = (value, { endOfDay = false } = {}) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    if (endOfDay) {
      parsed.setUTCHours(23, 59, 59, 999);
    } else {
      parsed.setUTCHours(0, 0, 0, 0);
    }
  }

  return parsed;
};

const buildProjectAccessQuery = (user) => {
  if (user?.role === 'admin') {
    return {};
  }

  return {
    $or: [{ owner: user?._id }, { 'members.user': user?._id }],
  };
};

const getAccessibleProjects = async (user) => {
  return Project.find(buildProjectAccessQuery(user)).select('_id title');
};

const buildSearchText = ({
  title,
  description,
  projectTitle,
  userName,
  entityTitle,
  actionType,
  entityType,
  metadata = {},
}) => {
  const metadataText = Object.values(metadata || {})
    .filter((value) => ['string', 'number'].includes(typeof value))
    .join(' ');

  return [
    title,
    description,
    projectTitle,
    userName,
    entityTitle,
    actionType,
    entityType,
    metadataText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const buildMetadata = ({ metadata = {}, projectTitle, userName, entityTitle, actionType, entityType, title, description }) => {
  const nextMetadata = {
    ...metadata,
    projectTitle: projectTitle || metadata.projectTitle || '',
    userName: userName || metadata.userName || '',
    entityTitle: entityTitle || metadata.entityTitle || title || '',
  };

  nextMetadata.searchText = buildSearchText({
    title,
    description,
    projectTitle: nextMetadata.projectTitle,
    userName: nextMetadata.userName,
    entityTitle: nextMetadata.entityTitle,
    actionType,
    entityType,
    metadata: nextMetadata,
  });

  return nextMetadata;
};

const serializeValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value ?? null;
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    accumulator[key] =
      entryValue instanceof Date ? entryValue.toISOString() : entryValue ?? null;
    return accumulator;
  }, {});
};

const serializeActivity = (activity) => {
  const project = activity?.projectId;
  const user = activity?.userId;

  return {
    id: toObjectIdString(activity?._id),
    _id: activity?._id || null,
    projectId: toObjectIdString(project) || toObjectIdString(activity?.projectId),
    userId: toObjectIdString(user) || toObjectIdString(activity?.userId),
    actionType: activity?.actionType || '',
    entityType: activity?.entityType || '',
    entityId: activity?.entityId || null,
    title: activity?.title || '',
    description: activity?.description || '',
    oldValue: serializeValue(activity?.oldValue),
    newValue: serializeValue(activity?.newValue),
    metadata: activity?.metadata || {},
    createdAt: activity?.createdAt || null,
    updatedAt: activity?.updatedAt || null,
    project: project
      ? {
          id: toObjectIdString(project),
          title: project.title || activity?.metadata?.projectTitle || 'Untitled project',
        }
      : {
          id: toObjectIdString(activity?.projectId),
          title: activity?.metadata?.projectTitle || 'Untitled project',
        },
    user: user
      ? {
          id: toObjectIdString(user),
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          avatar: user.avatar || null,
          displayName: getDisplayName(user),
        }
      : {
          id: toObjectIdString(activity?.userId),
          firstName: '',
          lastName: '',
          email: '',
          avatar: null,
          displayName: activity?.metadata?.userName || 'Someone',
        },
  };
};

const recordActivity = async ({
  projectId,
  userId,
  actionType,
  entityType,
  entityId = null,
  title,
  description,
  oldValue = null,
  newValue = null,
  metadata = {},
  projectTitle = '',
  userName = '',
  entityTitle = '',
}) => {
  if (!projectId || !userId || !actionType || !entityType || !title || !description) {
    return null;
  }

  const activity = await Activity.create({
    projectId,
    userId,
    actionType,
    entityType,
    entityId: entityId ? String(entityId) : null,
    title,
    description,
    oldValue,
    newValue,
    metadata: buildMetadata({
      metadata,
      projectTitle,
      userName,
      entityTitle,
      actionType,
      entityType,
      title,
      description,
    }),
  });

  return activity;
};

const recordActivitySafely = async (entry) => {
  try {
    return await recordActivity(entry);
  } catch (error) {
    console.error('Failed to record activity:', error.message);
    return null;
  }
};

const recordActivitiesSafely = async (entries = []) => {
  const validEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (validEntries.length === 0) {
    return [];
  }

  return Promise.all(validEntries.map((entry) => recordActivitySafely(entry)));
};

const fetchActivities = async ({
  user,
  projectId = null,
  userId = null,
  entityType = null,
  actionType = null,
  startDate = null,
  endDate = null,
  search = '',
  page = 1,
  limit = DEFAULT_LIMIT,
}) => {
  const accessibleProjects = await getAccessibleProjects(user);
  const accessibleProjectIds = accessibleProjects.map((project) => project._id);
  const accessibleProjectIdSet = new Set(accessibleProjectIds.map((value) => value.toString()));

  if (!accessibleProjectIds.length) {
    return {
      data: [],
      pagination: {
        page: normalizePage(page),
        limit: normalizeLimit(limit),
        total: 0,
        pages: 0,
        hasMore: false,
      },
      accessibleProjectIds: [],
      accessibleProjectIdSet,
    };
  }

  const normalizedPage = normalizePage(page);
  const normalizedLimit = normalizeLimit(limit);
  const query = {
    projectId: { $in: accessibleProjectIds },
  };

  if (projectId) {
    query.projectId = projectId;
  }

  if (userId) {
    query.userId = userId;
  }

  if (entityType) {
    query.entityType = entityType;
  }

  if (actionType) {
    query.actionType = actionType;
  }

  const createdAt = {};
  const parsedStartDate = parseDateBoundary(startDate);
  const parsedEndDate = parseDateBoundary(endDate, { endOfDay: true });

  if (parsedStartDate) {
    createdAt.$gte = parsedStartDate;
  }

  if (parsedEndDate) {
    createdAt.$lte = parsedEndDate;
  }

  if (Object.keys(createdAt).length > 0) {
    query.createdAt = createdAt;
  }

  const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : '';
  if (normalizedSearch) {
    query['metadata.searchText'] = { $regex: escapeRegex(normalizedSearch), $options: 'i' };
  }

  const skip = (normalizedPage - 1) * normalizedLimit;

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .populate('projectId', 'title')
      .populate('userId', 'firstName lastName email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    Activity.countDocuments(query),
  ]);

  const pages = total > 0 ? Math.ceil(total / normalizedLimit) : 0;

  return {
    data: activities.map(serializeActivity),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages,
      hasMore: normalizedPage < pages,
    },
    accessibleProjectIds,
    accessibleProjectIdSet,
  };
};

module.exports = {
  toObjectIdString,
  getDisplayName,
  buildProjectAccessQuery,
  getAccessibleProjects,
  fetchActivities,
  recordActivity,
  recordActivitySafely,
  recordActivitiesSafely,
  serializeActivity,
};
