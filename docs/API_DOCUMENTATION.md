# SmartCollab API Documentation

## Base URL
```
http://localhost:5001/api
```

---

## Authentication Endpoints

### 1. User Registration
**POST** `/auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }
}
```

---

### 2. User Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "firstName": "John",
    "email": "john@example.com"
  }
}
```

---

## User Endpoints

### 3. Get User Profile
**GET** `/users/:id`
- **Authentication:** Required (JWT)
- **Response (200):** User object with all details

### 4. Update User Profile
**PUT** `/users/:id`
- **Authentication:** Required (JWT)
- **Request Body:** `{ firstName, lastName, avatar, bio }`
- **Response (200):** Updated user object

### 5. Delete User Account
**DELETE** `/users/:id`
- **Authentication:** Required (JWT)
- **Response (200):** Success message

---

## Project Endpoints

### 6. Create Project
**POST** `/projects`
- **Authentication:** Required (JWT)
- **Request Body:**
```json
{
  "name": "Mobile App Project",
  "description": "Building a mobile app"
}
```
- **Response (201):** Project object with leader set to current user

### 7. Get All Projects for User
**GET** `/projects`
- **Authentication:** Required (JWT)
- **Response (200):** Array of projects where user is member or leader

### 8. Get Project Details
**GET** `/projects/:id`
- **Authentication:** Required (JWT)
- **Response (200):** Project object with all members

### 9. Update Project
**PUT** `/projects/:id`
- **Authentication:** Required (JWT)
- **Authorization:** Only project leader
- **Request Body:** `{ name, description, status }`
- **Response (200):** Updated project object

### 10. Delete Project
**DELETE** `/projects/:id`
- **Authentication:** Required (JWT)
- **Authorization:** Only project leader
- **Response (200):** Success message

### 11. Add Team Member
**POST** `/projects/:id/members`
- **Authentication:** Required (JWT)
- **Authorization:** Only project leader
- **Request Body:** `{ userId }`
- **Response (200):** Updated project with new member

### 12. Remove Team Member
**DELETE** `/projects/:id/members/:userId`
- **Authentication:** Required (JWT)
- **Authorization:** Only project leader
- **Response (200):** Updated project without member

---

## Task Endpoints

### 13. Create Task
**POST** `/tasks`
- **Authentication:** Required (JWT)
- **Request Body:**
```json
{
  "title": "Design Login Page",
  "description": "Create wireframe and design",
  "project": "project_id",
  "priority": "High",
  "dueDate": "2024-04-20"
}
```
- **Response (201):** Task object

### 14. Get Tasks by Project
**GET** `/tasks?project=project_id`
- **Authentication:** Required (JWT)
- **Response (200):** Array of tasks in project

### 15. Get Tasks Assigned to User
**GET** `/tasks?assignedTo=user_id`
- **Authentication:** Required (JWT)
- **Response (200):** Array of user's tasks

### 16. Update Task
**PUT** `/tasks/:id`
- **Authentication:** Required (JWT)
- **Request Body:** `{ title, description, status, priority, assignedTo, dueDate }`
- **Response (200):** Updated task object

### 17. Delete Task
**DELETE** `/tasks/:id`
- **Authentication:** Required (JWT)
- **Authorization:** Only task creator or project leader
- **Response (200):** Success message

### 18. Update Task Status
**PATCH** `/tasks/:id/status`
- **Authentication:** Required (JWT)
- **Request Body:** `{ status: "In Progress" }`
- **Response (200):** Updated task object

---

## Message Endpoints (Future)

### 19. Get Project Messages
**GET** `/projects/:id/messages`
- **Authentication:** Required (JWT)
- **Response (200):** Array of messages in project

### 20. Send Message
**POST** `/projects/:id/messages`
- **Authentication:** Required (JWT)
- **Request Body:** `{ content }`
- **Response (201):** Message object

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid input data"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication token required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Not authorized to perform this action"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Authentication Header
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## Rate Limiting
- 100 requests per 15 minutes per IP address
- 1000 requests per hour per authenticated user
