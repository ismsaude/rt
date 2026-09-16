import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Envelope de campo: rótulo, dica, mensagem de erro e associação
 * acessível com o controle (label/htmlFor + aria-describedby).
 */
export function Field({ label, hint, error, required = false, htmlFor, className = '', children }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && (
        <span className="field__error" role="alert">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

export const Input = React.forwardRef(function Input(
  { invalid = false, icon: Icon, action, className = '', ...rest },
  ref
) {
  const input = (
    <input
      ref={ref}
      className={`input ${invalid ? 'input--invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );

  if (!Icon && !action) return input;

  return (
    <div className="input-group">
      {Icon && (
        <span className="input-group__icon">
          <Icon size={17} aria-hidden="true" />
        </span>
      )}
      {input}
      {action}
    </div>
  );
});

export const Select = React.forwardRef(function Select(
  { invalid = false, className = '', children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={`select ${invalid ? 'select--invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = React.forwardRef(function Textarea(
  { invalid = false, className = '', ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={`textarea ${invalid ? 'textarea--invalid' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});

/** Campo completo (rótulo + input) com id gerado automaticamente. */
export function TextField({ label, hint, error, required, className, ...inputProps }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Input id={id} invalid={!!error} required={required} {...inputProps} />
    </Field>
  );
}

export function SelectField({ label, hint, error, required, className, children, ...selectProps }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Select id={id} invalid={!!error} required={required} {...selectProps}>
        {children}
      </Select>
    </Field>
  );
}

export function TextareaField({ label, hint, error, required, className, ...areaProps }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Textarea id={id} invalid={!!error} required={required} {...areaProps} />
    </Field>
  );
}
