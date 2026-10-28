import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const inputRef = useRef<HTMLInputElement>(null);

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

      // Foca no input após abrir
      setTimeout(() => inputRef.current?.focus(), 150);

      // Trava scroll do body enquanto o chat estiver aberto no mobile
      document.body.style.overflow = 'hidden';

      // Fechar no Escape
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onFechar();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearInterval(interval);
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
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
      setTimeout(() => {
        fimChatRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  };

  const badgePerfil = (perfil: string) => {
    switch (perfil) {
      case 'ADMIN':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">ADM</span>;
      case 'FINANCEIRO':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">Financeiro</span>;
      case 'ESTOQUISTA':
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300">Estoque</span>;
      default:
        return <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">Operador</span>;
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

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden bg-slate-950/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
      onClick={onFechar}
    >
      <div 
        className="w-full sm:w-[420px] max-w-full bg-white dark:bg-slate-900 h-[100dvh] max-h-[100dvh] flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do Chat */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <span>Canal da Equipe</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Mensagens em tempo real</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar conversa (Esc)"
            aria-label="Fechar chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 dark:bg-slate-950/50">
          {carregandoInicial && mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-2">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
              <span className="text-xs">Carregando mensagens...</span>
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 dark:text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                💬
              </div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Nenhuma mensagem recente</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-relaxed max-w-xs">
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
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-[10px] font-black shrink-0 overflow-hidden shadow-2xs">
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
                  <div className={`max-w-[78%] space-y-1 ${ehEu ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 ${ehEu ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{ehEu ? 'Você' : msg.usuario_nome}</span>
                      {badgePerfil(msg.usuario_perfil)}
                      <span className="text-slate-400 dark:text-slate-500 text-[9px]">{formatHoraChat(msg.created_at)}</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-2xs ${
                        ehEu
                          ? 'bg-slate-900 dark:bg-sky-600 text-white rounded-tr-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs'
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

        {/* Rodapé / Input de Envio com Safe Area para Mobile */}
        <form 
          onSubmit={handleEnviar} 
          className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            required
            maxLength={1000}
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder="Mensagem para a equipe..."
            className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/80 focus:bg-white dark:focus:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-slate-400 dark:focus:ring-sky-500 transition-all"
          />
          <button
            type="submit"
            disabled={enviando || !novoTexto.trim()}
            className="p-2.5 bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Enviar mensagem"
          >
            {enviando ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
