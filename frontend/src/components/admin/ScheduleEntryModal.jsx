import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  DIA_SEMANA_NOME, horarioDoDia, lancamentoPrevisto,
} from '../../lib/schedule';
import { toDate, formatDate } from '../../lib/format';
import { Button, Modal, Segmented, SelectField, TextField } from '../ui';

const OUTRA = '__outra';

/**
 * Ajuste de um dia da escala: trocar a pessoa, marcar folga, mudar o
 * horário ou deixar uma observação ("cobrindo a Regina").
 *
 * O que se grava aqui fica marcado como ajuste manual: ao atualizar o mês
 * pelas regras, estes dias não são refeitos. "Restaurar o previsto" devolve
 * o dia ao que as regras determinam.
 */
export default function ScheduleEntryModal({
  alvo, equipe, posto, feriados, onClose, onSave, onRemove, onRestore,
}) {
  const { linha, data, entrada } = alvo || {};
  const [kind, setKind] = useState('plantao');
  const [pessoa, setPessoa] = useState('');
  const [outraNome, setOutraNome] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!alvo) return;
    const d = toDate(data).getDay();
    const padrao = posto ? horarioDoDia(posto, d) : { start: '07:00', end: '19:00' };

    setKind(entrada?.kind === 'folga' ? 'folga' : 'plantao');
    if (entrada?.user_id && equipe.some((u) => u.id === entrada.user_id)) {
      setPessoa(entrada.user_id);
      setOutraNome('');
    } else if (entrada?.person_name) {
      setPessoa(OUTRA);
      setOutraNome(entrada.person_name);
    } else {
      setPessoa('');
      setOutraNome('');
    }
    setInicio(entrada?.start_time || padrao.start);
    setFim(entrada?.end_time || padrao.end);
    setNota(entrada?.note || '');
  }, [alvo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alvo) return null;

  const d = toDate(data);
  const titulo = `${linha.name} — ${DIA_SEMANA_NOME[d.getDay()]}, ${formatDate(data)}`;
  const feriado = feriados.get(data);
  const previsto = posto ? lancamentoPrevisto(posto, data, new Set(feriados.keys())) : undefined;

  const salvar = () => {
    const usuario = equipe.find((u) => u.id === pessoa);
    onSave({
      id: entrada?.id,
      entry_date: data,
      shift_id: linha.shift_id,
      shift_name: linha.name,
      shift_hours: linha.hours,
      shift_category: linha.category,
      shift_position: linha.position,
      kind,
      user_id: usuario?.id || null,
      person_name: kind === 'folga' ? null : (usuario?.name || outraNome.trim() || null),
      start_time: inicio,
      end_time: fim,
      note: nota,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={titulo}
      description={feriado ? `Feriado: ${feriado}` : undefined}
      size="md"
      footer={
        <>
          {entrada && (
            <Button variant="danger-ghost" onClick={() => onRemove(entrada)} style={{ marginRight: 'auto' }}>
              Tirar do dia
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div className="u-stack u-gap-4">
        <Segmented
          ariaLabel="Situação do dia"
          block
          value={kind}
          onChange={setKind}
          options={[
            { value: 'plantao', label: 'Plantão' },
            { value: 'folga', label: 'Folga' },
          ]}
        />

        {kind === 'plantao' && (
          <>
            <SelectField label="Quem trabalha" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
              <option value="">Ninguém escalado</option>
              {equipe.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value={OUTRA}>Outra pessoa (digitar o nome)…</option>
            </SelectField>

            {pessoa === OUTRA && (
              <TextField
                label="Nome" value={outraNome}
                onChange={(e) => setOutraNome(e.target.value)}
                placeholder="Ex.: Folguista"
              />
            )}

            <div className="field-row">
              <TextField label="Entrada" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              <TextField label="Saída" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </>
        )}

        <TextField
          label="Observação"
          hint="Aparece pequena na célula. Ex.: cobrindo a Regina"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />

        {entrada?.manual && previsto !== undefined && (
          <div>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onRestore(linha, data, entrada)}>
              Restaurar o previsto pelas regras
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
