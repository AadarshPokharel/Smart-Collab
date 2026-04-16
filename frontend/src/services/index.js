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

  getCurrentUser: () =>
    api.get('/auth/me'),

  updateProfile: (data) =>
    api.put('/auth/me', data),
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
  createTask: (title, description, projectId, priority, dueDate, assignedTo) =>
    api.post('/tasks', {
      title,
      description,
      projectId,
      priority,
      dueDate,
      assignedTo,
    }),

  getProjectTasks: (projectId) =>
    api.get('/tasks', { params: { projectId } }),

  getMyTasks: () =>
    api.get('/tasks'),

  updateTask: (id, data) =>
    api.put(`/tasks/${id}`, data),

  updateTaskStatus: (id, status) =>
    api.patch(`/tasks/${id}/status`, { status }),

  deleteTask: (id) =>
    api.delete(`/tasks/${id}`),
};
