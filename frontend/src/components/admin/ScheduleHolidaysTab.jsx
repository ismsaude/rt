import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Download, Plus, Trash2 } from 'lucide-react';
import {
  apagarFeriado, carregarFeriados, feriadosNacionais, salvarFeriados,
} from '../../lib/schedule';
import { formatDate, formatWeekday } from '../../lib/format';
import {
  Alert, Button, Card, CardBody, EmptyState, SkeletonList, Table, TextField, useToast,
} from '../ui';

/**
 * Feriados do ano. Nos feriados só trabalham os plantões 12x36 — os
 * demais postos aparecem como "Feriado" na escala. Os nacionais entram
 * com um clique; municipais e pontos facultativos a casa cadastra aqui.
 */
export default function ScheduleHolidaysTab({ ano, setAno }) {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { error, feriados } = await carregarFeriados(ano);
    if (error) toast.error('Não foi possível carregar os feriados. A migração 015 foi aplicada?');
    setLista(feriados);
    setCarregando(false);
  }, [ano, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const importar = async () => {
    const { error } = await salvarFeriados(feriadosNacionais(ano));
    if (error) { toast.error(`Não foi possível importar: ${error.message}`); return; }
    toast.success('Feriados nacionais cadastrados.');
    carregar();
  };

  const adicionar = async (e) => {
    e?.preventDefault();
    if (!data || !nome.trim()) return;
    const { error } = await salvarFeriados([{ holiday_date: data, name: nome.trim() }]);
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    setData(''); setNome('');
    carregar();
  };

  const remover = async (f) => {
    const { error } = await apagarFeriado(f.id);
    if (error) { toast.error(`Não foi possível apagar: ${error.message}`); return; }
    carregar();
  };

  return (
    <div className="u-stack u-gap-5">
      <Card>
        <CardBody>
          <div className="u-row u-gap-3" style={{ flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setAno(ano - 1)}>‹ {ano - 1}</Button>
            <strong style={{ fontSize: 'var(--text-xl)', minWidth: '4rem', textAlign: 'center' }}>{ano}</strong>
            <Button variant="secondary" onClick={() => setAno(ano + 1)}>{ano + 1} ›</Button>
            <div className="u-grow" />
            <Button variant="primary" icon={Download} onClick={importar}>
              Cadastrar feriados nacionais de {ano}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Alert tone="info">
        Mudanças nos feriados valem para escalas geradas depois. Para aplicar a um mês já gerado, use{' '}
        <strong>Atualizar pelas regras</strong> na escala do mês. Carnaval e Corpus Christi são pontos
        facultativos: cadastre aqui se a casa os tratar como feriado, junto com os feriados do município.
      </Alert>

      {carregando ? (
        <SkeletonList rows={4} />
      ) : lista.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarPlus} title={`Nenhum feriado cadastrado em ${ano}`}
            description="Use o botão acima para trazer os nacionais e acrescente os municipais abaixo." />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr><th>Data</th><th>Dia</th><th>Feriado</th><th aria-label="Ações" /></tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td className="table__cell-num">{formatDate(f.holiday_date)}</td>
                <td className="table__cell-muted">{formatWeekday(f.holiday_date)}</td>
                <td className="table__cell-strong">{f.name}</td>
                <td>
                  <div className="table__actions">
                    <Button variant="danger-ghost" size="sm" iconOnly icon={Trash2}
                      aria-label="Apagar" onClick={() => remover(f)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Card>
        <CardBody>
          <form className="funds-filters" onSubmit={adicionar} style={{ gridTemplateColumns: '10rem 1fr auto' }}>
            <TextField label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <TextField label="Nome" placeholder="Ex.: Aniversário de Porto Feliz"
              value={nome} onChange={(e) => setNome(e.target.value)} />
            <Button type="submit" variant="secondary" icon={Plus} disabled={!data || !nome.trim()}>
              Adicionar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
