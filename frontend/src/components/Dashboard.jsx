import React, { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard({ role }) {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    // Tenta buscar do Supabase (tabela Task precisa existir: id, title, time, done, created_at)
    const { data, error } = await supabase.from('Task').select('*').order('time', { ascending: true });
    if (data) {
      setTasks(data);
    } else {
      // Fallback para localStorage caso a tabela não exista ainda
      const localTasks = JSON.parse(localStorage.getItem('rt_tasks') || '[]');
      setTasks(localTasks);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle || !newTaskTime) return;
    
    const newTask = { title: newTaskTitle, time: newTaskTime, done: false, created_at: new Date().toISOString() };
    
    const { data, error } = await supabase.from('Task').insert([newTask]).select();
    
    if (error) {
      // Fallback
      const updated = [...tasks, { ...newTask, id: Date.now() }];
      setTasks(updated);
      localStorage.setItem('rt_tasks', JSON.stringify(updated));
    } else if (data) {
      setTasks([...tasks, data[0]]);
    }
    
    setNewTaskTitle('');
    setNewTaskTime('');
  };

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newDoneState = !task.done;
    
    // Otimista
    setTasks(tasks.map(t => t.id === id ? { ...t, done: newDoneState } : t));

    const { error } = await supabase.from('Task').update({ done: newDoneState }).eq('id', id);
    if (error) {
      // Fallback
      const updated = tasks.map(t => t.id === id ? { ...t, done: newDoneState } : t);
      localStorage.setItem('rt_tasks', JSON.stringify(updated));
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    const { error } = await supabase.from('Task').delete().eq('id', id);
    if (error) {
      const updated = tasks.filter(t => t.id !== id);
      setTasks(updated);
      localStorage.setItem('rt_tasks', JSON.stringify(updated));
    } else {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  return (
    <div>
      <h2>O que fazer hoje?</h2>

      {role === 'admin' && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Cadastrar Nova Tarefa (Visão Diretoria)</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Descrição da Tarefa..." 
              className="textarea-huge" 
              style={{ flex: 2, minHeight: '40px', padding: '8px', fontSize: '1rem' }}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <input 
              type="time" 
              className="textarea-huge" 
              style={{ flex: 1, minHeight: '40px', padding: '8px', fontSize: '1rem' }}
              value={newTaskTime}
              onChange={(e) => setNewTaskTime(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addTask}>Cadastrar</button>
          </div>
        </div>
      )}
      
      <div className="task-list">
        {tasks.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma tarefa cadastrada para hoje.</p>}
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`task-item ${task.done ? 'completed' : ''}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }} onClick={() => toggleTask(task.id)}>
              <div className="task-icon">
                {task.done ? <CheckCircle2 size={40} color="var(--secondary)" /> : <Circle size={40} color="var(--primary)" />}
              </div>
              <div className="task-content">
                <div className="task-title" style={{ fontSize: '1.2rem', fontWeight: task.done ? 'normal' : 'bold' }}>{task.title}</div>
                <div className="task-time" style={{ color: 'var(--text-muted)' }}>Às {task.time}</div>
              </div>
            </div>
            
            {role === 'admin' && (
              <button 
                className="btn" 
                style={{ padding: '8px', color: 'var(--danger)', background: 'transparent', marginLeft: '12px' }}
                onClick={() => deleteTask(task.id)}
              >
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
