import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Menu, Bell, ShoppingCart, User, CheckCheck, X, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNotificacoes, Notificacao } from '../contexts/NotificationContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { Caixa } from '../types';
import { apiService } from '../services/api';

interface NavbarProps {
  onMenuToggle: () => void;
  activeTitle: string;
  onOpenPDV: () => void;
  onOpenPonto?: () => void;
  onOpenNotificacoes?: () => void;
  caixaAberto: boolean;
  caixaAtual?: Caixa | null;
  userName?: string;
  isAdmin?: boolean;
}

// Retorna classes de cor baseadas no tipo da notificação
const corPorTipo = (tipo: Notificacao['tipo']): { borda: string; icone: string; fundo: string; texto: string } => {
  switch (tipo) {
    case 'erro':
      return { borda: 'border-l-red-500', icone: '🔴', fundo: 'bg-red-50', texto: 'text-red-700' };
    case 'aviso':
      return { borda: 'border-l-yellow-500', icone: '🟡', fundo: 'bg-yellow-50', texto: 'text-yellow-700' };
    case 'sucesso':
      return { borda: 'border-l-emerald-500', icone: '🟢', fundo: 'bg-emerald-50', texto: 'text-emerald-700' };
    case 'info':
    default:
      return { borda: 'border-l-sky-500', icone: '🔵', fundo: 'bg-sky-50', texto: 'text-sky-700' };
  }
};

// Formata a data relativa da notificação (ex: "há 2 minutos")
const formatarTempo = (data: Date): string => {
  const agora = new Date();
  const diffMs = agora.getTime() - new Date(data).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `há ${diffHr}h`;
  return `há ${Math.floor(diffHr / 24)} dias`;
};

export const Navbar: React.FC<NavbarProps> = ({
  onMenuToggle,
  activeTitle,
  onOpenPDV,
  onOpenPonto,
  onOpenNotificacoes,
  caixaAberto,
  caixaAtual,
  userName = 'Administrador',
  isAdmin = false
}) => {
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();
  const { temaAtual } = useEmpresa();
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mini Popover de Ponto Rápido para colaboradores elegíveis
  const [pontoRapidoAberto, setPontoRapidoAberto] = useState(false);
  const [statusPontoRapido, setStatusPontoRapido] = useState<any>(null);
  const [relogioAgora, setRelogioAgora] = useState('');
  const [salvandoPontoRapido, setSalvandoPontoRapido] = useState(false);
  const [msgSucessoPonto, setMsgSucessoPonto] = useState<string | null>(null);
  const [erroPontoRapido, setErroPontoRapido] = useState<string | null>(null);
  const pontoDropdownRef = useRef<HTMLDivElement>(null);

  const formatHora = (isoStr?: string | null) => {
    if (!isoStr) return '--:--';
    try {
      if (typeof isoStr === 'string' && isoStr.length === 5 && isoStr.includes(':')) return isoStr;
      return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    } catch {
      return (isoStr && isoStr.slice(11, 16)) || '--:--';
    }
  };

  // Relógio em tempo real
  useEffect(() => {
    const atualizar = () => {
      setRelogioAgora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    atualizar();
    const interval = setInterval(atualizar, 1000);
    return () => clearInterval(interval);
  }, []);

  // Carrega status ao abrir o ponto rápido
  useEffect(() => {
    if (pontoRapidoAberto) {
      setMsgSucessoPonto(null);
      setErroPontoRapido(null);
      apiService.getStatusPontoHoje().then(setStatusPontoRapido).catch(() => {});
    }
  }, [pontoRapidoAberto]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
      if (pontoDropdownRef.current && !pontoDropdownRef.current.contains(e.target as Node)) {
        setPontoRapidoAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const handleBaterPontoRapido = async () => {
    setSalvandoPontoRapido(true);
    setErroPontoRapido(null);
    try {
      await apiService.baterPonto({});
      const horaRegistrada = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setMsgSucessoPonto(`Ponto batido às ${horaRegistrada} com sucesso!`);
      const statusAtualizado = await apiService.getStatusPontoHoje().catch(() => null);
      if (statusAtualizado) {
        setStatusPontoRapido(statusAtualizado);
      }
    } catch (err: any) {
      setErroPontoRapido(err.response?.data?.detail || 'Erro ao registrar ponto');
    } finally {
      setSalvandoPontoRapido(false);
    }
  };

  const tempoAbertoFormatado = useMemo(() => {
    if (!caixaAtual?.data_abertura) return null;
    try {
      const data = new Date(caixaAtual.data_abertura);
      const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const minutosTotais = Math.max(0, Math.floor((Date.now() - data.getTime()) / 60000));
      const horas = Math.floor(minutosTotais / 60);
      const minutos = minutosTotais % 60;
      return `${hora} (${horas > 0 ? `${horas}h ` : ''}${minutos}m)`;
    } catch {
      return null;
    }
  }, [caixaAtual]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Últimas 10 notificações para exibir no dropdown
  const ultimas10 = notificacoes.slice(0, 10);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Abrir Menu"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight capitalize">
          {activeTitle}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Badge do Caixa */}
        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          caixaAberto 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${caixaAberto ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          {caixaAberto ? (
            <span>
              Caixa Aberto {tempoAbertoFormatado && <span className="opacity-90 font-mono text-[11px] ml-1">às {tempoAbertoFormatado}</span>}
            </span>
          ) : (
            'Caixa Fechado'
          )}
        </div>

        {/* Botão Atalho Bater Ponto CLT (Apenas para colaboradores elegíveis, oculto para Admin) */}
        {!isAdmin && onOpenPonto && (
          <div className="relative" ref={pontoDropdownRef}>
            <button
              onClick={() => setPontoRapidoAberto(prev => !prev)}
              title="Registrar ponto eletrônico rápido"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Clock size={15} className="text-amber-600 animate-pulse" />
              <span className="hidden sm:inline">Bater Ponto</span>
            </button>

            {/* Mini tela flutuante abaixo do botão */}
            {pontoRapidoAberto && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-xs text-slate-800">Registro Rápido de Ponto</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {relogioAgora}
                  </span>
                </div>

                {/* Exibição das 4 batidas de hoje */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2 rounded-xl border ${statusPontoRapido?.entrada_1 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="block font-bold">1ª Entrada</span>
                    <span className="font-mono">{formatHora(statusPontoRapido?.entrada_1)}</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${statusPontoRapido?.saida_1 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="block font-bold">2ª Almoço (Saída)</span>
                    <span className="font-mono">{formatHora(statusPontoRapido?.saida_1)}</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${statusPontoRapido?.entrada_2 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="block font-bold">3ª Almoço (Volta)</span>
                    <span className="font-mono">{formatHora(statusPontoRapido?.entrada_2)}</span>
                  </div>
                  <div className={`p-2 rounded-xl border ${statusPontoRapido?.saida_2 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="block font-bold">4ª Saída</span>
                    <span className="font-mono">{formatHora(statusPontoRapido?.saida_2)}</span>
                  </div>
                </div>

                {/* Mensagem de sucesso ou erro */}
                {msgSucessoPonto && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{msgSucessoPonto}</span>
                  </div>
                )}
                {erroPontoRapido && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                    <span>{erroPontoRapido}</span>
                  </div>
                )}

                {/* Botão de Registro Imediato */}
                <button
                  type="button"
                  disabled={salvandoPontoRapido}
                  onClick={handleBaterPontoRapido}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Clock size={15} />
                  <span>{salvandoPontoRapido ? 'Registrando Ponto...' : 'Bater Ponto Agora'}</span>
                </button>

                {/* Link para espelho completo */}
                <div className="text-center pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPontoRapidoAberto(false);
                      onOpenPonto();
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Consultar espelho de ponto completo</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão Atalho PDV */}
        <button
          onClick={onOpenPDV}
          className={`flex items-center gap-2 bg-gradient-to-r ${temaAtual.bgGradiente} hover:opacity-95 text-white px-3.5 py-1.5 rounded-xl text-sm font-semibold shadow-xs shadow-black/10 transition-all`}
        >
          <ShoppingCart size={16} />
          <span className="hidden sm:inline">Frente de Caixa</span>
        </button>

        {/* Sino de Notificações */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownAberto(prev => !prev)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Notificações"
          >
            <Bell size={20} />
            {naoLidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {naoLidas > 99 ? '99+' : naoLidas}
              </span>
            )}
          </button>

          {/* Dropdown de Notificações */}
          {dropdownAberto && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              {/* Cabeçalho do dropdown */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div>
                  <span className="font-bold text-slate-800 text-sm">Notificações</span>
                  {naoLidas > 0 && (
                    <span className="ml-2 bg-rose-100 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {naoLidas} nova{naoLidas > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-semibold transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={14} />
                  Marcar todas como lidas
                </button>
              </div>

              {/* Lista de notificações */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {ultimas10.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Bell size={32} className="mb-2 opacity-30" />
                    <p className="text-xs font-medium">Nenhuma notificação</p>
                  </div>
                ) : (
                  ultimas10.map(n => {
                    const cores = corPorTipo(n.tipo);
                    return (
                      <div
                        key={n.id}
                        onClick={() => marcarLida(n.id)}
                        className={`flex gap-3 px-4 py-3 border-l-4 ${cores.borda} cursor-pointer transition-colors ${
                          n.lido ? 'bg-white opacity-60 hover:opacity-80' : `${cores.fundo} hover:brightness-95`
                        }`}
                      >
                        <span className="text-base flex-shrink-0 mt-0.5">{cores.icone}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold ${n.lido ? 'text-slate-600' : cores.texto}`}>
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">
                            {n.mensagem}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {formatarTempo(n.created_at)}
                          </p>
                        </div>
                        {!n.lido && (
                          <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Rodapé do dropdown */}
              <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex flex-col gap-1.5 text-center">
                {notificacoes.length > 10 && (
                  <span className="text-[11px] text-slate-400">
                    Exibindo 10 de {notificacoes.length} notificações
                  </span>
                )}
                {onOpenNotificacoes && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownAberto(false);
                      onOpenNotificacoes();
                    }}
                    className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>Abrir Central de Ações Rápidas</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Usuário info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-slate-700">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User size={16} />
          </div>
          <span className="hidden md:inline text-xs font-semibold">{userName}</span>
        </div>
      </div>
    </header>
  );
};
