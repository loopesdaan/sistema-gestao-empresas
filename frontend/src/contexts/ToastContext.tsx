import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

export interface ToastItem {
  id: string;
  tipo: ToastTipo;
  titulo?: string;
  mensagem: string;
  duracao?: number;
}

export interface ConfirmacaoOptions {
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tipo?: 'perigo' | 'aviso' | 'info';
  onConfirmar: () => void | Promise<void>;
  onCancelar?: () => void;
}

interface ToastContextType {
  toast: {
    sucesso: (mensagem: string, titulo?: string, duracao?: number) => void;
    erro: (mensagem: string, titulo?: string, duracao?: number) => void;
    aviso: (mensagem: string, titulo?: string, duracao?: number) => void;
    info: (mensagem: string, titulo?: string, duracao?: number) => void;
  };
  confirmar: (opcoes: ConfirmacaoOptions) => void;
  fecharConfirmacao: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoOptions | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const removerToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const adicionarToast = useCallback((tipo: ToastTipo, mensagem: string, titulo?: string, duracao = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { id, tipo, titulo, mensagem, duracao }]);

    if (duracao > 0) {
      setTimeout(() => {
        removerToast(id);
      }, duracao);
    }
  }, [removerToast]);

  const toast = {
    sucesso: (mensagem: string, titulo?: string, duracao?: number) =>
      adicionarToast('sucesso', mensagem, titulo || 'Sucesso', duracao),
    erro: (mensagem: string, titulo?: string, duracao?: number) =>
      adicionarToast('erro', mensagem, titulo || 'Atenção / Erro', duracao),
    aviso: (mensagem: string, titulo?: string, duracao?: number) =>
      adicionarToast('aviso', mensagem, titulo || 'Aviso', duracao),
    info: (mensagem: string, titulo?: string, duracao?: number) =>
      adicionarToast('info', mensagem, titulo || 'Informação', duracao),
  };

  const confirmar = useCallback((opcoes: ConfirmacaoOptions) => {
    setConfirmacao(opcoes);
  }, []);

  const fecharConfirmacao = useCallback(() => {
    if (confirmacao?.onCancelar) {
      confirmacao.onCancelar();
    }
    setConfirmacao(null);
    setConfirmando(false);
  }, [confirmacao]);

  const executarConfirmacao = async () => {
    if (!confirmacao) return;
    setConfirmando(true);
    try {
      await confirmacao.onConfirmar();
    } finally {
      setConfirmando(false);
      setConfirmacao(null);
    }
  };

  // Intercepta chamadas de window.alert e window.prompt legadas e redireciona para toast no estilo da aplicação
  useEffect(() => {
    const alertOriginal = window.alert;
    const promptOriginal = window.prompt;

    window.alert = (msg: any) => {
      const texto = typeof msg === 'string' ? msg : JSON.stringify(msg);
      // Se tiver palavra erro ou falha, usa estilo erro, senão aviso
      if (/erro|falha|invalid|inválid|não encontrado|nao encontrado/i.test(texto)) {
        toast.erro(texto);
      } else {
        toast.aviso(texto);
      }
    };

    window.prompt = (msg?: string, _defaultText?: string) => {
      toast.aviso(msg || 'Operação requer confirmação visual do sistema.');
      return null;
    };

    return () => {
      window.alert = alertOriginal;
      window.prompt = promptOriginal;
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirmar, fecharConfirmacao }}>
      {children}

      {/* Container de Toasts Flutuantes */}
      <div 
        aria-live="polite"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const config = {
            sucesso: {
              border: 'border-emerald-500/40',
              bg: 'bg-emerald-50/95 text-emerald-950',
              iconBg: 'bg-emerald-500 text-white',
              Icon: CheckCircle2,
            },
            erro: {
              border: 'border-rose-500/40',
              bg: 'bg-rose-50/95 text-rose-950',
              iconBg: 'bg-rose-500 text-white',
              Icon: AlertCircle,
            },
            aviso: {
              border: 'border-amber-500/40',
              bg: 'bg-amber-50/95 text-amber-950',
              iconBg: 'bg-amber-500 text-white',
              Icon: AlertTriangle,
            },
            info: {
              border: 'border-sky-500/40',
              bg: 'bg-sky-50/95 text-sky-950',
              iconBg: 'bg-sky-500 text-white',
              Icon: Info,
            },
          }[t.tipo];

          const IconComponent = config.Icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 fade-in ${config.border} ${config.bg}`}
              role="alert"
            >
              <div className={`p-1.5 rounded-xl shrink-0 mt-0.5 shadow-xs ${config.iconBg}`}>
                <IconComponent size={18} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                {t.titulo && (
                  <h5 className="font-bold text-xs uppercase tracking-wider mb-0.5 opacity-90">
                    {t.titulo}
                  </h5>
                )}
                <p className="text-xs leading-relaxed font-medium break-words">
                  {t.mensagem}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removerToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                title="Fechar notificação"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação Integrado (Substituto Nativo para window.confirm) */}
      {confirmacao && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !confirmando && fecharConfirmacao()}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                confirmacao.tipo === 'perigo' 
                  ? 'bg-rose-100 text-rose-600' 
                  : confirmacao.tipo === 'aviso'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-sky-100 text-sky-600'
              }`}>
                {confirmacao.tipo === 'perigo' ? (
                  <AlertCircle size={24} />
                ) : confirmacao.tipo === 'aviso' ? (
                  <AlertTriangle size={24} />
                ) : (
                  <Info size={24} />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-black text-slate-800">
                  {confirmacao.titulo}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmacao.mensagem}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={confirmando}
                onClick={fecharConfirmacao}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {confirmacao.textoCancelar || 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={confirmando}
                onClick={executarConfirmacao}
                className={`px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  confirmacao.tipo === 'perigo'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'
                    : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700'
                }`}
              >
                {confirmando ? (
                  <span>Processando...</span>
                ) : (
                  confirmacao.textoConfirmar || 'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser utilizado dentro de um ToastProvider');
  }
  return context;
};
