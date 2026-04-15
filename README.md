# SmartCollab - Student Team Collaboration Platform

**Version:** 1.0.0 (Sprint 3)  
**Status:** In Development  
**Team:** Aadarsh Pokharel, Subash Gyawali, Nisshreet Bhattarai, Anubhav Pokhrel, Swastik Paudel, Naba Raj Khatri

---

## Project Overview

SmartCollab is a web-based collaboration platform designed specifically for student teams to manage group projects efficiently. It provides a centralized system for task management, team communication, deadline tracking, and contribution monitoring.

### Problem Statement
Student teams struggle with:
- Organizing group projects across multiple tools
- Managing deadlines effectively
- Tracking task progress
- Ensuring equal contribution among members
- Communicating in one unified space

### Solution
SmartCollab combines all essential features into one platform:
- Project creation and team management
- Task assignment and status tracking
- Real-time communication
- File sharing and collaboration
- Contribution monitoring

---

## Project Structure

```
Smart-Collab/
├── frontend/                 # React.js application
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service calls
│   │   ├── styles/          # CSS/styling
│   │   ├── utils/           # Helper functions
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
│
├── backend/                  # Node.js/Express server
│   ├── src/
│   │   ├── routes/          # API route definitions
│   │   ├── controllers/     # Route controllers
│   │   ├── models/          # MongoDB schemas
│   │   ├── middleware/      # Custom middleware
│   │   ├── config/          # Configuration files
│   │   └── index.js         # Server entry point
│   ├── package.json
│   └── .env.example
│
├── docs/                     # Project documentation
│   ├── DATABASE_SCHEMA.md    # Database design
│   ├── API_DOCUMENTATION.md  # API endpoints
│   ├── UI_WIREFRAMES.md      # UI/UX design
│   ├── ARCHITECTURE.md       # System architecture
│   └── SETUP_GUIDE.md        # Setup instructions
│
└── README.md
```

---

## Technology Stack

### Frontend
- **Framework:** React 18.2
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **State Management:** React Context API
- **Authentication:** JWT tokens

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 4.18
- **Database:** MongoDB 7.0
- **Authentication:** JWT (jwt-simple)
- **Security:** bcrypt for password hashing
- **CORS:** Enabled for frontend communication

### Database
- **Primary:** MongoDB (NoSQL)
- **Alternative:** PostgreSQL (optional)

### DevOps
- **Development:** Nodemon for auto-reload
- **Testing:** Jest
- **Deployment:** (To be configured in later sprints)

---

## Current Development Status - Sprint 3

### Sprint 3 Goals ✓
- [x] Design database schema
- [x] Create API documentation
- [x] Design UI wireframes
- [x] Define architecture
- [x] Set up project structure

### Completed
- Project folder structure created
- Frontend (React) foundation set up
- Backend (Express) foundation set up
- Database schema designed (MongoDB)
- API documentation created
- UI wireframes documented

### In Progress
- Frontend components development
- Backend route implementation
- Database models creation

### Next Steps (Sprint 4)
- Implement authentication (login/register)
- Create database models
- Build API endpoints
- Develop frontend components
- Integrate frontend with backend

---

## Installation & Setup

### Prerequisites
- Node.js 14+ installed
- MongoDB 4.4+ (or MongoDB Atlas account)
- npm or yarn package manager

### Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm start
```

The frontend will run on `http://localhost:3000`

### Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The backend will run on `http://localhost:5000`

---

## API Documentation

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for complete API reference including:
- Authentication endpoints
- User management
- Project management
- Task management
- File operations
- Chat/messaging (future)

---

## Database Schema

See [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for detailed information about:
- Collections design
- Data relationships
- Indexing strategy
- Future enhancements

---

## UI/UX Design

See [UI_WIREFRAMES.md](./docs/UI_WIREFRAMES.md) for:
- Page layouts and wireframes
- Component hierarchy
- Color scheme
- Typography
- Responsive design specifications

---

## Team Roles

| Role | Member | Responsibilities |
|------|--------|------------------|
| Project Manager | - | Planning, documentation, sprint management |
| Frontend Developer 1 | - | Login, authentication UI, dashboard |
| Frontend Developer 2 | - | Task board, project pages, components |
| Backend Developer 1 | - | Auth APIs, user management, security |
| Backend Developer 2 | - | Project APIs, task APIs, database |
| QA & Deployment | - | Testing, bug tracking, deployment |

---

## Core Features (MVP - Sprint 1-2)

- ✓ User signup and login
- ✓ Create projects and add team members
- ✓ Create and assign tasks
- ✓ Task status tracking (To Do / In Progress / Done)
- ✓ Deadline management
- Project dashboard with progress overview

## Advanced Features (Sprint 3+)

- [ ] Real-time chat system
- [ ] File sharing and storage
- [ ] Push notifications
- [ ] Role-based access control
- [ ] Contribution tracking
- [ ] Activity timeline
- [ ] Audit logs

---

## Development Workflow

### Git Workflow
- Main branch: `main` (production)
- Development branch: `develop`
- Feature branches: `feature/feature-name`
- Bug fixes: `bugfix/bug-name`

### Commit Convention
```
[Type] Short description
- Type: feat (feature), fix (bug), docs (documentation), refactor
```

### PR Process
1. Create feature branch from `develop`
2. Make changes and commit
3. Push and create Pull Request
4. Code review by team members
5. Merge to `develop` after approval

---

## Sprint Schedule

| Sprint | Duration | Focus |
|--------|----------|-------|
| Sprint 1 | Weeks 1-2 | Project setup, requirements |
| Sprint 2 | Weeks 3-4 | Architecture, database design |
| **Sprint 3** | **Weeks 5-6** | **UI design, API structure** |
| Sprint 4 | Weeks 7-8 | Backend implementation |
| Sprint 5 | Weeks 9-10 | Frontend development |
| Sprint 6+ | Weeks 11+ | Testing, deployment, refinement |

---

## Resources

- [Project Charter](../project_Charter_Collabrix.pdf)
- [Sprint Reports](../Sprint_1_Report_CSE_4316.pdf)
- [Project Details](../smart%20collab%20all%20project%20details.pdf)

---

## Contact & Support

For questions or issues, please contact the team leads or create an issue in the repository.

---

**Last Updated:** Sprint 3 - Database and API Design Phase  
**Next Review:** Sprint 3 Review Meeting
