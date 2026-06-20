const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const readServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return null;
  }

  const resolvedPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return JSON.parse(raw);
};

const getFirebaseApp = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
};

const getFirebaseAuth = () => {
  const app = getFirebaseApp();
  return app ? admin.auth(app) : null;
};

const isFirebaseAdminConfigured = () =>
  Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

module.exports = {
  getFirebaseAuth,
  isFirebaseAdminConfigured,
};
