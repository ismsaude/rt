import { textoCarimbo } from '../../lib/signature';

/**
 * Assinatura de um registro já assinado.
 *
 * `compact` serve a listas e históricos; a forma completa vai em
 * documentos impressos.
 */
export default function Signature({ assinatura, compact = false, align = 'center' }) {
  if (!assinatura?.signed_by_name) return null;

  if (compact) {
    return (
      <div className="signature signature--inline">
        <span className="signature__mark">{assinatura.signed_by_name}</span>
        <span className="signature__stamp">{textoCarimbo(assinatura)}</span>
      </div>
    );
  }

  return (
    <div className={`signature ${align === 'left' ? 'signature--left' : ''}`}>
      <span className="signature__mark">{assinatura.signed_by_name}</span>
      <span className="signature__name">{assinatura.signed_by_name}</span>
      {assinatura.signed_by_role && (
        <span className="signature__role">{assinatura.signed_by_role}</span>
      )}
      {assinatura.signed_council && (
        <span className="signature__council">{assinatura.signed_council}</span>
      )}
      <span className="signature__stamp">{textoCarimbo(assinatura)}</span>
    </div>
  );
}
