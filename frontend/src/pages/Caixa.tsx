import React, { useState, useEffect, useMemo } from 'react';
import { apiService, resolveImageUrl } from '../services/api';
import { Caixa as CaixaType, ResumoCaixa, Venda } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useToast } from '../contexts/ToastContext';
import { ComprovanteDigitalModal } from '../components/ComprovanteDigitalModal';
import { formatarNumeroCaixa, formatarNumeroVenda, formatDateSafe } from '../utils/formatters';
import { 
  Wallet, ArrowDownCircle, ArrowUpCircle, Lock, 
  CheckCircle2, AlertCircle, Clock, Calendar, DollarSign, Users, Eye, X,
  History, FileCheck, ShieldAlert, AlertTriangle, Search, Scale, Send, Sparkles, Receipt, RefreshCw, Check, Shield
} from 'lucide-react';

interface CaixaProps {
  isAdmin?: boolean;
}

export const Caixa: React.FC<CaixaProps> = ({ isAdmin = false }) => {
  const { temaAtual } = useEmpresa();
  const { toast, confirmar } = useToast();
  const [caixaAtual, setCaixaAtual] = useState<CaixaType | null>(null);
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [loading, setLoading] = useState(true);

  // Modo de visualização: 'MEU_CAIXA' | 'TODOS_CAIXAS' | 'HISTORICO_FECHADOS' | 'MONITOR'
  const [abaAtiva, setAbaAtiva] = useState<'MEU_CAIXA' | 'TODOS_CAIXAS' | 'HISTORICO_FECHADOS' | 'MONITOR'>('MEU_CAIXA');
  const [caixasAbertosEquipe, setCaixasAbertosEquipe] = useState<CaixaType[]>([]);
  const [caixasFechados, setCaixasFechados] = useState<CaixaType[]>([]);
  const [buscaFechados, setBuscaFechados] = useState('');
  const [resumoInspecionado, setResumoInspecionado] = useState<ResumoCaixa | null>(null);
  const [loadingInspecaoId, setLoadingInspecaoId] = useState<number | null>(null);
  const [monitorDados, setMonitorDados] = useState<any>(null);
  const [ticketsPendentes, setTicketsPendentes] = useState<any[]>([]);

  // Modal Comprovante Digital
  const [comprovanteModal, setComprovanteModal] = useState<{
    aberto: boolean;
    vendas: Venda[];
    indice: number;
  }>({
    aberto: false,
    vendas: [],
    indice: 0
  });

  // Modal Solicitar Ticket (Suprimento / Sangria)
  const [modalTicket, setModalTicket] = useState<{
    aberto: boolean;
    tipo: 'SUPRIMENTO' | 'SANGRIA' | 'SANGRIA_CEGA';
    valor: number;
    motivo: string;
  }>({
    aberto: false,
    tipo: 'SUPRIMENTO',
    valor: 50,
    motivo: ''
  });

  // Modal Aprovar Ticket de Caixa (Substitui prompt nativo do navegador)
  const [modalAprovarTicket, setModalAprovarTicket] = useState<{
    ticketId: number;
    caixaId: number;
    tipo: string;
    valor: string;
    usuarioNome: string;
    motivo?: string;
  } | null>(null);

  const caixasFechadosFiltrados = useMemo(() => {
    return caixasFechados.filter((c) => {
      const q = buscaFechados.toLowerCase();
      const op = (c.usuario_nome || '').toLowerCase();
      const id = String(c.id);
      return op.includes(q) || id.includes(q);
    });
  }, [caixasFechados, buscaFechados]);

  // Form states
  const [modalAbertura, setModalAbertura] = useState(false);
  const [modalMov, setModalMov] = useState<'SANGRIA' | 'SUPRIMENTO' | null>(null);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [valorMov, setValorMov] = useState<number>(0);
  const [motivoMov, setMotivoMov] = useState('');
  const [saldoFechamentoInformado, setSaldoFechamentoInformado] = useState<number>(0);

  const carregarCaixa = async () => {
    setLoading(true);
    try {
      const [c, fechados] = await Promise.all([
        apiService.getCaixaAtual().catch(() => null),
        apiService.getHistoricoCaixa('FECHADO').catch(() => [])
      ]);
      setCaixaAtual(c);
      setCaixasFechados(fechados);

      if (c) {
        // Busca o resumo pelo endpoint dedicado atual (sem depender de ID) e com fallback por ID
        let r = await apiService.getResumoCaixaAtual().catch(() => null);
        if (!r && c.id) {
          r = await apiService.getResumoCaixa(c.id).catch(() => null);
        }
        setResumo(r);
        if (r) {
          setSaldoFechamentoInformado(Number(r.saldo_esperado_dinheiro) || 0);
        } else {
          setSaldoFechamentoInformado(Number(c.saldo_inicial) || 0);
        }
      } else {
        setResumo(null);
      }

      if (isAdmin) {
        const [abertos, monitor, tickets] = await Promise.all([
          apiService.getCaixasAbertos().catch(() => []),
          apiService.getMonitorCaixas().catch(() => null),
          apiService.getTicketsPendentes().catch(() => [])
        ]);
        setCaixasAbertosEquipe(abertos);
        setMonitorDados(monitor);
        setTicketsPendentes(tickets);
      }
    } catch (err) {
      console.error('Erro ao carregar caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCaixa();
  }, [isAdmin]);

  const handleAbrirComprovantesCaixa = async (caixaId: number) => {
    try {
      const todas = await apiService.listarVendas();
      const vendasDesteCaixa = todas.filter((v: Venda) => v.caixa_id === caixaId);
      if (vendasDesteCaixa.length === 0) {
        toast.aviso('Nenhuma venda registrada neste turno de caixa.');
        return;
      }
      setComprovanteModal({
        aberto: true,
        vendas: vendasDesteCaixa,
        indice: 0
      });
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao carregar comprovantes do caixa.');
    }
  };

  const handleEnviarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caixaAtual) return;
    try {
      await apiService.solicitarTicketCaixa(caixaAtual.id, {
        tipo: modalTicket.tipo,
        valor: modalTicket.tipo === 'SANGRIA_CEGA' ? undefined : modalTicket.valor,
        justificativa: modalTicket.motivo
      });
      toast.sucesso('Solicitação enviada com sucesso para o Administrador!');
      setModalTicket(prev => ({ ...prev, aberto: false, motivo: '' }));
      carregarCaixa();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao solicitar ticket');
    }
  };

  const handleResponderTicket = async (ticketId: number, aprovado: boolean, valorEfetivo?: number) => {
    try {
      await apiService.responderTicketCaixa(ticketId, aprovado, valorEfetivo);
      toast.sucesso(aprovado ? 'Solicitação autorizada e movimentação gerada!' : 'Solicitação rejeitada.');
      carregarCaixa();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao responder ticket');
    }
  };

  const handleInspecionarCaixa = async (caixaId: number) => {
    if (!caixaId) return;
    setLoadingInspecaoId(caixaId);
    try {
      const r = await apiService.getResumoCaixa(caixaId);
      if (!r) {
        toast.erro('Não foi possível obter o resumo financeiro deste caixa.');
        return;
      }
      // Normalização ultra-resiliente (trata tanto ResumoCaixa aninhado quanto Caixa plano)
      const caixaObj: CaixaType = (r.caixa ? r.caixa : r) as CaixaType;
      const resumoNormalizado: ResumoCaixa = {
        caixa: caixaObj,
        saldo_inicial: Number(r.saldo_inicial ?? caixaObj?.saldo_inicial ?? 0),
        saldo_esperado_dinheiro: Number(
          r.saldo_esperado_dinheiro ?? caixaObj?.saldo_final_calculado ?? caixaObj?.saldo_inicial ?? 0
        ),
        total_vendas_dinheiro: Number(r.total_vendas_dinheiro ?? 0),
        total_vendas_pix: Number(r.total_vendas_pix ?? 0),
        total_vendas_cartao_credito: Number(r.total_vendas_cartao_credito ?? 0),
        total_vendas_cartao_debito: Number(r.total_vendas_cartao_debito ?? 0),
        total_vendas_a_prazo: Number(r.total_vendas_a_prazo ?? 0),
        total_suprimentos: Number(r.total_suprimentos ?? 0),
        total_sangrias: Number(r.total_sangrias ?? 0),
        diferenca: r.diferenca !== undefined 
          ? Number(r.diferenca) 
          : (caixaObj?.diferenca !== undefined ? Number(caixaObj.diferenca) : undefined),
        quantidade_vendas: Number(r.quantidade_vendas ?? 0)
      };
      setResumoInspecionado(resumoNormalizado);
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao inspecionar resumo do caixa');
    } finally {
      setLoadingInspecaoId(null);
    }
  };

  const handleAbrir = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.abrirCaixa(saldoInicial);
      setModalAbertura(false);
      toast.sucesso('Caixa aberto com sucesso!');
      carregarCaixa();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao abrir caixa');
    }
  };

  const handleMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.aviso('Apenas Administradores podem registrar movimentações avulsas diretamente. Colaboradores devem solicitar via ticket.');
      setModalMov(null);
      return;
    }
    if (!modalMov || valorMov <= 0) return;
    try {
      await apiService.movimentarCaixa(modalMov, valorMov, motivoMov, caixaAtual?.id);
      toast.sucesso(`Movimentação de ${modalMov} registrada no caixa!`);
      setModalMov(null);
      setValorMov(0);
      setMotivoMov('');
      carregarCaixa();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao lançar movimentação');
    }
  };

  const handleFechar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caixaAtual) return;
    try {
      await apiService.fecharCaixa(caixaAtual.id, saldoFechamentoInformado);
      setModalFechamento(false);
      toast.sucesso('Turno de caixa fechado com sucesso!');
      carregarCaixa();
    } catch (err: any) {
      toast.erro(err.response?.data?.detail || 'Erro ao fechar caixa');
    }
  };

  const formatMoney = (val: any = 0) => {
    const num = Number(val);
    return (isNaN(num) ? 0 : num).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const safeFormatDate = (dateVal?: string | Date | null, timeOnly: boolean = false) => {
    if (!dateVal) return '-';
    try {
      const str = String(dateVal);
      const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
      if (isNaN(d.getTime())) return '-';
      return timeOnly
        ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  const usuarioSalvo = localStorage.getItem('gestao_user') || sessionStorage.getItem('gestao_user');
  const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
  const isEstoquista = usuarioLogado?.perfil === 'ESTOQUISTA';

  if (isEstoquista) {
    return (
      <div className="min-h-[450px] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center border border-slate-200 shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Acesso Restrito ao Caixa</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            O perfil <strong>Controlador de Estoque</strong> atua exclusivamente na gestão de mercadorias, movimentações e auditoria de inventário, não operando terminais de caixa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Abas de Navegação do Caixa */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/60 rounded-xl w-fit text-xs font-semibold">
        <button
          onClick={() => setAbaAtiva('MEU_CAIXA')}
          className={`px-3.5 py-1.5 rounded-lg transition-all ${
            abaAtiva === 'MEU_CAIXA' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Meu Caixa Pessoal
        </button>

        {isAdmin && (
          <button
            onClick={() => setAbaAtiva('TODOS_CAIXAS')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              abaAtiva === 'TODOS_CAIXAS' ? 'bg-white text-purple-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={14} className="text-purple-600" />
            <span>Caixas da Equipe ({caixasAbertosEquipe.length})</span>
          </button>
        )}

        <button
          onClick={() => setAbaAtiva('HISTORICO_FECHADOS')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            abaAtiva === 'HISTORICO_FECHADOS' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History size={14} className="text-indigo-600" />
          <span>{isAdmin ? 'Auditoria Geral de Fechados' : 'Meus Caixas Fechados'} ({caixasFechados.length})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setAbaAtiva('MONITOR')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              abaAtiva === 'MONITOR' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield size={14} className="text-emerald-600" />
            <span>Monitor Tempo Real & Tickets</span>
            {ticketsPendentes.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {ticketsPendentes.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ABA: Visão de Todos os Caixas da Equipe (Admin) */}
      {isAdmin && abaAtiva === 'TODOS_CAIXAS' ? (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-800 text-base mb-1">Caixas Ativos dos Funcionários</h3>
            <p className="text-xs text-slate-500">
              Acompanhamento em tempo real de quem abriu caixa hoje, horários e faturamento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {caixasAbertosEquipe.length === 0 ? (
              <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Nenhum funcionário com caixa aberto no momento.
              </div>
            ) : (
              caixasAbertosEquipe.map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400">Caixa #{formatarNumeroCaixa(c.id)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Em Operação
                      </span>
                    </div>

                    {/* Dono / Proprietário do Caixa */}
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 my-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {c.usuario_foto ? (
                          <img src={resolveImageUrl(c.usuario_foto)} alt={c.usuario_nome || 'Operador'} className="w-full h-full object-cover" />
                        ) : (
                          (c.usuario_nome || 'O').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{c.usuario_nome || `Operador #${c.usuario_id}`}</h4>
                        {c.usuario_email && (
                          <p className="text-[11px] text-slate-500 truncate">{c.usuario_email}</p>
                        )}
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700">
                          {c.usuario_perfil === 'ADMIN' ? 'Administrador' : 'Operador de Caixa'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <Clock size={12} />
                      Aberto em {safeFormatDate(c.data_abertura)}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Fundo de Troco Inicial:</span>
                        <span className="font-semibold text-slate-800">{formatMoney(c.saldo_inicial)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      disabled={loadingInspecaoId === c.id}
                      onClick={() => handleInspecionarCaixa(c.id)}
                      className="w-full py-2 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 text-purple-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {loadingInspecaoId === c.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Eye size={14} />
                      )}
                      <span>Inspecionar Faturamento & Dinheiro</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : abaAtiva === 'HISTORICO_FECHADOS' ? (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-indigo-600" size={20} />
                <h3 className="font-bold text-slate-800 text-base">Auditoria & Quebra de Caixas Fechados</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Rastreamento completo de todos os caixas encerrados: confira saldos calculados pelo sistema vs valores físicos declarados e identifique faltas de dinheiro (quebra de caixa).
              </p>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por operador ou nº do caixa..."
                value={buscaFechados}
                onChange={(e) => setBuscaFechados(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Cards Indicadores de Auditoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Caixas Auditados</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{caixasFechados.length}</p>
              <span className="text-[10px] text-slate-400">Total de turnos encerrados</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-600 uppercase">Caixas com Quebra</span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {caixasFechados.filter(c => (c.diferenca !== undefined && Number(c.diferenca) < -0.01)).length}
              </p>
              <span className="text-[10px] text-rose-500">Valor entregue menor que calculado</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-600 uppercase">Total em Quebras Acumuladas</span>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {formatMoney(
                  caixasFechados.reduce((acc, c) => acc + (c.diferenca && Number(c.diferenca) < -0.01 ? Math.abs(Number(c.diferenca)) : 0), 0)
                )}
              </p>
              <span className="text-[10px] text-amber-500">Falta total registrada</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase">Total Dinheiro Recolhido</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {formatMoney(
                  caixasFechados.reduce((acc, c) => acc + Number(c.saldo_final_informado || 0), 0)
                )}
              </p>
              <span className="text-[10px] text-emerald-500">Entregue pelos operadores</span>
            </div>
          </div>

          {/* Tabela e Cartões de Auditoria */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {caixasFechadosFiltrados.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhum caixa fechado encontrado.
                </div>
              ) : (
                caixasFechadosFiltrados.map((c) => {
                  const dif = Number(c.diferenca ?? ((c.saldo_final_informado || 0) - (c.saldo_final_calculado || 0)));
                  const temQuebra = dif < -0.01;
                  const temSobra = dif > 0.01;

                  return (
                    <div key={c.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900 text-sm">#{formatarNumeroCaixa(c.id)}</span>
                          <h4 className="font-semibold text-slate-800 text-xs mt-0.5">
                            {c.usuario_nome || `Operador #${c.usuario_id}`}
                          </h4>
                        </div>

                        {temQuebra ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                            <AlertTriangle size={12} />
                            Falta {formatMoney(Math.abs(dif))}
                          </span>
                        ) : temSobra ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200 shrink-0">
                            Sobra +{formatMoney(dif)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                            <CheckCircle2 size={12} />
                            Bateu 100%
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Fundo Inicial</span>
                          <span className="font-semibold text-slate-700">{formatMoney(c.saldo_inicial)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Saldo Calculado</span>
                          <span className="font-semibold text-slate-700">{formatMoney(c.saldo_final_calculado ?? 0)}</span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-medium">Saldo Entregue (Declarado):</span>
                          <span className="font-black text-slate-900 text-sm">{formatMoney(c.saldo_final_informado ?? 0)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                        <span className="truncate">
                          {safeFormatDate(c.data_abertura)} • {c.data_fechamento ? safeFormatDate(c.data_fechamento, true) : 'Encerrado'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={loadingInspecaoId === c.id}
                            onClick={() => handleInspecionarCaixa(c.id)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
                            title="Ver resumo financeiro"
                          >
                            {loadingInspecaoId === c.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Eye size={12} />
                            )}
                            <span>Resumo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirComprovantesCaixa(c.id)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
                            title="Auditar todos os comprovantes"
                          >
                            <Receipt size={12} />
                            <span>Comprovantes</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4"># Caixa</th>
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Abertura / Fechamento</th>
                    <th className="py-3 px-4 text-right">Fundo Inicial</th>
                    <th className="py-3 px-4 text-right">Saldo Calculado (Sistema)</th>
                    <th className="py-3 px-4 text-right">Saldo Declarado (Entregue)</th>
                    <th className="py-3 px-4 text-center">Auditoria / Quebra</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {caixasFechadosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum caixa fechado encontrado.
                      </td>
                    </tr>
                  ) : (
                    caixasFechadosFiltrados.map((c) => {
                      const dif = Number(c.diferenca ?? ((c.saldo_final_informado || 0) - (c.saldo_final_calculado || 0)));
                      const temQuebra = dif < -0.01;
                      const temSobra = dif > 0.01;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-600">#{formatarNumeroCaixa(c.id)}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {c.usuario_nome || `Operador #${c.usuario_id}`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            <div>{safeFormatDate(c.data_abertura)}</div>
                            <div className="text-[10px] text-slate-400">
                              até {c.data_fechamento ? safeFormatDate(c.data_fechamento) : 'Fechamento'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                            {formatMoney(c.saldo_inicial)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                            {formatMoney(c.saldo_final_calculado ?? 0)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatMoney(c.saldo_final_informado ?? 0)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {temQuebra ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <AlertTriangle size={12} />
                                Falta {formatMoney(Math.abs(dif))}
                              </span>
                            ) : temSobra ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                                Sobra +{formatMoney(dif)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} />
                                Bateu 100%
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={loadingInspecaoId === c.id}
                                onClick={() => handleInspecionarCaixa(c.id)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
                                title="Ver resumo financeiro"
                              >
                                {loadingInspecaoId === c.id ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <Eye size={12} />
                                )}
                                <span>Resumo</span>
                              </button>
                              <button
                                onClick={() => handleAbrirComprovantesCaixa(c.id)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1"
                                title="Auditar todos os comprovantes"
                              >
                                <Receipt size={12} />
                                <span>Comprovantes</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : isAdmin && abaAtiva === 'MONITOR' ? (
        /* ABA: MONITOR DE CAIXAS EM TEMPO REAL & TICKETS (ADMIN) */
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Shield className="text-emerald-600" size={20} />
                <span>Painel de Governança dos Caixas em Tempo Real</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Monitore em tempo real o saldo físico em gaveta, tempo de operação, alertas de sangria forçada e aprove solicitações de troco.
              </p>
            </div>
            <button
              onClick={carregarCaixa}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} />
              <span>Atualizar Monitor</span>
            </button>
          </div>

          {/* Cards de Monitoramento */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Caixas Operando</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {monitorDados?.total_operando ?? caixasAbertosEquipe.length}
              </p>
              <span className="text-[10px] text-slate-500">Terminais ativos neste momento</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Caixas Disponíveis</span>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {monitorDados?.caixas_disponiveis_estimados ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">Terminais livres para abertura</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tickets Pendentes</span>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {ticketsPendentes.length}
              </p>
              <span className="text-[10px] text-amber-600">Aguardando aprovação do ADM</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Fechamento Pendente</span>
              <p className="text-2xl font-black text-purple-600 mt-1">
                {monitorDados?.total_pendentes_aprovacao ?? 0}
              </p>
              <span className="text-[10px] text-slate-500">Homologação de encerramento</span>
            </div>
          </div>

          {/* Alertas de Gaveta e Caixas Ativos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-800 text-sm">Status das Gavetas em Dinheiro</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {!(monitorDados?.caixas_operando?.length > 0) ? (
                <div className="col-span-full p-8 text-center text-slate-400 text-xs">
                  Nenhum terminal de caixa em operação no momento.
                </div>
              ) : (
                monitorDados.caixas_operando.map((op: any) => {
                  const perc = Math.min(100, (op.saldo_dinheiro / (op.limite_gaveta || 1000)) * 100);
                  const excedeu = op.alerta_limite_excedido;
                  return (
                    <div key={op.caixa_id} className={`p-4 rounded-2xl border transition-all ${
                      excedeu ? 'border-rose-300 bg-rose-50/50 ring-2 ring-rose-200' : 'border-slate-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          Terminal #{op.caixa_id}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock size={12} /> {op.tempo_aberto_formatado}
                        </span>
                      </div>

                      {/* Dono / Proprietário da Conta */}
                      <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {op.usuario_foto ? (
                            <img src={resolveImageUrl(op.usuario_foto)} alt={op.usuario_nome || 'Operador'} className="w-full h-full object-cover" />
                          ) : (
                            (op.usuario_nome || 'O').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs truncate leading-tight">{op.usuario_nome}</p>
                          {op.usuario_email && (
                            <p className="text-[10px] text-slate-400 truncate">{op.usuario_email}</p>
                          )}
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600">
                            {op.usuario_perfil === 'ADMIN' ? 'Administrador' : 'Operador'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 my-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Dinheiro Físico:</span>
                          <span className="font-bold text-slate-900">{formatMoney(op.saldo_dinheiro)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Limite Seguro:</span>
                          <span>{formatMoney(op.limite_gaveta)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              excedeu ? 'bg-rose-500' : perc > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${perc}%` }}
                          />
                        </div>
                      </div>

                      {excedeu && (
                        <div className="p-2 rounded-xl bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 mb-2">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>EXCEDEU LIMITE: SANGRIA RECOMENDADA</span>
                        </div>
                      )}

                      <button
                        disabled={loadingInspecaoId === op.caixa_id}
                        onClick={() => handleInspecionarCaixa(op.caixa_id)}
                        className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {loadingInspecaoId === op.caixa_id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : null}
                        <span>Inspecionar Detalhes</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Tickets de Solicitação de Suprimento / Sangria */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-800 text-sm">Tickets de Solicitação (Suprimento / Sangria)</h4>

            {/* Visualização em Cartões para Mobile (elimina rolagem lateral) */}
            <div className="md:hidden divide-y divide-slate-100">
              {ticketsPendentes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Nenhum ticket de caixa pendente de aprovação.
                </div>
              ) : (
                ticketsPendentes.map((t) => (
                  <div key={t.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 font-mono text-sm">#{formatarNumeroCaixa(t.id)}</span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateSafe(t.created_at, { timeOnly: true })}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                          {t.usuario_nome || `Usuário #${t.usuario_id}`} (Caixa #{formatarNumeroCaixa(t.caixa_id)})
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        t.tipo === 'SUPRIMENTO' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : t.tipo === 'SANGRIA_CEGA'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.tipo.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400">Valor Solicitado:</span>
                      <span className="font-black font-mono text-slate-900">
                        {t.valor_solicitado ? formatMoney(t.valor_solicitado) : 'Valor Cego (ADM define)'}
                      </span>
                    </div>

                    {t.motivo && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                        "{t.motivo}"
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          confirmar({
                            titulo: 'Recusar Chamado de Caixa',
                            mensagem: `Deseja realmente recusar o pedido de ${t.tipo.replace('_', ' ')} do colaborador ${t.usuario_nome || 'Operador'}?`,
                            tipo: 'aviso',
                            textoConfirmar: 'Sim, Recusar',
                            onConfirmar: () => handleResponderTicket(t.id, false)
                          });
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalAprovarTicket({
                            ticketId: t.id,
                            caixaId: t.caixa_id,
                            tipo: t.tipo,
                            valor: t.valor_solicitado ? String(t.valor_solicitado) : '50.00',
                            usuarioNome: t.usuario_nome || `Operador #${t.usuario_id}`,
                            motivo: t.motivo || ''
                          });
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        Aprovar Ticket
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Tabela para Tablet e Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID / Data</th>
                    <th className="p-3">Operador / Caixa</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Valor Solicitado</th>
                    <th className="p-3">Justificativa</th>
                    <th className="p-3 text-right">Ação do Administrador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ticketsPendentes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Nenhum ticket de caixa pendente de aprovação.
                      </td>
                    </tr>
                  ) : (
                    ticketsPendentes.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono">
                          <span className="font-bold text-slate-900">#{formatarNumeroCaixa(t.id)}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {formatDateSafe(t.created_at, { timeOnly: true })}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {t.usuario_nome || `Usuário #${t.usuario_id}`} (Caixa #{formatarNumeroCaixa(t.caixa_id)})
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.tipo === 'SUPRIMENTO' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : t.tipo === 'SANGRIA_CEGA'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.tipo.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-bold font-mono">
                          {t.valor_solicitado ? formatMoney(t.valor_solicitado) : 'Valor Cego (ADM define)'}
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs truncate">{t.motivo || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                confirmar({
                                  titulo: 'Recusar Chamado de Caixa',
                                  mensagem: `Deseja realmente recusar o pedido de ${t.tipo.replace('_', ' ')} do colaborador ${t.usuario_nome || 'Operador'}?`,
                                  tipo: 'aviso',
                                  textoConfirmar: 'Sim, Recusar',
                                  onConfirmar: () => handleResponderTicket(t.id, false)
                                });
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModalAprovarTicket({
                                  ticketId: t.id,
                                  caixaId: t.caixa_id,
                                  tipo: t.tipo,
                                  valor: t.valor_solicitado ? String(t.valor_solicitado) : '50.00',
                                  usuarioNome: t.usuario_nome || `Operador #${t.usuario_id}`,
                                  motivo: t.motivo || ''
                                });
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                            >
                              Aprovar & Gerar
                            </button>
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
      ) : (
        /* ABA: Meu Caixa Operacional */
        <>
          {/* Top Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                caixaAtual ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}>
                <Wallet size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">Sessão de Caixa Pessoal</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    caixaAtual ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {caixaAtual ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {caixaAtual 
                    ? `Aberto em ${formatDateSafe(caixaAtual.data_abertura, { includeTime: true })}`
                    : 'Nenhum caixa aberto para você neste momento.'}
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-wrap items-center gap-2">
              {!caixaAtual ? (
                <button
                  onClick={() => setModalAbertura(true)}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-xs transition-colors"
                >
                  <Wallet size={16} />
                  <span>Abrir Meu Caixa</span>
                </button>
              ) : (
                <>
                  {isAdmin ? (
                    <>
                      <button
                        onClick={() => setModalMov('SUPRIMENTO')}
                        className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                        title="Registrar entrada imediata de dinheiro (Apenas Administrador)"
                      >
                        <ArrowDownCircle size={16} />
                        <span>+ Suprimento</span>
                      </button>
                      <button
                        onClick={() => setModalMov('SANGRIA')}
                        className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                        title="Registrar retirada imediata de dinheiro (Apenas Administrador)"
                      >
                        <ArrowUpCircle size={16} />
                        <span>- Sangria</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setModalTicket({ aberto: true, tipo: 'SUPRIMENTO', valor: 50, motivo: '' })}
                        className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                        title="Solicitar reforço de troco para aprovação do Administrador"
                      >
                        <ArrowDownCircle size={16} />
                        <span>Solicitar Entrada (+ Troco)</span>
                      </button>
                      <button
                        onClick={() => setModalTicket({ aberto: true, tipo: 'SANGRIA', valor: 100, motivo: '' })}
                        className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                        title="Solicitar sangria para aprovação do Administrador"
                      >
                        <ArrowUpCircle size={16} />
                        <span>Solicitar Sangria (- Retirada)</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setModalFechamento(true)}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Lock size={15} />
                    <span>Fechar Meu Caixa</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Resumo do Caixa Pessoal Aberto */}
          {caixaAtual && (() => {
            const resumoEfetivo: ResumoCaixa = resumo || {
              caixa: caixaAtual,
              saldo_inicial: Number(caixaAtual.saldo_inicial || 0),
              saldo_esperado_dinheiro: Number(caixaAtual.saldo_inicial || 0),
              total_suprimentos: 0,
              total_sangrias: 0,
              total_vendas_dinheiro: 0,
              total_vendas_pix: 0,
              total_vendas_cartao_credito: 0,
              total_vendas_cartao_debito: 0,
              total_vendas_a_prazo: 0,
              quantidade_vendas: 0
            };

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card Principal: Dinheiro Físico no Caixa */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                      Saldo Esperado em Dinheiro Físico
                    </span>
                    <h3 className="text-3xl font-extrabold mt-2 text-emerald-400">
                      {formatMoney(resumoEfetivo.saldo_esperado_dinheiro)}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2">
                      Fundo de Troco: <span className="font-semibold text-white">{formatMoney(resumoEfetivo.saldo_inicial)}</span>
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Suprimentos:</span>
                      <p className="font-semibold text-emerald-300">+{formatMoney(resumoEfetivo.total_suprimentos)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Sangrias:</span>
                      <p className="font-semibold text-rose-300">-{formatMoney(resumoEfetivo.total_sangrias)}</p>
                    </div>
                  </div>
                </div>

                {/* Quebra das Vendas por Método de Pagamento */}
                <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      Vendas Faturadas por Forma de Pagamento
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      * O fundo de troco não é contabilizado como venda
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">Vendas em Dinheiro</span>
                      <p className="text-base font-bold text-slate-800 mt-0.5">{formatMoney(resumoEfetivo.total_vendas_dinheiro)}</p>
                    </div>
                    <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                      <span className="text-xs text-sky-700 font-medium">Vendas no PIX</span>
                      <p className="text-base font-bold text-sky-900 mt-0.5">{formatMoney(resumoEfetivo.total_vendas_pix)}</p>
                    </div>
                    <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                      <span className="text-xs text-purple-700 font-medium">Cartão de Crédito</span>
                      <p className="text-base font-bold text-purple-900 mt-0.5">{formatMoney(resumoEfetivo.total_vendas_cartao_credito)}</p>
                    </div>
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <span className="text-xs text-indigo-700 font-medium">Cartão de Débito</span>
                      <p className="text-base font-bold text-indigo-900 mt-0.5">{formatMoney(resumoEfetivo.total_vendas_cartao_debito)}</p>
                    </div>
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                      <span className="text-xs text-amber-700 font-medium">A Prazo (Crediário)</span>
                      <p className="text-base font-bold text-amber-900 mt-0.5">{formatMoney(resumoEfetivo.total_vendas_a_prazo)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Modal de Inspeção e Auditoria de Caixa com Fechamento ao Clicar Fora */}
      {resumoInspecionado && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setResumoInspecionado(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                    Auditoria de Caixa #{formatarNumeroCaixa(resumoInspecionado.caixa?.id)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    resumoInspecionado.caixa?.status === 'FECHADO' 
                      ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {resumoInspecionado.caixa?.status === 'FECHADO' ? 'Fechado' : 'Aberto'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mt-1">
                  Caixa de {resumoInspecionado.caixa?.usuario_nome || 'Operador'}
                </h3>
              </div>
              <button
                onClick={() => setResumoInspecionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conta Proprietária do Caixa */}
            <div className="flex items-center gap-3 p-3 bg-purple-50/70 border border-purple-100 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                {resumoInspecionado.caixa?.usuario_foto ? (
                  <img 
                    src={resolveImageUrl(resumoInspecionado.caixa.usuario_foto)} 
                    alt={resumoInspecionado.caixa?.usuario_nome || 'Operador'} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  (resumoInspecionado.caixa?.usuario_nome || 'O').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-purple-600 block">Conta Proprietária</span>
                <p className="font-bold text-slate-900 text-sm truncate">{resumoInspecionado.caixa?.usuario_nome || 'Operador'}</p>
                {resumoInspecionado.caixa?.usuario_email && (
                  <p className="text-xs text-slate-500 truncate">{resumoInspecionado.caixa.usuario_email}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                  <span className="font-bold text-purple-700">
                    {resumoInspecionado.caixa?.usuario_perfil === 'ADMIN' ? 'Administrador' : 'Operador de Caixa'}
                  </span>
                  <span>•</span>
                  <span>Aberto em {safeFormatDate(resumoInspecionado.caixa?.data_abertura)}</span>
                  {resumoInspecionado.caixa?.data_fechamento && (
                    <>
                      <span>•</span>
                      <span>Fechado em {safeFormatDate(resumoInspecionado.caixa.data_fechamento)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Banner de Saldo e Fundo em Dinheiro */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                    {resumoInspecionado.caixa?.status === 'FECHADO' 
                      ? 'Saldo Calculado no Fechamento' 
                      : 'Dinheiro em Gaveta Esperado'}
                  </span>
                  <p className="text-2xl font-black text-emerald-400 mt-0.5">
                    {formatMoney(resumoInspecionado.saldo_esperado_dinheiro)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <span className="block text-[11px]">Fundo inicial:</span>
                  <span className="font-bold text-white text-sm">{formatMoney(resumoInspecionado.saldo_inicial)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Suprimentos (+)</span>
                  <p className="font-semibold text-emerald-300">+{formatMoney(resumoInspecionado.total_suprimentos)}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Sangrias (-)</span>
                  <p className="font-semibold text-rose-300">-{formatMoney(resumoInspecionado.total_sangrias)}</p>
                </div>
              </div>
            </div>

            {/* Painel de Auditoria & Quebra para Caixas Fechados */}
            {resumoInspecionado.caixa?.status === 'FECHADO' && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Saldo Calculado (Sistema):</span>
                  <span className="font-semibold text-slate-700">{formatMoney(resumoInspecionado.saldo_esperado_dinheiro)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Saldo Declarado (Entregue):</span>
                  <span className="font-black text-slate-900 text-sm">
                    {formatMoney(resumoInspecionado.caixa.saldo_final_informado ?? resumoInspecionado.saldo_esperado_dinheiro)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-slate-700 font-bold">Resultado da Auditoria:</span>
                  {(() => {
                    const dif = resumoInspecionado.diferenca !== undefined
                      ? Number(resumoInspecionado.diferenca)
                      : Number((
                          Number(resumoInspecionado.caixa?.saldo_final_informado ?? 0) - 
                          Number(resumoInspecionado.saldo_esperado_dinheiro ?? 0)
                        ).toFixed(2));
                    if (dif < -0.01) {
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          <AlertTriangle size={12} />
                          Falta {formatMoney(Math.abs(dif))} (Quebra de Caixa)
                        </span>
                      );
                    } else if (dif > 0.01) {
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200">
                          Sobra +{formatMoney(dif)}
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Bateu 100% Sem Quebra
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Totalizadores por Forma de Pagamento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Faturamento por Forma de Pagamento
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {resumoInspecionado.quantidade_vendas ?? 0} {(resumoInspecionado.quantidade_vendas === 1) ? 'venda' : 'vendas'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-medium block">Vendas Dinheiro</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{formatMoney(resumoInspecionado.total_vendas_dinheiro)}</p>
                </div>
                <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                  <span className="text-sky-700 font-medium block">Vendas PIX</span>
                  <p className="font-bold text-sky-800 text-sm mt-0.5">{formatMoney(resumoInspecionado.total_vendas_pix)}</p>
                </div>
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <span className="text-purple-700 font-medium block">Cartões (Crédito/Débito)</span>
                  <p className="font-bold text-purple-800 text-sm mt-0.5">
                    {formatMoney(
                      Number(resumoInspecionado.total_vendas_cartao_credito || 0) + 
                      Number(resumoInspecionado.total_vendas_cartao_debito || 0)
                    )}
                  </p>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <span className="text-amber-700 font-medium block">A Prazo (Crediário)</span>
                  <p className="font-bold text-amber-800 text-sm mt-0.5">{formatMoney(resumoInspecionado.total_vendas_a_prazo)}</p>
                </div>
              </div>
            </div>

            {/* Observações do Turno / Fechamento */}
            {resumoInspecionado.caixa?.observacoes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Observações do Turno
                </span>
                <p className="text-slate-600 whitespace-pre-wrap">{resumoInspecionado.caixa.observacoes}</p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {resumoInspecionado.caixa?.id && (
                <button
                  type="button"
                  onClick={() => handleAbrirComprovantesCaixa(resumoInspecionado.caixa.id)}
                  className={`w-full py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all`}
                >
                  <Receipt size={16} />
                  <span>Visualizar Comprovantes das Vendas Deste Caixa</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setResumoInspecionado(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abertura com Fechamento ao Clicar Fora */}
      {modalAbertura && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalAbertura(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-800 text-lg mb-2">Abrir Meu Caixa</h3>
            <p className="text-xs text-slate-500 mb-4">Informe o valor inicial do caixa (fundo de troco).</p>
            <form onSubmit={handleAbrir} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor Inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalAbertura(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentação Direta (Sangria / Suprimento) - Apenas Administrador */}
      {modalMov && isAdmin && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalMov(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-800 text-lg mb-1">
              {modalMov === 'SANGRIA' ? 'Retirada de Caixa (Sangria)' : 'Entrada de Dinheiro (Suprimento)'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {modalMov === 'SANGRIA' ? 'Saída de dinheiro para pagamento ou cofre.' : 'Reforço de troco ou entrada avulsa.'}
            </p>
            <form onSubmit={handleMovimentacao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={valorMov || ''}
                  onChange={(e) => setValorMov(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-base font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pagamento de fornecedor, depósito bancário..."
                  value={motivoMov}
                  onChange={(e) => setMotivoMov(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalMov(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 text-white rounded-xl text-sm font-semibold shadow-xs ${
                    modalMov === 'SANGRIA' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fechamento com Fechamento ao Clicar Fora */}
      {modalFechamento && resumo && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalFechamento(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-800 text-lg mb-1">Fechamento do Meu Caixa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Conte o dinheiro físico no caixa e informe o valor apurado.
            </p>

            <form onSubmit={handleFechar} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo em Dinheiro Esperado:</span>
                  <span className="font-bold text-slate-800">{formatMoney(resumo.saldo_esperado_dinheiro)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Valor em Dinheiro Contado na Gaveta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={saldoFechamentoInformado}
                  onChange={(e) => setSaldoFechamentoInformado(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-xl font-black text-slate-800"
                />
              </div>

              {(() => {
                const dif = Number((saldoFechamentoInformado - resumo.saldo_esperado_dinheiro).toFixed(2));
                return (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600">Diferença Apurada:</span>
                      <span className={
                        dif === 0 
                          ? 'text-emerald-600' 
                          : dif < 0 
                            ? 'text-rose-600' 
                            : 'text-sky-600'
                      }>
                        {dif === 0 ? 'Exato (R$ 0,00)' : dif < 0 ? `Falta ${formatMoney(Math.abs(dif))}` : `Sobra +${formatMoney(dif)}`}
                      </span>
                    </div>

                    {dif < 0 && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="font-bold">Quebra de Caixa Detectada!</p>
                          <p className="text-[11px] text-rose-700 mt-0.5">
                            O valor contado é <strong>{formatMoney(Math.abs(dif))} menor</strong> que o calculado pelo sistema. Esta diferença será gravada na auditoria e visível para a administração.
                          </p>
                        </div>
                      </div>
                    )}

                    {dif > 0 && (
                      <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start gap-2">
                        <CheckCircle2 className="text-sky-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          <p className="font-bold">Sobra de Caixa</p>
                          <p className="text-[11px] text-sky-700 mt-0.5">
                            O valor contado tem <strong>+{formatMoney(dif)} a mais</strong> que o esperado pelas vendas registradas.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalFechamento(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  Confirmar Fechamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR TICKET DE CAIXA COM FECHAMENTO AO CLICAR FORA */}
      {modalTicket.aberto && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalTicket(prev => ({ ...prev, aberto: false }))}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="text-sky-600" size={20} />
                <h3 className="font-bold text-slate-900 text-base">Solicitar Ticket ao ADM</h3>
              </div>
              <button
                onClick={() => setModalTicket(prev => ({ ...prev, aberto: false }))}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Envie um chamado para o administrador aprovar um reforço de troco ou retirada segura de gaveta.
            </p>

            <form onSubmit={handleEnviarTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Solicitação:</label>
                <select
                  value={modalTicket.tipo}
                  onChange={(e) => setModalTicket({ ...modalTicket, tipo: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  <option value="SUPRIMENTO">Suprimento de Troco (Reforço)</option>
                  <option value="SANGRIA">Sangria (Retirada de Dinheiro)</option>
                  <option value="SANGRIA_CEGA">Sangria Cega (ADM define o valor a recolher)</option>
                </select>
              </div>

              {modalTicket.tipo !== 'SANGRIA_CEGA' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Sugerido (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={modalTicket.valor || ''}
                    onChange={(e) => setModalTicket({ ...modalTicket, valor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Justificativa / Motivo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Faltam notas de R$ 5 e R$ 10 para troco"
                  value={modalTicket.motivo}
                  onChange={(e) => setModalTicket({ ...modalTicket, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalTicket(prev => ({ ...prev, aberto: false }))}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-gradient-to-r ${temaAtual.bgGradiente} text-white font-bold rounded-xl shadow-md transition-all`}
                >
                  Enviar Chamado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APROVAR TICKET DE CAIXA (SUBSTITUTO INTEGRADO PARA PROMPT NATIVO) */}
      {modalAprovarTicket && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalAprovarTicket(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Aprovar Chamado</h3>
                  <p className="text-[11px] text-slate-500">Defina o valor liberado para o caixa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAprovarTicket(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Operador:</span>
                <span className="font-bold text-slate-800">{modalAprovarTicket.usuarioNome}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Caixa Destino:</span>
                <span className="font-bold text-slate-800">Caixa #{formatarNumeroCaixa(modalAprovarTicket.caixaId)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tipo:</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  modalAprovarTicket.tipo === 'SUPRIMENTO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : modalAprovarTicket.tipo === 'SANGRIA_CEGA'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-800'
                }`}>
                  {modalAprovarTicket.tipo.replace('_', ' ')}
                </span>
              </div>
              {modalAprovarTicket.motivo && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium block mb-1">Justificativa do Operador:</span>
                  <p className="text-slate-700 text-[11px] italic leading-tight bg-white p-2 rounded-xl border border-slate-200/70">
                    "{modalAprovarTicket.motivo}"
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const val = parseFloat(modalAprovarTicket.valor.replace(',', '.'));
                if (isNaN(val) || val <= 0) {
                  toast.aviso('Informe um valor numérico válido maior que zero.');
                  return;
                }
                const ticketId = modalAprovarTicket.ticketId;
                setModalAprovarTicket(null);
                await handleResponderTicket(ticketId, true, val);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Valor Aprovado para Movimentação:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={modalAprovarTicket.valor}
                    onChange={(e) => setModalAprovarTicket({ ...modalAprovarTicket, valor: e.target.value })}
                    className="w-full pl-11 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-base font-bold text-slate-900"
                    placeholder="0,00"
                  />
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[20, 50, 100, 200, 500].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setModalAprovarTicket({ ...modalAprovarTicket, valor: v.toFixed(2) })}
                      className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAprovarTicket(null)}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer"
                >
                  Aprovar & Gerar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPROVANTE DIGITAL COM NAVEGAÇÃO ENTRE VENDAS DO CAIXA */}
      <ComprovanteDigitalModal
        isOpen={comprovanteModal.aberto}
        onClose={() => setComprovanteModal(prev => ({ ...prev, aberto: false }))}
        listaVendas={comprovanteModal.vendas}
        indiceInicial={comprovanteModal.indice}
      />
    </div>
  );
};
