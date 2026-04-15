# SmartCollab Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0 or higher) - [Download](https://nodejs.org/)
- **npm** (v6.0 or higher) - Comes with Node.js
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community) OR use MongoDB Atlas (cloud)
- **Git** - [Download](https://git-scm.com/)

### Verify Installation

```bash
node --version    # Should be v14 or higher
npm --version     # Should be v6 or higher
mongodb --version # Should be v4.4 or higher
git --version
```

---

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/AadarshPokharel/Smart-Collab.git
cd Smart-Collab
```

### 2. Set Up Environment Variables

#### Frontend (.env.local)

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_JWT_TOKEN=token
```

#### Backend (.env)

```bash
cd ../backend
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smartcollab
# For MongoDB Atlas, use:
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/smartcollab

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## Database Setup

### Option A: Local MongoDB

1. **Install MongoDB:**
   ```bash
   # macOS
   brew install mongodb-community

   # Windows - Download installer from https://www.mongodb.com/try/download/community

   # Linux (Ubuntu)
   sudo apt-get install -y mongodb
   ```

2. **Start MongoDB:**
   ```bash
   # macOS
   brew services start mongodb-community

   # Windows - MongoDB runs as a service after installation

   # Linux
   sudo systemctl start mongod
   ```

3. **Verify MongoDB is Running:**
   ```bash
   mongosh  # Opens MongoDB shell
   > db.version()  # Should show version number
   > exit
   ```

### Option B: MongoDB Atlas (Cloud)

1. **Create Account:**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create a Cluster:**
   - Click "Create" to build a new cluster
   - Choose "Shared" (free tier)
   - Select your region
   - Click "Create Cluster"

3. **Get Connection String:**
   - Go to "Database" section
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>`, `<password>`, and `<cluster>` with your credentials

4. **Update .env:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartcollab?retryWrites=true&w=majority
   ```

---

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create Database Indexes

```bash
npm run seed  # If seed script is available
```

Or manually in MongoDB shell:
```javascript
use smartcollab;
db.users.createIndex({ email: 1 }, { unique: true });
db.projects.createIndex({ leader: 1 });
db.projects.createIndex({ members: 1 });
db.tasks.createIndex({ project: 1 });
db.tasks.createIndex({ assignedTo: 1 });
```

### 3. Start Backend Server

```bash
npm run dev
```

Expected output:
```
MongoDB connected
SmartCollab backend running on port 5000
```

### 4. Test Backend

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{ "status": "Server is running" }
```

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm start
```

The application will automatically open at `http://localhost:3000`

### 3. Verify Frontend

- You should see the SmartCollab login page
- Try entering test credentials (once backend is running)

---

## Running Both Servers

### Terminal Setup

**Option 1: Two Terminal Windows**

**Terminal 1 - Backend:**
```bash
cd Smart-Collab/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd Smart-Collab/frontend
npm start
```

**Option 2: Using tmux (macOS/Linux)**

```bash
tmux new-session -d -s smartcollab
tmux send-keys -t smartcollab 'cd backend && npm run dev' Enter
tmux new-window -t smartcollab
tmux send-keys -t smartcollab 'cd frontend && npm start' Enter
tmux attach -t smartcollab
```

**Option 3: Using Concurrently (Both in one terminal)**

Install concurrently in root directory:
```bash
npm install -D concurrently
```

Create `package.json` in root with:
```json
{
  "scripts": {
    "dev": "concurrently \"npm --prefix backend run dev\" \"npm --prefix frontend start\""
  }
}
```

Then run:
```bash
npm run dev
```

---

## Project Structure Verification

After setup, your project should look like:

```
Smart-Collab/
├── frontend/
│   ├── node_modules/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── .env.local
│   └── ...
├── backend/
│   ├── node_modules/
│   ├── src/
│   ├── package.json
│   ├── .env
│   └── ...
└── docs/
    ├── API_DOCUMENTATION.md
    ├── DATABASE_SCHEMA.md
    ├── UI_WIREFRAMES.md
    └── ARCHITECTURE.md
```

---

## Common Issues & Troubleshooting

### Issue: "MongoDB connection refused"

**Solution:**
```bash
# Check if MongoDB is running
mongosh

# If not running, start it:
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Issue: "Port 5000 already in use"

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port - update .env
PORT=5001
```

### Issue: "npm install fails with permission errors"

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install

# Or use sudo (not recommended)
# sudo npm install
```

### Issue: "Frontend can't reach backend API"

**Solution:**
- Check backend is running on `http://localhost:5000`
- Check `.env.local` has correct `REACT_APP_API_URL`
- Check CORS is enabled in backend
- Clear browser cache

### Issue: "JWT token errors"

**Solution:**
- Clear localStorage: Open DevTools → Application → Storage → Clear All
- Log in again
- Check `JWT_SECRET` in `.env` is set

---

## First Time Run Checklist

- [ ] Node.js and npm installed
- [ ] MongoDB installed or Atlas account created
- [ ] Repository cloned
- [ ] Environment variables configured
- [ ] MongoDB running
- [ ] Backend dependencies installed (`npm install`)
- [ ] Backend started (`npm run dev`)
- [ ] Backend health check passing
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Frontend started (`npm start`)
- [ ] Can see login page at `http://localhost:3000`

---

## Next Steps

1. **Create Test User:**
   - Navigate to registration page
   - Create a new account with email and password
   - Log in with those credentials

2. **Test Core Features:**
   - Create a project
   - Add team members
   - Create tasks
   - Update task status

3. **Review Documentation:**
   - Read [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
   - Review [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
   - Study [UI_WIREFRAMES.md](./UI_WIREFRAMES.md)
   - Check [ARCHITECTURE.md](./ARCHITECTURE.md)

4. **Development:**
   - Start working on Sprint 4 tasks
   - Refer to GitHub Issues for task assignments
   - Follow the Git workflow

---

## Performance Tips

- Use MongoDB Atlas for better uptime during development
- Install MongoDB Compass for database visualization
- Use VS Code REST Client extension for API testing
- Use Redux DevTools for frontend state debugging

---

## Getting Help

- Check the troubleshooting section above
- Review project documentation in `/docs`
- Check GitHub Issues for similar problems
- Ask team members on Slack/Discord

---

## Useful Commands

```bash
# Backend
npm run dev           # Start development server
npm test              # Run tests
npm run build         # Build for production

# Frontend
npm start             # Start development server
npm build             # Build for production
npm test              # Run tests

# MongoDB (local)
mongosh               # Open MongoDB shell
show databases        # List databases
use smartcollab       # Select database
db.users.find()       # Find all users
```

---

**Version:** Sprint 3  
**Last Updated:** April 2024  
**Status:** Ready for Development
