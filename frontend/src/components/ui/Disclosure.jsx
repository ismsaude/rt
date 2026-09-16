import { HelpCircle } from 'lucide-react';

/**
 * Ajuda recolhida.
 *
 * Instruções permanentes viram ruído: quem já sabe usar a tela lê o
 * mesmo aviso todos os dias e para de enxergá-lo — inclusive quando
 * ele muda. Aqui o texto fica a um clique, sem ocupar espaço.
 */
export default function Disclosure({ title = 'Como usar', children, className = '' }) {
  return (
    <details className={`disclosure ${className}`}>
      <summary className="disclosure__summary">
        <HelpCircle size={14} aria-hidden="true" />
        {title}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}
