/**
 * Devolve o IP de quem está assinando.
 *
 * O navegador não conhece o próprio IP público; só o servidor sabe.
 * Esta função lê o cabeçalho que a Vercel preenche na borda, evitando
 * depender de um serviço externo de terceiros — o que exporia a rede da
 * residência a um domínio fora do nosso controle.
 *
 * Não registra nada: apenas devolve o dado para que a tela o grave
 * junto da assinatura.
 */
export default function handler(req, res) {
  const encaminhado = req.headers['x-forwarded-for'] || '';
  const ip =
    encaminhado.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null;

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ip });
}
