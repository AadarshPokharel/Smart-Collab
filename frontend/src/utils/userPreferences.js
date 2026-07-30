const DEFAULT_THEME = 'light';

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const normalizeTimeZone = (timeZone) => {
  const fallback = getBrowserTimeZone();

  if (!timeZone || typeof timeZone !== 'string') {
    return fallback;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return fallback;
  }
};

const getDateValue = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateParts = (value, timeZone) => {
  const date = getDateValue(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== 'literal') {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  if (!parts.year || !parts.month || !parts.day) {
    return null;
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
};

export const getUserTheme = (user) =>
  user?.preferences?.theme === 'dark' ? 'dark' : DEFAULT_THEME;

export const getUserTimezone = (user) =>
  normalizeTimeZone(user?.preferences?.timezone);

export const getDateKeyInTimeZone = (value, timeZone) => {
  const parts = getDateParts(value, timeZone);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatDateInTimeZone = (
  value,
  timeZone,
  options = { month: 'short', day: 'numeric' },
  fallback = 'Not available'
) => {
  const date = getDateValue(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat(undefined, {
    timeZone: normalizeTimeZone(timeZone),
    ...options,
  }).format(date);
};

export const formatDateTimeInTimeZone = (
  value,
  timeZone,
  options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
  fallback = 'Not available'
) => formatDateInTimeZone(value, timeZone, options, fallback);

export const getCurrentHourInTimeZone = (timeZone, value = new Date()) => {
  const date = getDateValue(value);
  if (!date) return 0;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    hour: '2-digit',
    hourCycle: 'h23',
  });

  const hour = formatter
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value;

  return Number.parseInt(hour || '0', 10);
};
