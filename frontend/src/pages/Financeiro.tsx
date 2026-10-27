import React, { useState, useEffect } from 'react';
import { 
  Landmark, ArrowDownLeft, ArrowUpRight, Plus, Minus, Download, 
  Wallet, RefreshCw, AlertCircle, CheckCircle2, X, DollarSign,
  Building2, CreditCard, QrCode, TrendingUp, ShieldCheck,
  Paperclip, UploadCloud, Eye, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import { apiService, resolveImageUrl } from '../services/api';
import { StatusFinanceiro, MovimentacaoTesouraria, TipoMovimentacaoTesouraria } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';

export const Financeiro: React.FC = () => {
  const { temaAtual, empresa } = useEmpresa();
  const { toast } = useToast();

  const [status, setStatus] = useState<StatusFinanceiro | null>(null);
  const [extrato, setExtrato] = useState<MovimentacaoTesouraria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');

  // Modais de Aporte e Retirada
  const [modalAporteAberto, setModalAporteAberto] = useState(false);
  const [modalRetiradaAberto, setModalRetiradaAberto] = useState(false);
  const [valorOperacao, setValorOperacao] = useState('');
  const [motivoOperacao, setMotivoOperacao] = useState('');
  const [comprovanteArquivo, setComprovanteArquivo] = useState<File | null>(null);
  const [previewComprovanteModal, setPreviewComprovanteModal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const formatMoney = (val: number = 0) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [st, ex] = await Promise.all([
        apiService.getStatusFinanceiro(),
        apiService.getExtratoTesouraria(filtroTipo !== 'TODOS' ? filtroTipo : undefined)
      ]);
      setStatus(st);
      setExtrato(ex);
    } catch (err: any) {
      console.error('Erro ao carregar módulo financeiro:', err);
      toast.erro(err?.response?.data?.detail || 'Erro ao carregar dados da Tesouraria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroTipo]);

  const handleRealizarAporte = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valorOperacao.replace(',', '.'));
    if (!val || val <= 0) {
      toast.aviso('Informe um valor válido maior que zero.');
      return;
    }

    setEnviando(true);
    try {
      let comprovanteUrl: string | undefined = undefined;
      if (comprovanteArquivo) {
        try {
          const up = await apiService.uploadImagem(comprovanteArquivo);
          comprovanteUrl = up.url || up.data_url;
        } catch (uploadErr) {
          console.warn('Falha ao enviar comprovante ao R2, prosseguindo:', uploadErr);
        }
      }

      await apiService.fazerAporteTesouraria({
        valor: val,
        motivo: motivoOperacao.trim() || 'Aporte de Capital / Entrada no Cofre',
        comprovante_url: comprovanteUrl
      });
      toast.sucesso(`Aporte de ${formatMoney(val)} registrado no Cofre Central!`);
      setModalAporteAberto(false);
      setValorOperacao('');
      setMotivoOperacao('');
      setComprovanteArquivo(null);
      carregarDados();
    } catch (err: any) {
      toast.erro(err?.response?.data?.detail || 'Erro ao realizar aporte.');
    } finally {
      setEnviando(false);
    }
  };

  const handleRealizarRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valorOperacao.replace(',', '.'));
    if (!val || val <= 0) {
      toast.aviso('Informe um valor válido maior que zero.');
      return;
    }

    if (status && val > status.saldo_cofre_central) {
      toast.aviso(`Saldo insuficiente no cofre. Disponível: ${formatMoney(status.saldo_cofre_central)}`);
      return;
    }

    setEnviando(true);
    try {
      let comprovanteUrl: string | undefined = undefined;
      if (comprovanteArquivo) {
        try {
          const up = await apiService.uploadImagem(comprovanteArquivo);
          comprovanteUrl = up.url || up.data_url;
        } catch (uploadErr) {
          console.warn('Falha ao enviar comprovante ao R2, prosseguindo:', uploadErr);
        }
      }

      await apiService.fazerRetiradaTesouraria({
        valor: val,
        motivo: motivoOperacao.trim() || 'Retirada para Depósito Bancário / Despesa',
        comprovante_url: comprovanteUrl
      });
      toast.sucesso(`Retirada de ${formatMoney(val)} registrada com sucesso!`);
      setModalRetiradaAberto(false);
      setValorOperacao('');
      setMotivoOperacao('');
      setComprovanteArquivo(null);
      carregarDados();
    } catch (err: any) {
      toast.erro(err?.response?.data?.detail || 'Erro ao realizar retirada.');
    } finally {
      setEnviando(false);
    }
  };

  const badgeTipo = (tipo: TipoMovimentacaoTesouraria) => {
    switch (tipo) {
      case 'APORTE':
        return { label: 'Aporte no Cofre', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', isEntrada: true };
      case 'RECOLHIMENTO':
        return { label: 'Recolhimento Fechamento', bg: 'bg-teal-50 text-teal-700 border-teal-200', isEntrada: true };
      case 'SANGRIA_CAIXA':
        return { label: 'Sangria de Caixa', bg: 'bg-sky-50 text-sky-700 border-sky-200', isEntrada: true };
      case 'RETIRADA':
        return { label: 'Retirada / Depósito', bg: 'bg-rose-50 text-rose-700 border-rose-200', isEntrada: false };
      case 'LIBERACAO_FUNDO':
        return { label: 'Fundo de Troco', bg: 'bg-amber-50 text-amber-700 border-amber-200', isEntrada: false };
      case 'SUPRIMENTO_CAIXA':
        return { label: 'Suprimento de Caixa', bg: 'bg-purple-50 text-purple-700 border-purple-200', isEntrada: false };
      default:
        return { label: tipo, bg: 'bg-slate-100 text-slate-700 border-slate-200', isEntrada: true };
    }
  };

  const exportarCSV = () => {
    if (!extrato.length) {
      toast.aviso('Nenhuma movimentação para exportar.');
      return;
    }

    let csv = '\uFEFF';
    csv += 'ID;Data;Tipo;Motivo;Operador;Valor (R$);Saldo Anterior (R$);Saldo Resultante (R$)\n';
    extrato.forEach((m) => {
      const dataStr = new Date(m.created_at).toLocaleString('pt-BR');
      const info = badgeTipo(m.tipo);
      const valStr = (info.isEntrada ? m.valor : -m.valor).toFixed(2).replace('.', ',');
      const antStr = m.saldo_anterior.toFixed(2).replace('.', ',');
      const postStr = m.saldo_posterior.toFixed(2).replace('.', ',');
      const motivoStr = (m.motivo || '').replace(/;/g, ' - ');
      csv += `${m.id};${dataStr};${info.label};${motivoStr};${m.usuario_nome || 'Sistema'};${valStr};${antStr};${postStr}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `extrato_tesouraria_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.sucesso('Extrato exportado para Excel com sucesso!');
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Financeiro */}
      <div className={`bg-gradient-to-r ${temaAtual.bgGradiente} rounded-2xl p-4 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🏦</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              Módulo de Tesouraria & Gestão de Recursos
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Gestão Financeira & Cofre Central
          </h2>
          <p className="text-white/90 text-xs sm:text-sm mt-0.5 font-medium">
            Rastreabilidade contábil: origem dos fundos de troco, recolhimento de fechamentos e cofre da empresa.
          </p>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setValorOperacao('');
              setMotivoOperacao('');
              setModalAporteAberto(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
          >
            <Plus size={16} className="text-emerald-600" />
            <span>+ Aporte no Cofre</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setValorOperacao('');
              setMotivoOperacao('');
              setModalRetiradaAberto(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-black/20 hover:bg-black/30 text-white border border-white/20 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
          >
            <Minus size={16} className="text-rose-300" />
            <span>- Retirada / Depósito</span>
          </button>

          <button
            type="button"
            onClick={exportarCSV}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium backdrop-blur-xs transition-colors shadow-xs"
            title="Exportar Extrato em Planilha Excel / CSV"
          >
            <Download size={15} />
            <span>Exportar (.csv)</span>
          </button>
        </div>
      </div>

      {/* Grid de KPIs de Tesouraria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Saldo Cofre Central */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cofre Central (Espécie)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Landmark size={18} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-slate-900 leading-none">
              {formatMoney(status?.saldo_cofre_central)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Disponível para novos caixas</p>
          </div>
        </div>

        {/* Card 2: Saldo Distribuído nas Gavetas */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nas Gavetas de Caixa</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-amber-600 leading-none">
              {formatMoney(status?.saldo_gavetas_ativas)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Em {status?.qtd_caixas_abertos || 0} terminal(is) em atendimento
            </p>
          </div>
        </div>

        {/* Card 3: Saldo Físico Consolidado */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consolidado em Espécie</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-sky-700 leading-none">
              {formatMoney(status?.saldo_consolidado_dinheiro)}
            </span>
            <p className="text-[11px] text-slate-500 mt-1">Total físico (Cofre + Caixas)</p>
          </div>
        </div>

        {/* Card 4: Entradas Eletrônicas Hoje */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Eletrônico Hoje (PIX/Cartão)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-purple-700 leading-none">
              {formatMoney((status?.total_vendas_hoje_pix || 0) + (status?.total_vendas_hoje_cartao || 0))}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
              <span>PIX: <strong>{formatMoney(status?.total_vendas_hoje_pix)}</strong></span>
              <span>•</span>
              <span>Cartão: <strong>{formatMoney(status?.total_vendas_hoje_cartao)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Extrato Cronológico da Tesouraria */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">Auditoria & Extrato do Cofre Central</h3>
              <p className="text-[11px] text-slate-500">Histórico completo de entradas, saídas, fundos e recolhimentos</p>
            </div>
          </div>

          {/* Filtros Rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'APORTE', label: 'Aportes' },
              { id: 'RETIRADA', label: 'Retiradas' },
              { id: 'LIBERACAO_FUNDO', label: 'Fundos de Troco' },
              { id: 'RECOLHIMENTO', label: 'Recolhimentos' },
              { id: 'SUPRIMENTO_CAIXA', label: 'Suprimentos' },
              { id: 'SANGRIA_CAIXA', label: 'Sangrias' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroTipo(f.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                  filtroTipo === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela do Extrato */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Carregando extrato contábil...</div>
        ) : extrato.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Nenhuma movimentação registrada na tesouraria com este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold">
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Operação</th>
                  <th className="py-2.5 px-3">Descrição / Justificativa</th>
                  <th className="py-2.5 px-3 text-center">Comprovante</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3 text-right">Saldo Anterior</th>
                  <th className="py-2.5 px-3 text-right">Saldo no Cofre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extrato.map((m) => {
                  const info = badgeTipo(m.tipo);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${info.bg}`}>
                          {info.isEntrada ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          <span>{info.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        <div>{m.motivo || 'Movimentação sem descrição'}</div>
                        {m.caixa_id && (
                          <span className="text-[10px] text-slate-400 font-mono">Caixa #{m.caixa_id}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {m.comprovante_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewComprovanteModal(resolveImageUrl(m.comprovante_url))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold border border-sky-200 transition-colors cursor-pointer shadow-2xs"
                            title="Visualizar Comprovante / Anexo R2"
                          >
                            <Paperclip size={12} />
                            <span>Ver Anexo</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {m.usuario_nome || 'Sistema'}
                      </td>
                      <td className={`py-3 px-3 text-right font-black whitespace-nowrap ${info.isEntrada ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {info.isEntrada ? '+' : '-'} {formatMoney(m.valor)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {formatMoney(m.saldo_anterior)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatMoney(m.saldo_posterior)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Aporte de Capital no Cofre */}
      {modalAporteAberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setModalAporteAberto(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Aporte de Dinheiro no Cofre</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setModalAporteAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRealizarAporte} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor do Aporte (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={valorOperacao}
                  onChange={(e) => setValorOperacao(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivo / Origem do Dinheiro</label>
                <input
                  type="text"
                  placeholder="Ex: Aporte de capital dos sócios / Saque bancário"
                  value={motivoOperacao}
                  onChange={(e) => setMotivoOperacao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Comprovante / Recibo (Cloudflare R2)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-emerald-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition-colors">
                    <UploadCloud size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-[11px] text-slate-600 truncate">
                      {comprovanteArquivo ? comprovanteArquivo.name : 'Anexar comprovante de aporte (foto/PDF)...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setComprovanteArquivo(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  {comprovanteArquivo && (
                    <button
                      type="button"
                      onClick={() => setComprovanteArquivo(null)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                      title="Remover comprovante"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAporteAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {enviando ? 'Gravando...' : 'Confirmar Aporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Retirada / Depósito Bancário */}
      {modalRetiradaAberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setModalRetiradaAberto(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Minus size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Retirada / Depósito Bancário</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setModalRetiradaAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex justify-between items-center">
              <span>Saldo Disponível no Cofre:</span>
              <strong className="text-slate-900 font-mono text-sm">{formatMoney(status?.saldo_cofre_central)}</strong>
            </div>

            <form onSubmit={handleRealizarRetirada} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor da Retirada (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={status?.saldo_cofre_central}
                  required
                  placeholder="0,00"
                  value={valorOperacao}
                  onChange={(e) => setValorOperacao(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destino / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Depósito na conta bancária da empresa / Pagamento de fornecedor"
                  value={motivoOperacao}
                  onChange={(e) => setMotivoOperacao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Comprovante de Depósito Bancário (Cloudflare R2)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-rose-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition-colors">
                    <UploadCloud size={16} className="text-rose-600 shrink-0" />
                    <span className="text-[11px] text-slate-600 truncate">
                      {comprovanteArquivo ? comprovanteArquivo.name : 'Anexar comprovante / canhoto de depósito...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setComprovanteArquivo(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  {comprovanteArquivo && (
                    <button
                      type="button"
                      onClick={() => setComprovanteArquivo(null)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                      title="Remover comprovante"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalRetiradaAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {enviando ? 'Gravando...' : 'Confirmar Retirada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Visualizador de Comprovante Cloudflare R2 */}
      {previewComprovanteModal && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewComprovanteModal(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Paperclip className="text-sky-600" size={18} />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Comprovante Financeiro (Cloudflare R2)</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewComprovanteModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center gap-1 border border-sky-200"
                  title="Abrir imagem em nova aba"
                >
                  <ExternalLink size={13} />
                  <span>Abrir Original</span>
                </a>
                <button 
                  type="button" 
                  onClick={() => setPreviewComprovanteModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 p-2 rounded-2xl border border-slate-200">
              {previewComprovanteModal.endsWith('.pdf') ? (
                <iframe 
                  src={previewComprovanteModal} 
                  title="Comprovante PDF" 
                  className="w-full h-96 rounded-xl border border-slate-200"
                />
              ) : (
                <img 
                  src={previewComprovanteModal} 
                  alt="Comprovante Anexado" 
                  className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
