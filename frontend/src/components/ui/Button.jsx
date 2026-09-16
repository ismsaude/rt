import React from 'react';

/**
 * Botão único do sistema.
 * variant: primary | secondary | ghost | subtle | success | danger | danger-ghost
 * size: sm | md | lg | xl
 */
const Button = React.forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    block = false,
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    iconOnly = false,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const iconSize = size === 'sm' ? 15 : size === 'lg' || size === 'xl' ? 19 : 17;

  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block && 'btn--block',
    iconOnly && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        Icon && <Icon size={iconSize} aria-hidden="true" />
      )}
      {!iconOnly && children}
      {!loading && IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </button>
  );
});

export default Button;
