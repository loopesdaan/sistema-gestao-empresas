import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Users, Sparkles, RefreshCw } from 'lucide-react';
import { apiService, resolveImageUrl } from '../services/api';
import { MensagemChat } from '../types';
import { useEmpresa } from '../contexts/EmpresaContext';

interface ChatInternoProps {
  aberto: boolean;
  onFechar: () => void;
  usuarioAtualNome?: string;
}

export const ChatInterno: React.FC<ChatInternoProps> = ({ aberto, onFechar, usuarioAtualNome }) => {
  const { temaAtual } = useEmpresa();
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(false);
  const fimChatRef = useRef<HTMLDivElement>(null);

  const carregarMensagens = async (silencioso = false) => {
    try {
      if (!silencioso) setCarregandoInicial(true);
      const res = await apiService.getMensagens(80);
      setMensagens(res);
    } catch (err) {
      console.error('Erro ao buscar mensagens do chat:', err);
    } finally {
      if (!silencioso) setCarregandoInicial(false);
    }
  };

  useEffect(() => {
    if (aberto) {
      carregarMensagens();
      const interval = setInterval(() => {
        carregarMensagens(true);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [aberto]);

  useEffect(() => {
    if (aberto) {
      fimChatRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, aberto]);

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const textoLimpo = novoTexto.trim();
    if (!textoLimpo || enviando) return;

    try {
      setEnviando(true);
      const msgCriada = await apiService.enviarMensagem(textoLimpo);
      setNovoTexto('');
      setMensagens((prev) => [...prev, msgCriada]);
      setTimeout(() => fimChatRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  };

  const badgePerfil = (perfil: string) => {
    switch (perfil) {
      case 'ADMIN':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800">ADM</span>;
      case 'FINANCEIRO':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 text-purple-800">Financeiro</span>;
      case 'ESTOQUISTA':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-cyan-100 text-cyan-800">Estoque</span>;
      default:
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800">Operador</span>;
    }
  };

  const formatHoraChat = (dataIso?: string) => {
    if (!dataIso) return '';
    try {
      const d = new Date(dataIso.endsWith('Z') ? dataIso : `${dataIso}Z`);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
      <div 
        className="w-full sm:w-96 max-w-full bg-white h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do Chat */}
        <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span>Canal da Equipe</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-400">Mensagens em tempo real para todos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            title="Fechar chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {carregandoInicial && mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
              <span className="text-xs">Carregando conversa...</span>
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                💬
              </div>
              <h4 className="text-xs font-bold text-slate-700">Nenhuma mensagem recente</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                Inicie uma conversa! Todos os colaboradores da sua empresa receberão o recado aqui.
              </p>
            </div>
          ) : (
            mensagens.map((msg) => {
              const ehEu = !!msg.eh_meu;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${ehEu ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar do Autor */}
                  <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 text-[10px] font-black shrink-0 overflow-hidden shadow-2xs">
                    {msg.usuario_foto_url ? (
                      <img
                        src={resolveImageUrl(msg.usuario_foto_url)}
                        alt={msg.usuario_nome}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      msg.usuario_nome.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Balão */}
                  <div className={`max-w-[75%] space-y-1 ${ehEu ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 ${ehEu ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-bold text-slate-700">{ehEu ? 'Você' : msg.usuario_nome}</span>
                      {badgePerfil(msg.usuario_perfil)}
                      <span className="text-slate-400 text-[9px]">{formatHoraChat(msg.created_at)}</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                        ehEu
                          ? 'bg-slate-900 text-white rounded-tr-xs'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {msg.conteudo}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={fimChatRef} />
        </div>

        {/* Rodapé / Input de Envio */}
        <form onSubmit={handleEnviar} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
          <input
            type="text"
            required
            maxLength={1000}
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder="Mensagem para a equipe..."
            className="flex-1 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-400 transition-all"
          />
          <button
            type="submit"
            disabled={enviando || !novoTexto.trim()}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Enviar mensagem"
          >
            {enviando ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>
  );
};
