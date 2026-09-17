import { useEffect, useRef } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { calcAge, formatDate, MESES } from '../../lib/format';
import { AUTONOMY_LEVELS, formatCouncil } from '../../lib/clinical';
import { Alert, Button, MonthPicker, Signature } from '../ui';
import SheetPhotos from './SheetPhotos';

/**
 * O documento em si — réplica da Ficha de Acompanhamento Mensal.
 *
 * Tem duas formas, e só uma fonte de verdade: com `edit`, é a ficha que
 * a supervisão preenche; sem `edit`, é o documento fechado, em texto
 * corrido, que o fechamento do mês manda para o PDF. As duas precisam
 * sair iguais no papel — por isso moram no mesmo arquivo.
 *
 * `edit` reúne o que só existe na edição:
 *   { travada, set, months, onMonthChange, onPhotos, drafts: {…} }
 */

/** Textarea que cresce com o conteúdo — evita barra de rolagem no PDF. */
function AutoTextarea({ value, onChange, placeholder, minRows = 2, readOnly = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="sheet-edit"
      rows={minRows}
      value={value}
      placeholder={readOnly ? '' : placeholder}
      onChange={onChange}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
    />
  );
}

export default function SheetDocument({
  resident, monthKey, form, assinatura, currentUser, edit = null,
}) {
  if (!resident) return null;

  // Sem `edit` o documento está fechado: nada de campo, só texto.
  const leitura = !edit;
  const travada = !!edit?.travada;

  const [year, month] = String(monthKey).split('-').map(Number);
  const periodo = `${MESES[month - 1]} de ${year}`;
  const idade = calcAge(resident.dateOfBirth);

  const divergeDoCadastro =
    !leitura && (
      (form.autonomia_higiene || '') !== (resident.autonomy_hygiene || '') ||
      (form.autonomia_alimentacao || '') !== (resident.autonomy_food || '') ||
      (form.autonomia_atividades || '') !== (resident.autonomy_activities || '')
    );

  /** Título da seção, com o botão de rascunho quando há edição. */
  const titulo = (texto, { icon, label, onClick }) => (
    <h2 className="sheet__section-title">
      {texto}
      {!leitura && (
        <Button
          variant="ghost" size="sm" icon={icon}
          className={`print-hide ${travada ? 'u-sr-only' : ''}`}
          style={{ marginLeft: 'var(--space-2)', verticalAlign: 'middle' }}
          onClick={onClick}
        >
          {label}
        </Button>
      )}
    </h2>
  );

  /** Corpo da seção: campo editável ou texto do documento fechado. */
  const campo = (field, placeholder, minRows = 2) =>
    leitura ? (
      <p className="sheet__text">{form[field] || ''}</p>
    ) : (
      <AutoTextarea
        value={form[field]}
        onChange={edit.set(field)}
        readOnly={travada}
        placeholder={placeholder}
        minRows={minRows}
      />
    );

  return (
    <article className="sheet">
      <img src="/logo.png" alt="" className="sheet__watermark" aria-hidden="true" />

      <div className="sheet__logo-row">
        <img src="/logo.png" alt="Aurean Residência Terapêutica" className="sheet__logo" />
      </div>

      <h1 className="sheet__title">FICHA DE ACOMPANHAMENTO MENSAL</h1>

      <div className="sheet__meta">
        <div className="sheet__meta-row">
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">NOME:</span>
            <span className="sheet__meta-value">{resident.name}</span>
          </div>
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">DATA:</span>
            {leitura ? (
              <span className="sheet__meta-value">{formatDate(form.emitido_em)}</span>
            ) : (
              <>
                <span className="sheet__meta-value print-hide">
                  <input
                    type="date"
                    className="sheet-select"
                    style={{ minWidth: '9.5rem' }}
                    value={form.emitido_em}
                    onChange={edit.set('emitido_em')}
                    disabled={travada}
                    aria-label="Data de emissão da ficha"
                  />
                </span>
                <span className="sheet__meta-value print-only">
                  {formatDate(form.emitido_em)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="sheet__meta-row sheet__meta-row--triple">
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">DATA DE NASCIMENTO:</span>
            <span className="sheet__meta-value">{formatDate(resident.dateOfBirth)}</span>
          </div>
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">IDADE:</span>
            <span className="sheet__meta-value">{idade ?? '—'}</span>
          </div>
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">SEXO:</span>
            <span className="sheet__meta-value">
              {resident.sex || <span className="sheet__text--placeholder">não cadastrado</span>}
            </span>
          </div>
        </div>

        <div className="sheet__meta-row">
          <div className="sheet__meta-item">
            <span className="sheet__meta-label">PERÍODO DE REFERÊNCIA:</span>

            {/* Trocar o período aqui troca também o mês consolidado:
                a ficha não pode declarar um mês e exibir os números
                de outro. */}
            {leitura ? (
              <span className="sheet__meta-value">{periodo}</span>
            ) : (
              <>
                <span className="sheet__meta-value print-hide">
                  <MonthPicker
                    value={monthKey}
                    onChange={(m) => edit.onMonthChange?.(m)}
                    withData={edit.months}
                    selectClassName="sheet-select"
                    ariaLabelMonth="Mês de referência da ficha"
                    ariaLabelYear="Ano de referência da ficha"
                  />
                </span>
                <span className="sheet__meta-value print-only">{periodo}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="sheet__section">
        {titulo('CONDIÇÕES CLÍNICAS E OBSERVAÇÕES', {
          icon: RotateCcw,
          label: 'Usar o cadastro',
          onClick: () => edit?.drafts?.observacoes?.(),
        })}
        {campo(
          'observacoes',
          'Ex.: Morador de 67 anos, diabético, hipertensivo e esquizofrênico.'
        )}
      </section>

      <section className="sheet__section">
        {titulo('INTERVENÇÕES REALIZADAS NO PERÍODO', {
          icon: Sparkles,
          label: 'Gerar rascunho',
          onClick: () => edit?.drafts?.intervencoes?.(),
        })}
        {campo(
          'intervencoes',
          'Ex.: 02/02: O morador passou por avaliação com a Dra. Camilla Rabuske, médica da família…',
          3
        )}
      </section>

      <section className="sheet__section">
        {titulo('MUDANÇAS OBSERVADAS NO COMPORTAMENTO', {
          icon: Sparkles,
          label: 'Reunir observações',
          onClick: () => edit?.drafts?.comportamento?.(),
        })}
        {campo(
          'comportamento',
          'Ex.: Observa-se, por parte da equipe, que o residente apresentou…'
        )}
      </section>

      <section className="sheet__section">
        {titulo('ADESÃO AO TRATAMENTO', {
          icon: Sparkles,
          label: 'Gerar rascunho',
          onClick: () => edit?.drafts?.adesao?.(),
        })}
        {campo('adesao', 'Ex.: Boa adesão ao tratamento e às medicações.')}
      </section>

      <section className="sheet__section">
        {titulo('NÍVEL DE AUTONOMIA', {
          icon: RotateCcw,
          label: 'Usar o cadastro',
          onClick: () => edit?.drafts?.autonomia?.(),
        })}
        <div className="sheet__autonomy">
          {[
            ['Higiene pessoal:', 'autonomia_higiene'],
            ['Alimentação:', 'autonomia_alimentacao'],
            ['Atividades diárias:', 'autonomia_atividades'],
          ].map(([label, field]) => (
            <div className="sheet__autonomy-row" key={field}>
              <span className="sheet__autonomy-label">{label}</span>
              {leitura ? (
                <span className="sheet__meta-value">{form[field] || '—'}</span>
              ) : (
                <select
                  className="sheet-select"
                  value={form[field]}
                  onChange={edit.set(field)}
                  disabled={travada}
                >
                  <option value="">—</option>
                  {AUTONOMY_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        {divergeDoCadastro && (
          <div className="print-hide" style={{ marginTop: 'var(--space-3)' }}>
            <Alert tone="warning">
              Estes valores diferem do que está cadastrado para {resident.name}
              {' '}({[
                resident.autonomy_hygiene,
                resident.autonomy_food,
                resident.autonomy_activities,
              ].filter(Boolean).join(' · ') || 'não avaliado'}).
              Se a autonomia mudou, atualize também a Central de Cadastros.
            </Alert>
          </div>
        )}
      </section>

      <section className="sheet__section">
        {titulo('INTERAÇÕES SOCIAIS E FAMILIARES', {
          icon: Sparkles,
          label: 'Gerar rascunho',
          onClick: () => edit?.drafts?.interacoes?.(),
        })}
        {campo(
          'interacoes',
          'Ex.: Neste mês foi realizado festividade de carnaval e churrasco para comemoração do aniversariante do mês.'
        )}
      </section>

      <SheetPhotos
        photos={form.photos}
        onChange={edit?.onPhotos || (() => {})}
        residentId={resident.id}
        monthKey={monthKey}
        readOnly={leitura || travada}
      />

      <div className="sheet__signature">
        {assinatura ? (
          <Signature assinatura={assinatura} />
        ) : (
          <>
            <div className="sheet__signature-line" />
            <div className="sheet__signature-name">{currentUser?.name || '—'}</div>
            <div className="sheet__signature-role">
              {currentUser?.job_title || 'Supervisora Residência Terapêutica'}
            </div>
            {formatCouncil(currentUser) && (
              <div className="sheet__signature-role">{formatCouncil(currentUser)}</div>
            )}
            {!leitura && (
              <div
                className="sheet__signature-role print-hide"
                style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}
              >
                Ainda não assinada — use “Gerar relatório assinado”.
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
