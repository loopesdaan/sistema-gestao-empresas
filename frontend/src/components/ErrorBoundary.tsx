import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro não tratado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50/50 rounded-2xl border border-slate-200/80 my-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 text-center border border-slate-200 shadow-xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                {this.props.fallbackTitle || 'Ops, algo inesperado aconteceu nesta seção'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ocorreu uma falha ao renderizar os dados desta visualização. Nenhuma informação foi perdida.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 max-h-32 overflow-y-auto">
                <span className="font-bold text-rose-600 block mb-0.5">Erro detectado:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <RotateCcw size={14} />
                <span>Tentar Novamente</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Home size={14} />
                <span>Recarregar Tela</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
