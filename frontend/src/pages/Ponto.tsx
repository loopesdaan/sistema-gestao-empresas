import React, { useState, useEffect } from 'react';
import { 
  Clock, Shield, CheckCircle2, AlertTriangle, Calendar, 
  User, Check, AlertCircle, ArrowRight, UserCheck, Coffee, 
  LogIn, LogOut, Lock, Unlock, Sparkles, RefreshCw, Sliders,
  Save, RotateCcw, Briefcase, Users
} from 'lucide-react';
import { apiService } from '../services/api';
import { RegistroPonto, StatusJornada, ConfiguracaoPonto, Usuario } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useNotificacoes } from '../contexts/NotificationContext';

interface PontoProps {
  isAdmin?: boolean;
}

export const Ponto: React.FC<PontoProps> = ({ isAdmin = false }) => {
  const { temaAtual } = useEmpresa();
  const { addNotificacao } = useNotificacoes();

  const [abaAtiva, setAbaAtiva] = useState<'bater' | 'historico' | 'auditoria' | 'escalas'>('bater');
  const [statusJornada, setStatusJornada] = useState<StatusJornada | null>(null);
  const [historico, setHistorico] = useState<RegistroPonto[]>([]);
  const [equipePonto, setEquipePonto] = useState<RegistroPonto[]>([]);
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoPonto[]>([]);
  const [usuariosEquipe, setUsuariosEquipe] = useState<Usuario[]>([]);
  const [tipoEscala, setTipoEscala] = useState<'CARGO' | 'COLABORADOR'>('CARGO');
  const [colaboradorSelecionadoId, setColaboradorSelecionadoId] = useState<number | null>(null);
  const [perfilAtivoEscala, setPerfilAtivoEscala] = useState<'OPERADOR_CAIXA' | 'ESTOQUISTA' | 'ADMIN'>('OPERADOR_CAIXA');
  const [formEscala, setFormEscala] = useState<ConfiguracaoPonto>({
    perfil: 'OPERADOR_CAIXA',
    horario_entrada: '08:00',
    horario_saida_almoco: '12:00',
    horario_retorno_almoco: '13:00',
    horario_saida: '17:00',
    dias_trabalho: 'SEG,TER,QUA,QUI,SEX',
    carga_horaria_diaria_minutos: 480,
    tolerancia_minutos: 15,
    interjornada_minima_horas: 11,
    max_horas_extras_dia_minutos: 120,
    isento_ponto: false,
    ativo: true,
  });
  const [salvandoEscala, setSalvandoEscala] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Modal aprovar hora extra
  const [modalAprovacao, setModalAprovacao] = useState<{
    aberto: boolean;
    registroId: number | null;
    funcionarioNome: string;
    minutos: number;
    motivo: string;
  }>({
    aberto: false,
    registroId: null,
    funcionarioNome: '',
    minutos: 60,
    motivo: 'Demanda de atendimento no caixa'
  });

  // Atualiza relógio digital a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const carregarStatusHoje = async () => {
    try {
      setCarregando(true);
      const res = await apiService.getStatusPontoHoje();
      setStatusJornada(res);
    } catch (err: any) {
      console.error('Erro ao buscar status do ponto:', err);
    } finally {
      setCarregando(false);
    }
  };

  const carregarHistorico = async () => {
    try {
      const res = await apiService.getHistoricoPonto(30);
      setHistorico(res);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarAuditoriaEquipe = async () => {
    try {
      const res = await apiService.getEquipeAuditoriaPonto();
      setEquipePonto(res);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      const [resConfigs, resUsers] = await Promise.all([
        apiService.getConfiguracoesPonto(),
        apiService.listarUsuarios()
      ]);
      setConfiguracoes(resConfigs);
      setUsuariosEquipe(resUsers);
      
      if (!colaboradorSelecionadoId && resUsers.length > 0) {
        setColaboradorSelecionadoId(resUsers[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar configurações de ponto:', err);
    }
  };

  useEffect(() => {
    carregarStatusHoje();
    if (abaAtiva === 'historico') carregarHistorico();
    if (abaAtiva === 'auditoria' && isAdmin) carregarAuditoriaEquipe();
    if (abaAtiva === 'escalas' && isAdmin) carregarConfiguracoes();
  }, [abaAtiva]);

  // Atualiza formEscala dinamicamente com base no tipo de escala (Cargo ou Colaborador)
  useEffect(() => {
    if (configuracoes.length === 0) return;

    if (tipoEscala === 'CARGO') {
      const atual = configuracoes.find(c => c.perfil === perfilAtivoEscala && !c.usuario_id);
      if (atual) {
        setFormEscala({ ...atual, usuario_id: undefined });
      } else {
        setFormEscala(prev => ({ ...prev, perfil: perfilAtivoEscala, usuario_id: undefined }));
      }
    } else if (tipoEscala === 'COLABORADOR' && colaboradorSelecionadoId) {
      const user = usuariosEquipe.find(u => u.id === colaboradorSelecionadoId);
      const customConfig = configuracoes.find(c => c.usuario_id === colaboradorSelecionadoId);
      if (customConfig) {
        setFormEscala({ ...customConfig });
      } else if (user) {
        // Usa a escala padrão do cargo do colaborador como base para personalização individual
        const padraoCargo = configuracoes.find(c => c.perfil === user.perfil && !c.usuario_id);
        if (padraoCargo) {
          setFormEscala({ ...padraoCargo, id: undefined, usuario_id: user.id, perfil: user.perfil });
        } else {
          setFormEscala(prev => ({ ...prev, id: undefined, usuario_id: user.id, perfil: user.perfil }));
        }
      }
    }
  }, [tipoEscala, perfilAtivoEscala, colaboradorSelecionadoId, configuracoes, usuariosEquipe]);

  const handleSalvarEscala = async () => {
    try {
      setSalvandoEscala(true);
      const payload: ConfiguracaoPonto = {
        ...formEscala,
        usuario_id: tipoEscala === 'COLABORADOR' ? (colaboradorSelecionadoId || undefined) : undefined
      };
      const res = await apiService.salvarConfiguracaoPonto(payload);
      const nomeAlvo = tipoEscala === 'COLABORADOR' 
        ? (usuariosEquipe.find(u => u.id === colaboradorSelecionadoId)?.nome || 'colaborador')
        : (formEscala.perfil || 'cargo');
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Escala Salva com Sucesso',
        mensagem: res.mensagem || `Horários de trabalho para ${nomeAlvo} foram atualizados.`
      });
      await carregarConfiguracoes();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Salvar Escala',
        mensagem: err.response?.data?.detail || 'Não foi possível salvar a escala de trabalho.'
      });
    } finally {
      setSalvandoEscala(false);
    }
  };

  const handleResetarTeste = async () => {
    try {
      setCarregando(true);
      const res = await apiService.resetarPontoTeste();
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Ponto Resetado (Modo Teste)',
        mensagem: res.mensagem || 'Batidas de hoje resetadas para novas validações de ponto.'
      });
      await carregarStatusHoje();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Resetar',
        mensagem: err.response?.data?.detail || 'Erro ao resetar ponto.'
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleToggleBypass = async () => {
    try {
      setCarregando(true);
      const res = await apiService.toggleBypassPonto();
      addNotificacao({
        tipo: res.bypass_ativo ? 'sucesso' : 'info',
        titulo: res.bypass_ativo ? 'Bypass de Ponto ATIVADO' : 'Bypass de Ponto DESATIVADO',
        mensagem: res.mensagem
      });
      await carregarStatusHoje();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro ao Alternar Bypass',
        mensagem: err.response?.data?.detail || 'Erro ao alterar bypass de ponto.'
      });
    } finally {
      setCarregando(false);
    }
  };

  const [horaSimulada, setHoraSimulada] = useState<string>('');

  const handleBaterPonto = async (tipo?: string) => {
    try {
      setCarregando(true);
      const res = await apiService.baterPonto({
        tipo_batida: tipo,
        hora_personalizada: horaSimulada.trim() || undefined
      });
      addNotificacao({
        titulo: 'Ponto Registrado',
        mensagem: res.mensagem || 'Ponto registrado com sucesso sob conformidade CLT.',
        tipo: 'sucesso'
      });
      setHoraSimulada('');
      await carregarStatusHoje();
    } catch (err: any) {
      addNotificacao({
        titulo: 'Erro ao Bater Ponto',
        mensagem: err.response?.data?.detail || 'Não foi possível registrar o ponto. Verifique o intervalo CLT.',
        tipo: 'aviso'
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleSimularDiaCompleto = async () => {
    try {
      setCarregando(true);
      const res = await apiService.simularDiaCompleto();
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Jornada Completa Simulada',
        mensagem: res.mensagem || 'Simulado: Entrada 08:30, Almoço 12:30, Retorno 13:30, Saída 17:30 (8h completas).'
      });
      await carregarStatusHoje();
    } catch (err: any) {
      addNotificacao({
        tipo: 'aviso',
        titulo: 'Erro na Simulação',
        mensagem: err.response?.data?.detail || 'Erro ao simular jornada.'
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarHoraExtra = async () => {
    if (!modalAprovacao.registroId) return;
    try {
      await apiService.aprovarHoraExtra(
        modalAprovacao.registroId,
        modalAprovacao.minutos,
        modalAprovacao.motivo
      );
      addNotificacao({
        titulo: 'Hora Extra Autorizada',
        mensagem: `Autorizado ${modalAprovacao.minutos} minutos de hora extra conforme Art. 59 CLT.`,
        tipo: 'sucesso'
      });
      setModalAprovacao({ aberto: false, registroId: null, funcionarioNome: '', minutos: 60, motivo: '' });
      if (abaAtiva === 'auditoria') carregarAuditoriaEquipe();
      carregarStatusHoje();
    } catch (err: any) {
      addNotificacao({
        titulo: 'Erro na Autorização',
        mensagem: err.response?.data?.detail || 'Erro ao autorizar hora extra.',
        tipo: 'aviso'
      });
    }
  };

  // Normalização de batidas para leitura instantânea e dinâmica
  const regEntrada1 = statusJornada?.entrada_1 || statusJornada?.ponto_hoje?.entrada_1;
  const regSaidaAlmoco = statusJornada?.saida_almoco || statusJornada?.ponto_hoje?.saida_almoco || statusJornada?.saida_1 || statusJornada?.ponto_hoje?.saida_1;
  const regRetornoAlmoco = statusJornada?.retorno_almoco || statusJornada?.ponto_hoje?.retorno_almoco || statusJornada?.entrada_2 || statusJornada?.ponto_hoje?.entrada_2;
  const regSaida2 = statusJornada?.saida_2 || statusJornada?.ponto_hoje?.saida_2;

  const proximaAcao = statusJornada?.proxima_acao || (
    !regEntrada1 ? 'ENTRADA' :
    !regSaidaAlmoco ? 'SAIDA_ALMOCO' :
    !regRetornoAlmoco ? 'RETORNO_ALMOCO' :
    !regSaida2 ? 'SAIDA_FINAL' : 'FINALIZADO'
  );

  const horarioSugerido = statusJornada?.horario_sugerido || {
    entrada: '08:00',
    saida_almoco: '12:00',
    retorno_almoco: '13:00',
    saida_final: '17:00'
  };

  const previsaoCalculada = statusJornada?.previsao_calculada || {
    saida_almoco: horarioSugerido.saida_almoco,
    retorno_almoco: horarioSugerido.retorno_almoco,
    saida_final: horarioSugerido.saida_final
  };

  const formatHora = (isoStr?: string | null) => {
    if (!isoStr) return '--:--';
    try {
      if (typeof isoStr === 'string' && isoStr.length === 5 && isoStr.includes(':')) return isoStr;
      return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    } catch {
      return (isoStr && isoStr.slice(11, 16)) || '--:--';
    }
  };

  const formatMinutos = (mins: number = 0) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Clock className={temaAtual.textoHighlight} size={28} />
            <span>Ponto Eletrônico & Jornada CLT</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conformidade total com a CLT: 4 batidas diárias, descanso de 11h interjornada (Art. 66) e limite de 2h extras (Art. 59).
          </p>
        </div>

        {/* Relógio Digital */}
        <div className="flex items-center gap-4 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-md border border-slate-800">
          <div className="text-right">
            <div className="text-2xl font-black font-mono tracking-wider">
              {horaAtual.toLocaleTimeString('pt-BR')}
            </div>
            <div className="text-[11px] text-slate-400 capitalize">
              {horaAtual.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        </div>
      </div>

      {/* Tabs com Scroll Suave no Mobile */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-0.5">
        <button
          onClick={() => setAbaAtiva('bater')}
          className={`px-4 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            abaAtiva === 'bater'
              ? `bg-white border-t-2 ${temaAtual.borderHighlight} text-slate-900 shadow-xs border-x border-slate-200`
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LogIn size={15} />
          <span>Registrar Ponto Hoje</span>
        </button>

        <button
          onClick={() => setAbaAtiva('historico')}
          className={`px-4 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
            abaAtiva === 'historico'
              ? `bg-white border-t-2 ${temaAtual.borderHighlight} text-slate-900 shadow-xs border-x border-slate-200`
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar size={15} />
          <span>Meu Histórico (30 dias)</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setAbaAtiva('auditoria')}
            className={`px-4 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
              abaAtiva === 'auditoria'
                ? `bg-white border-t-2 ${temaAtual.borderHighlight} text-slate-900 shadow-xs border-x border-slate-200`
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield size={15} />
            <span>Auditoria da Equipe (CLT)</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setAbaAtiva('escalas')}
            className={`px-4 sm:px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${
              abaAtiva === 'escalas'
                ? `bg-white border-t-2 ${temaAtual.borderHighlight} text-slate-900 shadow-xs border-x border-slate-200`
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={15} />
            <span>Horários & Escalas dos Perfis</span>
          </button>
        )}
      </div>

      {/* ABA 1: REGISTRAR PONTO HOJE */}
      {abaAtiva === 'bater' && (
        <div className="space-y-6">
          {/* Banner de Isenção do Administrador (Art. 62 CLT) e Modo Teste Total */}
          {isAdmin && (
            <div className="p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    👑
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5 flex-wrap">
                      <span>Gerente Geral / Administrador</span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                        Isento Art. 62 CLT
                      </span>
                      <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                        Pode bater ponto a qualquer hora
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                      Você pode bater ponto em qualquer horário, simular um dia inteiro de 8h com 1 clique ou testar horários manuais.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimularDiaCompleto}
                    disabled={carregando}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles size={14} />
                    <span>⚡ Simular Dia Completo (8h)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetarTeste}
                    disabled={carregando}
                    className="px-3 py-2 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw size={14} className={carregando ? 'animate-spin' : ''} />
                    <span>Resetar Teste</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleBypass}
                    disabled={carregando}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                      statusJornada?.bypass_ativo
                        ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-300'
                        : 'bg-white hover:bg-purple-50 text-purple-900 border border-purple-200'
                    }`}
                    title="Permite que Operadores e Controladores trabalhem sem bater ponto (Modo Demonstração)"
                  >
                    <span>🧪 Bypass Equipe:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      statusJornada?.bypass_ativo ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {statusJornada?.bypass_ativo ? 'ATIVO' : 'DESLIGADO'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Barra de Teste com Horário Customizado */}
              <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-amber-900 font-semibold text-[11px] flex items-center gap-1">
                  <Clock size={13} className="text-amber-600" />
                  <span>Deseja testar com um horário específico?</span>
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={horaSimulada}
                    onChange={(e) => setHoraSimulada(e.target.value)}
                    placeholder="HH:MM"
                    className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    disabled={carregando || !horaSimulada}
                    onClick={() => handleBaterPonto()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                  >
                    Bater neste Horário
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card de Status da Jornada e Bloqueio CLT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center ${temaAtual.textoHighlight}`}>
                <Clock size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Trabalhado Hoje</span>
                <span className="text-xl font-black text-slate-800">
                  {formatMinutos(statusJornada?.minutos_trabalhados || 0)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Padrão CLT: 8h (480min)
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hora Extra Autorizada</span>
                <span className="text-xl font-black text-amber-600">
                  {formatMinutos(statusJornada?.hora_extra_autorizada || 0)}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Limite Legal: Máx. 2h (Art. 59 CLT)
                </span>
              </div>
            </div>

            <div className={`p-5 rounded-2xl border shadow-xs flex items-center gap-4 ${
              statusJornada?.bloqueado_clt 
                ? 'bg-rose-50 border-rose-200 text-rose-900' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                statusJornada?.bloqueado_clt ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {statusJornada?.bloqueado_clt ? <Lock size={24} /> : <Unlock size={24} />}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider block">Status do PDV / Caixa</span>
                <span className="text-lg font-black block">
                  {statusJornada?.bloqueado_clt ? 'Bloqueado por CLT' : 'Liberado para Operar'}
                </span>
                <span className="text-[11px] opacity-80 block">
                  {statusJornada?.mensagem_status}
                </span>
              </div>
            </div>
          </div>

          {/* Painel Dinâmico de Projeção Horária Inteligente */}
          {regEntrada1 && (
            <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-sky-950">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-sky-600 shrink-0" />
                <div>
                  <span className="font-bold block">
                    Cálculo Dinâmico CLT em Tempo Real (Entrada às {formatHora(regEntrada1)})
                  </span>
                  <span className="text-[11px] text-sky-800">
                    O sistema recalcula automaticamente a previsão de almoço e saída útil para completar as 8 horas normais de trabalho.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] font-bold">
                <span className="bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
                  🍽️ Almoço Previsto: {previsaoCalculada.saida_almoco}
                </span>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
                  🏁 Saída p/ 8h: {previsaoCalculada.saida_final}
                </span>
                <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-lg">
                  Ref. Sugerida: {horarioSugerido.entrada} → {horarioSugerido.saida_final}
                </span>
              </div>
            </div>
          )}

          {/* Painel Central de Ação Única - Bater Ponto Sem Confusão */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Etapa Atual da Jornada
                  </span>
                  {proximaAcao === 'FINALIZADO' ? (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Concluído
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1">
                      <Clock size={12} /> Em Aberto
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-800 mt-1">
                  {proximaAcao === 'ENTRADA' && '1ª Batida: Entrada da Manhã'}
                  {proximaAcao === 'SAIDA_ALMOCO' && '2ª Batida: Saída para Intervalo de Almoço'}
                  {proximaAcao === 'RETORNO_ALMOCO' && '3ª Batida: Retorno do Almoço (Intrajornada)'}
                  {proximaAcao === 'SAIDA_FINAL' && '4ª Batida: Saída Final do Expediente'}
                  {proximaAcao === 'FINALIZADO' && 'Expediente Diário Concluído com Sucesso'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {proximaAcao === 'ENTRADA' && 'Você ainda não registrou o início do trabalho hoje. Clique abaixo para registrar.'}
                  {proximaAcao === 'SAIDA_ALMOCO' && 'Primeiro período em andamento. Ao sair para sua pausa de refeição, registre o ponto.'}
                  {proximaAcao === 'RETORNO_ALMOCO' && 'Você está no horário de almoço (Art. 71 CLT - mín. 1h). Ao voltar ao trabalho, registre o retorno.'}
                  {proximaAcao === 'SAIDA_FINAL' && 'Segundo período em andamento. Ao terminar suas 8 horas diárias, registre o encerramento.'}
                  {proximaAcao === 'FINALIZADO' && 'Todas as 4 batidas obrigatórias foram computadas. Seu ciclo de hoje está finalizado e protegido contra alterações.'}
                </p>
              </div>

              {/* Botão de Ação Primária Centralizado */}
              <div className="shrink-0 flex items-center">
                {proximaAcao === 'FINALIZADO' ? (
                  <div className="w-full sm:w-auto px-6 py-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-default">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <span>✓ Todas as 4 Batidas Concluídas</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={carregando}
                    onClick={() => handleBaterPonto()}
                    className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      proximaAcao === 'ENTRADA'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                        : proximaAcao === 'SAIDA_ALMOCO'
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                          : proximaAcao === 'RETORNO_ALMOCO'
                            ? 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500'
                            : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'
                    }`}
                  >
                    {carregando ? (
                      <RefreshCw size={20} className="animate-spin" />
                    ) : (
                      <>
                        {proximaAcao === 'ENTRADA' && <LogIn size={20} />}
                        {proximaAcao === 'SAIDA_ALMOCO' && <Coffee size={20} />}
                        {proximaAcao === 'RETORNO_ALMOCO' && <LogIn size={20} />}
                        {proximaAcao === 'SAIDA_FINAL' && <LogOut size={20} />}
                      </>
                    )}
                    <span>
                      {proximaAcao === 'ENTRADA' && `Bater Entrada Agora (${horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                      {proximaAcao === 'SAIDA_ALMOCO' && `Bater Saída Almoço Agora (${horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                      {proximaAcao === 'RETORNO_ALMOCO' && `Bater Retorno Almoço Agora (${horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                      {proximaAcao === 'SAIDA_FINAL' && `Bater Saída Final Agora (${horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* As 4 Etapas Visuais da Jornada */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* 1. Entrada Manhã */}
              <div className={`p-5 rounded-2xl border transition-all ${
                regEntrada1 
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200' 
                  : proximaAcao === 'ENTRADA'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/40'
                    : 'bg-slate-50/60 border-slate-200 opacity-75'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">1</span>
                    <span>ENTRADA</span>
                  </span>
                  <LogIn size={16} className={regEntrada1 ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(regEntrada1)}
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    regEntrada1 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : proximaAcao === 'ENTRADA'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {regEntrada1 ? '✓ Confirmado' : proximaAcao === 'ENTRADA' ? '⚡ Próxima Batida' : '⏳ Aguardando'}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate" title={`Sugerido: ${horarioSugerido.entrada}`}>
                    Ref: {horarioSugerido.entrada}
                  </p>
                </div>
              </div>

              {/* 2. Saída Almoço */}
              <div className={`p-5 rounded-2xl border transition-all ${
                regSaidaAlmoco 
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200' 
                  : proximaAcao === 'SAIDA_ALMOCO'
                    ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/40'
                    : 'bg-slate-50/60 border-slate-200 opacity-75'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">2</span>
                    <span>SAÍDA ALMOÇO</span>
                  </span>
                  <Coffee size={16} className={regSaidaAlmoco ? 'text-emerald-600' : 'text-amber-500'} />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(regSaidaAlmoco)}
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    regSaidaAlmoco 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : proximaAcao === 'SAIDA_ALMOCO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {regSaidaAlmoco ? '✓ Confirmado' : proximaAcao === 'SAIDA_ALMOCO' ? '⚡ Próxima Batida' : '⏳ Aguardando'}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate" title={regSaidaAlmoco ? 'Almoço registrado' : regEntrada1 ? `Previsão: ${previsaoCalculada.saida_almoco}` : `Sugerido: ${horarioSugerido.saida_almoco}`}>
                    {regSaidaAlmoco 
                      ? `Ref: ${horarioSugerido.saida_almoco}` 
                      : regEntrada1 
                        ? `⚡ Prev: ${previsaoCalculada.saida_almoco}` 
                        : `Ref: ${horarioSugerido.saida_almoco}`
                    }
                  </p>
                </div>
              </div>

              {/* 3. Retorno Almoço */}
              <div className={`p-5 rounded-2xl border transition-all ${
                regRetornoAlmoco 
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200' 
                  : proximaAcao === 'RETORNO_ALMOCO'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/40'
                    : 'bg-slate-50/60 border-slate-200 opacity-75'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">3</span>
                    <span>RETORNO ALMOÇO</span>
                  </span>
                  <LogIn size={16} className={regRetornoAlmoco ? 'text-emerald-600' : 'text-sky-500'} />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(regRetornoAlmoco)}
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    regRetornoAlmoco 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : proximaAcao === 'RETORNO_ALMOCO'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {regRetornoAlmoco ? '✓ Confirmado' : proximaAcao === 'RETORNO_ALMOCO' ? '⚡ Próxima Batida' : '⏳ Aguardando'}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate" title={regRetornoAlmoco ? 'Retorno registrado' : regSaidaAlmoco ? `Mínimo 1h CLT: ${previsaoCalculada.retorno_almoco}` : `Sugerido: ${horarioSugerido.retorno_almoco}`}>
                    {regRetornoAlmoco 
                      ? `Ref: ${horarioSugerido.retorno_almoco}` 
                      : regSaidaAlmoco 
                        ? `⚡ Mín. 1h: ${previsaoCalculada.retorno_almoco}` 
                        : `Ref: ${horarioSugerido.retorno_almoco}`
                    }
                  </p>
                </div>
              </div>

              {/* 4. Saída Final */}
              <div className={`p-5 rounded-2xl border transition-all ${
                regSaida2 
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200' 
                  : proximaAcao === 'SAIDA_FINAL'
                    ? 'border-rose-500 ring-2 ring-rose-100 bg-rose-50/40'
                    : 'bg-slate-50/60 border-slate-200 opacity-75'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">4</span>
                    <span>SAÍDA FINAL</span>
                  </span>
                  <LogOut size={16} className={regSaida2 ? 'text-emerald-600' : 'text-rose-500'} />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(regSaida2)}
                </div>
                <div className="space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    regSaida2 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : proximaAcao === 'SAIDA_FINAL'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {regSaida2 ? '✓ Jornada Concluída' : proximaAcao === 'SAIDA_FINAL' ? '⚡ Próxima Batida' : '⏳ Aguardando'}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate" title={regSaida2 ? 'Jornada encerrada' : `Previsão p/ 8h: ${previsaoCalculada.saida_final}`}>
                    {regSaida2 
                      ? `Ref: ${horarioSugerido.saida_final}` 
                      : regRetornoAlmoco 
                        ? `⚡ Fechar 8h: ${previsaoCalculada.saida_final}` 
                        : `Ref: ${horarioSugerido.saida_final}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso Legal de Intervalo Interjornada */}
            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 flex items-start gap-3">
              <Shield size={20} className="text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-900 leading-relaxed">
                <span className="font-bold block">Proteção Trabalhista (Art. 66 da CLT):</span>
                Entre o término de uma jornada diária e o início da seguinte é obrigatório o intervalo mínimo ininterrupto de <strong>11 (onze) horas</strong> consecutivas para descanso. O sistema protege automaticamente contra jornadas abusivas.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: MEU HISTÓRICO */}
      {abaAtiva === 'historico' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Histórico dos Últimos 30 Dias</h3>
            <span className="text-xs text-slate-500">{historico.length} registros encontrados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5">Entrada 1</th>
                  <th className="p-3.5">Saída Almoço</th>
                  <th className="p-3.5">Retorno Almoço</th>
                  <th className="p-3.5">Saída Final</th>
                  <th className="p-3.5">Total Trabalhado</th>
                  <th className="p-3.5">Hora Extra</th>
                  <th className="p-3.5">Status CLT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Nenhum registro de ponto registrado no período.
                    </td>
                  </tr>
                ) : (
                  historico.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-slate-900">
                        {new Date(reg.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3.5 font-mono">{formatHora(reg.entrada_1)}</td>
                      <td className="p-3.5 font-mono">{formatHora(reg.saida_1)}</td>
                      <td className="p-3.5 font-mono">{formatHora(reg.entrada_2)}</td>
                      <td className="p-3.5 font-mono">{formatHora(reg.saida_2)}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {formatMinutos(reg.total_minutos_trabalhados || 0)}
                      </td>
                      <td className="p-3.5 font-bold text-amber-600">
                        {(reg.minutos_hora_extra_autorizada || 0) > 0 ? formatMinutos(reg.minutos_hora_extra_autorizada || 0) : '-'}
                      </td>
                      <td className="p-3.5">
                        {reg.bloqueado_clt ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                            Travado CLT
                          </span>
                        ) : reg.saida_2 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                            Concluído
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold text-[10px]">
                            Em Andamento
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: AUDITORIA DA EQUIPE (ADMIN ONLY) */}
      {abaAtiva === 'auditoria' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Monitor de Ponto da Equipe (CLT)</h3>
              <p className="text-xs text-slate-500">
                Auditoria de horários em tempo real e liberação legal de até 2h de hora extra (Art. 59 CLT).
              </p>
            </div>
            <button
              onClick={carregarAuditoriaEquipe}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              <span>Atualizar Equipe</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Funcionário</th>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5">Entrada / Saída</th>
                  <th className="p-3.5">Tempo Útil</th>
                  <th className="p-3.5">Hora Extra</th>
                  <th className="p-3.5">Status Caixa</th>
                  <th className="p-3.5 text-right">Ação Legal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {equipePonto.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Nenhum registro de ponto registrado para a equipe hoje.
                    </td>
                  </tr>
                ) : (
                  equipePonto.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                          {item.usuario_nome?.charAt(0) || 'U'}
                        </div>
                        <span>{item.usuario_nome || `Usuário #${item.usuario_id}`}</span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">{item.data}</td>
                      <td className="p-3.5 font-mono">
                        {formatHora(item.entrada_1)} → {formatHora(item.saida_2)}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {formatMinutos(item.total_minutos_trabalhados || 0)}
                      </td>
                      <td className="p-3.5 font-bold text-amber-600">
                        {(item.minutos_hora_extra_autorizada || 0) > 0 ? formatMinutos(item.minutos_hora_extra_autorizada || 0) : '0m'}
                      </td>
                      <td className="p-3.5">
                        {item.bloqueado_clt ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] flex items-center gap-1 w-max">
                            <Lock size={12} /> Caixa Travado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center gap-1 w-max">
                            <Unlock size={12} /> Operacional
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setModalAprovacao({
                            aberto: true,
                            registroId: item.id,
                            funcionarioNome: item.usuario_nome || 'Funcionário',
                            minutos: 60,
                            motivo: 'Demanda de atendimento autorizada'
                          })}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                        >
                          Autorizar Hora Extra
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: CONFIGURAÇÃO DE HORÁRIOS & ESCALAS DOS PERFIS (ADMIN ONLY) */}
      {abaAtiva === 'escalas' && isAdmin && (
        <div className="space-y-6">
          {/* Header da Aba com Escolha entre Escala por Cargo ou Colaborador Individual */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Sliders size={20} className={temaAtual.textoHighlight} />
                  <span>Configuração de Jornadas & Escalas de Trabalho</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Defina os horários oficiais tanto de forma geral por cargo quanto de forma personalizada para colaboradores específicos.
                </p>
              </div>

              {/* Seletor do Modo de Escala: Por Cargo ou Individual */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setTipoEscala('CARGO')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    tipoEscala === 'CARGO'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Briefcase size={14} />
                  <span>Padrão por Cargo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEscala('COLABORADOR')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    tipoEscala === 'COLABORADOR'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={14} />
                  <span>Por Colaborador Específico</span>
                </button>
              </div>
            </div>

            {/* Seletor quando for por Cargo */}
            {tipoEscala === 'CARGO' && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 mr-1">Selecione o Cargo:</span>
                {[
                  { id: 'OPERADOR_CAIXA', label: 'Operador de Caixa', icon: UserCheck },
                  { id: 'ESTOQUISTA', label: 'Controlador de Estoque', icon: Briefcase },
                  { id: 'ADMIN', label: 'Gerente Geral (Adm)', icon: Shield },
                ].map((p) => {
                  const Icon = p.icon;
                  const isSel = perfilAtivoEscala === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPerfilAtivoEscala(p.id as any)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSel 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Seletor quando for por Colaborador Específico */}
            {tipoEscala === 'COLABORADOR' && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-500 block">Selecione o Colaborador da Equipe:</span>
                <div className="flex flex-wrap gap-2">
                  {usuariosEquipe.map((u) => {
                    const isCustom = configuracoes.some(c => c.usuario_id === u.id);
                    const isSel = colaboradorSelecionadoId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setColaboradorSelecionadoId(u.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isSel
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <User size={14} />
                        <span>{u.nome}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isCustom 
                            ? isSel ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800' 
                            : isSel ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isCustom ? 'Personalizada' : 'Padrão'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card do Formulário de Escala */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  {tipoEscala === 'CARGO' 
                    ? `Horário Padrão do Cargo: ${
                        perfilAtivoEscala === 'OPERADOR_CAIXA' ? 'Operador de Caixa (Frente de Caixa)' :
                        perfilAtivoEscala === 'ESTOQUISTA' ? 'Controlador de Estoque (Inventário)' :
                        'Gerente Geral (Administrador)'
                      }`
                    : `Horário Individual de: ${usuariosEquipe.find(u => u.id === colaboradorSelecionadoId)?.nome || 'Colaborador'} (${formEscala.perfil || 'Equipe'})`
                  }
                </h4>
                <p className="text-xs text-slate-500">
                  {tipoEscala === 'CARGO'
                    ? 'Estes horários serão usados como parâmetros padrão para todos os colaboradores deste cargo.'
                    : 'Esta escala se sobrepõe ao padrão do cargo exclusivamente para este colaborador.'
                  }
                </p>
              </div>

              {formEscala.isento_ponto && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  ✓ Isento de Ponto (Art. 62 CLT)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Horário Entrada */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <LogIn size={15} className="text-emerald-600" />
                  <span>1. Horário de Entrada</span>
                </label>
                <input
                  type="time"
                  value={formEscala.horario_entrada}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, horario_entrada: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400 block">Início da jornada diária</span>
              </div>

              {/* Saída Almoço */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Coffee size={15} className="text-amber-600" />
                  <span>2. Saída para Almoço</span>
                </label>
                <input
                  type="time"
                  value={formEscala.horario_saida_almoco}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, horario_saida_almoco: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400 block">Início do intervalo intrajornada</span>
              </div>

              {/* Retorno Almoço */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Coffee size={15} className="text-sky-600" />
                  <span>3. Retorno do Almoço</span>
                </label>
                <input
                  type="time"
                  value={formEscala.horario_retorno_almoco}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, horario_retorno_almoco: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400 block">Término do intervalo (mín. 1 hora)</span>
              </div>

              {/* Saída Final */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <LogOut size={15} className="text-rose-600" />
                  <span>4. Saída do Expediente</span>
                </label>
                <input
                  type="time"
                  value={formEscala.horario_saida}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, horario_saida: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400 block">Encerramento da jornada normal</span>
              </div>
            </div>

            {/* Parâmetros Trabalhistas CLT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Dias de Trabalho na Semana:
                </label>
                <input
                  type="text"
                  value={formEscala.dias_trabalho}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, dias_trabalho: e.target.value }))}
                  placeholder="Ex: SEG,TER,QUA,QUI,SEX"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-500">
                  Respeite o Art. 67 da CLT (repouso semanal de 24h consecutivas, preferencialmente aos domingos).
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Tolerância de Ponto (Art. 58 § 1º CLT):
                </label>
                <select
                  value={formEscala.tolerancia_minutos}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, tolerancia_minutos: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                >
                  <option value={5}>5 minutos</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos (Padrão)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Não são computadas nem descontadas variações até o limite legal de 10-15 minutos diários.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Limite Horas Extras / Dia (Art. 59 CLT):
                </label>
                <select
                  value={formEscala.max_horas_extras_dia_minutos}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, max_horas_extras_dia_minutos: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                >
                  <option value={60}>1 hora (60 min)</option>
                  <option value={120}>2 horas (120 min - Máximo CLT)</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  O sistema bloqueia tentativas de horas extras acima do teto legal de 2 horas.
                </p>
              </div>
            </div>

            {/* Checkbox Isenção */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Isenção Legal de Controle de Ponto (Art. 62 da CLT)
                </span>
                <p className="text-[11px] text-slate-500">
                  Aplicável exclusivamente a cargos de gestão, gerentes com poderes diretivos e diretores.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formEscala.isento_ponto}
                  onChange={(e) => setFormEscala(prev => ({ ...prev, isento_ponto: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Botão de Salvar */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={salvandoEscala}
                onClick={handleSalvarEscala}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${temaAtual.bgGradiente} shadow-md transition-all disabled:opacity-50`}
              >
                <Save size={16} />
                <span>
                  {salvandoEscala 
                    ? 'Salvando Escala...' 
                    : tipoEscala === 'CARGO' 
                      ? 'Salvar Escala Padrão do Cargo' 
                      : `Salvar Escala Individual de ${usuariosEquipe.find(u => u.id === colaboradorSelecionadoId)?.nome?.split(' ')[0] || 'Colaborador'}`
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUTORIZAR HORA EXTRA (ADMIN) */}
      {modalAprovacao.aberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Shield size={20} />
                <h3 className="font-bold text-slate-900 text-base">Autorizar Hora Extra (CLT)</h3>
              </div>
              <button
                onClick={() => setModalAprovacao(prev => ({ ...prev, aberto: false }))}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Liberar prorrogação de jornada para <strong>{modalAprovacao.funcionarioNome}</strong>.
              Nos termos do <strong>Artigo 59 da CLT</strong>, a prorrogação é limitada a no máximo <strong>2 horas (120 minutos)</strong> diárias.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tempo Adicional Autorizado:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setModalAprovacao(prev => ({ ...prev, minutos: mins }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        modalAprovacao.minutos === mins
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mins === 120 ? '2 horas (Máx)' : `${mins} min`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Justificativa Operacional:
                </label>
                <input
                  type="text"
                  value={modalAprovacao.motivo}
                  onChange={(e) => setModalAprovacao(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ex: Demanda excepcional no fechamento"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAprovacao(prev => ({ ...prev, aberto: false }))}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarHoraExtra}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Confirmar & Destravar PDV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
