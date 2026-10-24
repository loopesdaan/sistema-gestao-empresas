import React, { useState, useEffect } from 'react';
import { 
  Clock, Shield, CheckCircle2, AlertTriangle, Calendar, 
  User, Check, AlertCircle, ArrowRight, UserCheck, Coffee, 
  LogIn, LogOut, Lock, Unlock, Sparkles, RefreshCw, Sliders,
  Save, RotateCcw, Briefcase
} from 'lucide-react';
import { apiService } from '../services/api';
import { RegistroPonto, StatusJornada, ConfiguracaoPonto } from '../types';
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
      const res = await apiService.getConfiguracoesPonto();
      setConfiguracoes(res);
      const atual = res.find(c => c.perfil === perfilAtivoEscala);
      if (atual) {
        setFormEscala({ ...atual });
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

  // Atualiza formEscala ao trocar de perfil na aba de escalas
  useEffect(() => {
    if (configuracoes.length > 0) {
      const atual = configuracoes.find(c => c.perfil === perfilAtivoEscala);
      if (atual) {
        setFormEscala({ ...atual });
      } else {
        setFormEscala(prev => ({ ...prev, perfil: perfilAtivoEscala }));
      }
    }
  }, [perfilAtivoEscala, configuracoes]);

  const handleSalvarEscala = async () => {
    try {
      setSalvandoEscala(true);
      const res = await apiService.salvarConfiguracaoPonto(formEscala);
      addNotificacao({
        tipo: 'sucesso',
        titulo: 'Escala Salva com Sucesso',
        mensagem: res.mensagem || `Horários de trabalho para ${formEscala.perfil} foram atualizados.`
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

  const handleBaterPonto = async (tipo: 'ENTRADA_1' | 'SAIDA_1' | 'ENTRADA_2' | 'SAIDA_2') => {
    try {
      setCarregando(true);
      const res = await apiService.baterPonto(tipo);
      addNotificacao({
        titulo: 'Ponto Registrado',
        mensagem: res.message || 'Ponto registrado com sucesso sob conformidade CLT.',
        tipo: 'sucesso'
      });
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

  const pontoHoje = statusJornada?.ponto_hoje;

  const formatHora = (isoStr?: string) => {
    if (!isoStr) return '--:--';
    try {
      return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatMinutos = (mins: number) => {
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setAbaAtiva('bater')}
          className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
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
          className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
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
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
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
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
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
          {/* Banner de Isenção do Administrador (Art. 62 CLT) e Modo Teste */}
          {isAdmin && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  👑
                </div>
                <div>
                  <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <span>Você está operando como Gerente Geral / Administrador</span>
                    <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      Art. 62 CLT (Isento)
                    </span>
                  </h4>
                  <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                    Seu perfil não é obrigado a bater ponto e nunca sofre bloqueio de PDV ou Caixa. Use as batidas abaixo para <strong>testar e validar</strong> o fluxo da sua equipe.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetarTeste}
                disabled={carregando}
                className="px-3.5 py-2 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all shrink-0"
              >
                <RotateCcw size={14} className={carregando ? 'animate-spin' : ''} />
                <span>Resetar Batidas de Teste</span>
              </button>
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

          {/* As 4 Batidas Oficiais da Jornada */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Escala de Batidas de Hoje</h3>
                <p className="text-xs text-slate-500">
                  Registre as 4 etapas da jornada de trabalho. O sistema calcula automaticamente o tempo útil e alerta sobre o intervalo.
                </p>
              </div>
              <button
                onClick={carregarStatusHoje}
                disabled={carregando}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Atualizar"
              >
                <RefreshCw size={18} className={carregando ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Entrada Manhã */}
              <div className={`p-5 rounded-2xl border text-center transition-all ${
                pontoHoje?.entrada_1 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : statusJornada?.proxima_acao === 'ENTRADA'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/30'
                    : 'bg-slate-50 border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>1. ENTRADA</span>
                  <LogIn size={16} className="text-slate-400" />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(pontoHoje?.entrada_1)}
                </div>
                <p className="text-[11px] text-slate-400 mb-4">Horário sugerido: 09:00</p>
                
                <button
                  disabled={carregando || !!pontoHoje?.entrada_1}
                  onClick={() => handleBaterPonto('ENTRADA_1')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    pontoHoje?.entrada_1
                      ? 'bg-emerald-600 text-white cursor-default'
                      : statusJornada?.proxima_acao === 'ENTRADA'
                        ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white hover:opacity-95`
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {pontoHoje?.entrada_1 ? '✓ Registrado' : 'Bater Entrada'}
                </button>
              </div>

              {/* 2. Saída Almoço */}
              <div className={`p-5 rounded-2xl border text-center transition-all ${
                pontoHoje?.saida_1 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : statusJornada?.proxima_acao === 'SAIDA_ALMOCO'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/30'
                    : 'bg-slate-50 border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>2. SAÍDA ALMOÇO</span>
                  <Coffee size={16} className="text-amber-500" />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(pontoHoje?.saida_1)}
                </div>
                <p className="text-[11px] text-slate-400 mb-4">Horário sugerido: 12:00</p>
                
                <button
                  disabled={carregando || !pontoHoje?.entrada_1 || !!pontoHoje?.saida_1}
                  onClick={() => handleBaterPonto('SAIDA_1')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    pontoHoje?.saida_1
                      ? 'bg-emerald-600 text-white cursor-default'
                      : statusJornada?.proxima_acao === 'SAIDA_ALMOCO'
                        ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white hover:opacity-95`
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {pontoHoje?.saida_1 ? '✓ Registrado' : 'Saída Almoço'}
                </button>
              </div>

              {/* 3. Retorno Almoço */}
              <div className={`p-5 rounded-2xl border text-center transition-all ${
                pontoHoje?.entrada_2 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : statusJornada?.proxima_acao === 'RETORNO_ALMOCO'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/30'
                    : 'bg-slate-50 border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>3. RETORNO ALMOÇO</span>
                  <LogIn size={16} className="text-sky-500" />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(pontoHoje?.entrada_2)}
                </div>
                <p className="text-[11px] text-slate-400 mb-4">Horário sugerido: 13:00</p>
                
                <button
                  disabled={carregando || !pontoHoje?.saida_1 || !!pontoHoje?.entrada_2}
                  onClick={() => handleBaterPonto('ENTRADA_2')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    pontoHoje?.entrada_2
                      ? 'bg-emerald-600 text-white cursor-default'
                      : statusJornada?.proxima_acao === 'RETORNO_ALMOCO'
                        ? `bg-gradient-to-r ${temaAtual.bgGradiente} text-white hover:opacity-95`
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {pontoHoje?.entrada_2 ? '✓ Registrado' : 'Retorno Almoço'}
                </button>
              </div>

              {/* 4. Saída Final */}
              <div className={`p-5 rounded-2xl border text-center transition-all ${
                pontoHoje?.saida_2 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : statusJornada?.proxima_acao === 'SAIDA_FINAL'
                    ? 'border-sky-500 ring-2 ring-sky-100 bg-sky-50/30'
                    : 'bg-slate-50 border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span>4. SAÍDA FINAL</span>
                  <LogOut size={16} className="text-rose-500" />
                </div>
                <div className="text-2xl font-black font-mono text-slate-800 my-2">
                  {formatHora(pontoHoje?.saida_2)}
                </div>
                <p className="text-[11px] text-slate-400 mb-4">Horário sugerido: 18:00</p>
                
                <button
                  disabled={carregando || !pontoHoje?.entrada_2 || !!pontoHoje?.saida_2}
                  onClick={() => handleBaterPonto('SAIDA_2')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    pontoHoje?.saida_2
                      ? 'bg-emerald-600 text-white cursor-default'
                      : statusJornada?.proxima_acao === 'SAIDA_FINAL'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {pontoHoje?.saida_2 ? '✓ Finalizado' : 'Bater Saída'}
                </button>
              </div>
            </div>

            {/* Aviso Legal de Intervalo Interjornada */}
            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 flex items-start gap-3">
              <Shield size={20} className="text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-900 leading-relaxed">
                <span className="font-bold block">Proteção Trabalhista (Art. 66 da CLT):</span>
                Entre o término de uma jornada diária e o início da seguinte é obrigatório o intervalo mínimo ininterrupto de <strong>11 (onze) horas</strong> consecutivas para descanso. O sistema trava automaticamente tentativas de início antes desse prazo legal.
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
                        {reg.minutos_hora_extra_autorizada > 0 ? formatMinutos(reg.minutos_hora_extra_autorizada) : '-'}
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
                        {item.minutos_hora_extra_autorizada > 0 ? formatMinutos(item.minutos_hora_extra_autorizada) : '0m'}
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
          {/* Header da Aba */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sliders size={20} className={temaAtual.textoHighlight} />
                <span>Configuração de Jornadas & Escalas por Perfil</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Defina os horários oficiais de entrada, almoço, saída e regras da CLT para cada cargo da sua empresa.
              </p>
            </div>

            {/* Seletor de Perfil */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
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
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      isSel 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card do Formulário de Escala */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Horário de Trabalho: {
                    perfilAtivoEscala === 'OPERADOR_CAIXA' ? 'Operador de Caixa (Frente de Caixa)' :
                    perfilAtivoEscala === 'ESTOQUISTA' ? 'Controlador de Estoque (Inventário)' :
                    'Gerente Geral (Administrador)'
                  }
                </h4>
                <p className="text-xs text-slate-500">
                  Estes horários serão usados como parâmetros padrão para o cálculo de batidas e horas extras.
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
                <span>{salvandoEscala ? 'Salvando Escala...' : 'Salvar Escala do Perfil'}</span>
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
