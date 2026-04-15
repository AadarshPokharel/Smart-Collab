export const getMockNotifications = () => [
  {
    id: 1,
    type: 'Task',
    text: 'You were assigned “Finalize sprint board”.',
    time: '2h ago',
    read: false,
  },
  {
    id: 2,
    type: 'Reminder',
    text: 'Project “SmartCollab Core” deadline in 10 days.',
    time: '4h ago',
    read: false,
  },
  {
    id: 3,
    type: 'Message',
    text: 'New message from Project Lead.',
    time: '1d ago',
    read: true,
  },
];

const coerceTimeLabel = (item) => {
  if (!item) return '';

  if (typeof item.time === 'string') return item.time;

  const ts = item.createdAt || item.timestamp || item.time;
  if (!ts) return '';

  try {
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : '';
  } catch {
    return '';
  }
};

const coerceText = (item) => {
  if (!item) return 'Notification';
  return item.text || item.message || item.title || 'Notification';
};

export const normalizeNotifications = (responseData) => {
  const raw =
    responseData?.notifications ||
    responseData?.data ||
    responseData?.items ||
    responseData;

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.notifications)
      ? raw.notifications
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  return list.map((item, index) => ({
    id: item?.id || item?._id || `${index}`,
    type: item?.type || 'Info',
    text: coerceText(item),
    time: coerceTimeLabel(item),
    read: !!item?.read,
  }));
};
