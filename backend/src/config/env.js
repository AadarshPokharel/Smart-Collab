const normalizeUrl = (value = '') => value.trim().replace(/\/+$/, '');

const splitCsv = (value = '') =>
  value
    .split(',')
    .map((entry) => normalizeUrl(entry))
    .filter(Boolean);

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`${name} environment variable is required`);
  }

  return String(value).trim();
};

const isProduction = () => (process.env.NODE_ENV || 'development') === 'production';

const getClientUrl = () => {
  const configuredUrl = normalizeUrl(
    process.env.CLIENT_URL || process.env.FRONTEND_URL || ''
  );

  if (configuredUrl) {
    return configuredUrl;
  }

  return isProduction() ? '' : 'http://localhost:3000';
};

const getAllowedOrigins = () => {
  const developmentOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  const configuredOrigins = [
    ...splitCsv(process.env.CORS_ORIGINS || ''),
    ...splitCsv(process.env.CLIENT_URLS || ''),
    ...splitCsv(process.env.FRONTEND_URLS || ''),
    getClientUrl(),
  ];

  return Array.from(new Set([...developmentOrigins, ...configuredOrigins].filter(Boolean)));
};

module.exports = {
  getAllowedOrigins,
  getClientUrl,
  getRequiredEnv,
  isProduction,
};
