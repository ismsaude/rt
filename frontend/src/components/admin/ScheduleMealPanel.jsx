import { useMemo } from 'react';
import { Copy, Utensils } from 'lucide-react';
import { nomeCurto, resumoRefeicao, textoRefeicao } from '../../lib/schedule';
import { formatDate, formatWeekday, MESES, parseMonthKey } from '../../lib/format';
import { Button, Card, CardBody, CardHeader, useToast } from '../ui';

const MOTIVO = {
  noturno: 'noturno',
  plantao: 'plantão',
  'fim de semana': 'fim de semana',
  feriado: 'feriado',
};

const horas = (h) => `${String(h).replace('.', ',')}h`;

/**
 * Quadro "Refeição remunerada" ao lado da escala.
 *
 * Quem trabalha sem poder sair para comer recebe uma hora extra: todo
 * plantão noturno e o diurno de sábado, domingo e feriado (a regra de cada
 * posto é configurada em Postos e equipe). O quadro soma o mês por pessoa e
 * mostra de onde vem cada hora.
 */
export default function ScheduleMealPanel({ monthKey, entradas, feriados, postos, todosNomes }) {
  const toast = useToast();
  const resumo = useMemo(
    () => resumoRefeicao(entradas, new Set(feriados.keys()), postos),
    [entradas, feriados, postos]
  );
  const total = resumo.reduce((s, p) => s + p.horas, 0);
  const nomeDoMes = MESES[parseMonthKey(monthKey).month];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoRefeicao(nomeDoMes, resumo, todosNomes));
      toast.success('Resumo copiado.');
    } catch {
      toast.error('Não foi possível copiar neste navegador.');
    }
  };

  const detalhe = (p) => [
    p.noturnos && `${p.noturnos} ${p.noturnos === 1 ? 'noturno' : 'noturnos'}`,
    p.plantoes && `${p.plantoes} ${p.plantoes === 1 ? 'plantão' : 'plantões'}`,
    p.fins && `${p.fins} ${p.fins === 1 ? 'fim de semana' : 'fins de semana'}`,
    p.feriados && `${p.feriados} ${p.feriados === 1 ? 'feriado' : 'feriados'}`,
  ].filter(Boolean).join(' · ');

  return (
    <Card className="meal">
      <CardHeader
        title="Refeição remunerada"
        subtitle={`${nomeDoMes}: 1h extra por plantão sem saída para comer`}
        icon={Utensils}
        actions={
          resumo.length > 0 && (
            <Button variant="secondary" size="sm" icon={Copy} onClick={copiar}>Copiar</Button>
          )
        }
      />
      <CardBody>
        {resumo.length === 0 ? (
          <p className="u-subtle" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
            Ninguém com direito neste mês. A regra é definida em cada posto (Postos e equipe → Editar).
          </p>
        ) : (
          <>
            <ul className="meal__list">
              {resumo.map((p) => (
                <li key={p.nome} className="meal__item">
                  <details>
                    <summary>
                      <span className="meal__name">{nomeCurto(p.nome, todosNomes)}</span>
                      <span className="meal__hours">{horas(p.horas)}</span>
                      <span className="meal__detail">{detalhe(p)}</span>
                    </summary>
                    <ul className="meal__dates">
                      {p.itens.map((i) => (
                        <li key={`${i.data}-${i.posto}`}>
                          <span>{formatDate(i.data).slice(0, 5)} {formatWeekday(i.data, true).toLowerCase()}</span>
                          <span className="u-subtle">{MOTIVO[i.motivo] || i.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
            <div className="meal__total">
              <span>Total do mês</span>
              <strong>{horas(total)}</strong>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
