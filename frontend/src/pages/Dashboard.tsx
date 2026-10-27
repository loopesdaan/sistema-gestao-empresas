import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { DashboardMetrics } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { 
  DollarSign, ShoppingBag, Wrench, AlertTriangle, 
  TrendingUp, ArrowUpRight, Package, Users, PlusCircle, ShoppingCart, Sparkles, Download, FileText 
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { temaAtual, modulosAtivos, empresa } = useEmpresa();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarMetricas = async () => {
    try {
      const data = await apiService.getDashboard();
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
  }, []);

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const exportarDashboardHTML = () => {
    if (!metrics) return;
    const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Sistema de Gestão';
    const agora = new Date().toLocaleString('pt-BR');
    const dataHoje = new Date().toISOString().split('T')[0];

    const linhasTopProdutos = (metrics.top_produtos || []).map(p => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${p.nome}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${p.total_vendido} un</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">${formatMoney(p.valor_total)}</td>
      </tr>
    `).join('');

    const linhasHistorico = (metrics.vendas_ultimos_dias || []).map(d => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155;">${d.data}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${d.quantidade_vendas} vendas</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0284c7;">${formatMoney(d.total)}</td>
      </tr>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dashboard Executivo - ${nomeEmpresa}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #ffffff; }
    .header { border-bottom: 3px solid #0284c7; padding-bottom: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
    .meta { text-align: right; font-size: 12px; color: #64748b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; }
    .kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 6px; }
    .kpi-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .section-title { font-size: 15px; font-weight: 700; color: #1e293b; margin: 24px 0 12px 0; border-left: 4px solid #0284c7; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
    th { background: #f1f5f9; padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.2cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="badge">${temaAtual.emoji} ${temaAtual.label.toUpperCase()}</span>
      <h1 class="title">${nomeEmpresa}</h1>
      <p class="subtitle">Visão Executiva de Desempenho & Métricas</p>
    </div>
    <div class="meta">
      <p style="margin: 0;"><strong>Data da Emissão:</strong> ${agora}</p>
      <p style="margin: 4px 0 0 0;"><strong>Status da Operação:</strong> Ativa</p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Faturamento Hoje</div>
      <div class="kpi-value" style="color: #059669;">${formatMoney(metrics.faturamento_hoje)}</div>
      <div class="kpi-hint">${metrics.quantidade_vendas_hoje} vendas realizadas hoje</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Faturamento do Mês</div>
      <div class="kpi-value" style="color: #0284c7;">${formatMoney(metrics.faturamento_mes)}</div>
      <div class="kpi-hint">${metrics.quantidade_vendas_mes} vendas no mês</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ordens de Serviço Abertas</div>
      <div class="kpi-value" style="color: #d97706;">${metrics.ordens_servico_abertas}</div>
      <div class="kpi-hint">Em atendimento técnico</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Estoque com Alerta</div>
      <div class="kpi-value" style="color: #e11d48;">${metrics.produtos_estoque_baixo}</div>
      <div class="kpi-hint">Itens atingindo limite mínimo</div>
    </div>
  </div>

  <div class="section-title">Produtos / Serviços Mais Vendidos</div>
  <table>
    <thead>
      <tr>
        <th>Produto / Serviço</th>
        <th style="text-align: center;">Quantidade Vendida</th>
        <th style="text-align: right;">Total Faturado</th>
      </tr>
    </thead>
    <tbody>
      ${linhasTopProdutos.length > 0 ? linhasTopProdutos : '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum produto vendido ainda.</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">Evolução de Vendas (Últimos Dias)</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th style="text-align: center;">Vendas Realizadas</th>
        <th style="text-align: right;">Faturamento do Dia</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHistorico.length > 0 ? linhasHistorico : '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8;">Sem dados históricos recentes.</td></tr>'}
    </tbody>
  </table>

  <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
    Relatório executivo gerado automaticamente pelo Sistema de Gestão Empresarial • ${nomeEmpresa}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dashboard_executivo_${dataHoje}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Temático do Segmento */}
      <div className={`bg-gradient-to-r ${temaAtual.bgGradiente} rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{temaAtual.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              {temaAtual.label}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {empresa.nome_fantasia || 'Painel de Controle Geral'}
          </h2>
          <p className="text-white/90 text-sm mt-0.5 font-medium">
            {temaAtual.destaqueDashboard}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {modulosAtivos.includes('pdv') && (
            <button
              onClick={() => onNavigate('pdv')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-xl text-sm font-semibold shadow-xs transition-colors"
            >
              <ShoppingCart size={16} />
              <span>{temaAtual.terminologia.pdv}</span>
            </button>
          )}
          {modulosAtivos.includes('os') && (
            <button
              onClick={() => onNavigate('os')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-black/20 hover:bg-black/30 text-white px-3.5 py-2 rounded-xl text-sm font-medium border border-white/20 transition-colors"
            >
              <Wrench size={16} />
              <span>{temaAtual.terminologia.servicos}</span>
            </button>
          )}
          <button
            onClick={exportarDashboardHTML}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3.5 py-2 rounded-xl text-sm font-semibold backdrop-blur-xs transition-colors shadow-xs"
            title="Baixar Relatório Executivo do Dashboard em HTML"
          >
            <Download size={16} />
            <span>Exportar Dashboard (HTML)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Faturamento Hoje</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-800">{formatMoney(metrics?.faturamento_hoje)}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-slate-700">{metrics?.quantidade_vendas_hoje || 0}</span> vendas hoje
            </p>
          </div>
        </div>

        {/* Faturamento Mês */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Faturamento no Mês</span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-800">{formatMoney(metrics?.faturamento_mes)}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Ticket Médio: <span className="font-semibold text-slate-700">{formatMoney(metrics?.ticket_medio)}</span>
            </p>
          </div>
        </div>

        {/* OS Abertas ou Clientes Ativos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {modulosAtivos.includes('os') ? temaAtual.terminologia.servicos : temaAtual.terminologia.cliente}
            </span>
            <div className={`w-10 h-10 rounded-xl ${temaAtual.bgSuave} ${temaAtual.textoHighlight} flex items-center justify-center`}>
              {modulosAtivos.includes('os') ? <Wrench size={20} /> : <Users size={20} />}
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-800">
              {modulosAtivos.includes('os') ? (metrics?.ordens_servico_abertas || 0) : (metrics?.quantidade_vendas_hoje || 0)}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
              {modulosAtivos.includes('os') ? 'Atendimentos em andamento' : 'Atendimentos realizados'}
            </p>
          </div>
        </div>

        {/* Estoque Baixo Alerta */}
        <div 
          onClick={() => onNavigate('produtos')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            (metrics?.produtos_estoque_baixo || 0) > 0
              ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Alerta de Estoque</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              (metrics?.produtos_estoque_baixo || 0) > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-bold ${
              (metrics?.produtos_estoque_baixo || 0) > 0 ? 'text-amber-800' : 'text-slate-800'
            }`}>
              {metrics?.produtos_estoque_baixo || 0}
            </h3>
            <p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
              Produtos no nível mínimo ou esgotados
            </p>
          </div>
        </div>
      </div>

      {/* Grid Secundário: Vendas dos Últimos Dias & Top Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Histórico Visual dos Últimos 7 Dias */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Evolução de Vendas (Últimos 7 dias)</h3>
              <p className="text-xs text-slate-500">Faturamento diário registrado no PDV</p>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-2 pt-6">
            {metrics?.vendas_ultimos_dias?.map((dia, idx) => {
              const maxVal = Math.max(...metrics.vendas_ultimos_dias.map(d => Number(d.total)), 100);
              const percent = Math.min(Math.round((Number(dia.total) / maxVal) * 100), 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[11px] font-semibold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatMoney(dia.total)}
                  </span>
                  <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden">
                    <div 
                      style={{ height: `${Math.max(percent, 6)}%` }}
                      className="w-full bg-sky-500 group-hover:bg-sky-600 rounded-t-lg transition-all duration-300"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{dia.data}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Produtos Mais Vendidos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Mais Vendidos</h3>
            <button 
              onClick={() => onNavigate('produtos')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              Ver todos
            </button>
          </div>

          {metrics?.top_produtos && metrics.top_produtos.length > 0 ? (
            <div className="space-y-3.5">
              {metrics.top_produtos.map((prod, index) => (
                <div key={prod.produto_id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-800 truncate">{prod.nome}</p>
                      <p className="text-xs text-slate-400">{prod.total_vendido} un vendidas</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    {formatMoney(prod.valor_total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm">
              Nenhuma venda registrada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

