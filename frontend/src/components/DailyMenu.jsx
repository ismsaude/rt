import React, { useState } from 'react';
import { Utensils, CheckCircle2 } from 'lucide-react';

export default function DailyMenu() {
  const [meals, setMeals] = useState([]);

  const markAsServed = (id) => {
    setMeals(meals.map(m => m.id === id ? { ...m, served: true } : m));
  };

  return (
    <div>
      <h2>O que servir hoje?</h2>
      
      {meals.map(meal => (
        <div key={meal.id} className="card" style={{ borderLeft: meal.served ? '6px solid var(--secondary)' : '6px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)' }}>{meal.type}</h3>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: '600' }}>{meal.time}</span>
          </div>
          
          <p style={{ fontSize: '1.2rem', marginBottom: '20px', lineHeight: '1.5' }}>
            {meal.menu}
          </p>
          
          {meal.served ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <CheckCircle2 size={28} />
              Refeição já servida
            </div>
          ) : (
            <button className="btn-massive btn-primary" onClick={() => markAsServed(meal.id)}>
              <Utensils size={28} />
              Refeição Servida
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
