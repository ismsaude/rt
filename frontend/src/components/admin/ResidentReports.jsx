import React, { useState, useEffect } from 'react';
import { FileText, Printer, ChevronDown, Calendar, Edit3, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Helper de formatação de data
const formatDateBR = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('pt-BR');
};

const formatTimeBR = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function ResidentReports({ currentUser }) {
  const [selectedResident, setSelectedResident] = useState('');
  const [residents, setResidents] = useState([]);
  const [activeTab, setActiveTab] = useState('diario');
  const [reportData, setReportData] = useState({
    enfermagem: '',
    cuidadoras: '',
    incidentes: ''
  });
  const [isEditing, setIsEditing] = useState(true);

  // Daily Report State
  const [shiftReports, setShiftReports] = useState([]);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  const fetchResidentsAndReports = async () => {
    const { data: resData } = await supabase.from('Resident').select('*');
    if (resData) {
      setResidents(resData);
      if (resData.length > 0) setSelectedResident(resData[0].name);
    }

    const { data: shiftData } = await supabase.from('ShiftReport').select('*').order('date', { ascending: false });
    if (shiftData) {
      setShiftReports(shiftData);
      
      const today = new Date().toISOString().split('T')[0];
      setSelectedDateFilter(today);
    }
  };

  useEffect(() => {
    fetchResidentsAndReports();
  }, []);

  const handleDeleteReport = async (id) => {
    if (window.confirm('Tem certeza que deseja apagar permanentemente este relatório de plantão?')) {
      await supabase.from('ShiftReport').delete().eq('id', id);
      fetchResidentsAndReports();
    }
  };

  // Filtrar todos os relatórios do dia selecionado
  const reportsOfDay = shiftReports.filter(r => r.date.startsWith(selectedDateFilter));

  return (
    <div>
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ marginBottom: '4px' }}>Evolução e Relatórios</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Acompanhe e emita os relatórios.</p>
        </div>
        {activeTab === 'mensal' && !isEditing && (
          <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }} onClick={() => window.print()}>
            <Printer size={20} />
            Imprimir Relatório
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Filtros */}
        <div className="card print-hide" style={{ width: '100%', maxWidth: '300px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Filtros</h3>
          {activeTab === 'mensal' && (
            <>
              <label className="input-label" style={{ fontSize: '0.95rem' }}>Morador (Mensal)</label>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <select 
                  className="textarea-huge" 
                  style={{ minHeight: '40px', padding: '8px', fontSize: '0.95rem', appearance: 'none', cursor: 'pointer' }}
                  value={selectedResident}
                  onChange={(e) => setSelectedResident(e.target.value)}
                >
                  {residents.map(r => (
                    <option key={r.id}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '10px', color: 'var(--text-muted)' }}/>
              </div>
            </>
          )}

          <label className="input-label" style={{ fontSize: '0.95rem' }}>{activeTab === 'diario' ? 'Data do Plantão' : 'Período Base'}</label>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {activeTab === 'diario' ? (
              <input 
                type="date"
                className="textarea-huge" 
                style={{ height: '40px', padding: '0 12px', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box', textAlign: 'center', display: 'block', lineHeight: '38px' }}
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
              />
            ) : (
              <>
                <select 
                  className="textarea-huge" 
                  style={{ height: '40px', padding: '0 12px', fontSize: '0.95rem', appearance: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
                >
                  <option>Maio / 2026</option>
                  <option>Abril / 2026</option>
                </select>
                <ChevronDown size={20} style={{ position: 'absolute', right: '12px', top: '10px', color: 'var(--text-muted)' }}/>
              </>
            )}
          </div>
        </div>

        {/* Visualização do Relatório */}
        <div className="print-full-width" style={{ flex: 1 }}>
          {/* Tabs */}
          <div className="print-hide" style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button 
              className={`btn ${activeTab === 'diario' ? 'btn-primary' : ''}`} 
              style={{ background: activeTab !== 'diario' ? 'white' : '', border: '1px solid var(--border)', flex: '1 1 150px' }} 
              onClick={() => setActiveTab('diario')}
            >
              <Calendar size={18}/> Visão Diária Geral
            </button>
            <button 
              className={`btn ${activeTab === 'mensal' ? 'btn-primary' : ''}`} 
              style={{ background: activeTab !== 'mensal' ? 'white' : '', border: '1px solid var(--border)', flex: '1 1 150px' }} 
              onClick={() => setActiveTab('mensal')}
            >
              <FileText size={18}/> Relatório Mensal Individual
            </button>
          </div>

          {activeTab === 'diario' && (
            <div>
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                 <button className="btn btn-primary" onClick={() => window.print()} style={{ padding: '8px 16px' }}>
                    <Printer size={18} style={{ marginRight: '8px' }} />
                    Imprimir Dia
                 </button>
              </div>

              {/* Cabeçalho de Impressão */}
              <div className="print-only" style={{ display: 'none', textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                  <h1 style={{ color: 'var(--primary-dark)', marginBottom: '8px', fontSize: '1.6rem' }}>Residência Terapêutica de Porto Feliz</h1>
                  <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Relatório diário de passagem de plantão</h2>
              </div>

              {reportsOfDay.length === 0 ? (
                <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum registro de plantão encontrado para exibição nesta data.
                </div>
              ) : (
                reportsOfDay.map((report) => (
                  <div key={report.id} className="card" style={{ padding: '32px', marginBottom: '24px', position: 'relative' }}>
                    <button 
                      className="btn print-hide" 
                      style={{ position: 'absolute', top: '24px', right: '24px', padding: '8px', color: 'var(--danger)', background: 'transparent' }}
                      title="Apagar este relatório"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      <Trash2 size={20} />
                    </button>

                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Registro de Plantão</h3>
                      <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold' }}>
                        {formatDateBR(report.date)} às {formatTimeBR(report.date)}
                      </span>
                    </div>
                    
                    <div className="print-avoid-break" style={{ marginBottom: '24px' }}>
                      <h4 style={{ color: 'var(--warning)', marginBottom: '8px', fontSize: '1.2rem' }}>Relato Geral do Plantão</h4>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', padding: '16px', borderRadius: '0 8px 8px 0', color: 'var(--text-main)', lineHeight: '1.6' }}>
                        <strong>Relato registrado:</strong> {report.general_notes || 'Sem relato geral para este plantão.'}
                      </div>
                    </div>

                    <details style={{ marginBottom: '32px', cursor: 'pointer' }} className="print-avoid-break">
                      <summary style={{ fontSize: '1.1rem', color: 'var(--primary)', fontWeight: 'bold', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        Ver ocorrências detalhadas por morador
                      </summary>
                      <div style={{ marginTop: '16px' }}>
                        {residents.map((res, idx) => {
                          const resData = report.reports?.[res.id];
                          if (!resData) return null;

                          return (
                            <div key={idx} style={{ background: 'var(--background)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                              <h5 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>{res.name}</h5>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                <div><strong>Higiene:</strong> {resData.hygiene}</div>
                                <div><strong>Alimentação:</strong> {resData.food}</div>
                                <div><strong>Medicação:</strong> {resData.meds}</div>
                              </div>
                              {resData.notes && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '0.9rem' }}>
                                  <strong>Obs:</strong> {resData.notes}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </details>

                    <div className="print-avoid-break" style={{ padding: '16px', background: 'var(--background)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                        <span style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>✅</span>
                        <strong>Assinado eletrônicamente e validado por senha do usuário:</strong> {report.caregiver_name || 'Usuário Não Identificado'}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px', marginLeft: '32px' }}>
                        Data do registro: {new Date(report.date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Rodapé de Impressão */}
              {reportsOfDay.length > 0 && (
                <div className="print-only" style={{ display: 'none', marginTop: '40px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Gerado por: {currentUser?.name || 'Administrador'} - Data da impressão: {new Date().toLocaleString('pt-BR')}
                </div>
              )}
            </div>
          )}

          {activeTab === 'mensal' && (
            <div className="card" style={{ padding: '40px', background: 'white', border: '1px solid var(--border)' }}>
              {/* O conteúdo do relatório mensal permanece inalterado */}
              <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '24px', marginBottom: '24px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <h1 style={{ color: 'var(--primary-dark)', marginBottom: '8px' }}>Relatório Mensal de Evolução</h1>
                  <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Aurean Residência Terapêutica - Porto Feliz/SP</p>
                </div>
                {isEditing ? (
                  <button className="btn btn-primary" onClick={() => setIsEditing(false)}>
                    <Save size={20} /> Salvar e Finalizar
                  </button>
                ) : (
                  <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => setIsEditing(true)}>
                    <Edit3 size={20} /> Editar
                  </button>
                )}
              </div>
              
              <div className="print-only" style={{ display: 'none', textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: '24px', marginBottom: '24px' }}>
                  <h1 style={{ color: 'var(--primary-dark)', marginBottom: '8px' }}>Relatório Mensal de Evolução</h1>
                  <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Aurean Residência Terapêutica - Porto Feliz/SP</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                <div>
                  <p><strong>Paciente:</strong> {selectedResident || 'Não selecionado'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>Mês Referência:</strong> Maio/2026</p>
                </div>
              </div>

              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--primary)' }}>Resumo da Enfermagem (Sinais Vitais)</h3>
              {isEditing ? (
                <textarea 
                  className="textarea-huge" 
                  style={{ minHeight: '120px', marginBottom: '24px' }}
                  placeholder="Escreva o resumo da saúde do paciente durante o mês..."
                  value={reportData.enfermagem}
                  onChange={(e) => setReportData({...reportData, enfermagem: e.target.value})}
                />
              ) : (
                <p style={{ lineHeight: '1.6', marginBottom: '24px', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                  {reportData.enfermagem || 'Nenhuma anotação de enfermagem.'}
                </p>
              )}

              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--primary)' }}>Observações das Cuidadoras</h3>
              {isEditing ? (
                <textarea 
                  className="textarea-huge" 
                  style={{ minHeight: '120px', marginBottom: '24px' }}
                  placeholder="Resuma o comportamento, sono e alimentação baseados nos plantões..."
                  value={reportData.cuidadoras}
                  onChange={(e) => setReportData({...reportData, cuidadoras: e.target.value})}
                />
              ) : (
                <p style={{ lineHeight: '1.6', marginBottom: '24px', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                  {reportData.cuidadoras || 'Nenhuma observação inserida.'}
                </p>
              )}

              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px', color: 'var(--danger)' }}>Incidentes & Medicações</h3>
              {isEditing ? (
                <textarea 
                  className="textarea-huge" 
                  style={{ minHeight: '120px', marginBottom: '24px' }}
                  placeholder="Anote se houve recusas de medicação, quedas ou incidentes..."
                  value={reportData.incidentes}
                  onChange={(e) => setReportData({...reportData, incidentes: e.target.value})}
                />
              ) : (
                <p style={{ lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                  {reportData.incidentes || 'Nenhum incidente relatado.'}
                </p>
              )}

              {!isEditing && (
                <div style={{ marginTop: '80px', textAlign: 'center' }}>
                  <div style={{ width: '300px', borderBottom: '1px solid var(--text-main)', margin: '0 auto 8px' }}></div>
                  <p style={{ color: 'var(--text-muted)' }}>Assinatura do Supervisor(a)</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
