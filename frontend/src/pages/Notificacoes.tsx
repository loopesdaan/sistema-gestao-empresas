import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, CheckCircle2, AlertTriangle, Clock, Wallet, Users, 
  Package, Search, RefreshCw, CheckCheck, XCircle, ArrowRight,
  Shield, DollarSign, Filter, Sparkles, AlertCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { NotificacaoItem } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useNotificacoes } from '../contexts/NotificationContext';

interface NotificacoesProps {
  isAdmin?: boolean;
  onNavigate?: (tab: string) => void;
}

export const Notificacoes: React.FC<NotificacoesProps> = ({ isAdmin = false, onNavigate }) => {
  const { temaAtual } = useEmpresa();
  const { addNotificacao } = useNotificacoes();

  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [apenasPendentes, setApenasPendentes] = useState<boolean>(false);
  const [busca, setBusca] = useState<string>('');
  const [executandoAcao, setExecutandoAcao] = useState<number | null>(null);

  const carregarNotificacoes = async () => {
    try {
      setCarregando(true);
      const dados = await apiService.getNotificacoes();
      setNotificacoes(dados);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarNotificacoes();
  }, []);

  const handleResolver = async (id: number) => {
    try {
      setExecutandoAcao(id);
      await apiService.resolverNotificacao(id);
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Notificação Resolvida',
        mensagem: 'A pendência foi regularizada com sucesso.'
      });
      await carregarNotificacoes();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Resolver',
        mensagem: err.response?.data?.detail || 'Não foi possível regularizar a notificação.'
      });
    } finally {
      setExecutandoAcao(null);
    }
  };

  const handleResolverTodas = async () => {
    try {
      setCarregando(true);
      const res = await apiService.resolverTodasNotificacoes();
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Todas as Notificações Resolvidas',
        mensagem: res.message || 'Todas as pendências ativas foram marcadas como resolvidas.'
      });
      await carregarNotificacoes();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Resolver',
        mensagem: err.response?.data?.detail || 'Erro ao resolver todas as notificações.'
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleResponderTicket = async (notificacaoId: number, ticketId: number, aprovado: boolean, valorPendente?: number) => {
    try {
      setExecutandoAcao(notificacaoId);
      let msg = `Solicitação de caixa ${aprovado ? 'aprovada' : 'rejeitada'} com sucesso.`;
      try {
        const res = await apiService.responderTicketCaixa(ticketId, aprovado, valorPendente);
        if (res?.mensagem) msg = res.mensagem;
      } catch (errTicket: any) {
        console.warn('Aviso ao responder ticket diretamente:', errTicket);
        // Mesmo se o ticket específico já tiver sido aprovado no passado, prossegue para resolver a notificação
      }

      await apiService.resolverNotificacao(notificacaoId);
      addNotificacao({
        tipo: aprovado ? 'sucesso' : 'aviso',
        titulo: aprovado ? 'Ticket Aprovado' : 'Ticket Rejeitado',
        mensagem: msg
      });
      await carregarNotificacoes();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro no Ticket',
        mensagem: err.response?.data?.detail || 'Não foi possível processar a resposta do ticket.'
      });
    } finally {
      setExecutandoAcao(null);
    }
  };

  const handleAprovarHoraExtraRapida = async (notificacaoId: number, registroId: number) => {
    try {
      setExecutandoAcao(notificacaoId);
      await apiService.aprovarHoraExtra(registroId, 60, 'Autorização rápida via Central de Notificações');
      await apiService.resolverNotificacao(notificacaoId);
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Hora Extra Autorizada (60 min)',
        mensagem: 'Autorização registrada no Ponto CLT com sucesso.'
      });
      await carregarNotificacoes();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Autorizar',
        mensagem: err.response?.data?.detail || 'Não foi possível autorizar a hora extra.'
      });
    } finally {
      setExecutandoAcao(null);
    }
  };

  // Contadores para métricas no topo
  const contadores = useMemo(() => {
    const pendentes = notificacoes.filter(n => n.status === 'PENDENTE');
    const caixa = notificacoes.filter(n => n.tipo === 'CAIXA_TICKET' || n.referencia_tipo === 'CAIXA');
    const financeiro = notificacoes.filter(n => n.tipo === 'PENDENCIA_FINANCEIRA' || (n.valor_pendente && n.valor_pendente > 0));
    const clt = notificacoes.filter(n => n.tipo === 'PONTO_CLT' || n.referencia_tipo === 'PONTO');
    const totalPendenteRs = financeiro.reduce((acc, curr) => acc + (curr.valor_pendente || 0), 0);

    return {
      total: notificacoes.length,
      pendentes: pendentes.length,
      caixa: caixa.length,
      financeiro: financeiro.length,
      totalPendenteRs,
      clt: clt.length
    };
  }, [notificacoes]);

  // Filtro dinâmico
  const listaFiltrada = useMemo(() => {
    return notificacoes.filter(item => {
      // Filtro de status
      if (apenasPendentes && item.status !== 'PENDENTE') return false;

      // Filtro por categoria
      if (filtroTipo === 'PENDENTES' && item.status !== 'PENDENTE') return false;
      if (filtroTipo === 'RESOLVIDAS' && item.status !== 'RESOLVIDA') return false;
      if (filtroTipo === 'CAIXA' && !(item.tipo === 'CAIXA_TICKET' || item.referencia_tipo === 'CAIXA')) return false;
      if (filtroTipo === 'FINANCEIRO' && !(item.tipo === 'PENDENCIA_FINANCEIRA' || (item.valor_pendente && item.valor_pendente > 0))) return false;
      if (filtroTipo === 'CLT' && !(item.tipo === 'PONTO_CLT' || item.referencia_tipo === 'PONTO')) return false;
      if (filtroTipo === 'ESTOQUE' && !(item.tipo === 'ALERTA' || item.tipo === 'ESTOQUE_BAIXO' || item.referencia_tipo === 'PRODUTO')) return false;

      // Filtro por texto
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const noTitulo = item.titulo.toLowerCase().includes(termo);
        const naMensagem = item.mensagem.toLowerCase().includes(termo);
        return noTitulo || naMensagem;
      }

      return true;
    });
  }, [notificacoes, filtroTipo, apenasPendentes, busca]);

  const formatarData = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Central de Interações
            </span>
            <span className="text-xs font-bold text-slate-400">
              {contadores.pendentes} pendências ativas
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mt-1">
            <Bell className={temaAtual.textoHighlight} size={28} />
            <span>Central de Notificações & Ações Rápidas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Resolva solicitações de caixas, sangrias, autorizações de horas extras CLT e quitações de crédito com 1 clique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={carregarNotificacoes}
            disabled={carregando}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="Atualizar Notificações"
          >
            <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>

          {isAdmin && contadores.pendentes > 0 && (
            <button
              type="button"
              onClick={handleResolverTodas}
              disabled={carregando}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <CheckCheck size={16} />
              <span>Marcar Todas como Resolvidas</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pendentes Urgentes */}
        <div 
          onClick={() => { setFiltroTipo('PENDENTES'); setApenasPendentes(true); }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-amber-300 transition-all hover:shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Pendentes de Ação</span>
            <span className="text-2xl font-black text-slate-800">
              {contadores.pendentes}
            </span>
            <span className="text-[11px] text-amber-700 font-semibold block">
              Requer atenção imediata
            </span>
          </div>
        </div>

        {/* Card 2: Caixa & Sangrias */}
        <div 
          onClick={() => { setFiltroTipo('CAIXA'); setApenasPendentes(false); }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-sky-300 transition-all hover:shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tickets de Caixa</span>
            <span className="text-2xl font-black text-slate-800">
              {contadores.caixa}
            </span>
            <span className="text-[11px] text-sky-700 font-semibold block">
              Suprimentos & Sangrias
            </span>
          </div>
        </div>

        {/* Card 3: Financeiro & Débitos */}
        <div 
          onClick={() => { setFiltroTipo('FINANCEIRO'); setApenasPendentes(false); }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-rose-300 transition-all hover:shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Fiados & Débitos</span>
            <span className="text-2xl font-black text-slate-800">
              {contadores.financeiro}
            </span>
            <span className="text-[11px] text-rose-700 font-semibold block">
              Total: R$ {contadores.totalPendenteRs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Card 4: Ponto & Jornada CLT */}
        <div 
          onClick={() => { setFiltroTipo('CLT'); setApenasPendentes(false); }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 cursor-pointer hover:border-emerald-300 transition-all hover:shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Jornada & CLT</span>
            <span className="text-2xl font-black text-slate-800">
              {contadores.clt}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold block">
              Horas extras & Interjornada
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Busca textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por colaborador, descrição, motivo ou ticket..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {busca && (
              <button 
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle de Apenas Pendentes */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={apenasPendentes}
              onChange={(e) => setApenasPendentes(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Apenas Pendências Abertas</span>
          </label>
        </div>

        {/* Pílulas de Categoria */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          {[
            { id: 'TODOS', label: `Todos (${contadores.total})` },
            { id: 'PENDENTES', label: `Pendentes (${contadores.pendentes})` },
            { id: 'CAIXA', label: `Caixa & Tickets (${contadores.caixa})` },
            { id: 'FINANCEIRO', label: `Crédito & Fiado (${contadores.financeiro})` },
            { id: 'CLT', label: `Ponto & CLT (${contadores.clt})` },
            { id: 'ESTOQUE', label: `Estoque & Alertas` },
            { id: 'RESOLVIDAS', label: `Resolvidas (${contadores.total - contadores.pendentes})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroTipo(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroTipo === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Notificações com Ações Rápidas */}
      <div className="space-y-3">
        {carregando && notificacoes.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-500">Carregando notificações do sistema...</p>
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={30} />
            </div>
            <h3 className="text-base font-black text-slate-800">Tudo em Ordem! Nenhuma Notificação Encontrada</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Não existem pendências ativas para o filtro selecionado. Todos os alertas de caixa, créditos e ponto CLT estão regulares.
            </p>
            {(filtroTipo !== 'TODOS' || busca || apenasPendentes) && (
              <button
                onClick={() => { setFiltroTipo('TODOS'); setBusca(''); setApenasPendentes(false); }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : (
          listaFiltrada.map((item) => {
            const isPendente = item.status === 'PENDENTE';
            const isCaixaTicket = item.tipo === 'CAIXA_TICKET' || item.referencia_tipo === 'CAIXA';
            const isFinanceiro = item.tipo === 'PENDENCIA_FINANCEIRA' || (item.valor_pendente && item.valor_pendente > 0);
            const isPonto = item.tipo === 'PONTO_CLT' || item.referencia_tipo === 'PONTO';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all shadow-xs ${
                  isPendente
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-slate-50/70 border-slate-200/80 opacity-80'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Lado Esquerdo: Ícone + Textos */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isCaixaTicket 
                        ? 'bg-sky-50 text-sky-600 border border-sky-100' 
                        : isFinanceiro 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : isPonto
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {isCaixaTicket && <Wallet size={20} />}
                      {isFinanceiro && <DollarSign size={20} />}
                      {isPonto && <Clock size={20} />}
                      {!isCaixaTicket && !isFinanceiro && !isPonto && <AlertTriangle size={20} />}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPendente
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isPendente ? 'Pendente' : 'Resolvida'}
                        </span>

                        <span className="text-[10px] font-bold text-slate-400">
                          {formatarData(item.created_at)}
                        </span>

                        {item.valor_pendente && (
                          <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            R$ {Number(item.valor_pendente).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-800 leading-snug">
                        {item.titulo}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.mensagem}
                      </p>

                      {!isPendente && item.resolvido_em && (
                        <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 pt-1">
                          <CheckCircle2 size={12} />
                          <span>Resolvida em {formatarData(item.resolvido_em)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lado Direito: Ações Rápidas em 1 Clique */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    {/* Ações para Tickets de Caixa */}
                    {isCaixaTicket && isPendente && isAdmin && item.referencia_id && (
                      <>
                        <button
                          type="button"
                          disabled={executandoAcao === item.id}
                          onClick={() => handleResponderTicket(item.id, item.referencia_id!, true, item.valor_pendente)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          <span>Aprovar</span>
                        </button>

                        <button
                          type="button"
                          disabled={executandoAcao === item.id}
                          onClick={() => handleResponderTicket(item.id, item.referencia_id!, false, item.valor_pendente)}
                          className="px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-black transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          <span>Rejeitar</span>
                        </button>
                      </>
                    )}

                    {/* Ações para Ponto CLT */}
                    {isPonto && isPendente && isAdmin && item.referencia_id && (
                      <button
                        type="button"
                        disabled={executandoAcao === item.id}
                        onClick={() => handleAprovarHoraExtraRapida(item.id, item.referencia_id!)}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50"
                      >
                        <Clock size={14} />
                        <span>Liberar 1h Extra</span>
                      </button>
                    )}

                    {/* Atalhos para tela de destino */}
                    {isFinanceiro && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('clientes')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Users size={13} />
                        <span>Ver Clientes</span>
                      </button>
                    )}

                    {isPonto && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('ponto')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Shield size={13} />
                        <span>Painel CLT</span>
                      </button>
                    )}

                    {isCaixaTicket && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('caixa')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Wallet size={13} />
                        <span>Ir para Caixa</span>
                      </button>
                    )}

                    {/* Botão padrão: Marcar como Resolvida */}
                    {isPendente && (
                      <button
                        type="button"
                        disabled={executandoAcao === item.id}
                        onClick={() => handleResolver(item.id)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        <span>Resolver</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

