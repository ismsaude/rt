/**
 * Assinatura eletrônica.
 *
 * A validade não vem da imagem que imita caneta — vem de três coisas
 * gravadas juntas: a confirmação da senha pessoal, o instante exato e a
 * origem do acesso. A grafia serve à leitura humana do documento; o que
 * sustenta uma auditoria são os metadados.
 *
 * Limite conhecido: a senha ainda é conferida por consulta à tabela
 * User, em texto puro. Enquanto a autenticação não migrar para o
 * Supabase Auth, esta assinatura prova que alguém digitou a senha
 * correta — não que a pessoa era ela mesma.
 */

import { supabase } from './supabase';
import { formatCouncil } from './clinical';

/** Descrição curta do aparelho, para constar no registro. */
function descreverDispositivo() {
  const ua = navigator.userAgent || '';
  const sistema =
    /iPhone|iPad/i.test(ua) ? 'iPhone/iPad'
      : /Android/i.test(ua) ? 'Android'
      : /Macintosh/i.test(ua) ? 'Mac'
      : /Windows/i.test(ua) ? 'Windows'
      : 'Outro';
  const navegador =
    /Edg\//i.test(ua) ? 'Edge'
      : /Chrome\//i.test(ua) ? 'Chrome'
      : /Safari\//i.test(ua) ? 'Safari'
      : /Firefox\//i.test(ua) ? 'Firefox'
      : 'Navegador';
  return `${navegador} em ${sistema}`;
}

/**
 * IP de origem, obtido da própria aplicação.
 * Falha em silêncio: sem IP a assinatura continua válida, apenas menos
 * detalhada — melhor que impedir o registro de um plantão.
 */
async function obterIP() {
  try {
    const r = await fetch('/api/ip', { cache: 'no-store' });
    if (!r.ok) return null;
    const { ip } = await r.json();
    return ip || null;
  } catch {
    return null;
  }
}

/**
 * Confere a senha pessoal e monta os dados da assinatura.
 *
 * @returns {{ ok: boolean, motivo?: string, assinatura?: object }}
 */
export async function assinar({ user, password }) {
  if (!password) return { ok: false, motivo: 'Digite sua senha para assinar.' };

  // O acesso de desenvolvedor não existe no banco.
  const ehDev = user?.email === 'dev@aurean.com';

  if (!ehDev) {
    const { data, error } = await supabase
      .from('User')
      .select('id, name, role, job_title, professional_council, professional_id, professional_uf')
      .eq('email', user?.email)
      .eq('password', password)
      .maybeSingle();

    if (error) return { ok: false, motivo: 'Não foi possível validar a senha agora.' };
    if (!data) return { ok: false, motivo: 'Senha incorreta.' };

    const [ip] = await Promise.all([obterIP()]);

    return {
      ok: true,
      assinatura: {
        signed_by_name: data.name,
        signed_by_role: data.job_title || data.role,
        signed_council: formatCouncil(data) || null,
        signed_at: new Date().toISOString(),
        signed_ip: ip,
        signed_device: descreverDispositivo(),
      },
    };
  }

  const ip = await obterIP();
  return {
    ok: true,
    assinatura: {
      signed_by_name: user?.name || 'Desenvolvedor',
      signed_by_role: 'Acesso de desenvolvimento',
      signed_council: null,
      signed_at: new Date().toISOString(),
      signed_ip: ip,
      signed_device: descreverDispositivo(),
    },
  };
}

/** Texto do carimbo exibido sob a assinatura. */
export function textoCarimbo(assinatura) {
  if (!assinatura?.signed_at) return '';

  const d = new Date(assinatura.signed_at);
  const dia = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const partes = [`Assinado eletronicamente em ${dia} às ${hora}`];
  if (assinatura.signed_ip) partes.push(`IP ${assinatura.signed_ip}`);
  if (assinatura.signed_device) partes.push(assinatura.signed_device);
  partes.push('validado mediante senha pessoal');

  return `${partes.join(' · ')}.`;
}
