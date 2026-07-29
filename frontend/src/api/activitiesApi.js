import api from '../services/api';

export const fetchActivities = async (params = {}) => {
  try {
    const response = await api.get('/activities', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const fetchProjectActivities = async (projectId, params = {}) => {
  try {
    const response = await api.get(`/projects/${projectId}/activities`, { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
