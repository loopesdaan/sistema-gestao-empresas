import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Venda, FormaPagamento, RelatorioOLAPResponse, Usuario } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';
import { ComprovanteDigitalModal } from '../components/ComprovanteDigitalModal';
import { formatarNumeroVenda, formatarNumeroOS, formatarNumeroCaixa, formatDateSafe } from '../utils/formatters';
import { 
  BarChart3, Search, Ban, CheckCircle, Calendar, 
  ArrowRight, User, DollarSign, ShoppingCart, TrendingUp, 
  Filter, Eye, X, Receipt, Download, FileText, Printer, Table, Layers, ChevronDown,
  Crown, Award, Sparkles, TrendingDown, ArrowUpRight, AlertTriangle, Package, RefreshCw
} from 'lucide-react';

interface RelatoriosProps {
  isAdmin?: boolean;
  usuarioAtual?: Usuario;
}

export const Relatorios: React.FC<RelatoriosProps> = ({ isAdmin = false, usuarioAtual }) => {
  const { empresa, temaAtual } = useEmpresa();
  const { toast, confirmar } = useToast();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);
  const [comprovanteModalAberto, setComprovanteModalAberto] = useState(false);
  const [indiceVendaComprovante, setIndiceVendaComprovante] = useState(0);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

  // Estados de Inteligência Analítica (OLAP) e Previsão Preditiva
  const [periodoOLAP, setPeriodoOLAP] = useState<string>('MENSAL');
  const [dadosOLAP, setDadosOLAP] = useState<RelatorioOLAPResponse | null>(null);
  const [carregandoOLAP, setCarregandoOLAP] = useState<boolean>(isAdmin);
  const [abaVisao, setAbaVisao] = useState<'OLAP' | 'FORECAST' | 'VENDAS' | 'OS_CANCELADAS'>(isAdmin ? 'OLAP' : 'VENDAS');
  const [relatorioCancelamentosOS, setRelatorioCancelamentosOS] = useState<any | null>(null);
  const [carregandoCancelamentosOS, setCarregandoCancelamentosOS] = useState<boolean>(false);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      const data = await apiService.listarVendas();
      setVendas(data);
    } catch (err) {
      console.error('Erro ao listar vendas:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarOLAP = async (periodo: string = periodoOLAP) => {
    try {
      setCarregandoOLAP(true);
      const res = await apiService.getRelatorioOLAP(periodo);
      setDadosOLAP(res);
    } catch (err) {
      console.error('Erro ao carregar relatório OLAP:', err);
    } finally {
      setCarregandoOLAP(false);
    }
  };

  const carregarCancelamentosOS = async () => {
    try {
      setCarregandoCancelamentosOS(true);
      const res = await apiService.obterRelatorioCancelamentosOS();
      setRelatorioCancelamentosOS(res);
    } catch (err) {
      console.error('Erro ao carregar cancelamentos de OS:', err);
    } finally {
      setCarregandoCancelamentosOS(false);
    }
  };

  const exportarCSVCancelamentosOS = () => {
    if (!relatorioCancelamentosOS || !relatorioCancelamentosOS.ordens.length) return;
    let csv = '\ufeff'; // UTF-8 BOM
    csv += 'Número OS;Data Cancelamento;Cliente;Telefone;Veículo/Equipamento;Responsável Cancelamento;Motivo do Cancelamento;Mão de Obra (R$);Peças (R$);Total (R$)\n';
    relatorioCancelamentosOS.ordens.forEach((o: any) => {
      const dataCanc = formatDateSafe(o.data_cancelamento, { includeTime: true, fallback: '' });
      const motivo = (o.motivo_cancelamento || '').replace(/;/g, ',');
      csv += `${o.id};"${dataCanc}";"${o.cliente_nome}";"${o.cliente_telefone || ''}";"${o.equipamento || ''}";"${o.usuario_cancelamento_nome || ''}";"${motivo}";${Number(o.valor_servicos).toFixed(2)};${Number(o.valor_pecas).toFixed(2)};${Number(o.valor_total).toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_cancelamentos_os_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    carregarVendas();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      carregarOLAP(periodoOLAP);
    }
  }, [periodoOLAP, isAdmin]);

  const handleCancelarVenda = (id: number) => {
    confirmar({
      titulo: 'Cancelar Venda',
      mensagem: `Deseja realmente cancelar a venda #${id}? Os itens retornarão automaticamente ao estoque.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Cancelar Venda',
      textoCancelar: 'Voltar',
      onConfirmar: async () => {
        try {
          await apiService.cancelarVenda(id, 'Cancelado pelo operador no painel de relatórios');
          toast.sucesso(`Venda #${id} cancelada com sucesso! Itens estornados ao estoque.`);
          carregarVendas();
          if (vendaDetalhe?.id === id) {
            setVendaDetalhe(null);
          }
        } catch (err: any) {
          toast.erro(err.response?.data?.detail || 'Erro ao cancelar venda');
        }
      }
    });
  };

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getFormaLabel = (forma: FormaPagamento) => {
    const map: Record<FormaPagamento, string> = {
      DINHEIRO: 'Dinheiro',
      PIX: 'PIX',
      CARTAO_CREDITO: 'Crédito',
      CARTAO_DEBITO: 'Débito',
      A_PRAZO: 'A Prazo (Crediário)'
    };
    return map[forma] || forma;
  };

  // Lista de vendedores únicos presentes nas vendas
  const vendedoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    vendas.forEach(v => {
      if (v.usuario_nome) set.add(v.usuario_nome);
      else if (v.usuario_id) set.add(`Operador #${v.usuario_id}`);
    });
    return Array.from(set);
  }, [vendas]);

  // Vendas filtradas
  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => {
      // Se não for admin, restringe estritamente às vendas do próprio operador
      if (!isAdmin && usuarioAtual) {
        const isMinhaVenda = (v.usuario_id && v.usuario_id === usuarioAtual.id) || 
                             (v.usuario_nome && v.usuario_nome === usuarioAtual.nome);
        if (!isMinhaVenda) return false;
      }

      // Filtro status
      if (filtroStatus !== 'TODOS' && v.status !== filtroStatus) return false;

      // Filtro vendedor
      const nomeVendedor = v.usuario_nome || `Operador #${v.usuario_id}`;
      if (filtroVendedor !== 'TODOS' && nomeVendedor !== filtroVendedor) return false;

      // Busca texto (ID, Cliente ou Vendedor)
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchId = String(v.id).includes(termo);
        const matchCliente = (v.cliente_nome || 'Consumidor Final').toLowerCase().includes(termo);
        const matchVendedor = nomeVendedor.toLowerCase().includes(termo);
        if (!matchId && !matchCliente && !matchVendedor) return false;
      }

      return true;
    });
  }, [vendas, busca, filtroVendedor, filtroStatus, isAdmin, usuarioAtual]);

  // Métricas calculadas sobre vendas concluídas
  const metricas = useMemo(() => {
    const concluidas = vendasFiltradas.filter(v => v.status === 'CONCLUIDA');
    const faturamentoTotal = concluidas.reduce((acc, v) => acc + Number(v.valor_liquido || 0), 0);
    const totalVendas = concluidas.length;
    const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;

    // Vendas por vendedor
    const porVendedor: Record<string, { total: number; qtd: number }> = {};
    concluidas.forEach(v => {
      const vend = v.usuario_nome || `Operador #${v.usuario_id}`;
      if (!porVendedor[vend]) porVendedor[vend] = { total: 0, qtd: 0 };
      porVendedor[vend].total += Number(v.valor_liquido || 0);
      porVendedor[vend].qtd += 1;
    });

    let topVendedor = '-';
    let maxTotal = 0;
    Object.entries(porVendedor).forEach(([nome, info]) => {
      if (info.total > maxTotal) {
        maxTotal = info.total;
        topVendedor = `${nome} (${formatMoney(info.total)})`;
      }
    });

    return { faturamentoTotal, totalVendas, ticketMedio, topVendedor };
  }, [vendasFiltradas]);

  // Gerador de Documento HTML Executivo (Com OLAP, Ranking e Previsão)
  const gerarConteudoHTML = () => {
    const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Sistema de Gestão';
    const agora = new Date().toLocaleString('pt-BR');

    // Linhas do Ranking de Operadores
    const linhasRanking = (dadosOLAP?.ranking_operadores || []).map(op => `
      <tr>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155;">${op.badge}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">${op.nome_operador}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${op.perfil}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${op.quantidade_vendas}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">${formatMoney(op.faturamento)}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatMoney(op.ticket_medio)}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0284c7;">${op.participacao_percentual}%</td>
      </tr>
    `).join('');

    // Linhas dos Produtos Motores da Previsão
    const linhasProdutos = (dadosOLAP?.previsao_faturamento?.produtos_motores || []).map(p => `
      <tr>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${p.nome}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${p.unidades_vendidas} un</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${p.taxa_giro_diaria} un/dia</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #059669;">${formatMoney(p.receita_diaria)}/dia</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${p.estoque_atual} un (${p.dias_estoque_estimados} dias)</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; ${
            p.risco_ruptura === 'ALTO' ? 'background: #fee2e2; color: #991b1b;' :
            p.risco_ruptura === 'MEDIO' ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'
          }">
            ${p.risco_ruptura}
          </span>
        </td>
      </tr>
    `).join('');

    const linhasTabela = vendasFiltradas.slice(0, 100).map(v => `
      <tr>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #334155;">${formatarNumeroVenda(v)}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${formatDateSafe(v.created_at, { includeTime: true })}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${v.usuario_nome || `Operador #${v.usuario_id}`}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #334155;">${v.cliente_nome || 'Consumidor Final'}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatMoney(v.valor_bruto)}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #e11d48;">${v.desconto > 0 ? `-${formatMoney(v.desconto)}` : '-'}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">${formatMoney(v.valor_liquido)}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #0284c7; font-weight: 500;">${v.pagamentos.map(p => getFormaLabel(p.forma_pagamento)).join(', ') || 'Dinheiro'}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; ${v.status === 'CONCLUIDA' ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
            ${v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
          </span>
        </td>
      </tr>
    `).join('');

    const fatOLAP = dadosOLAP?.metricas_consolidadas.faturamento_total || metricas.faturamentoTotal;
    const qtdOLAP = dadosOLAP?.metricas_consolidadas.quantidade_vendas || metricas.totalVendas;
    const tmOLAP = dadosOLAP?.metricas_consolidadas.ticket_medio || metricas.ticketMedio;
    const prev30 = dadosOLAP?.previsao_faturamento.previsao_30_dias || 0;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Executivo & OLAP - ${nomeEmpresa}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 28px; color: #0f172a; background: #ffffff; }
    .header { border-bottom: 3px solid #0284c7; padding-bottom: 16px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; }
    .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .card-val { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 800; color: #0f172a; margin: 24px 0 8px 0; border-left: 4px solid #0284c7; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 1cm; size: landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${nomeEmpresa}</h1>
      <p class="subtitle">Relatório Executivo de Vendas, Ranking de Operadores e Previsão Preditiva (OLAP)</p>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <p style="margin: 0;"><strong>Período Analisado:</strong> ${periodoOLAP}</p>
      <p style="margin: 4px 0 0 0;"><strong>Emissão:</strong> ${agora}</p>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Faturamento do Período</div>
      <div class="card-val" style="color: #059669;">${formatMoney(fatOLAP)}</div>
    </div>
    <div class="card">
      <div class="card-label">Volume de Vendas</div>
      <div class="card-val" style="color: #0284c7;">${qtdOLAP}</div>
    </div>
    <div class="card">
      <div class="card-label">Ticket Médio</div>
      <div class="card-val" style="color: #6366f1;">${formatMoney(tmOLAP)}</div>
    </div>
    <div class="card">
      <div class="card-label">Previsão Próximos 30 Dias</div>
      <div class="card-val" style="color: #d97706;">${formatMoney(prev30)}</div>
    </div>
  </div>

  <div class="section-title">🏆 Ranking de Operadores & Vendedores (Quem Mais Vendeu)</div>
  <table>
    <thead>
      <tr>
        <th>Posição</th>
        <th>Operador</th>
        <th>Perfil</th>
        <th style="text-align: center;">Qtd Vendas</th>
        <th style="text-align: right;">Faturamento</th>
        <th style="text-align: right;">Ticket Médio</th>
        <th style="text-align: right;">Participação</th>
      </tr>
    </thead>
    <tbody>
      ${linhasRanking || '<tr><td colspan="7" style="padding: 10px; text-align: center;">Nenhum operador com vendas no período.</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">📈 Previsão Preditiva de Faturamento com Base em Produtos</div>
  <table>
    <thead>
      <tr>
        <th>Produto Motor</th>
        <th style="text-align: center;">Vendidos</th>
        <th style="text-align: right;">Taxa de Giro</th>
        <th style="text-align: right;">Receita Média/Dia</th>
        <th style="text-align: center;">Estoque Atual / Cobertura</th>
        <th style="text-align: center;">Risco Ruptura</th>
      </tr>
    </thead>
    <tbody>
      ${linhasProdutos || '<tr><td colspan="6" style="padding: 10px; text-align: center;">Sem dados de produtos suficientes.</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">📋 Detalhamento das Vendas Realizadas</div>
  <table>
    <thead>
      <tr>
        <th># ID</th>
        <th>Data / Hora</th>
        <th>Operador / Vendedor</th>
        <th>Cliente</th>
        <th style="text-align: right;">Bruto</th>
        <th style="text-align: right;">Desconto</th>
        <th style="text-align: right;">Líquido</th>
        <th>Forma de Pgto</th>
        <th style="text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${linhasTabela}
    </tbody>
  </table>

  <div style="margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center;">
    Relatório gerado pelo Sistema de Gestão Empresarial • ${nomeEmpresa}
  </div>
</body>
</html>`;
  };

  // 1. Exportação em Excel (CSV formatado com separador ponto-e-vírgula e UTF-8 BOM)
  const exportarExcel = () => {
    const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Empresa';
    const dataHoje = new Date().toISOString().split('T')[0];

    let csv = `RELATÓRIO ANALÍTICO & FORECAST (OLAP) - ${nomeEmpresa.toUpperCase()}\r\n`;
    csv += `Período Analisado:;${periodoOLAP}\r\n`;
    csv += `Data de Emissão:;${new Date().toLocaleString('pt-BR')}\r\n`;
    csv += `Faturamento Consolidado:;${formatMoney(dadosOLAP?.metricas_consolidadas.faturamento_total || metricas.faturamentoTotal)}\r\n`;
    csv += `Total de Vendas:;${dadosOLAP?.metricas_consolidadas.quantidade_vendas || metricas.totalVendas}\r\n`;
    csv += `Ticket Médio:;${formatMoney(dadosOLAP?.metricas_consolidadas.ticket_medio || metricas.ticketMedio)}\r\n`;
    csv += `Previsão Próximos 30 Dias:;${formatMoney(dadosOLAP?.previsao_faturamento.previsao_30_dias || 0)}\r\n\r\n`;

    // Seção Ranking de Operadores
    csv += `--- RANKING DE OPERADORES / VENDEDORES ---\r\n`;
    csv += `Posição;Operador;Perfil;Qtd Vendas;Faturamento (R$);Ticket Médio (R$);Participação (%)\r\n`;
    (dadosOLAP?.ranking_operadores || []).forEach(op => {
      csv += `${op.posicao};${op.nome_operador};${op.perfil};${op.quantidade_vendas};${op.faturamento.toFixed(2).replace('.', ',')};${op.ticket_medio.toFixed(2).replace('.', ',')};${op.participacao_percentual.toFixed(1).replace('.', ',')}%\r\n`;
    });
    csv += `\r\n`;

    // Seção Previsão de Produtos
    csv += `--- PRODUTOS MOTORES DA PREVISÃO PREDITIVA ---\r\n`;
    csv += `Produto;Unidades Vendidas;Giro Diário (un/dia);Receita Diária (R$/dia);Estoque Atual;Dias Cobertura;Risco Ruptura\r\n`;
    (dadosOLAP?.previsao_faturamento.produtos_motores || []).forEach(p => {
      csv += `${p.nome};${p.unidades_vendidas};${p.taxa_giro_diaria.toFixed(2).replace('.', ',')};${p.receita_diaria.toFixed(2).replace('.', ',')};${p.estoque_atual};${p.dias_estoque_estimados};${p.risco_ruptura}\r\n`;
    });
    csv += `\r\n`;

    // Seção Transações Detalhadas
    csv += `--- DETALHAMENTO DE VENDAS ---\r\n`;
    csv += `ID da Venda;Data / Hora;Vendedor / Operador;Cliente;Valor Bruto (R$);Desconto (R$);Valor Líquido (R$);Formas de Pagamento;Status\r\n`;
    vendasFiltradas.forEach(v => {
      const dataHora = formatDateSafe(v.created_at, { includeTime: true });
      const vendedor = (v.usuario_nome || `Operador #${v.usuario_id}`).replace(/;/g, ',');
      const cliente = (v.cliente_nome || 'Consumidor Final').replace(/;/g, ',');
      const pgtos = v.pagamentos.map(p => getFormaLabel(p.forma_pagamento)).join(' + ');
      const status = v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada';

      csv += `${formatarNumeroVenda(v)};${dataHora};${vendedor};${cliente};${Number(v.valor_bruto).toFixed(2).replace('.', ',')};${Number(v.desconto).toFixed(2).replace('.', ',')};${Number(v.valor_liquido).toFixed(2).replace('.', ',')};${pgtos};${status}\r\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_analitico_${periodoOLAP.toLowerCase()}_${dataHoje}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Exportação em HTML
  const exportarHTML = () => {
    const conteudo = gerarConteudoHTML();
    const dataHoje = new Date().toISOString().split('T')[0];
    const blob = new Blob([conteudo], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_analitico_${periodoOLAP.toLowerCase()}_${dataHoje}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Exportação em PDF sem abrir página em branco
  const exportarPDF = () => {
    const conteudo = gerarConteudoHTML();
    const existingIframe = document.getElementById('relatorio-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'relatorio-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(conteudo);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2500);
    }, 300);
  };

  // 4. Exportar Todos Juntos (Excel + PDF + HTML)
  const exportarTodosJuntos = () => {
    exportarExcel();
    setTimeout(() => exportarHTML(), 250);
    setTimeout(() => exportarPDF(), 500);
    setMenuExportarAberto(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {isAdmin ? 'Relatório de Vendas Realizadas' : 'Minhas Vendas Realizadas'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Histórico completo com identificação do vendedor/operador, formas de pagamento e auditoria.'
              : `Histórico e comprovantes das vendas registradas por você (${usuarioAtual?.nome || 'Operador'}).`}
          </p>
        </div>

        {/* Menu de Exportação (Excel, PDF, HTML ou Todos Juntos) */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <button
              onClick={exportarTodosJuntos}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all"
              title="Baixa Excel, HTML e abre janela de PDF"
            >
              <Layers size={15} />
              <span>Exportar {isAdmin ? 'Tudo (Excel + PDF + HTML)' : 'Minhas Vendas'}</span>
            </button>

            <button
              onClick={() => setMenuExportarAberto(!menuExportarAberto)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              title="Opções individuais de exportação"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {menuExportarAberto && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fade-in text-xs font-medium">
              <button
                onClick={() => { exportarExcel(); setMenuExportarAberto(false); }}
                className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <Table size={15} className="text-emerald-600" />
                <span>Exportar Planilha Excel (.csv)</span>
              </button>
              <button
                onClick={() => { exportarPDF(); setMenuExportarAberto(false); }}
                className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <Printer size={15} className="text-rose-600" />
                <span>Gerar / Imprimir PDF</span>
              </button>
              <button
                onClick={() => { exportarHTML(); setMenuExportarAberto(false); }}
                className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
              >
                <FileText size={15} className="text-sky-600" />
                <span>Exportar Relatório HTML</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={exportarTodosJuntos}
                className="w-full px-4 py-2.5 text-left text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 font-bold transition-colors"
              >
                <Layers size={15} />
                <span>Extrair Pacote Completo (Todos)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Seleção de Horizonte OLAP e Abas de Visão (Apenas para Gerente / Administrador) */}
      {isAdmin && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          {/* Seletor de Horizonte Temporal OLAP */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Horizonte Temporal de Inteligência (OLAP)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {dadosOLAP?.dias_periodo || 30} dias analisados
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dadosOLAP 
                  ? `Janela de análise: ${formatDateSafe(dadosOLAP.data_inicio, { dateOnly: true })} até ${formatDateSafe(dadosOLAP.data_fim, { dateOnly: true })}`
                  : 'Carregando inteligência analítica...'}
              </p>
            </div>

            {/* 8 Horizontes Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'SEMANAL', label: 'Semanal (7d)' },
                { id: 'QUINZENAL', label: 'Quinzenal (15d)' },
                { id: 'MENSAL', label: 'Mensal (30d)' },
                { id: 'BIMESTRAL', label: 'Bimestral (60d)' },
                { id: 'TRIMESTRAL', label: 'Trimestral (90d)' },
                { id: 'QUADRIMESTRAL', label: 'Quadrimestral (120d)' },
                { id: 'SEMESTRAL', label: 'Semestral (180d)' },
                { id: 'ANUAL', label: 'Anual (365d)' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriodoOLAP(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    periodoOLAP === p.id
                      ? 'bg-slate-900 text-white shadow-xs scale-102'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Abas de Visão do Painel */}
          <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAbaVisao('OLAP')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  abaVisao === 'OLAP'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Crown size={15} />
                <span>🏆 Ranking & Leaderboard OLAP</span>
              </button>

              <button
                onClick={() => setAbaVisao('FORECAST')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  abaVisao === 'FORECAST'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <TrendingUp size={15} />
                <span>📈 Previsão Preditiva (Produtos)</span>
              </button>

              <button
                onClick={() => setAbaVisao('VENDAS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  abaVisao === 'VENDAS'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Table size={15} />
                <span>📋 Transações & Auditoria (OLTP)</span>
              </button>

              <button
                onClick={() => {
                  setAbaVisao('OS_CANCELADAS');
                  carregarCancelamentosOS();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  abaVisao === 'OS_CANCELADAS'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Ban size={15} />
                <span>🚫 Cancelamentos de OS</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { carregarOLAP(periodoOLAP); carregarVendas(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                title="Recarregar análises"
              >
                <RefreshCw size={13} className={carregandoOLAP ? 'animate-spin text-sky-600' : ''} />
                <span>Atualizar Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 1: RANKING E LEADERBOARD OLAP (ADMIN ONLY) */}
      {isAdmin && abaVisao === 'OLAP' && (
        <div className="space-y-6">
          {/* Cartões Consolidados do Período OLAP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Período</span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {formatMoney(dadosOLAP?.metricas_consolidadas.faturamento_total || 0)}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                {(dadosOLAP?.metricas_consolidadas.crescimento_percentual ?? 0) >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight size={12} />
                    +{dadosOLAP?.metricas_consolidadas.crescimento_percentual ?? 0}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                    <TrendingDown size={12} />
                    {dadosOLAP?.metricas_consolidadas.crescimento_percentual ?? 0}%
                  </span>
                )}
                <span className="text-[10px] text-slate-400">vs período anterior</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Volume de Vendas</span>
                <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                  <ShoppingCart size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {dadosOLAP?.metricas_consolidadas.quantidade_vendas || 0} concluídas
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {dadosOLAP?.metricas_consolidadas.itens_vendidos || 0} itens faturados no total
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {formatMoney(dadosOLAP?.metricas_consolidadas.ticket_medio || 0)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Média consolidada por transação</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Média Diária</span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <Calendar size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {formatMoney(dadosOLAP?.metricas_consolidadas.media_diaria || 0)}/dia
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Ritmo operacional ({dadosOLAP?.dias_periodo || 30} dias)</p>
            </div>
          </div>

          {/* Pódio Top 3 Colaboradores (Leaderboard Cards) */}
          {dadosOLAP?.ranking_operadores && dadosOLAP.ranking_operadores.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Crown className="text-amber-500" size={18} />
                    <span>Pódio de Performance Comercial ("Quem Mais Vendeu")</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Reconhecimento dos operadores e gerentes líderes no horizonte {periodoOLAP.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1º Lugar */}
                {dadosOLAP.ranking_operadores[0] && (
                  <div className="relative bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-white p-5 rounded-2xl border-2 border-amber-300 shadow-md">
                    <div className="absolute top-3 right-3 bg-amber-500 text-white p-2 rounded-xl shadow-xs">
                      <Crown size={20} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                      1º Lugar Líder de Vendas
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-2 truncate">
                      {dadosOLAP.ranking_operadores[0].nome_operador}
                    </h4>
                    <p className="text-xs text-slate-500">{dadosOLAP.ranking_operadores[0].perfil}</p>

                    <div className="mt-4 pt-3 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Faturamento</span>
                        <span className="text-base font-black text-amber-700">
                          {formatMoney(dadosOLAP.ranking_operadores[0].faturamento)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Participação</span>
                        <span className="text-base font-black text-slate-800">
                          {dadosOLAP.ranking_operadores[0].participacao_percentual}%
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-between text-slate-500 pt-1 text-[11px]">
                        <span>{dadosOLAP.ranking_operadores[0].quantidade_vendas} vendas concluídas</span>
                        <span>TM: {formatMoney(dadosOLAP.ranking_operadores[0].ticket_medio)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2º Lugar */}
                {dadosOLAP.ranking_operadores[1] && (
                  <div className="relative bg-gradient-to-br from-slate-100 via-slate-50 to-white p-5 rounded-2xl border border-slate-300 shadow-sm">
                    <div className="absolute top-3 right-3 bg-slate-400 text-white p-2 rounded-xl">
                      <Award size={18} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-400 text-white">
                      2º Lugar
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-2 truncate">
                      {dadosOLAP.ranking_operadores[1].nome_operador}
                    </h4>
                    <p className="text-xs text-slate-500">{dadosOLAP.ranking_operadores[1].perfil}</p>

                    <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Faturamento</span>
                        <span className="text-base font-black text-slate-800">
                          {formatMoney(dadosOLAP.ranking_operadores[1].faturamento)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Participação</span>
                        <span className="text-base font-black text-slate-800">
                          {dadosOLAP.ranking_operadores[1].participacao_percentual}%
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-between text-slate-500 pt-1 text-[11px]">
                        <span>{dadosOLAP.ranking_operadores[1].quantidade_vendas} vendas</span>
                        <span>TM: {formatMoney(dadosOLAP.ranking_operadores[1].ticket_medio)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3º Lugar */}
                {dadosOLAP.ranking_operadores[2] && (
                  <div className="relative bg-gradient-to-br from-amber-700/5 via-orange-500/5 to-white p-5 rounded-2xl border border-amber-600/30 shadow-sm">
                    <div className="absolute top-3 right-3 bg-amber-700 text-white p-2 rounded-xl">
                      <Award size={18} />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-700 text-white">
                      3º Lugar
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-2 truncate">
                      {dadosOLAP.ranking_operadores[2].nome_operador}
                    </h4>
                    <p className="text-xs text-slate-500">{dadosOLAP.ranking_operadores[2].perfil}</p>

                    <div className="mt-4 pt-3 border-t border-amber-200/40 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Faturamento</span>
                        <span className="text-base font-black text-slate-800">
                          {formatMoney(dadosOLAP.ranking_operadores[2].faturamento)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Participação</span>
                        <span className="text-base font-black text-slate-800">
                          {dadosOLAP.ranking_operadores[2].participacao_percentual}%
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-between text-slate-500 pt-1 text-[11px]">
                        <span>{dadosOLAP.ranking_operadores[2].quantidade_vendas} vendas</span>
                        <span>TM: {formatMoney(dadosOLAP.ranking_operadores[2].ticket_medio)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabela Completa de Ranking de Operadores */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Classificação Geral de Desempenho</h4>
                <p className="text-xs text-slate-400">Auditoria individualizada com cota de faturamento e ticket médio</p>
              </div>
            </div>

            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {!dadosOLAP?.ranking_operadores || dadosOLAP.ranking_operadores.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhum registro de venda localizado no período selecionado.
                </div>
              ) : (
                dadosOLAP.ranking_operadores.map((op) => (
                  <div key={op.usuario_id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-sm text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">
                          {op.badge}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {op.nome_operador.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-xs">{op.nome_operador}</h5>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {op.perfil}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600 text-sm block">{formatMoney(op.faturamento)}</span>
                        <span className="text-[10px] text-slate-400">{op.quantidade_vendas} vendas</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Ticket Médio</span>
                        <span className="font-semibold text-slate-800">{formatMoney(op.ticket_medio)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Participação</span>
                        <span className="font-bold text-slate-800">{op.participacao_percentual}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, op.participacao_percentual)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">{op.participacao_percentual}% da receita</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-center">Posição</th>
                    <th className="py-3 px-4">Operador / Vendedor</th>
                    <th className="py-3 px-4">Perfil / Cargo</th>
                    <th className="py-3 px-4 text-center">Qtd. Vendas</th>
                    <th className="py-3 px-4 text-right">Faturamento Total</th>
                    <th className="py-3 px-4 text-right">Ticket Médio</th>
                    <th className="py-3 px-4 w-48">Participação na Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {!dadosOLAP?.ranking_operadores || dadosOLAP.ranking_operadores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        Nenhum registro de venda localizado no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    dadosOLAP.ranking_operadores.map((op) => (
                      <tr key={op.usuario_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span className="font-black text-sm text-slate-700">
                            {op.badge}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                              {op.nome_operador.charAt(0).toUpperCase()}
                            </div>
                            <span>{op.nome_operador}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {op.perfil}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {op.quantidade_vendas}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">
                          {formatMoney(op.faturamento)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-700">
                          {formatMoney(op.ticket_medio)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, op.participacao_percentual)}%` }}
                              />
                            </div>
                            <span className="font-bold text-[11px] text-slate-700 w-12 text-right">
                              {op.participacao_percentual}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: PREVISÃO PREDITIVA DE FATURAMENTO COM BASE EM PRODUTOS (ADMIN ONLY) */}
      {isAdmin && abaVisao === 'FORECAST' && (
        <div className="space-y-6">
          {/* Cartões de Projeção Preditiva */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-white p-4 rounded-2xl border border-indigo-200 shadow-xs">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Projeção 7 Dias</span>
                <Sparkles size={16} />
              </div>
              <h3 className="text-2xl font-black text-indigo-950">
                {formatMoney(dadosOLAP?.previsao_faturamento.previsao_7_dias || 0)}
              </h3>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">Curto prazo (semana seguinte)</p>
            </div>

            <div className="bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-white p-4 rounded-2xl border border-sky-200 shadow-xs">
              <div className="flex items-center justify-between text-sky-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Projeção 30 Dias</span>
                <TrendingUp size={16} />
              </div>
              <h3 className="text-2xl font-black text-sky-950">
                {formatMoney(dadosOLAP?.previsao_faturamento.previsao_30_dias || 0)}
              </h3>
              <p className="text-[11px] text-sky-600 font-medium mt-1">Horizonte mensal preditivo</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-white p-4 rounded-2xl border border-purple-200 shadow-xs">
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Projeção 90 Dias</span>
                <Layers size={16} />
              </div>
              <h3 className="text-2xl font-black text-purple-950">
                {formatMoney(dadosOLAP?.previsao_faturamento.previsao_90_dias || 0)}
              </h3>
              <p className="text-[11px] text-purple-600 font-medium mt-1">Horizonte trimestral estratégico</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Modelo Estatístico</span>
                <Award size={16} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {dadosOLAP?.previsao_faturamento.confianca_estatistica || 0}% confiança
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Fator de aceleração: {(dadosOLAP?.previsao_faturamento.fator_tendencia || 1).toFixed(2)}x
              </p>
            </div>
          </div>

          {/* Recomendações Estratégicas Automáticas da IA / Modelo */}
          {dadosOLAP?.previsao_faturamento.sugestoes_estrategicas && dadosOLAP.previsao_faturamento.sugestoes_estrategicas.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-5 rounded-2xl border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <Sparkles size={16} className="text-amber-600" />
                <span>Recomendações Preditivas do Sistema (Base de Produtos)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                {dadosOLAP.previsao_faturamento.sugestoes_estrategicas.map((sugestao, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-amber-500 font-bold">✔</span>
                    <span>{sugestao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Produtos Motores do Faturamento (Velocidade e Risco de Ruptura) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Produtos Motores do Faturamento</h4>
                <p className="text-xs text-slate-400">
                  Taxa diária de giro, receita projetada por produto e estimativa de dias até esgotamento de estoque (ruptura)
                </p>
              </div>
            </div>

            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {!dadosOLAP?.previsao_faturamento.produtos_motores || dadosOLAP.previsao_faturamento.produtos_motores.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhum produto com movimentação registrada neste horizonte temporal.
                </div>
              ) : (
                dadosOLAP.previsao_faturamento.produtos_motores.map((prod) => (
                  <div key={prod.produto_id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                          <Package size={15} />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-xs leading-snug">{prod.nome}</h5>
                          <span className="text-[10px] text-slate-400">ID #{prod.produto_id}</span>
                        </div>
                      </div>

                      {prod.risco_ruptura === 'ALTO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse shrink-0">
                          <AlertTriangle size={11} />
                          ALTO RISCO (&lt; 7d)
                        </span>
                      ) : prod.risco_ruptura === 'MEDIO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          MÉDIO (&lt; 15d)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          ESTÁVEL
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Receita Diária</span>
                        <span className="font-black text-indigo-600">{formatMoney(prod.receita_diaria)}/dia</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Giro: {prod.taxa_giro_diaria} un/dia</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Estoque & Cobertura</span>
                        <span className="font-bold text-slate-800">
                          {prod.estoque_atual} un ({prod.dias_estoque_estimados > 365 ? '365+d' : `${prod.dias_estoque_estimados}d`})
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{prod.unidades_vendidas} un vendidas</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">Faturamento no período:</span>
                      <span className="font-black text-slate-900">{formatMoney(prod.faturamento)} ({prod.contribuicao_percentual}%)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Produto</th>
                    <th className="py-3 px-4 text-center">Giro Diário</th>
                    <th className="py-3 px-4 text-right">Receita Diária</th>
                    <th className="py-3 px-4 text-center">Un. Vendidas</th>
                    <th className="py-3 px-4 text-right">Faturamento Histórico</th>
                    <th className="py-3 px-4 text-center">Estoque Atual</th>
                    <th className="py-3 px-4 text-center">Dias de Cobertura</th>
                    <th className="py-3 px-4 text-center">Alerta de Ruptura</th>
                    <th className="py-3 px-4 text-right">% no Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {!dadosOLAP?.previsao_faturamento.produtos_motores || dadosOLAP.previsao_faturamento.produtos_motores.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        Nenhum produto com movimentação registrada neste horizonte temporal.
                      </td>
                    </tr>
                  ) : (
                    dadosOLAP.previsao_faturamento.produtos_motores.map((prod) => (
                      <tr key={prod.produto_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                              <Package size={14} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{prod.nome}</p>
                              <p className="text-[10px] text-slate-400">ID #{prod.produto_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {prod.taxa_giro_diaria} un/dia
                        </td>
                        <td className="py-3 px-4 text-right font-black text-indigo-600">
                          {formatMoney(prod.receita_diaria)}/dia
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {prod.unidades_vendidas}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatMoney(prod.faturamento)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] ${
                            prod.estoque_atual <= 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {prod.estoque_atual} un
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {prod.dias_estoque_estimados > 365 ? '365+ dias' : `${prod.dias_estoque_estimados} dias`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {prod.risco_ruptura === 'ALTO' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                              <AlertTriangle size={11} />
                              ALTO RISCO (&lt; 7d)
                            </span>
                          ) : prod.risco_ruptura === 'MEDIO' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              MÉDIO (&lt; 15d)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ESTÁVEL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-800">
                          {prod.contribuicao_percentual}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: TRANSAÇÕES DETALHADAS & AUDITORIA (OLTP) */}
      {(!isAdmin || abaVisao === 'VENDAS') && (
        <div className="space-y-6">
          {/* Cartões de Indicadores Rápidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isAdmin ? 'Faturamento Líquido' : 'Meu Faturamento Total'}
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{formatMoney(metricas.faturamentoTotal)}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAdmin ? 'Total das vendas filtradas' : 'Total acumulado por você'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isAdmin ? 'Qtd. de Vendas' : 'Minhas Vendas'}
                </span>
                <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                  <ShoppingCart size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{metricas.totalVendas} concluídas</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Volume de atendimentos</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Ticket Médio</span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{formatMoney(metricas.ticketMedio)}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Média por atendimento</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isAdmin ? 'Vendedor Destaque' : 'Operador Responsável'}
                </span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <User size={16} />
                </div>
              </div>
              <h3 className="text-xs font-bold text-slate-900 truncate" title={isAdmin ? metricas.topVendedor : (usuarioAtual?.nome || 'Você')}>
                {isAdmin ? metricas.topVendedor : (usuarioAtual?.nome || 'Você')}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAdmin ? 'Maior faturamento no filtro' : 'Matrícula autenticada'}
              </p>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por #ID ou cliente..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Filtro de Vendedor (Apenas para Gerente / Administrador) */}
              {isAdmin && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <User size={14} className="text-slate-500" />
                  <span className="font-semibold text-slate-600">Vendedor:</span>
                  <select
                    value={filtroVendedor}
                    onChange={(e) => setFiltroVendedor(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
                  >
                    <option value="TODOS">Todos os Vendedores</option>
                    {vendedoresDisponiveis.map(vend => (
                      <option key={vend} value={vend}>{vend}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro de Status */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Filter size={14} className="text-slate-500" />
                <span className="font-semibold text-slate-600">Status:</span>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  <option value="CONCLUIDA">Concluídas</option>
                  <option value="CANCELADA">Canceladas</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Vendas com Vendedor */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {vendasFiltradas.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhuma venda encontrada com os filtros selecionados.
                </div>
              ) : (
                vendasFiltradas.map((v) => (
                  <div key={v.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatarNumeroVenda(v)}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {formatDateSafe(v.created_at, { includeTime: true })}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        v.status === 'CONCLUIDA'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Vendedor:</span>
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                          {v.usuario_nome || `Operador #${v.usuario_id}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Cliente:</span>
                        <span className="font-medium text-slate-800">{v.cliente_nome || 'Consumidor Final'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Pagamento:</span>
                        <span className="text-slate-600 font-medium">{v.pagamentos?.map(p => getFormaLabel(p.forma_pagamento)).join(', ') || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Valor Líquido</span>
                        <span className="font-black text-slate-900 text-base">{formatMoney(v.valor_liquido)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setVendaDetalhe(v);
                            setIndiceVendaComprovante(vendasFiltradas.findIndex(vf => vf.id === v.id));
                            setComprovanteModalAberto(true);
                          }}
                          title="Visualizar comprovante digital da venda"
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <Receipt size={13} />
                          <span>Comprovante</span>
                        </button>
                        {v.status === 'CONCLUIDA' && (
                          <button
                            type="button"
                            onClick={() => handleCancelarVenda(v.id)}
                            title="Cancelar venda e estornar estoque"
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4"># Venda</th>
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Vendedor / Operador</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Forma Pagto</th>
                    <th className="py-3 px-4 text-right">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {vendasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        Nenhuma venda encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    vendasFiltradas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          {formatarNumeroVenda(v)}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {formatDateSafe(v.created_at, { includeTime: true })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60">
                            <User size={12} className="text-slate-500" />
                            {v.usuario_nome || `Operador #${v.usuario_id}`}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {v.cliente_nome || 'Consumidor Final'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {v.pagamentos?.map(p => getFormaLabel(p.forma_pagamento)).join(', ') || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatMoney(v.valor_liquido)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            v.status === 'CONCLUIDA'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setVendaDetalhe(v);
                              setIndiceVendaComprovante(vendasFiltradas.findIndex(vf => vf.id === v.id));
                              setComprovanteModalAberto(true);
                            }}
                            title="Visualizar comprovante digital da venda"
                            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[10px] font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Receipt size={11} />
                            <span>Comprovante</span>
                          </button>
                          {v.status === 'CONCLUIDA' && (
                            <button
                              onClick={() => handleCancelarVenda(v.id)}
                              title="Cancelar venda e estornar estoque"
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: VISUALIZAÇÃO DE CANCELAMENTOS DE ORDENS DE SERVIÇO */}
      {abaVisao === 'OS_CANCELADAS' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Ban className="text-rose-600" size={20} />
                <h3 className="font-bold text-slate-900 text-base">Relatório de Cancelamentos de Ordens de Serviço</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Auditoria de ordens canceladas, motivos informados pelos operadores e receita que deixou de ser faturada.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportarCSVCancelamentosOS}
                disabled={!relatorioCancelamentosOS?.ordens?.length}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
              >
                <Download size={15} />
                <span>Exportar Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={carregarCancelamentosOS}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw size={16} className={carregandoCancelamentosOS ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Cards de Métricas */}
          {relatorioCancelamentosOS && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Canceladas</span>
                <span className="text-2xl font-black text-rose-700">{relatorioCancelamentosOS.total_ordens_canceladas} OS</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mão de Obra Cancelada</span>
                <span className="text-2xl font-black text-slate-800">{formatMoney(relatorioCancelamentosOS.total_servicos_cancelados)}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Peças Canceladas</span>
                <span className="text-2xl font-black text-slate-800">{formatMoney(relatorioCancelamentosOS.total_pecas_canceladas)}</span>
              </div>
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-rose-500 block mb-1">Receita Não Faturada</span>
                <span className="text-2xl font-black text-rose-800">{formatMoney(relatorioCancelamentosOS.total_valor_cancelado)}</span>
              </div>
            </div>
          )}

          {/* Tabela de Ordens Canceladas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {carregandoCancelamentosOS ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  Carregando cancelamentos...
                </div>
              ) : !relatorioCancelamentosOS || relatorioCancelamentosOS.ordens.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhuma ordem de serviço cancelada encontrada no histórico.
                </div>
              ) : (
                relatorioCancelamentosOS.ordens.map((o: any) => (
                  <div key={o.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-rose-700 text-sm">#{o.id}</span>
                        <h5 className="font-bold text-slate-800 text-xs mt-0.5">{o.cliente_nome}</h5>
                      </div>
                      <span className="font-black text-slate-900 text-sm shrink-0">
                        {formatMoney(o.valor_total)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-500">
                      <p><span className="text-slate-400">Veículo / Ref:</span> {o.equipamento || o.titulo}</p>
                      <p><span className="text-slate-400">Cancelado em:</span> {formatDateSafe(o.data_cancelamento, { includeTime: true })}</p>
                      <p><span className="text-slate-400">Responsável:</span> {o.usuario_cancelamento_nome || 'Sistema'}</p>
                    </div>

                    {o.motivo_cancelamento && (
                      <p className="text-[11px] bg-rose-50 text-rose-900 border border-rose-100 p-2 rounded-lg">
                        <strong>Motivo:</strong> {o.motivo_cancelamento}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">OS #</th>
                    <th className="py-3 px-4">Data Cancelamento</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Veículo / Equipamento</th>
                    <th className="py-3 px-4">Motivo Informado</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4 text-right">Valor Cancelado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carregandoCancelamentosOS ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw size={16} className="animate-spin inline mr-2" />
                        Carregando cancelamentos...
                      </td>
                    </tr>
                  ) : !relatorioCancelamentosOS || relatorioCancelamentosOS.ordens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhuma ordem de serviço cancelada encontrada no histórico.
                      </td>
                    </tr>
                  ) : (
                    relatorioCancelamentosOS.ordens.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">#{o.id}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatDateSafe(o.data_cancelamento, { includeTime: true })}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{o.cliente_nome}</td>
                        <td className="py-3 px-4 text-slate-600">{o.equipamento || o.titulo}</td>
                        <td className="py-3 px-4">
                          <span className="bg-rose-50 text-rose-900 border border-rose-100 px-2.5 py-1 rounded-lg inline-block text-[11px] font-medium max-w-sm">
                            {o.motivo_cancelamento || 'Sem motivo registrado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{o.usuario_cancelamento_nome || 'Sistema'}</td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                          {formatMoney(o.valor_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Venda com Fechamento ao Clicar Fora */}
      {vendaDetalhe && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setVendaDetalhe(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    Comprovante de Venda {formatarNumeroVenda(vendaDetalhe)}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formatDateSafe(vendaDetalhe.created_at, { includeTime: true })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVendaDetalhe(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Informações de Vendedor e Cliente */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Vendedor Responsável</span>
                <span className="font-bold text-slate-800">
                  {vendaDetalhe.usuario_nome || `Operador #${vendaDetalhe.usuario_id}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Cliente</span>
                <span className="font-bold text-slate-800">
                  {vendaDetalhe.cliente_nome || 'Consumidor Final'}
                </span>
              </div>
            </div>

            {/* Itens da Venda */}
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">Itens da Transação</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                {vendaDetalhe.itens?.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-800">{it.produto_nome || `Produto #${it.produto_id}`}</p>
                      <p className="text-[11px] text-slate-400">
                        {it.quantidade} un x {formatMoney(it.valor_unitario)}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">{formatMoney(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formas de Pagamento e Totais */}
            <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Bruto:</span>
                <span>{formatMoney(vendaDetalhe.valor_bruto)}</span>
              </div>
              {Number(vendaDetalhe.desconto) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto Aplicado:</span>
                  <span>- {formatMoney(vendaDetalhe.desconto)}</span>
                </div>
              )}
              {Number(vendaDetalhe.acrescimo) > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Acréscimo:</span>
                  <span>+ {formatMoney(vendaDetalhe.acrescimo)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                <span>Total Líquido:</span>
                <span className="text-sky-600">{formatMoney(vendaDetalhe.valor_liquido)}</span>
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Pagamento:</span>
                <div className="flex flex-wrap gap-1.5">
                  {vendaDetalhe.pagamentos?.map((p, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-lg text-xs font-semibold">
                      {getFormaLabel(p.forma_pagamento)}: {formatMoney(p.valor)}
                      {p.troco > 0 ? ` (Troco: ${formatMoney(p.troco)})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={() => setVendaDetalhe(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors"
              >
                Fechar Comprovante
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Unificado de Comprovante Digital com Impressão Térmica Direta */}
      <ComprovanteDigitalModal
        isOpen={comprovanteModalAberto}
        onClose={() => setComprovanteModalAberto(false)}
        venda={vendaDetalhe}
        listaVendas={vendasFiltradas}
        indiceInicial={indiceVendaComprovante}
      />
    </div>
  );
};
