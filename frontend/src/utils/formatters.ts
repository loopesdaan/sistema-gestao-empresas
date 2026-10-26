/**
 * Utilitários para formatação de identificadores legíveis e humanizados (Venda, OS, Caixa)
 * Trata IDs convencionais, sequenciais e inteiros de 64-bit do CockroachDB Serverless.
 */

/**
 * Formata um identificador de Venda para exibição de cupom/balcão (ex: #0001, #0042).
 */
export const formatarNumeroVenda = (
  venda?: { id?: number; numero_sequencial?: number; codigo_identificador?: string } | number | null
): string => {
  if (!venda) return '#0000';

  if (typeof venda === 'number') {
    if (venda > 1_000_000_000) {
      const curto = (venda % 10000) || 1;
      return `#${String(curto).padStart(4, '0')}`;
    }
    return `#${String(venda).padStart(4, '0')}`;
  }

  if (venda.codigo_identificador) {
    return venda.codigo_identificador.startsWith('#')
      ? venda.codigo_identificador
      : `#${venda.codigo_identificador}`;
  }

  if (venda.numero_sequencial) {
    return `#${String(venda.numero_sequencial).padStart(4, '0')}`;
  }

  if (venda.id) {
    if (venda.id > 1_000_000_000) {
      const curto = (venda.id % 10000) || 1;
      return `#${String(curto).padStart(4, '0')}`;
    }
    return `#${String(venda.id).padStart(4, '0')}`;
  }

  return '#0000';
};

/**
 * Formata o identificador da Ordem de Serviço de forma humanizada (ex: #OS-0001).
 */
export const formatarNumeroOS = (
  os?: { id?: number; numero_sequencial?: number; codigo_identificador?: string } | number | null
): string => {
  if (!os) return '#OS-0000';

  if (typeof os === 'number') {
    const num = os > 1_000_000_000 ? ((os % 10000) || 1) : os;
    return `#OS-${String(num).padStart(4, '0')}`;
  }

  if (os.codigo_identificador) {
    return os.codigo_identificador;
  }

  if (os.numero_sequencial) {
    return `#OS-${String(os.numero_sequencial).padStart(4, '0')}`;
  }

  if (os.id) {
    const num = os.id > 1_000_000_000 ? ((os.id % 10000) || 1) : os.id;
    return `#OS-${String(num).padStart(4, '0')}`;
  }

  return '#OS-0000';
};

/**
 * Formata o identificador do Caixa da loja (ex: 01, 02).
 */
export const formatarNumeroCaixa = (caixaId?: number | null): string => {
  if (!caixaId) return '01';
  if (caixaId > 1_000_000_000) {
    const num = (caixaId % 100) || 1;
    return String(num).padStart(2, '0');
  }
  return String(caixaId).padStart(2, '0');
};
