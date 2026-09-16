import { Card } from './Card';

/** Tabela dentro de card, com rolagem horizontal em telas estreitas. */
export function Table({ children, className = '' }) {
  return (
    <Card className={className}>
      <div className="table-wrap">
        <table className="table">{children}</table>
      </div>
    </Card>
  );
}

export function TableEmpty({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        {children}
      </td>
    </tr>
  );
}
