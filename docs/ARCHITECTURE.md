# SmartCollab Architecture

## System Architecture Overview

SmartCollab follows a three-tier architecture pattern: **Frontend, Backend, and Database**.

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT TIER (Frontend)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React SPA (Single Page Application)                 │   │
│  │  - Components, Pages, Services                       │   │
│  │  - JWT Token Management                             │   │
│  │  - State Management (Context API)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS + JWT
┌────────────────────▼────────────────────────────────────────┐
│                   SERVER TIER (Backend)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js Application Server                       │   │
│  │  ├── Routes (API Endpoints)                          │   │
│  │  ├── Controllers (Business Logic)                    │   │
│  │  ├── Middleware (Auth, Validation, CORS)            │   │
│  │  └── Config (Database, Environment)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ MongoDB Driver / Mongoose
┌────────────────────▼────────────────────────────────────────┐
│                  DATA TIER (Database)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MongoDB                                             │   │
│  │  ├── Users Collection                                │   │
│  │  ├── Projects Collection                             │   │
│  │  ├── Tasks Collection                                │   │
│  │  ├── Messages Collection                             │   │
│  │  ├── Files Collection                                │   │
│  │  └── Notifications Collection                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Structure

```
frontend/src/
├── components/
│   ├── Layout/
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── MainLayout.jsx
│   ├── Auth/
│   │   ├── LoginForm.jsx
│   │   ├── RegisterForm.jsx
│   │   └── ProtectedRoute.jsx
│   ├── Dashboard/
│   │   ├── ProjectCard.jsx
│   │   ├── TaskCard.jsx
│   │   └── QuickStats.jsx
│   ├── Project/
│   │   ├── TaskBoard.jsx
│   │   ├── MembersPanel.jsx
│   │   ├── ChatPanel.jsx
│   │   └── FileShare.jsx
│   └── Common/
│       ├── Modal.jsx
│       ├── Button.jsx
│       ├── Input.jsx
│       └── Loading.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   ├── ProjectPage.jsx
│   └── NotFoundPage.jsx
├── services/
│   ├── api.js (Axios instance)
│   ├── authService.js
│   ├── projectService.js
│   ├── taskService.js
│   └── userService.js
├── utils/
│   ├── auth.js (Token management)
│   ├── formatters.js
│   └── validators.js
└── App.jsx
```

### Backend Structure

```
backend/src/
├── models/
│   ├── User.js
│   ├── Project.js
│   ├── Task.js
│   ├── Message.js
│   ├── File.js
│   └── Notification.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── projects.js
│   ├── tasks.js
│   ├── messages.js
│   └── files.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── projectController.js
│   ├── taskController.js
│   ├── messageController.js
│   └── fileController.js
├── middleware/
│   ├── auth.js (JWT verification)
│   ├── errorHandler.js
│   ├── validation.js
│   └── roleCheck.js
├── config/
│   ├── database.js
│   ├── env.js
│   └── constants.js
└── index.js
```

---

## Data Flow Diagram

### Authentication Flow

```
User Input (Login)
    ↓
Frontend: LoginForm → Calls authService.login()
    ↓
POST /api/auth/login {email, password}
    ↓
Backend: authController.login()
    ├─ Validate input
    ├─ Hash password and compare
    ├─ Generate JWT token
    └─ Return token + user data
    ↓
Frontend: Store token in localStorage
    ↓
User logged in
```

### Task Creation Flow

```
User fills Task Form in ProjectPage
    ↓
Frontend: Calls taskService.createTask()
    ↓
POST /api/tasks {title, description, project, priority, dueDate}
    ↓
Backend: Middleware validates JWT token
    ↓
Backend: taskController.createTask()
    ├─ Validate task data
    ├─ Create new Task document
    ├─ Add task to project
    └─ Return task object
    ↓
Frontend: Update task list in UI
    ↓
Real-time update via State Management
```

---

## API Communication Pattern

### Request/Response Format

**Request:**
```json
{
  "method": "POST",
  "url": "/api/projects",
  "headers": {
    "Authorization": "Bearer <jwt_token>",
    "Content-Type": "application/json"
  },
  "body": {
    "name": "Project Name",
    "description": "Description"
  }
}
```

**Response (Success - 200/201):**
```json
{
  "success": true,
  "data": {
    "_id": "project_id",
    "name": "Project Name",
    "description": "Description",
    "leader": "user_id",
    "members": ["user_id_1", "user_id_2"]
  }
}
```

**Response (Error - 400/401/500):**
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────┐
│   User Login/Registration               │
└────────────┬────────────────────────────┘
             ↓
    Validate Credentials
             ↓
    Generate JWT Token
    (Header.Payload.Signature)
             ↓
    Store in localStorage (Frontend)
             ↓
    Include in Authorization Header
    ↓ (for all API requests)
    Backend Middleware Verifies Token
             ↓
    Decode & Validate Signature
             ↓
    Extract User Info
             ↓
    Proceed to Controller
             ↓
    Request Executed
```

### Token Structure

```javascript
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "_id": "user_id",
  "email": "user@example.com",
  "role": "user",
  "iat": 1234567890,
  "exp": 1234571490  // 1 hour expiry
}

Signature: HMAC(
  Base64(Header) + "." + Base64(Payload),
  Secret
)
```

---

## Database Relationships

```
┌─────────────┐
│    Users    │
│ (id: _id)   │
└──────┬──────┘
       │
       ├─── one-to-many ──→ Projects (leader)
       │
       ├─── many-to-many ──→ Projects (members)
       │
       ├─── one-to-many ──→ Tasks (assignedTo)
       │
       ├─── one-to-many ──→ Messages (sender)
       │
       ├─── one-to-many ──→ Files (uploadedBy)
       │
       └─── one-to-many ──→ Notifications (recipient)


┌──────────────┐
│  Projects    │
│ (id: _id)    │
└──────┬───────┘
       │
       ├─── one-to-many ──→ Tasks
       │
       ├─── one-to-many ──→ Messages
       │
       ├─── one-to-many ──→ Files
       │
       └─── one-to-many ──→ Notifications


┌─────────────┐
│    Tasks    │
│ (id: _id)   │
└─────────────┘
       │
       └─── referenced by ──→ Notifications
```

---

## Middleware Pipeline

```
Request
  ↓
1. CORS Middleware
   (Allow cross-origin requests)
  ↓
2. Body Parser
   (Parse JSON request body)
  ↓
3. Morgan Logger
   (Log all requests)
  ↓
4. Authentication Middleware
   (Verify JWT token for protected routes)
  ↓
5. Route Handler
   (Execute controller logic)
  ↓
6. Error Handler
   (Catch and format errors)
  ↓
Response
```

---

## Deployment Architecture (Future)

```
┌──────────────────────────────────────┐
│    Client (Browser)                  │
└────────────────┬─────────────────────┘
                 │ HTTPS
┌────────────────▼─────────────────────┐
│    AWS / Cloud Provider              │
│  ┌──────────────────────────────────┐│
│  │   CDN (CloudFront)                ││
│  │  - Serve static assets            ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │   Load Balancer                   ││
│  │  - Distribute traffic             ││
│  └────────┬─────────────────────────┘│
│           │                          │
│  ┌────────▼──────┬──────────────┐   │
│  │  App Server 1 │ App Server 2 │   │
│  │  (Express)    │ (Express)    │   │
│  └────────┬──────┴──────┬───────┘   │
│           │             │           │
│  ┌────────▼─────────────▼────────┐  │
│  │   MongoDB Atlas / RDS         │  │
│  │  - Data persistence           │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Performance Optimization Strategies

1. **Frontend:**
   - Code splitting with React.lazy()
   - Lazy loading of components
   - Caching API responses
   - Optimized re-renders

2. **Backend:**
   - Database indexing on frequently queried fields
   - Pagination for large datasets
   - Caching with Redis (future)
   - Query optimization

3. **General:**
   - GZIP compression
   - CDN for static assets
   - Connection pooling
   - Rate limiting

---

## Error Handling

### Frontend Error Handling
```javascript
try {
  const response = await api.post('/tasks', taskData);
  updateState(response.data);
} catch (error) {
  if (error.response?.status === 401) {
    redirectToLogin();
  } else if (error.response?.status === 400) {
    showValidationErrors(error.response.data);
  } else {
    showGenericError();
  }
}
```

### Backend Error Handling
```javascript
// Centralized error handler middleware
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({
    success: false,
    error: message
  });
});
```

---

## Scalability Considerations

- Microservices architecture (future)
- Message queues for async operations
- WebSocket for real-time features
- Database replication & sharding
- Horizontal scaling with load balancers
