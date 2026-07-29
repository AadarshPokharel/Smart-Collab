# SmartCollab Render Deployment

SmartCollab deploys to Render as two services:

- `backend`: Render Web Service
- `frontend`: Render Static Site

The repository is a monorepo, so each service must use its own root directory.

## Backend Deployment

Create a Render `Web Service` for the backend with these settings:

- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Branch: `main`

The backend entry file is:

- `backend/src/index.js`

The backend now:

- listens on `process.env.PORT || 5000`
- waits for MongoDB before starting
- exits with code `1` if MongoDB or required env vars are missing
- supports graceful shutdown for Render deploys

## Frontend Deployment

Create a Render `Static Site` for the frontend with these settings:

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `build`
- Branch: `main`

Because SmartCollab uses React Router, add this rewrite rule in the Render Static Site dashboard:

- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

## Required Environment Variables

### Backend

Required:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Required for Firebase-backed auth:

- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_PROJECT_ID`

Optional:

- `PORT`
- `NODE_ENV`
- `CORS_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH` for local development instead of inline JSON

Recommended production backend values:

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend-service.onrender.com
CORS_ORIGINS=https://your-frontend-service.onrender.com
```

If you want local and production origins together, use:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-frontend-service.onrender.com
```

### Frontend

Required:

- `REACT_APP_API_URL`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`

Recommended production frontend value:

```env
REACT_APP_API_URL=https://your-backend-service.onrender.com/api
```

## Recommended Deploy Order

1. Deploy the backend first.
2. Copy the backend Render URL.
3. Set `REACT_APP_API_URL` in the frontend static site.
4. Deploy the frontend static site.
5. Copy the frontend Render URL.
6. Set backend `CLIENT_URL` to the frontend URL.
7. Set backend `CORS_ORIGINS` to include the frontend URL.
8. Redeploy the backend.

## MongoDB Atlas Checklist

- Use the Atlas connection string as `MONGODB_URI`
- Confirm the Render backend can access the cluster through Atlas Network Access
- Confirm the database user in the connection string has permission to the SmartCollab database

## Firebase and Google Login Checklist

SmartCollab currently uses Firebase Auth on the frontend and Firebase Admin verification on the backend.

Before production testing:

1. Add the Render frontend domain to Firebase Authentication authorized domains.
2. Make sure the frontend Firebase config values match the same Firebase project.
3. Make sure `FIREBASE_SERVICE_ACCOUNT_JSON` belongs to that same Firebase project.
4. Redeploy both services after changing any Firebase environment variable.

`GOOGLE_CLIENT_ID` is only needed for the legacy `/api/auth/google` backend route. The current UI login flow uses Firebase popup sign-in.

## Common Deployment Issues

### Frontend loads but API calls fail

Cause:

- `REACT_APP_API_URL` is missing or still points to localhost

Fix:

- Set `REACT_APP_API_URL=https://your-backend-service.onrender.com/api`
- Redeploy the frontend

### CORS errors in browser console

Cause:

- backend `CLIENT_URL` or `CORS_ORIGINS` does not include the deployed frontend URL

Fix:

- add the frontend Render URL to `CLIENT_URL` and `CORS_ORIGINS`
- redeploy the backend

### Backend fails during startup

Cause:

- missing `MONGODB_URI`
- missing `JWT_SECRET`
- MongoDB Atlas network access is blocked
- invalid Firebase admin JSON

Fix:

- verify backend environment variables
- verify Atlas connection and network access
- verify the Firebase service account JSON format

### Login works locally but Google sign-in fails on Render

Cause:

- Render frontend domain is not listed in Firebase authorized domains

Fix:

- add the frontend Render domain in Firebase Authentication settings
- redeploy frontend if Firebase config changed

### React routes return 404 on refresh

Cause:

- missing static site rewrite rule

Fix:

- add `/* -> /index.html` as a `Rewrite` rule in the frontend Render service

## Local Verification Completed

The deployment-related code path was verified locally:

- frontend production build succeeds
- backend syntax check passes
- backend starts successfully with the current environment
- `/api/health` responds successfully

## Files To Check For Environment Templates

- `.env.example`
- `backend/.env.example`
- `frontend/.env.example`
