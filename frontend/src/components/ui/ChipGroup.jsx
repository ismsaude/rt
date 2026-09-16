import { Check } from 'lucide-react';

/**
 * Seleção múltipla em forma de chips.
 * Alvo de toque generoso — é preenchido no celular, muitas vezes
 * com pressa e às vezes de luva.
 *
 * `exclusive` marca a opção que zera as demais (ex.: "Sem alteração").
 */
export default function ChipGroup({
  options,
  value = [],
  onChange,
  exclusive,
  ariaLabel,
  className = '',
}) {
  const toggle = (option) => {
    const isOn = value.includes(option);

    if (option === exclusive) {
      onChange(isOn ? [] : [exclusive]);
      return;
    }

    const next = isOn
      ? value.filter((v) => v !== option)
      : [...value.filter((v) => v !== exclusive), option];

    onChange(next);
  };

  return (
    <div className={`chips ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const option = typeof opt === 'string' ? opt : opt.value;
        const tone = typeof opt === 'string' ? 'neutral' : opt.tone || 'neutral';
        const selected = value.includes(option);

        return (
          <button
            key={option}
            type="button"
            className="chip"
            data-tone={tone}
            aria-pressed={selected}
            onClick={() => toggle(option)}
          >
            {selected && <Check size={13} strokeWidth={3} aria-hidden="true" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
