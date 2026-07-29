# SmartCollab Render Deployment

SmartCollab is set up for a single-service Render deployment:

- one Render web service
- Express serves the React production build
- frontend API requests use the same host via `/api`
- MongoDB stays external through `MONGODB_URI`

## Render Setup

1. Push the latest `main` branch to GitHub.
2. In Render, create a new Blueprint deployment from this repository.
3. Render will read [`render.yaml`](/Users/mr.apokharelgmail.com/Desktop/school/collabrix/Smart-Collab/render.yaml).
4. Provide the required secret environment variables when prompted:
   - `MONGODB_URI`
   - `GOOGLE_CLIENT_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
5. Wait for the build to finish.

## Required Secrets

`MONGODB_URI`
- Use your MongoDB Atlas connection string for the SmartCollab database.

`GOOGLE_CLIENT_ID`
- Use the web client ID from your Google/Firebase auth setup.

`FIREBASE_PROJECT_ID`
- Use the Firebase project ID that matches the client and service account.

`FIREBASE_SERVICE_ACCOUNT_JSON`
- Paste the full Firebase service account JSON as a single string value.

## Demo-Day Recommendation

`render.yaml` currently uses Render's `free` plan to avoid forcing paid spend in code.

For demo day, change the service to `starter` in the Render dashboard if you want to avoid free-tier sleep/cold-start behavior.

## Custom Domain Note

If you later attach a custom domain, add that domain to:

- `FRONTEND_URL`
or
- `FRONTEND_URLS`

in the Render service environment settings so CORS continues to allow browser requests.
