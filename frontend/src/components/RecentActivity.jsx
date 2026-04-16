import React, { useState, useEffect } from 'react';
import api from '../services/api';
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
      const { data } = await api.get('/activity');
      setActivities(Array.isArray(data?.activity) ? data.activity : []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
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
                {activity.icon || '•'}
              </div>
              <div className="activity-content">
                <p className="activity-action">{activity.text || activity.action}</p>
                <p className="activity-time">{activity.time || formatTime(activity.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
