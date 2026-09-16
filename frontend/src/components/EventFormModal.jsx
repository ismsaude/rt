import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uid } from '../lib/id';
import { EVENT_TYPES } from '../lib/clinical';
import {
  Button, Modal, SelectField, TextareaField, TextField, useToast,
} from './ui';

const EMPTY = {
  title: '', type: EVENT_TYPES[0], residentId: '',
  date: '', time: '', location: '', notes: '', outcome: '', done: false,
};

/**
 * Cadastro e edição de compromisso, compartilhado entre a Agenda e a
 * tela de Tarefas e Compromissos.
 *
 * @param {object|null} event  compromisso a editar; null cria um novo
 */
export default function EventFormModal({ open, onClose, onSaved, event, residents }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const editando = !!event?.id;

  useEffect(() => {
    if (!open) return;
    setForm(
      editando
        ? {
            title: event.title || '',
            type: event.type || EVENT_TYPES[0],
            residentId: event.resident_id || '',
            date: event.date || '',
            time: event.time || '',
            location: event.location || '',
            notes: event.notes || '',
            outcome: event.outcome || '',
            done: !!event.done,
          }
        : EMPTY
    );
  }, [open, event, editando]);

  const submit = async (e) => {
    e?.preventDefault();

    if (!form.title.trim() || !form.date || !form.time) {
      toast.warning('Informe título, data e hora.');
      return;
    }

    setSaving(true);
    const resident = residents.find((r) => r.id === form.residentId);

    const payload = {
      title: form.title.trim(),
      type: form.type,
      resident_id: form.residentId || null,
      resident_name: resident?.name || 'Geral (todos)',
      date: form.date,
      time: form.time,
      location: form.location.trim(),
      notes: form.notes.trim(),
      outcome: form.outcome.trim(),
      done: form.done,
    };

    const { error } = editando
      ? await supabase.from('Event').update(payload).eq('id', event.id)
      : await supabase.from('Event').insert([{ id: uid(), ...payload }]);

    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(editando ? 'Compromisso atualizado.' : 'Compromisso agendado.');
    onClose();
    onSaved?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar compromisso' : 'Novo compromisso'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {editando ? 'Salvar alterações' : 'Agendar'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="u-stack u-gap-4">
        <TextField
          label="Título" required autoFocus
          placeholder="Ex.: Consulta com Dr. João — psiquiatria"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <SelectField
          label="Tipo de compromisso" required
          hint="Define em qual seção da ficha mensal o compromisso aparece."
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        >
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </SelectField>

        <SelectField
          label="Morador"
          value={form.residentId}
          onChange={(e) => setForm((f) => ({ ...f, residentId: e.target.value }))}
        >
          <option value="">Geral (toda a casa)</option>
          {residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </SelectField>

        <div className="field-row">
          <TextField
            label="Data" type="date" required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <TextField
            label="Hora" type="time" required
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          />
        </div>

        <TextField
          label="Local"
          placeholder="Ex.: UBS Central — sala 3"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />

        <TextareaField
          label="Observações"
          hint="Aparece em destaque para a cuidadora no dia."
          placeholder="Ex.: comparecer em jejum, levar cartão SUS…"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />

        {editando && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.done}
                onChange={(e) => setForm((f) => ({ ...f, done: e.target.checked }))}
              />
              <span className="checkbox__box" aria-hidden="true">✓</span>
              <span style={{ fontSize: 'var(--text-md)' }}>Compromisso já realizado</span>
            </label>

            {form.done && (
              <TextareaField
                label="Desfecho"
                hint="Vai direto para INTERVENÇÕES REALIZADAS na ficha mensal do morador."
                placeholder="Ex.: avaliado pela Dra. Camilla; ajustada a dose de risperidona."
                rows={3}
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
              />
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
