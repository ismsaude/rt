/**
 * Gerador de identificadores.
 *
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS ou
 * localhost). Ao abrir o sistema pelo IP da rede local — que é como
 * a equipe testa no celular — a função é `undefined` e qualquer tela
 * que a chame quebra. Este utilitário usa a implementação nativa
 * quando disponível e cai para uma equivalente quando não há.
 */
export function uid() {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }

  // UUID v4 a partir de bytes aleatórios criptográficos.
  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  // Último recurso: sem API de aleatoriedade disponível.
  const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-a${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}
