import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Venda, FormaPagamento } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { 
  BarChart3, Search, Ban, CheckCircle, Calendar, 
  ArrowRight, User, DollarSign, ShoppingCart, TrendingUp, 
  Filter, Eye, X, Receipt, Download, FileText, Printer, Table, Layers, ChevronDown 
} from 'lucide-react';

export const Relatorios: React.FC = () => {
  const { empresa } = useEmpresa();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

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

  useEffect(() => {
    carregarVendas();
  }, []);

  const handleCancelarVenda = async (id: number) => {
    if (!window.confirm(`Deseja realmente cancelar a venda #${id}? Os itens retornarão automaticamente ao estoque.`)) return;

    try {
      await apiService.cancelarVenda(id, 'Cancelado pelo operador no painel de relatórios');
      carregarVendas();
      if (vendaDetalhe?.id === id) {
        setVendaDetalhe(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao cancelar venda');
    }
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
  }, [vendas, busca, filtroVendedor, filtroStatus]);

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

  // Gerador de Documento HTML Executivo
  const gerarConteudoHTML = () => {
    const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Sistema de Gestão';
    const agora = new Date().toLocaleString('pt-BR');

    const linhasTabela = vendasFiltradas.map(v => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #334155;">#${v.id}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${new Date(v.created_at).toLocaleString('pt-BR')}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${v.usuario_nome || `Operador #${v.usuario_id}`}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155;">${v.cliente_nome || 'Consumidor Final'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatMoney(v.valor_bruto)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #e11d48;">${v.desconto > 0 ? `-${formatMoney(v.desconto)}` : '-'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">${formatMoney(v.valor_liquido)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #0284c7; font-weight: 500;">${v.pagamentos.map(p => getFormaLabel(p.forma_pagamento)).join(', ') || 'Dinheiro'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; ${v.status === 'CONCLUIDA' ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
            ${v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
          </span>
        </td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Vendas - ${nomeEmpresa}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #ffffff; }
    .header { border-bottom: 3px solid #0284c7; padding-bottom: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .meta { text-align: right; font-size: 12px; color: #64748b; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .card-val { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; letter-spacing: 0.5px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 1.2cm; size: landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${nomeEmpresa}</h1>
      <p class="subtitle">Relatório Executivo de Vendas & Faturamento</p>
    </div>
    <div class="meta">
      <p style="margin: 0;"><strong>Emissão:</strong> ${agora}</p>
      <p style="margin: 4px 0 0 0;"><strong>Total de Vendas Listadas:</strong> ${vendasFiltradas.length}</p>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Faturamento Líquido</div>
      <div class="card-val" style="color: #059669;">${formatMoney(metricas.faturamentoTotal)}</div>
    </div>
    <div class="card">
      <div class="card-label">Vendas Concluídas</div>
      <div class="card-val" style="color: #0284c7;">${metricas.totalVendas}</div>
    </div>
    <div class="card">
      <div class="card-label">Ticket Médio</div>
      <div class="card-val" style="color: #6366f1;">${formatMoney(metricas.ticketMedio)}</div>
    </div>
    <div class="card">
      <div class="card-label">Vendedor Destaque</div>
      <div class="card-val" style="font-size: 14px; margin-top: 10px; color: #d97706;">${metricas.topVendedor}</div>
    </div>
  </div>

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

  <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
    Relatório gerado automaticamente pelo Sistema de Gestão Empresarial • ${nomeEmpresa}
  </div>
</body>
</html>`;
  };

  // 1. Exportação em Excel (CSV formatado com separador ponto-e-vírgula e UTF-8 BOM)
  const exportarExcel = () => {
    const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Empresa';
    const dataHoje = new Date().toISOString().split('T')[0];

    let csv = `RELATÓRIO DE VENDAS - ${nomeEmpresa.toUpperCase()}\r\n`;
    csv += `Data de Emissão:;${new Date().toLocaleString('pt-BR')}\r\n`;
    csv += `Faturamento Líquido:;${formatMoney(metricas.faturamentoTotal)}\r\n`;
    csv += `Qtd de Vendas Concluídas:;${metricas.totalVendas}\r\n`;
    csv += `Ticket Médio:;${formatMoney(metricas.ticketMedio)}\r\n`;
    csv += `Vendedor Destaque:;${metricas.topVendedor}\r\n\r\n`;

    csv += `ID da Venda;Data / Hora;Vendedor / Operador;Cliente;Valor Bruto (R$);Desconto (R$);Valor Líquido (R$);Formas de Pagamento;Status\r\n`;

    vendasFiltradas.forEach(v => {
      const dataHora = new Date(v.created_at).toLocaleString('pt-BR');
      const vendedor = (v.usuario_nome || `Operador #${v.usuario_id}`).replace(/;/g, ',');
      const cliente = (v.cliente_nome || 'Consumidor Final').replace(/;/g, ',');
      const pgtos = v.pagamentos.map(p => getFormaLabel(p.forma_pagamento)).join(' + ');
      const status = v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada';

      csv += `${v.id};${dataHora};${vendedor};${cliente};${Number(v.valor_bruto).toFixed(2).replace('.', ',')};${Number(v.desconto).toFixed(2).replace('.', ',')};${Number(v.valor_liquido).toFixed(2).replace('.', ',')};${pgtos};${status}\r\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_vendas_${dataHoje}.csv`);
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
    link.setAttribute('download', `relatorio_vendas_${dataHoje}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 3. Exportação em PDF (Janela de impressão nativa para Salvar como PDF)
  const exportarPDF = () => {
    const conteudo = gerarConteudoHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(conteudo);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
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
          <h2 className="text-xl font-bold text-slate-800">Relatório de Vendas Realizadas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico completo com identificação do vendedor/operador, formas de pagamento e auditoria.
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
              <span>Exportar Tudo (Excel + PDF + HTML)</span>
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

      {/* Cartões de Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Líquido</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign size={16} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900">{formatMoney(metricas.faturamentoTotal)}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Total das vendas filtradas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Qtd. de Vendas</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <ShoppingCart size={16} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-900">{metricas.totalVendas} concluídas</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Volume de transações</p>
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
            <span className="text-xs font-semibold uppercase tracking-wider">Vendedor Destaque</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <User size={16} />
            </div>
          </div>
          <h3 className="text-xs font-bold text-slate-900 truncate" title={metricas.topVendedor}>
            {metricas.topVendedor}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Maior faturamento no filtro</p>
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
            placeholder="Buscar por #ID, cliente ou vendedor..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro de Vendedor */}
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
        <div className="overflow-x-auto">
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
                    <td className="py-3 px-4 font-bold text-slate-900">
                      #{v.id}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(v.created_at).toLocaleString('pt-BR')}
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
                        onClick={() => setVendaDetalhe(v)}
                        title="Ver detalhes da venda"
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold transition-colors"
                      >
                        Ver Detalhes
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

      {/* Modal de Detalhes da Venda */}
      {vendaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    Comprovante de Venda #{vendaDetalhe.id}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(vendaDetalhe.created_at).toLocaleString('pt-BR')}
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
    </div>
  );
};
