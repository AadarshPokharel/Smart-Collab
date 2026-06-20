import api from './api';

export const authService = {
  register: (firstName, lastName, email, password, confirmPassword) =>
    api.post('/auth/register', {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    }),

  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  firebaseLogin: (idToken, profile = {}) =>
    api.post('/auth/firebase', { idToken, ...profile }),

  googleLogin: (credential) =>
    api.post('/auth/google', { credential }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, password, confirmPassword) =>
    api.post(`/auth/reset-password/${token}`, { password, confirmPassword }),

  getCurrentUser: () =>
    api.get('/auth/me'),

  updateProfile: (data) =>
    api.put('/auth/me', data),

  updatePreferences: (data) =>
    api.put('/auth/me/preferences', data),

  changePassword: (data) =>
    api.put('/auth/me/password', data),
};

export const projectService = {
  createProject: (title, description) =>
    api.post('/projects', { title, description }),

  getProjects: () =>
    api.get('/projects'),

  getProjectById: (id) =>
    api.get(`/projects/${id}`),

  updateProject: (id, data) =>
    api.put(`/projects/${id}`, data),

  deleteProject: (id) =>
    api.delete(`/projects/${id}`),

  inviteMember: (projectId, memberData) =>
    api.post(`/projects/${projectId}/invite`, memberData),

  addMember: (projectId, userId) =>
    api.post(`/projects/${projectId}/members`, { userId }),

  removeMember: (projectId, memberId) =>
    api.delete(`/projects/${projectId}/members/${memberId}`, {
      data: { memberId },
    }),
};

export const taskService = {
  createTask: (
    title,
    description,
    projectId,
    priority,
    dueDate,
    assignedTo,
    status = 'To Do'
  ) =>
    api.post('/tasks', {
      title,
      description,
      projectId,
      priority,
      dueDate,
      assignedTo,
      status,
    }),

  createTaskRecord: (data) =>
    api.post('/tasks', data),

  getTasks: (params = {}) =>
    api.get('/tasks', { params }),

  getProjectTasks: (projectId) =>
    api.get('/tasks', { params: { projectId } }),

  getMyTasks: () =>
    api.get('/tasks', { params: { scope: 'mine' } }),

  getTaskById: (id) =>
    api.get(`/tasks/${id}`),

  updateTask: (id, data) =>
    api.put(`/tasks/${id}`, data),

  updateTaskStatus: (id, status) =>
    api.patch(`/tasks/${id}/status`, { status }),

  deleteTask: (id) =>
    api.delete(`/tasks/${id}`),
};
