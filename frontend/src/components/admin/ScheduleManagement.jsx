import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, CalendarOff, Users } from 'lucide-react';
import { carregarEquipe, carregarPostos } from '../../lib/schedule';
import { toMonthKey } from '../../lib/format';
import { PageHeader, Tabs, useToast } from '../ui';
import ScheduleHolidaysTab from './ScheduleHolidaysTab';
import ScheduleMonthTab from './ScheduleMonthTab';
import ScheduleShiftsTab from './ScheduleShiftsTab';

/**
 * Gestão de escalas.
 *
 * Três abas:
 *   • Escala do mês — a escala gerada, ajustável dia a dia, com PDF;
 *   • Postos e equipe — as regras: quem cobre cada posto e como;
 *   • Feriados — nos feriados só os plantões 12x36 trabalham.
 *
 * Os meses já gerados são gravados: continuam como estavam, mesmo que as
 * regras mudem depois.
 */
export default function ScheduleManagement({ currentUser }) {
  const toast = useToast();
  const [aba, setAba] = useState('mes');
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [ano, setAno] = useState(new Date().getFullYear());
  const [postos, setPostos] = useState([]);
  const [equipe, setEquipe] = useState([]);

  const carregar = useCallback(async () => {
    const [p, e] = await Promise.all([carregarPostos(), carregarEquipe()]);
    if (p.error) toast.error('Não foi possível carregar os postos. A migração 015 foi aplicada?');
    if (e.error) toast.error('Não foi possível carregar a equipe.');
    setPostos(p.postos);
    setEquipe(e.equipe);
  }, [toast]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="u-stack u-gap-5">
      <PageHeader
        title="Gestão de escalas"
        description="Escala mensal da equipe: 12x36, horário comercial e feriados, com histórico e PDF."
      />

      <Tabs
        ariaLabel="Seções da escala"
        value={aba}
        onChange={setAba}
        options={[
          { value: 'mes', label: 'Escala do mês', icon: CalendarDays },
          { value: 'postos', label: 'Postos e equipe', icon: Users, count: postos.filter((p) => p.active).length },
          { value: 'feriados', label: 'Feriados', icon: CalendarOff },
        ]}
      />

      {aba === 'mes' && (
        <ScheduleMonthTab
          postos={postos} equipe={equipe} currentUser={currentUser}
          monthKey={monthKey} setMonthKey={setMonthKey}
          irParaPostos={() => setAba('postos')}
        />
      )}
      {aba === 'postos' && (
        <ScheduleShiftsTab postos={postos} equipe={equipe} onChanged={carregar} />
      )}
      {aba === 'feriados' && <ScheduleHolidaysTab ano={ano} setAno={setAno} />}
    </div>
  );
}
