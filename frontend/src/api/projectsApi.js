import api from '../services/api';

/**
 * Projects API Layer
 * All project-related API calls
 */

/**
 * Get all projects for the authenticated user
 * @returns {Promise} Array of projects
 */
export const fetchProjects = async () => {
  try {
    const response = await api.get('/projects');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Get a specific project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise} Project object
 */
export const fetchProjectById = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Create a new project
 * @param {Object} projectData - { title, description }
 * @returns {Promise} Created project object
 */
export const createProject = async (projectData) => {
  try {
    const response = await api.post('/projects', projectData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Update an existing project
 * @param {string} projectId - Project ID
 * @param {Object} updates - { title?, description?, status?, milestones? }
 * @returns {Promise} Updated project object
 */
export const updateProject = async (projectId, updates) => {
  try {
    const response = await api.put(`/projects/${projectId}`, updates);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Delete a project
 * @param {string} projectId - Project ID
 * @returns {Promise} Success message
 */
export const deleteProject = async (projectId) => {
  try {
    const response = await api.delete(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Invite a member to a project
 * @param {string} projectId - Project ID
 * @param {Object} memberData - { userId, role }
 * @returns {Promise} Updated project with new member
 */
export const inviteMember = async (projectId, memberData) => {
  try {
    const response = await api.post(`/projects/${projectId}/invite`, memberData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Remove a member from a project
 * @param {string} projectId - Project ID
 * @param {string} memberId - Member user ID
 * @returns {Promise} Updated project
 */
export const removeMember = async (projectId, memberId) => {
  try {
    const response = await api.delete(`/projects/${projectId}/members/${memberId}`, {
      data: { memberId },
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
