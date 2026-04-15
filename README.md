# SmartCollab - Student Team Collaboration Platform

**Version:** 1.0.0  
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
- **Deployment:** (To be configured)
