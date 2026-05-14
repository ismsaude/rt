import React, { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <div>
      <h2>O que fazer hoje?</h2>
      
      <div className="task-list">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`task-item ${task.done ? 'completed' : ''}`}
            onClick={() => toggleTask(task.id)}
          >
            <div className="task-icon">
              {task.done ? <CheckCircle2 size={40} /> : <Circle size={40} />}
            </div>
            <div className="task-content">
              <div className="task-title">{task.title}</div>
              <div className="task-time">Às {task.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
