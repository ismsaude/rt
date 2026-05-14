import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, User, AlertTriangle, Coffee } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ShiftHandover({ currentUser }) {
  const [residents, setResidents] = useState([]);
  const [reports, setReports] = useState({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePassword, setSignaturePassword] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [pastReports, setPastReports] = useState([]);

  const fetchPastReports = async () => {
    const { data } = await supabase.from('ShiftReport')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);
    if (data) setPastReports(data);
  };

  useEffect(() => {
    const fetchResidents = async () => {
      setLoading(true);
      const { data } = await supabase.from('Resident').select('*');
      if (data) {
        setResidents(data);
        const initialReports = {};
        data.forEach(r => {
          initialReports[r.id] = {
            hygiene: 'Realizada',
            food: 'Comeu bem',
            meds: 'Tomou normalmente',
            notes: ''
          };
        });
        setReports(initialReports);
      }
      setLoading(false);
    };
    fetchResidents();
    fetchPastReports();
  }, []);

  const handleReportChange = (id, field, value) => {
    setReports(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const confirmSignatureAndSend = async () => {
    setSignatureError('');
    if (!signaturePassword) {
      setSignatureError('A senha é obrigatória.');
      return;
    }

    setSaving(true);
    // Valida a senha (no mundo ideal usaríamos a API do Supabase Auth para re-autenticar, 
    // mas usando a tabela User como estamos fazendo no Login.jsx):
    const { data: userMatch } = await supabase.from('User')
      .select('*')
      .eq('email', currentUser?.email || 'dev@aurean.com')
      .eq('password', signaturePassword)
      .single();

    if (!userMatch) {
      setSignatureError('Senha incorreta. Tente novamente.');
      setSaving(false);
      return;
    }

    // Assinatura correta, prossegue com o envio
    setShowSignatureModal(false);
    setSignaturePassword('');

    const { error } = await supabase.from('ShiftReport').insert([{ 
      reports: reports, 
      general_notes: generalNotes, 
      date: new Date().toISOString(),
      caregiver_id: currentUser?.id || 'dev-id',
      caregiver_name: currentUser?.name || 'Desenvolvedor'
    }]);
    
    setSaving(false);
    if (!error) {
      setSent(true);
      fetchPastReports();
      setTimeout(() => {
        setSent(false);
        setGeneralNotes('');
        const resetReports = {};
        residents.forEach(r => {
          resetReports[r.id] = { hygiene: 'Realizada', food: 'Comeu bem', meds: 'Tomou normalmente', notes: '' };
        });
        setReports(resetReports);
      }, 3000);
    } else {
      alert("Erro ao salvar plantão no banco: " + error.message);
    }
  };

  const handleSendClick = () => {
    if (!generalNotes.trim()) {
      alert("O Relato Geral do Plantão é obrigatório. Por favor, descreva as ocorrências do plantão antes de finalizar.");
      return;
    }
    setShowSignatureModal(true);
  };

  if (sent) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <CheckCircle size={80} color="var(--secondary)" style={{ margin: '0 auto 20px' }} />
        <h2>Plantão Passado!</h2>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>O seu relatório diário foi salvo com sucesso. Bom descanso!</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Carregando moradores...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px' }}>Relatório do Plantão</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Preencha as informações de cada morador e relate eventos do plantão.</p>

      {residents.map(res => (
        <div key={res.id} className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.3rem', marginBottom: '16px' }}>
            <User size={20} color="var(--primary)"/> {res.name}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="input-label" style={{ fontSize: '0.9rem' }}>Higiene Pessoal</label>
              <select className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem' }} value={reports[res.id]?.hygiene} onChange={e => handleReportChange(res.id, 'hygiene', e.target.value)}>
                <option>Realizada</option>
                <option>Recusou o banho</option>
                <option>Parcial</option>
              </select>
            </div>

            <div>
              <label className="input-label" style={{ fontSize: '0.9rem' }}>Alimentação e Água</label>
              <select className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem' }} value={reports[res.id]?.food} onChange={e => handleReportChange(res.id, 'food', e.target.value)}>
                <option>Comeu bem e bebeu água</option>
                <option>Comeu pouco</option>
                <option>Recusou alimentação</option>
              </select>
            </div>

            <div>
              <label className="input-label" style={{ fontSize: '0.9rem' }}>Medicações</label>
              <select className="textarea-huge" style={{ minHeight: '40px', padding: '8px', fontSize: '1rem' }} value={reports[res.id]?.meds} onChange={e => handleReportChange(res.id, 'meds', e.target.value)}>
                <option>Tomou normalmente</option>
                <option>Recusou / Cuspiu</option>
                <option>Não havia medicação no horário</option>
              </select>
            </div>

            <div>
              <label className="input-label" style={{ fontSize: '0.9rem' }}>Observação Específica (Opcional)</label>
              <textarea 
                className="textarea-huge" 
                style={{ minHeight: '50px', padding: '8px', fontSize: '1rem' }}
                placeholder={`Algo a mais sobre ${res.name.split(' ')[0]}?`}
                value={reports[res.id]?.notes}
                onChange={e => handleReportChange(res.id, 'notes', e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--warning)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.3rem', marginBottom: '8px' }}>
          <AlertTriangle size={20} color="var(--warning)"/> Relato Geral do Plantão <span style={{color: 'var(--danger)', fontSize: '1rem'}}>*</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Aconteceu algo anormal na casa? Algum incidente, quebra, visita, ou observação importante da rotina de hoje? (Campo obrigatório)
        </p>
        <textarea 
          className="textarea-huge" 
          style={{ minHeight: '120px', padding: '12px', fontSize: '1rem' }}
          placeholder="Descreva aqui as ocorrências gerais do plantão..."
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
        />
      </div>

      <button className="btn-massive btn-primary" onClick={handleSendClick} disabled={saving} style={{ marginBottom: '40px' }}>
        <Send size={28} />
        {saving ? 'Validando...' : 'Finalizar Plantão'}
      </button>

      {/* Modal de Assinatura Eletrônica */}
      {showSignatureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '32px' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary-dark)' }}>Assinatura Eletrônica</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Para garantir a validade deste relatório, digite sua senha de acesso ao sistema.
            </p>
            
            <label className="input-label">Senha</label>
            <input 
              type="password" 
              className="textarea-huge" 
              style={{ minHeight: '50px', padding: '12px', fontSize: '1.2rem', marginBottom: '8px' }}
              value={signaturePassword}
              onChange={(e) => setSignaturePassword(e.target.value)}
              placeholder="Sua senha..."
            />
            {signatureError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '16px' }}>{signatureError}</p>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setShowSignatureModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmSignatureAndSend} disabled={saving}>
                {saving ? 'Assinando...' : 'Assinar e Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Plantões */}
      <div style={{ marginTop: '48px', marginBottom: '80px' }}>
        <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--primary-dark)' }}>
          Últimos Plantões (Acompanhamento)
        </h3>
        {pastReports.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Nenhum relatório anterior encontrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pastReports.map(report => (
              <div key={report.id} className="card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                    <User size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/> 
                    {report.caregiver_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(report.date).toLocaleString('pt-BR')}
                  </div>
                </div>
                
                {report.general_notes && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Relato Geral:</strong>
                    <p style={{ margin: '4px 0', fontSize: '0.95rem', color: 'var(--text)' }}>{report.general_notes}</p>
                  </div>
                )}

                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontSize: '0.9rem', color: 'var(--secondary)', fontWeight: 'bold' }}>
                    Ver detalhes por morador
                  </summary>
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {residents.map(res => {
                      const resReport = report.reports && report.reports[res.id];
                      if (!resReport) return null;
                      return (
                        <div key={res.id} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{res.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <p style={{ margin: '2px 0' }}>• Higiene: {resReport.hygiene}</p>
                            <p style={{ margin: '2px 0' }}>• Alimentação: {resReport.food}</p>
                            <p style={{ margin: '2px 0' }}>• Medicações: {resReport.meds}</p>
                            {resReport.notes && <p style={{ margin: '2px 0', color: 'var(--warning)', fontWeight: 'bold' }}>• Obs: {resReport.notes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
