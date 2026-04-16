import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/TaskBoard.css';

const TaskBoard = () => {
  const [tasks, setTasks] = useState({ todo: [], inProgress: [], done: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tasks');
      const responseTasks = Array.isArray(data?.tasks) ? data.tasks : [];

      const grouped = {
        todo: responseTasks.filter((t) => t.status === 'To Do'),
        inProgress: responseTasks.filter((t) => t.status === 'In Progress'),
        done: responseTasks.filter((t) => t.status === 'Done')
      };
      
      setTasks(grouped);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks({ todo: [], inProgress: [], done: [] });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="task-board"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="task-board">
      <div className="task-board-header">
        <h2>Task Board</h2>
        <button className="view-all-btn">View All Tasks</button>
      </div>

      <div className="kanban-board">
        {/* To Do Column */}
        <div className="kanban-column">
          <div className="column-header">
            <h3>To Do</h3>
            <span className="column-count">{tasks.todo.length}</span>
          </div>
          <div className="column-tasks">
            {tasks.todo.length === 0 ? (
              <div className="empty-column">No tasks</div>
            ) : (
              tasks.todo.map(task => (
                <div key={task._id} className="task-card">
                  <div className="task-priority" style={{
                    background: task.priority === 'high' ? '#d13438' : 
                               task.priority === 'medium' ? '#ffb900' : '#107c10'
                  }}></div>
                  <h4>{task.title}</h4>
                  <p className="task-project">{task.project?.title || task.project?.name || 'No Project'}</p>
                  {task.dueDate && (
                    <p className="task-date">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="kanban-column">
          <div className="column-header">
            <h3>In Progress</h3>
            <span className="column-count">{tasks.inProgress.length}</span>
          </div>
          <div className="column-tasks">
            {tasks.inProgress.length === 0 ? (
              <div className="empty-column">No tasks</div>
            ) : (
              tasks.inProgress.map(task => (
                <div key={task._id} className="task-card">
                  <div className="task-priority" style={{
                    background: task.priority === 'high' ? '#d13438' : 
                               task.priority === 'medium' ? '#ffb900' : '#107c10'
                  }}></div>
                  <h4>{task.title}</h4>
                  <p className="task-project">{task.project?.title || task.project?.name || 'No Project'}</p>
                  {task.dueDate && (
                    <p className="task-date">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Done Column */}
        <div className="kanban-column">
          <div className="column-header">
            <h3>Done</h3>
            <span className="column-count">{tasks.done.length}</span>
          </div>
          <div className="column-tasks">
            {tasks.done.length === 0 ? (
              <div className="empty-column">No tasks</div>
            ) : (
              tasks.done.map(task => (
                <div key={task._id} className="task-card completed">
                  <div className="task-priority" style={{
                    background: task.priority === 'high' ? '#d13438' : 
                               task.priority === 'medium' ? '#ffb900' : '#107c10'
                  }}></div>
                  <h4>{task.title}</h4>
                  <p className="task-project">{task.project?.title || task.project?.name || 'No Project'}</p>
                  {task.dueDate && (
                    <p className="task-date">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;
