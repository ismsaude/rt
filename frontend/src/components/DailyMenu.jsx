import React, { useState, useEffect } from 'react';
import { Utensils, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DailyMenu({ role }) {
  const [meals, setMeals] = useState([]);
  const [newMealType, setNewMealType] = useState('Café da Manhã');
  const [newMealTime, setNewMealTime] = useState('08:00');
  const [newMealMenu, setNewMealMenu] = useState('');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    const { data, error } = await supabase.from('Menu').select('*').order('time', { ascending: true });
    if (data && data.length > 0) {
      setMeals(data);
    } else {
      const localMeals = JSON.parse(localStorage.getItem('rt_meals') || '[]');
      setMeals(localMeals);
    }
  };

  const addMeal = async () => {
    if (!newMealMenu) return;
    
    const newMeal = { type: newMealType, time: newMealTime, menu: newMealMenu, served: false, date: new Date().toISOString() };
    
    const { data, error } = await supabase.from('Menu').insert([newMeal]).select();
    
    if (error) {
      const updated = [...meals, { ...newMeal, id: Date.now() }];
      setMeals(updated);
      localStorage.setItem('rt_meals', JSON.stringify(updated));
    } else if (data) {
      setMeals([...meals, data[0]]);
    }
    
    setNewMealMenu('');
  };

  const deleteMeal = async (id) => {
    if (!window.confirm('Excluir esta refeição?')) return;
    const { error } = await supabase.from('Menu').delete().eq('id', id);
    if (error) {
      const updated = meals.filter(m => m.id !== id);
      setMeals(updated);
      localStorage.setItem('rt_meals', JSON.stringify(updated));
    } else {
      setMeals(meals.filter(m => m.id !== id));
    }
  };

  const markAsServed = async (id) => {
    const meal = meals.find(m => m.id === id);
    if (!meal) return;
    
    const newServedState = !meal.served;
    setMeals(meals.map(m => m.id === id ? { ...m, served: newServedState } : m));

    const { error } = await supabase.from('Menu').update({ served: newServedState }).eq('id', id);
    if (error) {
      const updated = meals.map(m => m.id === id ? { ...m, served: newServedState } : m);
      localStorage.setItem('rt_meals', JSON.stringify(updated));
    }
  };

  return (
    <div>
      <h2>O que servir hoje?</h2>

      {role === 'admin' && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Cadastrar Refeição (Visão Diretoria)</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <select 
              className="textarea-huge" 
              style={{ flex: 1, minHeight: '40px', padding: '8px', fontSize: '1rem' }}
              value={newMealType}
              onChange={(e) => setNewMealType(e.target.value)}
            >
              <option>Café da Manhã</option>
              <option>Lanche da Manhã</option>
              <option>Almoço</option>
              <option>Lanche da Tarde</option>
              <option>Jantar</option>
              <option>Ceia</option>
            </select>
            <input 
              type="time" 
              className="textarea-huge" 
              style={{ flex: 1, minHeight: '40px', padding: '8px', fontSize: '1rem' }}
              value={newMealTime}
              onChange={(e) => setNewMealTime(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="O que será servido? (Ex: Arroz, feijão, frango, salada)" 
              className="textarea-huge" 
              style={{ flex: 3, minHeight: '40px', padding: '8px', fontSize: '1rem' }}
              value={newMealMenu}
              onChange={(e) => setNewMealMenu(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addMeal}>Adicionar</button>
          </div>
        </div>
      )}
      
      {meals.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma refeição cadastrada para hoje.</p>}
      {meals.map(meal => (
        <div key={meal.id} className="card" style={{ borderLeft: meal.served ? '6px solid var(--secondary)' : '6px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>{meal.type}</h3>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: '600' }}>{meal.time}</span>
          </div>
          
          <p style={{ fontSize: '1.2rem', marginBottom: '20px', lineHeight: '1.5' }}>
            {meal.menu}
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {meal.served ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                <CheckCircle2 size={28} />
                Refeição já servida
              </div>
            ) : (
              <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '1.1rem' }} onClick={() => markAsServed(meal.id)}>
                <Utensils size={24} style={{ marginRight: '8px' }} />
                Marcar como Servida
              </button>
            )}

            {role === 'admin' && (
              <button 
                className="btn" 
                style={{ padding: '8px 16px', color: 'var(--danger)', background: 'transparent', marginLeft: '12px', border: '1px solid var(--border)' }}
                onClick={() => deleteMeal(meal.id)}
              >
                Excluir
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
