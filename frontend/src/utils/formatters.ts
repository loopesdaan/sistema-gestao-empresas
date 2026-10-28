import { resolveImageUrl } from '../services/api';

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

/**
 * Formata valores numéricos ou decimais em Real (BRL) de forma consistente e segura contra null/undefined/NaN.
 */
export const formatMoney = (val?: number | string | null): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formata datas e horários de forma resiliente contra:
 * 1. Formatos com espaço ("YYYY-MM-DD HH:mm:ss") que quebram no Safari / iOS Mobile Viewer (Invalid Date).
 * 2. Formatos apenas data ("YYYY-MM-DD") que sofrem shift de -1 dia no timezone Brasil (UTC-3).
 * 3. Valores nulos, indefinidos ou strings corrompidas.
 */
export const formatDateSafe = (
  dateInput?: string | Date | null,
  options?: {
    includeTime?: boolean;
    dateOnly?: boolean;
    timeOnly?: boolean;
    fallback?: string;
  }
): string => {
  const fallback = options?.fallback ?? '-';
  if (!dateInput) return fallback;

  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return fallback;

      // Caso seja apenas data "YYYY-MM-DD"
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        if (options?.timeOnly) return '--:--';
        const [ano, mes, dia] = trimmed.split('-');
        return `${dia}/${mes}/${ano}`;
      }

      // Normaliza para padrão ISO substituindo espaço por 'T' para compatibilidade com WebKit / Safari
      const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return fallback;

      if (options?.timeOnly) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      if (options?.dateOnly) {
        return d.toLocaleDateString('pt-BR');
      }

      if (options?.includeTime) {
        return d.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      return d.toLocaleString('pt-BR');
    }

    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return fallback;
      if (options?.timeOnly) {
        return dateInput.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
      if (options?.dateOnly) {
        return dateInput.toLocaleDateString('pt-BR');
      }
      return dateInput.toLocaleString('pt-BR');
    }

    return fallback;
  } catch {
    return fallback;
  }
};

/**
 * Abre a imagem original em uma nova aba com compatibilidade para:
 * 1. Data URIs (Base64), que são bloqueados por navegadores em links diretos gerando tela em branco (about:blank).
 * 2. URLs remotas (Cloudflare R2, CDN) e relativas da API.
 */
export const abrirImagemOriginal = (url?: string | null): void => {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed) return;

  const targetUrl = resolveImageUrl(trimmed);

  if (targetUrl.startsWith('data:')) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Visualização de Imagem Original</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              margin: 0;
              background-color: #0b0f19;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 16px;
              box-sizing: border-box;
            }
            img {
              max-width: 100%;
              max-height: 95vh;
              object-fit: contain;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.8);
            }
          </style>
        </head>
        <body>
          <img src="${targetUrl}" alt="Imagem Original" />
        </body>
        </html>
      `);
      win.document.close();
      return;
    }
  }

  window.open(targetUrl, '_blank', 'noopener,noreferrer');
};

/**
 * Utilitários para formatação e máscaras de CNPJ, CPF e Telefone (DDD + traço).
 */

/**
 * Extrai apenas dígitos numéricos de uma string.
 */
export const apenasNumeros = (val?: string | null): string => {
  if (!val) return '';
  return val.replace(/\D/g, '');
};

/**
 * Aplica máscara de CNPJ (XX.XXX.XXX/XXXX-XX) progressivamente conforme digitação.
 */
export const formatarCNPJ = (val?: string | null): string => {
  if (!val) return '';
  const nums = apenasNumeros(val).slice(0, 14);
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12, 14)}`;
};

/**
 * Aplica máscara dinâmica de CPF (11 dígitos) ou CNPJ (14 dígitos).
 */
export const formatarCpfCnpj = (val?: string | null): string => {
  if (!val) return '';
  const nums = apenasNumeros(val);
  if (nums.length <= 11) {
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9, 11)}`;
  }
  return formatarCNPJ(nums);
};

/**
 * Aplica máscara dinâmica de Telefone com DDD:
 * Fixo (10 dígitos): (XX) XXXX-XXXX
 * Celular (11 dígitos): (XX) XXXXX-XXXX
 */
export const formatarTelefone = (val?: string | null): string => {
  if (!val) return '';
  const nums = apenasNumeros(val).slice(0, 11);
  if (nums.length === 0) return '';
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};
