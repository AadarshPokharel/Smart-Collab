import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/RecentActivity.css';

const RecentActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch tasks to use as activity
      const tasksResponse = await axios.get('http://localhost:5001/api/tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch projects to use as activity
      const projectsResponse = await axios.get('http://localhost:5001/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Create mock activities (in a real app, you'd have an activity log endpoint)
      const mockActivities = [
        ...tasksResponse.data.slice(0, 3).map(task => ({
          id: `task-${task._id}`,
          type: 'task',
          action: `Created task: ${task.title}`,
          timestamp: new Date(task.createdAt || Date.now()),
          icon: '✓'
        })),
        ...projectsResponse.data.slice(0, 2).map(project => ({
          id: `project-${project._id}`,
          type: 'project',
          action: `Started project: ${project.name}`,
          timestamp: new Date(project.createdAt || Date.now()),
          icon: '▢'
        }))
      ];

      setActivities(
        mockActivities
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 8)
      );
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="recent-activity"><div className="activity-loading"></div></div>;
  }

  return (
    <div className="recent-activity">
      <div className="activity-header">
        <h3>Recent Activity</h3>
        <a href="/activity" className="view-all-link">View All</a>
      </div>

      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="empty-activity">
            <p>No recent activity</p>
          </div>
        ) : (
          activities.map(activity => (
            <div key={activity.id} className={`activity-item ${activity.type}`}>
              <div className="activity-icon">
                {activity.icon}
              </div>
              <div className="activity-content">
                <p className="activity-action">{activity.action}</p>
                <p className="activity-time">{formatTime(activity.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
